import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler, createProductInDB } from '../catalogBatchProcess';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
  },
  TransactWriteCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('@aws-sdk/client-sns', () => {
  const snsSend = jest.fn();
  return {
    SNSClient: jest.fn().mockImplementation(() => ({ send: snsSend })),
    PublishCommand: jest.fn().mockImplementation((input: unknown) => input),
    __snsSend: snsSend,
  };
});

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

const { DynamoDBDocumentClient } = jest.requireMock('@aws-sdk/lib-dynamodb');
const mockSend = DynamoDBDocumentClient.from().send as jest.Mock;

const mockSnsSend = jest.requireMock('@aws-sdk/client-sns').__snsSend as jest.Mock;

const makeSqsEvent = (records: object[]): SQSEvent => ({
  Records: records.map(
    (body, i) =>
      ({
        messageId: `msg-${i}`,
        receiptHandle: `handle-${i}`,
        body: JSON.stringify(body),
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {},
        md5OfBody: '',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:catalogItemsQueue',
        awsRegion: 'us-east-1',
      } as SQSRecord)
  ),
});

describe('catalogBatchProcess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE = 'products';
    process.env.STOCKS_TABLE = 'stocks';
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:createProductTopic';
    mockSend.mockResolvedValue({});
    mockSnsSend.mockResolvedValue({});
  });

  it('should create product and stock in DynamoDB and return an id', async () => {
    const result = await createProductInDB({
      title: 'Test Product',
      description: 'Desc',
      price: 50,
      count: 10,
    });

    expect(result).toBe('test-uuid-1234');
    expect(mockSend).toHaveBeenCalledTimes(1);

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.TransactItems).toHaveLength(2);
    expect(callArg.TransactItems[0].Put.Item).toMatchObject({
      id: 'test-uuid-1234',
      title: 'Test Product',
      description: 'Desc',
      price: 50,
    });
    expect(callArg.TransactItems[1].Put.Item).toMatchObject({
      product_id: 'test-uuid-1234',
      count: 10,
    });
  });

  it('should process all SQS records and send SNS notifications', async () => {
    const event = makeSqsEvent([
      { title: 'Product A', price: 10, count: 5 },
      { title: 'Product B', price: 50, count: 2 },
    ]);

    await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSnsSend).toHaveBeenCalledTimes(2);
  });

  it('should include price as a Number message attribute in SNS', async () => {
    const event = makeSqsEvent([{ title: 'Expensive', price: 200, count: 1 }]);

    await handler(event);

    const snsCall = mockSnsSend.mock.calls[0][0];
    expect(snsCall.MessageAttributes.price.StringValue).toBe('200');
    expect(snsCall.MessageAttributes.price.DataType).toBe('Number');
  });

  it('should include product data in the SNS message body', async () => {
    const product = { title: 'Widget', description: 'A widget', price: 75, count: 3 };
    const event = makeSqsEvent([product]);

    await handler(event);

    const snsCall = mockSnsSend.mock.calls[0][0];
    const message = JSON.parse(snsCall.Message);
    expect(message.product).toMatchObject(product);
    expect(message.product.id).toBe('test-uuid-1234');
  });

  it('should handle an empty records array without errors', async () => {
    const event = makeSqsEvent([]);

    await expect(handler(event)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSnsSend).not.toHaveBeenCalled();
  });
});
