// controllers/payrollOverviewController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';
import ExcelJS from 'exceljs';
import type { Position } from '@prisma/client';
// KST helpers
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);

// 사이클 계산
function kstCycle(
  year: number,
  month: number,
  startDay: number
): { start: Date; end: Date; nextStart: Date } {
  const start = fromKstParts(year, month - 1, startDay, 0, 0, 0, 0);
  const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = fromKstParts(nm.y, nm.m - 1, startDay, 0, 0, 0, 0);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end, nextStart };
}
const q = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
});
/** 사이클(startDay 기준): [start, end] (end는 inclusive 23:59:59.999) */
function buildCycle(year: number, month: number, startDay: number) {
  // month: 1~12
  const kstStart = fromKstParts(year, month - 1, startDay, 0, 0, 0, 0);
  // next month + same startDay
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const kstNext   = fromKstParts(nextYear, nextMonth - 1, startDay, 0, 0, 0, 0);
  const start = kstStart;                       // UTC
  const end   = new Date(kstNext.getTime() - 1);// inclusive
  const label = `${toKst(start).getUTCMonth()+1}월 ${toKst(start).getUTCDate()}일 ~ ${toKst(end).getUTCMonth()+1}월 ${toKst(end).getUTCDate()}일`;
  return { start, end, nextStart: kstNext, label, startDay };
}

const listQuery = z.object({
  year:  z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
  q: z.string().optional(),
  position: z.enum(['MANAGER','STAFF','PART_TIME','OWNER']).optional(),
  settlement: z.enum(['PENDING','PAID']).optional(),
  sort: z.enum(['amount','name','workedMinutes']).optional().default('name'),
  order: z.enum(['asc','desc']).optional().default('asc'),
});

const detailQuery = z.object({
  year:  z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
});

/* ───────── helpers ───────── */
function uniqKstDates(dates: Date[]): number {
  const s = new Set<string>();
  for (const d of dates) {
    const k = toKst(d);
    s.add(`${k.getUTCFullYear()}-${k.getUTCMonth()+1}-${k.getUTCDate()}`);
  }
  return s.size;
}
// 소수점 절사(원 단위) 규칙: 각 세목을 개별 절사 → 합계
const floorWon = (n: number) => Math.floor(n);

const calcTaxesTruncate = (gross: number) => {
  const incomeTax = floorWon(gross * INCOME_TAX_RATE);
  const localIncomeTax = floorWon(incomeTax * LOCAL_TAX_ON_INCOME_RATE);
  const otherTax = floorWon(gross * OTHER_TAX_RATE);
  const deductions = incomeTax + localIncomeTax + otherTax;
  const net = gross - deductions;
  return { incomeTax, localIncomeTax, otherTax, net };
};
const bodySchema = z.object({
  note: z.string().max(500).optional(),
  // 기본 정책: HOURLY만 3.3% 적용. 필요시 강제 적용 플래그 제공.
  forceWithholding: z.coerce.boolean().optional(),
});
const fmtDateDot = (d: Date) => {
  const k = toKst(d);
  return `${k.getUTCFullYear()}. ${k.getUTCMonth() + 1}. ${k.getUTCDate()}.`;
};
const fmtRangeLabel = (s: Date, e: Date) => {
  const ks = toKst(s), ke = toKst(e);
  return `${ks.getUTCMonth() + 1}월 ${ks.getUTCDate()}일 ~ ${ke.getUTCMonth() + 1}월 ${ke.getUTCDate()}일`;
};
const fmtHourMinKo = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

function kstCalendarMonth(year: number, month: number) {
  const start = fromKstParts(year, month - 1, 1, 0, 0, 0, 0);
  const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = fromKstParts(nm.y, nm.m - 1, 1, 0, 0, 0, 0);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
}
    const fmtKoreanDuration = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}시간 ${m}분`;
    };
// ✅ 프리랜서 원천징수(소득세 3% + 지방소득세=소득세의 10%) 유틸
const INCOME_TAX_RATE = Number(process.env.PAYROLL_INCOME_TAX_RATE ?? '0.03');            // 3%
const LOCAL_TAX_ON_INCOME_RATE = Number(process.env.PAYROLL_LOCAL_TAX_ON_INCOME_RATE ?? '0.1'); // 소득세의 10%
const OTHER_TAX_RATE  = Number(process.env.PAYROLL_OTHER_TAX_RATE  ?? '0'); // 추후 필요시

const calcTaxes = (gross: number) => {
  const incomeTax = gross * INCOME_TAX_RATE;
  const localTax  = incomeTax * LOCAL_TAX_ON_INCOME_RATE;
  const otherTax  = gross * OTHER_TAX_RATE;
  const deductions = incomeTax + localTax + otherTax;
  const net = gross - deductions;
  return { incomeTax, localTax, otherTax, deductions, net };
};
const applyFreelancerWithholding = (gross: number) => {
  const incomeTax = gross * INCOME_TAX_RATE;
  const localIncomeTax = incomeTax * LOCAL_TAX_ON_INCOME_RATE; // ≒ 0.3% of gross
  const withheld = incomeTax + localIncomeTax;
  return { incomeTax, localIncomeTax, withheld, net: gross - withheld };
};

export const exportPayrollXlsx: (req: AuthRequiredRequest, res: Response) => Promise<void> =
  async (req, res) => {
    const shopId = Number(req.params.shopId);
    if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

    const parsed = q.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
    const { year, month } = parsed.data;

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true, name: true } });
    if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
    const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

    const cycle = kstCycle(year, month, startDay);


    // 사이클 내 확정된 HOURLY 시프트(프리랜서 가정) 합계
    const shifts = await prisma.workShift.findMany({
      where: {
        shopId,
        status: 'COMPLETED',
        finalPayAmount: { not: null },
        employee: { payUnit: 'HOURLY' },
        startAt: { gte: cycle.start, lte: cycle.end },
      },
      select: { employeeId: true, finalPayAmount: true, workedMinutes: true }
    });

    // 집계: 직원별 총 근무분, 총 금액(세전)
    const byEmp = new Map<number, { minutes: number; gross: number }>();
    for (const s of shifts) {
      const cur = byEmp.get(s.employeeId) ?? { minutes: 0, gross: 0 };
      cur.minutes += (s.workedMinutes ?? 0);
      cur.gross   += (s.finalPayAmount ?? 0);
      byEmp.set(s.employeeId, cur);
    }
    // (변경) 근무가 있는 직원만 조회
    const employeeIds = Array.from(byEmp.keys());
    if (employeeIds.length === 0) {
      // 헤더만 있는 엑셀 반환
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('급여');
      const headers = ['순번','직원명','은행','계좌번호','기본 시급','총 근무 시간(시간)','기본','소득세','지방소득세','기타세금','지급해야할 돈','세금 공제','최종 지급액'];
      ws.addRow(headers);
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    const employees = await prisma.employee.findMany({
      where: { shopId, id: { in: employeeIds } }, // ← 사이클 내 근무 있는 직원만
      select: {
        id: true, name: true, pay: true, payUnit: true,
        bank: true, accountNumber: true,
      }
    });
    // ── 엑셀 작성 ────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('급여');

    // 헤더
    const headers = [
      '순번','직원명','은행','계좌번호','기본 시급','총 근무 시간(시간)',
      '기본','소득세','지방소득세','기타세금','지급해야할 돈','세금 공제','최종 지급액'
    ];
    ws.addRow(headers);

    // 본문
    let rowNo = 0;
    let totalGrossWon = 0;
      let totalDeductionsWon = 0;
         let totalNetWon = 0
    for (const emp of employees) {
      const stats = byEmp.get(emp.id) ?? { minutes: 0, gross: 0 };
      // 근무가 전혀 없으면 0원 행을 내릴지 여부: 일단 모두 포함
      if (!stats.minutes && !stats.gross) continue;
      const hoursLabel = fmtKoreanDuration(stats.minutes);
      // ✅ 엑셀 표시는 "일(원) 단위 절사"
      const grossWon = Math.trunc(stats.gross);
      const t = calcTaxes(stats.gross); // 계산은 원래 로직대로
      const incomeTaxWon = Math.trunc(t.incomeTax);
      const localTaxWon  = Math.trunc(t.localTax);
      const otherTaxWon  = Math.trunc(t.otherTax);
      const deductionsWon = incomeTaxWon + localTaxWon + otherTaxWon;
      const netWon = grossWon - deductionsWon;


          totalGrossWon      += grossWon;
     totalDeductionsWon += deductionsWon;
     totalNetWon        += netWon;
      ws.addRow([
        ++rowNo,
        emp.name,
        emp.bank ?? '',
        emp.accountNumber ?? '',
        emp.payUnit === 'HOURLY' ? emp.pay ?? null : null,
        hoursLabel,
        grossWon,             // 기본(세전, 절사)
        incomeTaxWon,         // 소득세(절사)
        localTaxWon,          // 지방소득세(절사)
        otherTaxWon,          // 기타세금(절사)
        grossWon,             // 지급해야할 돈 = 세전 총액(절사)
        deductionsWon,        // 빠지는 돈 = 공제 합계(절사 합)
        netWon                // 최종 지급액(절사)
      ]);
    }


   // ✅ 마지막 합계 행 추가 (요청: 총 지급해야할 돈 / 총 빠지는 돈 / 총 최종 지급액)
   if (rowNo > 0) {
     ws.addRow([
       '', '합계', '', '', '', '', '', '', '', '',
       totalGrossWon, totalDeductionsWon, totalNetWon
     ]);
   }
// ── (기존 "스타일 & 너비" 블록을 아래로 교체) ──────────────────────────
const rightAlignCols = [1,5,7,8,9,10,11,12,13];      // 우측 정렬
const moneyCols      = [5,7,8,9,10,11,12,13];        // 금액 표시(정수)
// 색상 팔레트 (ARGB)
const COLORS = {
  headerBg: 'FF1F2937',   // 어두운 회색
  headerFg: 'FFFFFFFF',   // 흰색
  zebra1:   'FFFFFFFF',   // 흰색
  zebra2:   'FFF3F4F6',   // 밝은 회색
  border:   'FFE5E7EB',   // 연한 테두리
  bodyText: 'FF111827',   // 진한 검정(회색900)
  totalBg:  'FFFEF3C7',   // 연한 노랑(최종 지급액 강조)
};

// 열 너비
ws.columns = [
  { width: 6 },   // 순번
  { width: 16 },  // 직원명
  { width: 10 },  // 은행
  { width: 18 },  // 계좌번호
  { width: 12 },  // 기본 시급
  { width: 16 },  // 총 근무 시간(시간)
  { width: 14 },  // 기본
  { width: 12 },  // 소득세
  { width: 12 },  // 지방소득세
  { width: 12 },  // 기타세금
  { width: 16 },  // 지급해야할 돈
  { width: 12 },  // 빠지는 돈
  { width: 16 }   // 최종 지급액
];

// 헤더 고정
ws.views = [{ state: 'frozen', ySplit: 1 }];

// ✅ AutoFilter: 1행 전체에 적용 (col → column)
// headers 의 길이 참조 대신, 이미 ws.columns 설정했다면 ws.columnCount 사용이 안전합니다.
ws.autoFilter = {
  from: { row: 1, column: 1 },
  to:   { row: 1, column: ws.columnCount },
};

const header = ws.getRow(1);
header.height = 24;
header.eachCell((cell) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  cell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.headerFg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    left:{ style: 'thin', color: { argb: COLORS.border } },
    bottom:{ style: 'thin', color: { argb: COLORS.border } },
    right:{ style: 'thin', color: { argb: COLORS.border } },
  };
});

// 본문(지그재그 배경, 정렬/테두리/폰트)
for (let r = 2; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const zebra = r % 2 === 0 ? COLORS.zebra2 : COLORS.zebra1;

  row.eachCell((cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
    cell.font = { name: 'Malgun Gothic', size: 11, color: { argb: COLORS.bodyText } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: rightAlignCols.includes(colNumber)
        ? 'right'
        : (colNumber === 1 ? 'center' : 'left'),
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      left:{ style: 'thin', color: { argb: COLORS.border } },
      bottom:{ style: 'thin', color: { argb: COLORS.border } },
      right:{ style: 'thin', color: { argb: COLORS.border } },
    };
  });

  // 최종 지급액(13열) 강조
  const netCell = row.getCell(13);
  netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
  netCell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.bodyText } };
}

// 숫자 포맷: 금액/순번 모두 정수(천단위 구분)
for (let r = 2; r <= ws.rowCount; r++) {
  for (const c of moneyCols) ws.getRow(r).getCell(c).numFmt = '#,##0';
  ws.getRow(r).getCell(1).numFmt = '#,##0';
}
// ✅ 합계 행 스타일 오버레이(가장 마지막 행)
if (rowNo > 0) {
  const lastRowIdx = ws.rowCount;
  const tr = ws.getRow(lastRowIdx);
  // '합계' 라벨 정렬/폰트
  tr.getCell(2).value = '합계';
  tr.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
  tr.eachCell((cell) => {
    cell.font = { name: 'Malgun Gothic', size: 12, bold: true, color: { argb: COLORS.bodyText } };
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.border } },
      left:{ style: 'thin', color: { argb: COLORS.border } },
      bottom:{ style: 'thin', color: { argb: COLORS.border } },
      right:{ style: 'thin', color: { argb: COLORS.border } },
    };
  });
  // 금액 3개 컬럼(지급/공제/최종) 배경 강조
  for (const c of [11, 12, 13]) {
    tr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
  }
}

    // 파일명
    const kstStart = toKst(cycle.start);
    const mm = String(kstStart.getUTCMonth() + 1).padStart(2, '0');
    const filename = `정산_${shop.name ?? 'shop'}_${year}-${mm}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    await wb.xlsx.write(res);
    res.end();
  };


export const getSettlementSummary = async (req: AuthRequiredRequest, res: Response): Promise<void> => {
  const shopId = Number(req.params.shopId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const parsed = q.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }

  // 기본 anchor: 현재 KST
  const now = toKst(new Date());
  const year  = parsed.data.year  ?? now.getUTCFullYear();
  const month = parsed.data.month ?? (now.getUTCMonth() + 1);

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
  if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
  const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

  // 사이클 & 달 범위
  const cycle = kstCycle(year, month, startDay);
  const calThis = kstCalendarMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const calPrev = kstCalendarMonth(prevYear, prevMonth);

  // ───────── 사이클 범위의 근무(시급, 확정분만) 조회 ─────────
  const cycleShifts = await prisma.workShift.findMany({
    where: {
      shopId,
      status: 'COMPLETED',
      finalPayAmount: { not: null },
      employee: { payUnit: 'HOURLY' },
      startAt: { gte: cycle.start, lte: cycle.end },
    },
    select: { employeeId: true, finalPayAmount: true, settlementId: true }
  });

  // 직원별 미정산/완료 판정
  const empMap = new Map<number, { grossTotal: number; hasUnsettled: boolean }>();
  for (const r of cycleShifts) {
    const cur = empMap.get(r.employeeId) ?? { grossTotal: 0, hasUnsettled: false };
    cur.grossTotal += r.finalPayAmount ?? 0;
    if (!r.settlementId) cur.hasUnsettled = true;
    empMap.set(r.employeeId, cur);
  }

  const employeeCount = empMap.size;
  let paidCount = 0, unpaidCount = 0;
  let pendingGross = 0;

  for (const [, v] of empMap) {
    if (v.hasUnsettled) {
      unpaidCount++;
      // "정산 대상 금액"은 미정산분 총액으로 해석: 사이클 내 미정산 시프트만 합산
      // (사이클 전부가 미정산인지/일부만 미정산인지 상관없이, 시프트 단위로 미정산만 집계)
    }
  }
  // 미정산 금액 재집계(시프트 단위)
  pendingGross = cycleShifts
    .filter(s => !s.settlementId)
    .reduce((sum, s) => sum + (s.finalPayAmount ?? 0), 0);

  paidCount = employeeCount - unpaidCount;

  // ───────── 이번달 총 근무시간(캘린더 월), 지난달 지출(캘린더 월 정산된 금액) ─────────
  const monthShifts = await prisma.workShift.findMany({
    where: {
      shopId,
      status: 'COMPLETED',
      employee: { payUnit: 'HOURLY' },
      startAt: { gte: calThis.start, lte: calThis.end },
    },
    select: { workedMinutes: true }
  });
  const totalMinutesThisMonth = monthShifts.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);

  const prevPaidShifts = await prisma.workShift.findMany({
    where: {
      shopId,
      status: 'COMPLETED',
      finalPayAmount: { not: null },
      settlementId: { not: null },          // 지난달 "지출"은 실제 정산된(지급처리) 금액만
      employee: { payUnit: 'HOURLY' },
      startAt: { gte: calPrev.start, lte: calPrev.end },
    },
    select: { finalPayAmount: true }
  });
  const spentLastMonth = prevPaidShifts.reduce((s, r) => s + (r.finalPayAmount ?? 0), 0);

  // ───────── 응답 ─────────
  const cycleLabel = fmtRangeLabel(cycle.start, cycle.end);
  const calendarLabel = fmtRangeLabel(calThis.start, calThis.end);

  res.json({
    year, month,
    cycle: {
      start: cycle.start,
      end: cycle.end,
      startDay,
      label: cycleLabel,
    },
    summary: {
      settlementTargetAmount: Math.trunc(pendingGross),   // 정산 대상 금액(미정산 시フト 합계, 원단위 절사표시)
      unpaidEmployees: unpaidCount,                       // 미정산 직원 수
      paidEmployees: paidCount,                           // 정산 완료 직원 수
      employeesInCycle: employeeCount,                    // 사이클 내 근무가 있었던 직원 수(참고)
    },
    calendarMonth: {
      rangeLabel: calendarLabel,                          // 예: '9월 1일 ~ 9월 30일'
      totalWorkedMinutes: totalMinutesThisMonth,
      totalWorkedLabel: fmtHourMinKo(totalMinutesThisMonth), // 예: '9시간'
      spentLastMonth: Math.trunc(spentLastMonth),         // 지난달 지출(정산 완료 합계)
    }
  });
};
export const settleEmployeeCycle: (req: AuthRequiredRequest, res: Response) => Promise<void> =
  async (req, res) => {
    const shopId = Number(req.params.shopId);
    const employeeId = Number(req.params.employeeId);

    // 권한 체크
    if (req.user.shopId !== shopId) {
      res.status(403).json({ error: '다른 가게는 처리할 수 없습니다.' });
      return;
    }
    const settleEmployeeCycleBody = z.object({
      year: z.coerce.number().int().min(2000).max(2100),
      month: z.coerce.number().int().min(1).max(12),
      cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
    });
    const parsedB = settleEmployeeCycleBody.safeParse(req.body ?? {});
    if (!parsedB.success) {
      res.status(400).json({ error: 'Invalid payload', detail: parsedB.error.flatten() });
      return;
    }
    const { year, month, cycleStartDay } = parsedB.data;

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
    if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
    const startDay = cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);
    const cycle = kstCycle(year, month, startDay);

    // 직원 조회(같은 매장 소속인지)
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, shopId },
      select: { id: true, name: true, pay: true, payUnit: true }
    });
    if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }

    // 이미 정산된 기록 유무 (고유키: employeeId + cycleStart + cycleEnd)
    const existing = await prisma.payrollSettlement.findFirst({
      where: { employeeId, cycleStart: cycle.start, cycleEnd: cycle.end }
    });
    if (existing) {
      res.status(409).json({ error: '이미 정산 완료된 사이클입니다.', settlement: existing });
      return;
    }

    // 사이클 내 미정산 & 확정된 근무일정
    const shifts = await prisma.workShift.findMany({
      where: {
        shopId,
        employeeId,
        status: 'COMPLETED',
        startAt: { gte: cycle.start, lte: cycle.end },
        settlementId: null,
      },
      select: { id: true, workedMinutes: true, finalPayAmount: true }
    });

    const workedMinutes = shifts.reduce((s, x) => s + (x.workedMinutes ?? 0), 0);

    // 급여 계산
    let basePay = 0;
    let totalPay = 0;

    if (emp.payUnit === 'HOURLY') {
      // finalPayAmount 합(미확정 제외; 이미 COMPLETED 전제)
      totalPay = shifts.reduce((s, x) => s + (x.finalPayAmount ?? 0), 0);
      basePay = totalPay;
      // HOURLY인데 근무 0이면 방지(원하면 허용 가능)
      if (totalPay === 0) {
        res.status(400).json({ error: '해당 사이클에 정산할 확정 근무가 없습니다.' });
        return;
      }
    } else {
      // MONTHLY: 월급 그대로(필요하면 비례계산 로직 추가)
      basePay = emp.pay ?? 0;
      totalPay = basePay;
    }

    // 세금(정책: HOURLY만 3.3% 적용; 강제 플래그 있으면 적용)
    let incomeTax = 0, localIncomeTax = 0, otherTax = 0, netPay = totalPay;
    const shouldWithhold = emp.payUnit === 'HOURLY';
    if (shouldWithhold) {
      const t = calcTaxesTruncate(totalPay);
      incomeTax = t.incomeTax;
      localIncomeTax = t.localIncomeTax;
      otherTax = floorWon(totalPay * OTHER_TAX_RATE);
      netPay = t.net;
    }

    // 트랜잭션: 정산 스냅샷 생성 + 시프트 settlementId 업데이트
    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.payrollSettlement.create({
        data: {
          shopId,
          employeeId,
          cycleStart: cycle.start,
          cycleEnd: cycle.end,
          workedMinutes,
          basePay,
          totalPay,
          incomeTax,
          localIncomeTax,
          otherTax,
          netPay,
          processedBy: req.user.userId ?? null,
        }
      });

      const { count: appliedShiftCount } = await tx.workShift.updateMany({
        where: {
          shopId,
          employeeId,
          status: 'COMPLETED',
          startAt: { gte: cycle.start, lte: cycle.end },
          settlementId: null,
        },
        data: { settlementId: settlement.id,isSettled:true }
      });

      return { settlement, appliedShiftCount };
    });

    res.status(201).json({
      ok: true,
      cycle: { start: cycle.start, end: cycle.end, startDay },
      employee: { id: emp.id, name: emp.name, payUnit: emp.payUnit },
      appliedShiftCount: result.appliedShiftCount,
      settlement: result.settlement
    });
  };

    const settleEmployeeCycleBody = z.object({
      year: z.coerce.number().int().min(2000).max(2100),
      month: z.coerce.number().int().min(1).max(12),
      cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
    });

export const settleAllEmployeesCycle: (req: AuthRequiredRequest, res: Response) => Promise<void> =
  async (req, res) => {
    const shopId = Number(req.params.shopId);

    if (req.user.shopId !== shopId) {
      res.status(403).json({ error: '다른 가게는 처리할 수 없습니다.' });
      return;
    }

    // query: year, month, cycleStartDay(선택)

    const parsedB = settleEmployeeCycleBody.safeParse(req.body ?? {});
    if (!parsedB.success) {
      res.status(400).json({ error: 'Invalid payload', detail: parsedB.error.flatten() });
      return;
    }
    const { year, month, cycleStartDay } = parsedB.data;


    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
    if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }

    const startDay = cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);
    const cycle = kstCycle(year, month, startDay);

    // 해당 매장 모든 직원
    const employees = await prisma.employee.findMany({
      where: { shopId },
      select: { id: true, name: true, pay: true, payUnit: true }
    });

    const created: Array<{
      employeeId: number;
      name: string;
      payUnit: 'HOURLY' | 'MONTHLY' | null;
      workedMinutes: number;
      basePay: number;
      totalPay: number;
      incomeTax: number;
      localIncomeTax: number;
      otherTax: number;
      netPay: number;
      settlementId: number;
    }> = [];

    const skipped: Array<{
      employeeId: number;
      name: string;
      reason: 'ALREADY_SETTLED' | 'NO_CONFIRMED_SHIFTS' | 'NO_PAY' | 'NO_PAYUNIT' | 'ERROR';
      details?: string;
      settlementId?: number;
    }> = [];

    for (const emp of employees) {
      try {
        // 이미 정산된 경우 skip
        const existed = await prisma.payrollSettlement.findFirst({
          where: {
            employeeId: emp.id,
            cycleStart: cycle.start,
            cycleEnd: cycle.end
          },
          select: { id: true }
        });
        if (existed) {
          skipped.push({
            employeeId: emp.id,
            name: emp.name,
            reason: 'ALREADY_SETTLED',
            settlementId: existed.id
          });
          continue;
        }

        // 급여 유형 체크
        if (!emp.payUnit) {
          skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_PAYUNIT' });
          continue;
        }

        // 해당 사이클 내, 아직 정산되지 않은 COMPLETED 시프트
        const shifts = await prisma.workShift.findMany({
          where: {
            shopId,
            employeeId: emp.id,
            status: 'COMPLETED',
            startAt: { gte: cycle.start, lte: cycle.end },
            settlementId: null
          },
          select: { id: true, workedMinutes: true, finalPayAmount: true }
        });

        const workedMinutes = shifts.reduce((s, x) => s + (x.workedMinutes ?? 0), 0);

        // 급여 계산
        let basePay = 0;
        let totalPay = 0;

        if (emp.payUnit === 'HOURLY') {
          totalPay = shifts.reduce((s, x) => s + (x.finalPayAmount ?? 0), 0);
          basePay = totalPay;
          if (totalPay === 0) {
            // HOURLY 확정 근무가 없다면 스킵
            skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_CONFIRMED_SHIFTS' });
            continue;
          }
        } else {
          // MONTHLY: 월급 필요
          if (!emp.pay || emp.pay <= 0) {
            skipped.push({ employeeId: emp.id, name: emp.name, reason: 'NO_PAY' });
            continue;
          }
          basePay = emp.pay;
          totalPay = basePay;
        }

        // 세금 계산 (정책: HOURLY 기본 적용, forceWithholding=true 이면 MONTHLY에도 적용)
        let incomeTax = 0, localIncomeTax = 0, otherTax = 0, netPay = totalPay;
        const shouldWithhold =  emp.payUnit === 'HOURLY';
        if (shouldWithhold) {
          const t = calcTaxesTruncate(totalPay);
          incomeTax = t.incomeTax;
          localIncomeTax = t.localIncomeTax;
          otherTax = floorWon(totalPay * OTHER_TAX_RATE);
          netPay = t.net;
        }

        // 트랜잭션: 스냅샷 생성 + 해당 시프트 settlementId 세팅
        const result = await prisma.$transaction(async (tx) => {
          const settlement = await tx.payrollSettlement.create({
            data: {
              shopId,
              employeeId: emp.id,
              cycleStart: cycle.start,
              cycleEnd: cycle.end,
              workedMinutes,
              basePay,
              totalPay,
              incomeTax,
              localIncomeTax,
              otherTax,
              netPay,
              processedBy: req.user.userId ?? null,

              settledAt: new Date()
            },
            select: { id: true }
          });

          // HOURLY/MONTHLY 모두 COMPLETED 시프트를 해당 정산에 연결
          await tx.workShift.updateMany({
            where: {
              shopId,
              employeeId: emp.id,
              status: 'COMPLETED',
              startAt: { gte: cycle.start, lte: cycle.end },
              settlementId: null
            },
            data: { settlementId: settlement.id,isSettled:true }
          });

          return settlement.id;
        });

        created.push({
          employeeId: emp.id,
          name: emp.name,
          payUnit: emp.payUnit,
          workedMinutes,
          basePay,
          totalPay,
          incomeTax,
          localIncomeTax,
          otherTax,
          netPay,
          settlementId: result
        });
      } catch (e: any) {
        skipped.push({
          employeeId: emp.id,
          name: emp.name,
          reason: 'ERROR',
          details: e?.message ?? String(e)
        });
      }
    }

    res.status(201).json({
      ok: true,
      cycle: { start: cycle.start, end: cycle.end, startDay },
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped
    });
  };

export const payrollOverview: (req: AuthRequiredRequest, res: Response) => Promise<void> =
  async (req, res) => {
    const shopId = Number(req.params.shopId);
    if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

    const parsed = q.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }
    const { year, month } = parsed.data;

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { payday: true } });
    if (!shop) { res.status(404).json({ error: 'Shop not found' }); return; }
    const startDay = parsed.data.cycleStartDay ?? Math.min(Math.max(shop.payday ?? 1, 1), 28);

    const curr = kstCycle(year, month, startDay);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prev = kstCycle(prevYear, prevMonth, startDay);

    // 급여 대상 수(참고)
    const eligibleEmployees = await prisma.employee.count({ where: { shopId, pay: { gt: 0 } } });

    // 사이클 내부 확정 시급 합계(프레이션 없음, startAt 기준 버킷팅)
    async function confirmedHourlyIn(range: { start: Date; end: Date }) {
      const rows = await prisma.workShift.findMany({
        where: {
          shopId,
          status: 'COMPLETED',              // REVIEW 제외
          finalPayAmount: { not: null },    // 미확정 제외
          employee: { payUnit: 'HOURLY' },  // 시급만
          startAt: { gte: range.start, lte: range.end },
        },
        select: { finalPayAmount: true },
      });
      const amount = rows.reduce((sum, r) => sum + (r.finalPayAmount ?? 0), 0);
      return { amount, shiftCount: rows.length };
    }

    const curHourly  = await confirmedHourlyIn(curr);
    const prevHourly = await confirmedHourlyIn(prev);

    // ...중략(핵심 로직만 교체)

  // 현재는 고정급 확정 0
  const fixed = { amount: 0 };
  const fixedWht = applyFreelancerWithholding(fixed.amount);

  // 시급(확정) 원천징수
  const hourlyWhtCur  = applyFreelancerWithholding(curHourly.amount);
  const hourlyWhtPrev = applyFreelancerWithholding(prevHourly.amount);

  // 총계(세전/세후)
  const expectedPayout     = fixed.amount + curHourly.amount;
  const prevExpectedPayout = fixed.amount + prevHourly.amount;
  const deltaFromPrev      = expectedPayout - prevExpectedPayout;

  const totalWhtCur  = applyFreelancerWithholding(expectedPayout);
  const totalWhtPrev = applyFreelancerWithholding(prevExpectedPayout);
    const kstS = toKst(curr.start), kstE = toKst(curr.end);
    const label = `${kstS.getUTCMonth()+1}월 ${kstS.getUTCDate()}일 ~ ${kstE.getUTCMonth()+1}월 ${kstE.getUTCDate()}일`;
  // 응답
  res.json({
    year, month,
    cycle: { start: curr.start, end: curr.end, startDay, label },

    fixed: {
      amount: fixed.amount,
      withholding3_3: fixedWht.withheld, // 소득세+지방세 합계(≈3.3%)
      netAmount: fixedWht.net,
    },

    hourly: {
      amount: curHourly.amount,
      shiftCount: curHourly.shiftCount,
      withholding3_3: hourlyWhtCur.withheld,
      netAmount: hourlyWhtCur.net,
    },

    totals: {
      expectedPayout,
      previousExpectedPayout: prevExpectedPayout,
      deltaFromPrev,

      expectedPayoutNet: totalWhtCur.net,
      previousExpectedPayoutNet: totalWhtPrev.net,
      deltaFromPrevNet: totalWhtCur.net - totalWhtPrev.net,

      withholding3_3: {
        current: totalWhtCur.withheld,
        previous: totalWhtPrev.withheld,
        // 참고용: 결합 비율(반올림에 따라 실제 합계와 미세 오차 가능)
        rate: Number((INCOME_TAX_RATE * (1 + LOCAL_TAX_ON_INCOME_RATE)).toFixed(5)), // ≒ 0.033
      },
    },

    meta: { eligibleEmployees },
  });

  };

/* ───────────────── 목록: /api/admin/shops/:shopId/payroll/employees ───────────────── */
export const getEmployeeStatusList = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const { year, month, cycleStartDay, q, position, settlement, sort, order } = listQuery.parse(req.query);

  // 가게 설정 또는 환경변수에서 기본 시작일을 끌어오도록 필요시 교체
  const startDay = cycleStartDay ?? Number(process.env.CYCLE_START_DAY ?? '1');
  const cycle = buildCycle(year, month, startDay);

  // 직원 목록(검색/포지션 필터)
  const employees = await prisma.employee.findMany({
    where: {
      shopId,
      ...(q ? { name: { contains: q } } : {}),
      ...(position ? { position } : {}),
    },
    select: { id: true, name: true, position: true, pay: true, payUnit: true,personalColor:true }
  });

  const empIds = employees.map(e => e.id);
  if (empIds.length === 0) {
    res.json({
      year, month,
      cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
      summary: { employeeCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0 },
      items: []
    });
    return;
  }

  // 시프트 집계: COMPLETED & 사이클 내부 (연장급액/추가근무 없음)
  const shiftAgg = await prisma.workShift.groupBy({
    by: ['employeeId'],
    where: {
      shopId,
      employeeId: { in: empIds },
      status: 'COMPLETED' as any,
      startAt: { gte: cycle.start },
      endAt:   { lte: cycle.end },
    },
    _sum: {
      workedMinutes: true,
      finalPayAmount: true,
    }
  });

  const aggByEmp = new Map<number, { workedMinutes: number; finalPayAmount: number }>();
  for (const g of shiftAgg) {
    aggByEmp.set(g.employeeId, {
      workedMinutes: g._sum.workedMinutes ?? 0,
      finalPayAmount: g._sum.finalPayAmount ?? 0
    });
  }

  // 정산 상태
  const settlements = await prisma.payrollSettlement.findMany({
    where: { shopId, cycleStart: cycle.start, cycleEnd: cycle.end, employeeId: { in: empIds } },
    select: { id: true, employeeId: true, settledAt: true, totalPay: true }
  });
  const paidSet = new Map<number, { id: number; settledAt: Date | null }>();
  for (const s of settlements) paidSet.set(s.employeeId, { id: s.id, settledAt: s.settledAt ?? null });

  // merge
  const items = employees.map(e => {
    const agg = aggByEmp.get(e.id) ?? { workedMinutes: 0, finalPayAmount: 0 };
    const isHourly = e.payUnit === 'HOURLY';
    const amount = isHourly
      ? (agg.finalPayAmount || Math.round((agg.workedMinutes / 60) * (e.pay ?? 0)))
      : (e.pay ?? 0);
    const status = paidSet.has(e.id) ? 'PAID' : 'PENDING';
    return {
      employeeId: e.id,
      personalColor:e.personalColor,
      name: e.name,
      position: e.position ?? '',
      payUnit: e.payUnit,
      pay: e.pay,
      amount,
      workedMinutes: agg.workedMinutes,
      daysWorked: 0, // 목록에서는 계산 비용 절약(상세에서 정확히 산출). 필요하면 distinct day 집계 추가.
      settlement: {
        status,
        settlementId: paidSet.get(e.id)?.id ?? null,
        settledAt: paidSet.get(e.id)?.settledAt ?? null
      }
    };
  });

  // settlement 필터
  const filtered = settlement ? items.filter(i => i.settlement.status === settlement) : items;

  // 정렬
  const dir = order === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    if (sort === 'amount') return (a.amount - b.amount) * dir;
    if (sort === 'workedMinutes') return (a.workedMinutes - b.workedMinutes) * dir;
    return a.name.localeCompare(b.name) * dir;
  });

  const summary = {
    employeeCount: filtered.length,
    paidCount: filtered.filter(i => i.settlement.status === 'PAID').length,
    pendingCount: filtered.filter(i => i.settlement.status === 'PENDING').length,
    totalAmount: filtered.reduce((s, i) => s + i.amount, 0)
  };

  res.json({
    year, month,
    cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
    summary,
    items: filtered
  });
};

/* ───────── 상세: /api/admin/shops/:shopId/payroll/employee-status/:employeeId ───────── */
export const getEmployeeStatusDetail = async (req: AuthRequiredRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const employeeId = Number(req.params.employeeId);
  if (req.user.shopId !== shopId) { res.status(403).json({ error: '다른 가게는 조회할 수 없습니다.' }); return; }

  const { year, month, cycleStartDay } = detailQuery.parse(req.query);
  const startDay = cycleStartDay ?? Number(process.env.CYCLE_START_DAY ?? '1');
  const cycle = buildCycle(year, month, startDay);

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    select: { id: true, name: true, position: true, pay: true, payUnit: true }
  });
  if (!emp) { res.status(404).json({ error: '직원이 존재하지 않거나 다른 가게 소속입니다.' }); return; }

  const settlement = await prisma.payrollSettlement.findFirst({
    where: { shopId, employeeId, cycleStart: cycle.start, cycleEnd: cycle.end },
    select: { id: true, settledAt: true }
  });

  const shifts = await prisma.workShift.findMany({
    where: {
      shopId, employeeId,
      // 사이클과 교집합
      startAt: { lt: cycle.end },
      endAt:   { gt: cycle.start }
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true, startAt: true, endAt: true, status: true,
      actualInAt: true, actualOutAt: true,
      workedMinutes: true, actualMinutes: true,
      finalPayAmount: true, settlementId: true
    }
  });

  // 합계
  const workedMinutes = shifts.reduce((s, r) => s + (r.workedMinutes ?? 0), 0);
  const daysWorked = uniqKstDates(shifts.map(s => s.startAt));
  const amount = emp.payUnit === 'HOURLY'
    ? (shifts.reduce((s, r) => s + (r.finalPayAmount ?? 0), 0) || Math.round((workedMinutes / 60) * (emp.pay ?? 0)))
    : (emp.pay ?? 0);

  const logs = shifts.map(r => {
    const k = toKst(r.startAt);
    const date = `${k.getUTCFullYear()}-${String(k.getUTCMonth()+1).padStart(2,'0')}-${String(k.getUTCDate()).padStart(2,'0')}`;
    return {
      id: r.id,
      date,
      plannedStart: r.startAt,
      plannedEnd: r.endAt,
      actualInAt: r.actualInAt,
      actualOutAt: r.actualOutAt,
      status: r.status as any,
      workedMinutes: r.workedMinutes ?? null,
      actualMinutes: r.actualMinutes ?? null,
      finalPayAmount: r.finalPayAmount ?? null,
      settlementId: r.settlementId ?? null
    };
  });

  res.json({
    year, month,
    cycle: { start: cycle.start, end: cycle.end, label: cycle.label, startDay: cycle.startDay },
    settlement: {
      status: settlement ? 'PAID' : 'PENDING',
      settlementId: settlement?.id ?? null,
      settledAt: settlement?.settledAt ?? null
    },
    employee: {
      id: emp.id, name: emp.name, position: emp.position ?? '',
      payUnit: emp.payUnit, pay: emp.pay
    },
    workedMinutes,
    daysWorked,
    amount,
    logs
  });
};