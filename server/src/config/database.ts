import { Prisma, PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const db = new PrismaClient({ datasourceUrl: env.databaseUrl });

export async function withTransaction<T>(
  work: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(work, { isolationLevel: 'Serializable' });
}
