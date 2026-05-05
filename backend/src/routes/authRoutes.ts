import { Router } from 'express';
import { googleAuth, signup, login } from '../controllers/authController.js';
import { validateBody } from '../middleware/validation.js';
import { signupSchema, loginSchema, googleAuthSchema } from '../utils/schemas.js';

const router = Router();

router.post('/google', validateBody(googleAuthSchema), googleAuth);
router.post('/signup', validateBody(signupSchema), signup);
router.post('/login', validateBody(loginSchema), login);

export default router;
