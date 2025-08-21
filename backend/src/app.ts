import express from 'express';
import routes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { swaggerServe, swaggerSetup } from './swagger';
import { registerSchedulers } from './scheduler';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { prisma } from './db/prisma';
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limit (adjust as needed)
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use('/api', routes);
// Swagger UI at /api/docs
app.use('/api/docs', swaggerServe, swaggerSetup);

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
let server: import('http').Server | undefined;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
  // register cron jobs in non-test environments
  try {
    registerSchedulers();
  } catch (e) {
    console.error('Failed to register schedulers', e);
  }
}

// Graceful shutdown for Prisma and HTTP server
const shutdown = async () => {
  try {
    await prisma.$disconnect();
    server?.close(() => { process.exit(0); });
  } catch (e) {
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;