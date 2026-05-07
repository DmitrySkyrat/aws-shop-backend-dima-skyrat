import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const products = [
    {
        id: '1',
        title: 'Product 1',
        description: 'Description for product 1',
        price: 100,
    },
    {
        id: '2',
        title: 'Product 2',
        description: 'Description for product 2',
        price: 200,
    },
    {
        id: '3',
        title: 'Product 3',
        description: 'Description for product 3',
        price: 300,
    },
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(products),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    }
};
