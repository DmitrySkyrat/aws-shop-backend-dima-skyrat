import { handler } from '../getProductsList';

describe('getProductsList', () => {
    it('should return all products with status 200', async () => {
        const event = {} as any;
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        
        const body = JSON.parse(result.body);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toHaveProperty('id');
        expect(body[0]).toHaveProperty('title');
        expect(body[0]).toHaveProperty('price');
    });
});
