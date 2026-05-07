import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const products = [
    { id: '1', title: 'Product 1', description: '...', price: 100 },
    { id: '2', title: 'Product 2', description: '...', price: 200 },
    { id: '3', title: 'Product 3', description: '...', price: 300 },
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const productId = event.pathParameters?.productId;

        if (!productId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing productId' }),
            };
        }

        const product = products.find(p => p.id === productId);

        if (!product) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Product not found' }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(product),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    }
};
