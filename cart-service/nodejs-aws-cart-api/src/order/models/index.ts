import { Address, OrderStatus } from '../type';

export type Order = {
  id?: string;
  userId: string;
  cartId: string;
  payment: Record<string, unknown>;
  delivery: Address;
  comments: string;
  status: OrderStatus;
  total: number;
};
