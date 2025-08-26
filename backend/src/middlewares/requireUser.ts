// middlewares/requireUser.ts
import { NextFunction, RequestHandler, Response } from 'express';
import { AuthRequest, JwtPayload } from './jwtMiddleware';

export type AuthRequiredRequest = AuthRequest & { user: JwtPayload };

export const requireUser: RequestHandler = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

// 콜백에 AuthRequiredRequest 타입을 “제공”하는 래퍼
type UserHandler = (req: AuthRequiredRequest, res: Response, next: NextFunction) => any;

export const withUser = (handler: UserHandler): RequestHandler => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    return handler(req as AuthRequiredRequest, res, next);
  };
};
