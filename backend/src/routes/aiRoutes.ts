import { Router } from 'express';
import { getSuggestion, getOutfitImage, analyzeItem } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { outfitSuggestionSchema, outfitImageSchema, analyzeItemSchema } from '../utils/schemas.js';

const router = Router();

// All AI routes require authentication
router.use(authenticateToken);

router.post('/outfit-suggestion', validateBody(outfitSuggestionSchema), getSuggestion);
router.post('/outfit-image', validateBody(outfitImageSchema), getOutfitImage);
router.post('/analyze-item', validateBody(analyzeItemSchema), analyzeItem);

export default router;
