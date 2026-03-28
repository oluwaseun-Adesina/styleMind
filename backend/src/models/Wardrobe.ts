import mongoose from 'mongoose';

const WardrobeSchema = new mongoose.Schema({
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  type: { type: String, required: true },
  formality: { type: String, required: true },
});

export const Wardrobe = mongoose.model('Wardrobe', WardrobeSchema);
