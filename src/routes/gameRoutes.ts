import { Router, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../auth';
import { createGame, listGames, getGame, updateGame, deleteGame } from '../controllers/gameController';

const validId: RequestHandler = (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ message: 'Identificador inválido' }); return;
  }
  next();
};

export function gameRoutes(jwtSecret: string) {
  const router = Router();
  router.use(authenticate(jwtSecret));
  router.post('/', createGame);
  router.get('/', listGames);
  router.get('/:id', validId, getGame);
  router.patch('/:id', validId, updateGame);
  router.delete('/:id', validId, deleteGame);
  return router;
}
