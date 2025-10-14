import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

/** 앱 전역에서 쓰는 롤 타입 */
export type UserRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE';

/** JWT 페이로드 스키마 */
export interface JwtPayload {
  userId: number;
  shopId: number;
  shopRole: UserRole;
  iat?: number;
  exp?: number;
}

/** req.user 타입 보강 */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/** 관리자 권한 상수 세트 (includes에 안전하게 사용) */
export const ADMIN_ROLES: ReadonlyArray<UserRole> = ['ADMIN', 'OWNER'];

/** 필수 인증 미들웨어 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/** (옵션) 인증이 있으면 붙이고, 없어도 통과시키는 미들웨어 — QR 스캔 엔드포인트 등에 사용 */
export const optionalAuthenticateJWT = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch {
    // 토큰이 있더라도 유효하지 않으면 user는 비워둠
  }
  next();
};
