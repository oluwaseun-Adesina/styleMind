import { Wardrobe } from '../models/Wardrobe.js';
import { AppError } from '../utils/errors.js';
import type { WardrobeItemInput } from '../utils/schemas.js';

export type WardrobeItem = {
  id: string;
  name: string;
  color: string;
  type: string;
  formality: string;
  uid: string;
};

/**
 * Get all wardrobe items for a user
 */
export const getWardrobeItems = async (userId: string): Promise<WardrobeItem[]> => {
  const items = await Wardrobe.find({ uid: userId });
  
  return items.map(item => ({
    id: item._id.toString(),
    name: item.name,
    color: item.color,
    type: item.type,
    formality: item.formality,
    uid: item.uid.toString(),
  }));
};

/**
 * Add a new wardrobe item
 */
export const addWardrobeItem = async (
  userId: string,
  input: WardrobeItemInput
): Promise<WardrobeItem> => {
  const newItem = new Wardrobe({
    ...input,
    uid: userId,
  });

  await newItem.save();

  return {
    id: newItem._id.toString(),
    name: newItem.name,
    color: newItem.color,
    type: newItem.type,
    formality: newItem.formality,
    uid: newItem.uid.toString(),
  };
};

/**
 * Remove a wardrobe item
 */
export const removeWardrobeItem = async (
  userId: string,
  itemId: string
): Promise<void> => {
  const result = await Wardrobe.findOneAndDelete({
    _id: itemId,
    uid: userId,
  });

  if (!result) {
    throw new AppError('Item not found or unauthorized', 404);
  }
};

/**
 * Get wardrobe item by ID
 */
export const getWardrobeItemById = async (
  userId: string,
  itemId: string
): Promise<WardrobeItem> => {
  const item = await Wardrobe.findOne({
    _id: itemId,
    uid: userId,
  });

  if (!item) {
    throw new AppError('Item not found', 404);
  }

  return {
    id: item._id.toString(),
    name: item.name,
    color: item.color,
    type: item.type,
    formality: item.formality,
    uid: item.uid.toString(),
  };
};

/**
 * Get wardrobe count for a user
 */
export const getWardrobeCount = async (userId: string): Promise<number> => {
  return Wardrobe.countDocuments({ uid: userId });
};
