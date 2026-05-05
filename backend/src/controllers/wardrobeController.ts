import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as wardrobeService from '../services/wardrobeService.js';

/**
 * GET /api/wardrobes
 * Get all wardrobe items for current user
 */
export const getWardrobe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items = await wardrobeService.getWardrobeItems(userId);
  
  res.json({
    success: true,
    data: items,
    count: items.length,
  });
});

/**
 * POST /api/wardrobes
 * Add new wardrobe item
 */
export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const item = await wardrobeService.addWardrobeItem(userId, req.body);
  
  res.status(201).json({
    success: true,
    data: item,
  });
});

/**
 * DELETE /api/wardrobes/:id
 * Remove wardrobe item
 */
export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await wardrobeService.removeWardrobeItem(userId, req.params.id);
  
  res.json({
    success: true,
    message: 'Item removed successfully',
  });
});
