import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

// This is a simplified auth helper for the migration
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8787').replace(/\/+$/, '');

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function postJson<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      throw new ApiError(data?.error || `Request failed with status ${response.status}.`, response.status);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. If the backend is waking up, wait a moment and try again.');
    }

    throw new ApiError(`Could not reach ${API_BASE_URL}. Check that the backend is online and reachable from your phone.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getToken() {
  return await AsyncStorage.getItem('token');
}

export async function getUser() {
  const user = await AsyncStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export async function saveAuth(token: string, user: any) {
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
}

export async function clearAuth() {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
}
