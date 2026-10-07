import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './models';

declare global {
  namespace Express { interface Request { userId?: string } }
}
export const authenticate = (secret: string): RequestHandler => async (req, res, next) => {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/);
  if (!match) { res.status(401).json({ message: 'Token ausente ou inválido' }); return; }
  let userId: string;
  try {
    const payload = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer: 'respawn-api', audience: 'respawn-client' });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.sub)) {
      throw new Error('Invalid subject');
    }
    userId = payload.sub;
  } catch {
    res.status(401).json({ message: 'Token ausente, inválido ou expirado' }); return;
  }
  try {
    if (!await User.exists({ _id: userId })) { res.status(401).json({ message: 'Usuário não encontrado' }); return; }
    req.userId = userId;
    next();
  } catch (error) { next(error); }
};
