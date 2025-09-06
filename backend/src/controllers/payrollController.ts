// controllers/payrollController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import ExcelJS from 'exceljs';
import { z } from 'zod';

/**
 * GET /api/admin/shops/:shopId/payroll/export
 *  ?start=YYYY-MM-DD&end=YYYY-MM-DD   (KST 기준)
 */
const exportQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

/* ───────── 시간 유틸(KST↔UTC) ───────── */
const fromKstParts = (y: number, m1: number, d: number, hh=0, mm=0, ss=0, ms=0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));

/* ───────── 분 계산 ───────── */
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a) / 60000));
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  return en > st ? diffMinutes(st, en) : 0;
};

export const exportPayroll = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const parsed = exportQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid start/end' }); return; }

  const { start, end } = parsed.data as { start: string; end: string };
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);

  // KST 00:00:00.000 ~ 23:59:59.999 → UTC 변환
  const from = fromKstParts(sy, sm - 1, sd, 0, 0, 0, 0);
  const to   = fromKstParts(ey, em - 1, ed, 23, 59, 59, 999);
  if (to < from) { res.status(400).json({ error: 'end must be after start' }); return; }

  /* ───── 1) 직원 조회 ───── */
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: {
      id: true, name: true, nationalIdMasked: true,
      accountNumber: true, bank: true,
      pay: true, payUnit: true
    }
  });
  const empMap = new Map(employees.map(e => [e.id, e]));

  /* ───── 2) 기간 내 완결된 시프트 조회 ─────
     기존 AttendanceRecord는 clockInAt 기반으로 필터했으므로
     WorkShift도 동일하게 actualInAt 기준으로 기간 필터를 맞춘다. */
  const shifts = await prisma.workShift.findMany({
    where: {
      shopId,
      actualInAt:  { gte: from, lte: to },
      actualOutAt: { not: null }
    },
    select: {
      employeeId: true,
      startAt: true, endAt: true,
      actualInAt: true, actualOutAt: true
    }
  });

  /* ───── 3) 직원별 인정 분 합산 ───── */
  const minutesByEmp = new Map<number, number>();
  for (const s of shifts) {
    if (!s.actualInAt || !s.actualOutAt) continue;
    const mins = intersectMinutes(s.actualInAt, s.actualOutAt, s.startAt, s.endAt);
    minutesByEmp.set(s.employeeId, (minutesByEmp.get(s.employeeId) ?? 0) + mins);
  }

  /* ───── 4) 엑셀 작성 ───── */
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');

  ws.columns = [
    { header: '직원명',         key: 'name',              width: 15 },
    { header: '주민번호(마스킹)', key: 'nationalIdMasked',  width: 20 },
    { header: '계좌번호',       key: 'accountNumber',     width: 22 },
    { header: '은행',           key: 'bank',              width: 10 },
    { header: '월급(원)',       key: 'salary',            width: 15 },
    { header: '근무시간(분)',   key: 'minutes',           width: 15 }
  ];

  for (const emp of employees) {
    const minutes = minutesByEmp.get(emp.id) ?? 0;
    const salary =
      emp.payUnit === 'HOURLY'
        ? Math.round((emp.pay / 60) * minutes) // 시급 ⇒ 분당 단가
        : emp.pay;                             // 월급제 그대로(기간과 무관하게 1회 반영: 기존 동작 유지)

    ws.addRow({
      name: emp.name,
      nationalIdMasked: emp.nationalIdMasked,
      accountNumber: emp.accountNumber,
      bank: emp.bank,
      salary,
      minutes
    });
  }

  /* ───── 5) 스트림 응답 ───── */
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=payroll_${shopId}_${start}_${end}.xlsx`
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  await wb.xlsx.write(res);
  res.end();
};
