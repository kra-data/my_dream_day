import { Router, Response, NextFunction } from 'express';
import * as auth from '../controllers/authController';          // ✅ 네임스페이스 임포트
import * as emp from '../controllers/employeeAuthController';
import { authenticateJWT, UserRole, AuthRequest } from '../middlewares/jwtMiddleware';
import { healthCheck } from '../controllers/healthController';
import adminRoutes from './adminRoutes';
// import attendanceRoutes from './attendanceRoutes';
import { requireUser, withUser } from '../middlewares/requireUser';
// import myRoutes from './myRoutes';
const router = Router();

/* Health */
router.get('/health', healthCheck);

// 사장님
router.post('/admin/auth/register', auth.register);
router.post('/admin/auth/login', auth.login);

router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);


// 직원
router.post('/employee/auth/login/:shopId', emp.employeeLogin);
/* 🔐 역할 가드: AuthRequest 시그니처로 선언 (RequestHandler 사용 X) */
const requireRoles =
  (...allowed: ReadonlyArray<UserRole>) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const shopRole = req.user?.shopRole as UserRole | undefined;
    if (!shopRole || !allowed.includes(shopRole)) {
      res.status(403).json({ error: '권한이 필요합니다.' });
      return;
    }
    next();
  };



/* 공통 샘플 */
router.get(
  '/common',
  authenticateJWT,
  requireUser,
  withUser((req, res) => {
    res.json({ message: `Hello, ${req.user.shopRole}!`, user: req.user });
  })
);

/* Feature routes */
router.use('/admin',      adminRoutes);
// router.use('/attendance', attendanceRoutes);


// router.use('/', myRoutes);


export default router;
