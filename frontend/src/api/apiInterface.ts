/**
 * Shared API client interface.
 * Both desktop (apiClient) and mobile (mobileApiClient) conform to this shape,
 * enabling stores and hooks to work with either client based on context.
 */
export interface ApiClientInterface {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  createEventSource(path: string, params?: Record<string, string>): EventSource;
}
