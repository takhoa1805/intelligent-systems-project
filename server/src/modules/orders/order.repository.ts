import type { Order, Prisma, Product } from '@prisma/client';
import type { ResolvedOrderItemDto } from './order.dto.js';

export async function findProducts(
  client: Prisma.TransactionClient,
  productIds: number[],
): Promise<Product[]> {
  return client.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
}

export async function insertOrder(
  client: Prisma.TransactionClient,
  input: { customerName: string; customerEmail: string; total: number },
): Promise<Order> {
  return client.order.create({
    data: {
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      subtotal: input.total,
      total: input.total,
      status: 'paid',
    },
  });
}

export async function insertOrderItem(
  client: Prisma.TransactionClient,
  orderId: bigint,
  item: ResolvedOrderItemDto,
): Promise<void> {
  await client.orderItem.create({
    data: {
      orderId,
      productId: item.id,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
    },
  });
}

export async function decrementStock(
  client: Prisma.TransactionClient,
  productId: number,
  quantity: number,
): Promise<boolean> {
  const result = await client.product.updateMany({
    where: { id: productId, active: true, stock: { gte: quantity } },
    data: { stock: { decrement: quantity }, updatedAt: new Date() },
  });
  return result.count === 1;
}
