import { apiFetch } from "../firebase";
import { EventRecord, OutfitImageResult, OutfitSuggestion, SavedOutfitRecord } from "../types";

export async function getOutfitSuggestion(
  prompt: string,
  opts: { lat?: number; lon?: number; lockedItemId?: string | null; count?: number } = {}
): Promise<OutfitSuggestion> {
  return apiFetch<OutfitSuggestion>('/api/outfit-suggestion', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      lat: opts.lat,
      lon: opts.lon,
      lockedItemId: opts.lockedItemId,
      count: opts.count,
    }),
  });
}

export async function getDailyOutfitSuggestion(
  opts: { lat?: number; lon?: number; plan?: string; variety?: boolean; count?: number } = {}
): Promise<OutfitSuggestion> {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');

  return apiFetch<OutfitSuggestion>('/api/outfit-suggestion', {
    method: 'POST',
    body: JSON.stringify({
      auto: true,
      variety: Boolean(opts.variety),
      prompt: opts.plan?.trim() || undefined,
      count: opts.count,
      localHour: now.getHours(),
      localDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      lat: opts.lat,
      lon: opts.lon,
    }),
  });
}

export async function getOutfitImage(suggestion: OutfitSuggestion): Promise<OutfitImageResult> {
  return apiFetch<OutfitImageResult>('/api/outfit-image', {
    method: 'POST',
    body: JSON.stringify({ suggestion }),
  });
}

export async function markOutfitWorn(outfitId: string): Promise<SavedOutfitRecord> {
  return apiFetch<SavedOutfitRecord>(`/api/saved_outfits/${outfitId}/worn`, { method: 'POST' });
}

export async function getEvents(from?: string): Promise<EventRecord[]> {
  return apiFetch<EventRecord[]>(`/api/events${from ? `?from=${from}` : ''}`);
}

export async function addEvent(input: { title: string; date: string; time?: string }): Promise<EventRecord> {
  return apiFetch<EventRecord>('/api/events', { method: 'POST', body: JSON.stringify(input) });
}

export async function removeEvent(id: string): Promise<void> {
  await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
}
