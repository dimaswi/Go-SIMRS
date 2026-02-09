import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Separate axios instance for patient portal
const patientApi = axios.create({
  baseURL: API_URL.replace('/api', '/api/patient-portal'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token interceptor
patientApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('patientPortalToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface PatientLoginRequest {
  no_rm: string;
  nik: string;
  tanggal_lahir: string; // yyyy-mm-dd
}

export interface PatientProfile {
  id: number;
  no_rm: string;
  nama_lengkap: string;
  nik: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat: string;
  no_telepon: string;
  no_hp?: string;
  email?: string;
  golongan_darah: string;
  rhesus?: string;
  agama: string;
  pekerjaan: string;
  status_perkawinan: string;
  pendidikan_terakhir?: string;
  
  // Alamat lengkap
  alamat_ktp?: string;
  rt_ktp?: string;
  rw_ktp?: string;
  kelurahan_ktp?: string;
  kecamatan_ktp?: string;
  kota_ktp?: string;
  provinsi_ktp?: string;
  
  // Penanggung Jawab
  nama_penanggung_jawab?: string;
  hubungan_penanggung_jawab?: string;
  telepon_penanggung_jawab?: string;
  
  // Jaminan Kesehatan
  jenis_jaminan?: string;
  no_bpjs?: string;
  kelas_bpjs?: string;
  faskes_tingkat_1?: string;
  
  photo_url?: string;
  total_kunjungan: number;
  kunjungan_terakhir?: string;
}

export interface PatientLoginResponse {
  token: string;
  patient: PatientProfile;
}

export interface VisitHistoryItem {
  id: number;
  visit_number: string;
  tanggal_kunjungan: string;
  nama_poli: string;
  nama_dokter: string;
  jenis_kunjungan: string;
  keluhan: string;
  diagnosa?: string;
  status: string;
  has_resume: boolean;
}

export interface VisitHistoryResponse {
  visits: VisitHistoryItem[];
  total: number;
}

export interface VitalSign {
  nama: string;
  nilai: string;
  satuan: string;
}

export interface Diagnosis {
  kode_icd10: string;
  nama: string;
  tipe: string;
}

export interface ProcedureItem {
  kode_icd9?: string;
  nama: string;
  tanggal: string;
  dokter: string;
}

export interface Medication {
  nama_obat: string;
  dosis: string;
  frekuensi: string;
  durasi: string;
  catatan?: string;
}

export interface LabResult {
  nama_pemeriksaan: string;
  hasil: string;
  satuan: string;
  nilai_normal: string;
  status: string;
}

export interface VisitDetail {
  id: number;
  visit_number: string;
  tanggal_kunjungan: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  nama_poli: string;
  nama_dokter: string;
  jenis_kunjungan: string;
  jenis_pelayanan: string;
  keluhan: string;
  status: string;
}

export interface MedicalResume {
  visit: VisitDetail;
  patient: PatientProfile;
  vital_signs: VitalSign[];
  diagnoses: Diagnosis[];
  procedures: ProcedureItem[];
  medications: Medication[];
  lab_results?: LabResult[];
  doctor_notes: string;
  follow_up_plan?: string;
}

export interface PatientAllergy {
  id: number;
  allergen_type: string;
  allergen_name: string;
  reaction: string;
  severity: string;
  notes?: string;
}

export interface AllergiesResponse {
  allergies: PatientAllergy[];
}

// API functions
export const patientPortalApi = {
  // Login
  login: (data: PatientLoginRequest) =>
    patientApi.post<PatientLoginResponse>('/login', data),

  // Get profile
  getProfile: () =>
    patientApi.get<PatientProfile>('/profile'),

  // Get visit history
  getVisitHistory: () =>
    patientApi.get<VisitHistoryResponse>('/visits'),

  // Get medical resume for a visit
  getMedicalResume: (visitId: number) =>
    patientApi.get<MedicalResume>(`/visits/${visitId}/resume`),

  // Get allergies
  getAllergies: () =>
    patientApi.get<AllergiesResponse>('/allergies'),
};

// Auth helpers
export const patientPortalAuth = {
  getToken: () => localStorage.getItem('patientPortalToken'),
  
  setToken: (token: string) => localStorage.setItem('patientPortalToken', token),
  
  removeToken: () => localStorage.removeItem('patientPortalToken'),
  
  getPatient: (): PatientProfile | null => {
    const data = localStorage.getItem('patientPortalData');
    return data ? JSON.parse(data) : null;
  },
  
  setPatient: (patient: PatientProfile) => 
    localStorage.setItem('patientPortalData', JSON.stringify(patient)),
  
  removePatient: () => localStorage.removeItem('patientPortalData'),
  
  isAuthenticated: () => !!localStorage.getItem('patientPortalToken'),
  
  logout: () => {
    localStorage.removeItem('patientPortalToken');
    localStorage.removeItem('patientPortalData');
  },
};
