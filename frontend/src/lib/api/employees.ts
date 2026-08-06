import { api } from './client';
import type { User } from './types';

export interface Employee {
  id: number;
  nik: string;
  nip?: string;
  nama_lengkap: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin: 'L' | 'P';
  agama?: string;
  status_perkawinan?: string;
  alamat?: string;
  kota?: string;
  kecamatan?: string;
  kelurahan?: string;
  provinsi?: string;
  kode_pos?: string;
  no_telepon?: string;
  no_hp?: string;
  email?: string;
  foto?: string;
  tipe_karyawan: string;
  status_kepegawaian: string;
  tanggal_masuk?: string;
  tanggal_keluar?: string;
  departemen?: string;
  jabatan?: string;
  no_str?: string;
  tanggal_str?: string;
  masa_berlaku_str?: string;
  no_sip?: string;
  tanggal_sip?: string;
  masa_berlaku_sip?: string;
  spesialisasi?: string;
  pendidikan_terakhir?: string;
  nama_institusi?: string;
  tahun_lulus?: number;
  nama_bank?: string;
  no_rekening?: string;
  atas_nama_rekening?: string;
  nama_kontak_darurat?: string;
  hubungan_kontak_darurat?: string;
  telepon_kontak_darurat?: string;
  is_active: boolean;
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRequest {
  nik: string;
  nip?: string;
  nama_lengkap: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin: string;
  agama?: string;
  status_perkawinan?: string;
  alamat?: string;
  kota?: string;
  kecamatan?: string;
  kelurahan?: string;
  provinsi?: string;
  kode_pos?: string;
  no_telepon?: string;
  no_hp?: string;
  email?: string;
  foto?: string;
  tipe_karyawan: string;
  status_kepegawaian: string;
  tanggal_masuk?: string;
  tanggal_keluar?: string;
  departemen?: string;
  jabatan?: string;
  no_str?: string;
  tanggal_str?: string;
  masa_berlaku_str?: string;
  no_sip?: string;
  tanggal_sip?: string;
  masa_berlaku_sip?: string;
  spesialisasi?: string;
  pendidikan_terakhir?: string;
  nama_institusi?: string;
  tahun_lulus?: number;
  nama_bank?: string;
  no_rekening?: string;
  atas_nama_rekening?: string;
  nama_kontak_darurat?: string;
  hubungan_kontak_darurat?: string;
  telepon_kontak_darurat?: string;
  is_active?: boolean;
}

export const employeesApi = {
  getAll: (params?: { search?: string; tipe_karyawan?: string; status_kepegawaian?: string; is_active?: string; limit?: number; page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.tipe_karyawan) searchParams.append('tipe_karyawan', params.tipe_karyawan);
    if (params?.status_kepegawaian) searchParams.append('status_kepegawaian', params.status_kepegawaian);
    if (params?.is_active) searchParams.append('is_active', params.is_active);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    const queryString = searchParams.toString();
    return api.get<{ data: Employee[] }>(`/employees${queryString ? `?${queryString}` : ''}`);
  },
  
  getLookup: (params?: { search?: string; tipe_karyawan?: string; status_kepegawaian?: string; is_active?: string; limit?: number; page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.tipe_karyawan) searchParams.append('tipe_karyawan', params.tipe_karyawan);
    if (params?.status_kepegawaian) searchParams.append('status_kepegawaian', params.status_kepegawaian);
    if (params?.is_active) searchParams.append('is_active', params.is_active);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    const queryString = searchParams.toString();
    return api.get<{ data: Employee[] }>(`/employees/lookup${queryString ? `?${queryString}` : ''}`);
  },
  
  getById: (id: number) => 
    api.get<{ data: Employee }>(`/employees/${id}`),
  
  create: (data: Partial<EmployeeRequest>) => 
    api.post<{ data: Employee }>('/employees', data),
  
  update: (id: number, data: Partial<EmployeeRequest>) => 
    api.put<{ data: Employee }>(`/employees/${id}`, data),
  
  delete: (id: number) => 
    api.delete(`/employees/${id}`),
  
  getTypes: () => 
    api.get<{ data: string[] }>('/employees/types'),
  
  getStatuses: () => 
    api.get<{ data: string[] }>('/employees/statuses'),
  
  getWithoutUser: () => 
    api.get<{ data: Employee[] }>('/employees/without-user'),
};
