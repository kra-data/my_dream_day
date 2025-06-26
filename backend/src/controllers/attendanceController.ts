import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middlewares/jwtMiddleware';

/**
 * POST /api/attendance
 * body: { shopId, type: "IN" | "OUT" }
 */
export const recordAttendance = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { shopId, type } = req.body;
  if (!shopId || !type) {
    res.status(400).json({ error: 'shopId, type(IN|OUT) 모두 필요합니다.' });
    return;
  }

  /** ① 로그인 직원이 해당 가게 소속인지 검증 */
  if (shopId !== req.user.shopId) {
    res.status(403).json({ error: '다른 가게 QR입니다.' });
    return;
  }

  const employeeId = req.user.employeeId;
  const now        = new Date();

  if (type === 'IN') {
    /** ② 이미 출근 상태인지 확인 */
    const openIn = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false }
    });
    if (openIn) {
      res.status(400).json({ error: '이미 출근 상태입니다.' });
      return;
    }

    /** ③ 출근 기록 생성 */
    await prisma.attendanceRecord.create({
      data: {
        shopId,
        employeeId,
        type: 'IN',
        clockInAt: now,
        paired: false
      }
    });
    res.json({ ok: true, message: '출근 완료' });
    return;
  }

  if (type === 'OUT') {
    /** ④ 매칭되지 않은 IN 기록 찾기 */
    const inRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId, paired: false },
      orderBy: { clockInAt: 'desc' }
    });

    if (!inRecord) {
      res.status(400).json({ error: '출근 기록이 없습니다.' });
      return;
    }

    const workedMinutes = Math.floor(
      (now.getTime() - inRecord.clockInAt!.getTime()) / 60000
    );
    const extraMinutes =
      workedMinutes > 480 ? Math.floor((workedMinutes - 480) / 30) * 30 : 0;

    /** ⑤ 같은 레코드에 퇴근 정보 업데이트 */
    await prisma.attendanceRecord.update({
      where: { id: inRecord.id },
      data: {
        type: 'OUT',
        clockOutAt: now,
        workedMinutes,
        extraMinutes,
        paired: true
      }
    });

    res.json({
      ok: true,
      message: '퇴근 완료',
      workedMinutes,
      extraMinutes
    });
    return;
  }

  res.status(400).json({ error: 'type은 IN 또는 OUT 이어야 합니다.' });
};
