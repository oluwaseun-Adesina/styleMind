import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';
import * as wardrobeService from '../services/wardrobeService.js';

/**
 * GET /api/wardrobes
 * Get all wardrobe items for current user
 */
export const getWardrobe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items = await wardrobeService.getWardrobeItems(userId);
  logger.debug(`[Wardrobe] Found ${items.length} items for user: ${userId}`);

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
  logger.audit('wardrobe.item_added', {
    userId,
    ip: req.ip,
    metadata: { itemId: item.id, name: item.name, type: item.type },
  });

  res.status(201).json({
    success: true,
    data: item,
  });
});

/**
 * POST /api/wardrobes/bulk
 * Add several wardrobe items in one request (bulk photo upload)
 */
export const addItems = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items = await wardrobeService.addWardrobeItems(userId, req.body.items);
  logger.audit('wardrobe.items_bulk_added', {
    userId,
    ip: req.ip,
    metadata: { count: items.length, itemIds: items.map((item) => item.id) },
  });

  res.status(201).json({
    success: true,
    data: items,
    count: items.length,
  });
});

/**
 * PUT /api/wardrobes/:id
 * Update wardrobe item
 */
export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const itemId = req.params.id;
  const item = await wardrobeService.updateWardrobeItem(userId, itemId, req.body);
  logger.audit('wardrobe.item_updated', {
    userId,
    ip: req.ip,
    metadata: { itemId, fields: Object.keys(req.body) },
  });

  res.json({
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
  await wardrobeService.removeWardrobeItem(userId, itemId);
  logger.audit('wardrobe.item_removed', {
    userId,
    ip: req.ip,
    metadata: { itemId },
  });

  res.json({
    success: true,
    message: 'Item removed successfully',
  });
});
