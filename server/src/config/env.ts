import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PLAYER_JWT_SECRET: process.env.PLAYER_JWT_SECRET!,
  PLAYER_JWT_EXPIRES_IN: process.env.PLAYER_JWT_EXPIRES_IN || '30d',
  CPF_SALT: process.env.CPF_SALT!,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_REGION: process.env.S3_REGION || 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET || 'company-assets',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',
};

const required = ['DATABASE_URL', 'JWT_SECRET', 'PLAYER_JWT_SECRET', 'CPF_SALT'] as const;
for (const key of required) {
  if (!env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
