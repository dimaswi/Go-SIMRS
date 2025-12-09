import { api } from './client';

// Patient Status
export type PatientStatus = 'Aktif' | 'Tidak Aktif' | 'Meninggal';

// Blood Type
export type BloodType = 'A' | 'B' | 'AB' | 'O' | 'Tidak Diketahui';

// Rhesus Type
export type RhesusType = 'Positif' | 'Negatif' | 'Tidak Diketahui';

// Insurance Type
export type InsuranceType = 'Umum' | 'BPJS' | 'Asuransi Swasta' | 'JKN' | 'Lainnya';

// Gender
export type Gender = 'L' | 'P';

export interface Patient {
  id: number;
  no_rm: string;
  
  // Identitas Pasien
  nik?: string;
  nama_lengkap: string;
  nama_panggilan?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin: Gender;
  golongan_darah?: BloodType;
  rhesus?: RhesusType;
  agama?: string;
  status_perkawinan?: string;
  pendidikan_terakhir?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
  suku?: string;
  bahasa?: string;

  // Alamat KTP
  alamat_ktp?: string;
  rt_ktp?: string;
  rw_ktp?: string;
  kelurahan_ktp?: string;
  kecamatan_ktp?: string;
  kota_ktp?: string;
  provinsi_ktp?: string;
  kode_pos_ktp?: string;

  // Alamat Domisili
  alamat_domisili?: string;
  rt_domisili?: string;
  rw_domisili?: string;
  kelurahan_domisili?: string;
  kecamatan_domisili?: string;
  kota_domisili?: string;
  provinsi_domisili?: string;
  kode_pos_domisili?: string;

  // Kontak
  no_telepon?: string;
  no_hp?: string;
  no_hp_alternatif?: string;
  email?: string;

  // Penanggung Jawab
  nama_penanggung_jawab?: string;
  hubungan_penanggung_jawab?: string;
  nik_penanggung_jawab?: string;
  alamat_penanggung_jawab?: string;
  telepon_penanggung_jawab?: string;

  // Data Orang Tua (untuk anak)
  nama_ayah?: string;
  nik_ayah?: string;
  pekerjaan_ayah?: string;
  nama_ibu?: string;
  nik_ibu?: string;
  pekerjaan_ibu?: string;

  // Jaminan Kesehatan
  jenis_jaminan: InsuranceType;
  no_bpjs?: string;
  kelas_bpjs?: string;
  faskes_tingkat_1?: string;
  nama_asuransi?: string;
  no_polis_asuransi?: string;
  masa_berlaku_asuransi?: string;

  // Riwayat Medis Penting
  alergi_obat?: string;
  alergi_makanan?: string;
  alergi_lainnya?: string;
  penyakit_kronis?: string;
  riwayat_operasi?: string;
  obat_rutin?: string;
  disabilitas?: string;

  // Data Tambahan
  foto?: string;
  status: PatientStatus;
  tanggal_registrasi?: string;
  tanggal_kunjungan_terakhir?: string;
  catatan_khusus?: string;
  
  // Finalization
  is_final?: boolean;
  finalized_at?: string;
  finalized_by?: number;
  
  created_by?: number;
  updated_by?: number;
  
  created_at: string;
  updated_at: string;
}

export interface PatientRequest {
  nik?: string;
  nama_lengkap: string;
  nama_panggilan?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin: Gender;
  golongan_darah?: BloodType;
  rhesus?: RhesusType;
  agama?: string;
  status_perkawinan?: string;
  pendidikan_terakhir?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
  suku?: string;
  bahasa?: string;

  // Alamat KTP
  alamat_ktp?: string;
  rt_ktp?: string;
  rw_ktp?: string;
  kelurahan_ktp?: string;
  kecamatan_ktp?: string;
  kota_ktp?: string;
  provinsi_ktp?: string;
  kode_pos_ktp?: string;

  // Alamat Domisili
  alamat_domisili?: string;
  rt_domisili?: string;
  rw_domisili?: string;
  kelurahan_domisili?: string;
  kecamatan_domisili?: string;
  kota_domisili?: string;
  provinsi_domisili?: string;
  kode_pos_domisili?: string;

  // Kontak
  no_telepon?: string;
  no_hp?: string;
  no_hp_alternatif?: string;
  email?: string;

  // Penanggung Jawab
  nama_penanggung_jawab?: string;
  hubungan_penanggung_jawab?: string;
  nik_penanggung_jawab?: string;
  alamat_penanggung_jawab?: string;
  telepon_penanggung_jawab?: string;

  // Data Orang Tua
  nama_ayah?: string;
  nik_ayah?: string;
  pekerjaan_ayah?: string;
  nama_ibu?: string;
  nik_ibu?: string;
  pekerjaan_ibu?: string;

  // Jaminan Kesehatan
  jenis_jaminan?: InsuranceType;
  no_bpjs?: string;
  kelas_bpjs?: string;
  faskes_tingkat_1?: string;
  nama_asuransi?: string;
  no_polis_asuransi?: string;
  masa_berlaku_asuransi?: string;

  // Riwayat Medis
  alergi_obat?: string;
  alergi_makanan?: string;
  alergi_lainnya?: string;
  penyakit_kronis?: string;
  riwayat_operasi?: string;
  obat_rutin?: string;
  disabilitas?: string;

  // Tambahan
  catatan_khusus?: string;
  status?: PatientStatus;
}

export interface PatientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PatientStatus;
  jaminan?: InsuranceType;
}

export interface PatientStats {
  total_patients: number;
  active_patients: number;
  bpjs_patients: number;
  new_patients_today: number;
}

export interface ReferenceData {
  value: string;
  label: string;
}

// Patients API
export const patientsApi = {
  // Get all patients with pagination and filters
  getAll: async (params?: PatientListParams) => {
    const response = await api.get('/patients', { params });
    return response.data;
  },

  // Get single patient
  getById: async (id: number) => {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  // Get patient by Medical Record Number
  getByNoRM: async (noRM: string) => {
    const response = await api.get(`/patients/by-rm/${noRM}`);
    return response.data;
  },

  // Quick search for autocomplete
  search: async (query: string, limit = 10) => {
    const response = await api.get('/patients/search', { params: { q: query, limit } });
    return response.data;
  },

  // Create new patient
  create: async (data: PatientRequest) => {
    const response = await api.post('/patients', data);
    return response.data;
  },

  // Update patient
  update: async (id: number, data: PatientRequest) => {
    const response = await api.put(`/patients/${id}`, data);
    return response.data;
  },

  // Delete patient
  delete: async (id: number) => {
    const response = await api.delete(`/patients/${id}`);
    return response.data;
  },

  // Update patient status
  updateStatus: async (id: number, status: PatientStatus, catatan?: string) => {
    const response = await api.patch(`/patients/${id}/status`, { status, catatan_khusus: catatan });
    return response.data;
  },

  // Update last visit date
  updateLastVisit: async (id: number) => {
    const response = await api.patch(`/patients/${id}/last-visit`);
    return response.data;
  },

  // Upload patient photo
  uploadPhoto: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post(`/patients/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Get patient statistics
  getStats: async () => {
    const response = await api.get('/patients/stats');
    return response.data;
  },

  // Finalize patient data
  finalize: async (id: number) => {
    const response = await api.post(`/patients/${id}/finalize`);
    return response.data;
  },

  // Unfinalize patient data
  unfinalize: async (id: number) => {
    const response = await api.post(`/patients/${id}/unfinalize`);
    return response.data;
  },

  // Reference Data
  getStatuses: async () => {
    const response = await api.get('/patient-statuses');
    return response.data;
  },

  getBloodTypes: async () => {
    const response = await api.get('/blood-types');
    return response.data;
  },

  getRhesusTypes: async () => {
    const response = await api.get('/rhesus-types');
    return response.data;
  },

  getInsuranceTypes: async () => {
    const response = await api.get('/insurance-types');
    return response.data;
  },
};

export default patientsApi;
