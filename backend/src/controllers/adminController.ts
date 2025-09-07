import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
import { isValidSchedule } from '../utils/scheduleValidator';
import { encryptNationalId, hashNationalId, maskNationalId } from '../utils/nationalId';

import { Prisma, Position, Section, PayUnit } from '@prisma/client';

/** Prisma가 write 시 기대하는 JSON 타입 */
type Json = Prisma.InputJsonValue;      // ← 핵심!
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex color like #A1B2C3');
// 빈 문자열("")로 보내면 null 로 간주, 문자열이면 대문자로 정규화
const colorOptNullable = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : (typeof v === 'string' ? v.toUpperCase() : v)),
  hexColor.nullable().optional()
);


//////////////////////////////
// 🔹 enum 화이트리스트
//////////////////////////////
const POSITIONS = ['OWNER', 'MANAGER', 'STAFF', 'PART_TIME'] as const;
const SECTIONS  = ['HALL', 'KITCHEN'] as const;
const PAY_UNITS = ['MONTHLY', 'HOURLY'] as const;

/*───────────────────────────*
 *  SHOP CRUD
 *───────────────────────────*/
export const getShops = async (req: Request, res: Response) => {
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, hourlyWage: true, payday: true }
  });
  res.json(shops);
};

const createShopSchema = z.object({
  name: z.string().min(1),
  hourlyWage: z.number().int().positive(),
  payday: z.number().int().min(1).max(31)
});

export const createShop = async (req: Request, res: Response) => {
  const parsed = createShopSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { name, hourlyWage, payday } = parsed.data;
  const shop = await prisma.shop.create({
    data: { name, hourlyWage, payday, qrSecret: crypto.randomUUID() }
  });
  res.status(201).json(shop);
};

const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  hourlyWage: z.number().int().positive().optional(),
  payday: z.number().int().min(1).max(31).optional()
});

export const updateShop = async (req: Request, res: Response) => {
  const shopId = Number(req.params.shopId);
  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const { name, hourlyWage, payday } = parsed.data;
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    res.status(404).json({ error: 'Shop not found' });
    return;
  }
  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { name, hourlyWage, payday }
  });
  res.json(updated);
};

export const deleteShop = async (req: Request, res: Response) => {
  const shopId = Number(req.params.shopId);
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    res.status(404).json({ error: 'Shop not found' });
    return;
  }
  await prisma.shop.delete({ where: { id: shopId } });
  res.status(204).send();
};

/*───────────────────────────*
 *  EMPLOYEE CRUD
 *───────────────────────────*/
export const getEmployees = async (req: Request, res: Response) => {
  const shopId = Number(req.params.shopId);
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      bank: true,
      accountNumber: true,
      nationalIdMasked: true,
      phone: true,
      schedule: true,
      position: true,
      section: true,
      pay: true,
      payUnit: true,
      personalColor: true
    }
  });
  res.json(employees);
};

/** ------------------------------------------------------------------
 *  CREATE EMPLOYEE
 *  (1) 필수 값 검증
 *  (2) pay / payUnit   - position에 맞게 자동 추론 or 검증
 * ------------------------------------------------------------------*/
const createEmployeeSchema = z.object({
  name: z.string().min(1),
  accountNumber: z.string().min(1),
  nationalId: z.string()
    .regex(/^\d{6}-?\d{7}$/, '올바른 주민번호 형식이 아닙니다'),
  bank: z.string().min(1),
  phone: z.string().min(1),
  schedule: z.any(),
  position: z.enum(['OWNER','MANAGER','STAFF','PART_TIME']).optional(),
  section: z.enum(['HALL','KITCHEN']).optional(),
  pay: z.number().positive().optional(),
  payUnit: z.enum(['MONTHLY','HOURLY']).optional(),
  personalColor: colorOptNullable
});

export const createEmployee = async (req: Request, res: Response) => {
  const shopId = Number(req.params.shopId);
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
  const {
    name,
    accountNumber,
    bank,
    phone,
    schedule,
    nationalId,
    position = 'STAFF',
    section  = 'HALL',
    pay,
    payUnit,
    personalColor = null
  } = parsed.data as unknown as {
    name: string; nationalId:string; accountNumber: string; bank: string;
    phone: string; schedule: Json; position?: Position; section?: Section;
    pay?: number; payUnit?: PayUnit; personalColor?:string
  };

  /* ✅ 공통 필드 검증 */
  if (
    !name || !nationalId || !accountNumber || !bank || !phone ||
    !isValidSchedule(schedule) ||
    !POSITIONS.includes(position) || !SECTIONS.includes(section)
  ) {
    res.status(400).json({ error: '필수 값 누락 또는 잘못된 데이터' });
    return;
  }

  /* ✅ 급여 규칙:
   *    PART_TIME → HOURLY
   *    그 외      → MONTHLY
   *    pay > 0 이어야 함
   */
  const inferredUnit: PayUnit = position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY';
  const finalPayUnit: PayUnit = (payUnit ?? inferredUnit) as PayUnit;

  if (
    !PAY_UNITS.includes(finalPayUnit) ||
    finalPayUnit !== inferredUnit ||          // 규칙 위반
    typeof pay !== 'number' || pay <= 0
  ) {
    res.status(400).json({ error: '급여(pay) 또는 payUnit이 잘못되었습니다.' });
    return;
  }
  const nationalIdEnc = encryptNationalId(nationalId);
  const nationalIdHash = hashNationalId(nationalId /*, shopId*/);
  const nationalIdMasked = maskNationalId(nationalId);

  const emp = await prisma.employee.create({
    data: {
      shopId,
      name,
      accountNumber,
      bank,
      phone,
      schedule: schedule as Json,
      position,
      section,
      pay,
      payUnit: finalPayUnit,
      // 🔽 더 이상 평문 저장하지 않음 (nationalId 필드는 나중 단계에서 삭제)
      nationalIdEnc,
      nationalIdHash,
      nationalIdMasked,
      personalColor: personalColor ?? null,
    }
  });
  // 응답에 enc/hash는 절대 포함X
  res.status(201).json({
    ...emp,
    nationalId: undefined,
    nationalIdEnc: undefined,
    nationalIdHash: undefined,
    nationalIdMasked: emp.nationalIdMasked
  });
};

/** ------------------------------------------------------------------
 *  UPDATE EMPLOYEE (부분 업데이트 허용)
 * ------------------------------------------------------------------*/
const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  accountNumber: z.string().min(1).optional(),
  bank: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  schedule: z.any().optional(),
  position: z.enum(['OWNER','MANAGER','STAFF','PART_TIME']).optional(),
  section: z.enum(['HALL','KITCHEN']).optional(),
  pay: z.number().positive().optional(),
  payUnit: z.enum(['MONTHLY','HOURLY']).optional(),
    personalColor: colorOptNullable
});

export const updateEmployee = async (req: Request, res: Response) => {
  const empId = Number(req.params.employeeId);
  const {
    name,
    accountNumber,
    bank,
    phone,
    schedule,
    position,
    section,
    pay,
    payUnit,
    personalColor=null
  } = (updateEmployeeSchema.parse(req.body) as Partial<{
    name: string; accountNumber: string; bank: string; phone: string;
    schedule: Json; position: Position; section: Section;
    pay: number; payUnit: PayUnit; personalColor: string;
  }>);

  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  /* ✅ 각 필드별 검증 */
  const nextPosition: Position = (position ?? emp.position) as Position;
  const nextPayUnit: PayUnit   = (payUnit  ?? emp.payUnit)  as PayUnit;
  const inferredUnit: PayUnit  = nextPosition === 'PART_TIME' ? 'HOURLY' : 'MONTHLY';
  if (
    (schedule && !isValidSchedule(schedule)) ||
    (position && !POSITIONS.includes(position)) ||
    (section  && !SECTIONS.includes(section))  ||
    (payUnit  && !PAY_UNITS.includes(payUnit)) ||
    (pay !== undefined && (typeof pay !== 'number' || pay <= 0)) ||
    nextPayUnit !== inferredUnit               // 규칙 위반
  ) {
    res.status(400).json({ error: '잘못된 입력 데이터' });
    return;
  }

  const updated = await prisma.employee.update({
    where: { id: empId },
    data: {
      name,
      accountNumber,
      bank,
      phone,
      schedule: schedule as Json,
      position,
      section,
      pay,
      payUnit,
      personalColor: (personalColor === undefined) ? undefined : (personalColor ?? null)
    }
  });
  res.json(updated);
};

export const deleteEmployee = async (req: Request, res: Response) => {
  const empId = Number(req.params.employeeId);
  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  await prisma.employee.delete({ where: { id: empId } });
  res.status(204).send();
};
