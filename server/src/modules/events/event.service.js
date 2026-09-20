import { AppError } from '../../shared/AppError.js';
import { insertEvent } from './event.repository.js';

const allowedEvents = new Set(['product_view', 'search', 'add_to_cart', 'recommendation_click']);

export async function recordEvent(input) {
  if (!input.sessionId || !allowedEvents.has(input.eventType)) {
    throw new AppError('A sessionId and valid eventType are required', 400);
  }
  await insertEvent({
    sessionId: String(input.sessionId),
    eventType: input.eventType,
    productId: input.productId ? Number(input.productId) : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  });
  return { recorded: true };
}
