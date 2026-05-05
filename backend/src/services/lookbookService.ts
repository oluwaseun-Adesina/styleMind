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
  createdAt: Date;
};

/**
 * Get all saved outfits for a user
 */
export const getLookbook = async (userId: string): Promise<SavedOutfitResult[]> => {
  const outfits = await SavedOutfit.find({ uid: userId })
    .sort({ createdAt: -1 })
    .lean();

  return outfits.map(outfit => ({
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
    createdAt: outfit.createdAt,
  }));
};

/**
 * Save a new outfit
 */
export const saveOutfit = async (
  userId: string,
  outfitData: Omit<SavedOutfitResult, 'id' | 'uid' | 'createdAt'>
): Promise<SavedOutfitResult> => {
  const newOutfit = new SavedOutfit({
    ...outfitData,
    uid: userId,
  });

  await newOutfit.save();

  return {
    id: newOutfit._id.toString(),
    uid: newOutfit.uid.toString(),
    occasion: newOutfit.occasion,
    top: newOutfit.top,
    bottom: newOutfit.bottom,
    shoes: newOutfit.shoes,
    accessory: newOutfit.accessory,
    stylistNote: newOutfit.stylistNote || undefined,
    wardrobeGap: newOutfit.wardrobeGap || undefined,
    wardrobeGapSearchTerm: newOutfit.wardrobeGapSearchTerm || undefined,
    createdAt: newOutfit.createdAt,
  };
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
