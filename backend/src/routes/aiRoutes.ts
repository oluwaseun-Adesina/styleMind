import { Router } from 'express';
import { getSuggestion, analyzeItem } from '../controllers/aiController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/outfit-suggestion', getSuggestion);
router.post('/analyze-item', analyzeItem);

export default router;
