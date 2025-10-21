// middlewares/attachUserIfPresent.ts
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './jwtMiddleware';

const ACCESS_SECRET = process.env.JWT_SECRET!; // 실제 환경변수 사용
/**
 * Spring 호환 키/issuer
 * - SPRING_JWT_SECRET_B64: Spring app.jwt.secret(Base64)와 동일 값
 * - SPRING_JWT_ISSUER    : Spring app.jwt.issuer 와 동일 값(예: attendance-app)
 */
const SPRING_B64 = process.env.SPRING_JWT_SECRET_B64 || process.env.APP_JWT_SECRET_BASE64 || '';
const SPRING_ISS = process.env.SPRING_JWT_ISSUER;
const SPRING_KEY = SPRING_B64 ? Buffer.from(SPRING_B64, 'base64') : null;

/** 레거시(Express 자체 발급) 폴백 키 */
const LEGACY_SECRET = process.env.JWT_SECRET || '';

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return undefined;
};

function tryVerifySpring(token: string): any | null {
  if (!SPRING_KEY) return null;
  try {
    const decoded = jwt.verify(token, SPRING_KEY, {
      algorithms: ['HS256'],
      ...(SPRING_ISS ? { issuer: SPRING_ISS } : {}),
    }) as any;
    return decoded;
  } catch {
    return null;
  }
}

function tryVerifyLegacy(token: string): any | null {
  if (!LEGACY_SECRET) return null;
  try {
    return jwt.verify(token, LEGACY_SECRET) as any;
  } catch {
    return null;
  }
}

/**
 * Spring/Legacy 클레임을 Express 표준 형태로 정규화
 * - 관리자: role=admin, userId, shopId?, shopRole?
 * - 직원  : role=employee, empId, empName?, shopId, shopRole=employee
 * 기존 코드와의 호환을 위해 userId/shopId/shopRole은 유지하면서,
 * 가능하면 role/empId/empName도 함께 채워 넣음.
 */
function normalizePayload(raw: any) {
  const roleRaw = String(raw?.role ?? '').toLowerCase();
  const isEmployee = roleRaw === 'employee';

  // Spring: userId | empId | sub
  const subNum = toNum(raw?.sub);
  const userId = toNum(raw?.userId) ?? (isEmployee ? undefined : subNum);
  const empId  = toNum(raw?.empId)  ?? (isEmployee ? subNum : undefined);

  // 공통
  const shopId   = toNum(raw?.shopId);
  let shopRole   = raw?.shopRole ? String(raw.shopRole).toLowerCase() : undefined;
  const loginId  = raw?.loginId;
  const empName  = raw?.empName;
  const role     = isEmployee ? 'employee' : 'admin';

  // 직원 토큰이면 shopRole을 employee로 고정
  if (isEmployee) shopRole = 'employee';

  return {
    // 기존 Express가 기대하던 필수 3종
    userId,          // 관리자면 숫자, 직원이면 undefined
    shopId,          // 숫자 | undefined
    shopRole,        // 'admin' | 'owner' | 'employee' | undefined
    // 확장 필드(있으면 사용)
    role,            // 'admin' | 'employee'
    empId,           // 직원이면 숫자
    empName,         // 직원이면 문자열일 수 있음
    loginId,         // 관리자면 있을 수 있음
    // 표준 클레임도 보존(필요 시 참조)
    sub: raw?.sub,
    iss: raw?.iss,
    iat: raw?.iat,
    exp: raw?.exp,
    typ: raw?.typ,   // 'access' | 'refresh'
  };
}
export const attachUserIfPresent: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization || req.headers.Authorization as string | undefined;
  if (!h?.startsWith('Bearer ')) return next();

  const token = h.slice('Bearer '.length);
  // 1) Spring 우선 검증 → 2) Legacy 폴백
  const decoded = tryVerifySpring(token) ?? tryVerifyLegacy(token);
  if (decoded) {
    (req as AuthRequest).user = normalizePayload(decoded) as any;
  }
  next();
};
