import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { signToken, verifyToken } from '../utils/jwt';

let refreshTokens: string[] = [];  // 메모리 저장 (운영에선 DB/Redis)

export const login = async (req: Request, res: Response): Promise<void> => {
  const { name, phoneLast4 } = req.body;
  if (!name || !phoneLast4) {
    res.status(400).json({ error: 'Name and phoneLast4 required' });
    return;
  }

  try {
    const user = await prisma.employee.findFirst({
      where: {
        name,
        phone: { endsWith: phoneLast4 }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signToken({
      employeeId: user.id,
      shopId: user.shopId,
      role: user.role
    },  { expiresIn: '15m' });

    const refreshToken = signToken({
      employeeId: user.id
    }, { expiresIn: '7d' });

    refreshTokens.push(refreshToken);

    res.json({ accessToken, refreshToken });
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
      employeeId: decoded.employeeId
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