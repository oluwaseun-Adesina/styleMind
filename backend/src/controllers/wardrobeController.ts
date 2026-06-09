import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as wardrobeService from '../services/wardrobeService.js';

/**
 * GET /api/wardrobes
 * Get all wardrobe items for current user
 */
export const getWardrobe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  console.log(`[Wardrobe] Fetching wardrobe items for user: ${userId}`);
  const items = await wardrobeService.getWardrobeItems(userId);
  console.log(`[Wardrobe] Found ${items.length} items for user: ${userId}`);
  
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
  console.log(`[Wardrobe] Adding new item for user: ${userId}, item: ${req.body.name} (${req.body.type})`);
  const item = await wardrobeService.addWardrobeItem(userId, req.body);
  console.log(`[Wardrobe] Successfully added item: ${item.id} for user: ${userId}`);
  
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
  const itemId = req.params.id;
  console.log(`[Wardrobe] Request to remove item: ${itemId} by user: ${userId}`);
  await wardrobeService.removeWardrobeItem(userId, itemId);
  console.log(`[Wardrobe] Successfully removed item: ${itemId} for user: ${userId}`);
  
  res.json({
    success: true,
    message: 'Item removed successfully',
  });
});
