import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as aiService from '../services/aiService.js';

/**
 * POST /api/outfit-suggestion
 * Generate outfit suggestion based on wardrobe and context
 */
export const getSuggestion = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.getOutfitSuggestion(req.user!.userId, req.body);
  
  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/outfit-image
 * Generate a visual image for an outfit suggestion
 */
export const getOutfitImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.getOutfitImage(req.user!.userId, req.body);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/analyze-item
 * Analyze clothing item from image
 */
export const analyzeItem = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.analyzeClothingItem(req.body);
  
  res.json({
    success: true,
    data: result,
  });
});
