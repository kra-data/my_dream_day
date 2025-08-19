// controllers/payrollController.ts
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import ExcelJS from 'exceljs';
import { z } from 'zod';

/**
 * GET /api/admin/shops/:shopId/payroll/export
 *  ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
const exportQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const exportPayroll = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const parsed = exportQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid start/end' }); return; }
  const { start, end } = parsed.data as { start: string; end: string };
  const from = new Date(`${start}T00:00:00`);
  const to   = new Date(`${end}T23:59:59`);

  /* ───── 1) 직원 & 출퇴근 레코드 조회 ───── */
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: {
      id: true, name: true, nationalId: true,
      accountNumber: true, bank: true,
      pay: true, payUnit: true
    }
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      shopId,
      paired: true,
      clockInAt: { gte: from, lte: to }
    },
    select: { employeeId: true, workedMinutes: true, extraMinutes: true }
  });

  /* ───── 2) 직원별 근무시간 집계 ───── */
  const minutesByEmp: Record<number, number> = {};
  records.forEach(r => {
    const minutes = r.workedMinutes ?? 0;           // ← null → 0
    minutesByEmp[r.employeeId] =
      (minutesByEmp[r.employeeId] ?? 0) + minutes;
  });

  /* ───── 3) 급여 계산 & 엑셀 작성 ───── */
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');

  ws.columns = [
    { header: '직원명',       key: 'name',          width: 15 },
    { header: '주민번호',     key: 'nationalId',    width: 20 },
    { header: '계좌번호',     key: 'accountNumber', width: 22 },
    { header: '은행',         key: 'bank',          width: 10 },
    { header: '월급(원)',     key: 'salary',        width: 15 },
    { header: '근무시간(분)', key: 'minutes',       width: 15 }
  ];

  employees.forEach(emp => {
    const minutes = minutesByEmp[emp.id] ?? 0;
    const salary =
      emp.payUnit === 'HOURLY'
        ? Math.round((emp.pay / 60) * minutes) // 시급 ⇒ 분당 단가
        : emp.pay;                             // 월급제 그대로
    ws.addRow({
      name: emp.name,
      nationalId: emp.nationalId,
      accountNumber: emp.accountNumber,
      bank: emp.bank,
      salary,
      minutes
    });
  });

  /* ───── 4) 스트림 응답 ───── */
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
