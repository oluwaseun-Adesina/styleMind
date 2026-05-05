import { z } from 'zod';

// User schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  token: z.string().min(1, 'Google token is required'),
});

// Wardrobe item schemas
export const wardrobeItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().min(1, 'Color is required'),
  type: z.enum(['top', 'bottom', 'shoes', 'accessory'], {
    errorMap: () => ({ message: 'Type must be one of: top, bottom, shoes, accessory' }),
  }),
  formality: z.enum(['casual', 'smart casual', 'formal'], {
    errorMap: () => ({ message: 'Formality must be one of: casual, smart casual, formal' }),
  }),
});

export const wardrobeItemIdSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
});

// AI service schemas
export const outfitSuggestionSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  wardrobe: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    type: z.enum(['top', 'bottom', 'shoes', 'accessory']),
    formality: z.enum(['casual', 'smart casual', 'formal']),
  })).min(1, 'At least one wardrobe item is required'),
  lat: z.number().optional(),
  lon: z.number().optional(),
  lockedItemId: z.string().optional().nullable(),
});

export const analyzeItemSchema = z.object({
  imageBase64: z.string().min(100, 'Image data is required').max(5_000_000, 'Image too large'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], {
    errorMap: () => ({ message: 'Image must be JPEG, PNG, WebP, or HEIC' }),
  }),
  hint: z.string().max(500).optional(),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type WardrobeItemInput = z.infer<typeof wardrobeItemSchema>;
export type OutfitSuggestionInput = z.infer<typeof outfitSuggestionSchema>;
export type AnalyzeItemInput = z.infer<typeof analyzeItemSchema>;
