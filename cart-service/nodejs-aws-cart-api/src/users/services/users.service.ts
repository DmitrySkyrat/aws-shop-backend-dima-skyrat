import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { User } from '../models';

@Injectable()
export class UsersService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findOne(name: string): Promise<User | undefined> {
    const { rows } = await this.pool.query<User>(
      `SELECT * FROM users WHERE name = $1 LIMIT 1`,
      [name],
    );
    return rows[0];
  }

  async createOne({ name, password }: User): Promise<User> {
    const { rows } = await this.pool.query<User>(
      `INSERT INTO users (name, password) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET password = EXCLUDED.password
       RETURNING *`,
      [name, password],
    );
    return rows[0];
  }
}
