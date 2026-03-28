import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, OutfitSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getOutfitSuggestion(
  wardrobe: ClothingItem[],
  prompt: string
): Promise<OutfitSuggestion> {
  const wardrobeStr = wardrobe
    .map(
      (item) =>
        `- ${item.name} (${item.color}, ${item.type}, ${item.formality})`
    )
    .join("\n");

  const systemInstruction = `
    You are StyleMind, an expert AI personal stylist. 
    Your job is to suggest complete outfit combinations exclusively from the user's own wardrobe.

    WARDROBE:
    ${wardrobeStr}

    BEHAVIOR:
    1. Analyze the wardrobe and suggest the best outfit for the prompt.
    2. Suggest a COMPLETE outfit: top + bottom + shoes + accessory.
    3. ONLY use items from the provided wardrobe.
    4. Explain WHY you picked each item.
    5. If the wardrobe is too limited, flag what is missing.
    6. Keep tone friendly, confident, and stylish.

    OUTPUT FORMAT:
    You must return a JSON object matching this schema:
    {
      "occasion": "string",
      "top": { "name": "string", "reason": "string" },
      "bottom": { "name": "string", "reason": "string" },
      "shoes": { "name": "string", "reason": "string" },
      "accessory": { "name": "string", "reason": "string" },
      "stylistNote": "string",
      "wardrobeGap": "string (optional)"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
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
            required: ["name", "reason"],
          },
          bottom: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["name", "reason"],
          },
          shoes: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["name", "reason"],
          },
          accessory: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["name", "reason"],
          },
          stylistNote: { type: Type.STRING },
          wardrobeGap: { type: Type.STRING },
        },
        required: ["occasion", "top", "bottom", "shoes", "accessory", "stylistNote"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
