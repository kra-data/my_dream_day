import { Router } from 'express';
import { login, refresh, logout } from '../controllers/authController';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import { healthCheck } from '../controllers/healthController';
import adminRoutes from './adminRoutes';

const router = Router();

router.get('/health', healthCheck);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);

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


export default router;
