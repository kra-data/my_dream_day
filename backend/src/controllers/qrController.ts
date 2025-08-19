import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import QRCode   from 'qrcode';
import { z } from 'zod';

/**
 * GET /api/shops/:id/qr
 *    ?download=1  →  attachment 다운로드 (filename: shop_<id>.png)
 *    기본         →  dataURL 또는 PNG 스트림
 */
const qrQuerySchema = z.object({ download: z.coerce.number().int().min(0).max(1).optional() });

export const getShopQR = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.id);
  const parsed = qrQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return; }

  /** 1. 가게 존재 확인 */
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    res.status(404).json({ error: 'Shop not found' });
    return;
  }

  /** 2. payload = base64(shopId) */
  const payload = String(shopId);

  /** 3. PNG 생성 */
  res.type('png');

  // 다운로드 옵션
  if (req.query.download) {
    res.setHeader('Content-Disposition', `attachment; filename=shop_${shopId}.png`);
  }

  // QRCode.toFileStream: 스트림으로 바로 응답
  await QRCode.toFileStream(res, payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256
  });
};
