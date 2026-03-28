import { Router } from 'express';
import { getLookbook, saveOutfit, removeOutfit } from '../controllers/lookbookController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getLookbook);
router.post('/', saveOutfit);
router.delete('/:id', removeOutfit);

export default router;
