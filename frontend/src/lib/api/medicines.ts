import { api } from './client';

// Types
export type MedicineCategory = 'generic' | 'patent' | 'herbal' | 'traditional' | 'biological';
export type MedicineType = 'otc' | 'limited' | 'hard' | 'narcotic' | 'psychotrope';
export type MedicineForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'ointment' | 'drops' | 'powder' | 'infusion' | 'suppository' | 'inhaler' | 'patch' | 'other';

export interface Medicine {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  generic_name?: string;
  description?: string;
  category: MedicineCategory;
  type: MedicineType;
  form: MedicineForm;
  strength?: string;
  unit: string;
  manufacturer?: string;
  min_stock: number;
  max_stock: number;
  current_stock: number;
  purchase_price: number;
  selling_price: number;
  dpho_kode_obat?: string;
  dpho_nama_obat?: string;
  indication?: string;
  contraindication?: string;
  side_effects?: string;
  dosage?: string;
  interaction?: string;
  storage_info?: string;
  is_active: boolean;
  require_recipe: boolean;
  notes?: string;
  image_url?: string;
}

export interface MedicineRequest {
  code: string;
  name: string;
  generic_name?: string;
  description?: string;
  category: MedicineCategory;
  type?: MedicineType;
  form: MedicineForm;
  strength?: string;
  unit: string;
  manufacturer?: string;
  min_stock?: number;
  max_stock?: number;
  purchase_price?: number;
  selling_price?: number;
  dpho_kode_obat?: string;
  dpho_nama_obat?: string;
  indication?: string;
  contraindication?: string;
  side_effects?: string;
  dosage?: string;
  interaction?: string;
  storage_info?: string;
  is_active?: boolean;
  require_recipe?: boolean;
  notes?: string;
  image_url?: string;
}

export interface RoomMedicine {
  id: number;
  created_at: string;
  updated_at: string;
  room_id: number;
  room?: {
    id: number;
    name: string;
    code: string;
    service_type: string;
    room_type: string;
    is_active: boolean;
  };
  medicine_id: number;
  medicine?: Medicine;
  quantity: number;
  min_quantity: number;
  notes?: string;
}

export interface RoomMedicineRequest {
  medicine_id: number;
  quantity?: number;
  min_quantity?: number;
  notes?: string;
}

export interface MedicineListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: MedicineCategory;
  type?: MedicineType;
  form?: MedicineForm;
  is_active?: boolean;
}

// Category labels
export const medicineCategoryLabels: Record<MedicineCategory, string> = {
  generic: 'Obat Generik',
  patent: 'Obat Paten',
  herbal: 'Obat Herbal',
  traditional: 'Obat Tradisional',
  biological: 'Obat Biologis',
};

// Type labels
export const medicineTypeLabels: Record<MedicineType, string> = {
  otc: 'Obat Bebas (OTC)',
  limited: 'Obat Bebas Terbatas',
  hard: 'Obat Keras',
  narcotic: 'Narkotika',
  psychotrope: 'Psikotropika',
};

// Form labels
export const medicineFormLabels: Record<MedicineForm, string> = {
  tablet: 'Tablet',
  capsule: 'Kapsul',
  syrup: 'Sirup',
  injection: 'Injeksi',
  cream: 'Krim',
  ointment: 'Salep',
  drops: 'Tetes',
  powder: 'Serbuk',
  infusion: 'Infus',
  suppository: 'Supositoria',
  inhaler: 'Inhaler',
  patch: 'Patch/Koyo',
  other: 'Lainnya',
};

// Medicine API
export const medicinesApi = {
  // Get all medicines
  getAll: async (params?: MedicineListParams) => {
    return api.get('/medicines', { params });
  },

  // Get single medicine
  getById: async (id: number) => {
    return api.get(`/medicines/${id}`);
  },

  // Create medicine
  create: async (data: MedicineRequest) => {
    return api.post('/medicines', data);
  },

  // Update medicine
  update: async (id: number, data: MedicineRequest) => {
    return api.put(`/medicines/${id}`, data);
  },

  // Delete medicine
  delete: async (id: number) => {
    return api.delete(`/medicines/${id}`);
  },

  // Get categories from master data
  getCategories: async () => {
    return api.get('/medicines/categories');
  },

  // Get types from master data
  getTypes: async () => {
    return api.get('/medicines/types');
  },

  // Get forms from master data
  getForms: async () => {
    return api.get('/medicines/forms');
  },

  // Get units from master data
  getUnits: async () => {
    return api.get('/medicines/units');
  },
};

// Room Medicine API
export const roomMedicinesApi = {
  // Get all room medicines with pagination
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    room_id?: number;
    medicine_id?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    return api.get('/room-medicines', { params });
  },

  // Get single room medicine
  getById: async (id: number) => {
    return api.get(`/room-medicines/${id}`);
  },

  // Get medicines assigned to a room
  getByRoom: async (roomId: number, params?: { page?: number; limit?: number; search?: string }) => {
    return api.get(`/rooms/${roomId}/medicines`, { params });
  },

  // Get rooms by medicine
  getByMedicine: async (medicineId: number) => {
    return api.get(`/medicines/${medicineId}/rooms`);
  },

  // Get total stock of a medicine across all rooms
  getTotalStock: async (medicineId: number) => {
    return api.get(`/medicines/${medicineId}/total-stock`);
  },

  // Assign medicine to room (create)
  create: async (data: {
    room_id: number;
    medicine_id: number;
    quantity?: number;
    min_quantity?: number;
    notes?: string;
  }) => {
    return api.post('/room-medicines', data);
  },

  // Legacy: Assign medicine to room
  assignToRoom: async (roomId: number, data: RoomMedicineRequest) => {
    return api.post('/room-medicines', { room_id: roomId, ...data });
  },

  // Update room medicine
  update: async (id: number, data: {
    quantity?: number;
    min_quantity?: number;
    notes?: string;
  }) => {
    return api.put(`/room-medicines/${id}`, data);
  },

  // Delete room medicine
  delete: async (id: number) => {
    return api.delete(`/room-medicines/${id}`);
  },

  // Legacy: Remove medicine from room
  remove: async (roomId: number, medicineId: number) => {
    return api.delete(`/rooms/${roomId}/medicines/${medicineId}`);
  },

  // Adjust stock
  adjustStock: async (id: number, data: {
    adjustment_type: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
  }) => {
    return api.post(`/room-medicines/${id}/adjust`, data);
  },

  // Transfer stock between rooms
  transfer: async (data: {
    from_room_id: number;
    to_room_id: number;
    medicine_id: number;
    quantity: number;
    notes?: string;
  }) => {
    return api.post('/room-medicines/transfer', data);
  },

  // Get low stock medicines
  getLowStock: async (roomId?: number) => {
    const params = roomId ? { room_id: roomId } : {};
    return api.get('/room-medicines/low-stock', { params });
  },
};

export default medicinesApi;
