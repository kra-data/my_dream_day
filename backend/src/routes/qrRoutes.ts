import { Router } from 'express';
import { scanQr } from '../controllers/qrController';
import { authenticateJWT } from '../middlewares/jwtMiddleware';

const router = Router();

/** 출력용 QR 이미지 (관리자/점주 전용) */
// router.get('/:shopId.png', authenticateJWT, getShopQrPng);

/** 스캔 진입점 (인증 선택) — 미로그인도 접근해야 하므로 미들웨어 없이 둡니다.
 *  단, req.user를 보고 분기하려면 authenticateJWT를 Optional로 구현해도 됩니다.
 */
router.get('/scan', scanQr);

export default router;
