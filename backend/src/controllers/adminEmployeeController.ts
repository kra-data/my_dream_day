import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import { Prisma } from '@prisma/client';
/** ───────── 공통 유틸 ───────── */
const toPlain = <T>(o: T): T =>
  JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

const numStr = (s: string) => s.replace(/\D/g, '');
const last4 = (phoneDigits: string) => phoneDigits.slice(-4);

const requireOwnerOrManager = (req: AuthRequest): { userId: bigint; ok: boolean } => {
  const uid = req.user?.userId;
  const role = req.user?.shopRole;
  if (uid == null) return { ok: false, userId: 0n };
  if (!role || (role !== 'admin' && role !== 'owner')) {
    return { ok: false, userId: 0n };
  }
  return { ok: true, userId: BigInt(uid) };
};

const parseId = (val: unknown) => {
  const raw = String(val ?? '');
  if (!/^\d+$/.test(raw)) return null;
  return BigInt(raw);
};

/** ───────── Zod 스키마 (Spring DTO에 맞춤) ─────────
 *  - EmployeeCreateRequest: name, phone, nationalId?, bankName?, bankAccountNumber?
 *  - EmployeeUpdateRequest: name?, phone?, nationalId? (빈문자열이면 해제), bankName?, bankAccountNumber?
 */
const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  nationalId: z.string().optional(),         // "900101-1234567" | undefined
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  pay: z.union([z.number(), z.string()]).optional(),          // "12000" 도 허용
  payUnit: z.enum(['HOURLY','MONTHLY']).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  nationalId: z.string().optional(),         // "" 이면 해제
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  pay: z.union([z.number(), z.string()]).optional(),
  payUnit: z.enum(['HOURLY','MONTHLY']).optional(),
});

/** ───────── 민감정보 처리(암/해/마) ─────────
 *  프로젝트 내부 util을 이미 쓰고 있다면 거기로 교체해도 됩니다.
 */
import {
  encryptNationalId,
  hashNationalId,
  maskNationalId,
} from '../utils/nationalId';

/** ─────────────────────────────────────────────────────────
 *  POST /api/admin/shops/:shopId/employees  (직원 생성)
 *  - 전화번호는 숫자만 저장, 초기 비밀번호 = 휴대폰 뒤 4자리(bcrypt hash)
 *  - (shopId, name, phone) 중복이면 409
 *  - 주민번호가 오면 13자리 숫자 검증 후 enc/hash/masked 저장
 *  - 응답: { id, name, phone, role: 'employee' }
 *  (Spring: AdminEmployeeApi.createEmployee)  */
export const createEmployee = async (req: AuthRequest, res: Response) => {
  const auth = requireOwnerOrManager(req);
  if (!auth.ok) { res.status(403).json({ error: 'Forbidden' }); return; }

  const shopId = parseId(req.params.shopId);
  if (shopId == null) { res.status(400).json({ error: 'shopId must be numeric' }); return; }
    const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, hourlyWage: true }
  });
  if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }

  const name = parsed.data.name.trim();
  const phoneDigits = numStr(parsed.data.phone);
  const l4 = last4(phoneDigits);
  if (l4.length !== 4) { res.status(400).json({ error: '휴대폰 뒷자리가 유효하지 않습니다.' }); return; }
const requestedPayUnit = parsed.data.payUnit ?? 'HOURLY';
  const requestedPay = parsed.data.pay != null ? Number(parsed.data.pay) : shop.hourlyWage ?? 0;
  // (shopId, name, phone) 중복 검사
  const dup = await prisma.employeeMember.findFirst({
    where: { shopId: shopId, name, phone: phoneDigits },
    select: { id: true },
  });
  if (dup) { res.status(409).json({ error: 'Duplicate (same name & phone)' }); return; }
  if (!Number.isFinite(requestedPay) || requestedPay < 0) {
    res.status(400).json({ error: 'Invalid pay' });
    return;
  }
  // insert
  const passwordHash = await bcrypt.hash(l4, 10);
  let nationalIdEnc: string | null = null;
  let nationalIdHash: string | null = null;
  let nationalIdMasked: string | null = null;

  if (parsed.data.nationalId != null && parsed.data.nationalId.trim() !== '') {
    const digits = numStr(parsed.data.nationalId);
    if (digits.length !== 13) { res.status(400).json({ error: '주민등록번호는 13자리여야 합니다.' }); return; }
    nationalIdEnc = encryptNationalId(parsed.data.nationalId);
    nationalIdHash = hashNationalId(parsed.data.nationalId);
    nationalIdMasked = maskNationalId(digits);
  }

  const saved = await prisma.employeeMember.create({
    data: {
      shopId,
      name,
      shopRole:'employee',
      phone: phoneDigits,
      passwordHash,
      bankName: parsed.data.bankName?.trim() ?? null,
      bankAccount: parsed.data.bankAccountNumber?.trim() ?? null,
      nationalIdEnc,
      nationalIdHash,
      nationalIdMasked,
      pay: new Prisma.Decimal(requestedPay),
      payUnit: requestedPayUnit,
    },
    select: { id: true, name: true, phone: true },
  });

  res.status(201).json(toPlain({ id: saved.id, name: saved.name, phone: saved.phone, role: 'employee' }));
};

/** ─────────────────────────────────────────────────────────
 *  PUT /api/admin/shops/:shopId/employees/:empId  (직원 수정)
 *  - 같은 가게 소속만 수정 가능
 *  - phone 변경 시 뒤4자리 재해시 → passwordHash 동기화
 *  - (shopId, name, phone) 중복(본인 제외) 409
 *  - nationalId: "" 이면 해제(null), 값 있으면 13자리 검증 후 enc/hash/masked 재설정
 *  - 응답: { id, name, phone, role: 'employee' }
 *  (Spring: AdminEmployeeApi.updateEmployee / AdminEmployeeService.updateEmployee)  */
export const updateEmployee = async (req: AuthRequest, res: Response) => {
  const auth = requireOwnerOrManager(req);
  if (!auth.ok) { res.status(403).json({ error: 'Forbidden' }); return; }

  const shopId = parseId(req.params.shopId);
const empRaw = (req.params as any).empId ?? (req.params as any).employeeId;
const empId = parseId(empRaw);
  if (shopId == null || empId == null) { res.status(400).json({ error: 'ids must be numeric' }); return; }

  const input = updateSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const body = input.data;

  const e = await prisma.employeeMember.findUnique({ where: { id: empId } });
  if (!e || e.shopId !== shopId) { res.status(404).json({ error: 'Not Found' }); return; }

  // 사전중복체크: 이름/전화가 바뀐다면 (shopId, name, phone) 유니크 확인
  let nextName = e.name;
  let nextPhone = e.phone;
  if (body.name !== undefined) nextName = body.name.trim();
  if (body.phone !== undefined) {
    nextPhone = numStr(body.phone);
    const l4 = last4(nextPhone);
    if (l4.length !== 4) { res.status(400).json({ error: '휴대폰 뒷자리가 유효하지 않습니다.' }); return; }
    // 본인 제외 중복
    const dup = await prisma.employeeMember.findFirst({
      where: { shopId, name: nextName, phone: nextPhone, NOT: { id: empId } },
      select: { id: true },
    });
    if (dup) { res.status(409).json({ error: 'Duplicate (same name & phone)' }); return; }
  }

  // 업데이트 데이터 구성
  const data: any = {};
  if (body.name !== undefined) data.name = nextName;
  if (body.phone !== undefined) {
    data.phone = nextPhone;
    data.passwordHash = await bcrypt.hash(last4(nextPhone), 10); // 정책: 전화 변경 시 초기비번 동기화
  }
  if (body.bankName !== undefined) data.bankName = body.bankName?.trim() || null;
  if (body.bankAccountNumber !== undefined) data.bankAccount = body.bankAccountNumber?.trim() || null;
  if (body.pay !== undefined) {
    const p = Number(body.pay);
    if (!Number.isFinite(p) || p < 0) { res.status(400).json({ error: 'Invalid pay' }); return; }
    data.pay = new Prisma.Decimal(p);
  }
  if (body.payUnit !== undefined) {
    data.payUnit = body.payUnit;
  }

  if (body.nationalId !== undefined) {
    const nid = body.nationalId.trim();
    if (nid === '') {
      data.nationalIdEnc = null;
      data.nationalIdHash = null;
      data.nationalIdMasked = null;
    } else {
      const digits = numStr(nid);
      if (digits.length !== 13) { res.status(400).json({ error: '주민등록번호는 13자리여야 합니다.' }); return; }
      data.nationalIdEnc = encryptNationalId(nid);
      data.nationalIdHash = hashNationalId(nid);
      data.nationalIdMasked = maskNationalId(digits);
    }
  }

  const saved = await prisma.employeeMember.update({
    where: { id: empId },
    data,
    select: { id: true, name: true, phone: true },
  });

  res.json(toPlain({ id: saved.id, name: saved.name, phone: saved.phone, role: 'employee' }));
};

/** ─────────────────────────────────────────────────────────
 *  DELETE /api/admin/shops/:shopId/employees/:empId
 *  - 같은 가게 소속만 삭제 가능
 *  - 응답: { ok: true }
 *  (Spring: AdminEmployeeApi.deleteEmployee)  */
export const deleteEmployee = async (req: AuthRequest, res: Response) => {
  const auth = requireOwnerOrManager(req);
  if (!auth.ok) { res.status(403).json({ error: 'Forbidden' }); return; }

  const shopId = parseId(req.params.shopId);

const empRaw = (req.params as any).empId ?? (req.params as any).employeeId;
const empId = parseId(empRaw);
  if (shopId == null || empId == null) { res.status(400).json({ error: 'ids must be numeric' }); return; }

  const e = await prisma.employeeMember.findUnique({ where: { id: empId }, select: { id: true, shopId: true } });
  if (!e || e.shopId !== shopId) { res.status(404).json({ error: 'Not Found' }); return; }

  await prisma.employeeMember.delete({ where: { id: empId } });
  res.json({ ok: true });
};

/** ─────────────────────────────────────────────────────────
 *  GET /api/admin/shops/:shopId/employees?name=&phone=&cursor=&size=
 *  - 커서 기반(id DESC). cursor 없으면 최신부터, 있으면 id < cursor
 *  - phone은 숫자만 비교
 *  - size 1..50
 *  - 응답: { items:[{id,name,phone,role}], nextCursor:number|null }
 *  (Spring: AdminEmployeeApi.listEmployees / AdminEmployeeService.list)  */
export const listEmployees = async (req: AuthRequest, res: Response) => {
  const auth = requireOwnerOrManager(req);
  if (!auth.ok) { res.status(403).json({ error: 'Forbidden' }); return; }

  const shopId = parseId(req.params.shopId);
  if (shopId == null) { res.status(400).json({ error: 'shopId must be numeric' }); return; }

  const name = (req.query.name ? String(req.query.name) : undefined)?.trim();
  const phoneNorm = req.query.phone ? numStr(String(req.query.phone)) : undefined;
  const cursor = req.query.cursor ? parseId(req.query.cursor) : null;
  const sizeRaw = req.query.size ? Number(req.query.size) : 20;
  const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(sizeRaw, 1), 50) : 20;

  const where: any = { shopId };
  if (name) where.name = { contains: name };
  if (phoneNorm) where.phone = { contains: phoneNorm };

  const items = await prisma.employeeMember.findMany({
    where: cursor ? { ...where, id: { lt: cursor } } : where,
    orderBy: { id: 'desc' },
    take: size,
    select: { id: true, name: true, phone: true },
  });

const list = items.map(i => ({
  id: Number(i.id),      // ← BigInt → number 변환
  name: i.name,
  phone: i.phone,
  role: 'employee' as const
}));

const nextCursor = list.length > 0 ? list[list.length - 1].id : null;

res.json({ items: list, nextCursor });
};
