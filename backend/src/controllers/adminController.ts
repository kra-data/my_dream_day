// controllers/adminController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/* ───────────────── 공통 유틸 ───────────────── */

const shopSelect = {
  id: true,
  name: true,
  hourlyWage: true,
  payday: true,
  createdAt: true,
  updatedAt: true,
} as const;

const toPlain = <T>(o: T): T =>
  JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

const requireOwnerId = (req: AuthRequest): bigint | null => {
  const uid = req.user?.userId;
  if (!uid && uid !== 0) return null;
  // JWT에 number로 들어있다고 가정 → Prisma BigInt로 변환
  return BigInt(uid);
};

const parseShopId = (req: AuthRequest): { ok: true; id: bigint } | { ok: false } => {
  const raw = String(req.params.shopId ?? '');
  if (!/^\d+$/.test(raw)) return { ok: false };
  return { ok: true, id: BigInt(raw) };
};

/* ───────────────── 목록/단건 조회 ───────────────── */

// GET /api/admin/shops  → “내가 소유한” 가게만
export const getShops = async (req: AuthRequest, res: Response) => {
  const ownerId = requireOwnerId(req);
  if (ownerId == null) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const shops = await prisma.shop.findMany({
    where: { ownerUserId: ownerId },
    select: shopSelect,
    orderBy: { id: 'desc' }
  });

  res.json({ items: toPlain(shops) }); // ← 배열 그대로가 아니라 { items: [...] }
};

// (선택) 단건 조회가 필요하다면
export const getShopById = async (req: AuthRequest, res: Response) => {
  const ownerId = requireOwnerId(req);
  if (ownerId == null) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const parsed = parseShopId(req);
  if (!parsed.ok) { res.status(400).json({ error: 'shopId must be numeric' }); return; }

  const shop = await prisma.shop.findFirst({
    where: { id: parsed.id, ownerUserId: ownerId },
    select: shopSelect,
  });
  if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }

  res.json(toPlain(shop));
};

/* ───────────────── 생성 ───────────────── */

const createShopSchema = z.object({
  name: z.string().min(1),
  hourlyWage: z.number().int().positive().optional(),
  payday: z.number().int().min(1).max(31).optional(),
});

export const createShop = async (req: AuthRequest, res: Response) => {
  const ownerId = requireOwnerId(req);
  if (ownerId == null) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const parsed = createShopSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  const { name, hourlyWage, payday } = parsed.data;

  // (정책) 같은 오너의 동일 이름 중복 방지
  const dup = await prisma.shop.findFirst({
    where: { ownerUserId: ownerId, name },
    select: { id: true },
  });
  if (dup) { res.status(409).json({ error: 'Shop name already exists' }); return; }

  const created = await prisma.shop.create({
    data: {
      name,
      hourlyWage,
      payday,
      qrSecret: crypto.randomUUID(),
      ownerUserId: ownerId,               // 🔑 오너 소유로 연결
    },
    select: shopSelect,
  });

  res.status(201).json(toPlain(created));
};

/* ───────────────── 수정 ───────────────── */

const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  hourlyWage: z.number().int().positive().optional(),
  payday: z.number().int().min(1).max(31).optional(),
});

export const updateShop = async (req: AuthRequest, res: Response) => {
  const ownerId = requireOwnerId(req);
  if (ownerId == null) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const parsedId = parseShopId(req);
  if (!parsedId.ok) { res.status(400).json({ error: 'shopId must be numeric' }); return; }

  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  // 소유권 + 존재 확인
  const exists = await prisma.shop.findFirst({
    where: { id: parsedId.id, ownerUserId: ownerId },
    select: { id: true },
  });
  if (!exists) { res.status(404).json({ error: 'Shop not found' }); return; }

  // (정책) 이름 변경 시 동일 오너 내 중복 방지
  if (parsed.data.name) {
    const dup = await prisma.shop.findFirst({
      where: { ownerUserId: ownerId, name: parsed.data.name, NOT: { id: parsedId.id } },
      select: { id: true },
    });
    if (dup) { res.status(409).json({ error: 'Shop name already exists' }); return; }
  }

  const updated = await prisma.shop.update({
    where: { id: parsedId.id },
    data: parsed.data,
    select: shopSelect,
  });

  res.json(toPlain(updated));
};

/* ───────────────── 삭제 ───────────────── */

export const deleteShop = async (req: AuthRequest, res: Response) => {
  const ownerId = requireOwnerId(req);
  if (ownerId == null) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const parsedId = parseShopId(req);
  if (!parsedId.ok) { res.status(400).json({ error: 'shopId must be numeric' }); return; }

  const exists = await prisma.shop.findFirst({
    where: { id: parsedId.id, ownerUserId: ownerId },
    select: { id: true }
  });
  if (!exists) { res.status(404).json({ error: 'Shop not found' }); return; }

  await prisma.shop.delete({ where: { id: parsedId.id } });
  res.json({ ok: true }); // ← 204 대신 200 + { ok: true }
};
