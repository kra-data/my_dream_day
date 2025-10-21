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
