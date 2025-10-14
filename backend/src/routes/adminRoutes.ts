// routes/adminRouter.ts
import { NextFunction, Response, Router } from 'express';
import * as adminController from '../controllers/adminController';
import {
  activeEmployees,
  recentActivities,
  todaySummary
} from '../controllers/dashboardController';
// import { exportPayrollXlsx, getEmployeeStatusDetail, getEmployeeStatusList, getSettlementSummary, payrollOverview, settleAllEmployeesCycle, settleEmployeeCycle } from '../controllers/payrollController';
// import { getShopQrPng } from '../controllers/qrController';
import {selectShop,me} from '../controllers/authController';
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listEmployees
} from '../controllers/adminEmployeeController';
import {
  adminCreateShift,
  adminDeleteShift,
  adminGetShiftDetail,
  adminListReviewShifts,
  adminListShifts,
  adminListUncheckedCompletedShiftsYesterday,
  adminSetShiftChecked,
  adminUpdateShift,
  resolveReviewShiftScheduleOnly
} from '../controllers/workShiftController';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
// ✅ 추가: 타입 안전 래퍼 & 정산 컨트롤러
// import {
//   getAttendanceRecords,
// } from '../controllers/attendanceController';
import { withUser } from '../middlewares/requireUser';
const router = Router();

/* 관리자가 아닌 경우 거부 */
const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  console.log(req.user?.shopRole)
  if (req.user?.shopRole == 'ADMIN' || req.user?.shopRole == 'OWNER') {
     return next();
  }
  res.status(403).json({ error: 'Admin only' });
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
router.post('/shops/:shopId/workshifts/:shiftId/review/resolve', withUser(resolveReviewShiftScheduleOnly));
// router.get('/shops/:shopId/qr', getShopQrPng);
// router.get('/shops/:shopId/attendance/records', withUser(getAttendanceRecords));
router.post('/auth/select-shop', withUser(selectShop));
router.get('/auth/me', withUser(me));

/* ───────── 매장 CRUD ───────── */
router.get('/shops',                 withUser(adminController.getShops));
router.post('/shops',                withUser(adminController.createShop));
router.put('/shops/:shopId',        withUser(adminController.updateShop));
router.delete('/shops/:shopId',     withUser(adminController.deleteShop));
router.get('/shops/:shopId',        withUser(adminController.getShopById));
/* ───────── 직원 CRUD ───────── */
router.get('/shops/:shopId/employees', withUser(listEmployees));
router.post('/shops/:shopId/employees', withUser(createEmployee));
router.put('/shops/:shopId/employees/:employeeId',  withUser(updateEmployee));
router.delete('/shops/:shopId/employees/:employeeId',     withUser(deleteEmployee));

/* ───────── 🆕 대시보드 ───────── */
router.get('/shops/:shopId/dashboard/today',   todaySummary);
router.get('/shops/:shopId/dashboard/active',  activeEmployees);
router.get('/shops/:shopId/dashboard/recent',  recentActivities);

// 🆕 급여 개요
// router.get('/shops/:shopId/payroll/overview', withUser(payrollOverview));
// router.get('/shops/:shopId/payroll/export-xlsx', withUser(exportPayrollXlsx));
// router.get('/shops/:shopId/payroll/summary', withUser(getSettlementSummary));
// router.post('/shops/:shopId/payroll/employees/:employeeId', withUser(settleEmployeeCycle));
// router.get('/shops/:shopId/payroll/employees/:employeeId', withUser(getEmployeeStatusDetail));
// router.get('/shops/:shopId/payroll/employees', withUser(getEmployeeStatusList));
// router.post('/shops/:shopId/payroll/settlements', withUser(settleAllEmployeesCycle));

router.get('/shops/:shopId/shifts/yesterday/unchecked', withUser(adminListUncheckedCompletedShiftsYesterday));
router.put('/shops/:shopId/shifts/:shiftId/admin-check', withUser(adminSetShiftChecked));
export default router;
