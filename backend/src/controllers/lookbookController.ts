import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';
import * as lookbookService from '../services/lookbookService.js';

/**
 * GET /api/saved_outfits
 * Get all saved outfits for current user
 */
export const getLookbook = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const outfits = await lookbookService.getLookbook(userId);
  logger.debug(`[Lookbook] Found ${outfits.length} saved outfits for user: ${userId}`);

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
  logger.audit('lookbook.outfit_saved', {
    userId,
    ip: req.ip,
    metadata: { outfitId: outfit.id, occasion: req.body.occasion },
  });

  res.status(201).json({
    success: true,
    data: outfit,
  });
});

/**
 * POST /api/saved_outfits/:id/worn
 * Mark a saved outfit as worn today
 */
export const markWorn = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const outfitId = req.params.id;
  const outfit = await lookbookService.markOutfitWorn(userId, outfitId);
  logger.audit('lookbook.outfit_worn', {
    userId,
    ip: req.ip,
    metadata: { outfitId },
  });

  res.json({
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
  await lookbookService.removeOutfit(userId, outfitId);
  logger.audit('lookbook.outfit_removed', {
    userId,
    ip: req.ip,
    metadata: { outfitId },
  });

  res.json({
    success: true,
    message: 'Outfit removed successfully',
  });
});
