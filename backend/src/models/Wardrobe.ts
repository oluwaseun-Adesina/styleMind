import mongoose from 'mongoose';

const WardrobeSchema = new mongoose.Schema(
  {
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    color: { type: String, required: true, trim: true, maxlength: 50 },
    type: { type: String, required: true, enum: ['top', 'bottom', 'shoes', 'accessory'] },
    formality: { type: String, required: true, enum: ['casual', 'smart casual', 'formal'] },
  },
  { timestamps: true }
);

export const Wardrobe = mongoose.model('Wardrobe', WardrobeSchema);
