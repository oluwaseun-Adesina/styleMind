import mongoose from 'mongoose';

const SavedOutfitItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
}, { _id: false });

const SavedOutfitSchema = new mongoose.Schema({
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  occasion: { type: String, required: true, trim: true, maxlength: 120 },
  top: { type: SavedOutfitItemSchema, required: true },
  bottom: { type: SavedOutfitItemSchema, required: true },
  shoes: { type: SavedOutfitItemSchema, required: true },
  accessory: { type: SavedOutfitItemSchema, required: true },
  stylistNote: { type: String, trim: true, maxlength: 1000 },
  wardrobeGap: { type: String, trim: true, maxlength: 500 },
  wardrobeGapSearchTerm: { type: String, trim: true, maxlength: 100 },
  wornCount: { type: Number, default: 0, min: 0 },
  lastWornAt: { type: Date, default: null },
}, { timestamps: true });

export const SavedOutfit = mongoose.model('SavedOutfit', SavedOutfitSchema);
