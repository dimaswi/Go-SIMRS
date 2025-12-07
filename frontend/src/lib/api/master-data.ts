import { api } from './client';

export interface MasterData {
  id: number;
  category: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: number;
  parent?: MasterData;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export interface MasterDataRequest {
  category: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: number;
  sort_order?: number;
  is_active?: boolean;
  is_default?: boolean;
  metadata?: string;
}

export interface MasterDataCategory {
  code: string;
  name: string;
  description: string;
  count: number;
}

export const masterDataApi = {
  getCategories: () =>
    api.get<{ data: MasterDataCategory[] }>('/master-data/categories'),
  
  getByCategory: (category: string, params?: { include_inactive?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.include_inactive) searchParams.append('include_inactive', 'true');
    const queryString = searchParams.toString();
    return api.get<{ data: MasterData[] }>(`/master-data/category/${category}${queryString ? `?${queryString}` : ''}`);
  },
  
  getMultiple: (categories: string[]) =>
    api.post<{ data: Record<string, MasterData[]> }>('/master-data/multiple', { categories }),
  
  getById: (id: number) =>
    api.get<{ data: MasterData }>(`/master-data/${id}`),
  
  create: (data: MasterDataRequest) =>
    api.post<{ data: MasterData; message: string }>('/master-data', data),
  
  update: (id: number, data: Partial<MasterDataRequest>) =>
    api.put<{ data: MasterData; message: string }>(`/master-data/${id}`, data),
  
  delete: (id: number) =>
    api.delete<{ message: string }>(`/master-data/${id}`),
};
