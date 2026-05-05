import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');
const shortTextSchema = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} too long`);

// User schemas
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  name: shortTextSchema('Name', 100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254, 'Email too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

export const googleAuthSchema = z.object({
  token: z.string().trim().min(1, 'Google token is required').max(4096, 'Google token too long'),
});

// Wardrobe item schemas
export const wardrobeItemSchema = z.object({
  name: shortTextSchema('Name', 100),
  color: shortTextSchema('Color', 50),
  type: z.enum(['top', 'bottom', 'shoes', 'accessory'], {
    errorMap: () => ({ message: 'Type must be one of: top, bottom, shoes, accessory' }),
  }),
  formality: z.enum(['casual', 'smart casual', 'formal'], {
    errorMap: () => ({ message: 'Formality must be one of: casual, smart casual, formal' }),
  }),
});

export const wardrobeItemIdSchema = z.object({
  id: objectIdSchema,
});

// AI service schemas
export const outfitSuggestionSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  lockedItemId: objectIdSchema.optional().nullable(),
});

const outfitPartSchema = z.object({
  name: shortTextSchema('Item name', 100),
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason too long'),
});

export const outfitImageSchema = z.object({
  suggestion: z.object({
    occasion: shortTextSchema('Occasion', 120),
    top: outfitPartSchema,
    bottom: outfitPartSchema,
    shoes: outfitPartSchema,
    accessory: outfitPartSchema,
    stylistNote: z.string().trim().min(1, 'Stylist note is required').max(1000, 'Stylist note too long'),
    wardrobeGap: z.string().trim().max(500, 'Wardrobe gap too long').optional(),
    wardrobeGapSearchTerm: z.string().trim().max(100, 'Wardrobe gap search term too long').optional(),
  }),
});

export const analyzeItemSchema = z.object({
  imageBase64: z.string().min(100, 'Image data is required').max(5_000_000, 'Image too large'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], {
    errorMap: () => ({ message: 'Image must be JPEG, PNG, WebP, or HEIC' }),
  }),
  hint: z.string().trim().max(500).optional(),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type WardrobeItemInput = z.infer<typeof wardrobeItemSchema>;
export type OutfitSuggestionInput = z.infer<typeof outfitSuggestionSchema>;
export type OutfitImageInput = z.infer<typeof outfitImageSchema>;
export type AnalyzeItemInput = z.infer<typeof analyzeItemSchema>;
