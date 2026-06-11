import mongoose from 'mongoose';
import { SavedOutfit } from '../models/SavedOutfit.js';
import { AppError } from '../utils/errors.js';

export type OutfitItem = {
  name: string;
  reason: string;
};

export type SavedOutfitResult = {
  id: string;
  uid: string;
  occasion: string;
  top: OutfitItem;
  bottom: OutfitItem;
  shoes: OutfitItem;
  accessory: OutfitItem;
  stylistNote?: string;
  wardrobeGap?: string;
  wardrobeGapSearchTerm?: string;
  wornCount: number;
  lastWornAt: Date | null;
  createdAt: Date;
};

const toResult = (outfit: any): SavedOutfitResult => ({
  id: (outfit._id as mongoose.Types.ObjectId).toString(),
  uid: outfit.uid.toString(),
  occasion: outfit.occasion,
  top: outfit.top,
  bottom: outfit.bottom,
  shoes: outfit.shoes,
  accessory: outfit.accessory,
  stylistNote: outfit.stylistNote || undefined,
  wardrobeGap: outfit.wardrobeGap || undefined,
  wardrobeGapSearchTerm: outfit.wardrobeGapSearchTerm || undefined,
  wornCount: outfit.wornCount ?? 0,
  lastWornAt: outfit.lastWornAt ?? null,
  createdAt: outfit.createdAt,
});

/**
 * Get all saved outfits for a user
 */
export const getLookbook = async (userId: string): Promise<SavedOutfitResult[]> => {
  const outfits = await SavedOutfit.find({ uid: userId })
    .sort({ createdAt: -1 })
    .lean();

  return outfits.map(toResult);
};

/**
 * Item names the user has worn recently — used to encourage variety in
 * auto-generated suggestions so they don't repeat the same look.
 */
export const getRecentlyWornItemNames = async (
  userId: string,
  withinDays = 7,
  limit = 5
): Promise<string[]> => {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

  const outfits = await SavedOutfit.find({
    uid: userId,
    lastWornAt: { $gte: since },
  })
    .sort({ lastWornAt: -1 })
    .limit(limit)
    .lean();

  const names = new Set<string>();
  for (const outfit of outfits) {
    for (const part of [outfit.top, outfit.bottom, outfit.shoes, outfit.accessory]) {
      if (part?.name) names.add(part.name);
    }
  }
  return [...names];
};

/**
 * Mark an outfit as worn today (increments wear count, stamps lastWornAt).
 */
export const markOutfitWorn = async (
  userId: string,
  outfitId: string
): Promise<SavedOutfitResult> => {
  const outfit = await SavedOutfit.findOneAndUpdate(
    { _id: outfitId, uid: userId },
    { $inc: { wornCount: 1 }, $set: { lastWornAt: new Date() } },
    { returnDocument: 'after' }
  ).lean();

  if (!outfit) {
    throw new AppError('Outfit not found or unauthorized', 404);
  }

  return toResult(outfit);
};

/**
 * Save a new outfit
 */
export const saveOutfit = async (
  userId: string,
  outfitData: Omit<SavedOutfitResult, 'id' | 'uid' | 'createdAt' | 'wornCount' | 'lastWornAt'>
): Promise<SavedOutfitResult> => {
  const newOutfit = new SavedOutfit({
    ...outfitData,
    uid: userId,
  });

  await newOutfit.save();

  return toResult(newOutfit.toObject());
};

/**
 * Remove a saved outfit
 */
export const removeOutfit = async (
  userId: string,
  outfitId: string
): Promise<void> => {
  const result = await SavedOutfit.findOneAndDelete({
    _id: outfitId,
    uid: userId,
  });

  if (!result) {
    throw new AppError('Outfit not found or unauthorized', 404);
  }
};
