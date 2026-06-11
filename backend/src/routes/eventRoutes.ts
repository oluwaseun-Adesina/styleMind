import { Router } from 'express';
import { getEvents, addEvent, removeEvent } from '../controllers/eventController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { eventSchema, eventIdSchema } from '../utils/schemas.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getEvents);
router.post('/', validateBody(eventSchema), addEvent);
router.delete('/:id', validateParams(eventIdSchema), removeEvent);

export default router;
