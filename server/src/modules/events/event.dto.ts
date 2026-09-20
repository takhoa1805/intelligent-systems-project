import { z } from 'zod';
import { parseDto } from '../../shared/dto/validation.js';

export const eventTypes = ['product_view', 'search', 'add_to_cart', 'recommendation_click'] as const;
export type EventType = typeof eventTypes[number];

export interface RecordEventDto {
  sessionId: string;
  eventType: EventType;
  productId: number | null;
  metadata: Record<string, unknown>;
}

export interface EventRecordedDto {
  recorded: true;
}

const recordEventSchema = z.object({
  sessionId: z.string().trim().min(1).max(100),
  eventType: z.enum(eventTypes),
  productId: z.coerce.number().int().positive().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function parseRecordEventDto(input: unknown): RecordEventDto {
  const parsed = parseDto(recordEventSchema, input);
  return {
    sessionId: parsed.sessionId,
    eventType: parsed.eventType,
    productId: parsed.productId ?? null,
    metadata: parsed.metadata ?? {},
  };
}
