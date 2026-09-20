import { Prisma } from '@prisma/client';
import { db } from '../../config/database.js';
import type { RecordEventDto } from './event.dto.js';

export async function insertEvent({ sessionId, eventType, productId, metadata }: RecordEventDto): Promise<void> {
  await db.userEvent.create({
    data: { sessionId, eventType, productId, metadata: metadata as Prisma.InputJsonValue },
  });
}
