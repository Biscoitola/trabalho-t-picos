import mongoose from 'mongoose';
import { createApp } from './app';
import { readConfig } from './config';
import { User, Game } from './models';

async function main() {
  const config = readConfig();
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User.init(), Game.init()]);
  const server = createApp({ jwtSecret: config.JWT_SECRET, corsOrigin: config.CORS_ORIGIN })
    .listen(config.PORT, () => console.log('API: http://localhost:' + config.PORT + ' | Swagger: /api-docs'));
  server.on('error', error => { console.error(error); void mongoose.disconnect(); process.exitCode = 1; });
  const shutdown = () => {
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(() => {
      void mongoose.disconnect().then(() => { clearTimeout(timer); process.exit(0); });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
main().catch(error => { console.error('Falha ao iniciar:', error); process.exit(1); });
