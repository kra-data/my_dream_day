// src/routes/attendance.ts
import { Router } from 'express';
import {
  authenticateJWT,
  UserRole,
  AuthRequest
} from '../middlewares/jwtMiddleware';
import {
  recordAttendance,
  getAttendanceRecords,
  getMyAttendance,
  getMyCurrentStatus,
} from '../controllers/attendanceController';
import {
  requireUser,
  withUser,
  AuthRequiredRequest
} from '../middlewares/requireUser';

const router = Router();

/** 공통 역할 가드: 허용된 역할만 통과 */
const requireRoles =
  (...allowed: ReadonlyArray<UserRole>) =>
  (req: AuthRequest, res: any, next: any) => {
    const role = req.user?.role as UserRole | undefined;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: '권한이 필요합니다.' });
      return;
    }
    next();
  };

/* ───────────────── 직원 전용 ───────────────── */

/** 출퇴근 기록 생성(출근/퇴근) — WorkShift 1:1 */
router.post(
  '/',
  authenticateJWT,
  requireUser,                  // req.user 보장
  requireRoles('employee'),     // 직원만
  withUser((req: AuthRequiredRequest, res) => recordAttendance(req, res))
);

/** 현재 출근 상태 조회 */
router.get(
  '/me/status',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res) => getMyCurrentStatus(req, res))
);

/* ───────────────── 관리자/점주 전용 ───────────────── */

/** 가게의 출퇴근 기록 조회(커서 기반)
 *  내부적으로 WorkShift를 조회해 AttendanceRecord 형태로 매핑해서 반환
 */
router.get(
  '/admin/shops/:shopId/attendance',
  authenticateJWT,
  requireUser,
  requireRoles('admin', 'owner'),   // 점주(owner) 허용
  withUser((req: AuthRequiredRequest, res) => getAttendanceRecords(req, res))
);



export default router;
