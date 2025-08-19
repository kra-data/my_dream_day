import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { signToken, verifyToken } from '../utils/jwt';

let refreshTokens: string[] = [];  // 메모리 저장 (운영에선 DB/Redis)

const loginSchema = z.object({
  name: z.string().min(1),
  phoneLastFour: z.string().min(4).max(4).regex(/^\d{4}$/)
});

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { name, phoneLastFour } = parsed.data;

  try {
    const user = await prisma.employee.findFirst({
      where: {
        name,
        phone: { endsWith: phoneLastFour }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signToken({
      userId: user.id,
      shopId: user.shopId,
      role: user.role
    },  { expiresIn: '1d' });

    const refreshToken = signToken({
      userId: user.id
    }, { expiresIn: '7d' });

    refreshTokens.push(refreshToken);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const refreshSchema = z.object({ token: z.string().min(1) });

export const refresh = (req: Request, res: Response): void => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { token } = parsed.data;
  if (!refreshTokens.includes(token)) {
    res.status(403).json({ error: 'Refresh token invalid' });
    return;
  }

  try {
    const decoded = verifyToken(token) as any;
    const accessToken = signToken({
      userId: decoded.userId
    },  { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

const logoutSchema = z.object({ token: z.string().min(1) });

export const logout = (req: Request, res: Response): void => {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const { token } = parsed.data;
  refreshTokens = refreshTokens.filter(t => t !== token);
  res.json({ message: 'Logged out' });
};

export const validateAccessToken = (req: Request, res: Response): void => {
  const auth = req.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ valid: false, error: 'No token provided' });
    return;
  }

  const token = auth.split(' ')[1];

  try {
    const decoded = verifyToken(token) as {
      userId: number;
      shopId: number;
      role: string;
      exp: number; // 초 단위 Unix Time
      iat: number;
    };

    res.json({
      valid: true,
      userId: decoded.userId,
      shopId: decoded.shopId,
      role: decoded.role,
      exp: decoded.exp
    });
  } catch (err) {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
};
