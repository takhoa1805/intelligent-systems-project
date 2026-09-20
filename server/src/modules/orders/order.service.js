import { withTransaction } from '../../config/database.js';
import { AppError } from '../../shared/AppError.js';
import * as repository from './order.repository.js';

function validateRequest({ customer, items }) {
  if (!customer?.name?.trim() || !customer?.email?.trim() || !Array.isArray(items) || !items.length) {
    throw new AppError('Customer name, email and cart items are required', 400);
  }
  const itemTotals = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity || 1);
    itemTotals.set(productId, (itemTotals.get(productId) || 0) + quantity);
  }
  const normalized = [...itemTotals].map(([productId, quantity]) => ({ productId, quantity }));
  if (normalized.some((item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new AppError('Every cart item needs a valid productId and positive integer quantity', 400);
  }
  return { customer, items: normalized };
}

export async function createOrder(input) {
  const { customer, items } = validateRequest(input);
  return withTransaction(async (client) => {
    const products = await repository.lockProducts(client, [...new Set(items.map((item) => item.productId))]);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const resolvedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError('One or more products no longer exist', 400);
      if (product.stock < item.quantity) throw new AppError(`Not enough stock for ${product.name}`, 409);
      return { ...product, quantity: item.quantity };
    });
    const total = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await repository.insertOrder(client, {
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      total,
    });
    for (const item of resolvedItems) {
      await repository.insertOrderItem(client, order.id, item);
      await repository.decrementStock(client, item.id, item.quantity);
    }
    return order;
  });
}
