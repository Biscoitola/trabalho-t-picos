import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { openapi } from './openapi';
import { authRoutes } from './routes/authRoutes';
import { gameRoutes } from './routes/gameRoutes';

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
  app.use('/api/auth', authLimiter, authRoutes(options.jwtSecret));
  app.use('/api/games', gameRoutes(options.jwtSecret));
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

