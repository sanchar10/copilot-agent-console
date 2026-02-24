/** Workflow types matching backend models. */

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  yaml_filename: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  description: string;
  yaml_content: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string;
  yaml_content: string;
}

export interface WorkflowUpdate {
  name?: string;
  description?: string;
  yaml_content?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  node_results: Record<string, unknown>;
  events: Record<string, unknown>[];
  error: string | null;
  session_id: string | null;
}

export interface WorkflowRunSummary {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error: string | null;
  session_id: string | null;
}

export interface WorkflowRunRequest {
  message?: string;
  input_params?: Record<string, unknown>;
  cwd?: string;
}

export interface HumanInputRequest {
  request_id: string;
  data: Record<string, unknown> | string | boolean;
}
