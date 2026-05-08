import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Incoming request:', JSON.stringify(event));

  try {
    const productsResult = await dynamoDB.send(new ScanCommand({ TableName: PRODUCTS_TABLE }));
    const stocksResult = await dynamoDB.send(new ScanCommand({ TableName: STOCKS_TABLE }));

    const products = productsResult.Items || [];
    const stocks = stocksResult.Items || [];

    const joinedProducts = products.map(product => ({
      ...product,
      count: stocks.find(stock => stock.product_id === product.id)?.count || 0,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(joinedProducts),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
