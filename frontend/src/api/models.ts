export interface Model {
  id: string;
  name: string;
}

interface ModelsResponse {
  models: Model[];
}

export async function fetchModels(): Promise<Model[]> {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  const data: ModelsResponse = await response.json();
  return data.models;
}
