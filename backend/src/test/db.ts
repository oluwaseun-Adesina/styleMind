import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

let mongod: MongoMemoryServer | null = null;

/**
 * Boot an in-memory MongoDB and connect mongoose. Call in beforeAll.
 */
export const startTestDb = async (): Promise<void> => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

/**
 * Disconnect and tear down the in-memory MongoDB. Call in afterAll.
 */
export const stopTestDb = async (): Promise<void> => {
  await mongoose.disconnect();
  await mongod?.stop();
  mongod = null;
};

/**
 * Wipe every collection between tests for isolation. Call in afterEach.
 */
export const clearDb = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

/**
 * Create a user directly (bypassing the rate-limited auth endpoints) and return
 * a signed access token + Authorization header for it.
 */
export const createUserWithToken = async (
  email = 'user@example.com'
): Promise<{ userId: string; email: string; token: string; authHeader: string }> => {
  const user = await User.create({ email, name: email.split('@')[0] });
  const userId = user._id.toString();
  const token = jwt.sign({ userId, email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  return { userId, email, token, authHeader: `Bearer ${token}` };
};
