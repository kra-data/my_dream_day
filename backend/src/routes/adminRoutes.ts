// routes/adminRouter.ts
import { Router, NextFunction, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import * as adminController from '../controllers/adminController';
import {
  todaySummary,
  activeEmployees,
  recentActivities
} from '../controllers/dashboardController';
import { getShopQrPng } from '../controllers/qrController';
import {
  adminListShifts,
  adminCreateShift,
  adminUpdateShift,
  adminDeleteShift,
  adminListReviewShifts,
  adminGetShiftDetail
} from '../controllers/workShiftController';
import { payrollOverview } from '../controllers/payrollController';
// ✅ 추가: 타입 안전 래퍼 & 정산 컨트롤러
import { withUser, AuthRequiredRequest } from '../middlewares/requireUser';

const router = Router();

/* 관리자가 아닌 경우 거부 */
const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
};
// ✅ 공통 파라미터 가드: shiftId는 숫자만 허용
router.param('shiftId', (req, res, next, val) => {
  if (!/^\d+$/.test(String(val))) {
    return res.status(400).json({ error: 'shiftId must be numeric' });
  }
  next();
});

/* ───────── 공통 미들웨어 ───────── */
router.use(authenticateJWT);
router.use(requireAdmin);


// ───────── WorkShift (Admin/Owner) ─────────
router.get('/shops/:shopId/workshifts/review', withUser(adminListReviewShifts));
router.get('/shops/:shopId/workshifts', withUser(adminListShifts));
router.post('/shops/:shopId/employees/:employeeId/workshifts', withUser(adminCreateShift));
router.get('/shops/:shopId/workshifts/:shiftId', withUser(adminGetShiftDetail));
router.put('/shops/:shopId/workshifts/:shiftId', withUser(adminUpdateShift));
router.delete('/shops/:shopId/workshifts/:shiftId', withUser(adminDeleteShift));
router.get('/shops/:shopId/qr', getShopQrPng);

/* ───────── 매장 CRUD ───────── */
router.get('/shops',                 adminController.getShops);
router.post('/shops',                adminController.createShop);
router.put('/shops/:shopId',        adminController.updateShop);
router.delete('/shops/:shopId',     adminController.deleteShop);

/* ───────── 직원 CRUD ───────── */
router.get('/shops/:shopId/employees',  adminController.getEmployees);
router.post('/shops/:shopId/employees', adminController.createEmployee);
router.put('/shops/:shopId/employees/:employeeId',        adminController.updateEmployee);
router.delete('/shops/:shopId/employees/:employeeId',     adminController.deleteEmployee);


/* ───────── 🆕 대시보드 ───────── */
router.get('/shops/:shopId/dashboard/today',   todaySummary);
router.get('/shops/:shopId/dashboard/active',  activeEmployees);
router.get('/shops/:shopId/dashboard/recent',  recentActivities);

// 🆕 급여 개요
router.get('/shops/:shopId/payroll/overview', withUser(payrollOverview));

export default router;
