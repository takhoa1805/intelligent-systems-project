import { query } from '../../config/database.js';

export async function insertEvent({ sessionId, eventType, productId, metadata }) {
  await query(
    `INSERT INTO user_events (session_id, event_type, product_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, eventType, productId, metadata],
  );
}
