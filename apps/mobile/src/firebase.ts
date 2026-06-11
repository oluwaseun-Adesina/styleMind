import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
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

    return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
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
  const secureToken = await SecureStore.getItemAsync('token');
  if (secureToken) {
    return secureToken;
  }

  const legacyToken = await AsyncStorage.getItem('token');
  if (legacyToken) {
    await SecureStore.setItemAsync('token', legacyToken);
    await AsyncStorage.removeItem('token');
  }

  return legacyToken;
}

export async function getUser() {
  const user = await AsyncStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync('refreshToken');
}

export async function saveAuth(token: string, user: any, refreshToken?: string) {
  await SecureStore.setItemAsync('token', token);
  if (refreshToken) {
    await SecureStore.setItemAsync('refreshToken', refreshToken);
  }
  await AsyncStorage.removeItem('token');
  await AsyncStorage.setItem('user', JSON.stringify(user));
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('refreshToken');
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
}

/**
 * Exchange a stored refresh token for a fresh access + refresh token pair.
 * Returns the new auth payload, or null if there is no valid refresh token.
 */
export async function refreshSession(): Promise<{ token: string; refreshToken: string; user: any } | null> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) return null;

  try {
    const data = await postJson<{ token: string; refreshToken: string; user: any }>(
      '/api/auth/refresh',
      { refreshToken }
    );
    await saveAuth(data.token, data.user, data.refreshToken);
    return data;
  } catch {
    return null;
  }
}

// Called by apiFetch when a session can't be refreshed, so the UI can log out.
type AuthExpiredHandler = () => void;
let authExpiredHandler: AuthExpiredHandler | null = null;
export const setAuthExpiredHandler = (fn: AuthExpiredHandler | null) => {
  authExpiredHandler = fn;
};

let refreshingPromise: Promise<string | null> | null = null;

/**
 * Authenticated fetch: injects the stored access token, and on a 401 refreshes
 * the session once (single-flight) and retries. Returns the unwrapped `data`
 * payload. Throws ApiError on failure; fires the auth-expired handler if the
 * refresh fails.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<T> {
  const run = async (tok: string | null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response: Response;
  try {
    response = await run(await getToken());
    if (response.status === 401) {
      refreshingPromise ??= refreshSession()
        .then((d) => d?.token ?? null)
        .finally(() => {
          refreshingPromise = null;
        });
      const newToken = await refreshingPromise;
      if (newToken) {
        response = await run(newToken);
      } else {
        authExpiredHandler?.();
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.');
    }
    throw new ApiError(`Could not reach ${API_BASE_URL}. Check that the backend is online.`);
  }

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;
  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed with status ${response.status}.`, response.status);
  }
  return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
}
