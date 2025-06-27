import { Router, RequestHandler } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import {
  recordAttendance,
  getAttendanceRecords
} from '../controllers/attendanceController';

const router = Router();

/* ───────────────── 직원 전용 ───────────────── */
const requireEmployee: RequestHandler = (
  req: AuthRequest,
  res,
  next
): void => {
  if (!['staff', 'part_time', 'employee'].includes(req.user?.role ?? '')) {
    res.status(403).json({ error: '직원 전용' });
    return;               // ❗️ Response를 반환하지 않음
  }
  next();
};

router.post('/', authenticateJWT, requireEmployee, recordAttendance);

/* ───────────────── 관리자 전용 ───────────────── */
const requireAdmin: RequestHandler = (
  req: AuthRequest,
  res,
  next
): void => {
  if (!['admin', 'owner', 'manager'].includes(req.user?.role ?? '')) {
    res.status(403).json({ error: '관리자 전용' });
    return;
  }
  next();
};

router.get(
  '/admin/shops/:shopId/attendance',
  authenticateJWT,
  requireAdmin,
  getAttendanceRecords
);

export default router;
