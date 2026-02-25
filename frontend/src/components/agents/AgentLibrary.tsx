/**
 * Agent Library — grid view of all defined agents.
 */

import { useEffect, useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useUIStore } from '../../stores/uiStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import type { Agent } from '../../types/agent';

function AgentCard({ agent }: { agent: Agent }) {
  const { openTab } = useTabStore();
  const { defaultCwd } = useUIStore();

  // Check if this agent is composable (eligible as a sub-agent)
  const isComposable = !agent.tools.custom?.length
    && !agent.tools.excluded_builtin?.length
    && !agent.sub_agents?.length
    && !!agent.system_message?.content
    && !!agent.description;

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
        name: `${agent.name} Session`,
        model: agent.model,
        cwd: defaultCwd,
        mcpServers: agent.mcp_servers || [],
        tools: agent.tools || { custom: [], builtin: [], excluded_builtin: [] },
        systemMessage: agent.system_message?.content ? agent.system_message : null,
        agentId: agent.id,
        subAgents: agent.sub_agents || [],
      },
    });
  };

  const handleAutomations = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTab({
      id: tabId.automationManager(),
      type: 'automation-manager',
      label: `⏰ ${agent.name}`,
      agentId: agent.id,
    });
  };

  return (
    <button
      onClick={handleClick}
      className="bg-white/50 dark:bg-[#2a2a3c]/50 backdrop-blur border border-white/40 dark:border-[#3a3a4e] rounded-xl p-5 text-left hover:border-blue-300/60 dark:hover:border-blue-500/40 hover:shadow-md transition-all group relative"
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
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
        {agent.name}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
        {agent.description || 'No description'}
      </p>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400 dark:text-gray-500">
        <span>{agent.model}</span>
        {agent.sub_agents && agent.sub_agents.length > 0 && (
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium" title="Has sub-agents">
            👥 {agent.sub_agents.length}
          </span>
        )}
        {isComposable && (
          <span className="text-gray-300 dark:text-gray-600" title="Composable — can be used as a sub-agent">🧩</span>
        )}
      </div>
    </button>
  );
}

export function AgentLibrary() {
  const { agents, loading, fetchAgents } = useAgentStore();
  const { openTab } = useTabStore();
  const [search, setSearch] = useState('');

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

  const filtered = agents.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🤖 Agent Library</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create and manage agents
            </p>
          </div>
          <button
            onClick={handleNewAgent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Agent
          </button>
        </div>

        {/* Search */}
        {agents.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#3a3a4e] bg-white dark:bg-[#2a2a3c] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading agents...</div>
        ) : filtered.length === 0 && !search ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No agents yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create your first agent to get started
            </p>
            <button
              onClick={handleNewAgent}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
