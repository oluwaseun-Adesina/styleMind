export type Formality = 'casual' | 'smart casual' | 'formal';
export type ItemType = 'top' | 'bottom' | 'shoes' | 'accessory';

export interface ClothingItem {
  id: string;
  name: string;
  color: string;
  type: ItemType;
  formality: Formality;
  uid?: string; // Optional user ID for Firestore
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
}

export interface ItemAnalysis {
  name: string;
  color: string;
  type: ItemType;
  formality: Formality;
  notes: string;
}
