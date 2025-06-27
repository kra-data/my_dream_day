import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
import { isValidSchedule } from '../utils/scheduleValidator';

import { Prisma, Position, Section, PayUnit } from '@prisma/client';

/** Prisma가 write 시 기대하는 JSON 타입 */
type Json = Prisma.InputJsonValue;      // ← 핵심!


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

export const createShop = async (req: Request, res: Response) => {
  const { name, hourlyWage, payday } = req.body;
  if (!name || !hourlyWage || !payday) {
    res.status(400).json({ error: 'name, hourlyWage, payday required' });
    return;
  }
  const shop = await prisma.shop.create({
    data: { name, hourlyWage, payday, qrSecret: crypto.randomUUID() }
  });
  res.status(201).json(shop);
};

export const updateShop = async (req: Request, res: Response) => {
  const shopId = Number(req.params.id);
  const { name, hourlyWage, payday } = req.body;
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
  const shopId = Number(req.params.id);
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
  const shopId = Number(req.params.id);
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      bank: true,
      accountNumber: true,
      nationalId: true,
      phone: true,
      schedule: true,
      position: true,
      section: true,
      pay: true,
      payUnit: true
    }
  });
  res.json(employees);
};

/** ------------------------------------------------------------------
 *  CREATE EMPLOYEE
 *  (1) 필수 값 검증
 *  (2) pay / payUnit   - position에 맞게 자동 추론 or 검증
 * ------------------------------------------------------------------*/
export const createEmployee = async (req: Request, res: Response) => {
  const shopId = Number(req.params.id);
  const {
    name,
    nationalId,
    accountNumber,
    bank,
    phone,
    schedule,
    position = 'STAFF',
    section  = 'HALL',
    pay,
    payUnit
  } = req.body as {
    name: string; nationalId: string; accountNumber: string; bank: string;
    phone: string; schedule: Json; position?: Position; section?: Section;
    pay?: number; payUnit?: PayUnit;
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

  const emp = await prisma.employee.create({
    data: {
      shopId,
      name,
      nationalId,
      accountNumber,
      bank,
      phone,
      schedule: schedule as Json,
      position,
      section,
      pay,
      payUnit: finalPayUnit
    }
  });
  res.status(201).json(emp);
};

/** ------------------------------------------------------------------
 *  UPDATE EMPLOYEE (부분 업데이트 허용)
 * ------------------------------------------------------------------*/
export const updateEmployee = async (req: Request, res: Response) => {
  const empId = Number(req.params.id);
  const {
    name,
    accountNumber,
    bank,
    phone,
    schedule,
    position,
    section,
    pay,
    payUnit
  } = req.body as Partial<{
    name: string; accountNumber: string; bank: string; phone: string;
    schedule: Json; position: Position; section: Section;
    pay: number; payUnit: PayUnit;
  }>;

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
      payUnit
    }
  });
  res.json(updated);
};

export const deleteEmployee = async (req: Request, res: Response) => {
  const empId = Number(req.params.id);
  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  await prisma.employee.delete({ where: { id: empId } });
  res.status(204).send();
};
