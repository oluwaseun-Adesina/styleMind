import { ClothingItem, OutfitImageResult, OutfitSuggestion } from "../types";

export async function getOutfitSuggestion(
  _wardrobe: ClothingItem[],
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
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

  const response = await fetch(`${apiBaseUrl}/api/outfit-image`, {
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
