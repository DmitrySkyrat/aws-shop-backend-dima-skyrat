import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Readable } from 'stream';
import csv from 'csv-parser';

export const handler = async (event: S3Event): Promise<void> => {
  console.log('S3 event received:', JSON.stringify(event));

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: s3://${bucketName}/${objectKey}`);

    await parseCSV(bucketName, objectKey);
    await moveToparsed(bucketName, objectKey);
  }
};

async function parseCSV(bucketName: string, objectKey: string): Promise<void> {
  const s3Client = new S3Client({});
  const sqsClient = new SQSClient({});
  const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
  const response = await s3Client.send(getCommand);

  if (!response.Body) {
    throw new Error(`Empty body for s3://${bucketName}/${objectKey}`);
  }

  const stream = response.Body as Readable;
  const sendPromises: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (data: Record<string, string>) => {
        const promise = sqsClient
          .send(
            new SendMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL!,
              MessageBody: JSON.stringify(data),
            })
          )
          .then(() => undefined);
        sendPromises.push(promise);
      })
      .on('error', (error: Error) => {
        console.error('CSV parsing error:', error);
        reject(error);
      })
      .on('end', async () => {
        try {
          await Promise.all(sendPromises);
          console.log(`Finished parsing and queuing: ${objectKey}`);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
  });
}

async function moveToparsed(bucketName: string, objectKey: string): Promise<void> {
  const s3Client = new S3Client({});
  const parsedKey = objectKey.replace(/^uploaded\//, 'parsed/');

  console.log(`Copying s3://${bucketName}/${objectKey} to s3://${bucketName}/${parsedKey}`);

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${objectKey}`,
      Key: parsedKey,
    }),
  );

  console.log(`Deleting original: s3://${bucketName}/${objectKey}`);

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  console.log(`Moved ${objectKey} to ${parsedKey}`);
}
