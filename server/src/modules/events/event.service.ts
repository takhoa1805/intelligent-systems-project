import { insertEvent } from './event.repository.js';
import { parseRecordEventDto, type EventRecordedDto } from './event.dto.js';

export async function recordEvent(input: unknown): Promise<EventRecordedDto> {
  await insertEvent(parseRecordEventDto(input));
  return { recorded: true };
}
