import { handler } from '../getProductsById';

describe('getProductsById', () => {
    it('should return product when valid ID is provided', async () => {
        const event = {
            pathParameters: { productId: '1' }
        } as any;
        
        const result = await handler(event);
        
        expect(result.statusCode).toBe(200);
        
        const body = JSON.parse(result.body);
        expect(body.id).toBe('1');
        expect(body.title).toBeDefined();
    });

    it('should return 400 when productId is missing', async () => {
        const event = { pathParameters: null } as any;
        const result = await handler(event);
        
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toHaveProperty('message', 'Missing productId');
    });

    it('should return 404 when product is not found', async () => {
        const event = {
            pathParameters: { productId: '999' }
        } as any;
        
        const result = await handler(event);
        
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toHaveProperty('message', 'Product not found');
    });
});
