import { S3Event, S3EventRecord } from 'aws-lambda';
import { GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { handler } from '../importFileParser';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
}));

const makeCsvStream = (rows: string[]): Readable => {
  const csvContent = ['title,description,price,count', ...rows].join('\n');
  return Readable.from([csvContent]);
};

const makeS3Event = (bucket: string, key: string): S3Event => ({
  Records: [
    {
      s3: {
        bucket: { name: bucket, arn: '', ownerIdentity: { principalId: '' } },
        object: {
          key,
          size: 100,
          eTag: '',
          sequencer: '',
        },
        configurationId: '',
        s3SchemaVersion: '1.0',
      },
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-east-1',
      eventTime: '',
      eventName: 'ObjectCreated:Put',
      userIdentity: { principalId: '' },
      requestParameters: { sourceIPAddress: '' },
      responseElements: { 'x-amz-request-id': '', 'x-amz-id-2': '' },
    } as S3EventRecord,
  ],
});

describe('importFileParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
  });

  it('parses CSV records and logs them', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const csvStream = makeCsvStream([
      'Product A,Description A,10.99,5',
      'Product B,Description B,5.99,10',
    ]);

    mockSend.mockResolvedValueOnce({ Body: csvStream });
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});

    const event = makeS3Event('test-bucket', 'uploaded/products.csv');
    await handler(event);

    const loggedRecords = consoleSpy.mock.calls
      .filter(call => call[0] === 'Parsed record:')
      .map(call => JSON.parse(call[1]));

    expect(loggedRecords).toHaveLength(2);
    expect(loggedRecords[0]).toMatchObject({ title: 'Product A' });
    expect(loggedRecords[1]).toMatchObject({ title: 'Product B' });

    consoleSpy.mockRestore();
  });

  it('copies file to parsed folder after parsing', async () => {
    const csvStream = makeCsvStream(['Product A,Description A,10.99,5']);

    mockSend.mockResolvedValueOnce({ Body: csvStream });
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});

    const event = makeS3Event('test-bucket', 'uploaded/products.csv');
    await handler(event);

    const copyCall = mockSend.mock.calls[1][0];
    expect(copyCall).toBeInstanceOf(CopyObjectCommand);
    expect(copyCall.input).toMatchObject({
      Bucket: 'test-bucket',
      CopySource: 'test-bucket/uploaded/products.csv',
      Key: 'parsed/products.csv',
    });
  });

  it('deletes original file after copying', async () => {
    const csvStream = makeCsvStream(['Product A,Description A,10.99,5']);

    mockSend.mockResolvedValueOnce({ Body: csvStream });
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});

    const event = makeS3Event('test-bucket', 'uploaded/products.csv');
    await handler(event);

    const deleteCall = mockSend.mock.calls[2][0];
    expect(deleteCall).toBeInstanceOf(DeleteObjectCommand);
    expect(deleteCall.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'uploaded/products.csv',
    });
  });

  it('decodes URL-encoded keys', async () => {
    const csvStream = makeCsvStream([]);

    mockSend.mockResolvedValueOnce({ Body: csvStream });
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});

    const event = makeS3Event('test-bucket', 'uploaded/my%20products.csv');
    await handler(event);

    const getCall = mockSend.mock.calls[0][0];
    expect(getCall).toBeInstanceOf(GetObjectCommand);
    expect(getCall.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'uploaded/my products.csv',
    });
  });

  it('throws when S3 body is empty', async () => {
    mockSend.mockResolvedValueOnce({ Body: null });

    const event = makeS3Event('test-bucket', 'uploaded/products.csv');
    await expect(handler(event)).rejects.toThrow('Empty body');
  });

  it('processes multiple records in one event', async () => {
    const csvStream1 = makeCsvStream(['A,Description,1,1']);
    const csvStream2 = makeCsvStream(['B,Description,2,2']);

    mockSend
      .mockResolvedValueOnce({ Body: csvStream1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Body: csvStream2 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const event: S3Event = {
      Records: [
        ...makeS3Event('test-bucket', 'uploaded/file1.csv').Records,
        ...makeS3Event('test-bucket', 'uploaded/file2.csv').Records,
      ],
    };

    await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(6);
  });
});
