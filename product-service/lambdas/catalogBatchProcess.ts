import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient({});

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;

export interface ProductInput {
  title: string;
  description?: string;
  price: number;
  count: number;
}

export async function createProductInDB(input: ProductInput): Promise<string> {
  const { title, description, price, count } = input;
  const id = randomUUID();

  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: PRODUCTS_TABLE,
            Item: { id, title, description: description ?? '', price },
          },
        },
        {
          Put: {
            TableName: STOCKS_TABLE,
            Item: { product_id: id, count },
          },
        },
      ],
    })
  );

  return id;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('SQS event received:', JSON.stringify(event));

  for (const record of event.Records) {
    const body = JSON.parse(record.body) as ProductInput;

    const id = await createProductInDB(body);
    console.log(`Created product id=${id}: ${body.title}`);

    await snsClient.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: 'New product created',
        Message: JSON.stringify({
          message: 'Product was successfully created',
          product: { ...body, id },
        }),
        MessageAttributes: {
          price: {
            DataType: 'Number',
            StringValue: String(body.price),
          },
        },
      })
    );

    console.log(`SNS notification sent for product: ${body.title}`);
  }
};
