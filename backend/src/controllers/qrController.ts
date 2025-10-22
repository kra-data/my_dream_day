import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { signQrToken, verifyQrToken } from '../utils/qrToken';
import { AuthRequest, UserRole } from '../middlewares/jwtMiddleware';
import { prisma } from '../db/prisma'; // ✅ 추가

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
    // 상호명 조회
  const shop = await prisma.shop.findUnique({
    where: { id: BigInt(shopId) },
    select: { name: true },
  });
  if (!shop) {
    res.status(404).json({ error: 'shop not found' });
    return;
  }
  const shopName = shop.name;
  // 스캔시 열릴 URL (프런트 경로로 고정)
  const base = (FRONTEND || API_BASE).replace(/\/$/, '');

  const loginUrl = `${base}/employee/qr/login`;
  // 영구 또는 TTL 설정 가능(?ttl=초)
  const token = signQrToken(
     shopId,
     shopName,
     'attendance',
    loginUrl
  );
  const url = `${base}/qr/scan?token=${encodeURIComponent(token)}`;

  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
};

/**
 * QR 스캔 진입점
 * - 미로그인: 401 + loginUrl (공용 로그인 페이지로, shopId 파라미터 없이 redirect만 부여)
 * - 로그인: 200 + { ok: true, shopId, qrToken, mode, (clock_out이면 shiftId) }
 */
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
    res
      .status(401)
      .json({
        purpose: 'login',
        needLogin: true,
        loginUrl,
        shopId: null,
        error: 'invalid_or_expired_token',
      });
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
    // (선택) 로그인 후 돌아오도록 next 파라미터 추가 가능 (현재는 그대로 유지)
    const next = encodeURIComponent(`${base}/qr/scan?token=${encodeURIComponent(token)}`);
    const loginWithNext = `${loginUrl}`;

    res
      .status(401)
      .json({
        purpose: 'login',
        needLogin: true,
        loginUrl: loginWithNext,
        nextAttendance: true,
        shopId: claims.shopId,
      });
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
      loginUrl,
    });
    return;
  }

  // ▼▼▼ 여기서부터: 기존 포맷 유지 + mode/shiftId만 추가 ▼▼▼
  let mode: 'clock_in' | 'clock_out' = 'clock_in';
  let shiftId: number | undefined;

  // employeeId 해소
  const employeeId = await resolveEmployeeId(req, claims.shopId);
  if (employeeId) {
    // 오늘 00:00 기준 (서버 타임존 기준; KST 고정이 필요하면 tz 라이브러리 사용 권장)
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // 오늘 IN 있고 OUT 없는 시프트가 있으면 → 퇴근
    const cur = await prisma.workShift.findFirst({
      where: {
        employeeId: employeeId, // BigInt
        actualInAt: { not: null, gte: startOfToday },
        actualOutAt: null,
      },
      orderBy: { actualInAt: 'desc' },
      select: { id: true },
    });

    if (cur) {
      mode = 'clock_out';
      shiftId = Number(cur.id);
    }
  }

  // ✅ 정상: 출퇴근 플로우로 (기존 응답 + mode, clock_out이면 shiftId)
  res.json({
    ok: true,
    purpose: 'attendance',
    shopId: claims.shopId,
    qrToken: token,
    mode,
    ...(shiftId !== undefined ? { shiftId } : {}),
  });
};

/** employeeId 해소: JWT에 없으면 (userId, shopId)로 조회 */
async function resolveEmployeeId(req: AuthRequest, shopId: number): Promise<bigint | null> {
  const raw = (req.user as any)?.employeeId ?? null;
  if (raw != null) {
    try {
      return BigInt(raw);
    } catch {
      // ignore parse error
    }
  }
  const uid = (req.user as any)?.userId;
  if (uid == null) return null;

  const row = await prisma.employeeMember.findFirst({
    where: { shopId: BigInt(shopId), id: BigInt(uid) },
    select: { id: true },
  });
  return row?.id ?? null;
}
