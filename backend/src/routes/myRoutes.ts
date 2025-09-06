// routes/myRoutes.ts
import { Router } from 'express';
import {
  authenticateJWT,
  UserRole,
  AuthRequest
} from '../middlewares/jwtMiddleware';

import {
  requireUser,
  withUser,
  AuthRequiredRequest
} from '../middlewares/requireUser';
import {
  myCreateShift,
  myListShifts,
  getMyTodayWorkshifts
} from '../controllers/workShiftController';
import { mySettlementSummary } from '../controllers/mySettlementController';

const router = Router();

/** 공통 역할 가드: 허용된 역할만 통과 (attendanceRoutes.ts와 동일 패턴) */
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

/** 마이페이지 정산/프로필/통계 (직원 전용) */
router.get(
  '/my/settlement',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res, _next) => mySettlementSummary(req, res))
);

router.post(
  '/my/workshifts',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res, _next) => myCreateShift(req, res))
);

router.get(
  '/my/workshifts',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res, _next) => myListShifts(req, res))
);
// (직원) 오늘 내 근무일정
router.get(
  '/my/workshifts/today',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req: AuthRequiredRequest, res) => getMyTodayWorkshifts(req, res))
);

export default router;
