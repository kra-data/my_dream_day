import { Request, Response } from 'express';

export const healthCheck = (req: Request, res: Response) => {
  res.json({ ok: true, message: 'Server is healthy' });
};
