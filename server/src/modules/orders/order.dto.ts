import { z } from 'zod';
import { parseDto } from '../../shared/dto/validation.js';

export interface CustomerDto {
  name: string;
  email: string;
}

export interface OrderItemInputDto {
  productId: number;
  quantity: number;
}

export interface CreateOrderDto {
  customer: CustomerDto;
  items: OrderItemInputDto[];
}

export interface OrderConfirmationDto {
  id: number;
  order_number: string;
  total: number;
  created_at: Date;
}

export interface ResolvedOrderItemDto {
  id: number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(160),
  }),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
});

export function parseCreateOrderDto(input: unknown): CreateOrderDto {
  return parseDto(createOrderSchema, input);
}
