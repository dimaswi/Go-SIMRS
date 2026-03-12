import { api } from "./client";

// Procedure Order Status
export const PROCEDURE_ORDER_STATUS = {
  pending: { label: "Menunggu", variant: "secondary" as const },
  in_progress: { label: "Dikerjakan", variant: "default" as const },
  completed: { label: "Selesai", variant: "default" as const },
  cancelled: { label: "Dibatalkan", variant: "destructive" as const },
};

// Procedure Order Types
export const PROCEDURE_ORDER_TYPES = {
  radiology: { label: "Radiologi", prefix: "RAD" },
  laboratory: { label: "Laboratorium", prefix: "LAB" },
  consultation: { label: "Konsultasi", prefix: "CONS" },
};

// Interfaces
export interface ProcedureParameter {
  id: number;
  procedure_id: number;
  code: string;
  name: string;
  description?: string;
  input_type: string; // text, textarea, number, select, checkbox
  options?: string; // JSON array for select
  unit?: string;
  normal_min?: number;
  normal_max?: number;
  normal_text?: string;
  critical_min?: number;
  critical_max?: number;
  decimal_places?: number;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface Procedure {
  id: number;
  code: string;
  name: string;
  description?: string;
  procedure_type: string; // medical, radiology, laboratory
  inacbg_code?: string;
  inacbg_name?: string;
  is_active: boolean;
  parameters?: ProcedureParameter[];
}

export interface ProcedureOrderResult {
  id?: number;
  procedure_order_item_id: number;
  procedure_parameter_id: number;
  procedure_parameter?: ProcedureParameter;
  value: string;
  numeric_value?: number;
  is_normal?: boolean;
  is_low?: boolean;
  is_high?: boolean;
  is_critical?: boolean;
  notes?: string;
}

export interface ProcedureOrderItem {
  id?: number;
  procedure_order_id: number;
  procedure_id: number;
  procedure?: Procedure;
  status: string;
  performed_by_id?: number;
  performed_by?: { id: number; nama_lengkap: string };
  started_at?: string;
  completed_at?: string;
  notes?: string;
  results?: ProcedureOrderResult[];
}

export interface ProcedureOrder {
  id: number;
  order_number: string;
  order_type: "radiology" | "laboratory" | "consultation" | "surgery";
  source_visit_id: number;
  source_visit?: {
    id: number;
    registration?: {
      patient?: {
        id: number;
        no_rm: string;
        nama_lengkap: string;
        jenis_kelamin?: string;
        tanggal_lahir?: string;
      };
    };
  };
  target_visit_id?: number;
  target_visit?: any;
  source_room_id: number;
  source_room?: { id: number; name: string };
  target_room_id: number;
  target_room?: { id: number; name: string };
  registration_id: number;
  registration?: {
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin?: string;
      tanggal_lahir?: string;
    };
  };
  ordered_by_id: number;
  ordered_by?: { id: number; nama_lengkap: string };
  surgeon_doctor_id?: number;
  surgeon_doctor?: { id: number; nama_lengkap: string };
  scheduled_date?: string;
  priority: string;
  clinical_notes?: string;
  diagnosis?: string;
  notes?: string;
  status: string;
  performed_by_id?: number;
  performed_by?: { id: number; nama_lengkap: string };
  started_at?: string;
  completed_at?: string;
  result_summary?: string;
  conclusion?: string;
  suggestion?: string;
  is_critical?: boolean;
  critical_notes?: string;
  validated_by_id?: number;
  validated_by?: { id: number; nama_lengkap: string };
  validated_at?: string;
  attachment_urls?: string;
  items?: ProcedureOrderItem[];
  consultation?: {
    id: number;
    visit_id: number;
    procedure_order_id?: number;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    recommendation?: string;
    notes?: string;
    consultant_id?: number;
    consultant?: { id: number; nama_lengkap: string };
    created_by_id?: number;
    created_at: string;
    updated_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateProcedureOrderInput {
  order_type: "radiology" | "laboratory" | "consultation" | "surgery";
  source_visit_id: number;
  target_room_id: number;
  priority?: string;
  clinical_notes?: string;
  diagnosis?: string;
  notes?: string;
  surgeon_doctor_id?: number;
  scheduled_date?: string;
  items: {
    procedure_id: number;
    notes?: string;
  }[];
}

export interface SubmitResultsInput {
  result_summary?: string;
  conclusion?: string;
  suggestion?: string;
  is_critical?: boolean;
  critical_notes?: string;
  items: {
    item_id: number;
    notes?: string;
    results: {
      parameter_id: number;
      value: string;
      numeric_value?: number;
      notes?: string;
    }[];
  }[];
}

// API Functions
export const procedureOrdersApi = {
  // Get all orders with filters
  getAll: (params?: {
    order_type?: string;
    source_visit_id?: number;
    target_visit_id?: number;
    target_room_id?: number;
    registration_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get<ProcedureOrder[]>("/procedure-orders", { params }),

  // Get single order
  getById: (id: number) => api.get<ProcedureOrder>(`/procedure-orders/${id}`),

  // Create new order
  create: (data: CreateProcedureOrderInput) =>
    api.post<ProcedureOrder>("/procedure-orders", data),

  // Start working on order
  start: (id: number) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/start`),

  // Save results without completing
  saveResults: (id: number, data: SubmitResultsInput) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/save-results`, data),

  // Submit results and complete (legacy)
  submitResults: (id: number, data: SubmitResultsInput) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/results`, data),

  // Complete order
  complete: (id: number) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/complete`),

  // Cancel order
  cancel: (id: number, reason?: string) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/cancel`, { reason }),

  // Recalculate order status (fix inconsistent status)
  recalculate: (id: number) =>
    api.post<{ message: string; new_status: string }>(`/procedure-orders/${id}/recalculate`, {}),

  // Validate result
  validate: (id: number) =>
    api.post<ProcedureOrder>(`/procedure-orders/${id}/validate`),

  // Get orders by source visit
  getBySourceVisit: (visitId: number, orderType?: string) =>
    api.get<ProcedureOrder[]>(`/procedure-orders/by-visit/${visitId}`, {
      params: { order_type: orderType },
    }),

  // Get patient history
  getHistory: (patientId: number, orderType?: string, limit?: number) =>
    api.get<ProcedureOrder[]>("/procedure-orders/history", {
      params: { patient_id: patientId, order_type: orderType, limit },
    }),

  // Get procedures by room
  getProceduresByRoom: (roomId: number, type?: string) =>
    api.get<Procedure[]>(`/procedure-orders/procedures/room/${roomId}`, {
      params: { type },
    }),

  // Get radiology rooms
  getRadiologyRooms: () =>
    api.get<{ id: number; name: string; code: string }[]>(
      "/procedure-orders/rooms/radiology"
    ),

  // Get laboratory rooms
  getLaboratoryRooms: () =>
    api.get<{ id: number; name: string; code: string }[]>(
      "/procedure-orders/rooms/laboratory"
    ),

  // Get consultation rooms (poliklinik, rawat inap, etc. excluding current room)
  getConsultationRooms: (excludeRoomId?: number) =>
    api.get<{ id: number; name: string; code: string }[]>(
      "/procedure-orders/rooms/consultation",
      { params: excludeRoomId ? { exclude_room_id: excludeRoomId } : undefined }
    ),

  // Get doctors by room (for consultation)
  getDoctorsByRoom: (roomId: number) =>
    api.get<{ id: number; nama_lengkap: string }[]>(
      `/procedure-orders/doctors/room/${roomId}`
    ),

  // Get consultation procedures by room
  getConsultationProcedures: (roomId: number) =>
    api.get<Procedure[]>(
      `/procedure-orders/procedures/consultation/${roomId}`
    ),

  // Get surgery rooms (operating rooms)
  getSurgeryRooms: () =>
    api.get<{ id: number; name: string; code: string }[]>(
      "/procedure-orders/rooms/surgery"
    ),

  // Get surgical procedures, optionally filtered by room
  getSurgicalProcedures: (roomId?: number) =>
    api.get<Procedure[]>(
      "/procedure-orders/procedures/surgical",
      { params: roomId ? { room_id: roomId } : undefined }
    ),

  // Get available doctors for a room on a specific date (uses schedule system)
  getAvailableDoctors: (roomId: number, date: string) =>
    api.get<{
      data: {
        employee_id: number;
        employee_name: string;
        start_time: string;
        end_time: string;
        max_patients: number;
      }[];
      room_closed: boolean;
    }>("/schedules/available-doctors", {
      params: { room_id: roomId, date },
    }),

  // Print result
  print: (id: number) => api.get<ProcedureOrder>(`/procedure-orders/${id}/print`),

  // === PROCEDURE ORDER ITEM CRUD ===
  // Add item to order
  addItem: (orderId: number, data: { procedure_id: number; notes?: string }) =>
    api.post<ProcedureOrderItem>(`/procedure-orders/${orderId}/items`, data),

  // Update item in order
  updateItem: (orderId: number, itemId: number, data: { notes?: string }) =>
    api.put<ProcedureOrderItem>(`/procedure-orders/${orderId}/items/${itemId}`, data),

  // Delete item from order
  deleteItem: (orderId: number, itemId: number) =>
    api.delete(`/procedure-orders/${orderId}/items/${itemId}`),
};

export default procedureOrdersApi;
