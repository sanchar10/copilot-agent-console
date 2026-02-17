/**
 * Ralph AI Runner API client
 */

const API_BASE = '/api';

// ==================== Types ====================

export type JobType = 'planned' | 'feedback';
export type JobStatus = 'pending' | 'running' | 'approved' | 'skipped' | 'needs_fix' | 'failed';
export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface JobSource {
  file: string;
  line?: number;
  pattern?: string;
  update_on_complete: boolean;
}

export interface JobResult {
  summary: string;
  files: string[];
  assumptions: string[];
}

export interface Job {
  id: string;
  type: JobType;
  description: string;
  context: string;
  source?: JobSource;
  status: JobStatus;
  result?: JobResult;
  feedback_for?: string;
  feedback_text?: string;
  previous_job?: {
    description: string;
    summary: string;
    files: string[];
  };
  sdk_session_id?: string;  // SDK session ID for history retrieval
}

export interface ExecutionBatch {
  id: string;
  workspace: string;
  source_description: string;
  model: string;
  auto_approve: boolean;
  created_at: string;
  jobs: Job[];
  // Inherited from parent chat session (name -> enabled selections)
  mcp_servers?: Record<string, boolean>;
  tools?: Record<string, boolean>;
}

export interface RalphRun {
  id: string;
  batch_id: string;
  workspace: string;
  status: RunStatus;
  current_job_index: number;
  auto_approve: boolean;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface RunSummary {
  id: string;
  batch_id: string;
  workspace: string;
  status: RunStatus;
  current_job_index: number;
  total_jobs: number;
  auto_approve: boolean;
  started_at?: string;
  completed_at?: string;
  current_job_description?: string;
}

export interface CreateBatchRequest {
  workspace: string;
  source_description?: string;
  model: string;
  auto_approve?: boolean;
  jobs: Omit<Job, 'status' | 'result'>[];
  // Inherited from parent chat session (name -> enabled selections)
  mcp_servers?: Record<string, boolean>;
  tools?: Record<string, boolean>;
}

export interface StartRunRequest {
  batch_id: string;
  auto_approve?: boolean;
}

export interface FeedbackRequest {
  feedback_text: string;
}

// Job history for viewing agent output
export interface JobHistoryMessage {
  role: 'user' | 'assistant' | 'tool_start' | 'tool_complete';
  content?: string;
  tool?: string;
  result?: string;
}

export interface JobHistory {
  job_id: string;
  sdk_session_id: string | null;
  status: JobStatus;
  result: JobResult | null;
  messages: JobHistoryMessage[];
  raw_events: Record<string, unknown>[];
  error?: string;
}

// ==================== Batches API ====================

export async function createBatch(request: CreateBatchRequest): Promise<ExecutionBatch> {
  const response = await fetch(`${API_BASE}/ralph/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to create batch');
  return response.json();
}

export async function listBatches(): Promise<ExecutionBatch[]> {
  const response = await fetch(`${API_BASE}/ralph/batches`);
  if (!response.ok) throw new Error('Failed to list batches');
  return response.json();
}

export async function getBatch(batchId: string): Promise<ExecutionBatch> {
  const response = await fetch(`${API_BASE}/ralph/batches/${batchId}`);
  if (!response.ok) throw new Error('Failed to get batch');
  return response.json();
}

export async function deleteBatch(batchId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ralph/batches/${batchId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete batch');
}

// ==================== Runs API ====================

export async function startRun(request: StartRunRequest): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to start run');
  return response.json();
}

export async function listRuns(): Promise<RunSummary[]> {
  const response = await fetch(`${API_BASE}/ralph/runs`);
  if (!response.ok) throw new Error('Failed to list runs');
  return response.json();
}

export async function listActiveRuns(): Promise<RunSummary[]> {
  const response = await fetch(`${API_BASE}/ralph/runs/active`);
  if (!response.ok) throw new Error('Failed to list active runs');
  return response.json();
}

export async function getRun(runId: string): Promise<RunSummary> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}`);
  if (!response.ok) throw new Error('Failed to get run');
  return response.json();
}

export async function getRunFull(runId: string): Promise<{ run: RalphRun; batch: ExecutionBatch | null }> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/full`);
  if (!response.ok) throw new Error('Failed to get run details');
  return response.json();
}

export async function deleteRun(runId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete run');
}

// ==================== Run Control API ====================

export async function approveJob(runId: string): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/approve`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to approve job');
  return response.json();
}

export async function skipJob(runId: string): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/skip`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to skip job');
  return response.json();
}

export async function retryJob(runId: string): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/retry`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to retry job');
  return response.json();
}

export async function submitFeedback(runId: string, feedbackText: string): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback_text: feedbackText }),
  });
  if (!response.ok) throw new Error('Failed to submit feedback');
  return response.json();
}

export async function setAutoApprove(runId: string, autoApprove: boolean): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/auto-approve?auto_approve=${autoApprove}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to set auto-approve');
  return response.json();
}

export async function stopRun(runId: string, force: boolean = false): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/stop?force=${force}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to stop run');
  return response.json();
}

export async function resumeRun(runId: string): Promise<RalphRun> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/resume`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to resume run');
  return response.json();
}

// ==================== Job History API ====================

export async function getJobHistory(runId: string, jobId: string): Promise<JobHistory> {
  const response = await fetch(`${API_BASE}/ralph/runs/${runId}/jobs/${jobId}/history`);
  if (!response.ok) throw new Error('Failed to get job history');
  return response.json();
}

// ==================== Streaming ====================

// Job event types from backend
export interface JobStartEvent {
  type: 'job_start';
  job_id: string;
  job_index: number;
  description: string;
}

export interface JobEventData {
  type: 'job_event';
  job_id: string;
  event_type: string;
  data: {
    content?: string;
    delta?: string;
    tool_name?: string;
    tool_call_id?: string;
  };
}

export interface JobCompleteEvent {
  type: 'job_complete';
  job_id: string;
  sdk_session_id?: string;
  summary?: string;
}

export interface JobErrorEvent {
  type: 'job_error';
  job_id: string;
  error: string;
}

export type JobEvent = JobStartEvent | JobEventData | JobCompleteEvent | JobErrorEvent;

export function streamRun(
  runId: string,
  onState: (run: RalphRun, batch: ExecutionBatch | null) => void,
  onComplete: (status: RunStatus) => void,
  onError: (error: string) => void,
  onJobEvent?: (event: JobEvent) => void  // New callback for job-level events
): () => void {
  const eventSource = new EventSource(`/api/ralph/runs/${runId}/stream`);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'state') {
        onState(data.run, data.batch);
      } else if (data.type === 'complete') {
        onComplete(data.status);
        eventSource.close();
      } else if (data.type === 'error') {
        onError(data.message);
        eventSource.close();
      } else if (['job_start', 'job_event', 'job_complete', 'job_error'].includes(data.type)) {
        // Pass job events to callback
        onJobEvent?.(data as JobEvent);
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  };
  
  eventSource.onerror = () => {
    onError('Connection lost');
    eventSource.close();
  };
  
  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

// ==================== Backwards Compatibility Aliases ====================
// These allow existing code to work during migration

export type TaskType = JobType;
export type TaskStatus = JobStatus;
export type TaskSource = JobSource;
export type TaskResult = JobResult;
export type Task = Job;
export type ExecutionPlan = ExecutionBatch;
export type CreatePlanRequest = CreateBatchRequest;

export const createPlan = createBatch;
export const listPlans = listBatches;
export const getPlan = getBatch;
export const deletePlan = deleteBatch;
export const approveTask = approveJob;
export const skipTask = skipJob;
export const retryTask = retryJob;
