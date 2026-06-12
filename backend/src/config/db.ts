import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stylemind';
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error', err as Error);
    process.exit(1);
  }
};
