import { Router, RequestHandler } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import {
  recordAttendance,
  getAttendanceRecords,
  getMyAttendance,
  getMyCurrentStatus,
} from '../controllers/attendanceController';

const router = Router();

/* 직원 권한 체크 미들웨어 */
const requireEmployee: RequestHandler = (req: AuthRequest, res, next): void => {
  if (!req.user || !['staff', 'part_time', 'employee'].includes(req.user.role)) {
    res.status(403).json({ error: '직원 권한이 필요합니다.' });
    return;
  }
  next();
};

/* 관리자 권한 체크 미들웨어 */
const requireAdmin: RequestHandler = (req: AuthRequest, res, next): void => {
  if (!req.user || !['admin', 'owner', 'manager'].includes(req.user.role)) {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
};

/* 직원 전용: 출퇴근 기록 */
router.post('/', authenticateJWT, requireEmployee, recordAttendance);

/* 직원 전용: 현재 출근 상태 조회 */
router.get('/me/status', authenticateJWT, requireEmployee, getMyCurrentStatus);

/* 직원 전용: 자신의 출퇴근 기록 조회 (커서 기반) */
router.get('/me', authenticateJWT, requireEmployee, getMyAttendance);

/* 관리자 전용: 가게의 출퇴근 기록 조회 (커서 기반) */
router.get(
  '/admin/shops/:shopId/attendance',
  authenticateJWT,
  requireAdmin,
  getAttendanceRecords
);

export default router;