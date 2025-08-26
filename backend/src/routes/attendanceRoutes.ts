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
  adminCreateOrCloseAttendance,
  adminUpdateAttendance,
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

/** 출퇴근 기록 생성(출근/퇴근) */
router.post(
  '/',
  authenticateJWT,
  requireUser,                  // req.user 존재 보장 (런타임)
  requireRoles('employee'),     // 직원만
  withUser(                     // 컨트롤러에 AuthRequiredRequest 타입 보장
    (req: AuthRequiredRequest, res, next) => recordAttendance(req, res)
  )
);

/** 현재 출근 상태 조회 */
router.get(
  '/me/status',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res, next) => getMyCurrentStatus(req, res))
);

/** 자신의 출퇴근 기록 조회(커서 기반) */
router.get(
  '/me',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res, next) => getMyAttendance(req, res))
);

/* ───────────────── 관리자/점주 전용 ───────────────── */

/** 가게의 출퇴근 기록 조회(커서 기반) */
router.get(
  '/admin/shops/:shopId/attendance',
  authenticateJWT,
  requireUser,
  requireRoles('admin', 'owner'),   // ✅ 점주(owner)도 허용
  withUser((req: AuthRequiredRequest, res, next) => getAttendanceRecords(req, res))
);

/** 임의 출근/퇴근 생성 또는 열린 IN 닫기 */
router.post(
  '/admin/shops/:shopId/attendance/employees/:employeeId',
  authenticateJWT,
  requireUser,
  requireRoles('admin', 'owner'),
  withUser((req: AuthRequiredRequest, res, next) => adminCreateOrCloseAttendance(req, res))
);

/** 기존 기록 수정 */
router.put(
  '/admin/shops/:shopId/attendance/records/:id',
  authenticateJWT,
  requireUser,
  requireRoles('admin', 'owner'),
  withUser((req: AuthRequiredRequest, res, next) => adminUpdateAttendance(req, res))
);

export default router;
