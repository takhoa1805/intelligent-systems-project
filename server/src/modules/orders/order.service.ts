import { withTransaction } from '../../config/database.js';
import { AppError } from '../../shared/AppError.js';
import * as repository from './order.repository.js';
import {
  parseCreateOrderDto,
  type CreateOrderDto,
  type OrderConfirmationDto,
  type OrderItemInputDto,
  type ResolvedOrderItemDto,
} from './order.dto.js';

function normalizeOrder(input: unknown): CreateOrderDto {
  const { customer, items } = parseCreateOrderDto(input);
  const itemTotals = new Map<number, number>();
  for (const item of items) {
    itemTotals.set(item.productId, (itemTotals.get(item.productId) || 0) + item.quantity);
  }
  const normalized: OrderItemInputDto[] = [...itemTotals].map(([productId, quantity]) => ({ productId, quantity }));
  return { customer, items: normalized };
}

export async function createOrder(input: unknown): Promise<OrderConfirmationDto> {
  const { customer, items } = normalizeOrder(input);
  return withTransaction(async (client) => {
    const products = await repository.findProducts(client, [...new Set(items.map((item) => item.productId))]);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const resolvedItems: ResolvedOrderItemDto[] = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError('One or more products no longer exist', 400);
      if (product.stock < item.quantity) throw new AppError(`Not enough stock for ${product.name}`, 409);
      return { ...product, price: Number(product.price), quantity: item.quantity };
    });
    const total = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await repository.insertOrder(client, {
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      total,
    });
    for (const item of resolvedItems) {
      await repository.insertOrderItem(client, order.id, item);
      const stockUpdated = await repository.decrementStock(client, item.id, item.quantity);
      if (!stockUpdated) throw new AppError(`Not enough stock for ${item.name}`, 409);
    }
    return {
      id: Number(order.id),
      order_number: order.orderNumber,
      total: Number(order.total),
      created_at: order.createdAt,
    };
  });
}
