/** Schedule and TaskRun API functions. */

import type {
  ScheduleWithNextRun,
  Schedule,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  TaskRunSummary,
  TaskRun,
} from '../types/schedule';

const API_BASE = '/api';

// --- Schedules ---

export async function listSchedules(): Promise<ScheduleWithNextRun[]> {
  const response = await fetch(`${API_BASE}/schedules`);
  if (!response.ok) throw new Error('Failed to list schedules');
  return response.json();
}

export async function createSchedule(request: CreateScheduleRequest): Promise<Schedule> {
  const response = await fetch(`${API_BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to create schedule');
  return response.json();
}

export async function getSchedule(scheduleId: string): Promise<Schedule> {
  const response = await fetch(`${API_BASE}/schedules/${scheduleId}`);
  if (!response.ok) throw new Error('Failed to get schedule');
  return response.json();
}

export async function updateSchedule(scheduleId: string, request: UpdateScheduleRequest): Promise<Schedule> {
  const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update schedule');
  return response.json();
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete schedule');
}

export async function toggleSchedule(scheduleId: string): Promise<Schedule> {
  const response = await fetch(`${API_BASE}/schedules/${scheduleId}/toggle`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to toggle schedule');
  return response.json();
}

export async function runScheduleNow(scheduleId: string): Promise<{ run_id: string }> {
  const response = await fetch(`${API_BASE}/schedules/${scheduleId}/run-now`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to run schedule');
  return response.json();
}

// --- Task Runs ---

export async function listTaskRuns(params?: {
  limit?: number;
  agent_id?: string;
  schedule_id?: string;
  status?: string;
}): Promise<TaskRunSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
  if (params?.schedule_id) searchParams.set('schedule_id', params.schedule_id);
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
