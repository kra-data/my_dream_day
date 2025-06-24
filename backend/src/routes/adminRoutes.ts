import { Router, NextFunction, Response  } from 'express';
import { authenticateJWT, AuthRequest } from '../middlewares/jwtMiddleware';
import * as adminController from '../controllers/adminController';

const router = Router();

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
};

router.use(authenticateJWT);
router.use(requireAdmin);
router.get('/shops', adminController.getShops);
router.post('/shops', adminController.createShop);
router.put('/shops/:id', adminController.updateShop);
router.delete('/shops/:id', adminController.deleteShop);
router.get('/shops/:id/employees', adminController.getEmployees);
router.post('/shops/:id/employees', adminController.createEmployee);
router.put('/employees/:id', adminController.updateEmployee);
router.delete('/employees/:id', adminController.deleteEmployee);

export default router;
