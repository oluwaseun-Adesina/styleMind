import { Wardrobe } from '../models/Wardrobe.js';
import { AppError } from '../utils/errors.js';
import type { WardrobeItemInput } from '../utils/schemas.js';

export type WardrobeItem = {
  id: string;
  name: string;
  color: string;
  type: string;
  formality: string;
  description?: string;
  uid: string;
};

const toWardrobeItem = (item: {
  _id: { toString(): string };
  name: string;
  color: string;
  type: string;
  formality: string;
  description?: string | null;
  uid: { toString(): string };
}): WardrobeItem => ({
  id: item._id.toString(),
  name: item.name,
  color: item.color,
  type: item.type,
  formality: item.formality,
  description: item.description || undefined,
  uid: item.uid.toString(),
});

/**
 * Get all wardrobe items for a user
 */
export const getWardrobeItems = async (userId: string): Promise<WardrobeItem[]> => {
  const items = await Wardrobe.find({ uid: userId });

  return items.map(toWardrobeItem);
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

  return toWardrobeItem(newItem);
};

/**
 * Update a wardrobe item (owner-scoped)
 */
export const updateWardrobeItem = async (
  userId: string,
  itemId: string,
  input: WardrobeItemInput
): Promise<WardrobeItem> => {
  const fields = {
    name: input.name,
    color: input.color,
    type: input.type,
    formality: input.formality,
  };

  // An omitted/empty description clears the field rather than keeping stale
  // text — undefined values are stripped by Mongoose, so $unset explicitly.
  const update = input.description
    ? { $set: { ...fields, description: input.description } }
    : { $set: fields, $unset: { description: 1 } };

  const item = await Wardrobe.findOneAndUpdate(
    { _id: itemId, uid: userId },
    update,
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError('Item not found or unauthorized', 404);
  }

  return toWardrobeItem(item);
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

  return toWardrobeItem(item);
};

/**
 * Get wardrobe count for a user
 */
export const getWardrobeCount = async (userId: string): Promise<number> => {
  return Wardrobe.countDocuments({ uid: userId });
};
