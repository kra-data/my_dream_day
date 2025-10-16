import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { signQrToken, verifyQrToken } from '../utils/qrToken';
import { AuthRequest, UserRole } from '../middlewares/jwtMiddleware';

/** 프런트 기본 URL은 mydreamday.shop, 없으면 .env 로 대체 */
const FRONTEND = process.env.FRONTEND_BASE_URL || 'https://mydreamday.shop';
const API_BASE = process.env.API_BASE_URL || ''; // 필요 시 후순위 fallback

/** 관리자/점주만 QR PNG 발급 (출력해서 매장 비치) */
export const getShopQrPng = async (req: AuthRequest, res: Response) => {
  const shopRole: UserRole | undefined = req.user?.shopRole;
  if (!shopRole || (shopRole !== 'admin' && shopRole !== 'owner')) {
    res.status(403).json({ error: '관리자/점주 전용' });
    return;
  }

  const shopId = Number(req.params.shopId);
  if (!Number.isFinite(shopId)) {
    res.status(400).json({ error: 'invalid shopId' });
    return;
  }
    // 스캔시 열릴 URL (프런트 경로로 고정)
  const base = (FRONTEND || API_BASE).replace(/\/$/, '');


const loginUrl = `${base}/employee/qr/login`;
  // 영구 또는 TTL 설정 가능(?ttl=초)
  const token = signQrToken(shopId, 'attendance', loginUrl);
  const url  = `${base}/qr/scan?token=${encodeURIComponent(token)}`;

  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
};

/**
 * QR 스캔 진입점
 * - 미로그인: 401 + loginUrl (공용 로그인 페이지로, shopId 파라미터 없이 redirect만 부여)
 * - 로그인: 200 + { ok: true, shopId, qrToken }
 */
// controllers/qrController.ts (발췌)
export const scanQr = async (req: AuthRequest, res: Response) => {
  const token = String(req.query.token || '');

  // 토큰 없거나 형식 오류 → 로그인 유도
  if (!token) {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = `${base}/employee/qr/login`;
    res.status(401).json({ purpose: 'login', needLogin: true, loginUrl, shopId: null });
    return;
  }

  let claims;
  try {
    claims = verifyQrToken(token);
  } catch {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = `${base}/employee/qr/login`;
    res.status(401).json({ purpose: 'login', needLogin: true, loginUrl, shopId: null, error: 'invalid_or_expired_token' });
    return;
  }

  if (claims.purpose !== 'attendance' || !Number.isFinite(claims.shopId)) {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = `${base}/employee/qr/login`;
    res.status(400).json({ purpose: 'login', error: 'invalid_claims', loginUrl });
    return;
  }

  // 미로그인 → 로그인 유도 (클레임에 loginUrl 있으면 우선 사용)
  if (!req.user) {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const fallbackLogin = `${base}/employee/qr/login`;
    const loginUrl = claims.loginUrl || fallbackLogin;
    // (선택) 로그인 후 돌아오도록 next 파라미터 추가
    const next = encodeURIComponent(`${base}/qr/scan?token=${encodeURIComponent(token)}`);
    const loginWithNext = `${loginUrl}`;

    res
      .status(401)
      .json({ purpose: 'login', needLogin: true, loginUrl: loginWithNext,nextAttendance:true, shopId: claims.shopId });
    return;
  }

  // 로그인 사용자인데 소속 매장이 다르면 → 로그인(재선택) 유도
  if (req.user.shopId !== claims.shopId) {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = (claims as any).loginUrl || `${base}/employee/qr/login`;
    res.status(403).json({
      purpose: 'login',
      error: 'shop_mismatch',
      expected: claims.shopId,
      actual: req.user.shopId,
      loginUrl
    });
    return;
  }

  // ✅ 정상: 출퇴근 플로우로
  res.json({
    ok: true,
    purpose: 'attendance',
    shopId: claims.shopId,
    qrToken: token
  });
};
