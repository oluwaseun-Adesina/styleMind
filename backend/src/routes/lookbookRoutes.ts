import { Router } from 'express';
import { getLookbook, saveOutfit, removeOutfit } from '../controllers/lookbookController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Outfit item schema for validation
const outfitItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100, 'Item name too long'),
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason too long'),
});

const saveOutfitSchema = z.object({
  occasion: z.string().trim().min(1, 'Occasion is required').max(120, 'Occasion too long'),
  top: outfitItemSchema,
  bottom: outfitItemSchema,
  shoes: outfitItemSchema,
  accessory: outfitItemSchema,
  stylistNote: z.string().trim().max(1000, 'Stylist note too long').optional(),
  wardrobeGap: z.string().trim().max(500, 'Wardrobe gap too long').optional(),
  wardrobeGapSearchTerm: z.string().trim().max(100, 'Wardrobe gap search term too long').optional(),
});

const outfitIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
});

router.get('/', getLookbook);
router.post('/', validateBody(saveOutfitSchema), saveOutfit);
router.delete('/:id', validateParams(outfitIdSchema), removeOutfit);

export default router;
