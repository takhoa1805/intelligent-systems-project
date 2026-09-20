import { db } from '../../config/database.js';

export async function insertEvent({ sessionId, eventType, productId, metadata }) {
  await db.userEvent.create({
    data: { sessionId, eventType, productId, metadata },
  });
}
