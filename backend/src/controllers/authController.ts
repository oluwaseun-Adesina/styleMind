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
 * POST /api/auth/refresh
 * Exchange a refresh token for a fresh access + refresh token pair
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshSession(req.body.refreshToken);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/auth/forgot-password
 * Email a 6-digit reset code. Always responds with success to avoid
 * revealing which emails have accounts.
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  console.log(`[Auth] Password reset requested for email: ${req.body.email}`);
  await authService.forgotPassword(req.body);

  res.json({
    success: true,
    data: { message: 'If an account exists for that email, a reset code has been sent.' },
  });
});

/**
 * POST /api/auth/reset-password
 * Verify the emailed code and set a new password. Returns a session.
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body);
  console.log(`[Auth] Password reset completed for user: ${result.user.id}`);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/auth/me
 * Current user's profile (includes hasPassword for the settings UI).
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.getMe(req.user!.userId);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /api/auth/me
 * Update profile fields (currently: name).
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.updateProfile(req.user!.userId, req.body);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/auth/change-password
 * Change the password (or set one, for Google-only accounts).
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.userId, req.body);
  console.log(`[Auth] Password changed for user: ${req.user!.userId}`);

  res.json({
    success: true,
    data: { message: 'Password updated' },
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
