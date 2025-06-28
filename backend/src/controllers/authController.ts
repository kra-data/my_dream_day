import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { signToken, verifyToken } from '../utils/jwt';

let refreshTokens: string[] = [];  // 메모리 저장 (운영에선 DB/Redis)

export const login = async (req: Request, res: Response): Promise<void> => {
  const { name, phoneLastFour } = req.body;
  if (!name || !phoneLastFour) {
    res.status(400).json({ error: 'Name and phoneLastFour required' });
    return;
  }

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

    const role= user.role;

    res.json({ accessToken, refreshToken});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const refresh = (req: Request, res: Response): void => {
  const { token } = req.body;
  if (!token || !refreshTokens.includes(token)) {
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

export const logout = (req: Request, res: Response): void => {
  const { token } = req.body;
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
