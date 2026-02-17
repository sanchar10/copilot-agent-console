/**
 * Tools API client
 */

const API_BASE = '/api';

export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  source_file: string;
}

export interface ToolsConfig {
  tools: ToolInfo[];
}

export type ToolSelections = Record<string, boolean>;

/**
 * Get all available tools
 */
export async function getTools(): Promise<ToolsConfig> {
  const response = await fetch(`${API_BASE}/tools`);
  if (!response.ok) {
    throw new Error('Failed to get tools');
  }
  return response.json();
}

/**
 * Get a specific tool by name
 */
export async function getTool(name: string): Promise<ToolInfo> {
  const response = await fetch(`${API_BASE}/tools/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error('Failed to get tool');
  }
  return response.json();
}

/**
 * Force refresh tools from disk
 */
export async function refreshTools(): Promise<ToolsConfig> {
  const response = await fetch(`${API_BASE}/tools/refresh`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to refresh tools');
  }
  return response.json();
}
