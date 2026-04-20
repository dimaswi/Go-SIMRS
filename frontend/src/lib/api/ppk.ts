import { api } from './client';

export interface PPKMaster {
  id: number;
  kode_bpjs: string;
  kode_kemenkes?: string;
  nama: string;
  jenis?: string;
  kelas?: string;
  alamat?: string;
  telepon?: string;
  wilayah?: string;
  des_wilayah?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PPKMasterRequest {
  kode_bpjs: string;
  kode_kemenkes?: string;
  nama: string;
  jenis?: string;
  kelas?: string;
  alamat?: string;
  telepon?: string;
  wilayah?: string;
  des_wilayah?: string;
  is_active?: boolean;
}

export const ppkApi = {
  getAll: (params?: { search?: string; active?: boolean; limit?: number }) =>
    api.get<{ data: PPKMaster[] }>('/ppk', { params }),

  getById: (id: number) =>
    api.get<{ data: PPKMaster }>(`/ppk/${id}`),

  create: (payload: PPKMasterRequest) =>
    api.post<{ data: PPKMaster; message: string }>('/ppk', payload),

  update: (id: number, payload: Partial<PPKMasterRequest>) =>
    api.put<{ data: PPKMaster; message: string }>(`/ppk/${id}`, payload),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/ppk/${id}`),
};
