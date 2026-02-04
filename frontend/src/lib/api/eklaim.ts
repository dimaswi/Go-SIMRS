import { api } from './client';

// Types
export interface EKlaim {
  id: number;
  visit_id: number;
  visit?: any;
  state: EKlaimState;
  idrg_valid: boolean;
  inacbg_valid: boolean;
  last_error?: string;
  last_error_at?: string;
  last_grouping_at?: string;
  
  // SEP Data
  no_sep: string;
  no_kartu: string;
  tgl_masuk?: string;
  tgl_pulang?: string;
  jenis_pelayanan: string;
  jenis_rawat: string;
  cara_masuk: string;
  jenis_keluar: string;
  
  // Patient Info
  tgl_lahir?: string;
  jenis_kelamin: string;
  berat_badan: number;
  
  // Tarif RS
  tarif_rs: number;
  tarif_prosedur: number;
  tarif_alkes: number;
  tarif_obat: number;
  tarif_kamar: number;
  tarif_lainnya: number;
  total_tarif_rs: number;
  
  // ICU/NICU
  los: number;
  los_icu: number;
  los_nicu: number;
  ventilator: number;
  adl_sub_acute: number;
  adl_chronic: number;
  
  // Neonatus
  apgar_menit_1: number;
  apgar_menit_5: number;
  berat_lahir: number;
  umur_kehamilan: number;
  
  // iDRG Result
  idrg_code: string;
  idrg_description: string;
  idrg_tarif: number;
  idrg_grouped_at?: string;
  idrg_finalized_at?: string;
  idrg_finalized_by?: number;
  
  // INACBG Result
  inacbg_code: string;
  inacbg_description: string;
  inacbg_tarif: number;
  inacbg_grouped_at?: string;
  inacbg_finalized_at?: string;
  inacbg_finalized_by?: number;
  
  // Final Claim
  claim_finalized_at?: string;
  claim_finalized_by?: number;
  claim_sent_at?: string;
  claim_sent_by?: number;
  
  // Verification
  verified_at?: string;
  verification_status: string;
  verification_note: string;
  tarif_verifikasi: number;
  
  // Relations
  diagnoses?: EKlaimDiagnosis[];
  procedures?: EKlaimProcedure[];
  logs?: EKlaimLog[];
  
  // Button visibility (from backend)
  buttons?: EKlaimButtonVisibility;
  
  created_at: string;
  updated_at: string;
}

export type EKlaimState = 
  | 'DRAFT'
  | 'IDRG_GROUPED'
  | 'IDRG_FINAL'
  | 'INACBG_GROUPED'
  | 'INACBG_FINAL'
  | 'CLAIM_FINAL'
  | 'SENT'
  | 'VERIFIED'
  | 'DISPUTED'
  | 'REJECTED';

export interface EKlaimDiagnosis {
  id: number;
  eklaim_id: number;
  code: string;
  name: string;
  is_primary: boolean;
  source: 'idrg' | 'inacbg';
  is_im_code: boolean;
  sequence: number;
  has_warning: boolean;
  warning_message?: string;
  suggested_code?: string;
}

export interface EKlaimProcedure {
  id: number;
  eklaim_id: number;
  code: string;
  name: string;
  multiplicity: number;
  setting: ProcedureSetting;
  source: 'idrg' | 'inacbg';
  is_im_code: boolean;
  sequence: number;
  has_warning: boolean;
  warning_message?: string;
  suggested_code?: string;
}

export type ProcedureSetting = 'OR' | 'NON_OR' | 'ICU' | 'CATH' | 'ENDO' | 'OTHER';

export interface EKlaimLog {
  id: number;
  eklaim_id: number;
  user_id?: number;
  user?: any;
  action: string;
  from_state: string;
  to_state: string;
  description: string;
  request_data?: string;
  response_data?: string;
  is_error: boolean;
  error_message?: string;
  ip_address?: string;
  created_at: string;
}

export interface EKlaimButtonVisibility {
  grouping_idrg: boolean;
  final_idrg: boolean;
  edit_idrg: boolean;
  grouping_inacbg: boolean;
  final_inacbg: boolean;
  edit_inacbg: boolean;
  final_claim: boolean;
  send_claim: boolean;
  print_claim: boolean;
  form_disabled: boolean;
  inacbg_visible: boolean;
}

export interface CreateEKlaimInput {
  visit_id: number;
  no_sep: string;
  no_kartu?: string;
  tgl_masuk?: string;
  tgl_pulang?: string;
  jenis_rawat?: string;
  cara_masuk?: string;
  jenis_keluar?: string;
  tgl_lahir?: string;
  jenis_kelamin?: string;
  berat_badan?: number;
  tarif_rs?: number;
  tarif_prosedur?: number;
  tarif_alkes?: number;
  tarif_obat?: number;
  tarif_kamar?: number;
  tarif_lainnya?: number;
}

export interface AddDiagnosisInput {
  code: string;
  name: string;
  is_primary?: boolean;
  is_im_code?: boolean;
}

export interface AddProcedureInput {
  code: string;
  name: string;
  multiplicity?: number;
  setting?: ProcedureSetting;
  is_im_code?: boolean;
}

// State labels
export const eklaimStateLabels: Record<EKlaimState, string> = {
  'DRAFT': 'Draft',
  'IDRG_GROUPED': 'iDRG Grouped',
  'IDRG_FINAL': 'iDRG Final',
  'INACBG_GROUPED': 'INACBG Grouped',
  'INACBG_FINAL': 'INACBG Final',
  'CLAIM_FINAL': 'Klaim Final',
  'SENT': 'Terkirim',
  'VERIFIED': 'Terverifikasi',
  'DISPUTED': 'Dispute',
  'REJECTED': 'Ditolak',
};

export const eklaimStateColors: Record<EKlaimState, string> = {
  'DRAFT': 'bg-gray-500',
  'IDRG_GROUPED': 'bg-blue-500',
  'IDRG_FINAL': 'bg-blue-700',
  'INACBG_GROUPED': 'bg-purple-500',
  'INACBG_FINAL': 'bg-purple-700',
  'CLAIM_FINAL': 'bg-orange-500',
  'SENT': 'bg-green-500',
  'VERIFIED': 'bg-green-700',
  'DISPUTED': 'bg-yellow-500 text-black',
  'REJECTED': 'bg-red-500',
};

export const caraMasukLabels: Record<string, string> = {
  '1': 'IGD',
  '2': 'Poliklinik/Rawat Jalan',
  '3': 'Rujukan Langsung dari RS Lain',
  '4': 'Lahir di Rumah Sakit',
};

export const jenisKeluarLabels: Record<string, string> = {
  '1': 'Sembuh/Membaik',
  '2': 'Rujuk ke RS Lain',
  '3': 'Atas Permintaan Sendiri (APS)',
  '4': 'Meninggal',
  '5': 'Meninggal < 48 jam',
  '6': 'Meninggal ≥ 48 jam',
};

export const jenisRawatLabels: Record<string, string> = {
  '1': 'Rawat Jalan',
  '2': 'Rawat Inap',
  '3': 'IGD',
};

export const procedureSettingLabels: Record<ProcedureSetting, string> = {
  'OR': 'Operating Room',
  'NON_OR': 'Non-Operating Room',
  'ICU': 'ICU',
  'CATH': 'Catheterization Lab',
  'ENDO': 'Endoscopy',
  'OTHER': 'Lainnya',
};

// API Functions
export const eklaimApi = {
  // List
  getList: async (params?: {
    page?: number;
    limit?: number;
    state?: EKlaimState;
    start_date?: string;
    end_date?: string;
    no_sep?: string;
    verification_status?: string;
  }) => {
    const response = await api.get('/eklaim', { params });
    return response.data;
  },

  // Detail
  getById: async (id: number) => {
    const response = await api.get(`/eklaim/${id}`);
    return response.data;
  },

  // Create
  create: async (data: CreateEKlaimInput) => {
    const response = await api.post('/eklaim', data);
    return response.data;
  },

  // Update
  update: async (id: number, data: Partial<EKlaim>) => {
    const response = await api.put(`/eklaim/${id}`, data);
    return response.data;
  },

  // Diagnosis
  addDiagnosis: async (eklaimId: number, data: AddDiagnosisInput, source: 'idrg' | 'inacbg' = 'idrg') => {
    const response = await api.post(`/eklaim/${eklaimId}/diagnosis?source=${source}`, data);
    return response.data;
  },

  removeDiagnosis: async (eklaimId: number, diagnosisId: number) => {
    const response = await api.delete(`/eklaim/${eklaimId}/diagnosis/${diagnosisId}`);
    return response.data;
  },

  // Procedure
  addProcedure: async (eklaimId: number, data: AddProcedureInput, source: 'idrg' | 'inacbg' = 'idrg') => {
    const response = await api.post(`/eklaim/${eklaimId}/procedure?source=${source}`, data);
    return response.data;
  },

  removeProcedure: async (eklaimId: number, procedureId: number) => {
    const response = await api.delete(`/eklaim/${eklaimId}/procedure/${procedureId}`);
    return response.data;
  },

  // iDRG Flow
  groupingIDRG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/grouping-idrg`);
    return response.data;
  },

  finalIDRG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/final-idrg`);
    return response.data;
  },

  editIDRG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/edit-idrg`);
    return response.data;
  },

  // INACBG Flow
  importToINACBG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/import-inacbg`);
    return response.data;
  },

  groupingINACBG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/grouping-inacbg`);
    return response.data;
  },

  finalINACBG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/final-inacbg`);
    return response.data;
  },

  editINACBG: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/edit-inacbg`);
    return response.data;
  },

  // Final Claim
  finalClaim: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/final-claim`);
    return response.data;
  },

  sendClaim: async (id: number) => {
    const response = await api.post(`/eklaim/${id}/send-claim`);
    return response.data;
  },

  // Logs
  getLogs: async (id: number) => {
    const response = await api.get(`/eklaim/${id}/logs`);
    return response.data;
  },
};
