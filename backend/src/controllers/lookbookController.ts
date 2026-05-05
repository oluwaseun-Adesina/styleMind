import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as lookbookService from '../services/lookbookService.js';

/**
 * GET /api/saved_outfits
 * Get all saved outfits for current user
 */
export const getLookbook = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const outfits = await lookbookService.getLookbook(userId);
  
  res.json({
    success: true,
    data: outfits,
    count: outfits.length,
  });
});

/**
 * POST /api/saved_outfits
 * Save a new outfit
 */
export const saveOutfit = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const outfit = await lookbookService.saveOutfit(userId, req.body);
  
  res.status(201).json({
    success: true,
    data: outfit,
  });
});

/**
 * DELETE /api/saved_outfits/:id
 * Remove saved outfit
 */
export const removeOutfit = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await lookbookService.removeOutfit(userId, req.params.id);
  
  res.json({
    success: true,
    message: 'Outfit removed successfully',
  });
});
