import { api } from './client';

// BPJS Config Types
export interface BPJSConfigValue {
  value: string;
  has_value: boolean;
  description: string;
  is_secret: boolean;
  is_encrypted: boolean;
}

export interface BPJSConfigMap {
  bpjs_cons_id?: BPJSConfigValue;
  bpjs_secret_key?: BPJSConfigValue;
  bpjs_user_key?: BPJSConfigValue;
  bpjs_kode_ppk?: BPJSConfigValue;
  bpjs_nama_ppk?: BPJSConfigValue;
  bpjs_environment?: BPJSConfigValue;
  bpjs_base_url_dev?: BPJSConfigValue;
  bpjs_base_url_prod?: BPJSConfigValue;
  bpjs_sync_interval_minutes?: BPJSConfigValue;
  bpjs_auto_sync_enabled?: BPJSConfigValue;
  [key: string]: BPJSConfigValue | undefined;
}

export interface BPJSConnectionTestResult {
  success: boolean;
  message?: string;
  error?: string;
  environment?: string;
  base_url?: string;
  response_code?: number;
  response_time?: string;
  response_body?: string;
  duration?: number;
  poli_count?: number;
}

export interface BPJSSyncLog {
  id: number;
  endpoint: string;
  method: string;
  request_body: string;
  response_code: number;
  response_body: string;
  status: 'success' | 'failed' | 'timeout';
  error_message: string;
  request_at: string;
  response_at: string;
  duration_ms: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
}

export interface BPJSSyncStats {
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  avg_duration_ms: number;
}

// Referensi BPJS Types
export interface BPJSReferensiPoli {
  kdpoli: string;
  nmpoli: string;
}

export interface BPJSReferensiDokter {
  kodedokter: number;
  namadokter: string;
}

export interface BPJSJadwalDokter {
  kodedokter: number;
  namadokter: string;
  kodepoli: string;
  namapoli: string;
  hari: number;
  namahari: string;
  jadwal: string;
  libur: number;
  kapasitaspasien: number;
}

// Mapping Types
export interface BPJSPoliMapping {
  id: number;
  room_id: number;
  room_code: string;
  room_name: string;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
  is_active: boolean;
  room?: {
    id: number;
    code: string;
    name: string;
  };
  doctor_mappings?: BPJSDoctorMapping[];
  created_at: string;
  updated_at: string;
}

export interface BPJSDoctorMapping {
  id: number;
  poli_mapping_id: number;
  poli_mapping?: BPJSPoliMapping;
  doctor_schedule_id?: number;
  employee_id: number;
  employee_name: string;
  employee?: {
    id: number;
    nama_lengkap: string;
    nip?: string;
  };
  kode_dokter_bpjs: string;
  nama_dokter_bpjs: string;
  jadwal_hari: string;
  jam_praktek: string;
  kuota_jkn: number;
  kuota_non_jkn: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePoliMappingRequest {
  room_id: number;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
}

export interface UpdatePoliMappingRequest {
  kode_poli_bpjs?: string;
  nama_poli_bpjs?: string;
  is_active?: boolean;
}

export interface CreateDoctorMappingRequest {
  poli_mapping_id: number;
  employee_id: number;
  doctor_schedule_id?: number;
  kode_dokter_bpjs: string;
  nama_dokter_bpjs: string;
  jadwal_hari?: string;
  jam_praktek?: string;
  kuota_jkn?: number;
  kuota_non_jkn?: number;
}

export interface UpdateDoctorMappingRequest {
  kode_dokter_bpjs?: string;
  nama_dokter_bpjs?: string;
  jadwal_hari?: string;
  jam_praktek?: string;
  kuota_jkn?: number;
  kuota_non_jkn?: number;
  is_active?: boolean;
}

export const bpjsApi = {
  // Config
  getConfig: () => 
    api.get<{ data: BPJSConfigMap }>('/bpjs/config'),
  
  updateConfig: (data: Record<string, string>) => 
    api.put<{ message: string }>('/bpjs/config', data),
  
  initConfig: () => 
    api.post<{ message: string }>('/bpjs/config/init'),
  
  testConnection: () => 
    api.get<BPJSConnectionTestResult>('/bpjs/test-connection'),

  // Logs
  getLogs: (params?: { status?: string; date?: string; endpoint?: string; limit?: number }) => 
    api.get<{ data: BPJSSyncLog[] }>('/bpjs/logs', { params }),
  
  getStats: () => 
    api.get<{ data: BPJSSyncStats }>('/bpjs/logs/stats'),

  // Referensi BPJS
  getReferensiPoli: () =>
    api.get<{ data: BPJSReferensiPoli[]; count: number }>('/bpjs/referensi/poli'),
  
  getReferensiDokter: () =>
    api.get<{ data: BPJSReferensiDokter[]; count: number }>('/bpjs/referensi/dokter'),
  
  getJadwalDokter: (kodePoli: string, tanggal?: string) =>
    api.get<{ data: BPJSJadwalDokter[]; count: number }>('/bpjs/referensi/jadwal-dokter', {
      params: { kode_poli: kodePoli, tanggal }
    }),

  // Poli Mapping
  getPoliMappings: (params?: { room_id?: number; is_active?: boolean }) => 
    api.get<{ data: BPJSPoliMapping[] }>('/bpjs/mapping/poli', { params }),
  
  createPoliMapping: (data: CreatePoliMappingRequest) => 
    api.post<{ data: BPJSPoliMapping }>('/bpjs/mapping/poli', data),
  
  updatePoliMapping: (id: number, data: UpdatePoliMappingRequest) => 
    api.put<{ data: BPJSPoliMapping }>(`/bpjs/mapping/poli/${id}`, data),
  
  deletePoliMapping: (id: number) => 
    api.delete<{ message: string }>(`/bpjs/mapping/poli/${id}`),

  // Doctor Mapping
  getDoctorMappings: (params?: { poli_mapping_id?: number; employee_id?: number; is_active?: boolean }) =>
    api.get<{ data: BPJSDoctorMapping[] }>('/bpjs/mapping/dokter', { params }),
  
  createDoctorMapping: (data: CreateDoctorMappingRequest) =>
    api.post<{ data: BPJSDoctorMapping }>('/bpjs/mapping/dokter', data),
  
  updateDoctorMapping: (id: number, data: UpdateDoctorMappingRequest) =>
    api.put<{ data: BPJSDoctorMapping }>(`/bpjs/mapping/dokter/${id}`, data),
  
  deleteDoctorMapping: (id: number) =>
    api.delete<{ message: string }>(`/bpjs/mapping/dokter/${id}`),
  
  syncDoctorFromReferensi: () =>
    api.post<{ message: string; data: Record<string, unknown> }>('/bpjs/mapping/dokter/sync'),
};
