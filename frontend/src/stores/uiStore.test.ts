import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';
import type { Model } from '../api/models';

const initialState = useUIStore.getState();

function resetStore() {
  useUIStore.setState(initialState, true);
}

describe('uiStore', () => {
  beforeEach(resetStore);

  // --- toggleSidebar ---
  describe('toggleSidebar', () => {
    it('toggles from collapsed false to true', () => {
      expect(useUIStore.getState().isSidebarCollapsed).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().isSidebarCollapsed).toBe(true);
    });

    it('toggles back to false', () => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().isSidebarCollapsed).toBe(false);
    });
  });

  // --- setAvailableModels ---
  describe('setAvailableModels', () => {
    it('sets the available models list', () => {
      const models: Model[] = [
        { id: 'gpt-4.1', name: 'GPT 4.1' },
        { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      ];
      useUIStore.getState().setAvailableModels(models);
      expect(useUIStore.getState().availableModels).toEqual(models);
    });

    it('can set to empty array', () => {
      useUIStore.getState().setAvailableModels([{ id: 'x', name: 'X' }]);
      useUIStore.getState().setAvailableModels([]);
      expect(useUIStore.getState().availableModels).toEqual([]);
    });
  });

  // --- settings modal ---
  describe('settings modal', () => {
    it('opens and closes', () => {
      useUIStore.getState().openSettingsModal();
      expect(useUIStore.getState().isSettingsModalOpen).toBe(true);
      useUIStore.getState().closeSettingsModal();
      expect(useUIStore.getState().isSettingsModalOpen).toBe(false);
    });
  });

  // --- setDefaultModel ---
  describe('setDefaultModel', () => {
    it('updates the default model', () => {
      useUIStore.getState().setDefaultModel('claude-sonnet-4');
      expect(useUIStore.getState().defaultModel).toBe('claude-sonnet-4');
    });
  });

  // --- setDefaultCwd ---
  describe('setDefaultCwd', () => {
    it('updates the default cwd', () => {
      useUIStore.getState().setDefaultCwd('/home/user/projects');
      expect(useUIStore.getState().defaultCwd).toBe('/home/user/projects');
    });
  });
});
