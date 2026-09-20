export async function findProducts(client, productIds) {
  return client.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
}

export async function insertOrder(client, { customerName, customerEmail, total }) {
  return client.order.create({
    data: { customerName, customerEmail, subtotal: total, total, status: 'paid' },
  });
}

export async function insertOrderItem(client, orderId, item) {
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

export async function decrementStock(client, productId, quantity) {
  const result = await client.product.updateMany({
    where: { id: productId, active: true, stock: { gte: quantity } },
    data: { stock: { decrement: quantity }, updatedAt: new Date() },
  });
  return result.count === 1;
}
