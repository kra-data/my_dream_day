import { Router, Response, NextFunction } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import { recordAttendance } from '../controllers/attendanceController';

const router = Router();

/** 직원만 이용 가능하게 */
const requireEmployee = (_req: AuthRequest, res: Response, next: NextFunction) => {
  if (_req.user?.role !== 'employee') {
    res.status(403).json({ error: '직원 전용 API입니다.' });
    return;
  }
  next();
};

router.use(authenticateJWT, requireEmployee);

/** POST /api/attendance  { shopId, type } */
router.post('/', recordAttendance);

export default router;
