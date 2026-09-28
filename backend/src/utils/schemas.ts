import { z } from 'zod';
import { MAX_BULK_ANALYZE_IMAGES, MAX_BULK_ITEMS, MAX_ITEM_IMAGE_CHARS } from '../config/constants.js';

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

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required').max(4096, 'Refresh token too long'),
});

const emailSchema = z.string().trim().toLowerCase().email('Invalid email address').max(254, 'Email too long');
const newPasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long');

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
  newPassword: newPasswordSchema,
});

export const changePasswordSchema = z.object({
  // Optional so Google-only accounts (no password yet) can set one.
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: newPasswordSchema,
});

export const updateProfileSchema = z.object({
  name: shortTextSchema('Name', 100),
});

export const deleteAccountSchema = z.object({
  // Required for accounts that have a password; Google-only accounts confirm
  // with the typed phrase alone.
  password: z.string().min(1).max(128).optional(),
  confirm: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm account deletion' }),
  }),
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
  description: z.string().trim().max(300, 'Description too long').optional(),
  image: z
    .string()
    .max(MAX_ITEM_IMAGE_CHARS, 'Photo too large')
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Photo must be a JPEG, PNG, or WebP data URL')
    .optional(),
});

export const bulkWardrobeItemsSchema = z.object({
  items: z
    .array(wardrobeItemSchema)
    .min(1, 'At least one item is required')
    .max(MAX_BULK_ITEMS, `At most ${MAX_BULK_ITEMS} items per upload`),
});

export const wardrobeItemIdSchema = z.object({
  id: objectIdSchema,
});

// AI service schemas
export const outfitSuggestionSchema = z
  .object({
    prompt: z.string().trim().max(500, 'Prompt too long').optional().default(''),
    auto: z.boolean().optional().default(false),
    variety: z.boolean().optional().default(false),
    count: z.number().int().min(1).max(3).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    localHour: z.number().int().min(0).max(23).optional(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Local date must be YYYY-MM-DD').optional(),
    lockedItemId: objectIdSchema.optional().nullable(),
  })
  .refine((data) => data.auto || data.prompt.length > 0, {
    message: 'Prompt is required',
    path: ['prompt'],
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

// Event schemas
export const eventSchema = z.object({
  title: shortTextSchema('Title', 120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM').optional(),
});

export const eventIdSchema = z.object({
  id: objectIdSchema,
});

const analyzeImageMimeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], {
  errorMap: () => ({ message: 'Image must be JPEG, PNG, WebP, or HEIC' }),
});

export const analyzeItemSchema = z.object({
  imageBase64: z.string().min(100, 'Image data is required').max(5_000_000, 'Image too large'),
  mimeType: analyzeImageMimeSchema,
  hint: z.string().trim().max(500).optional(),
});

// Bulk scan: several photos per request. Clients should downscale more
// aggressively here (~1024px) so a full batch stays under the body limit.
export const analyzeItemsSchema = z.object({
  images: z
    .array(
      z.object({
        imageBase64: z.string().min(100, 'Image data is required').max(1_500_000, 'Image too large'),
        mimeType: analyzeImageMimeSchema,
      })
    )
    .min(1, 'At least one image is required')
    .max(MAX_BULK_ANALYZE_IMAGES, `At most ${MAX_BULK_ANALYZE_IMAGES} photos per request`),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type WardrobeItemInput = z.infer<typeof wardrobeItemSchema>;
export type OutfitSuggestionInput = z.infer<typeof outfitSuggestionSchema>;
export type OutfitImageInput = z.infer<typeof outfitImageSchema>;
export type AnalyzeItemInput = z.infer<typeof analyzeItemSchema>;
export type AnalyzeItemsInput = z.infer<typeof analyzeItemsSchema>;
export type BulkWardrobeItemsInput = z.infer<typeof bulkWardrobeItemsSchema>;
export type EventInput = z.infer<typeof eventSchema>;
