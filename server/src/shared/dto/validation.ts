import { type ZodType } from 'zod';
import { AppError } from '../AppError.js';

export function parseDto<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const message = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
    .join('; ');
  throw new AppError(message, 400);
}
