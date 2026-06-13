import { Router } from 'express';
import {
  googleAuth,
  signup,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../controllers/authController.js';
import { validateBody } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  signupSchema,
  loginSchema,
  googleAuthSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  deleteAccountSchema,
} from '../utils/schemas.js';

const router = Router();

router.post('/google', validateBody(googleAuthSchema), googleAuth);
router.post('/signup', validateBody(signupSchema), signup);
router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', validateBody(refreshSchema), refresh);
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

// Account settings (authenticated)
router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, validateBody(updateProfileSchema), updateProfile);
router.post('/change-password', authenticateToken, validateBody(changePasswordSchema), changePassword);
router.delete('/me', authenticateToken, validateBody(deleteAccountSchema), deleteAccount);

export default router;
