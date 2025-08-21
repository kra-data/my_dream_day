import express from 'express';
import routes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { swaggerServe, swaggerSetup } from './swagger';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { prisma } from './db/prisma';
const app = express();
app.use(helmet());
// 프록시 뒤에서 HTTPS 인식
app.set('trust proxy', 1);

// ✅ 허용 오리진 화이트리스트
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'https://mydreamday.shop')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ✅ CORS 미들웨어 (동적 origin)
app.use(cors({
  origin: (origin, cb) => {
    // curl / 서버-서버 호출 등 'Origin' 헤더가 없는 요청 허용
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ✅ 프리플라이트(OPTIONS) 빠른 응답

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.options(['/api', '/api/*'], cors());


app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limit (adjust as needed)
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  skip: (req) => req.method === 'OPTIONS'
}));
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