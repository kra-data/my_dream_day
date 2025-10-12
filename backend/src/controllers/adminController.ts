// import { Request, Response } from 'express';
// import { z } from 'zod';
// import { prisma } from '../db/prisma';
// import crypto from 'crypto';
// import { isValidSchedule } from '../utils/scheduleValidator';
// import { encryptNationalId, hashNationalId, maskNationalId } from '../utils/nationalId';

// import { Prisma, Position, Section, PayUnit } from '@prisma/client';

// /** Prisma가 write 시 기대하는 JSON 타입 */
// type Json = Prisma.InputJsonValue;      // ← 핵심!
// const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex color like #A1B2C3');
// // 빈 문자열("")로 보내면 null 로 간주, 문자열이면 대문자로 정규화
// const colorOptNullable = z.preprocess(
//   (v) => (typeof v === 'string' && v.trim() === '' ? null : (typeof v === 'string' ? v.toUpperCase() : v)),
//   hexColor.nullable().optional()
// );


// //////////////////////////////
// // 🔹 enum 화이트리스트
// //////////////////////////////
// const POSITIONS = ['OWNER', 'MANAGER', 'STAFF', 'PART_TIME'] as const;
// const SECTIONS  = ['HALL', 'KITCHEN'] as const;
// const PAY_UNITS = ['MONTHLY', 'HOURLY'] as const;

// /*───────────────────────────*
//  *  SHOP CRUD
//  *───────────────────────────*/
// export const getShops = async (req: Request, res: Response) => {
//   const shops = await prisma.shop.findMany({
//     select: { id: true, name: true, hourlyWage: true, payday: true }
//   });
//   res.json(shops);
// };

// const createShopSchema = z.object({
//   name: z.string().min(1),
//   hourlyWage: z.number().int().positive(),
//   payday: z.number().int().min(1).max(31)
// });

// export const createShop = async (req: Request, res: Response) => {
//   const parsed = createShopSchema.safeParse(req.body);
//   if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
//   const { name, hourlyWage, payday } = parsed.data;
//   const shop = await prisma.shop.create({
//     data: { name, hourlyWage, payday, qrSecret: crypto.randomUUID() }
//   });
//   res.status(201).json(shop);
// };

// const updateShopSchema = z.object({
//   name: z.string().min(1).optional(),
//   hourlyWage: z.number().int().positive().optional(),
//   payday: z.number().int().min(1).max(31).optional()
// });

// export const updateShop = async (req: Request, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   const parsed = updateShopSchema.safeParse(req.body);
//   if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
//   const { name, hourlyWage, payday } = parsed.data;
//   const shop = await prisma.shop.findUnique({ where: { id: shopId } });
//   if (!shop) {
//     res.status(404).json({ error: 'Shop not found' });
//     return;
//   }
//   const updated = await prisma.shop.update({
//     where: { id: shopId },
//     data: { name, hourlyWage, payday }
//   });
//   res.json(updated);
// };

// export const deleteShop = async (req: Request, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   const shop = await prisma.shop.findUnique({ where: { id: shopId } });
//   if (!shop) {
//     res.status(404).json({ error: 'Shop not found' });
//     return;
//   }
//   await prisma.shop.delete({ where: { id: shopId } });
//   res.status(204).send();
// };

// /*───────────────────────────*
//  *  EMPLOYEE CRUD
//  *───────────────────────────*/
// export const getEmployees = async (req: Request, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   const employees = await prisma.employeeMember.findMany({
//     where: { shopId },
//     select: {
//       id: true,
//       name: true,
//       bank: true,
//       accountNumber: true,
//       nationalIdMasked: true,
//       phone: true,
//       schedule: true,
//       position: true,
//       section: true,
//       pay: true,
//       payUnit: true,
//       personalColor: true
//     }
//   });
//   res.json(employees);
// };

// /** ------------------------------------------------------------------
//  *  CREATE EMPLOYEE
//  *  (1) 필수 값 검증
//  *  (2) pay / payUnit   - position에 맞게 자동 추론 or 검증
//  * ------------------------------------------------------------------*/
// const createEmployeeSchema = z.object({
//   name: z.string().min(1),
//   accountNumber: z.string().min(1),
//   nationalId: z.string()
//     .regex(/^\d{6}-?\d{7}$/, '올바른 주민번호 형식이 아닙니다'),
//   bank: z.string().min(1),
//   phone: z.string().min(1),
//   schedule: z.any(),
//   position: z.enum(['OWNER','MANAGER','STAFF','PART_TIME']).optional(),
//   section: z.enum(['HALL','KITCHEN']).optional(),
//   pay: z.number().positive().optional(),
//   payUnit: z.enum(['MONTHLY','HOURLY']).optional(),
//   personalColor: colorOptNullable
// });

// export const createEmployee = async (req: Request, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   const parsed = createEmployeeSchema.safeParse(req.body);
//   if (!parsed.success) { res.status(400).json({ error: 'Invalid payload' }); return; }
//   const {
//     name,
//     accountNumber,
//     bank,
//     phone,
//     schedule,
//     nationalId,
//     position = 'STAFF',
//     section  = 'HALL',
//     pay,
//     payUnit,
//     personalColor = null
//   } = parsed.data as unknown as {
//     name: string; nationalId:string; accountNumber: string; bank: string;
//     phone: string; schedule: Json; position?: Position; section?: Section;
//     pay?: number; payUnit?: PayUnit; personalColor?:string
//   };

//   /* ✅ 공통 필드 검증 */
//   if (
//     !name || !nationalId || !accountNumber || !bank || !phone ||
//     !isValidSchedule(schedule) ||
//     !POSITIONS.includes(position) || !SECTIONS.includes(section)
//   ) {
//     res.status(400).json({ error: '필수 값 누락 또는 잘못된 데이터' });
//     return;
//   }

//   /* ✅ 급여 규칙:
//    *    PART_TIME → HOURLY
//    *    그 외      → MONTHLY
//    *    pay > 0 이어야 함
//    */
//   const inferredUnit: PayUnit = position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY';
//   const finalPayUnit: PayUnit = (payUnit ?? inferredUnit) as PayUnit;

//   if (
//     !PAY_UNITS.includes(finalPayUnit) ||
//     finalPayUnit !== inferredUnit ||          // 규칙 위반
//     typeof pay !== 'number' || pay <= 0
//   ) {
//     res.status(400).json({ error: '급여(pay) 또는 payUnit이 잘못되었습니다.' });
//     return;
//   }
//   const nationalIdEnc = encryptNationalId(nationalId);
//   const nationalIdHash = hashNationalId(nationalId /*, shopId*/);
//   const nationalIdMasked = maskNationalId(nationalId);

//   const emp = await prisma.employeeMember.create({
//     data: {
//       shopId,
//       name,
//       bankAccount,
//       bank,
//       phone,
//       schedule: schedule as Json,
//       position,
//       section,
//       pay,
//       payUnit: finalPayUnit,
//       // 🔽 더 이상 평문 저장하지 않음 (nationalId 필드는 나중 단계에서 삭제)
//       nationalIdEnc,
//       nationalIdHash,
//       nationalIdMasked,
//       personalColor: personalColor ?? null,
//     }
//   });
//   // 응답에 enc/hash는 절대 포함X
//   res.status(201).json({
//     ...emp,
//     nationalId: undefined,
//     nationalIdEnc: undefined,
//     nationalIdHash: undefined,
//     nationalIdMasked: emp.nationalIdMasked
//   });
// };

// /** ------------------------------------------------------------------
//  *  UPDATE EMPLOYEE (부분 업데이트 허용)
//  * ------------------------------------------------------------------*/
// const updateEmployeeSchema = z.object({
//   name: z.string().min(1).optional(),
//   accountNumber: z.string().min(1).optional(),
//   bank: z.string().min(1).optional(),
//   phone: z.string().min(1).optional(),
//   schedule: z.any().optional(),
//   position: z.enum(['OWNER','MANAGER','STAFF','PART_TIME']).optional(),
//   section: z.enum(['HALL','KITCHEN']).optional(),
//   pay: z.number().positive().optional(),
//   payUnit: z.enum(['MONTHLY','HOURLY']).optional(),
//     personalColor: colorOptNullable,
//     nationalId: z.string()
//     .regex(/^\d{6}-?\d{7}$/, '올바른 주민번호 형식이 아닙니다')
//     .optional()
// });

// export const updateEmployee = async (req: Request, res: Response) => {
//   const empId = Number(req.params.employeeId);
//   const {
//     name,
//     accountNumber,
//     bank,
//     phone,
//     schedule,
//     position,
//     section,
//     pay,
//     payUnit,
//     personalColor=null,
//     nationalId
//   } = (updateEmployeeSchema.parse(req.body) as Partial<{
//     name: string; accountNumber: string; bank: string; phone: string;
//     schedule: Json; position: Position; section: Section;
//     pay: number; payUnit: PayUnit; personalColor: string; nationalId:string;
//   }>);

//   const emp = await prisma.employeeMember.findUnique({ where: { id: empId } });
//   if (!emp) {
//     res.status(404).json({ error: 'Employee not found' });
//     return;
//   }

//   /* ✅ 각 필드별 검증 */
//   const nextPosition: Position = (position ?? emp.position) as Position;
//   const nextPayUnit: PayUnit   = (payUnit  ?? emp.payUnit)  as PayUnit;
//   const inferredUnit: PayUnit  = nextPosition === 'PART_TIME' ? 'HOURLY' : 'MONTHLY';
//   if (
//     (schedule && !isValidSchedule(schedule)) ||
//     (position && !POSITIONS.includes(position)) ||
//     (section  && !SECTIONS.includes(section))  ||
//     (payUnit  && !PAY_UNITS.includes(payUnit)) ||
//     (pay !== undefined && (typeof pay !== 'number' || pay <= 0)) ||
//     nextPayUnit !== inferredUnit               // 규칙 위반
//   ) {
//     res.status(400).json({ error: '잘못된 입력 데이터' });
//     return;
//   }
//   // 🔐 주민번호 변경 처리: 암호화/해시/마스킹 재생성, 중복(동일 매장 내) 방지
//   let nationalIdEncUpdate: string | undefined;
//   let nationalIdHashUpdate: string | undefined;
//   let nationalIdMaskedUpdate: string | undefined;
//   if (nationalId !== undefined) {
//     // 비우기 금지(정책상 필요 시 여기서 허용 로직으로 바꿔도 됨)
//     if (nationalId.trim() === '') {
//       res.status(400).json({ error: 'nationalId는 빈 값으로 변경할 수 없습니다.' });
//       return;
//     }
//     const newHash = hashNationalId(nationalId /*, emp.shopId */);
//     // 같은 매장 내 중복 방지(유니크 인덱스가 없다면 애플리케이션 레벨로 체크)
//     const dup = await prisma.employeeMemberMember.findFirst({
//       where: { shopId: emp.shopId, nationalIdHash: newHash, NOT: { id: empId } },
//       select: { id: true }
//     });
//     if (dup) {
//       res.status(409).json({ error: '이미 등록된 주민번호입니다.', conflictEmployeeId: dup.id });
//       return;
//     }
//     nationalIdEncUpdate    = encryptNationalId(nationalId);
//     nationalIdHashUpdate   = newHash;
//     nationalIdMaskedUpdate = maskNationalId(nationalId);
//   }
//   const updated = await prisma.employeeMember.update({
//     where: { id: empId },
//     data: {
//       name,
//       accountNumber,
//       bank,
//       phone,
//       schedule: schedule as Json,
//       position,
//       section,
//       pay,
//       payUnit,
//       personalColor: (personalColor === undefined) ? undefined : (personalColor ?? null),
//       // 주민번호 관련 컬럼은 undefined이면 그대로 유지
//       nationalIdEnc:    nationalIdEncUpdate,
//       nationalIdHash:   nationalIdHashUpdate,
//       nationalIdMasked: nationalIdMaskedUpdate
//     },
//     // 🔒 민감정보 응답 차단: 필요한 필드만 선택
//     select: {
//       id: true, shopId: true, name: true,
//       bank: true, accountNumber: true, phone: true,
//       schedule: true, position: true, section: true,
//       pay: true, payUnit: true, personalColor: true,
//       nationalIdMasked: true,
//       createdAt: true, updatedAt: true
//     }
//   });
//   res.json(updated);
// };

// export const deleteEmployee = async (req: Request, res: Response) => {
//   const empId = Number(req.params.employeeId);
//   const emp = await prisma.employeeMember.findUnique({ where: { id: empId } });
//   if (!emp) {
//     res.status(404).json({ error: 'Employee not found' });
//     return;
//   }
//   await prisma.employeeMember.delete({ where: { id: empId } });
//   res.status(204).send();
// };
