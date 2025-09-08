// controllers/payrollOverviewController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequiredRequest } from '../middlewares/requireUser';

// KST helpers
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const diffMin = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
const intersectMin = (a1: Date, a2: Date, b1: Date, b2: Date) => {
  const s = a1 > b1 ? a1 : b1;
  const e = a2 < b2 ? a2 : b2;
  return diffMin(s, e);
};

function kstCycle(year: number, month: number, startDay: number) {
  const start = fromKstParts(year, month - 1, startDay, 0, 0, 0, 0);
  const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = fromKstParts(nm.y, nm.m - 1, startDay, 0, 0, 0, 0);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
}

const q = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  cycleStartDay: z.coerce.number().int().min(1).max(28).optional(),
});

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

    // 급여 대상 수(참고): 급여가 설정된 직원 수
    const eligibleEmployees = await prisma.employee.count({ where: { shopId, pay: { gt: 0 } } });

    // ─────────────────────────────
    // 시급 확정 합: COMPLETED + confirmedPay 존재 + (사이클 교집합)
    // 교집합 비율만큼 confirmedPay를 비례 배분 (경계걸친 야간 등 대비)
    // ─────────────────────────────
// 사이클 내부 확정 시급 합계 (프레이션 없음)
async function confirmedHourlyIn(range: { start: Date; end: Date }) {
  const rows = await prisma.workShift.findMany({
    where: {
      shopId,
      status: 'COMPLETED',              // REVIEW 제외
      finalPayAmount: { not: null },    // 미확정 제외
      employee: { payUnit: 'HOURLY' },  // 시급만
      // 한 사이클에만 속한다고 가정 → startAt 기준으로 버킷팅
      startAt: { gte: range.start, lte: range.end },
      // 만약 경계가 [start, nextStart) 반열림이라면 lte → lt(nextStart)로 바꿔도 OK
    },
    select: { finalPayAmount: true },
  });

  const amount = rows.reduce((sum, r) => sum + (r.finalPayAmount ?? 0), 0);
  return { amount, shiftCount: rows.length };
}

    // 현재/전월 시급 확정 합만 사용
    const curHourly  = await confirmedHourlyIn(curr);
    const prevHourly = await confirmedHourlyIn(prev);

    // 현재는 '고정급 확정' 개념이 없으므로 0 (원장/정산 확정 도입 시 채울 것)
    const fixed = { amount: 0 };

    const expectedPayout     = fixed.amount + curHourly.amount;
    const prevExpectedPayout = fixed.amount + prevHourly.amount;
    const deltaFromPrev      = expectedPayout - prevExpectedPayout;

    const kstS = toKst(curr.start), kstE = toKst(curr.end);
    const label = `${kstS.getUTCMonth()+1}월 ${kstS.getUTCDate()}일 ~ ${kstE.getUTCMonth()+1}월 ${kstE.getUTCDate()}일`;

    res.json({
      year, month,
      cycle: { start: curr.start, end: curr.end, startDay, label },
      fixed,                              // { amount: 0 } (추후 확정 로직 연결)
      hourly: {
        amount: curHourly.amount,         // COMPLETED & confirmedPay 합
        shiftCount: curHourly.shiftCount
      },
      totals: {
        expectedPayout,
        previousExpectedPayout: prevExpectedPayout,
        deltaFromPrev
      },
      meta: { eligibleEmployees }
    });
  };
