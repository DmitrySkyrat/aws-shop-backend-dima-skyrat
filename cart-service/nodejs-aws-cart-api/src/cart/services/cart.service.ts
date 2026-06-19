import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Cart, CartStatuses } from '../models';
import { PutCartPayload } from 'src/order/type';

@Injectable()
export class CartService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  private async getCartItems(cartId: string): Promise<Cart['items']> {
    const { rows } = await this.pool.query<{
      product_id: string;
      count: number;
      product: Cart['items'][number]['product'];
    }>('SELECT product_id, count, product FROM cart_items WHERE cart_id = $1', [
      cartId,
    ]);
    return rows.map((row) => ({ product: row.product, count: row.count }));
  }

  async findByUserId(userId: string): Promise<Cart | null> {
    const { rows } = await this.pool.query<Omit<Cart, 'items'>>(
      `SELECT id, user_id, created_at, updated_at, status
       FROM carts WHERE user_id = $1 AND status = 'OPEN' LIMIT 1`,
      [userId],
    );
    if (!rows[0]) return null;
    const items = await this.getCartItems(rows[0].id);
    return { ...rows[0], items };
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const { rows } = await this.pool.query<Omit<Cart, 'items'>>(
      `INSERT INTO carts (user_id, status) VALUES ($1, 'OPEN') RETURNING *`,
      [user_id],
    );
    return { ...rows[0], items: [] };
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const cart = await this.findByUserId(userId);
    return cart ?? this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const cart = await this.findOrCreateByUserId(userId);

    if (payload.count === 0) {
      await this.pool.query(
        'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cart.id, payload.product.id],
      );
    } else {
      await this.pool.query(
        `INSERT INTO cart_items (cart_id, product_id, count, product)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cart_id, product_id)
         DO UPDATE SET count = EXCLUDED.count, product = EXCLUDED.product`,
        [
          cart.id,
          payload.product.id,
          payload.count,
          JSON.stringify(payload.product),
        ],
      );
    }

    await this.pool.query(
      `UPDATE carts SET updated_at = NOW() WHERE id = $1`,
      [cart.id],
    );

    const items = await this.getCartItems(cart.id);
    return { ...cart, items };
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE carts SET status = 'ORDERED', updated_at = NOW()
       WHERE user_id = $1 AND status = 'OPEN'`,
      [userId],
    );
  }

  async updateCartStatus(cartId: string, status: CartStatuses): Promise<void> {
    await this.pool.query(
      `UPDATE carts SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, cartId],
    );
  }

  async checkoutInTransaction(
    cartId: string,
    orderData: {
      userId: string;
      address: Record<string, unknown>;
      total: number;
    },
  ): Promise<{ id: string; status: string; total: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO orders (user_id, cart_id, payment, delivery, comments, status, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          orderData.userId,
          cartId,
          JSON.stringify({}),
          JSON.stringify(orderData.address),
          '',
          'OPEN',
          orderData.total,
        ],
      );

      await client.query(
        `UPDATE carts SET status = 'ORDERED', updated_at = NOW() WHERE id = $1`,
        [cartId],
      );

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
