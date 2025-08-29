import { Router, Response, NextFunction } from 'express';
import { login, refresh, logout, validateAccessToken } from '../controllers/authController';
import { authenticateJWT, UserRole, AuthRequest } from '../middlewares/jwtMiddleware';
import { healthCheck } from '../controllers/healthController';
import adminRoutes from './adminRoutes';
import attendanceRoutes from './attendanceRoutes';
import { requireUser, withUser } from '../middlewares/requireUser';
import myRoutes from './myRoutes';
const router = Router();

/* Health */
router.get('/health', healthCheck);

/* Auth */
router.post('/auth/login',   login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout',  logout);
router.get('/auth/validate', validateAccessToken);

/* 🔐 역할 가드: AuthRequest 시그니처로 선언 (RequestHandler 사용 X) */
const requireRoles =
  (...allowed: ReadonlyArray<UserRole>) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role as UserRole | undefined;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: '권한이 필요합니다.' });
      return;
    }
    next();
  };

/* 관리자/점주 전용 샘플 */
router.get(
  '/admin-only',
  authenticateJWT,
  requireUser,                 // req.user 존재 보장(401 처리)
  requireRoles('admin', 'owner'),
  withUser((req, res) => {     // 콜백에 타입 주석 붙이지 마세요: withUser가 타입 제공
    res.json({ message: 'Welcome admin', user: req.user });
  })
);

/* 직원 전용 샘플 */
router.get(
  '/employee-only',
  authenticateJWT,
  requireUser,
  requireRoles('employee'),
  withUser((req, res) => {
    res.json({ message: 'Welcome employee', user: req.user });
  })
);

/* 공통 샘플 */
router.get(
  '/common',
  authenticateJWT,
  requireUser,
  withUser((req, res) => {
    res.json({ message: `Hello, ${req.user.role}!`, user: req.user });
  })
);

/* Feature routes */
router.use('/admin',      adminRoutes);
router.use('/attendance', attendanceRoutes);


router.use('/', myRoutes);

export default router;
