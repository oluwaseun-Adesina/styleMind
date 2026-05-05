import { API_BASE_URL } from "../firebase";
import { ClothingItem, OutfitImageResult, OutfitSuggestion } from "../types";

export async function getOutfitSuggestion(
  _wardrobe: ClothingItem[],
  prompt: string,
  token: string,
  lat?: number,
  lon?: number,
  lockedItemId?: string | null
): Promise<OutfitSuggestion> {
  const response = await fetch(`${API_BASE_URL}/api/outfit-suggestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, lat, lon, lockedItemId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to generate outfit suggestion.');
  }

  const result = await response.json();
  return (result && typeof result === 'object' && 'data' in result ? result.data : result) as OutfitSuggestion;
}

export async function getOutfitImage(
  suggestion: OutfitSuggestion,
  token: string
): Promise<OutfitImageResult> {
  const response = await fetch(`${API_BASE_URL}/api/outfit-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ suggestion }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to generate outfit image.');
  }

  const result = await response.json();
  return (result && typeof result === 'object' && 'data' in result ? result.data : result) as OutfitImageResult;
}
