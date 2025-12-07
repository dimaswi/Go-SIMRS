import { api } from './client';

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

// API Functions
export const medicineOrdersApi = {
  // Get all medicine orders
  getAll: async (params?: {
    source_visit_id?: number;
    pharmacy_visit_id?: number;
    pharmacy_room_id?: number;
    registration_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.source_visit_id) searchParams.append('source_visit_id', String(params.source_visit_id));
    if (params?.pharmacy_visit_id) searchParams.append('pharmacy_visit_id', String(params.pharmacy_visit_id));
    if (params?.pharmacy_room_id) searchParams.append('pharmacy_room_id', String(params.pharmacy_room_id));
    if (params?.registration_id) searchParams.append('registration_id', String(params.registration_id));
    if (params?.status) searchParams.append('status', params.status);
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
  update: async (id: number, data: { priority?: string; diagnosis?: string; notes?: string }) => {
    const response = await api.put<MedicineOrder>(`/medicine-orders/${id}`, data);
    return response;
  },

  // Cancel medicine order
  cancel: async (id: number) => {
    const response = await api.post<{ message: string }>(`/medicine-orders/${id}/cancel`, {});
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
