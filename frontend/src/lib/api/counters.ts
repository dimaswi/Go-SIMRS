import { api as client } from './client';

export interface Counter {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCounterInput {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
  location?: string;
}

export interface UpdateCounterInput {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
  location?: string;
}

export const counterApi = {
  // Get all counters
  getCounters: async (isActive?: boolean): Promise<Counter[]> => {
    const params = isActive !== undefined ? { is_active: isActive } : {};
    const response = await client.get<{ data: Counter[] }>('/counters', { params });
    return response.data.data;
  },

  // Get active counters only (for forms/kiosk)
  getActiveCounters: async (): Promise<Counter[]> => {
    const response = await client.get<{ data: Counter[] }>('/counters/active');
    return response.data.data;
  },

  // Get single counter
  getCounter: async (id: number): Promise<Counter> => {
    const response = await client.get<{ data: Counter }>(`/counters/${id}`);
    return response.data.data;
  },

  // Create counter
  createCounter: async (data: CreateCounterInput): Promise<Counter> => {
    const response = await client.post<{ data: Counter }>('/counters', data);
    return response.data.data;
  },

  // Update counter
  updateCounter: async (id: number, data: UpdateCounterInput): Promise<Counter> => {
    const response = await client.put<{ data: Counter }>(`/counters/${id}`, data);
    return response.data.data;
  },

  // Delete counter
  deleteCounter: async (id: number): Promise<void> => {
    await client.delete(`/counters/${id}`);
  },
};
