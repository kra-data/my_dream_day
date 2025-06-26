import { Router } from 'express';
import { getShopQR } from '../controllers/qrController';
import { authenticateJWT } from '../middlewares/jwtMiddleware';

const router = Router();

/** 관리자만 QR 생성 가능하게 하려면 authenticateJWT + role 체크 추가 */
router.get('/:id/qr', getShopQR);

export default router;
