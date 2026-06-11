import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { AppError } from '../utils/errors.js';
import type { EventInput } from '../utils/schemas.js';

export type EventResult = {
  id: string;
  title: string;
  date: string;
  time?: string;
  createdAt: Date;
};

const toResult = (event: any): EventResult => ({
  id: (event._id as mongoose.Types.ObjectId).toString(),
  title: event.title,
  date: event.date,
  time: event.time || undefined,
  createdAt: event.createdAt,
});

/**
 * List a user's events. By default only upcoming ones (date >= `from`),
 * soonest first.
 */
export const getEvents = async (
  userId: string,
  from?: string
): Promise<EventResult[]> => {
  const query: Record<string, unknown> = { uid: userId };
  if (from) query.date = { $gte: from };

  const events = await Event.find(query).sort({ date: 1, time: 1 }).lean();
  return events.map(toResult);
};

export const addEvent = async (userId: string, input: EventInput): Promise<EventResult> => {
  const event = await Event.create({ ...input, uid: userId });
  return toResult(event.toObject());
};

export const removeEvent = async (userId: string, eventId: string): Promise<void> => {
  const result = await Event.findOneAndDelete({ _id: eventId, uid: userId });
  if (!result) {
    throw new AppError('Event not found or unauthorized', 404);
  }
};

/**
 * The soonest event on a given calendar date, if any — used to auto-pick the
 * occasion for the daily suggestion.
 */
export const getEventForDate = async (
  userId: string,
  date: string
): Promise<EventResult | null> => {
  const event = await Event.findOne({ uid: userId, date }).sort({ time: 1 }).lean();
  return event ? toResult(event) : null;
};
