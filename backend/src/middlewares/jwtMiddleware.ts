import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/** 앱 전역 롤 타입 (소문자 통일) */
export type UserRole = 'admin' | 'owner' | 'employee' | string;

/** Express가 쓰는 정규화된 페이로드 */
export interface JwtPayload {
  // 관리자 토큰일 때
  userId?: number;
  loginId?: string;
  // 직원 토큰일 때
  empId?: number;
  empName?: string;
  // 공통
  role: 'admin' | 'employee';
  shopId?: number;
  shopRole?: UserRole;
  // 표준 클레임
  sub?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  typ?: 'access' | 'refresh';
}

/** req.user 타입 보강 */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/** Spring 호환 환경 */
const SPRING_B64 = process.env.SPRING_JWT_SECRET_B64 || process.env.APP_JWT_SECRET_BASE64 || '';
const SPRING_ISS = process.env.SPRING_JWT_ISSUER; // 없으면 issuer 검증 생략
const SPRING_KEY = SPRING_B64 ? Buffer.from(SPRING_B64, 'base64') : null;

/** 레거시(Express 자체 발급) 폴백 키 */
const LEGACY_SECRET = process.env.JWT_SECRET || 'defaultsecret';

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return undefined;
};

function tryVerifySpring(token: string): JwtPayload | null {
  if (!SPRING_KEY) return null;
  try {
    const decoded = jwt.verify(token, SPRING_KEY, {
      algorithms: ['HS256'],
      ...(SPRING_ISS ? { issuer: SPRING_ISS } : {}),
    }) as any;

    const roleRaw = String(decoded.role ?? '').toLowerCase();
    const isEmployee = roleRaw === 'employee';
    const payload: JwtPayload = {
      // 표준
      sub: decoded.sub,
      iss: decoded.iss,
      iat: decoded.iat,
      exp: decoded.exp,
      typ: decoded.typ,
      // 공통
      role: isEmployee ? 'employee' : 'admin',
      shopId: num(decoded.shopId),
      shopRole: decoded.shopRole ? String(decoded.shopRole).toLowerCase() : (isEmployee ? 'employee' : 'admin'),
      // 관리자/직원별
      loginId: decoded.loginId,
      empName: decoded.empName,
    };

    if (isEmployee) {
      payload.empId = num(decoded.empId) ?? num(decoded.sub);
    } else {
      payload.userId = num(decoded.userId) ?? num(decoded.sub);
    }
    return payload;
  } catch {
    return null;
  }
}

function tryVerifyLegacy(token: string): JwtPayload | null {
  try {
    const d = jwt.verify(token, LEGACY_SECRET) as any;
    const sr = d.shopRole ? String(d.shopRole).toLowerCase() : undefined;
    const isEmployee = sr === 'employee';
    const payload: JwtPayload = {
      role: isEmployee ? 'employee' : 'admin',
      shopId: num(d.shopId),
      shopRole: sr,
      loginId: d.loginId,
      iat: d.iat,
      exp: d.exp,
    };
    if (isEmployee) payload.empId = num(d.userId);
    else payload.userId = num(d.userId);
    return payload;
  } catch {
    return null;
  }
}

/** 필수 인증 미들웨어 (Spring 우선, 실패 시 Legacy 폴백) */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.slice(7).trim();

  const decoded = tryVerifySpring(token) ?? tryVerifyLegacy(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  // 정규화
  if (decoded.shopRole) decoded.shopRole = String(decoded.shopRole).toLowerCase();
  req.user = decoded;
  next();
};

/** (옵션) 인증이 있으면 파싱만 시도 */
export const optionalAuthenticateJWT = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const token = authHeader.slice(7).trim();
  const decoded = tryVerifySpring(token) ?? tryVerifyLegacy(token);
  if (decoded) {
    if (decoded.shopRole) decoded.shopRole = String(decoded.shopRole).toLowerCase();
    req.user = decoded;
  }
  next();
};

/** (참고) 관리자 권한 체크에서 쓸 수 있는 상수 */
export const admin_ROLES: ReadonlyArray<UserRole> = ['admin', 'owner'];