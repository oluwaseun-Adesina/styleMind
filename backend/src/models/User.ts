import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  picture: String,
  password: { type: String, select: false }, // Store hashed password, but don't return it by default
});

export const User = mongoose.model('User', UserSchema);
