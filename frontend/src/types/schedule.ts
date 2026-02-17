/** Schedule and TaskRun types matching backend models. */

export interface Schedule {
  id: string;
  agent_id: string;
  name: string;
  cron: string;
  prompt: string;
  cwd: string | null;
  enabled: boolean;
  max_runtime_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleWithNextRun extends Schedule {
  next_run: string | null;
  agent_name: string;
}

export interface CreateScheduleRequest {
  agent_id: string;
  name: string;
  cron: string;
  prompt: string;
  cwd?: string | null;
  enabled?: boolean;
  max_runtime_minutes?: number;
}

export interface UpdateScheduleRequest {
  name?: string;
  cron?: string;
  prompt?: string;
  cwd?: string | null;
  enabled?: boolean;
  max_runtime_minutes?: number;
}

export type TaskRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out' | 'aborted';

export interface TaskRunSummary {
  id: string;
  schedule_id: string | null;
  agent_id: string;
  agent_name: string;
  prompt: string;
  cwd: string | null;
  status: TaskRunStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error: string | null;
  session_id: string | null;
  token_usage: Record<string, number> | null;
}

export interface TaskRun extends TaskRunSummary {
  output: string | null;
  token_usage: Record<string, number> | null;
  session_id: string | null;
}
