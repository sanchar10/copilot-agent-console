/**
 * Agent Editor — form-based editor for creating/editing agent definitions.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAgentStore } from '../../stores/agentStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import { useUIStore } from '../../stores/uiStore';
import { listMCPServers } from '../../api/mcp';
import { getTools } from '../../api/tools';
import { MCPSelector } from '../chat/MCPSelector';
import { ToolsSelector } from '../chat/ToolsSelector';
import { SystemPromptEditor } from '../common/SystemPromptEditor';
import { EmojiPicker } from '../common/EmojiPicker';
import { ConfirmModal } from '../common/ConfirmModal';
import type { CreateAgentRequest, UpdateAgentRequest, SystemMessage } from '../../types/agent';
import type { MCPServer, MCPServerSelections } from '../../types/mcp';
import type { ToolInfo, ToolSelections } from '../../api/tools';

interface AgentEditorProps {
  agentId: string; // 'new' for creating a new agent
}

/** Convert agent's string[] to Record<string, boolean> for selector components */
function listToSelections(list: string[], allItems: { name: string }[]): Record<string, boolean> {
  const selections: Record<string, boolean> = {};
  for (const item of allItems) {
    selections[item.name] = list.includes(item.name);
  }
  return selections;
}

/** Convert selector Record<string, boolean> back to string[] (only enabled names) */
function selectionsToList(selections: Record<string, boolean>): string[] {
  return Object.entries(selections)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

export function AgentEditor({ agentId }: AgentEditorProps) {
  const { agents, createAgent, updateAgent, deleteAgent, fetchAgents } = useAgentStore();
  const { closeTab, updateTabLabel, openTab } = useTabStore();
  const { availableModels, defaultModel } = useUIStore();
  const isNew = agentId === 'new';

  const existingAgent = agents.find((a) => a.id === agentId);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [model, setModel] = useState(defaultModel);
  const [systemMessage, setSystemMessage] = useState<SystemMessage | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [builtinTools, setBuiltinTools] = useState<string[]>([]);
  const [excludedBuiltinTools, setExcludedBuiltinTools] = useState<string[]>([]);
  const [selectedMcpServers, setSelectedMcpServers] = useState<string[]>([]);
  const [availableMcpServers, setAvailableMcpServers] = useState<MCPServer[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load existing agent data
  useEffect(() => {
    if (existingAgent) {
      setName(existingAgent.name);
      setDescription(existingAgent.description);
      setIcon(existingAgent.icon);
      setModel(existingAgent.model);
      setSystemMessage(existingAgent.system_message?.content ? existingAgent.system_message : null);
      // Load tools from structured fields
      setSelectedTools(existingAgent.tools.custom || []);
      setBuiltinTools(existingAgent.tools.builtin || []);
      setExcludedBuiltinTools(existingAgent.tools.excluded_builtin || []);
      setSelectedMcpServers(existingAgent.mcp_servers || []);
    }
  }, [existingAgent, availableTools]);

  // Load available MCP servers and tools from backend
  useEffect(() => {
    listMCPServers().then((config) => {
      setAvailableMcpServers(config.servers);
    }).catch(() => {});
    getTools().then((config) => {
      setAvailableTools(config.tools);
    }).catch(() => {});
  }, []);

  // Convert between agent's string[] and selector's Record<string, boolean>
  const mcpSelections: MCPServerSelections = listToSelections(selectedMcpServers, availableMcpServers);
  const toolSelections: ToolSelections = listToSelections(selectedTools, availableTools);

  const handleMcpChange = (selections: MCPServerSelections) => {
    setSelectedMcpServers(selectionsToList(selections));
  };

  const handleToolsChange = (selections: ToolSelections) => {
    setSelectedTools(selectionsToList(selections));
  };

  const buildRequest = useCallback((): CreateAgentRequest | UpdateAgentRequest => ({
    name,
    description,
    icon,
    model,
    system_message: systemMessage || { mode: 'replace', content: '' },
    tools: {
      custom: selectedTools,
      builtin: builtinTools,
      excluded_builtin: excludedBuiltinTools,
    },
    mcp_servers: selectedMcpServers,
  }), [name, description, icon, model, systemMessage,
    selectedTools, builtinTools, excludedBuiltinTools, selectedMcpServers]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      if (isNew) {
        const created = await createAgent(buildRequest() as CreateAgentRequest);
        // Close the "new" tab and open the created agent's tab
        closeTab(tabId.agentDetail('new'));
        openTab({
          id: tabId.agentDetail(created.id),
          type: 'agent-detail',
          label: created.name,
          agentId: created.id,
        });
      } else {
        await updateAgent(agentId, buildRequest() as UpdateAgentRequest);
        updateTabLabel(tabId.agentDetail(agentId), name);
      }
      await fetchAgents();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Failed to save agent:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agentId);
      closeTab(tabId.agentDetail(agentId));
    } catch (e) {
      console.error('Failed to delete agent:', e);
    }
  };

  if (!isNew && !existingAgent) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Agent not found. It may have been deleted.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {icon} {isNew ? 'New Agent' : name}
          </h1>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                saveStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {saving ? 'Saving...' : saveStatus === 'success' ? '✓ Saved' : saveStatus === 'error' ? '✗ Failed' : 'Save'}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Basic Info</h2>
            <div className="grid grid-cols-[1fr_80px] gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Agent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Icon</label>
                <EmojiPicker value={icon} onChange={setIcon} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </section>

          {/* System Prompt — shared component */}
          <SystemPromptEditor
            value={systemMessage}
            onChange={setSystemMessage}
            variant="full"
          />

          {/* Tools */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Tools</h2>
              <span className="text-xs text-gray-400">
                {excludedBuiltinTools.length === 0 && builtinTools.length === 0
                  ? [
                      'All built-in tools enabled',
                      selectedTools.length > 0 ? `${selectedTools.length} custom` : '',
                    ].filter(Boolean).join(', ')
                  : [
                      selectedTools.length > 0 ? `${selectedTools.length} custom` : '',
                      builtinTools.length > 0 ? `${builtinTools.length} built-in only` : '',
                      excludedBuiltinTools.length > 0 ? `${excludedBuiltinTools.length} excluded` : '',
                    ].filter(Boolean).join(', ')
                }
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Select which tools this agent can use.
            </p>
            <ToolsSelector
              availableTools={availableTools}
              selections={toolSelections}
              onSelectionsChange={handleToolsChange}
              builtinTools={builtinTools}
              excludedBuiltinTools={excludedBuiltinTools}
              onBuiltinToolsChange={(builtin, excluded) => {
                setBuiltinTools(builtin);
                setExcludedBuiltinTools(excluded);
              }}
            />
          </section>

          {/* MCP Servers */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">MCP Servers</h2>
              <span className="text-xs text-gray-400">
                {selectedMcpServers.length === 0
                  ? 'None selected'
                  : `${selectedMcpServers.length} selected`}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Select which MCP servers this agent should use.
            </p>
            {availableMcpServers.length > 0 ? (
              <MCPSelector
                availableServers={availableMcpServers}
                selections={mcpSelections}
                onSelectionsChange={handleMcpChange}
              />
            ) : (
              <p className="text-sm text-gray-400 italic">
                No MCP servers configured. Add global servers in ~/.copilot/mcp-config.json
                or agent-only servers in ~/.copilot-agent-console/mcp-config.json
              </p>
            )}
          </section>
        </div>
      </div>

      {createPortal(
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Agent"
          message={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            setShowDeleteConfirm(false);
            handleDelete();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body
      )}
    </div>
  );
}
