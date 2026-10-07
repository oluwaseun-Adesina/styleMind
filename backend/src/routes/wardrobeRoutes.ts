import { Router } from 'express';
import { getWardrobe, addItem, addItems, updateItem, removeItem } from '../controllers/wardrobeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { wardrobeItemSchema, wardrobeItemIdSchema, bulkWardrobeItemsSchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getWardrobe);
router.post('/', validateBody(wardrobeItemSchema), addItem);
router.post('/bulk', validateBody(bulkWardrobeItemsSchema), addItems);
router.put('/:id', validateParams(wardrobeItemIdSchema), validateBody(wardrobeItemSchema), updateItem);
router.delete('/:id', validateParams(wardrobeItemIdSchema), removeItem);

export default router;
