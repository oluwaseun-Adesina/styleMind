import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;

export type AuthPayload = {
  userId: string;
  email: string;
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Extracts and verifies JWT token from Authorization header
 */
export const authenticateToken = (
  request: Request,
  _response: Response,
  next: NextFunction
): void => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new AppError('Unauthorized', 401);
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    request.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401);
    }
    throw new AppError('Authentication failed', 401);
  }
};

/**
 * Optional auth - sets user if present, continues regardless
 */
export const optionalAuth = (
  request: Request,
  _response: Response,
  next: NextFunction
): void => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    request.user = payload;
  } catch {
    // Ignore auth errors for optional auth
  }

  next();
};
