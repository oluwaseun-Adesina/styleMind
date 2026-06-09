import { Type, createPartFromBase64, createPartFromText } from '@google/genai';
import { getAI } from '../config/ai';
import { ClothingItem, ItemAnalysis, OutfitSuggestion } from '../../../shared/types';
import { MAX_IMAGE_BASE64_CHARS } from '../config/constants.js';
import { env } from '../config/env.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || GEMINI_MODEL;
const VALID_ITEM_TYPES = ['top', 'bottom', 'shoes', 'accessory'] as const;
const VALID_FORMALITIES = ['casual', 'smart casual', 'formal'] as const;
const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const normalizeBase64ImageData = (imageBase64: string) => {
  return imageBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
};

const normalizeItemType = (value: unknown): ItemAnalysis['type'] => {
  const normalized = String(value || '').trim().toLowerCase();
  return (VALID_ITEM_TYPES as readonly string[]).includes(normalized) ? (normalized as ItemAnalysis['type']) : 'accessory';
};

const normalizeFormality = (value: unknown): ItemAnalysis['formality'] => {
  const normalized = String(value || '').trim().toLowerCase();
  return (VALID_FORMALITIES as readonly string[]).includes(normalized) ? (normalized as ItemAnalysis['formality']) : 'casual';
};

const normalizeAnalyzedItems = (payload: unknown): { items: ItemAnalysis[] } => {
  const rawItems = Array.isArray((payload as { items?: unknown[] } | null)?.items)
    ? (payload as { items: unknown[] }).items
    : [];

  return {
    items: rawItems
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const candidate = item as Record<string, unknown>;
        const name = String(candidate.name || '').trim();
        const color = String(candidate.color || '').trim();

        if (!name || !color) {
          return null;
        }

        return {
          name,
          color,
          type: normalizeItemType(candidate.type),
          formality: normalizeFormality(candidate.formality),
          notes: String(candidate.notes || '').trim(),
        };
      })
      .filter((item): item is ItemAnalysis => Boolean(item)),
  };
};

export async function generateOutfitSuggestion(
  prompt: string,
  wardrobe: ClothingItem[],
  weatherInfo: any,
  lockedItemId?: string | null
) {
  const safeWardrobe = wardrobe.filter((item): item is ClothingItem => {
    return Boolean(
      item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.color === 'string' &&
        ['top', 'bottom', 'shoes', 'accessory'].includes(item.type) &&
        ['casual', 'smart casual', 'formal'].includes(item.formality)
    );
  });

  if (!safeWardrobe.length) {
    throw new Error('Wardrobe must include at least one valid item.');
  }

  const wardrobeStr = safeWardrobe
    .map((item) => `- ${item.name} (${item.color}, ${item.type}, ${item.formality})`)
    .join('\n');

  const weatherContext = weatherInfo 
    ? `CURRENT WEATHER in ${weatherInfo.city}: ${weatherInfo.temp}°C, ${weatherInfo.description}.`
    : '';

  const lockedItem = safeWardrobe.find(i => i.id === lockedItemId);
  const lockedContext = lockedItem 
    ? `USER MUST WEAR THIS ITEM: ${lockedItem.name} (${lockedItem.color}, ${lockedItem.type}, ${lockedItem.formality}). Build the rest of the outfit around it.`
    : '';

  const systemInstruction = `
    You are FitPick, an expert AI personal stylist.
    Your job is to suggest complete outfit combinations exclusively from the user's own wardrobe.

    ${weatherContext}
    ${lockedContext}

    WARDROBE:
    ${wardrobeStr}

    BEHAVIOR:
    1. Analyze the wardrobe and suggest the best outfit for the prompt.
    2. Suggest a COMPLETE outfit: top + bottom + shoes + accessory.
    3. ONLY use items from the provided wardrobe. NEVER invent items.
    4. ${weatherInfo ? 'CRITICAL: Ensure the outfit is appropriate for the current weather.' : 'Explain WHY you picked each item.'}
    5. Explain WHY you picked each item.
    6. If there is no accessory in the wardrobe, pick the closest available item and note the gap in wardrobeGap.
    7. If the wardrobe is too limited, flag what is missing in wardrobeGap.
    8. Keep tone friendly, confident, and stylish.

    CRITICAL: In your JSON response, copy each item's "name" field EXACTLY as it appears in the WARDROBE list above — same spelling, same capitalisation, same punctuation.

    OUTPUT FORMAT:
    You must return a JSON object matching this schema:
    {
      "occasion": "string",
      "top": { "name": "string", "reason": "string" },
      "bottom": { "name": "string", "reason": "string" },
      "shoes": { "name": "string", "reason": "string" },
      "accessory": { "name": "string", "reason": "string" },
      "stylistNote": "string",
      "wardrobeGap": "string (optional)",
      "wardrobeGapSearchTerm": "string (optional, a highly generic 3-4 word search term for shopping)"
    }
  `;

  const response = await getAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          occasion: { type: Type.STRING },
          top: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['name', 'reason'],
          },
          bottom: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['name', 'reason'],
          },
          shoes: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['name', 'reason'],
          },
          accessory: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['name', 'reason'],
          },
          stylistNote: { type: Type.STRING },
          wardrobeGap: { type: Type.STRING },
          wardrobeGapSearchTerm: { type: Type.STRING },
        },
        required: ['occasion', 'top', 'bottom', 'shoes', 'accessory', 'stylistNote'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

export async function analyzeItemImage(imageBase64: string, mimeType: string, userHint?: string) {
  const normalizedImageBase64 = normalizeBase64ImageData(imageBase64);
  const normalizedMimeType = String(mimeType || '').toLowerCase().trim();

  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(normalizedMimeType)) {
    throw new Error('Unsupported image type. Please use a JPG, PNG, or WebP photo.');
  }

  if (!normalizedImageBase64) {
    throw new Error('Image data is empty. Please try another photo.');
  }

  if (normalizedImageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    throw new Error('Image is too large to scan. Please use a smaller photo.');
  }

  const prompt = `
    You are an assistant that helps classify clothing items from a wardrobe photo.
    Identify ALL distinct clothing items visible in the image.
    For each item, infer the most likely details.

    Return a JSON object with an "items" array containing:
    - name: a clear clothing item name
    - color: the dominant color or color combination
    - type: one of top, bottom, shoes, accessory
    - formality: one of casual, smart casual, formal
    - notes: a short note about any uncertainty or useful detail

    ${userHint ? `User hint: ${userHint}` : ''}
  `;

  const response = await getAI().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [createPartFromBase64(normalizedImageBase64, normalizedMimeType), createPartFromText(prompt)],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                color: { type: Type.STRING },
                type: { type: Type.STRING },
                formality: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: ['name', 'color', 'type', 'formality', 'notes'],
            }
          }
        },
        required: ['items'],
      },
    },
  });

  const payload = normalizeAnalyzedItems(JSON.parse(response.text || '{"items": []}'));

  if (!payload.items.length) {
    throw new Error('No clothing item was detected. Try a clearer photo with one item centered.');
  }

  return payload;
}

export async function generateOutfitImage(suggestion: OutfitSuggestion) {
  const prompt = [
    `fashion flat-lay outfit for ${suggestion.occasion}`,
    `top: ${suggestion.top.name}`,
    `bottom: ${suggestion.bottom.name}`,
    `shoes: ${suggestion.shoes.name}`,
    `accessory: ${suggestion.accessory.name}`,
    'editorial product photography, neutral white studio background, clean spacing,',
    'realistic fabric texture, coordinated colors, no text, no labels, no logos,',
    'no mannequins, no humans, no faces, no bodies',
  ].join(', ');

  console.log(`[ImageGen] Requesting Google Gemini Image generation for occasion: "${suggestion.occasion}"...`);

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '3:4',
        },
      },
    });

    const inlineImage = response?.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData && part.inlineData.data
    );

    if (!inlineImage || !inlineImage.inlineData || !inlineImage.inlineData.data) {
      throw new Error('No image inlineData returned from Gemini API.');
    }

    console.log('[ImageGen] Google Gemini Image generation succeeded.');

    return { 
      imageBase64: inlineImage.inlineData.data as string, 
      mimeType: inlineImage.inlineData.mimeType || 'image/jpeg' 
    };
  } catch (error: any) {
    console.error(`[ImageGen] Google Gemini Image generation failed: ${error?.message || error}. Trying Hugging Face...`);

    if (env.HF_TOKEN) {
      try {
        const hfModel = 'black-forest-labs/FLUX.1-schnell';
        console.log(`[ImageGen] Requesting Hugging Face Image generation (${hfModel})...`);

        const hfResponse = await fetch(
          `https://router.huggingface.co/hf-inference/models/${hfModel}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.HF_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              inputs: prompt,
            }),
            signal: AbortSignal.timeout(60000),
          }
        );

        if (!hfResponse.ok) {
          const errText = await hfResponse.text().catch(() => '');
          throw new Error(`Hugging Face API returned status ${hfResponse.status}: ${errText}`);
        }

        const buffer = await hfResponse.arrayBuffer();
        const imageBase64 = Buffer.from(buffer).toString('base64');
        const mimeType = hfResponse.headers.get('content-type') || 'image/jpeg';

        console.log('[ImageGen] Hugging Face image generation succeeded.');

        return { imageBase64, mimeType };
      } catch (hfError: any) {
        console.error(`[ImageGen] Hugging Face Image generation failed: ${hfError?.message || hfError}. Falling back to pollinations.ai...`);
      }
    } else {
      console.log('[ImageGen] HF_TOKEN is not configured, skipping Hugging Face fallback...');
    }

    // Fallback to pollinations.ai
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&model=flux&nologo=true`;
    console.log(`[ImageGen] Requesting pollinations.ai fallback...`);
    
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const imageBase64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    console.log('[ImageGen] Fallback image generation succeeded.');

    return { imageBase64, mimeType };
  }
}
