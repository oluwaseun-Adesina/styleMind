import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as authService from '../services/authService.js';

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.googleAuth(req.body);
  
  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/auth/signup
 * Register new user
 */
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);
  
  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/auth/login
 * Login existing user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  
  res.json({
    success: true,
    data: result,
  });
});
