// src/controllers/dashboardController.ts  (파일명이 다르면 기존 파일 교체)
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';
import { z } from 'zod';

/* ───────── KST 유틸 ───────── */
const toKst = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000);
const fromKstParts = (y: number, m1: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(Date.UTC(y, m1, d, hh - 9, mm, ss, ms));
const startOfKstDay = (anchor: Date) => {
  const k = toKst(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 0, 0, 0, 0);
};
const endOfKstDay = (anchor: Date) => {
  const k = toKst(anchor);
  return fromKstParts(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 23, 59, 59, 999);
};

/* ───────── 분 계산 유틸 ───────── */
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
const intersectMinutes = (a0: Date, a1: Date, b0: Date, b1: Date) => {
  const st = a0 > b0 ? a0 : b0;
  const en = a1 < b1 ? a1 : b1;
  if (en <= st) return 0;
  return diffMinutes(st, en);
};

/* 오늘(KST) 00:00:00 ~ 23:59:59.999 */
const getTodayRange = () => {
  const now = new Date();
  return { start: startOfKstDay(now), end: endOfKstDay(now) };
};

/* ───────────────────────────────────────────
 *  1) 오늘 현황  (전체·출근·지각·결근)
 *     GET /api/admin/shops/:shopId/dashboard/today
 * ───────────────────────────────────────────*/
export const todaySummary = async (req: AuthRequest, res: Response) => {
  const shopId = Number(req.params.shopId);
  const { start, end } = getTodayRange();
  const now = new Date();

  // 전체 직원 수
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id: true }
  });

  // 오늘(KST) 근무일정(겹치는 시프트)
  const todays = await prisma.workShift.findMany({
    where: {
      shopId,
      startAt: { lt: end },
      endAt:   { gt: start },
    },
    select: { employeeId: true, startAt: true, endAt: true, actualInAt: true }
  });

  // 오늘 IN 찍은 직원(실제 출근 시간 actualInAt 이 오늘 KST 범위에 들어온 경우)
  const checkedSet = new Set(
    todays
      .filter(s => s.actualInAt && s.actualInAt >= start && s.actualInAt <= end)
      .map(s => s.employeeId)
  );

  // 직원별 오늘 시프트 묶기
  const byEmp = new Map<number, typeof todays>();
  todays.forEach(s => {
    const arr = byEmp.get(s.employeeId) ?? [];
    arr.push(s);
    byEmp.set(s.employeeId, arr);
  });

  // 지각/결근 집계(직원 단위):
  // - 오늘 시프트가 없는 직원은 제외
  // - 오늘 IN 안 찍었고:
  //   · now < 최초 시작 → 아직 근무 전 (카운트X)
  //   · 최초 시작 ≤ now ≤ 최종 종료 → 지각
  //   · now > 최종 종료 → 결근
  let late = 0, absent = 0;
  for (const [empId, shifts] of byEmp.entries()) {
    if (checkedSet.has(empId)) continue; // 이미 출근 처리됨
    const firstStart = new Date(Math.min(...shifts.map(s => +s.startAt)));
    const lastEnd    = new Date(Math.max(...shifts.map(s => +s.endAt)));
    if (now < firstStart) continue;
    if (now <= lastEnd) late++;
    else absent++;
  }

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

  const onDuty = await prisma.workShift.findMany({
    where: { shopId, actualInAt: { not: null }, actualOutAt: null },
    include: { employee: { select: { name: true, position: true, section: true } } },
    orderBy: { actualInAt: 'asc' }
  });

  res.json(onDuty.map(s => ({
    employeeId: s.employeeId,
    name:       s.employee.name,
    position:   s.employee.position,
    section:    s.employee.section,
    clockInAt:  s.actualInAt
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

  // 시프트 단위 최근 활동: OUT이 있으면 OUT 우선, 없으면 IN 기준으로 최신 정렬
  const logs = await prisma.workShift.findMany({
    where: {
      shopId,
      OR: [{ actualInAt: { not: null } }, { actualOutAt: { not: null } }]
    },
    orderBy: [
      { actualOutAt: 'desc' },   // OUT이 있으면 이것으로 먼저 정렬
      { actualInAt: 'desc' },
      { startAt: 'desc' }
    ],
    take,
    include: { employee: { select: { name: true, position: true, section: true } } }
  });

  const items = logs.map(l => {
    const type: 'IN' | 'OUT' = l.actualOutAt ? 'OUT' : 'IN';
    const workedMinutes =
      l.actualInAt && l.actualOutAt ? intersectMinutes(l.actualInAt, l.actualOutAt, l.startAt, l.endAt) : null;

    return {
      id:            l.id,               // shift id를 activity id로 사용
      type,                             // 'IN' | 'OUT'
      employeeId:    l.employeeId,
      name:          l.employee.name,
      position:      l.employee.position,
      section:       l.employee.section,
      clockInAt:     l.actualInAt,
      clockOutAt:    l.actualOutAt,
      workedMinutes
    };
  });

  res.json(items);
};
