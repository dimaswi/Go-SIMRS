import { api } from './client';

export const permissionsApi = {
  getAll: () => 
    api.get('/permissions'),
  
  getById: (id: number) => 
    api.get(`/permissions/${id}`),
  
  create: (data: any) => 
    api.post('/permissions', data),
  
  update: (id: number, data: any) => 
    api.put(`/permissions/${id}`, data),
  
  delete: (id: number) => 
    api.delete(`/permissions/${id}`),
};
