import { api } from './client';

export const rolesApi = {
  getAll: () => 
    api.get('/roles'),
  
  getById: (id: number) => 
    api.get(`/roles/${id}`),
  
  create: (data: any) => 
    api.post('/roles', data),
  
  update: (id: number, data: any) => 
    api.put(`/roles/${id}`, data),
  
  delete: (id: number) => 
    api.delete(`/roles/${id}`),
};
