export interface ApiError {
  error: string;
}

export interface ModelsResponse {
  models: string[];
}

export interface SessionsResponse {
  sessions: import('./session').Session[];
}
