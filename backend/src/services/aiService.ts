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

const findMatchingWardrobeItem = (
  wardrobe: Array<{ id: string; name: string; type: string }>,
  type: string,
  suggestedName: string
): string => {
  const itemsOfType = wardrobe.filter(item => item.type === type);
  if (!itemsOfType.length) {
    return suggestedName;
  }

  const cleanSuggested = suggestedName.trim().toLowerCase();

  // 1. Exact match
  let match = itemsOfType.find(
    item => item.name.trim().toLowerCase() === cleanSuggested
  );
  if (match) return match.name;

  // 2. Substring matches
  match = itemsOfType.find(item => {
    const cleanWardrobe = item.name.trim().toLowerCase();
    return cleanWardrobe.includes(cleanSuggested) || cleanSuggested.includes(cleanWardrobe);
  });
  if (match) return match.name;

  // 3. Token-based overlap
  const suggestedTokens = cleanSuggested.split(/\s+/).filter(t => t.length > 2);
  if (suggestedTokens.length > 0) {
    match = itemsOfType.find(item => {
      const cleanWardrobe = item.name.trim().toLowerCase();
      return suggestedTokens.some(token => cleanWardrobe.includes(token));
    });
    if (match) return match.name;
  }

  // 4. Default fallback to first item of that type
  return itemsOfType[0].name;
};

const hasWardrobeItem = (
  wardrobe: Array<{ name: string; type: string }>,
  suggestedItem: { name?: string } | undefined,
  type: string
): boolean => {
  if (!suggestedItem?.name) return false;

  // If user doesn't have any items of this type, we consider it a match (as it is a gap)
  const hasType = wardrobe.some((item) => item.type === type);
  if (!hasType) return true;

  const suggestedName = suggestedItem.name.trim().toLowerCase();
  return wardrobe.some((item) => {
    if (item.type !== type) return false;
    const wardrobeName = item.name.trim().toLowerCase();
    return (
      wardrobeName === suggestedName ||
      wardrobeName.includes(suggestedName) ||
      suggestedName.includes(wardrobeName)
    );
  });
};

const suggestionUsesWardrobe = (
  wardrobe: Array<{ name: string; type: string }>,
  suggestion: OutfitSuggestion
): boolean => {
  return (
    hasWardrobeItem(wardrobe, suggestion.top, 'top') &&
    hasWardrobeItem(wardrobe, suggestion.bottom, 'bottom') &&
    hasWardrobeItem(wardrobe, suggestion.shoes, 'shoes') &&
    hasWardrobeItem(wardrobe, suggestion.accessory, 'accessory')
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

    // Auto-correct suggestion names to match wardrobe items where possible, and enforce locked items
    const lockedItem = lockedItemId ? wardrobe.find(item => item.id === lockedItemId) : null;
    
    const mappedResult: OutfitSuggestion = {
      ...result,
      top: {
        name: lockedItem?.type === 'top' 
          ? lockedItem.name 
          : findMatchingWardrobeItem(wardrobe as any, 'top', result.top?.name || ''),
        reason: result.top?.reason || '',
      },
      bottom: {
        name: lockedItem?.type === 'bottom' 
          ? lockedItem.name 
          : findMatchingWardrobeItem(wardrobe as any, 'bottom', result.bottom?.name || ''),
        reason: result.bottom?.reason || '',
      },
      shoes: {
        name: lockedItem?.type === 'shoes' 
          ? lockedItem.name 
          : findMatchingWardrobeItem(wardrobe as any, 'shoes', result.shoes?.name || ''),
        reason: result.shoes?.reason || '',
      },
      accessory: {
        name: lockedItem?.type === 'accessory' 
          ? lockedItem.name 
          : findMatchingWardrobeItem(wardrobe as any, 'accessory', result.accessory?.name || ''),
        reason: result.accessory?.reason || '',
      },
    };

    if (!suggestionUsesWardrobe(wardrobe as any, mappedResult)) {
      throw new AppError('AI response included items outside your wardrobe', 500);
    }

    return mappedResult;
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
