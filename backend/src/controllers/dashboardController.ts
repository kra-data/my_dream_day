import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/* 유틸 ─ 오늘(한국시간) 00:00:00 ~ 23:59:59 범위 반환 */
const getTodayRange = (): { start: Date; end: Date } => {
  const now = new Date();
  // KST(+9) 기준 날짜 → UTC로 변환
  const kstOffset = -9 * 60;                 // 분
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    -kstOffset / 60, 0, 0, 0                 // 00:00 KST
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);       // 내일 00:00 KST
  end.setUTCMilliseconds(-1);                // 23:59:59.999
  return { start, end };
};

/* ───────────────────────────────────────────
 *  1) 오늘 현황  (전체·출근·지각·결근)
 *     GET /api/admin/shops/:shopId/dashboard/today
 * ───────────────────────────────────────────*/
export const todaySummary = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const { start, end } = getTodayRange();

  /* 직원 전체 */
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id: true, schedule: true }
  });

  /* 오늘 IN 기록 있는 직원 집합 */
  const todayIns = await prisma.attendanceRecord.findMany({
    where: {
      shopId,
      type: 'IN',
      clockInAt: { gte: start, lte: end }
    },
    select: { employeeId: true }
  });
  const checkedSet = new Set(todayIns.map(r => r.employeeId));

  /* 지각·결근 계산 (간단 버전-현재 시각 이후 기준) */
  const nowKst = new Date();                        // 서버 시간이 KST라고 가정
  const weekday = ['sun','mon','tue','wed','thu','fri','sat'][nowKst.getDay()];

  let late = 0;
  let absent = 0;

  employees.forEach(emp => {
    const todaySchedule = (emp.schedule as any)?.[weekday];
    if (!todaySchedule) return;                     // 당직 아님
    if (checkedSet.has(emp.id)) return;             // 이미 출근

    /* 아직 출근 안 한 경우 → 지각 vs 결근(퇴근시간도 지남) */
    const [h, m] = todaySchedule.start.split(':').map(Number);
    const startTime = new Date(nowKst);
    startTime.setHours(h, m, 0, 0);

    if (nowKst < startTime) return;                // 아직 근무前
    const [eh, em] = todaySchedule.end.split(':').map(Number);
    const endTime = new Date(nowKst);
    endTime.setHours(eh, em, 0, 0);

    if (nowKst <= endTime) late++;                 // 근무 중인데 미출근 = 지각
    else absent++;                                 // 근무시간 종료 = 결근
  });

  res.json({
    totalEmployees: employees.length,
    checkedIn:      checkedSet.size,
    late,
    absent
  });
};

/* ───────────────────────────────────────────
 *  2) 실시간 근무자 목록
 *     GET /api/admin/shops/:shopId/dashboard/active
 * ───────────────────────────────────────────*/
export const activeEmployees = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);

  const onDuty = await prisma.attendanceRecord.findMany({
    where: { shopId, paired: false },              // 아직 OUT 미기록
    include: { employee: { select: { name: true, position: true, section: true } } },
    orderBy: { clockInAt: 'asc' }
  });

  res.json(onDuty.map(r => ({
    employeeId: r.employeeId,
    name:       r.employee.name,
    position:   r.employee.position,
    section:    r.employee.section,
    clockInAt:  r.clockInAt
  })));
};

/* ───────────────────────────────────────────
 *  3) 최근 출‧퇴근 활동
 *     GET /api/admin/shops/:shopId/dashboard/recent?limit=30
 * ───────────────────────────────────────────*/
export const recentActivities = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const take   = Math.min(Number(req.query.limit) || 30, 100);

  const logs = await prisma.attendanceRecord.findMany({
    where: { shopId },
    orderBy: { clockInAt: 'desc' },
    take,
    include: { employee: { select: { name: true, position: true, section: true } } }
  });

  res.json(logs.map(l => ({
    id:            l.id,
    type:          l.type,                       // IN | OUT
    employeeId:    l.employeeId,
    name:          l.employee.name,
    position:      l.employee.position,
    section:       l.employee.section,
    clockInAt:     l.clockInAt,
    clockOutAt:    l.clockOutAt,
    workedMinutes: l.workedMinutes
  })));
};
