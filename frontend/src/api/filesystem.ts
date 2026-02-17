import { apiClient } from './client';

export interface FolderEntry {
  name: string;
  path: string;
  is_drive?: boolean;
  accessible?: boolean;
}

export interface BrowseResponse {
  current_path: string;
  parent_path: string | null;
  entries: FolderEntry[];
}

export async function browseDirectory(path?: string): Promise<BrowseResponse> {
  const params = path ? `?path=${encodeURIComponent(path)}` : '';
  return apiClient.get<BrowseResponse>(`/filesystem/browse${params}`);
}
