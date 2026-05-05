import {
  generateOutfitSuggestion,
  analyzeItemImage,
  generateOutfitImage,
} from './geminiService.js';
import { getWeather } from './weatherService.js';
import { getWardrobeItems } from './wardrobeService.js';
import { AppError } from '../utils/errors.js';
import type { OutfitSuggestionInput, AnalyzeItemInput, OutfitImageInput } from '../utils/schemas.js';
import type { ClothingItem } from '../../../shared/types';

export type OutfitSuggestion = {
  occasion: string;
  top: { name: string; reason: string };
  bottom: { name: string; reason: string };
  shoes: { name: string; reason: string };
  accessory: { name: string; reason: string };
  stylistNote: string;
  wardrobeGap?: string;
  wardrobeGapSearchTerm?: string;
};

export type ItemAnalysis = {
  name: string;
  color: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory';
  formality: 'casual' | 'smart casual' | 'formal';
  notes: string;
};

export type ItemAnalysisResult = {
  items: ItemAnalysis[];
};

export type OutfitImageResult = {
  imageBase64: string;
  mimeType: string;
};

const hasWardrobeItem = (
  wardrobe: Array<{ name: string }>,
  suggestedItem: { name?: string } | undefined
): boolean => {
  if (!suggestedItem?.name) {
    return false;
  }

  const suggestedName = suggestedItem.name.trim().toLowerCase();
  return wardrobe.some((item) => item.name.trim().toLowerCase() === suggestedName);
};

const suggestionUsesWardrobe = (
  wardrobe: Array<{ name: string }>,
  suggestion: OutfitSuggestion
): boolean => {
  return (
    hasWardrobeItem(wardrobe, suggestion.top) &&
    hasWardrobeItem(wardrobe, suggestion.bottom) &&
    hasWardrobeItem(wardrobe, suggestion.shoes) &&
    hasWardrobeItem(wardrobe, suggestion.accessory)
  );
};

/**
 * Generate outfit suggestion based on wardrobe and context
 */
export const getOutfitSuggestion = async (
  userId: string,
  input: OutfitSuggestionInput
): Promise<OutfitSuggestion> => {
  const { prompt, lat, lon, lockedItemId } = input;

  try {
    const wardrobe = await getWardrobeItems(userId);

    if (!wardrobe.length) {
      throw new AppError('Add wardrobe items before requesting a suggestion', 400);
    }

    if (lockedItemId && !wardrobe.some((item) => item.id === lockedItemId)) {
      throw new AppError('Locked item not found', 400);
    }

    // Fetch weather if coordinates provided
    let weatherInfo = null;
    if (typeof lat === 'number' && typeof lon === 'number') {
      weatherInfo = await getWeather(lat, lon);
    }

    const result = await generateOutfitSuggestion(
      prompt,
      wardrobe as ClothingItem[],
      weatherInfo,
      lockedItemId
    );

    // Validate required fields
    if (!result.occasion || !result.top || !result.bottom || !result.shoes) {
      throw new AppError('AI response incomplete', 500);
    }

    if (!suggestionUsesWardrobe(wardrobe, result as OutfitSuggestion)) {
      throw new AppError('AI response included items outside your wardrobe', 500);
    }

    return result as OutfitSuggestion;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Outfit suggestion failed:', error);
    throw new AppError('Failed to generate outfit suggestion', 500);
  }
};

/**
 * Generate a visual image for an outfit suggestion
 */
export const getOutfitImage = async (
  userId: string,
  input: OutfitImageInput
): Promise<OutfitImageResult> => {
  try {
    const wardrobe = await getWardrobeItems(userId);

    if (!suggestionUsesWardrobe(wardrobe, input.suggestion)) {
      throw new AppError('Outfit image can only use items from your wardrobe', 400);
    }

    return await generateOutfitImage(input.suggestion);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Outfit image generation failed:', error);
    throw new AppError('Failed to generate outfit image', 500);
  }
};

/**
 * Analyze clothing item from image
 */
export const analyzeClothingItem = async (
  input: AnalyzeItemInput
): Promise<ItemAnalysisResult> => {
  const { imageBase64, mimeType, hint } = input;

  try {
    const result = await analyzeItemImage(imageBase64, mimeType, hint);
    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    }
    console.error('Image analysis failed:', error);
    throw new AppError('Failed to analyze image', 500);
  }
};

/**
 * Get weather info for location
 */
export const fetchWeatherForLocation = async (
  lat: number,
  lon: number
) => {
  return getWeather(lat, lon);
};
