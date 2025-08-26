import jwt from 'jsonwebtoken';

const QR_SECRET = process.env.QR_SECRET || 'dev-qr-secret';

export type QrPurpose = 'attendance';

export interface QrClaims {
  purpose: QrPurpose;
  shopId: number;
  /** 선택: 만료(UNIX sec). exp 없으면 영구 토큰 */
  exp?: number;
  /** 버전 등 추후 확장 */
  v?: number;
}

/** QR 토큰 생성 (기본: 영구토큰 / expSeconds 주면 만료 부여) */
export function signQrToken(shopId: number, purpose: QrPurpose = 'attendance', expSeconds?: number): string {
  const claims: QrClaims = { purpose, shopId, v: 1 };
  const options: jwt.SignOptions = {};
  if (expSeconds && expSeconds > 0) options.expiresIn = expSeconds;
  return jwt.sign(claims, QR_SECRET, options);
}

/** QR 토큰 검증 (유효성/서명/만료 체크) */
export function verifyQrToken(token: string): QrClaims {
  return jwt.verify(token, QR_SECRET) as QrClaims;
}
