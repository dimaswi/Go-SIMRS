import { api } from './client';

export interface AdmissionRequestPatient {
  id: number;
  name?: string;
  nama_lengkap?: string;
  medical_record_number?: string;
  no_rm?: string;
  birth_date?: string;
  gender?: string;
}

export interface AdmissionRequest {
  id: number;
  request_number: string;
  source_visit_id: number;
  source_visit?: {
    id: number;
    room?: {
      id: number;
      name: string;
    };
    registration?: {
      id: number;
      patient?: AdmissionRequestPatient;
    };
  };
  registration_id: number;
  registration?: {
    id: number;
    patient?: AdmissionRequestPatient;
  };
  patient?: AdmissionRequestPatient; // Preloaded from registration
  admission_type: string;
  admission_reason: string;
  diagnosis?: string;
  priority: string;
  preferred_class?: string;
  special_notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requested_by_id: number;
  requested_by?: any;
  requested_at: string;
  approved_room_id?: number;
  approved_room?: {
    id: number;
    name: string;
    code: string;
  };
  approved_bed_id?: number;
  approved_bed?: {
    id: number;
    bed_number: string;
  };
  doctor_id?: number;
  doctor?: {
    id: number;
    nama_lengkap: string;
    nip?: string;
  };
  inpatient_class?: string;
  inpatient_visit_id?: number;
  inpatient_visit?: any;
  processed_by_id?: number;
  processed_by?: any;
  processed_at?: string;
  rejection_reason?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAdmissionRequestInput {
  source_visit_id: number;
  admission_type: string;
  admission_reason?: string;
  diagnosis?: string;
  priority?: string;
  preferred_class?: string;
  special_notes?: string;
}

export interface ProcessAdmissionRequestInput {
  room_id: number;
  bed_id: number;
  doctor_id: number;
  admin_notes?: string;
}

export interface RejectAdmissionRequestInput {
  rejection_reason: string;
}

export const admissionRequestApi = {
  // Get all admission requests
  getAll: async (params?: {
    status?: string;
    priority?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    patient_id?: number;
    page?: number;
    limit?: number;
  }) => {
    return api.get<{ data: AdmissionRequest[]; meta: { page: number; limit: number; total: number } }>('/admission-requests', { params });
  },

  // Get single admission request
  getById: async (id: number) => {
    return api.get<{ data: AdmissionRequest }>(`/admission-requests/${id}`);
  },

  // Get pending count (for badge)
  getPendingCount: async () => {
    return api.get<{ count: number }>('/admission-requests/pending-count');
  },

  // Create admission request (from disposition)
  create: async (data: CreateAdmissionRequestInput) => {
    return api.post<{ data: AdmissionRequest; message: string }>('/admission-requests', data);
  },

  // Process (approve) admission request
  process: async (id: number, data: ProcessAdmissionRequestInput) => {
    return api.put<{ data: AdmissionRequest; message: string }>(`/admission-requests/${id}/process`, data);
  },

  // Reject admission request
  reject: async (id: number, data: RejectAdmissionRequestInput) => {
    return api.put<{ data: AdmissionRequest; message: string }>(`/admission-requests/${id}/reject`, data);
  },

  // Cancel admission request
  cancel: async (id: number) => {
    return api.put<{ data: AdmissionRequest; message: string }>(`/admission-requests/${id}/cancel`, {});
  },
};
