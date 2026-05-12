import { handler } from '../createProduct';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({}),
    }),
  },
  PutCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

describe('createProduct', () => {
  beforeEach(() => {
    process.env.PRODUCTS_TABLE = 'products';
    process.env.STOCKS_TABLE = 'stocks';
  });

  it('should create a product and return 201 with the created product', async () => {
    const event = {
      body: JSON.stringify({ title: 'Test Product', description: 'A description', price: 100, count: 5 }),
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.id).toBe('test-uuid-1234');
    expect(body.title).toBe('Test Product');
    expect(body.price).toBe(100);
    expect(body.count).toBe(5);
  });

  it('should return 400 when body is missing', async () => {
    const event = { body: null } as any;
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('message', 'Request body is missing');
  });

  it('should return 400 when title is missing', async () => {
    const event = {
      body: JSON.stringify({ description: 'A description', price: 100, count: 5 }),
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toMatch(/title/i);
  });

  it('should return 400 when price is not a positive number', async () => {
    const event = {
      body: JSON.stringify({ title: 'Test', price: -10, count: 5 }),
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toMatch(/price/i);
  });

  it('should return 400 when count is missing', async () => {
    const event = {
      body: JSON.stringify({ title: 'Test', price: 50 }),
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toMatch(/count/i);
  });

  it('should use empty string as default description when not provided', async () => {
    const event = {
      body: JSON.stringify({ title: 'No Desc', price: 50, count: 0 }),
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.description).toBe('');
  });
});
