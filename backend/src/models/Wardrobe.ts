import mongoose from 'mongoose';

const WardrobeSchema = new mongoose.Schema(
  {
    uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    color: { type: String, required: true, trim: true, maxlength: 50 },
    type: { type: String, required: true, enum: ['top', 'bottom', 'shoes', 'accessory'] },
    formality: { type: String, required: true, enum: ['casual', 'smart casual', 'formal'] },
    // Optional material/texture/detail description, used to make AI outfit
    // images match the real garment. Auto-filled by the photo scan.
    description: { type: String, trim: true, maxlength: 300 },
    // Small JPEG/PNG/WebP thumbnail as a data URL (resized on the client).
    // Shown in the wardrobe, used for the real-photo outfit collage, and sent
    // as a reference image when generating AI outfit images.
    image: { type: String, maxlength: 300_000 },
  },
  { timestamps: true }
);

export const Wardrobe = mongoose.model('Wardrobe', WardrobeSchema);
