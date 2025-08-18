import { Router } from 'express';
import { login, refresh, logout,validateAccessToken } from '../controllers/authController';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import { healthCheck } from '../controllers/healthController';
import adminRoutes from './adminRoutes';
import attendanceRoutes from './attendanceRoutes';
const router = Router();

router.get('/health', healthCheck);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);
/* ✅ 새 엔드포인트 */
router.get('/auth/validate',  validateAccessToken);

router.get('/admin-only', authenticateJWT, (req: AuthRequest, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  res.json({ message: 'Welcome admin', user: req.user });
});

router.get('/employee-only', authenticateJWT, (req: AuthRequest, res) => {
  if (req.user.role !== 'employee') {
    res.status(403).json({ error: 'Employee only' });
    return;
  }
  res.json({ message: 'Welcome employee', user: req.user });
});

router.get('/common', authenticateJWT, (req: AuthRequest, res) => {
  res.json({ message: `Hello, ${req.user.role}!`, user: req.user });
});


router.use('/admin', adminRoutes);

router.use('/attendance', attendanceRoutes);
export default router;
