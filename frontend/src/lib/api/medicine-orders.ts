import { api } from './client';

export type MedicineFulfillmentType = 'in_room' | 'take_home';
export type MedicationTimesheetStatus =
  | 'scheduled'
  | 'given'
  | 'held'
  | 'skipped'
  | 'refused'
  | 'not_available'
  | 'contraindicated'
  | 'patient_absent';

export type MedicationTimesheetReasonCode =
  | 'clinical_hold'
  | 'contraindication'
  | 'patient_refused'
  | 'drug_unavailable'
  | 'patient_unavailable'
  | 'other';

// Types
export interface MedicineOrderItem {
  id?: number;
  medicine_order_id?: number;
  medicine_id: number;
  medicine?: {
    id: number;
    name: string;
    generic_name: string;
    code: string;
    unit: string;
    category: string;
  };
  item_type?: string;
  racikan_group?: string;
  racikan_name?: string;
  racikan_type?: string;
  racikan_qty?: number;
  racikan_unit?: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  status: string;
  dispensed_qty: number;
  medicine_batch_id?: number;
  medicine_batch?: {
    id: number;
    batch_number: string;
    expiry_date: string;
  };
  dispensed_at?: string;
  returned_qty: number;
  returned_at?: string;
  return_notes: string;
  is_substituted: boolean;
  substituted_medicine: string;
  substitution_reason: string;
  notes: string;
  added_by_pharmacy?: boolean;
}

export interface MedicineOrder {
  id: number;
  created_at: string;
  updated_at: string;
  order_number: string;
  source_visit_id: number;
  source_visit?: {
    id: number;
    visit_number: string;
    registration?: {
      id: number;
      registration_number: string;
      patient?: {
        id: number;
        nama_lengkap: string;
        no_rm: string;
      };
    };
  };
  pharmacy_visit_id?: number;
  pharmacy_visit?: {
    id: number;
    visit_number: string;
    status: string;
    room?: {
      id: number;
      name: string;
      code: string;
    };
    room_queue?: {
      id: number;
      display_number: string;
      queue_number: string;
      status: string;
    };
  };
  source_room_id: number;
  source_room?: {
    id: number;
    name: string;
    code: string;
  };
  pharmacy_room_id: number;
  pharmacy_room?: {
    id: number;
    name: string;
    code: string;
  };
  registration_id: number;
  registration?: {
    id: number;
    registration_number: string;
    patient?: {
      id: number;
      nama_lengkap: string;
      no_rm: string;
    };
  };
  prescriber_id: number;
  prescriber?: {
    id: number;
    nama_lengkap: string;
    tipe_karyawan: string;
  };
  prescription_type: string;
  fulfillment_type?: MedicineFulfillmentType;
  priority: string;
  diagnosis: string;
  notes: string;
  status: string;
  reviewed_by_id?: number;
  reviewed_by?: {
    id: number;
    nama_lengkap: string;
  };
  reviewed_at?: string;
  review_notes: string;
  delivered_by_id?: number;
  delivered_by?: {
    id: number;
    nama_lengkap: string;
  };
  delivered_at?: string;
  items: MedicineOrderItem[];
}

export interface CreateMedicineOrderInput {
  source_visit_id: number;
  pharmacy_room_id: number;
  prescription_type?: string;
  fulfillment_type?: MedicineFulfillmentType;
  priority?: string;
  diagnosis?: string;
  notes?: string;
  items: {
    medicine_id: number;
    quantity: number;
    unit?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    instructions?: string;
    notes?: string;
    item_type?: string;
    racikan_group?: string;
    racikan_name?: string;
    racikan_type?: string;
    racikan_qty?: number;
    racikan_unit?: string;
  }[];
}

export interface PrescriptionReview {
  id: number;
  created_at: string;
  medicine_order_id: number;
  reviewer_id: number;
  reviewer?: {
    id: number;
    name: string;
  };
  drug_interaction_check: boolean;
  dose_check: boolean;
  duplication_check: boolean;
  allergy_check: boolean;
  contraindication_check: boolean;
  indication_check: boolean;
  is_approved: boolean;
  notes: string;
  warnings: string;
  suggestion: string;
  requires_doctor_confirmation: boolean;
  doctor_confirmed_at?: string;
}

export interface DispenseInput {
  items: {
    item_id: number;
    dispensed_qty: number;
    medicine_batch_id?: number;
  }[];
}

export interface MedicineReturn {
  id: number;
  created_at: string;
  return_number: string;
  medicine_order_id: number;
  medicine_order_item_id?: number;
  medicine_id: number;
  medicine?: {
    id: number;
    name: string;
    code: string;
  };
  quantity: number;
  return_reason: string;
  condition: string;
  received_by_id: number;
  received_by?: {
    id: number;
    name: string;
  };
  is_restocked: boolean;
  restock_room_id?: number;
  restock_room?: {
    id: number;
    name: string;
  };
  restock_notes: string;
  notes: string;
}

export interface CreateMedicineReturnInput {
  item_id?: number;
  medicine_id: number;
  quantity: number;
  return_reason: string;
  condition?: string;
  is_restocked?: boolean;
  notes?: string;
}

export interface MedicationTimesheetItem {
  order_id: number;
  order_number: string;
  order_item_id: number;
  medicine_id: number;
  medicine_name: string;
  medicine_code: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
}

export interface MedicationTimesheetEntry {
  id: number;
  medicine_order_item_id: number;
  scheduled_at: string;
  status: MedicationTimesheetStatus;
  reason_code?: MedicationTimesheetReasonCode;
  reason_detail?: string;
  administered_at?: string;
  administered_by?: number;
  notes: string;
}

export interface MedicationTimesheetResponse {
  visit_id: number;
  date: string;
  items: MedicationTimesheetItem[];
  entries: MedicationTimesheetEntry[];
}

// API Functions
export const medicineOrdersApi = {
  // Get all medicine orders
  getAll: async (params?: {
    source_visit_id?: number;
    pharmacy_visit_id?: number;
    pharmacy_room_id?: number;
    registration_id?: number;
    status?: string;
    fulfillment_type?: MedicineFulfillmentType;
    start_date?: string;
    end_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.source_visit_id) searchParams.append('source_visit_id', String(params.source_visit_id));
    if (params?.pharmacy_visit_id) searchParams.append('pharmacy_visit_id', String(params.pharmacy_visit_id));
    if (params?.pharmacy_room_id) searchParams.append('pharmacy_room_id', String(params.pharmacy_room_id));
    if (params?.registration_id) searchParams.append('registration_id', String(params.registration_id));
    if (params?.status) searchParams.append('status', params.status);
    if (params?.fulfillment_type) searchParams.append('fulfillment_type', params.fulfillment_type);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const query = searchParams.toString();
    const response = await api.get<MedicineOrder[]>(`/medicine-orders${query ? `?${query}` : ''}`);
    return response;
  },

  // Get single medicine order
  getById: async (id: number) => {
    const response = await api.get<MedicineOrder>(`/medicine-orders/${id}`);
    return response;
  },

  // Create new medicine order
  create: async (data: CreateMedicineOrderInput) => {
    const response = await api.post<MedicineOrder>('/medicine-orders', data);
    return response;
  },

  // Update medicine order
  update: async (id: number, data: { priority?: string; diagnosis?: string; notes?: string; fulfillment_type?: MedicineFulfillmentType }) => {
    const response = await api.put<MedicineOrder>(`/medicine-orders/${id}`, data);
    return response;
  },

  // Get in-room medication timesheet by visit and date
  getTimesheet: async (visitId: number, date: string) => {
    const response = await api.get<MedicationTimesheetResponse>(`/medicine-orders/timesheet?visit_id=${visitId}&date=${encodeURIComponent(date)}`);
    return response;
  },

  // Upsert one timesheet slot (item x hour)
  upsertTimesheetEntry: async (data: {
    visit_id: number;
    medicine_order_item_id: number;
    date: string;
    hour: number;
    status?: MedicationTimesheetStatus | '';
    reason_code?: MedicationTimesheetReasonCode | '';
    reason_detail?: string;
    notes?: string;
  }) => {
    const response = await api.post<MedicationTimesheetEntry | { message: string }>('/medicine-orders/timesheet/entry', data);
    return response;
  },

  // Cancel medicine order
  cancel: async (id: number) => {
    const response = await api.post<{ message: string }>(`/medicine-orders/${id}/cancel`, {});
    return response;
  },

  // Recalculate order status (fix inconsistent status)
  recalculate: async (id: number) => {
    const response = await api.post<{ message: string; new_status: string }>(`/medicine-orders/${id}/recalculate`, {});
    return response;
  },

  // Get prescription review
  getReview: async (orderId: number) => {
    const response = await api.get<PrescriptionReview>(`/medicine-orders/${orderId}/review`);
    return response;
  },

  // Submit prescription review
  submitReview: async (orderId: number, data: Omit<PrescriptionReview, 'id' | 'created_at' | 'medicine_order_id' | 'reviewer_id' | 'reviewer'>) => {
    const response = await api.post<PrescriptionReview>(`/medicine-orders/${orderId}/review`, data);
    return response;
  },

  // Dispense medicines
  dispense: async (orderId: number, data: DispenseInput) => {
    const response = await api.post<MedicineOrder>(`/medicine-orders/${orderId}/dispense`, data);
    return response;
  },

  // Get medicine returns
  getReturns: async (orderId: number) => {
    const response = await api.get<MedicineReturn[]>(`/medicine-orders/${orderId}/returns`);
    return response;
  },

  // Create medicine return
  createReturn: async (orderId: number, data: CreateMedicineReturnInput) => {
    const response = await api.post<MedicineReturn>(`/medicine-orders/${orderId}/returns`, data);
    return response;
  },

  // Add item to medicine order (pharmacy edit)
  addItem: async (orderId: number, data: {
    medicine_id: number;
    quantity: number;
    unit?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    instructions?: string;
    notes?: string;
    item_type?: string;
    racikan_group?: string;
    racikan_name?: string;
    racikan_type?: string;
    racikan_qty?: number;
    racikan_unit?: string;
  }) => {
    const response = await api.post<MedicineOrderItem>(`/medicine-orders/${orderId}/items`, data);
    return response;
  },

  // Update item in medicine order (pharmacy edit)
  updateItem: async (orderId: number, itemId: number, data: {
    medicine_id?: number;
    quantity?: number;
    unit?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    instructions?: string;
    notes?: string;
    item_type?: string;
    racikan_group?: string;
    racikan_name?: string;
    racikan_type?: string;
    racikan_qty?: number;
    racikan_unit?: string;
  }) => {
    const response = await api.put<MedicineOrderItem>(`/medicine-orders/${orderId}/items/${itemId}`, data);
    return response;
  },

  // Delete item from medicine order (pharmacy edit)
  deleteItem: async (orderId: number, itemId: number) => {
    const response = await api.delete<{ message: string }>(`/medicine-orders/${orderId}/items/${itemId}`);
    return response;
  },
};

// Get available medicines in pharmacy room
export const getPharmacyRoomMedicines = async (roomId: number) => {
  const response = await api.get<{
    id: number;
    room_id: number;
    medicine_id: number;
    medicine: {
      id: number;
      name: string;
      generic_name: string;
      code: string;
      unit: string;
      category: string;
      form: string;
      strength: string;
    };
    quantity: number;
    min_quantity: number;
  }[]>(`/pharmacy-rooms/${roomId}/medicines`);
  return response;
};
