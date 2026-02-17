import type { MCPServerConfig } from '../types/mcp';

const API_BASE = '/api';

export async function listMCPServers(): Promise<MCPServerConfig> {
  const response = await fetch(`${API_BASE}/mcp/servers`);
  if (!response.ok) {
    throw new Error('Failed to list MCP servers');
  }
  return response.json();
}

export async function refreshMCPServers(): Promise<MCPServerConfig> {
  const response = await fetch(`${API_BASE}/mcp/servers/refresh`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to refresh MCP servers');
  }
  return response.json();
}
