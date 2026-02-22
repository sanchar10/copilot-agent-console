import { create } from 'zustand';

interface ActiveSession {
  session_id: string;
  session_name?: string;
  elapsed_seconds: number;
  current_step?: string;
  content_tail?: string;
}

interface AgentMonitorState {
  isOpen: boolean;
  activeCount: number;
  agents: ActiveSession[];
  connected: boolean;
  
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setActiveCount: (count: number) => void;
  setAgents: (agents: ActiveSession[]) => void;
  setConnected: (connected: boolean) => void;
}

export const useAgentMonitorStore = create<AgentMonitorState>((set) => ({
  isOpen: false,
  activeCount: 0,
  agents: [],
  connected: false,
  
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveCount: (count) => set({ activeCount: count }),
  setAgents: (agents) => set({ agents, activeCount: agents.length }),
  setConnected: (connected) => set({ connected }),
}));
