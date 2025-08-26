import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { signQrToken, verifyQrToken } from '../utils/qrToken';
import { AuthRequest, UserRole } from '../middlewares/jwtMiddleware';

const FRONTEND = process.env.FRONTEND_BASE_URL;
const API_BASE = process.env.API_BASE_URL;

/** 관리자/점주만 QR PNG 발급 (출력해서 매장 비치) */
export const getShopQrPng = async (req: AuthRequest, res: Response) => {
  const role: UserRole | undefined = req.user?.role;
  if (!role || (role !== 'admin' && role !== 'owner')) {
    res.status(403).json({ error: '관리자/점주 전용' });
    return;
  }

  const shopIdParam = req.params.shopId;
  const shopId = Number(shopIdParam);
  if (!Number.isFinite(shopId)) {
    res.status(400).json({ error: 'invalid shopId' });
    return;
  }

  // 영구 토큰(만료 없음). 로테이션 원하면 ?ttl=300 같은 옵션을 route에 추가하세요.
  const ttl = req.query.ttl ? Number(req.query.ttl) : undefined; // 초 단위
  const token = signQrToken(shopId, 'attendance', ttl);

  // 스캔시 열릴 URL (프론트가 있으면 프론트 경로, 없으면 API 직접)
  const base = FRONTEND || API_BASE || '';
  const url  = `${base.replace(/\/$/, '')}/qr/scan?token=${encodeURIComponent(token)}`;

  // PNG 생성
  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
};

/**
 * QR 스캔 진입점
 * - 미로그인: 401 + loginUrl (로그인 후 redirect로 다시 이 URL로 복귀)
 * - 로그인: 200 + { ok: true, shopId }  (클라가 이 토큰을 들고 출근 버튼 → clock-in 호출)
 */
export const scanQr = async (req: AuthRequest, res: Response) => {
  const token = String(req.query.token || '');
  if (!token) {
    res.status(400).json({ error: 'token required' });
    return;
  }

  let claims;
  try {
    claims = verifyQrToken(token);
  } catch (e) {
    res.status(400).json({ error: 'invalid_or_expired_token' });
    return;
  }

  if (claims.purpose !== 'attendance' || !Number.isFinite(claims.shopId)) {
    res.status(400).json({ error: 'invalid_claims' });
    return;
  }

  // 미로그인 사용자 → 로그인 URL 제공
  if (!req.user) {
    const base = FRONTEND || API_BASE || '';
    const redirect = `${base.replace(/\/$/, '')}/qr/scan?token=${encodeURIComponent(token)}`;
    const loginUrl = `${base.replace(/\/$/, '')}/login?shopId=${claims.shopId}&redirect=${encodeURIComponent(redirect)}`;
    res.status(401).json({ needLogin: true, loginUrl, shopId: claims.shopId });
    return;
  }

  // 로그인 사용자인데, 소속 매장이 다르면 막기(원하면 제거)
  if (req.user.shopId !== claims.shopId) {
    res.status(403).json({ error: 'shop_mismatch', expected: claims.shopId, actual: req.user.shopId });
    return;
  }

  res.json({
    ok: true,
    shopId: claims.shopId,
    qrToken: token, // 클라가 그대로 clock-in 호출 시 첨부
  });
};
