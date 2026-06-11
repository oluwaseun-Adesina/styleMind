import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as eventService from '../services/eventService.js';

/**
 * GET /api/events?from=YYYY-MM-DD
 * List the current user's events (optionally only from a date forward).
 */
export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const events = await eventService.getEvents(req.user!.userId, from);
  res.json({ success: true, data: events, count: events.length });
});

/**
 * POST /api/events
 */
export const addEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.addEvent(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: event });
});

/**
 * DELETE /api/events/:id
 */
export const removeEvent = asyncHandler(async (req: Request, res: Response) => {
  await eventService.removeEvent(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Event removed successfully' });
});
