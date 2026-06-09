import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Order } from '../models';
import { CreateOrderPayload, OrderStatus } from '../type';

@Injectable()
export class OrderService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async getAll(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(`SELECT * FROM orders`);
    return rows.map((row) => ({
      id: row.id,
      items: [],
      address: row.delivery ?? {},
      statusHistory: [
        {
          status: row.status,
          timestamp: Date.now(),
          comment: row.comments ?? '',
        },
      ],
      status: row.status,
      total: Number(row.total),
    }));
  }

  async findById(orderId: string): Promise<Order | null> {
    const { rows } = await this.pool.query<Order>(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId],
    );
    return rows[0] ?? null;
  }

  async create(data: CreateOrderPayload): Promise<Order> {
    const { rows } = await this.pool.query<Order>(
      `INSERT INTO orders (user_id, cart_id, payment, delivery, comments, status, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.userId,
        data.cartId,
        JSON.stringify({}),
        JSON.stringify(data.address),
        '',
        OrderStatus.Open,
        data.total,
      ],
    );
    return rows[0];
  }

  async update(orderId: string, data: Partial<Order>): Promise<void> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new Error('Order does not exist.');
    }
    await this.pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2`,
      [data.status ?? order.status, orderId],
    );
  }
}
