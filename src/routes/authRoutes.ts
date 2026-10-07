import { Router } from 'express';
import { register, login } from '../controllers/authController';

export function authRoutes(jwtSecret: string) {
  const router = Router();
  router.post('/register', register);
  router.post('/login', login(jwtSecret));
  return router;
}
