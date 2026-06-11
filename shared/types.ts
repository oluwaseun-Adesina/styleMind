export type Formality = 'casual' | 'smart casual' | 'formal';
export type ItemType = 'top' | 'bottom' | 'shoes' | 'accessory';

export interface ClothingItem {
  id: string;
  name: string;
  color: string;
  type: ItemType;
  formality: Formality;
  // Optional material/texture/detail description. Used to make AI outfit
  // images match the real garment (e.g. "ribbed cotton knit, oversized fit").
  description?: string;
  uid?: string; // Optional user ID for Firestore
}

export interface WeatherInfo {
  temp: number;
  description: string;
  city: string;
}

export interface SuggestionContext {
  weather?: WeatherInfo | null;
  timeOfDay?: string;
  season?: string;
}

export interface OutfitSuggestion {
  occasion: string;
  top: { name: string; reason: string };
  bottom: { name: string; reason: string };
  shoes: { name: string; reason: string };
  accessory: { name: string; reason: string };
  stylistNote: string;
  wardrobeGap?: string;
  wardrobeGapSearchTerm?: string;
  // Transient, populated on fresh suggestions only (not persisted to the lookbook)
  context?: SuggestionContext;
  // Present when more than one look was requested (count > 1). Each entry is a
  // full suggestion; the top-level object mirrors the first option.
  options?: OutfitSuggestion[];
}

export interface SavedOutfitRecord extends OutfitSuggestion {
  id: string;
  wornCount?: number;
  lastWornAt?: string | null;
  createdAt?: string;
}

export interface EventRecord {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  createdAt?: string;
}

export interface OutfitImageResult {
  imageBase64: string;
  mimeType: string;
}

export interface ItemAnalysis {
  name: string;
  color: string;
  type: ItemType;
  formality: Formality;
  // AI-written material/texture/detail description, editable by the user.
  description?: string;
  notes: string;
}
