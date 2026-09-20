import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const db = new PrismaClient({ datasourceUrl: env.databaseUrl });

export async function withTransaction(work) {
  return db.$transaction(work, { isolationLevel: 'Serializable' });
}
