import { NextFunction, Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json({ error: message });
};


