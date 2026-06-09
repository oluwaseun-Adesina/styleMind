import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as lookbookService from '../services/lookbookService.js';

/**
 * GET /api/saved_outfits
 * Get all saved outfits for current user
 */
export const getLookbook = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  console.log(`[Lookbook] Fetching saved outfits for user: ${userId}`);
  const outfits = await lookbookService.getLookbook(userId);
  console.log(`[Lookbook] Found ${outfits.length} saved outfits for user: ${userId}`);
  
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
  console.log(`[Lookbook] Saving outfit suggestion for user: ${userId}, occasion: "${req.body.occasion}"`);
  const outfit = await lookbookService.saveOutfit(userId, req.body);
  console.log(`[Lookbook] Successfully saved outfit: ${outfit.id} for user: ${userId}`);
  
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
  const outfitId = req.params.id;
  console.log(`[Lookbook] Request to remove saved outfit: ${outfitId} by user: ${userId}`);
  await lookbookService.removeOutfit(userId, outfitId);
  console.log(`[Lookbook] Successfully removed saved outfit: ${outfitId} for user: ${userId}`);
  
  res.json({
    success: true,
    message: 'Outfit removed successfully',
  });
});
