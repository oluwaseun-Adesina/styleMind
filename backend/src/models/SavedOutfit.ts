import mongoose from 'mongoose';

const SavedOutfitSchema = new mongoose.Schema({
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  occasion: String,
  top: Object,
  bottom: Object,
  shoes: Object,
  accessory: Object,
  stylistNote: String,
  wardrobeGap: String,
  wardrobeGapSearchTerm: String,
  createdAt: { type: Date, default: Date.now },
});

export const SavedOutfit = mongoose.model('SavedOutfit', SavedOutfitSchema);
