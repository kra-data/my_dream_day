import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/**
 * 단일 출·퇴근 API
 * POST /api/attendance   { shopId, type: "IN" | "OUT" }
 */
export const recordAttendance = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { shopId, type } = req.body;

  // ① 필드 검증
  if (!shopId || !type) {
    res.status(400).json({ error: 'shopId, type(IN|OUT) 모두 필요합니다.' });
    return;
  }

  // ② 로그인 직원의 소속 가게 확인
  if (shopId !== req.user.shopId) {
    res.status(403).json({ error: '다른 가게 QR입니다.' });
    return;
  }

  const employeeId = req.user.employeeId;

  if (type === 'IN') {
    // ③ 기존 미짝(IN) 남아 있으면 중복 방지
    const openIn = await prisma.attendanceRecord.findFirst({
      where: { employeeId, type: 'IN', paired: false }
    });
    if (openIn) {
      res.status(400).json({ error: '이미 출근 상태입니다.' });
      return;
    }
    const now = new Date();
    await prisma.attendanceRecord.create({
      data: { shopId, employeeId, type: 'IN',clockInAt: now }
    });
    res.json({ ok: true, message: '출근 완료' });
  } else if (type === 'OUT') {
    // ④ 마지막 미짝 IN 찾기
    const inRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId, type: 'IN', paired: false },
      orderBy: { recordedAt: 'desc' }
    });

    if (!inRecord) {
      res.status(400).json({ error: '출근 기록이 없습니다.' });
      return;
    }

    const now = new Date();
    const workedMinutes = Math.floor(
      (now.getTime() - inRecord.recordedAt.getTime()) / 60000
    );

    // 예시: 8시간(480분) 초과분을 30분 단위로 초과근무
    const extraMinutes =
      workedMinutes > 480 ? Math.floor((workedMinutes - 480) / 30) * 30 : 0;

    await prisma.$transaction([
      prisma.attendanceRecord.update({
        where: { id: inRecord.id },
        data: { workedMinutes, extraMinutes, paired: true,clockOutAt: now }
      }),
      prisma.attendanceRecord.create({
        data: { shopId, employeeId, type: 'OUT' }
      })
    ]);

    res.json({
      ok: true,
      message: '퇴근 완료',
      workedMinutes,
      extraMinutes
    });
  } else {
    res.status(400).json({ error: 'type은 IN 또는 OUT 이어야 합니다.' });
  }
};
