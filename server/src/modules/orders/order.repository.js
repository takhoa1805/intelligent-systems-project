export async function lockProducts(client, productIds) {
  const { rows } = await client.query(
    `SELECT id, name, price::float, stock
     FROM products WHERE id = ANY($1::int[]) AND active = true FOR UPDATE`,
    [productIds],
  );
  return rows;
}

export async function insertOrder(client, { customerName, customerEmail, total }) {
  const { rows } = await client.query(
    `INSERT INTO orders (customer_name, customer_email, subtotal, total, status)
     VALUES ($1, $2, $3, $3, 'paid')
     RETURNING id, order_number, total::float, created_at`,
    [customerName, customerEmail, total],
  );
  return rows[0];
}

export async function insertOrderItem(client, orderId, item) {
  await client.query(
    `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, item.id, item.name, item.quantity, item.price],
  );
}

export async function decrementStock(client, productId, quantity) {
  await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [quantity, productId]);
}
