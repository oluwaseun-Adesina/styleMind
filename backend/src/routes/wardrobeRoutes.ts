import { Router } from 'express';
import { getWardrobe, addItem, removeItem } from '../controllers/wardrobeController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getWardrobe);
router.post('/', addItem);
router.delete('/:id', removeItem);

export default router;
