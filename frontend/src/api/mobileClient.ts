/**
 * Mobile-aware API client with bearer token authentication.
 *
 * Uses the same API shape as the desktop client but adds:
 * - Configurable base URL (for tunnel access)
 * - Bearer token in Authorization header
 * - Connection state management
 */

const STORAGE_KEY_TOKEN = 'agentconsole_api_token';
const STORAGE_KEY_BASE_URL = 'agentconsole_base_url';

/** Get the stored API token */
export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

/** Store the API token */
export function setStoredToken(token: string): void {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

/** Get the stored base URL (tunnel URL) */
export function getStoredBaseUrl(): string | null {
  return localStorage.getItem(STORAGE_KEY_BASE_URL);
}

/** Store the base URL */
export function setStoredBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_BASE_URL, url);
}

/** Clear all stored credentials */
export function clearStoredCredentials(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_BASE_URL);
}

/** Resolve the API base URL */
function getApiBase(): string {
  const baseUrl = getStoredBaseUrl();
  if (baseUrl) {
    // Remote access via tunnel — use full URL
    return `${baseUrl.replace(/\/$/, '')}/api`;
  }
  // Local access — use relative path
  return '/api';
}

/** Build headers with optional auth token */
function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export class MobileApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MobileApiError';
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new MobileApiError(response.status, data.error || response.statusText);
  }
  return response.json();
}

export const mobileApiClient = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${getApiBase()}${path}`, {
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  /** Create an EventSource with auth (SSE doesn't support headers natively,
   *  so we pass the token as a query param for SSE endpoints). */
  createEventSource(path: string, params?: Record<string, string>): EventSource {
    const base = getApiBase();
    const token = getStoredToken();
    const searchParams = new URLSearchParams(params || {});
    if (token) {
      searchParams.set('token', token);
    }
    const qs = searchParams.toString();
    const url = `${base}${path}${qs ? `?${qs}` : ''}`;
    return new EventSource(url);
  },

  /** Test the connection to the backend */
  async testConnection(): Promise<boolean> {
    try {
      const baseUrl = getStoredBaseUrl();
      const healthUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/health`
        : '/health';
      const response = await fetch(healthUrl, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};
