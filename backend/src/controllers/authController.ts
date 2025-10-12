// src/controllers/authController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { signToken, verifyToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';
import { AuthRequiredRequest } from '../middlewares/requireUser';
// ===== Zod Schemas (스프링 DTO와 동일 필드) =====
const RegisterRequest = z.object({
  loginId: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
});

const LoginRequest = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
  shopId: z.number().int().positive().optional(),
});

const SelectShopRequest = z.object({
  shopId: z.number().int().positive(),
});

const RefreshRequest = z.object({
  refreshToken: z.string().min(1),
});

const LogoutRequest = z.object({
  refreshToken: z.string().min(1),
});

// ===== 공통 유틸 =====
const digitsOnly = (s?: string | null) => (s ?? '').replace(/\D/g, '');

export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterRequest.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({ message: '비밀번호는 8자 이상' }); return;}
  const { loginId, password, name } = parsed.data;

  // loginId 중복 검사
  const exists = await prisma.user.findFirst({ where: { loginId } });
  if (exists) {
    res.status(400).json({ message: '이미 존재하는 아이디' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Role.ADMIN(=사장) 로직: role 컬럼은 문자열, 스프링에선 Role.ADMIN 사용
  const user = await prisma.user.create({
    data: {
      loginId,
      passwordHash,
      name,
      role: 'ADMIN',
    },
  });

  // RegisterResponse
  res.json({
    id: Number(user.id),
    loginId: user.loginId,
    phone: user.phone,
    name: user.name,
  });
};

// 사장 로그인
export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginRequest.safeParse(req.body);
  if (!parsed.success){res.status(400).json({ message: '잘못된 요청' }); return;}

  const { loginId, password, shopId } = parsed.data;

  const u = await prisma.user.findFirst({ where: { loginId } });
  if (!u) {res.status(400).json({ message: '존재하지 않는 사용자입니다.' }); return;}
  if (!u.passwordHash || !(await bcrypt.compare(password, u.passwordHash))) {
    res.status(400).json({ message: '로그인 정보가 올바르지 않습니다.' });
    return;
  }

  // 소유 가게 목록 (최근 id 순 정렬)
  const owned = await prisma.shop.findMany({
    where: { ownerUserId: u.id },
    orderBy: { id: 'desc' },
  });

  const shopCandidates = owned.map((s) => ({
    shopId: Number(s.id),
    name: s.name,
    shopRole: 'OWNER',
  }));

  // 선택 로직 (스프링과 동일)
  let chosen: typeof owned[number] | null = null;
  if (shopId != null) {
    chosen = owned.find((s) => Number(s.id) === Number(shopId)) ?? null;
    if (!chosen){res.status(403).json({ message: '가게 소유자가 아닙니다.' }); return;}
  } else if (owned.length === 1) {
    chosen = owned[0];
  } else if (owned.length === 0) {
    chosen = null;
  } else {
    // 여러 개 → 선택 요구
    res.json({
      accessToken: null,
      refreshToken: null,
      selectedShopId: null,
      selectedShopRole: null,
      chooseRequired: true,
      shops: shopCandidates,
    });
  }

  const chosenShopId = chosen ? Number(chosen.id) : null;
  const chosenShopRole = chosen ? 'OWNER' : null;

  const accessToken = signToken(
    {
      userId: Number(u.id),
      loginId: u.loginId,
      shopId: chosenShopId ?? undefined,
      shopRole: chosenShopRole ?? undefined,
    },
    { expiresIn: '1h' } // 스프링은 3600초. utils/jwt에서 맞춰놨다면 그대로 사용
  );

  const refreshToken = signToken(
    {
      userId: Number(u.id),
      loginId: u.loginId,
      shopId: chosenShopId ?? undefined,
      shopRole: chosenShopRole ?? undefined,
    },
    { expiresIn: '14d' } // 스프링은 14일
  );

  // LoginResponse
  res.json({
    accessToken,
    refreshToken,
    selectedShopId: chosenShopId,
    selectedShopRole: chosenShopRole,
    chooseRequired: false,
    shops: chosenShopId == null ? shopCandidates : [],
  });
};

// 사장: 가게 선택
export const selectShop = async (req: AuthRequiredRequest, res: Response) : Promise<void>=> {
  const parsed = SelectShopRequest.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({ message: '잘못된 요청' }); return;}

  // 인증 미들웨어에서 userId를 셋팅했다고 가정 (스프링의 @PreAuthorize 대응)
  const userId = req.user.userId as number | undefined;
  if (!userId) {res.status(400).json({ message: '사장님만 가게를 선택할 수 있습니다' }); return;}

  const u = await prisma.user.findUnique({ where: { id: BigInt(userId) } });
  if (!u) { res.status(404).json({ message: '존재하지 않는 사용자' }); return;}

  const shop = await prisma.shop.findUnique({ where: { id: BigInt(parsed.data.shopId) } });
  if (!shop) {res.status(404).json({ message: '존재하지 않는 가게' }); return;}
  if (shop.ownerUserId !== u.id) {res.status(403).json({ message: '가게 소유자가 아닙니다.' }); return;}

  const accessToken = signToken(
    {
      userId: Number(u.id),
      loginId: u.loginId,
      shopId: Number(shop.id),
      shopRole: 'OWNER',
    },
    { expiresIn: '1h' }
  );
  const refreshToken = signToken(
    {
      userId: Number(u.id),
      loginId: u.loginId,
      shopId: Number(shop.id),
      shopRole: 'OWNER',
    },
    { expiresIn: '14d' }
  );

  res.json({
    accessToken,
    refreshToken,
    selectedShopId: Number(shop.id),
    selectedShopRole: 'OWNER',
    chooseRequired: false,
    shops: [],
  });
};

// 토큰 리프레시
export const refresh = async (req: Request, res: Response) : Promise<void>=> {
  const parsed = RefreshRequest.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({ message: '잘못된 요청' }); return}

  try {
    const decoded = verifyToken(parsed.data.refreshToken) as any;
    const userId = Number(decoded.userId);
    const loginId = decoded.loginId as string;
    const shopId = decoded.shopId as number | undefined;
    const shopRole = decoded.shopRole as string | undefined;

    const accessToken = signToken(
      { userId, loginId, shopId, shopRole },
      { expiresIn: '1h' }
    );
    const refreshToken = signToken(
      { userId, loginId, shopId, shopRole },
      { expiresIn: '14d' }
    );

    res.json({
      accessToken,
      refreshToken,
      shopId: shopId ?? null,
      shopRole: shopRole ?? null,
    });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }
};

// 로그아웃 (토큰 블랙리스트/저장소가 없다면 no-op로 동일 응답)
export const logout = async (req: Request, res: Response) : Promise<void>=> {
  const parsed = LogoutRequest.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({ message: '잘못된 요청' }); return;}

  // 필요시 DB/Redis에 리프레시 토큰을 보관하고 revoke 처리
  res.json({ ok: true });
};

// ME
export const me = async (req: AuthRequiredRequest, res: Response) : Promise<void>=> {
  // 인증 미들웨어에서 userId 세팅했다고 가정
  const userId = req.user.userId as number | undefined;
  if (!userId) {res.status(401).json({ message: 'Unauthorized' }); return;}

  const u = await prisma.user.findUnique({ where: { id: BigInt(userId) } });
  if (!u) {res.status(404).json({ message: '존재하지 않는 사용자' }); return;}

  res.json({
    id: Number(u.id),
    loginId: u.loginId,
    name: u.name,
    phone: u.phone,
  });
};
