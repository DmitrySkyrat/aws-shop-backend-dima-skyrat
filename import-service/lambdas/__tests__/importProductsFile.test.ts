import { APIGatewayProxyEvent } from 'aws-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../importProductsFile';

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@aws-sdk/s3-request-presigner');

const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const mockEvent = (queryParams: Record<string, string> | null = null): APIGatewayProxyEvent =>
  ({
    queryStringParameters: queryParams,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/import',
    pathParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    body: null,
  }) as APIGatewayProxyEvent;

describe('importProductsFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.REGION = 'us-east-1';
  });

  it('returns 400 when name query parameter is missing', async () => {
    const result = await handler(mockEvent(null));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Query parameter "name" is required',
    });
  });

  it('returns 400 when name query parameter is empty object', async () => {
    const result = await handler(mockEvent({}));

    expect(result.statusCode).toBe(400);
  });

  it('returns 200 with signed URL when name is provided', async () => {
    const fakeSignedUrl =
      'https://test-bucket.s3.amazonaws.com/uploaded/products.csv?X-Amz-Signature=abc';
    mockedGetSignedUrl.mockResolvedValueOnce(fakeSignedUrl);

    const result = await handler(mockEvent({ name: 'products.csv' }));

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(fakeSignedUrl);
  });

  it('calls getSignedUrl with correct bucket and key', async () => {
    const fakeSignedUrl = 'https://signed-url.example.com';
    mockedGetSignedUrl.mockResolvedValueOnce(fakeSignedUrl);

    await handler(mockEvent({ name: 'products.csv' }));

    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
    const [, command] = mockedGetSignedUrl.mock.calls[0];
    expect((command as any).input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'uploaded/products.csv',
    });
  });

  it('returns 500 when S3 throws an error', async () => {
    mockedGetSignedUrl.mockRejectedValueOnce(new Error('S3 error'));

    const result = await handler(mockEvent({ name: 'products.csv' }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Internal Server Error' });
  });

  it('sets Access-Control-Allow-Origin header', async () => {
    mockedGetSignedUrl.mockResolvedValueOnce('https://url.example.com');

    const result = await handler(mockEvent({ name: 'file.csv' }));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
  });
});
