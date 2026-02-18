/**
 * Agent Library — grid view of all defined agents.
 */

import { useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useUIStore } from '../../stores/uiStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import type { Agent } from '../../types/agent';

function AgentCard({ agent }: { agent: Agent }) {
  const { openTab } = useTabStore();
  const { defaultCwd } = useUIStore();

  const handleClick = () => {
    openTab({
      id: tabId.agentDetail(agent.id),
      type: 'agent-detail',
      label: agent.name,
      agentId: agent.id,
    });
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Deactivate current tab so new-session view renders
    useTabStore.setState({ activeTabId: null });
    useSessionStore.setState({
      isNewSession: true,
      newSessionSettings: {
        name: 'New Session',
        model: agent.model,
        cwd: defaultCwd,
        mcpServers: agent.mcp_servers || [],
        tools: agent.tools || { custom: [], builtin: [], excluded_builtin: [] },
        systemMessage: agent.system_message?.content ? agent.system_message : null,
        agentId: agent.id,
      },
    });
  };

  const handleAutomations = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTab({
      id: tabId.scheduleManager(),
      type: 'schedule-manager',
      label: `⏰ ${agent.name}`,
      agentId: agent.id,
    });
  };

  return (
    <button
      onClick={handleClick}
      className="bg-white/50 backdrop-blur border border-white/40 rounded-xl p-5 text-left hover:border-violet-300/60 hover:shadow-md transition-all group relative"
    >
      <div className="flex items-start justify-between">
        <div className="text-3xl mb-3">{agent.icon}</div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            onClick={handleAutomations}
            title="View automations for this agent"
            className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 cursor-pointer"
          >
            ⏰ Automations
          </span>
          <span
            onClick={handleStart}
            title="Start a new session with this agent's config"
            className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 cursor-pointer"
          >
            + New Session
          </span>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
        {agent.name}
      </h3>
      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
        {agent.description || 'No description'}
      </p>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        <span>{agent.model}</span>
      </div>
    </button>
  );
}

export function AgentLibrary() {
  const { agents, loading, fetchAgents } = useAgentStore();
  const { openTab } = useTabStore();

  useEffect(() => {
    if (agents.length === 0 && !loading) {
      fetchAgents();
    }
  }, [fetchAgents]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewAgent = () => {
    openTab({
      id: tabId.agentDetail('new'),
      type: 'agent-detail',
      label: 'New Agent',
      agentId: 'new',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🤖 Agent Library</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage agents
            </p>
          </div>
          <button
            onClick={handleNewAgent}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Agent
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg font-medium text-gray-700">No agents yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create your first agent to get started
            </p>
            <button
              onClick={handleNewAgent}
              className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm"
            >
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
