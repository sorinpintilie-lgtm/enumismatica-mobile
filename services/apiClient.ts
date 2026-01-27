import { auth } from '@shared/firebaseConfig';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  /** For endpoints protected by requireStepUp() on the web API */
  stepUpToken?: string;
  /** When false, do not attach Firebase ID token */
  auth?: boolean;
};

function getApiBaseUrl(): string {
  const base =
    (process.env.EXPO_PUBLIC_WEB_API_BASE_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
    'https://enumismatica.ro';

  const trimmed = String(base).trim().replace(/\/$/, '');
  return trimmed;
}

function joinUrl(base: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

export async function apiRequest<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();

  const method = options.method || 'GET';
  const wantAuth = options.auth !== false;
  const token = wantAuth ? await getIdToken() : null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.stepUpToken) {
    headers['X-Step-Up-Token'] = options.stepUpToken;
  }

  const hasBody = options.body !== undefined;
  const body = hasBody ? JSON.stringify(options.body) : undefined;
  if (hasBody) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(joinUrl(baseUrl, path), {
    method,
    headers,
    body,
  });

  const text = await res.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in (data as any)
        ? String((data as any).error)
        : `Request failed (${res.status})`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function apiGet<T = any>(path: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T = any>(path: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}

