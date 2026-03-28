import { ClothingItem, OutfitSuggestion } from "../types";

export async function getOutfitSuggestion(
  wardrobe: ClothingItem[],
  prompt: string,
  token: string,
  lat?: number,
  lon?: number,
  lockedItemId?: string | null
): Promise<OutfitSuggestion> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

  const response = await fetch(`${apiBaseUrl}/api/outfit-suggestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ wardrobe, prompt, lat, lon, lockedItemId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to generate outfit suggestion.');
  }

  return (await response.json()) as OutfitSuggestion;
}
