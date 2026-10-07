import { z } from 'zod';

export const registerInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Senha deve ter no máximo 72 bytes'),
}).strict();
export const loginInput = registerInput.pick({ email: true, password: true });
export const gameInput = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().max(2000).optional(),
  status: z.enum(['backlog', 'playing', 'completed', 'paused', 'dropped']).optional(),
  platform: z.enum(['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'Outro']),
  rating: z.number().min(0).max(10).nullable().optional(),
}).strict();
export const updateInput = gameInput.partial().refine(value => Object.keys(value).length > 0, 'Informe pelo menos um campo');
export const listInput = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['backlog', 'playing', 'completed', 'paused', 'dropped']).optional(),
}).strict();
