// Central network client. Injects the access token, and on a 401 transparently
// refreshes the session once (single-flight) and retries the original request.
// On refresh failure it clears auth and notifies the app via an `auth:expired`
// event so the UI can return to the login screen.

export const API_BASE = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

let refreshing: Promise<string | null> | null = null;

const unwrap = <T>(json: any): T =>
  (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;

export async function refreshSession(
  refreshToken: string
): Promise<{ token: string; refreshToken: string; user: any }> {
  const response = await fetch(`${API_BASE()}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error('Session expired');
  }
  return unwrap(await response.json());
}

async function doRefresh(): Promise<string | null> {
  const stored = sessionStorage.getItem('refreshToken');
  if (!stored) return null;
  try {
    const data = await refreshSession(stored);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('refreshToken', data.refreshToken);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    return data.token;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const call = (token: string | null) =>
    fetch(`${API_BASE()}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const res = await call(sessionStorage.getItem('token'));
  if (res.status !== 401) return res;

  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  const token = await refreshing;

  if (!token) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:expired'));
    return res;
  }

  return call(token);
}

/** Convenience wrapper: apiFetch + JSON parse + unwrap `{ data }`. Throws on !ok. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return unwrap<T>(json);
}

export const jsonHeaders = { 'Content-Type': 'application/json' };
