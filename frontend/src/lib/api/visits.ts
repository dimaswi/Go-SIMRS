import { api } from './client';

export interface Visit {
  id: number;
  visit_number: string;
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: 'consultation' | 'procedure' | 'lab' | 'radiology' | 'pharmacy' | 'inpatient' | 'outpatient' | 'emergency' | 'surgery';
  visit_purpose?: string;
  referral_from?: number;
  status: 'waiting' | 'in_queue' | 'in_progress' | 'completed' | 'cancelled';
  check_in_time?: string;
  start_time?: string;
  end_time?: string;
  admission_time?: string;
  discharge_time?: string;
  complaint?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  registration?: any;
  room?: any;
  doctor?: any;
  room_queue?: any;
  referral_visit?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitRequest {
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: string;
  visit_purpose?: string;
  referral_from?: number;
  complaint?: string;
  notes?: string;
  create_queue?: boolean;
  queue_priority?: string;
}

export interface UpdateVisitRequest {
  doctor_id?: number;
  status?: string;
  visit_purpose?: string;
  complaint?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

export const visitsApi = {
  // Get all visits with filters
  getAll: async (params?: {
    registration_id?: number;
    room_id?: number;
    patient_id?: number;
    visit_type?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    return api.get<Visit[]>('/visits', { params });
  },

  // Get specific visit
  getById: async (id: number) => {
    return api.get<Visit>(`/visits/${id}`);
  },

  // Create new visit (optionally creates room queue)
  create: async (data: CreateVisitRequest) => {
    return api.post<{ visit: Visit; room_queue?: any }>('/visits', data);
  },

  // Update visit
  update: async (id: number, data: UpdateVisitRequest) => {
    return api.put<Visit>(`/visits/${id}`, data);
  },

  // Accept patient for visit
  acceptVisit: async (id: number) => {
    return api.put<Visit>(`/visits/${id}/accept`, {});
  },

  // Complete visit (mark as finished)
  completeVisit: async (id: number) => {
    return api.put<Visit>(`/visits/${id}/complete`, {});
  },

  // Cancel visit
  cancelVisit: async (id: number) => {
    return api.post<{ data: Visit; message: string }>(`/visits/${id}/cancel`, {});
  },

  // Cancel complete visit (revert to in_progress)
  cancelCompleteVisit: async (id: number) => {
    return api.put<Visit>(`/visits/${id}/cancel-complete`, {});
  },

  // Get visit statistics
  getStats: async (params?: {
    start_date?: string;
    end_date?: string;
    room_id?: number;
  }) => {
    return api.get<{
      summary: {
        total_visits: number;
        waiting_visits: number;
        in_queue_visits: number;
        in_progress_visits: number;
        completed_visits: number;
        cancelled_visits: number;
      };
      by_type: Array<{
        visit_type: string;
        count: number;
      }>;
      date_range: {
        start_date: string;
        end_date: string;
      };
    }>('/visits/stats/summary', { params });
  },
};

// Medical Record Edit Log interface
export interface MedicalRecordEditLog {
  id: number;
  visit_id: number;
  record_type: string; // triage, anamnesis, physical_exam, diagnosis, assessment_plan, etc.
  record_id: number;
  action: string; // edit, create, delete
  fields_json?: string;
  reason?: string;
  notes?: string;
  edited_by_id: number;
  edited_by?: {
    id: number;
    name: string;
    username: string;
  };
  edited_at: string;
  ip_address?: string;
  created_at: string;
}

export interface CreateEditLogRequest {
  record_type: string;
  record_id: number;
  action: string;
  fields_json?: string;
  reason?: string;
  notes?: string;
}

// Medical Record Edit Log API
export const medicalRecordEditLogApi = {
  // Get edit logs for a visit
  getByVisit: async (visitId: number, recordType?: string) => {
    const params = recordType ? { record_type: recordType } : undefined;
    return api.get<MedicalRecordEditLog[]>(`/visits/${visitId}/edit-logs`, { params });
  },

  // Create an edit log entry
  create: async (visitId: number, data: CreateEditLogRequest) => {
    return api.post<MedicalRecordEditLog>(`/visits/${visitId}/edit-logs`, data);
  },
};
