import jwt from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'defaultsecret') as jwt.Secret;

export const signToken = (payload: object, options: jwt.SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
