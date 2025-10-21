// src/utils/jwt.ts
import jwt, { SignOptions } from 'jsonwebtoken';

const B64 = process.env.SPRING_JWT_SECRET_B64 || process.env.APP_JWT_SECRET_BASE64 || '';
const ISS = process.env.SPRING_JWT_ISSUER || '';
const KEY = B64 ? Buffer.from(B64, 'base64') : undefined;

export function signToken(payload: object, opts: SignOptions = {}) {
  if (!KEY) throw new Error('SPRING_JWT_SECRET_B64 is not set');
  return jwt.sign(payload as any, KEY, {
    algorithm: 'HS256',
    ...(ISS ? { issuer: ISS } : {}),
    ...opts,
  });
}
export function verifyToken(token: string) {
  if (!KEY) throw new Error('SPRING_JWT_SECRET_B64 is not set');
  return jwt.verify(token, KEY, {
    algorithms: ['HS256'],
    ...(ISS ? { issuer: ISS } : {}),
  });
}



/** ============== Spring 호환 전용 헬퍼 ============== */
const ACCESS_TTL_SEC = Number(process.env.APP_JWT_ACCESS_TTL_SECONDS ?? 3600);       // 1h
const REFRESH_TTL_SEC = Number(process.env.APP_JWT_REFRESH_TTL_SECONDS ?? 1209600);  // 14d
if (!KEY) {
  // 서버 시작 시 한번만 경고
  // eslint-disable-next-line no-console
  console.warn('[jwt] SPRING_JWT_SECRET_B64 is empty; signing/verifying will fail.');
}

// -------- 관리자용(Admin) : 스프링은 typ을 설정함 --------
export function signAdminAccessToken(args: {
  userId: number;
  loginId: string;
  shopId?: number | null;
  shopRole?: string | null; // 'admin'
}) {
  const { userId, loginId, shopId, shopRole } = args;
  return signToken(
    {
      userId,
      loginId,
      role: 'ADMIN',                // Spring: Role.ADMIN
      ...(shopId != null ? { shopId } : {}),
      ...(shopRole ? { shopRole } : {}),
      typ: 'access',                // Spring admin 토큰에 존재
    },
    {
      algorithm: 'HS256',
      ...(ISS ? { issuer: ISS } : {}),
      subject: String(userId),     // sub = userId
      expiresIn: `${ACCESS_TTL_SEC}s`,
    }
  );
}

export function signAdminRefreshToken(args: {
  userId: number;
  loginId: string;
  shopId?: number | null;
  shopRole?: string | null;
}) {
  const { userId, loginId, shopId, shopRole } = args;
  return signToken(
    {
      userId,
      loginId,
      role: 'ADMIN',
      ...(shopId != null ? { shopId } : {}),
      ...(shopRole ? { shopRole } : {}),
      typ: 'refresh',               // Spring admin 토큰에 존재
    },
    {
      algorithm: 'HS256',
      ...(ISS ? { issuer: ISS } : {}),
      subject: String(userId),
      expiresIn: `${REFRESH_TTL_SEC}s`,
    }
  );
}

// -------- 직원용(Employee) : 스프링은 typ을 넣지 않음 --------
export function signEmployeeAccessToken(args: {
  empId: number;
  shopId: number;
  empName: string;
  shopRole?: string | null; // e.g. 'employee'
}) {
  const { empId, shopId, empName, shopRole } = args;
  return signToken(
    {
      role: 'EMPLOYEE',            // Spring: Role.EMPLOYEE
      shopId,
      empName,
      userId: empId,               // Spring이 employee에도 userId=employeeId 넣음
      ...(shopRole ? { shopRole } : {}),
      // typ 미포함(스프링 직원 토큰과 동일)
    },
    {
      algorithm: 'HS256',
      ...(ISS ? { issuer: ISS } : {}),
      subject: String(empId),      // sub = employeeId
      expiresIn: `${ACCESS_TTL_SEC}s`,
    }
  );
}

export function signEmployeeRefreshToken(args: {
  empId: number;
  shopId: number;
  empName: string;
  shopRole?: string | null;
}) {
  const { empId, shopId, empName, shopRole } = args;
  return signToken(
    {
      role: 'EMPLOYEE',
      shopId,
      empName,
      userId: empId,
      ...(shopRole ? { shopRole } : {}),
      // typ 미포함(스프링 직원 토큰과 동일)
    },
    {
      algorithm: 'HS256',
      ...(ISS ? { issuer: ISS } : {}),
      subject: String(empId),
      expiresIn: `${REFRESH_TTL_SEC}s`,
    }
  );
}

/** 검증 헬퍼 (typ은 존재할 때만 엄격 체크) */
export function verifyAccessToken<T = any>(token: string): T {
  const d = verifyToken(token) as any;
  if (typeof d.typ !== 'undefined' && d.typ !== 'access') {
    throw new Error('Invalid token type');
  }
  return d as T;
}
export function verifyRefreshToken<T = any>(token: string): T {
  const d = verifyToken(token) as any;
  if (typeof d.typ !== 'undefined' && d.typ !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return d as T;
}