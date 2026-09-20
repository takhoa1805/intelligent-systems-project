import 'dotenv/config';

export interface EnvironmentConfig {
  port: number;
  clientUrl: string;
  databaseUrl: string;
}

export const env: Readonly<EnvironmentConfig> = Object.freeze({
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/signal_shop',
});
