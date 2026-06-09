import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as authService from '../services/authService.js';

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  console.log(`[Auth] Attempting Google OAuth login...`);
  const result = await authService.googleAuth(req.body);
  console.log(`[Auth] Google OAuth login succeeded for user: ${result.user.email}`);
  
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
  console.log(`[Auth] Creating new user account: ${req.body.email}`);
  const result = await authService.signup(req.body);
  console.log(`[Auth] User registration succeeded: ${result.user.id}`);
  
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
  console.log(`[Auth] Login attempt for email: ${req.body.email}`);
  const result = await authService.login(req.body);
  console.log(`[Auth] Login successful for user: ${result.user.id}`);
  
  res.json({
    success: true,
    data: result,
  });
});
