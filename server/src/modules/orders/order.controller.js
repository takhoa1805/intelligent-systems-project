import { createOrder } from './order.service.js';

export async function create(req, res) {
  res.status(201).json(await createOrder(req.body));
}
