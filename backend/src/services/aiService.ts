import {
  generateOutfitSuggestion,
  analyzeItemImage,
  generateOutfitImage,
} from './geminiService.js';
import { getWeather } from './weatherService.js';
import { getWardrobeItems } from './wardrobeService.js';
import { getRecentlyWornItemNames } from './lookbookService.js';
import { getEventForDate } from './eventService.js';
import { buildStyleContext, AUTO_STYLE_PROMPT } from '../utils/styleContext.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { OutfitSuggestionInput, AnalyzeItemInput, OutfitImageInput } from '../utils/schemas.js';
import type { ClothingItem } from '../../../shared/types';

export type SuggestionContext = {
  weather?: { temp: number; description: string; city: string } | null;
  timeOfDay?: string;
  season?: string;
};

export type OutfitSuggestion = {
  occasion: string;
  top: { name: string; reason: string };
  bottom: { name: string; reason: string };
  shoes: { name: string; reason: string };
  accessory: { name: string; reason: string };
  stylistNote: string;
  wardrobeGap?: string;
  wardrobeGapSearchTerm?: string;
  context?: SuggestionContext;
  options?: OutfitSuggestion[];
};

export type ItemAnalysis = {
  name: string;
  color: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory';
  formality: 'casual' | 'smart casual' | 'formal';
  description?: string;
  notes: string;
};

export type ItemAnalysisResult = {
  items: ItemAnalysis[];
};

export type OutfitImageResult = {
  imageBase64: string;
  mimeType: string;
};

export const findMatchingWardrobeItem = (
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

export const hasWardrobeItem = (
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

export const suggestionUsesWardrobe = (
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
  const { prompt, auto, variety, lat, lon, localHour, localDate, lockedItemId } = input;

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

    // Derive time-of-day and season when the client opted into contextual styling
    const styleContext = auto || typeof localHour === 'number' || localDate
      ? buildStyleContext(localHour, localDate, lat)
      : null;

    // For auto picks / "try another look", steer away from recently worn items
    const avoidItems = auto || variety ? await getRecentlyWornItemNames(userId) : [];

    // Occasion precedence: an explicit prompt the user typed wins; otherwise an
    // event scheduled for today drives the look; otherwise a generic auto prompt.
    let effectivePrompt = prompt;
    if (auto && !prompt && localDate) {
      const todaysEvent = await getEventForDate(userId, localDate);
      if (todaysEvent) {
        effectivePrompt = `Dress me for: ${todaysEvent.title}${todaysEvent.time ? ` at ${todaysEvent.time}` : ''}`;
      }
    }

    const lockedItem = lockedItemId ? wardrobe.find(item => item.id === lockedItemId) : null;
    const context: SuggestionContext | undefined =
      weatherInfo || styleContext
        ? { weather: weatherInfo, timeOfDay: styleContext?.timeOfDay, season: styleContext?.season }
        : undefined;

    // Generate one wardrobe-constrained suggestion, remapping any hallucinated
    // names back onto real wardrobe items and enforcing locked picks.
    const generateOne = async (genOptions: { variety: boolean; avoidItems: string[] }): Promise<OutfitSuggestion> => {
      const result = await generateOutfitSuggestion(
        effectivePrompt || AUTO_STYLE_PROMPT,
        wardrobe as ClothingItem[],
        weatherInfo,
        lockedItemId,
        styleContext,
        genOptions
      );

      if (!result.occasion || !result.top || !result.bottom || !result.shoes) {
        throw new AppError('AI response incomplete', 500);
      }

      const pick = (type: string, raw?: { name?: string; reason?: string }) => ({
        name: lockedItem?.type === type
          ? lockedItem.name
          : findMatchingWardrobeItem(wardrobe as any, type, raw?.name || ''),
        reason: raw?.reason || '',
      });

      const mapped: OutfitSuggestion = {
        ...result,
        top: pick('top', result.top),
        bottom: pick('bottom', result.bottom),
        shoes: pick('shoes', result.shoes),
        accessory: pick('accessory', result.accessory),
      };

      if (!suggestionUsesWardrobe(wardrobe as any, mapped)) {
        throw new AppError('AI response included items outside your wardrobe', 500);
      }

      if (context) mapped.context = context;
      return mapped;
    };

    // Produce `count` distinct looks. Each new look avoids the items already
    // chosen in earlier looks so the options feel genuinely different.
    const count = Math.min(Math.max(input.count ?? 1, 1), 3);
    const suggestions: OutfitSuggestion[] = [];
    const seen = new Set<string>(avoidItems);

    for (let i = 0; i < count; i++) {
      const mapped = await generateOne({ variety: Boolean(variety) || i > 0, avoidItems: [...seen] });
      suggestions.push(mapped);
      for (const part of [mapped.top, mapped.bottom, mapped.shoes, mapped.accessory]) {
        if (part?.name) seen.add(part.name);
      }
    }

    // Return the first look as the primary. When multiple looks were requested,
    // expose them via `options` — clone the primary so the array (which contains
    // the original first look) isn't referenced by it, avoiding a JSON cycle.
    if (count > 1) {
      return { ...suggestions[0], options: suggestions };
    }
    return suggestions[0];
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Outfit suggestion failed', error as Error);
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

    // Resolve each suggested part back to the real wardrobe item so the image
    // prompt carries its color and material description.
    const detailsFor = (type: 'top' | 'bottom' | 'shoes' | 'accessory', part: { name: string }) => {
      const matchedName = findMatchingWardrobeItem(wardrobe, type, part.name);
      const item = wardrobe.find((i) => i.type === type && i.name === matchedName);
      return item ? { color: item.color, description: item.description } : undefined;
    };

    return await generateOutfitImage(input.suggestion, {
      top: detailsFor('top', input.suggestion.top),
      bottom: detailsFor('bottom', input.suggestion.bottom),
      shoes: detailsFor('shoes', input.suggestion.shoes),
      accessory: detailsFor('accessory', input.suggestion.accessory),
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Outfit image generation failed', error as Error);
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
    logger.error('Image analysis failed', error as Error);
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
