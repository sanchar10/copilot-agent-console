import { create } from 'zustand';

interface AgentMonitorState {
  isOpen: boolean;
  activeCount: number;
  
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setActiveCount: (count: number) => void;
}

export const useAgentMonitorStore = create<AgentMonitorState>((set) => ({
  isOpen: false,
  activeCount: 0,
  
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveCount: (count) => set({ activeCount: count }),
}));
