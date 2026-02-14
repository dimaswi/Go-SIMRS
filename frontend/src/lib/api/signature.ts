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
  DEATH_CERTIFICATE: 'death_certificate',
  REFERRAL_LETTER: 'referral_letter',
  GENERAL_CONSENT: 'general_consent',
  INFORMED_CONSENT: 'informed_consent',
  CPPT: 'cppt',
  NURSING_CARE: 'nursing_care',
  TRIAGE: 'triage',
  EMERGENCY_SUMMARY: 'emergency_summary',
  OPERATIVE_REPORT: 'operative_report',
  INPATIENT_CERT: 'inpatient_cert',
  PHARMACY_HANDOVER: 'pharmacy_handover',
} as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  visit_resume: 'Resume Medis',
  prescription: 'Resep Obat',
  lab_result: 'Hasil Laboratorium',
  radiology_result: 'Hasil Radiologi',
  sick_letter: 'Surat Keterangan Sakit',
  death_certificate: 'Surat Kematian',
  referral_letter: 'Surat Rujukan',
  general_consent: 'General Consent',
  informed_consent: 'Informed Consent',
  cppt: 'CPPT',
  nursing_care: 'Asuhan Keperawatan',
  triage: 'Form Triage',
  emergency_summary: 'Ringkasan UGD',
  operative_report: 'Laporan Operasi',
  inpatient_cert: 'Surat Keterangan Rawat Inap',
  pharmacy_handover: 'Serah Terima Obat',
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

  checkPINRequired: () =>
    api.get<{ signature_pin_required: boolean }>('/signature/check-required'),

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
