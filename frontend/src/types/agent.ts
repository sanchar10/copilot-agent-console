/** Agent definition types matching backend models.
 * 
 * An agent is a pure capability template. Schedules are separate
 * (one agent can have multiple schedules with different CWDs and inputs).
 */

export interface SystemMessage {
  mode: 'replace' | 'append';
  content: string;
}

export interface AgentTools {
  custom: string[];
  builtin: string[];
  excluded_builtin: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  system_message: SystemMessage;
  model: string;
  tools: AgentTools;
  mcp_servers: string[];
  sub_agents: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  icon?: string;
  system_message?: SystemMessage;
  model?: string;
  tools?: AgentTools;
  mcp_servers?: string[];
  sub_agents?: string[];
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  icon?: string;
  system_message?: SystemMessage;
  model?: string;
  tools?: AgentTools;
  mcp_servers?: string[];
  sub_agents?: string[];
}
