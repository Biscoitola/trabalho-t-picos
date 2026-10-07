import 'dotenv/config';
import { z } from 'zod';

export function readConfig() {
  return z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  }).parse(process.env);
}
