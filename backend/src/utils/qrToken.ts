import jwt from 'jsonwebtoken';

const QR_SECRET = process.env.QR_SECRET || 'dev-qr-secret';

export type QrPurpose = 'attendance';

export interface QrClaims {
  purpose: QrPurpose;
  shopName:string;
  shopId: number;
  /** 버전 등 추후 확장 */
  v?: number;
    loginUrl?: string;
}

/** QR 토큰 생성 (기본: 영구토큰 / expSeconds 주면 만료 부여) */
export function signQrToken(
  shopId: number,
  shopName:string,
  purpose: QrPurpose = 'attendance',
  loginUrl?: string,
): string {
  const claims: QrClaims = { purpose,shopName, shopId, v: 1 };
  if (loginUrl) claims.loginUrl = loginUrl;

  const options: jwt.SignOptions = {};

  return jwt.sign(claims, QR_SECRET, options);
}

/** QR 토큰 검증 (유효성/서명/만료 체크) */
export function verifyQrToken(token: string): QrClaims {
  return jwt.verify(token, QR_SECRET) as QrClaims;
}
