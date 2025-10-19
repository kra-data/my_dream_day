// middlewares/attachUserIfPresent.ts
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './jwtMiddleware';

const ACCESS_SECRET = process.env.JWT_SECRET!; // 실제 환경변수 사용

export const attachUserIfPresent: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization || req.headers.Authorization as string | undefined;
  if (!h?.startsWith('Bearer ')) return next();

  const token = h.slice('Bearer '.length);
  try {
    const p = jwt.verify(token, ACCESS_SECRET) as any;
    (req as AuthRequest).user = {
      userId: p.userId,
      shopId: p.shopId,
      shopRole: p.shopRole,
    };
  } catch {
    // 토큰이 유효하지 않아도 로그인 유도 분기로 처리할 것이므로 그냥 next
  }
  next();
};
