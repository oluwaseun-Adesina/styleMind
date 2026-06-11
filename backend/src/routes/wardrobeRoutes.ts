import { Router } from 'express';
import { getWardrobe, addItem, updateItem, removeItem } from '../controllers/wardrobeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { wardrobeItemSchema, wardrobeItemIdSchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getWardrobe);
router.post('/', validateBody(wardrobeItemSchema), addItem);
router.put('/:id', validateParams(wardrobeItemIdSchema), validateBody(wardrobeItemSchema), updateItem);
router.delete('/:id', validateParams(wardrobeItemIdSchema), removeItem);

export default router;
