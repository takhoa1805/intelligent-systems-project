import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../config/database.js';
import { parseDto } from '../../shared/dto/validation.js';
import { AppError } from '../../shared/AppError.js';
import type { Prisma } from '@prisma/client';

const orderQuery = z.object({
  search: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'paid', 'delivered', 'shipped', 'canceled']).default('all'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(8),
});
const orderSelect = { id: true, orderNumber: true, customerName: true, customerEmail: true, status: true, createdAt: true, total: true, currency: true } as const;
function summary(order: Prisma.OrderGetPayload<{ select: typeof orderSelect }>) {
  return { id: order.id.toString(), order_number: order.orderNumber, customer_name: order.customerName, customer_email: order.customerEmail, status: order.status, created_at: order.createdAt, total: order.total == null ? null : Number(order.total), currency: order.currency };
}
export async function listOrders(req: Request, res: Response): Promise<void> {
  const { search, status, page, pageSize } = parseDto(orderQuery, req.query);
  const where: Prisma.OrderWhereInput = {
    ...(status !== 'all' ? { status } : {}),
    ...(search ? { OR: [{ orderNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [orders, total] = await db.$transaction([
    db.order.findMany({ where, select: orderSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    db.order.count({ where }),
  ]);
  res.json({ items: orders.map(summary), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
export async function inspectOrder(req: Request, res: Response): Promise<void> {
  const id = parseDto(z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, 'Invalid order ID'), req.params.id);
  const order = await db.order.findUnique({ where: { id: BigInt(id) }, select: {
    ...orderSelect, subtotal: true, shippingTotal: true,
    items: { orderBy: { id: 'asc' }, select: { productId: true, productName: true, quantity: true, unitPrice: true } },
  } });
  if (!order) throw new AppError('Order not found', 404);
  res.json({ ...summary(order), subtotal: order.subtotal == null ? null : Number(order.subtotal), shipping_total: order.shippingTotal == null ? null : Number(order.shippingTotal), items: order.items.map((item) => ({ product_id: item.productId, product_name: item.productName, quantity: item.quantity, unit_price: Number(item.unitPrice) })) });
}
