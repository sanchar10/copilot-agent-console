import type { AgentTools, SystemMessage } from './agent';

export interface Session {
  session_id: string;
  session_name: string;
  model: string;
  cwd?: string;
  mcp_servers?: string[];
  tools?: AgentTools;
  system_message?: SystemMessage | null;
  created_at: string;
  updated_at: string;
  // Reference fields (informational only)
  agent_id?: string | null;
  trigger?: string | null;
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}

export interface ChatStep {
  title: string;
  detail?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  steps?: ChatStep[];
}

export interface CreateSessionRequest {
  model: string;
  name?: string;
  cwd?: string;
  mcp_servers?: string[];
  tools?: AgentTools;
  system_message?: SystemMessage | null;
  agent_id?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  cwd?: string;
  mcp_servers?: string[];
  tools?: AgentTools;
  system_message?: SystemMessage | null;
}
