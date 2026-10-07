import express, { ErrorRequestHandler, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { authenticate } from './auth';
import { User, Game } from './models';
import { registerInput, loginInput, gameInput, updateInput, listInput } from './validation';
import { openapi } from './openapi';

export function createApp(options: { jwtSecret: string; corsOrigin?: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
  });
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ message: 'Muitas tentativas. Tente novamente mais tarde.' }); } });
  app.use('/api/auth', authLimiter);
  app.post('/api/auth/register', async (req, res) => {
    const input = registerInput.parse(req.body);
    const user = await User.create({ ...input, password: await bcrypt.hash(input.password, 12) });
    res.status(201).json({ id: user.id, name: user.name, email: user.email });
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = loginInput.parse(req.body);
    const user = await User.findOne({ email: input.email }).select('+password');
    if (!user || !await bcrypt.compare(input.password, user.password)) {
      res.status(401).json({ message: 'E-mail ou senha inválidos' }); return;
    }
    const token = jwt.sign({}, options.jwtSecret, {
      subject: user.id, expiresIn: '1h', algorithm: 'HS256', issuer: 'respawn-api', audience: 'respawn-client',
    });
    res.json({ token, tokenType: 'Bearer', expiresIn: 3600 });
  });
  app.use('/api/games', authenticate(options.jwtSecret));
  const validId: RequestHandler = (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      res.status(400).json({ message: 'Identificador inválido' }); return;
    }
    next();
  };
  app.post('/api/games', async (req, res) => {
    const game = await Game.create({ ...gameInput.parse(req.body), owner: req.userId });
    res.status(201).json(game);
  });
  app.get('/api/games', async (req, res) => {
    const { page, limit, status } = listInput.parse(req.query);
    const filter = { owner: req.userId, ...(status ? { status } : {}) };
    const [data, total] = await Promise.all([
      Game.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Game.countDocuments(filter),
    ]);
    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  });
  app.get('/api/games/:id', validId, async (req, res) => {
    const game = await Game.findOne({ _id: req.params.id, owner: req.userId });
    if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
    res.json(game);
  });
  app.patch('/api/games/:id', validId, async (req, res) => {
    const input = updateInput.parse(req.body);
    const game = await Game.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { $set: input }, { new: true, runValidators: true });
    if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
    res.json(game);
  });
  app.delete('/api/games/:id', validId, async (req, res) => {
    const game = await Game.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
    res.status(204).send();
  });
  app.use((_req, res) => { res.status(404).json({ message: 'Rota não encontrada' }); });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Dados inválidos', errors: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) }); return;
    }
    if (error?.code === 11000) { res.status(409).json({ message: 'E-mail já cadastrado' }); return; }
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      res.status(400).json({ message: 'Dados inválidos' }); return;
    }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ message: 'JSON inválido' }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ message: 'Corpo da requisição muito grande' }); return; }
    console.error('Erro interno:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  };
  app.use(errorHandler);
  return app;
}
