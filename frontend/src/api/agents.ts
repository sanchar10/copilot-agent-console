/** Agent CRUD API functions. */

import type { Agent, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';

const API_BASE = '/api';

export async function createAgent(request: CreateAgentRequest): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to create agent');
  }
  return response.json();
}

export async function listAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE}/agents`);
  if (!response.ok) {
    throw new Error('Failed to list agents');
  }
  return response.json();
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`);
  if (!response.ok) {
    throw new Error('Failed to get agent');
  }
  return response.json();
}

export async function updateAgent(agentId: string, request: UpdateAgentRequest): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to update agent');
  }
  return response.json();
}

export async function deleteAgent(agentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete agent');
  }
}
