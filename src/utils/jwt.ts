import jwt, { Secret, SignOptions } from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'your-secret-key') as Secret;
const JWT_REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET || 'your-refresh-secret') as Secret;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '24h'; // ✅ 24 ساعة للـ Development
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

export interface JWTPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRATION as SignOptions['expiresIn'] }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION as SignOptions['expiresIn'] }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 86400, // ✅ 24 ساعة بالثواني (24 * 60 * 60)
  };
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
};

