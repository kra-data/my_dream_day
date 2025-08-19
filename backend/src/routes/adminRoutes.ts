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
import { getShopQR } from '../controllers/qrController';
import { getAttendanceRecords } from '../controllers/attendanceController';

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
router.get('/shops/:id/qr', getShopQR);
/* ───────── 매장 CRUD ───────── */
router.get('/shops',            adminController.getShops);
router.post('/shops',           adminController.createShop);
router.put('/shops/:id',        adminController.updateShop);
router.delete('/shops/:id',     adminController.deleteShop);

/* ───────── 직원 CRUD ───────── */
router.get('/shops/:id/employees',  adminController.getEmployees);
router.post('/shops/:id/employees', adminController.createEmployee);
router.put('/shops/:id/employees/:employeeId',        adminController.updateEmployee);
router.delete('/shops/:id/employees/:employeeId',     adminController.deleteEmployee);

/* ───────── 급여 엑셀 ───────── */
router.get('/shops/:shopId/payroll/export', exportPayroll);
router.get(
  '/shops/:shopId/payroll/employees/:employeeId/summary',
  employeePayrollSummary
);
/* ───────── 출퇴근 기록 (관리자 alias) ───────── */
router.get('/shops/:shopId/attendance', getAttendanceRecords);
/* ───────── 🆕 대시보드 ───────── */
router.get('/shops/:shopId/dashboard/today',   todaySummary);      // 오늘 현황
router.get('/shops/:shopId/dashboard/active',  activeEmployees);   // 실시간 근무자
router.get('/shops/:shopId/dashboard/recent',  recentActivities);  // 최근 활동
router.get('/shops/:shopId/payroll/dashboard',     payrollDashboard);
router.get('/shops/:shopId/payroll/employees',     payrollByEmployee);
router.get('/shops/:shopId/payroll/employees/:employeeId', payrollEmployeeDetail);
export default router;
