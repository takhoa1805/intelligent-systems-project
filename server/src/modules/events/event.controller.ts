import { recordEvent } from './event.service.js';
import type { Request, Response } from 'express';
import type { EventRecordedDto } from './event.dto.js';

export async function create(req: Request, res: Response<EventRecordedDto>): Promise<void> {
  res.status(201).json(await recordEvent(req.body));
}
