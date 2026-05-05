import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
  name: { type: String, trim: true, maxlength: 100 },
  picture: { type: String, trim: true, maxlength: 2048 },
  password: { type: String, select: false }, // Store hashed password, but don't return it by default
});

export const User = mongoose.model('User', UserSchema);
