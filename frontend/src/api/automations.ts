/** Automation and TaskRun API functions. */

import type {
  AutomationWithNextRun,
  Automation,
  CreateAutomationRequest,
  UpdateAutomationRequest,
  TaskRunSummary,
  TaskRun,
} from '../types/automation';

const API_BASE = '/api';

// --- Automations ---

export async function listAutomations(): Promise<AutomationWithNextRun[]> {
  const response = await fetch(`${API_BASE}/automations`);
  if (!response.ok) throw new Error('Failed to list automations');
  return response.json();
}

export async function createAutomation(request: CreateAutomationRequest): Promise<Automation> {
  const response = await fetch(`${API_BASE}/automations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to create automation');
  return response.json();
}

export async function getAutomation(automationId: string): Promise<Automation> {
  const response = await fetch(`${API_BASE}/automations/${automationId}`);
  if (!response.ok) throw new Error('Failed to get automation');
  return response.json();
}

export async function updateAutomation(automationId: string, request: UpdateAutomationRequest): Promise<Automation> {
  const response = await fetch(`${API_BASE}/automations/${automationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update automation');
  return response.json();
}

export async function deleteAutomation(automationId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/automations/${automationId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete automation');
}

export async function toggleAutomation(automationId: string): Promise<Automation> {
  const response = await fetch(`${API_BASE}/automations/${automationId}/toggle`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to toggle automation');
  return response.json();
}

export async function runAutomationNow(automationId: string): Promise<{ run_id: string }> {
  const response = await fetch(`${API_BASE}/automations/${automationId}/run-now`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to run automation');
  return response.json();
}

// --- Task Runs ---

export async function listTaskRuns(params?: {
  limit?: number;
  agent_id?: string;
  automation_id?: string;
  status?: string;
}): Promise<TaskRunSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
  if (params?.automation_id) searchParams.set('automation_id', params.automation_id);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  const response = await fetch(`${API_BASE}/task-runs${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to list task runs');
  return response.json();
}

export async function getTaskRun(runId: string): Promise<TaskRun> {
  const response = await fetch(`${API_BASE}/task-runs/${runId}`);
  if (!response.ok) throw new Error('Failed to get task run');
  return response.json();
}

export async function abortTaskRun(runId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/task-runs/${runId}/abort`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to abort task run');
}

export async function deleteTaskRun(runId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/task-runs/${runId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete task run');
}
