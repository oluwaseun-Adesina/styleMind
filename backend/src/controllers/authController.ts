import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';
import * as authService from '../services/authService.js';

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('[Auth] Attempting Google OAuth login...');
  const result = await authService.googleAuth(req.body);
  logger.audit('auth.google_login', {
    userId: result.user.id,
    ip: req.ip,
    metadata: { email: result.user.email },
  });

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
  logger.debug(`[Auth] Creating new user account: ${req.body.email}`);
  const result = await authService.signup(req.body);
  logger.audit('auth.signup', {
    userId: result.user.id,
    ip: req.ip,
    metadata: { email: result.user.email },
  });

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
  logger.audit('auth.password_reset_requested', {
    ip: req.ip,
    metadata: { email: req.body.email },
  });
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
  logger.audit('auth.password_reset', { userId: result.user.id, ip: req.ip });

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
  logger.audit('auth.profile_updated', {
    userId: req.user!.userId,
    ip: req.ip,
    metadata: { fields: Object.keys(req.body) },
  });

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
  logger.audit('auth.password_changed', { userId: req.user!.userId, ip: req.ip });

  res.json({
    success: true,
    data: { message: 'Password updated' },
  });
});

/**
 * DELETE /api/auth/me
 * Permanently delete the account and all associated data.
 * Required by Google Play's account-deletion policy.
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await authService.deleteAccount(userId, req.body);
  logger.audit('auth.account_deleted', {
    userId,
    ip: req.ip,
    metadata: { email: result.email },
  });

  res.json({
    success: true,
    data: { message: 'Account deleted' },
  });
});

/**
 * POST /api/auth/login
 * Login existing user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  logger.debug(`[Auth] Login attempt for email: ${req.body.email}`);
  const result = await authService.login(req.body);
  logger.audit('auth.login', {
    userId: result.user.id,
    ip: req.ip,
    metadata: { email: result.user.email },
  });

  res.json({
    success: true,
    data: result,
  });
});
