import { api } from './client';

// ==================== Request Types ====================

export interface SetupPINRequest {
  pin: string;
  confirm_pin: string;
  password: string;
}

export interface ChangePINRequest {
  old_pin: string;
  new_pin: string;
  confirm_pin: string;
}

export interface VerifyPINRequest {
  pin: string;
}

export interface ResetPINRequest {
  user_id: number;
  new_pin: string;
}

export interface SignDocumentRequest {
  pin: string;
  document_type: string;
  document_id: number;
  visit_id?: number;
  notes?: string;
  signer_employee_id?: number; // Sign on behalf of another employee
  required_signatures?: number;
  signature_slot?: string;
  signature_role?: string;
  signature_location?: string;
  signature_date?: string;
  signature_name?: string;
}

// ==================== Response Types ====================

export interface SignatureResponse {
  message: string;
  signature_hash?: string;
  signed_at?: string;
  signed_by?: string;
}

export interface DocumentSignatureStatus {
  is_signed: boolean;
  is_locked: boolean;
  signed_at?: string;
  signature_hash?: string;
  signed_by?: {
    id: number;
    full_name: string;
  };
  signed_slots?: Record<string, boolean>;
}

export interface DocumentSignatureRule {
  document_type: string;
  label: string;
  required_signatures: number;
  slots?: string[];
  layout_hint?: string;
}

export interface CanSignResponse {
  allowed: boolean;
  reason?: string;
}

export interface SignatureLog {
  id: number;
  created_at: string;
  user_id: number;
  user?: {
    id: number;
    full_name: string;
    email: string;
  };
  document_type: string;
  document_id: number;
  visit_id?: number;
  visit?: {
    id: number;
    visit_number: string;
    registration?: {
      patient?: {
        id: number;
        nama_lengkap: string;
        no_rm: string;
      };
    };
  };
  signed_at: string;
  signature_hash: string;
  action: string;
  signer_name: string;
  signer_nip?: string;
  signer_str?: string;
  signer_sip?: string;
  signer_role?: string;
  ip_address?: string;
  notes?: string;
}

export interface MedicalRecordEditLog {
  id: number;
  created_at: string;
  visit_id: number;
  visit?: {
    id: number;
    visit_number: string;
    registration?: {
      patient?: {
        id: number;
        nama_lengkap: string;
        no_rm: string;
      };
    };
  };
  record_type: string;
  record_id: number;
  action: string;
  fields_json?: string;
  reason?: string;
  notes?: string;
  edited_by_id: number;
  edited_by?: {
    id: number;
    full_name: string;
    email: string;
  };
  edited_at: string;
  ip_address?: string;
}

export interface VerifySignatureResponse {
  valid: boolean;
  message: string;
  document_type?: string;
  signed_at?: string;
  signer_name?: string;
  signer_nip?: string;
  signer_str?: string;
  signer_role?: string;
  signature_hash?: string;
  patient_name?: string;
  patient_mr?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

// ==================== Document Type Constants ====================

export const DOCUMENT_TYPES = {
  VISIT_RESUME: 'visit_resume',
  PRESCRIPTION: 'prescription',
  LAB_RESULT: 'lab_result',
  RADIOLOGY_RESULT: 'radiology_result',
  SICK_LETTER: 'sick_letter',
  HEALTH_CERTIFICATE: 'health_certificate',
  BIRTH_CERTIFICATE: 'birth_certificate',
  LEAVE_CERTIFICATE: 'leave_certificate',
  MCU_CERTIFICATE: 'mcu_certificate',
  DEATH_CERTIFICATE: 'death_certificate',
  REFERRAL_LETTER: 'referral_letter',
  GENERAL_CONSENT: 'general_consent',
  INFORMED_CONSENT: 'informed_consent',
  CPPT: 'cppt',
  NURSING_CARE: 'nursing_care',
  FLUID_BALANCE: 'fluid_balance',
  BED_TRANSFER: 'bed_transfer',
  VITAL_SIGN: 'vital_sign',
  TRIAGE: 'triage',
  EMERGENCY_SUMMARY: 'emergency_summary',
  OPERATIVE_REPORT: 'operative_report',
  CONSULTATION_RESULT: 'consultation_result',
  INPATIENT_CERT: 'inpatient_cert',
  PHARMACY_HANDOVER: 'pharmacy_handover',
  SPRI: 'spri',
  SURAT_KONTROL: 'surat_kontrol',
  // RM Duplicate (E-Klaim)
  RM_DUP_LAB_RESULT: 'rm_dup_lab_result',
  RM_DUP_RADIOLOGY_RESULT: 'rm_dup_radiology_result',
  RM_DUP_SURGERY_REPORT: 'rm_dup_surgery_report',
  RM_DUP_CONSULTATION: 'rm_dup_consultation',
  RM_DUP_RESUME: 'rm_dup_resume',
  RM_DUP_INPATIENT_RESUME: 'rm_dup_inpatient_resume',
  RM_DUP_REFERRAL: 'rm_dup_referral',
  RM_DUP_TRIAGE: 'rm_dup_triage',
  RM_DUP_EMERGENCY: 'rm_dup_emergency',
  RM_DUP_CPPT: 'rm_dup_cppt',
  RM_DUP_FLUID_BALANCE: 'rm_dup_fluid_balance',
  RM_DUP_PRESCRIPTION: 'rm_dup_prescription',
  RM_DUP_SEP: 'rm_dup_sep',
  RM_DUP_ADMISSION: 'rm_dup_admission',
  RM_DUP_REGISTRATION: 'rm_dup_registration',
  RM_DUP_CONSENT: 'rm_dup_consent',
  RM_DUP_NURSING_CARE: 'rm_dup_nursing_care',
  RM_DUP_BED_TRANSFER: 'rm_dup_bed_transfer',
  RM_DUP_VITAL_SIGN: 'rm_dup_vital_sign',
  RM_DUP_INPATIENT_CERT: 'rm_dup_inpatient_cert',
  RM_DUP_BILLING: 'rm_dup_billing',
} as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  visit_resume: 'Resume Medis',
  prescription: 'Resep Obat',
  lab_result: 'Hasil Laboratorium',
  radiology_result: 'Hasil Radiologi',
  sick_letter: 'Surat Keterangan Sakit',
  health_certificate: 'Surat Keterangan Sehat',
  birth_certificate: 'Surat Keterangan Kelahiran',
  leave_certificate: 'Surat Keterangan Cuti',
  mcu_certificate: 'Surat Keterangan MCU',
  death_certificate: 'Surat Kematian',
  referral_letter: 'Surat Rujukan',
  general_consent: 'General Consent',
  informed_consent: 'Informed Consent',
  cppt: 'CPPT',
  nursing_care: 'Asuhan Keperawatan',
  fluid_balance: 'Balance Cairan',
  bed_transfer: 'Mutasi Pasien',
  vital_sign: 'Grafik Tanda Vital',
  triage: 'Form Triage',
  emergency_summary: 'Ringkasan UGD',
  operative_report: 'Laporan Operasi',
  consultation_result: 'Hasil Konsultasi',
  inpatient_cert: 'Surat Keterangan Rawat Inap',
  pharmacy_handover: 'Serah Terima Obat',
  spri: 'SPRI',
  surat_kontrol: 'Surat Kontrol',
};

// ==================== API Functions ====================

export const signatureApi = {
  // PIN Management
  setupPIN: (data: SetupPINRequest) =>
    api.post<{ message: string }>('/signature/pin/setup', data),

  changePIN: (data: ChangePINRequest) =>
    api.post<{ message: string }>('/signature/pin/change', data),

  verifyPIN: (data: VerifyPINRequest) =>
    api.post<{ message: string; valid: boolean }>('/signature/pin/verify', data),

  resetPIN: (data: ResetPINRequest) =>
    api.post<{ message: string }>('/signature/pin/reset', data),

  // Document Signing
  signDocument: (data: SignDocumentRequest) =>
    api.post<SignatureResponse>('/signature/sign', data),

  revokeSignature: (data: { document_type: string; document_id: number; pin: string; reason?: string }) =>
    api.post<{ message: string; revoked_at: string; revoked_by: string }>('/signature/revoke', data),

  getDocumentSignature: (documentType: string, documentId: number) =>
    api.get<DocumentSignatureStatus>('/signature/status', {
      params: { document_type: documentType, document_id: documentId }
    }),

  canSignDocument: (documentType: string, documentId: number) =>
    api.get<CanSignResponse>('/signature/can-sign', {
      params: { document_type: documentType, document_id: documentId }
    }),

  checkPINRequired: () =>
    api.get<{ signature_pin_required: boolean }>('/signature/check-required'),

  batchSignatureStatus: (documents: { document_type: string; document_id: number }[]) =>
    api.post<{ statuses: Record<string, { is_signed: boolean; signer_name?: string; signed_at?: string; required_signatures?: number; signed_signatures?: number; is_fully_signed?: boolean; signed_slots?: Record<string, boolean> }> }>(
      '/signature/batch-status',
      { documents }
    ),

  getDocumentSignatureSettings: () =>
    api.get<{ data: DocumentSignatureRule[] }>('/signature/document-settings'),

  updateDocumentSignatureSettings: (rules: DocumentSignatureRule[]) =>
    api.put<{ message: string; data: DocumentSignatureRule[] }>('/signature/document-settings', { rules }),

  getDocumentSignaturePreview: (params: { document_type: string; column_1?: string; column_2?: string }) =>
    api.get('/signature/document-settings/preview', {
      params,
      responseType: 'blob',
    }),

  // Audit Logs
  getSignatureLogs: (params?: {
    user_id?: number;
    document_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }) => api.get<PaginatedResponse<SignatureLog>>('/signature/logs', { params }),

  getMedicalRecordEditLogs: (params?: {
    visit_id?: number;
    user_id?: number;
    record_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }) => api.get<PaginatedResponse<MedicalRecordEditLog>>('/signature/medical-record-logs', { params }),

  // Public Verification
  verifySignature: (hash: string) =>
    api.get<VerifySignatureResponse>(`/signature/verify/${hash}`),
};
