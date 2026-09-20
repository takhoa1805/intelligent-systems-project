import { createOrder } from './order.service.js';
import type { Request, Response } from 'express';
import type { OrderConfirmationDto } from './order.dto.js';

export async function create(req: Request, res: Response<OrderConfirmationDto>): Promise<void> {
  res.status(201).json(await createOrder(req.body));
}
