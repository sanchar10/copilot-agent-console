import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { useUIStore } from '../../stores/uiStore';
import { updateSettings } from '../../api/settings';

export function SettingsModal() {
  const { 
    isSettingsModalOpen, 
    closeSettingsModal, 
    availableModels, 
    defaultModel, 
    setDefaultModel,
    defaultCwd,
    setDefaultCwd 
  } = useUIStore();
  
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedCwd, setSelectedCwd] = useState(defaultCwd);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedCwd(defaultCwd);
    setError(null);
  }, [defaultModel, defaultCwd, isSettingsModalOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateSettings({ 
        default_model: selectedModel,
        default_cwd: selectedCwd || undefined
      });
      setDefaultModel(selectedModel);
      if (selectedCwd) {
        setDefaultCwd(selectedCwd);
      }
      closeSettingsModal();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings. Check that the directory exists.');
    } finally {
      setIsSaving(false);
    }
  };

  const modelOptions = availableModels.map((model) => ({
    value: model.id,
    label: model.name,
  }));

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={closeSettingsModal}
      title="Settings"
      footer={
        <>
          <Button variant="secondary" onClick={closeSettingsModal}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Default Model"
          options={modelOptions}
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        />
        <p className="text-sm text-gray-500">
          This model will be used for all new sessions.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Working Directory
          </label>
          <input
            type="text"
            value={selectedCwd}
            onChange={(e) => setSelectedCwd(e.target.value)}
            className="w-full px-3 py-2 border border-white/40 bg-white/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent text-sm"
            placeholder="e.g., C:\Users\you\projects"
          />
          <p className="text-sm text-gray-500 mt-1">
            New sessions will start in this directory. Can be changed per-session.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
