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
  image?: string;
  uid: string;
};

const toWardrobeItem = (item: {
  _id: { toString(): string };
  name: string;
  color: string;
  type: string;
  formality: string;
  description?: string | null;
  image?: string | null;
  uid: { toString(): string };
}): WardrobeItem => ({
  id: item._id.toString(),
  name: item.name,
  color: item.color,
  type: item.type,
  formality: item.formality,
  description: item.description || undefined,
  image: item.image || undefined,
  uid: item.uid.toString(),
});

/**
 * Get all wardrobe items for a user. Pass `includeImages: false` when the
 * caller only needs text fields (e.g. building an AI prompt) to avoid loading
 * every thumbnail.
 */
export const getWardrobeItems = async (
  userId: string,
  { includeImages = true }: { includeImages?: boolean } = {}
): Promise<WardrobeItem[]> => {
  const query = Wardrobe.find({ uid: userId });
  if (!includeImages) query.select('-image');
  const items = await query;

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
 * Add several wardrobe items at once (bulk upload). All-or-nothing: the input
 * is already validated, so a failure here is a server error, not bad data.
 */
export const addWardrobeItems = async (
  userId: string,
  inputs: WardrobeItemInput[]
): Promise<WardrobeItem[]> => {
  const created = await Wardrobe.insertMany(inputs.map((input) => ({ ...input, uid: userId })));
  return created.map(toWardrobeItem);
};

/**
 * Update a wardrobe item (owner-scoped)
 */
export const updateWardrobeItem = async (
  userId: string,
  itemId: string,
  input: WardrobeItemInput
): Promise<WardrobeItem> => {
  const fields: Record<string, string> = {
    name: input.name,
    color: input.color,
    type: input.type,
    formality: input.formality,
  };
  // A new photo replaces the old one; omitting it keeps the existing photo so
  // text-only edits don't have to re-upload it.
  if (input.image) fields.image = input.image;

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
