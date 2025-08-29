import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { signQrToken, verifyQrToken } from '../utils/qrToken';
import { AuthRequest, UserRole } from '../middlewares/jwtMiddleware';

/** 프런트 기본 URL은 mydreamday.shop, 없으면 .env 로 대체 */
const FRONTEND = process.env.FRONTEND_BASE_URL || 'https://mydreamday.shop';
const API_BASE = process.env.API_BASE_URL || ''; // 필요 시 후순위 fallback

/** 관리자/점주만 QR PNG 발급 (출력해서 매장 비치) */
export const getShopQrPng = async (req: AuthRequest, res: Response) => {
  const role: UserRole | undefined = req.user?.role;
  if (!role || (role !== 'admin' && role !== 'owner')) {
    res.status(403).json({ error: '관리자/점주 전용' });
    return;
  }

  const shopId = Number(req.params.shopId);
  if (!Number.isFinite(shopId)) {
    res.status(400).json({ error: 'invalid shopId' });
    return;
  }

  // 영구 또는 TTL 설정 가능(?ttl=초)
  const ttl = req.query.ttl ? Number(req.query.ttl) : undefined;
  const token = signQrToken(shopId, 'attendance', ttl);

  // 스캔시 열릴 URL (프런트 경로로 고정)
  const base = (FRONTEND || API_BASE).replace(/\/$/, '');
  const url  = `${base}/qr/scan?token=${encodeURIComponent(token)}`;

  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
};

/**
 * QR 스캔 진입점
 * - 미로그인: 401 + loginUrl (공용 로그인 페이지로, shopId 파라미터 없이 redirect만 부여)
 * - 로그인: 200 + { ok: true, shopId, qrToken }
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
  } catch {
    res.status(400).json({ error: 'invalid_or_expired_token' });
    return;
  }

  if (claims.purpose !== 'attendance' || !Number.isFinite(claims.shopId)) {
    res.status(400).json({ error: 'invalid_claims' });
    return;
  }

  // 미로그인 → 공용 로그인 페이지로. shopId는 안 넘기고 redirect만 전달
  if (!req.user) {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = `${base}/login`;
    res.status(401).json({ needLogin: true, loginUrl, shopId: claims.shopId });
    return;
  }

  // 로그인 사용자인데 소속 매장이 다르면 차단(정책 유지)
  if (req.user.shopId !== claims.shopId) {
    res.status(403).json({ error: 'shop_mismatch', expected: claims.shopId, actual: req.user.shopId });
    return;
  }

  res.json({
    ok: true,
    shopId: claims.shopId,
    qrToken: token, // 프론트가 그대로 /api/attendance 호출 시 첨부할 수 있음(선택)
  });
};
