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

/* ✅ Caddy(프록시) 뒤에 있으므로 반드시 설정 */
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '172.16.0.0/12']);
// 단일 프록시면 app.set('trust proxy', true) 도 가능


app.use(helmet());

// (권장) 허용 오리진만 화이트리스트
const ORIGINS = [
  'https://mydreamday.shop',
  'https://www.mydreamday.shop',
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // 서버-서버/헬스체크 허용
      if (ORIGINS.includes(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
      return cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ✅ rate-limit: trust proxy 켠 상태에서 사용 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    // keyGenerator: (req) => req.ip, // 기본값도 req.ip라 생략 가능
  })
);

/* 라우트 */
app.use('/api', routes);

/* Swagger UI at /api/docs */
app.use('/api/docs', swaggerServe, swaggerSetup);

/* 404 & 에러 핸들러 */
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
let server: import('http').Server | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(3001, '0.0.0.0', () => {       // 컨테이너 내에서 외부 노출
    console.log(`🚀 Server is running on port ${PORT}`);
  });
  try {
    registerSchedulers();
  } catch (e) {
    console.error('Failed to register schedulers', e);
  }
}

const shutdown = async () => {
  try {
    await prisma.$disconnect();
    server?.close(() => process.exit(0));
  } catch {
    process.exit(1);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
