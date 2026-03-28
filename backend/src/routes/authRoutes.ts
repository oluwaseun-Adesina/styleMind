import { Router } from 'express';
import { googleAuth, signup, login } from '../controllers/authController';

const router = Router();

router.post('/google', googleAuth);
router.post('/signup', signup);
router.post('/login', login);

export default router;
