// // controllers/payrollOverviewController.ts
// import { Response } from 'express';
// import { z } from 'zod';
// import { prisma } from '../db/prisma';
// import { AuthRequiredRequest } from '../middlewares/requireUser';
// import ExcelJS from 'exceljs';
// import { decryptNationalId } from '../utils/nationalId';

// // Decimal -> number 보조
// const toNum = (v: any) => (v == null ? 0 : Number(v));

// // KST helpers
// const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
//   new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
// const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);

// // 사이클 계산
// function kstCycle(
//   year: number,
//   month: number,
//   startDay: number
// ): { start: Date; end: Date; nextStart: Date } {
//   const start = fromKstParts(year, month - 1, startDay, 0, 0, 0, 0);
//   const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
//   const nextStart = fromKstParts(nm.y, nm.m - 1, startDay, 0, 0, 0, 0);
//   const end = new Date(nextStart.getTime() - 1);
//   return { start, end, nextStart };
// }

// const q = z.object({
//   year: z.coerce.number().int().min(2000).max(2100),
//   month: z.coerce.number().int().min(1).max(12),
//   cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
// });

// /** 사이클(startDay 기준): [start, end] (end는 inclusive 23:59:59.999) */
// function buildCycle(year: number, month: number, startDay: number) {
//   const kstStart = fromKstParts(year, month - 1, startDay, 0, 0, 0, 0);
//   const nextMonth = month === 12 ? 1 : month + 1;
//   const nextYear  = month === 12 ? year + 1 : year;
//   const kstNext   = fromKstParts(nextYear, nextMonth - 1, startDay, 0, 0, 0, 0);
//   const start = kstStart;
//   const end   = new Date(kstNext.getTime() - 1);
//   const label = `${toKst(start).getUTCMonth()+1}월 ${toKst(start).getUTCDate()}일 ~ ${toKst(end).getUTCMonth()+1}월 ${toKst(end).getUTCDate()}일`;
//   return { start, end, nextStart: kstNext, label, startDay };
// }

// const listQuery = z.object({
//   year:  z.coerce.number().int().min(2000).max(2100),
//   month: z.coerce.number().int().min(1).max(12),
//   cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
//   q: z.string().optional(),
//   position: z.enum(['MANAGER','STAFF','PART_TIME','admin']).optional(),
//   settlement: z.enum(['PENDING','PAID']).optional(),
//   sort: z.enum(['amount','name','workedMinutes']).optional().default('name'),
//   order: z.enum(['asc','desc']).optional().default('asc'),
// });

// const detailQuery = z.object({
//   year:  z.coerce.number().int().min(2000).max(2100),
//   month: z.coerce.number().int().min(1).max(12),
//   cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
// });

// /* ───────── helpers ───────── */
// function uniqKstDates(dates: Date[]): number {
//   const s = new Set<string>();
//   for (const d of dates) {
//     const k = toKst(d);
//     s.add(`${k.getUTCFullYear()}-${k.getUTCMonth()+1}-${k.getUTCDate()}`);
//   }
//   return s.size;
// }

// // 소수점 절사(원 단위) 규칙: 각 세목을 개별 절사 → 합계
// const floorWon = (n: number) => Math.floor(n);

// const calcTaxesTruncate = (gross: number) => {
//   const incomeTax = floorWon(gross * INCOME_TAX_RATE);
//   const localIncomeTax = floorWon(incomeTax * LOCAL_TAX_ON_INCOME_RATE);
//   const otherTax = floorWon(gross * OTHER_TAX_RATE);
//   const deductions = incomeTax + localIncomeTax + otherTax;
//   const net = gross - deductions;
//   return { incomeTax, localIncomeTax, otherTax, net };
// };

// const fmtDateDot = (d: Date) => {
//   const k = toKst(d);
//   return `${k.getUTCFullYear()}. ${k.getUTCMonth() + 1}. ${k.getUTCDate()}.`;
// };
// const fmtRangeLabel = (s: Date, e: Date) => {
//   const ks = toKst(s), ke = toKst(e);
//   return `${ks.getUTCMonth() + 1}월 ${ks.getUTCDate()}일 ~ ${ke.getUTCMonth() + 1}월 ${ke.getUTCDate()}일`;
// };
// const fmtHourMinKo = (mins: number) => {
//   const h = Math.floor(mins / 60);
//   const m = mins % 60;
//   return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
// };

// function kstCalendarMonth(year: number, month: number) {
//   const start = fromKstParts(year, month - 1, 1, 0, 0, 0, 0);
//   const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
//   const nextStart = fromKstParts(nm.y, nm.m - 1, 1, 0, 0, 0, 0);
//   const end = new Date(nextStart.getTime() - 1);
//   return { start, end };
// }

// const fmtKoreanDuration = (mins: number) => {
//   const h = Math.floor(mins / 60);
//   const m = mins % 60;
//   return `${h}시간 ${m}분`;
// };

// // ✅ 프리랜서 원천징수(소득세 3% + 지방소득세=소득세의 10%) 유틸
// const INCOME_TAX_RATE = Number(process.env.PAYROLL_INCOME_TAX_RATE ?? '0.03');            // 3%
// const LOCAL_TAX_ON_INCOME_RATE = Number(process.env.PAYROLL_LOCAL_TAX_ON_INCOME_RATE ?? '0.1'); // 10% of income tax
// const OTHER_TAX_RATE  = Number(process.env.PAYROLL_OTHER_TAX_RATE  ?? '0');

// const calcTaxes = (gross: number) => {
//   const incomeTax = gross * INCOME_TAX_RATE;
//   const localTax  = incomeTax * LOCAL_TAX_ON_INCOME_RATE;
//   const otherTax  = gross * OTHER_TAX_RATE;
//   const deductions = incomeTax + localTax + otherTax;
//   const net = gross - deductions;
//   return { incomeTax, localTax, otherTax, deductions, net };
// };

// const applyFreelancerWithholding = (gross: number) => {
//   const incomeTax = gross * INCOME_TAX_RATE;
//   const localIncomeTax = incomeTax * LOCAL_TAX_ON_INCOME_RATE;
//   const withheld = incomeTax + localIncomeTax;
//   return { incomeTax, localIncomeTax, withheld, net: gross - withheld };
// };

// /* ──────────────────────────────────────── XLSX ──────────────────────────────────────── */
// export const exportPayrollXlsx: (req: AuthRequiredRequest, res: Response) => Promise<void> =
//   async (req, res) => {
//     const shopId = Number(req.params.shopId);
//     if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

//     const parsed = q.safeParse(req.query);
//     if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
//     const { year, month } = parsed.data;

//     const includeSensitive = String(req.query.includeSensitive ?? '') === '1';

//     const shop = await prisma.shop.findUnique({
//       where: { id: shopId },
//       select: { payday: true, name: true }
//     });
//     if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
//     const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

//     const cycle = kstCycle(year, month, startDay);

//     // 사이클 내 확정된 HOURLY 시프트
//     const shifts = await prisma.workShift.findMany({
//       where: {
//         shopId,
//         status: 'COMPLETED',
//         finalPayAmount: { not: null },
//         employee: { payUnit: 'HOURLY' },
//         startAt: { gte: cycle.start, lte: cycle.end },
//       },
//       select: { employeeId: true, finalPayAmount: true, workedMinutes: true }
//     });

//     const byEmp = new Map<number, { minutes: number; gross: number }>();
//     for (const s of shifts) {
//       const cur = byEmp.get(s.employeeId) ?? { minutes: 0, gross: 0 };
//       cur.minutes += (s.workedMinutes ?? 0);
//       cur.gross   += (s.finalPayAmount ?? 0);
//       byEmp.set(s.employeeId, cur);
//     }

//     const employeeIds = Array.from(byEmp.keys());
//     if (employeeIds.length === 0) {
//       const wb = new ExcelJS.Workbook();
//       const ws = wb.addWorksheet('급여');
//       const headers = ['순번','직원명','은행','계좌번호','기본 시급','총 근무 시간(시간)','기본','소득세','지방소득세','기타세금','지급해야할 돈','세금 공제','최종 지급액','주민번호(마스킹)'];
//       ws.addRow(headers);
//       ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
//       await wb.xlsx.write(res);
//       res.end();
//       return;
//     }

//     const employees = await prisma.employeeMember.findMany({
//       where: { shopId, id: { in: employeeIds } },
//       select: {
//         id: true, name: true, pay: true, payUnit: true,
//         bankName: true, bankAccount: true,
//         nationalIdMasked: true,
//         nationalIdEnc: includeSensitive ? true : false,
//       }
//     });

//     const wb = new ExcelJS.Workbook();
//     const ws = wb.addWorksheet('급여');

//     const headers = [
//       '순번','직원명','은행','계좌번호','기본 시급','총 근무 시간(시간)',
//       '기본','소득세','지방소득세','기타세금','지급해야할 돈','세금 공제','최종 지급액',
//       '주민번호(마스킹)'
//     ];
//     if (includeSensitive) headers.push('주민번호(평문)');
//     ws.addRow(headers);

//     let rowNo = 0;
//     let totalGrossWon = 0;
//     let totalDeductionsWon = 0;
//     let totalNetWon = 0;

//     for (const emp of employees) {
//       const stats = byEmp.get(emp.id) ?? { minutes: 0, gross: 0 };
//       if (!stats.minutes && !stats.gross) continue;

//       const hoursLabel = fmtKoreanDuration(stats.minutes);
//       const grossWon = Math.trunc(stats.gross);
//       const t = calcTaxes(stats.gross);
//       const incomeTaxWon = Math.trunc(t.incomeTax);
//       const localTaxWon  = Math.trunc(t.localTax);
//       const otherTaxWon  = Math.trunc(t.otherTax);
//       const deductionsWon = incomeTaxWon + localTaxWon + otherTaxWon;
//       const netWon = grossWon - deductionsWon;

//       totalGrossWon      += grossWon;
//       totalDeductionsWon += deductionsWon;
//       totalNetWon        += netWon;

//       const nidMasked = (emp as any).nationalIdMasked ?? '';
//       const nidPlain  = includeSensitive && (emp as any).nationalIdEnc
//         ? (decryptNationalId((emp as any).nationalIdEnc) ?? '')
//         : '';

//       ws.addRow([
//         ++rowNo,
//         emp.name,
//         emp.bankName ?? '',
//         emp.bankAccount ?? '',
//         emp.payUnit === 'HOURLY' ? toNum(emp.pay) : null,
//         hoursLabel,
//         grossWon,
//         incomeTaxWon,
//         localTaxWon,
//         otherTaxWon,
//         grossWon,
//         deductionsWon,
//         netWon,
//         nidMasked,
//         ...(includeSensitive ? [nidPlain] : [])
//       ]);
//     }

//     // 스타일 & 너비
//     const rightAlignCols = [1,5,7,8,9,10,11,12,13];
//     const moneyCols      = [5,7,8,9,10,11,12,13];
//     const COLORS = {
//       headerBg: 'FF1F2937',
//       headerFg: 'FFFFFFFF',
//       zebra1:   'FFFFFFFF',
//       zebra2:   'FFF3F4F6',
//       border:   'FFE5E7EB',
//       bodyText: 'FF111827',
//       totalBg:  'FFFEF3C7',
//     };

//     ws.columns = [
//       { width: 6 }, { width: 16 }, { width: 10 }, { width: 18 },
//       { width: 12 }, { width: 16 }, { width: 14 }, { width: 12 },
//       { width: 12 }, { width: 12 }, { width: 16 }, { width: 12 },
//       { width: 16 }, { width: 22 }, ...(includeSensitive ? [{ width: 22 }] : [])
//     ];
//     ws.views = [{ state: 'frozen', ySplit: 1 }];
//     ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

//     const header = ws.getRow(1);
//     header.height = 24;
//     header.eachCell((cell) => {
//       cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
//       cell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.headerFg } };
//       cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
//       cell.border = {
//         top: { style: 'thin', color: { argb: COLORS.border } },
//         left:{ style: 'thin', color: { argb: COLORS.border } },
//         bottom:{ style: 'thin', color: { argb: COLORS.border } },
//         right:{ style: 'thin', color: { argb: COLORS.border } },
//       };
//     });

//     for (let r = 2; r <= ws.rowCount; r++) {
//       const row = ws.getRow(r);
//       const zebra = r % 2 === 0 ? COLORS.zebra2 : COLORS.zebra1;

//       row.eachCell((cell, colNumber) => {
//         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
//         cell.font = { name: 'Malgun Gothic', size: 11, color: { argb: COLORS.bodyText } };
//         cell.alignment = {
//           vertical: 'middle',
//           horizontal: rightAlignCols.includes(colNumber)
//             ? 'right'
//             : (colNumber === 1 ? 'center' : 'left'),
//         };
//         cell.border = {
//           top: { style: 'thin', color: { argb: COLORS.border } },
//           left:{ style: 'thin', color: { argb: COLORS.border } },
//           bottom:{ style: 'thin', color: { argb: COLORS.border } },
//           right:{ style: 'thin', color: { argb: COLORS.border } },
//         };
//       });

//       // 최종 지급액(13열) 강조
//       const netCell = row.getCell(13);
//       netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
//       netCell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.bodyText } };
//     }

//     for (let r = 2; r <= ws.rowCount; r++) {
//       for (const c of moneyCols) ws.getRow(r).getCell(c).numFmt = '#,##0';
//       ws.getRow(r).getCell(1).numFmt = '#,##0';
//     }

//     if (rowNo > 0) {
//       ws.addRow(['', '합계', '', '', '', '', '', '', '', '', totalGrossWon, totalDeductionsWon, totalNetWon]);
//       const lastRowIdx = ws.rowCount;
//       const tr = ws.getRow(lastRowIdx);
//       tr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
//       tr.eachCell((cell) => {
//         cell.font = { name: 'Malgun Gothic', size: 12, bold: true, color: { argb: COLORS.bodyText } };
//         cell.border = {
//           top: { style: 'medium', color: { argb: COLORS.border } },
//           left:{ style: 'thin', color: { argb: COLORS.border } },
//           bottom:{ style: 'thin', color: { argb: COLORS.border } },
//           right:{ style: 'thin', color: { argb: COLORS.border } },
//         };
//       });
//       for (const c of [11, 12, 13]) {
//         tr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
//       }
//     }

//     // 파일명
//     const kstStart = toKst(cycle.start);
//     const mm = String(kstStart.getUTCMonth() + 1).padStart(2, '0');
//     const filename = `정산_${shop.name ?? 'shop'}_${year}-${mm}.xlsx`;

//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
//     res.setHeader('Cache-Control', 'no-store, max-age=0');
//     res.setHeader('Pragma', 'no-cache');
//     res.setHeader('X-Content-Type-Options', 'nosniff');
//     await wb.xlsx.write(res);
//     res.end();
//   };

// /* ───────────────────────────────── 요약 ───────────────────────────────── */
// export const getSettlementSummary = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
//   const shopId = Number(req.params.shopId);
//   if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

//   const parsed = q.safeParse(req.query);
//   if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }

//   const now = toKst(new Date());
//   const year  = parsed.data.year  ?? now.getUTCFullYear();
//   const month = parsed.data.month ?? (now.getUTCMonth() + 1);

//   const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
//   if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
//   const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

//   const cycle = kstCycle(year, month, startDay);
//   const calThis = kstCalendarMonth(year, month);
//   const prevMonth = month === 1 ? 12 : month - 1;
//   const prevYear  = month === 1 ? year - 1 : year;
//   const calPrev = kstCalendarMonth(prevYear, prevMonth);

//   const cycleShifts = await prisma.workShift.findMany({
//     where: {
//       shopId,
//       status: 'COMPLETED',
//       finalPayAmount: { not: null },
//       employee: { payUnit: 'HOURLY' },
//       startAt: { gte: cycle.start, lte: cycle.end },
//     },
//     select: { employeeId: true, finalPayAmount: true, settlementId: true }
//   });

//   const empMap = new Map<number, { grossTotal: number; hasUnsettled: boolean }>();
//   for (const r of cycleShifts) {
//     const cur = empMap.get(r.employeeId) ?? { grossTotal: 0, hasUnsettled: false };
//     cur.grossTotal += r.finalPayAmount ?? 0;
//     if (!r.settlementId) cur.hasUnsettled = true;
//     empMap.set(r.employeeId, cur);
//   }

//   const employeeCount = empMap.size;
//   let paidCount = 0, unpaidCount = 0;

//   for (const [, v] of empMap) {
//     if (v.hasUnsettled) unpaidCount++;
//   }
//   paidCount = employeeCount - unpaidCount;

//   const monthShifts = await prisma.workShift.findMany({
//     where: {
//       shopId,
//       status: 'COMPLETED',
//       employee: { payUnit: 'HOURLY' },
//       startAt: { gte: calThis.start, lte: calThis.end },
//     },
//     select: { workedMinutes: true }
//   });
//   const totalMinutesThisMonth = monthShifts.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

//   const prevPaidShifts = await prisma.workShift.findMany({
//     where: {
//       shopId,
//       status: 'COMPLETED',
//       finalPayAmount: { not: null },
//       settlementId: { not: null },
//       employee: { payUnit: 'HOURLY' },
//       startAt: { gte: calPrev.start, lte: calPrev.end },
//     },
//     select: { finalPayAmount: true }
//   });
//   const spentLastMonth = prevPaidShifts.reduce((s, r) => s + (r.finalPayAmount ?? 0), 0);

//   const cycleLabel = fmtRangeLabel(cycle.start, cycle.end);
//   const calendarLabel = fmtRangeLabel(calThis.start, calThis.end);

//   res.json({
//     year, month,
//     cycle: {
//       start: cycle.start,
//       end: cycle.end,
//       startDay,
//       label: cycleLabel,
//     },
//     summary: {
//       settlementTargetAmount: Math.trunc(
//         cycleShifts.filter(s => !s.settlementId).reduce((sum, s) => sum + (s.finalPayAmount ?? 0), 0)
//       ),
//       unpaidEmployees: unpaidCount,
//       paidEmployees: paidCount,
//       employeesInCycle: employeeCount,
//     },
//     calendarMonth: {
//       rangeLabel: calendarLabel,
//       totalWorkedMinutes: totalMinutesThisMonth,
//       totalWorkedLabel: fmtHourMinKo(totalMinutesThisMonth),
//       spentLastMonth: Math.trunc(spentLastMonth),
//     }
//   });
// };

// /* ───────────────────────────────── 개별 정산 ───────────────────────────────── */
// export const settleEmployeeCycle: (req: AuthRequiredRequest, res: Response) => Promise<void> =
//   async (req, res) => {
//     const shopId = Number(req.params.shopId);
//     const employeeId = Number(req.params.employeeId);

//     if (req.user.shopId !== shopId) {
//       res.status(403).json({ error: '다른 가게는 처리할 수 없습니다.' });
//       return;
//     }

//     const settleEmployeeCycleBody = z.object({
//       year: z.coerce.number().int().min(2000).max(2100),
//       month: z.coerce.number().int().min(1).max(12),
//       cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
//     });
//     const parsedB = settleEmployeeCycleBody.safeParse(req.body ?? {});
//     if (!parsedB.success) {
//       res.status(400).json({ error: 'Invalid payload', detail: parsedB.error.flatten() });
//       return;
//     }
//     const { year, month, cycleStartDay } = parsedB.data;

//     const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
//     if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
//     const startDay = cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);
//     const cycle = kstCycle(year, month, startDay);

//     // 같은 가게 소속인지
//     const emp = await prisma.employeeMember.findFirst({
//       where: { id: employeeId, shopId },
//       select: { id: true, name: true, pay: true, payUnit: true }
//     });
//     if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }

//     const shifts = await prisma.workShift.findMany({
//       where: {
//         shopId,
//         employeeId,
//         status: 'COMPLETED',
//         startAt: { gte: cycle.start, lte: cycle.end },
//         settlementId: null,
//       },
//       select: { id: true, workedMinutes: true, finalPayAmount: true }
//     });

//     const workedMinutesDelta = shifts.reduce((s, x) => s + (x.workedMinutes ?? 0), 0);

//     let basePayDelta = 0;
//     let totalPayDelta = 0;

//     if (emp.payUnit === 'HOURLY') {
//       totalPayDelta = shifts.reduce((s, x) => s + (x.finalPayAmount ?? 0), 0);
//       basePayDelta  = totalPayDelta;
//       if (totalPayDelta === 0) {
//         res.status(400).json({ error: '정산할 미정산 시프트가 없습니다.' }); return;
//       }
//     } else {
//       res.status(400).json({error:'월급제 가불은 불가능합니다.'}); return;
//     }

//     const shouldWithhold = emp.payUnit === 'HOURLY';

//     const result = await prisma.$transaction(async (tx) => {
//       const existed = await tx.payrollSettlement.findFirst({
//         where: { employeeId, cycleStart: cycle.start, cycleEnd: cycle.end }
//       });

//       let settlementId: number;
//       let updated: any;

//       if (existed) {
//         const newWorked = (existed.workedMinutes ?? 0) + workedMinutesDelta;
//         const newBase   = (existed.basePay ?? 0)       + basePayDelta;
//         const newTotal  = (existed.totalPay ?? 0)      + totalPayDelta;
//         let incomeTax = 0, localIncomeTax = 0, otherTax = 0, netPay = newTotal;
//         if (shouldWithhold) {
//           const t = calcTaxesTruncate(newTotal);
//           incomeTax = t.incomeTax;
//           localIncomeTax = t.localIncomeTax;
//           otherTax = floorWon(newTotal * OTHER_TAX_RATE);
//           netPay = t.net;
//         }
//         updated = await tx.payrollSettlement.update({
//           where: { id: existed.id },
//           data: {
//             workedMinutes: newWorked,
//             basePay: newBase,
//             totalPay: newTotal,
//             incomeTax, localIncomeTax, otherTax, netPay,
//             processedBy: req.user.userId ?? existed.processedBy ?? null,
//             settledAt: new Date(),
//           },
//           select: { id: true }
//         });
//         settlementId = updated.id;
//       } else {
//         let incomeTax = 0, localIncomeTax = 0, otherTax = 0, netPay = totalPayDelta;
//         if (shouldWithhold) {
//           const t = calcTaxesTruncate(totalPayDelta);
//           incomeTax = t.incomeTax;
//           localIncomeTax = t.localIncomeTax;
//           otherTax = floorWon(totalPayDelta * OTHER_TAX_RATE);
//           netPay = t.net;
//         }
//         updated = await tx.payrollSettlement.create({
//           data: {
//             shopId, employeeId,
//             cycleStart: cycle.start, cycleEnd: cycle.end,
//             workedMinutes: workedMinutesDelta,
//             basePay: basePayDelta,
//             totalPay: totalPayDelta,
//             incomeTax, localIncomeTax, otherTax, netPay,
//             processedBy: req.user.userId ?? null,
//             settledAt: new Date(),
//           },
//           select: { id: true }
//         });
//         settlementId = updated.id;
//       }

//       const { count: appliedShiftCount } = await tx.workShift.updateMany({
//         where: {
//           shopId, employeeId,
//           status: 'COMPLETED',
//           startAt: { gte: cycle.start, lte: cycle.end },
//           settlementId: null,
//         },
//         data: { settlementId, isSettled: true }
//       });

//       return { settlement: updated, appliedShiftCount };
//     });

//     res.status(201).json({
//       ok: true,
//       cycle: { start: cycle.start, end: cycle.end, startDay },
//       employee: { id: emp.id, name: emp.name, payUnit: emp.payUnit },
//       appliedShiftCount: result.appliedShiftCount,
//       settlement: result.settlement
//     });
//   };

// /* ───────────────────────────────── 전체 정산 ───────────────────────────────── */
// const settleEmployeeCycleBody = z.object({
//   year: z.coerce.number().int().min(2000).max(2100),
//   month: z.coerce.number().int().min(1).max(12),
//   cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
// });

// export const settleAllEmployeesCycle: (req: AuthRequiredRequest, res: Response) => Promise<void> =
//   async (req, res) => {
//     const shopId = Number(req.params.shopId);

//     if (req.user.shopId !== shopId) {
//       res.status(403).json({ error: '다른 가게는 처리할 수 없습니다.' });
//       return;
//     }

//     const parsedB = settleEmployeeCycleBody.safeParse(req.body ?? {});
//     if (!parsedB.success) {
//       res.status(400).json({ error: 'Invalid payload', detail: parsedB.error.flatten() });
//       return;
//     }
//     const { year, month, cycleStartDay } = parsedB.data;

//     const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
//     if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }

//     const startDay = cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);
//     const cycle = kstCycle(year, month, startDay);

//     const employees = await prisma.employeeMember.findMany({
//       where: { shopId },
//       select: { id: true, name: true, pay: true, payUnit: true }
//     });

//     const created: Array<{
//       employeeId: number;
//       name: string;
//       payUnit: 'HOURLY' | 'MONTHLY' | null;
//       workedMinutes: number;
//       basePay: number;
//       totalPay: number;
//       incomeTax: number;
//       localIncomeTax: number;
//       otherTax: number;
//       netPay: number;
//       settlementId: number;
//     }> = [];

//     const skipped: Array<{
//       employeeId: number;
//       name: string;
//       reason: 'ALREADY_SETTLED' | 'NO_CONFIRMED_SHIFTS' | 'NO_PAY' | 'NO_PAYUNIT' | 'ERROR';
//       details?: string;
//       settlementId?: number;
//     }> = [];

//     for (const emp of employees) {
//       try {
//         const existed = await prisma.payrollSettlement.findFirst({
//           where: { employeeId: emp.id, cycleStart: cycle.start, cycleEnd: cycle.end },
//           select: { id: true }
//         });
//         if (existed) {
//           skipped.push({ employeeId: emp.id, name: emp.name, reason: 'ALREADY_SETTLED', settlementId: existed.id });
//           continue;
//         }

//         if (!emp.payUnit) {
//           skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_PAYUNIT' });
//           continue;
//         }

//         const shifts = await prisma.workShift.findMany({
//           where: {
//             shopId,
//             employeeId: emp.id,
//             status: 'COMPLETED',
//             startAt: { gte: cycle.start, lte: cycle.end },
//             settlementId: null
//           },
//           select: { id: true, workedMinutes: true, finalPayAmount: true }
//         });

//         const workedMinutes = shifts.reduce((s, x) => s + (x.workedMinutes ?? 0), 0);

//         let basePay = 0;
//         let totalPay = 0;

//         if (emp.payUnit === 'HOURLY') {
//           totalPay = shifts.reduce((s, x) => s + (x.finalPayAmount ?? 0), 0);
//           basePay = totalPay;
//           if (totalPay === 0) {
//             skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_CONFIRMED_SHIFTS' });
//             continue;
//           }
//         } else {
//           const monthly = toNum(emp.pay);
//           if (!monthly || monthly <= 0) {
//             skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_PAY' });
//             continue;
//           }
//           basePay = monthly;
//           totalPay = basePay;
//         }

//         let incomeTax = 0, localIncomeTax = 0, otherTax = 0, netPay = totalPay;
//         const shouldWithhold = emp.payUnit === 'HOURLY';
//         if (shouldWithhold) {
//           const t = calcTaxesTruncate(totalPay);
//           incomeTax = t.incomeTax;
//           localIncomeTax = t.localIncomeTax;
//           otherTax = floorWon(totalPay * OTHER_TAX_RATE);
//           netPay = t.net;
//         }

//         const result = await prisma.$transaction(async (tx) => {
//           const settlement = await tx.payrollSettlement.create({
//             data: {
//               shopId,
//               employeeId: emp.id,
//               cycleStart: cycle.start,
//               cycleEnd: cycle.end,
//               workedMinutes,
//               basePay,
//               totalPay,
//               incomeTax,
//               localIncomeTax,
//               otherTax,
//               netPay,
//               processedBy: req.user.userId ?? null,
//               settledAt: new Date()
//             },
//             select: { id: true }
//           });

//           await tx.workShift.updateMany({
//             where: {
//               shopId,
//               employeeId: emp.id,
//               status: 'COMPLETED',
//               startAt: { gte: cycle.start, lte: cycle.end },
//               settlementId: null
//             },
//             data: { settlementId: settlement.id, isSettled: true }
//           });

//           return settlement.id;
//         });

//         created.push({
//           employeeId: emp.id,
//           name: emp.name,
//           payUnit: emp.payUnit,
//           workedMinutes,
//           basePay,
//           totalPay,
//           incomeTax,
//           localIncomeTax,
//           otherTax,
//           netPay,
//           settlementId: result
//         });
//       } catch (e: any) {
//         skipped.push({ employeeId: emp.id, name: emp.name, reason: 'ERROR', details: e?.message ?? String(e) });
//       }
//     }

//     res.status(201).json({
//       ok: true,
//       cycle: { start: cycle.start, end: cycle.end, startDay },
//       createdCount: created.length,
//       skippedCount: skipped.length,
//       created,
//       skipped
//     });
//   };

// /* ───────────────────────────────── 개요(금액 비교) ───────────────────────────────── */
// export const payrollOverview: (req: AuthRequiredRequest, res: Response) => Promise<void> =
//   async (req, res) => {
//     const shopId = Number(req.params.shopId);
//     if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

//     const parsed = q.safeParse(req.query);
//     if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
//     const { year, month } = parsed.data;

//     const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
//     if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
//     const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

//     const curr = kstCycle(year, month, startDay);
//     const prevMonth = month === 1 ? 12 : month - 1;
//     const prevYear  = month === 1 ? year - 1 : year;
//     const prev = kstCycle(prevYear, prevMonth, startDay);

//     const eligibleEmployees = await prisma.employeeMember.count({
//       where: { shopId, pay: { gt: 0 } }
//     });

//     async function confirmedHourlyIn(range: { start: Date; end: Date }) {
//       const rows = await prisma.workShift.findMany({
//         where: {
//           shopId,
//           status: 'COMPLETED',
//           finalPayAmount: { not: null },
//           employee: { payUnit: 'HOURLY' },
//           startAt: { gte: range.start, lte: range.end },
//         },
//         select: { finalPayAmount: true },
//       });
//       const amount = rows.reduce((sum, r) => sum + (r.finalPayAmount ?? 0), 0);
//       return { amount, shiftCount: rows.length };
//     }

//     const curHourly  = await confirmedHourlyIn(curr);
//     const prevHourly = await confirmedHourlyIn(prev);

//     const fixed = { amount: 0 };
//     const fixedWht = applyFreelancerWithholding(fixed.amount);

//     const hourlyWhtCur  = applyFreelancerWithholding(curHourly.amount);
//     const hourlyWhtPrev = applyFreelancerWithholding(prevHourly.amount);

//     const expectedPayout     = fixed.amount + curHourly.amount;
//     const prevExpectedPayout = fixed.amount + prevHourly.amount;
//     const deltaFromPrev      = expectedPayout - prevExpectedPayout;

//     const totalWhtCur  = applyFreelancerWithholding(expectedPayout);
//     const totalWhtPrev = applyFreelancerWithholding(prevExpectedPayout);

//     const kstS = toKst(curr.start), kstE = toKst(curr.end);
//     const label = `${kstS.getUTCMonth()+1}월 ${kstS.getUTCDate()}일 ~ ${kstE.getUTCMonth()+1}월 ${kstE.getUTCDate()}일`;

//     res.json({
//       year, month,
//       cycle: { start: curr.start, end: curr.end, startDay, label },

//       fixed: {
//         amount: fixed.amount,
//         withholding3_3: fixedWht.withheld,
//         netAmount: fixedWht.net,
//       },

//       hourly: {
//         amount: curHourly.amount,
//         shiftCount: curHourly.shiftCount,
//         withholding3_3: hourlyWhtCur.withheld,
//         netAmount: hourlyWhtCur.net,
//       },

//       totals: {
//         expectedPayout,
//         previousExpectedPayout: prevExpectedPayout,
//         deltaFromPrev,
//         expectedPayoutNet: totalWhtCur.net,
//         previousExpectedPayoutNet: totalWhtPrev.net,
//         deltaFromPrevNet: totalWhtCur.net - totalWhtPrev.net,
//         withholding3_3: {
//           current: totalWhtCur.withheld,
//           previous: totalWhtPrev.withheld,
//           rate: Number((INCOME_TAX_RATE * (1 + LOCAL_TAX_ON_INCOME_RATE)).toFixed(5)),
//         },
//       },

//       meta: { eligibleEmployees },
//     });
//   };

// /* ───────────────────────────────── 목록 ───────────────────────────────── */
// export const getEmployeeStatusList = async (req: AuthRequiredRequest, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

//   const { year, month, cycleStartDay, q, position, settlement, sort, order } = listQuery.parse(req.query);
//   const startDay = cycleStartDay ?? Number(process.env.CYCLE_START_DAY ?? '1');
//   const cycle = buildCycle(year, month, startDay);

//   const employees = await prisma.employeeMember.findMany({
//     where: {
//       shopId,
//       ...(q ? { name: { contains: q } } : {}),
//       ...(position ? { position } : {}),
//     },
//     select: { id: true, name: true, position: true, pay: true, payUnit: true, personalColor: true }
//   });

//   const empIds = employees.map(e => e.id);
//   if (empIds.length === 0) {
//     res.json({
//       year, month,
//       cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
//       summary: { employeeCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0 },
//       items: []
//     });
//     return;
//   }

//   const shiftAgg = await prisma.workShift.groupBy({
//     by: ['employeeId'],
//     where: {
//       shopId,
//       employeeId: { in: empIds },
//       status: 'COMPLETED' as any,
//       startAt: { gte: cycle.start },
//       endAt:   { lte: cycle.end },
//       OR: [{ isSettled: false }, { settlementId: null }], // 미정산 판단
//     },
//     _sum: { workedMinutes: true, finalPayAmount: true }
//   });

//   const aggByEmp = new Map<number, { workedMinutes: number; finalPayAmount: number }>();
//   for (const g of shiftAgg) {
//     aggByEmp.set(g.employeeId, {
//       workedMinutes: g._sum.workedMinutes ?? 0,
//       finalPayAmount: g._sum.finalPayAmount ?? 0
//     });
//   }

//   const settlements = await prisma.payrollSettlement.findMany({
//     where: { shopId, cycleStart: cycle.start, cycleEnd: cycle.end, employeeId: { in: empIds } },
//     select: { id: true, employeeId: true, settledAt: true, totalPay: true }
//   });
//   const paidSet = new Map<number, { id: number; settledAt: Date | null }>();
//   for (const s of settlements) paidSet.set(s.employeeId, { id: s.id, settledAt: s.settledAt ?? null });

//   const settledShifts = await prisma.workShift.findMany({
//     where: {
//       shopId,
//       employeeId: { in: empIds },
//       status: 'COMPLETED',
//       startAt: { gte: cycle.start, lte: cycle.end },
//       settlementId: { not: null },
//     },
//     select: { employeeId: true, finalPayAmount: true }
//   });
//   const settledAmtByEmp = new Map<number, number>();
//   for (const s of settledShifts) {
//     settledAmtByEmp.set(s.employeeId, (settledAmtByEmp.get(s.employeeId) ?? 0) + (s.finalPayAmount ?? 0));
//   }

//   const items = employees.map(e => {
//     const agg = aggByEmp.get(e.id) ?? { workedMinutes: 0, finalPayAmount: 0 };
//     const isHourly = e.payUnit === 'HOURLY';
//     const outstandingAmount = isHourly
//       ? (agg.finalPayAmount || Math.round((agg.workedMinutes / 60) * toNum(e.pay)))
//       : toNum(e.pay);

//     const settledAmount = settledAmtByEmp.get(e.id) ?? 0;

//     const status =
//       isHourly
//         ? (outstandingAmount <= 0 ? 'PAID' : 'PENDING')
//         : (paidSet.has(e.id) ? 'PAID' : (outstandingAmount > 0 ? 'PENDING' : 'PAID'));
//     return {
//       employeeId: e.id,
//       personalColor: e.personalColor,
//       name: e.name,
//       position: e.position ?? '',
//       payUnit: e.payUnit,
//       pay: toNum(e.pay),
//       amount: outstandingAmount,
//       settledAmount,
//       workedMinutes: agg.workedMinutes,
//       daysWorked: 0,
//       settlement: {
//         status,
//         settlementId: paidSet.get(e.id)?.id ?? null,
//         settledAt: paidSet.get(e.id)?.settledAt ?? null
//       }
//     };
//   });

//   const nonZero = items.filter(i => (i.amount ?? 0) > 0);
//   const filtered = settlement ? nonZero.filter(i => i.settlement.status === settlement) : nonZero;

//   const dir = order === 'desc' ? -1 : 1;
//   filtered.sort((a, b) => {
//     if (sort === 'amount') return (a.amount - b.amount) * dir;
//     if (sort === 'workedMinutes') return (a.workedMinutes - b.workedMinutes) * dir;
//     return a.name.localeCompare(b.name) * dir;
//   });

//   const summary = {
//     employeeCount: filtered.length,
//     paidCount: filtered.filter(i => i.settlement.status === 'PAID').length,
//     pendingCount: filtered.filter(i => i.settlement.status === 'PENDING').length,
//     totalAmount: filtered.reduce((s, i) => s + i.amount, 0)
//   };

//   res.json({
//     year, month,
//     cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
//     summary,
//     items: filtered
//   });
// };

// /* ───────────────────────────────── 상세 ───────────────────────────────── */
// export const getEmployeeStatusDetail = async (req: AuthRequiredRequest, res: Response) => {
//   const shopId = Number(req.params.shopId);
//   const employeeId = Number(req.params.employeeId);
//   if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

//   const { year, month, cycleStartDay } = detailQuery.parse(req.query);
//   const startDay = cycleStartDay ?? Number(process.env.CYCLE_START_DAY ?? '1');
//   const cycle = buildCycle(year, month, startDay);

//   const emp = await prisma.employeeMember.findFirst({
//     where: { id: employeeId, shopId },
//     select: { id: true, name: true, position: true, pay: true, payUnit: true, bankAccount: true, bankName: true }
//   });
//   if (!emp) { res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' }); return; }

//   const settlement = await prisma.payrollSettlement.findFirst({
//     where: { shopId, employeeId, cycleStart: cycle.start, cycleEnd: cycle.end },
//     select: { id: true, settledAt: true }
//   });

//   const shifts = await prisma.workShift.findMany({
//     where: {
//       shopId, employeeId,
//       startAt: { lt: cycle.end },
//       endAt:   { gt: cycle.start }
//     },
//     orderBy: { startAt: 'asc' },
//     select: {
//       id: true, startAt: true, endAt: true, status: true,
//       actualInAt: true, actualOutAt: true,
//       workedMinutes: true,
//       finalPayAmount: true, settlementId: true, isSettled: true
//     }
//   });

//   const settledShifts = shifts.filter(r => r.settlementId != null || r.isSettled === true);
//   const outstandingShifts = shifts.filter(r => r.settlementId == null && r.isSettled !== true);

//   const workedMinutes = shifts.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);
//   const daysWorked = uniqKstDates(shifts.map(s => s.startAt));

//   const settledAmount = settledShifts.reduce((s, r) => s + (r.finalPayAmount ?? 0), 0);

//   const outstandingWorkedMinutes = outstandingShifts.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);
//   const outstandingShiftAmount = outstandingShifts.reduce((s, r) => s + (r.finalPayAmount ?? 0), 0);
//   const outstandingAmountHourly =
//     outstandingShiftAmount || Math.round((outstandingWorkedMinutes / 60) * toNum(emp.pay));

//   const amount =
//     emp.payUnit === 'HOURLY'
//       ? outstandingAmountHourly
//       : toNum(emp.pay);

//   const logs = shifts.map(r => {
//     const k = toKst(r.startAt);
//     const date = `${k.getUTCFullYear()}-${String(k.getUTCMonth()+1).padStart(2,'0')}-${String(k.getUTCDate()).padStart(2,'0')}`;
//     return {
//       id: r.id,
//       date,
//       plannedStart: r.startAt,
//       plannedEnd: r.endAt,
//       actualInAt: r.actualInAt,
//       actualOutAt: r.actualOutAt,
//       status: r.status as any,
//       workedMinutes: r.workedMinutes ?? null,
//       finalPayAmount: r.finalPayAmount ?? null,
//       settlementId: r.settlementId ?? null
//     };
//   });

//   res.json({
//     year, month,
//     cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
//     settlement: {
//       status: emp.payUnit === 'HOURLY'
//         ? (amount <= 0 ? 'PAID' : 'PENDING')
//         : (settlement ? 'PAID' : 'PENDING'),
//       settlementId: settlement?.id ?? null,
//       settledAt: settlement?.settledAt ?? null
//     },
//     employee: {
//       id: emp.id, name: emp.name, position: emp.position ?? '',
//       payUnit: emp.payUnit, pay: toNum(emp.pay),
//       accountNumber: emp.bankAccount, // 응답 호환용
//       bank: emp.bankName
//     },
//     workedMinutes,
//     daysWorked,
//     amount,
//     settledAmount,
//     outstandingAmount: amount,
//     logs
//   });
// };
