// src/controllers/qrController.ts
import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { signQrToken, verifyQrToken } from '../utils/qrToken';
import { AuthRequest, UserRole } from '../middlewares/jwtMiddleware';
import { prisma } from '../db/prisma';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
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
  const token = signQrToken(shopId, shopName, 'attendance', loginUrl);
  const url = `${base}/qr/scan?token=${encodeURIComponent(token)}`;

  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
};

/** A4 포스터(PDF) 생성: 상호명/제목/안내문 + 큰 QR 포함 */
export const getShopQrPoster = async (req: AuthRequest, res: Response) => {
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

  // 스캔 URL 생성
  const base = (FRONTEND || API_BASE).replace(/\/$/, '');
  const loginUrl = `${base}/employee/qr/login`;
  const token = signQrToken(shopId, shopName, 'attendance', loginUrl);
  const url = `${base}/qr/scan?token=${encodeURIComponent(token)}`;

  // QR PNG 버퍼 (포스터에 삽입)
  const qrPng = await QRCode.toBuffer(url, {
    width: 800,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // A4 PDF 작성 (단위: pt / A4: 595 x 842pt)
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
  });
  res.setHeader('Content-Type', 'application/pdf');
  // res.setHeader('Content-Disposition', `inline; filename="qr_${shopId}.pdf"`);
  doc.pipe(res);

  // (선택) 한글 폰트 로드
  try {
    const fontPath = path.resolve(__dirname, '../../assets/fonts/PyeojinGothic-SemiBold.ttf');
    doc.font(fontPath);
  } catch {
    // 폰트 누락 시 기본 폰트 사용 (한글 깨질 수 있음)
  }

  // 페이지/여백 치수 미리 계산
  const pageWidth = doc.page.width;
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const availWidth = pageWidth - marginLeft - marginRight;

  // 상단 로고 (있으면 중앙 배치)
  try {
    const logoPath = path.resolve(__dirname, '../../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuf = fs.readFileSync(logoPath);
      const logoWidth = Math.min(160, availWidth); // 최대 160pt
      const logoX = marginLeft + (availWidth - logoWidth) / 2;
      const logoY = doc.y; // 현재 상단 여백 시작 위치
      doc.image(logoBuf, logoX, logoY, { width: logoWidth });
      doc.moveDown(10); // 로고 아래 약간의 간격
    }
  } catch {
    // 로고 없음/에러는 무시
  }

  // 상단 타이틀 (상호명)
  doc.fontSize(28).text(`${shopName}`, { align: 'center' }).moveDown(0.5);

  // 서브타이틀
  doc.fontSize(20).text('출퇴근 큐알코드', { align: 'center' }).moveDown(0.5);

  // 안내 문구
  doc.fontSize(14).text('찍어서 간편하게 출퇴근하세요!', { align: 'center' }).moveDown(1.5);


  const qrWidth = Math.min(380, availWidth);
  const qrX = marginLeft + (availWidth - qrWidth) / 2;
  const qrY = doc.y;
  doc.image(qrPng, qrX, qrY, { width: qrWidth });

  // 하단 추가 안내 (선택)
  doc.moveDown(24);
  doc.fontSize(10).fillColor('#666').text(`매장ID: ${shopId}`, { align: 'center' });

  doc.end();
};

/**
 * QR 스캔 진입점
 * - 미로그인: 401 + loginUrl (공용 로그인 페이지로, shopId 파라미터 없이 redirect만 부여)
 * - 로그인: 200 + { ok: true, shopId, shopName, qrToken, mode, (clock_out이면 shiftId) }
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

  let claims: any;
  try {
    claims = verifyQrToken(token);
  } catch {
    const base = (FRONTEND || API_BASE).replace(/\/$/, '');
    const loginUrl = `${base}/employee/qr/login`;
    res.status(401).json({
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
    const loginWithNext = `${loginUrl}`;
    res.status(401).json({
      purpose: 'login',
      needLogin: true,
      loginUrl: loginWithNext,
      nextAttendance: true,
      shopId: claims.shopId,
      shopName: claims.shopName ?? null,
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
    // 오늘 00:00 기준
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
    shopName: claims.shopName ?? null,
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
