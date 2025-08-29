// routes/adminRouter.ts
import { Router, NextFunction, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import * as adminController from '../controllers/adminController';
import { exportPayroll } from '../controllers/payrollController';
import {
  payrollDashboard,
  payrollByEmployee,
  payrollEmployeeDetail
} from '../controllers/payrollAdminController';
import {
  todaySummary,
  activeEmployees,
  recentActivities
} from '../controllers/dashboardController';
import { employeePayrollSummary } from '../controllers/payrollSummaryController';
import { getShopQrPng } from '../controllers/qrController';
import { getAttendanceRecords, adminCreateOrCloseAttendance, adminUpdateAttendance } from '../controllers/attendanceController';

// ✅ 추가: 타입 안전 래퍼 & 정산 컨트롤러
import { withUser, AuthRequiredRequest } from '../middlewares/requireUser';
import { settlePreviousCycle } from '../controllers/payrollSettlementController';

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

/* ───────── 공통 미들웨어 ───────── */
router.use(authenticateJWT);
router.use(requireAdmin);
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

/* ───────── 급여 엑셀 ───────── */
router.get('/shops/:shopId/payroll/export', exportPayroll);
router.get(
  '/shops/:shopId/payroll/employees/:employeeId/summary',
  employeePayrollSummary
);

/* ───────── 🆕 대시보드 ───────── */
router.get('/shops/:shopId/dashboard/today',   todaySummary);
router.get('/shops/:shopId/dashboard/active',  activeEmployees);
router.get('/shops/:shopId/dashboard/recent',  recentActivities);
router.get('/shops/:shopId/payroll/dashboard',     payrollDashboard);
router.get('/shops/:shopId/payroll/employees',     payrollByEmployee);
router.get('/shops/:shopId/payroll/employees/:employeeId', payrollEmployeeDetail);

/* ───────── 🆕 지난 사이클 정산 확정 ───────── */
// 전체 라우터에 authenticateJWT + requireAdmin가 이미 걸려있음
router.post(
  '/shops/:shopId/settlements/employees/:employeeId',
  withUser((req: AuthRequiredRequest, res) => settlePreviousCycle(req, res))
);

export default router;
