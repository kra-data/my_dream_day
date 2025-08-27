import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import { z } from 'zod';

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

    employees.forEach((emp) => {
    const raw = (emp.schedule as any)?.[weekday];

    // todaySchedule → 항상 [{start, end}, ...] 형태로 정규화
    const shifts: Array<{ start: string; end: string }> = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? [raw]
        : [];

    // 유효한 타임만 남기기
    const valid = shifts.filter(
      (s) => s && typeof s.start === 'string' && typeof s.end === 'string'
    );

    // 근무 없음 or 이미 출근
    if (valid.length === 0) return;
    if (checkedSet.has(emp.id)) return;

    // "HH:mm" → 오늘 날짜의 Date 로 변환 (서버 로컬타임 기준)
    const toToday = (hm: string) => {
      const [hStr, mStr] = hm.split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      const d = new Date(nowKst);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const starts = valid.map((s) => toToday(s.start)).filter(Boolean) as Date[];
    const ends   = valid.map((s) => toToday(s.end)).filter(Boolean) as Date[];

    if (starts.length === 0 || ends.length === 0) return;

    // 하루 여러 타임을 고려: 가장 이른 시작/가장 늦은 종료
    const firstStart = new Date(Math.min(...starts.map((d) => +d)));
    const lastEnd    = new Date(Math.max(...ends.map((d) => +d)));

    // 아직 근무 전
    if (nowKst < firstStart) return;

    // 근무시간 중인데 미출근 → 지각, 모두 지난 뒤까지 미출근 → 결근
    if (nowKst <= lastEnd) late++;
    else absent++;
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
const recentQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });

export const recentActivities = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const parsed = recentQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid limit' }); return; }
  const take   = Math.min(Number(parsed.data.limit ?? 30), 100);

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
