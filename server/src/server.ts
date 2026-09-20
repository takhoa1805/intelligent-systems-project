import { app } from './app.js';
import { db } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`Signal Shop API running at http://localhost:${env.port}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`${signal} received. Shutting down gracefully.`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
