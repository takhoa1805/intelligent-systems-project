import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const db = new Pool({ connectionString: env.databaseUrl });

db.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export function query(text, params = []) {
  return db.query(text, params);
}

export async function withTransaction(work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
