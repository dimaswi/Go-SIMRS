import { api } from "./client";
import type { Counter } from "./counters";

// Queue Types
export interface Queue {
  id: number;
  queue_number: string;
  queue_date: string;
  queue_type: "general" | "bpjs" | "emergency";
  counter_id: number; // Counter ID (FK to counters table)
  counter?: Counter; // Counter relation
  status: "waiting" | "called" | "serving" | "completed" | "cancelled" | "skipped";
  called_at?: string;
  serviced_at?: string;
  completed_at?: string;
  called_by_id?: number;
  called_by?: {
    id: number;
    username: string;
    full_name: string;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface QueueSummary {
  waiting: number;
  called: number;
  serving: number;
  completed: number;
  skipped: number;
  total: number;
}

export interface CreateQueueInput {
  queue_type: "general" | "bpjs" | "emergency";
  counter_id: number; // Counter ID
  notes?: string;
}

// Queue API
export const queueApi = {
  // Get all queues (with filters)
  getAll: (params?: {
    date?: string;
    status?: string;
    queue_type?: string;
    counter_id?: number;
  }) => api.get<{ data: Queue[]; summary: QueueSummary }>("/queues", { params }),

  // Get single queue
  getById: (id: number) => api.get<{ data: Queue }>(`/queues/${id}`),

  // Get queue statistics
  getStats: (params?: { counter_id?: number }) =>
    api.get<{ data: QueueSummary & { by_type: { queue_type: string; count: number }[] } }>(
      "/queues/stats",
      { params }
    ),

  // Get current called queues (for display)
  getCurrent: (params?: { counter_id?: number }) =>
    api.get<{ data: Queue[] }>("/queues/current", { params }),

  // Create queue (ambil nomor antrean dari kiosk)
  create: (data: CreateQueueInput) => api.post<{ data: Queue }>("/queues", data),

  // Call next queue
  callNext: (params: { counter_id: number }) =>
    api.post<{ data: Queue }>("/queues/call-next", null, { params }),

  // Call specific queue
  call: (id: number) => api.post<{ data: Queue }>(`/queues/${id}/call`),

  // Skip queue
  skip: (id: number) => api.post<{ data: Queue }>(`/queues/${id}/skip`),

  // Cancel queue
  cancel: (id: number) => api.post<{ data: Queue }>(`/queues/${id}/cancel`),
};

// Registration Types
export interface Registration {
  ID?: number; // GORM uses uppercase ID
  id?: number; // Fallback for lowercase
  registration_number: string;
  registration_date: string;
  registration_type: "outpatient" | "inpatient" | "emergency";
  patient_id: number;
  patient?: {
    ID?: number; // GORM uses uppercase ID
    id?: number;
    // Indonesian field names from backend
    nama_lengkap?: string;
    no_rm?: string;
    nik?: string;
    jenis_kelamin?: string;
    tanggal_lahir?: string;
    telepon?: string;
    alamat?: string;
    foto?: string;
    no_bpjs?: string;
    kelas_bpjs?: string;
    // English fallbacks
    name?: string;
    medical_record_number?: string;
    gender?: string;
    date_of_birth?: string;
    phone?: string;
    address?: string;
  };
  queue_id?: number;
  queue?: Queue;
  destination_room_id: number;
  destination_room?: {
    id?: number;
    ID?: number;
    code: string;
    name: string;
  };
  doctor_id?: number;
  doctor?: {
    id?: number;
    ID?: number;
    nama_lengkap?: string; // Indonesian field
    nama?: string; // Alias
    name?: string; // English fallback
    spesialisasi?: string;
    specialization?: string;
  };
  payment_method: "cash" | "bpjs" | "insurance";
  bpjs_number?: string;
  sep_number?: string; // SEP Number for BPJS
  insurance_name?: string;
  insurance_number?: string;
  complaint?: string;
  status: "registered" | "in_queue" | "in_progress" | "completed" | "cancelled" | "scheduled" | "no_show";
  registered_by_id: number;
  registered_by?: {
    id: number;
    username: string;
    full_name?: string; // Backend uses snake_case
    name?: string; // Fallback/alias
  };
  notes?: string;
  visit_number: number;
  // Visit and RoomQueue (if auto-created)
  visit?: {
    id: number;
    visit_number: string;
    visit_type: string;
    status: string;
    room_queue?: {
      id: number;
      queue_number: string;
      queue_code: string;
      priority: string;
      status: string;
    };
  };
  // GORM fields - both cases supported
  created_at?: string;
  updated_at?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface RegistrationSummary {
  registered: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  total: number;
}

export interface CreateRegistrationInput {
  queue_id?: number;
  patient_id: number;
  registration_type?: "outpatient" | "inpatient" | "emergency";
  destination_room_id: number;
  doctor_id?: number;
  payment_method: "cash" | "bpjs" | "insurance";
  bpjs_number?: string;
  insurance_name?: string;
  insurance_number?: string;
  complaint?: string;
  notes?: string;
  // Auto-create visit and room queue
  create_visit?: boolean;
  create_room_queue?: boolean;
  queue_priority?: "normal" | "urgent" | "emergency";
}

export interface UpdateRegistrationInput {
  destination_room_id?: number;
  doctor_id?: number;
  payment_method?: string;
  bpjs_number?: string;
  insurance_name?: string;
  insurance_number?: string;
  complaint?: string;
  status?: string;
  notes?: string;
}

// Registration API
export const registrationApi = {
  // Get all registrations (with pagination and filters)
  getAll: (params?: {
    page?: number;
    limit?: number;
    date?: string;
    status?: string;
    patient_id?: number;
    destination_room_id?: number;
  }) =>
    api.get<{
      data: Registration[];
      meta: { page: number; limit: number; total: number; total_page: number };
    }>("/registrations", { params }),

  // Get today's registrations
  getToday: (params?: { destination_room_id?: number; status?: string }) =>
    api.get<{ data: Registration[]; summary: RegistrationSummary }>(
      "/registrations/today",
      { params }
    ),

  // Get scheduled registrations (kontrol/follow-up)
  getScheduled: (params?: { 
    date?: string; 
    room_id?: number; 
    status?: string;
    include_past?: boolean;
  }) =>
    api.get<{ 
      data: ScheduledRegistration[]; 
      summary: { today: number; upcoming: number; no_show: number } 
    }>("/registrations/scheduled", { params }),

  // Get single registration
  getById: (id: number) => api.get<{ data: Registration }>(`/registrations/${id}`),

  // Search patient for queue registration
  searchPatient: (q: string) =>
    api.get<{
      data: {
        id: number;
        name: string;
        medical_record_number: string;
        nik?: string;
        gender?: string;
        date_of_birth?: string;
        phone?: string;
      }[];
    }>("/registrations/search-patient", { params: { q } }),

  // Create registration
  create: (data: CreateRegistrationInput) =>
    api.post<{ data: Registration }>("/registrations", data),

  // Update registration
  update: (id: number, data: UpdateRegistrationInput) =>
    api.put<{ data: Registration }>(`/registrations/${id}`, data),

  // Cancel registration
  cancel: (id: number) => api.post<{ data: Registration }>(`/registrations/${id}/cancel`),

  // Complete registration
  complete: (id: number) =>
    api.post<{ data: Registration }>(`/registrations/${id}/complete`),

  // Check-in scheduled registration (for kontrol/follow-up)
  checkIn: (id: number) =>
    api.post<{ data: ScheduledRegistration; message: string }>(`/registrations/${id}/checkin`),

  // BPJS check-in with SEP: AddAntrean → Create SEP → Activate Visit (sequential)
  bpjsCheckinWithSEP: (id: number, sepData: Record<string, any>) =>
    api.post<{ data: ScheduledRegistration; message: string; no_sep: string; queue_number: string }>(
      `/registrations/${id}/bpjs-checkin`,
      sepData
    ),

  // Send BPJS Antrean only (Step 1 of check-in)
  sendAntrean: (id: number) =>
    api.post<{ success: boolean; message?: string; error?: string; antreanStatus: AntreanStatus }>(
      `/registrations/${id}/send-antrean`
    ),

  // Reschedule registration
  reschedule: (id: number, data: { new_date: string; new_room_id?: number; reason?: string }) =>
    api.put<{ data: ScheduledRegistration; message: string }>(`/registrations/${id}/reschedule`, data),

  // Cancel scheduled registration
  cancelScheduled: (id: number) =>
    api.post<{ data: ScheduledRegistration; message: string }>(`/registrations/${id}/cancel-scheduled`),

  // Get patient registrations history
  getPatientHistory: (
    patientId: number,
    params?: { page?: number; limit?: number }
  ) =>
    api.get<{
      data: Registration[];
      meta: { page: number; limit: number; total: number; total_page: number };
    }>(`/patients/${patientId}/registrations`, { params }),
};

// Scheduled Registration (extends Registration with follow-up fields)
export interface ScheduledRegistration extends Registration {
  is_follow_up: boolean;
  source_visit_id?: number;
  source_visit?: {
    id: number;
    visit_number: string;
  };
  scheduled_date?: string;
  checked_in_at?: string;
  checked_in_by_id?: number;
  checked_in_by?: {
    id: number;
    username: string;
    full_name?: string;
  };
}

// BPJS Antrean Status
export interface AntreanStatus {
  id: number;
  kodeBooking: string;
  addAntreanSent: boolean;
  addAntreanCode: number;
  addAntreanMsg: string;
  syncStatus: string;
  status?: string;
  kodeDokter?: string;
  namaDokter?: string;
  kodePoli?: string;
  namaPoli?: string;
  nomorAntrean?: string;
  nomorReferensi?: string;
  jenisKunjungan?: number;
}

// Queue Status Labels
export const queueStatusLabels: Record<string, string> = {
  waiting: "Menunggu",
  called: "Dipanggil",
  serving: "Sedang Dilayani",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  skipped: "Dilewati",
};

// Queue Type Labels
export const queueTypeLabels: Record<string, string> = {
  general: "Umum",
  bpjs: "BPJS",
  emergency: "Darurat",
};

// Registration Status Labels
export const registrationStatusLabels: Record<string, string> = {
  registered: "Terdaftar",
  in_queue: "Dalam Antrean",
  in_progress: "Sedang Dilayani",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  scheduled: "Terjadwal",
  no_show: "Tidak Datang",
};

// Payment Method Labels
export const paymentMethodLabels: Record<string, string> = {
  cash: "Tunai",
  bpjs: "BPJS",
  insurance: "Asuransi",
};

// Registration Type Labels
export const registrationTypeLabels: Record<string, string> = {
  outpatient: "Rawat Jalan",
  pharmacy: "Farmasi",
  radiology: "Radiologi",
  laboratory: "Laboratorium",
  emergency: "IGD",
  inpatient: "Rawat Inap",
};
