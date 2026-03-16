import { api } from './client';
import type { Procedure } from './procedures';
import type { Medicine } from './medicines';

export interface ClinicalPackageProcedureItem {
  id: number;
  package_id: number;
  procedure_id: number;
  procedure?: Procedure;
  sort_order: number;
  notes?: string;
}

export interface ClinicalPackageMedicineItem {
  id: number;
  package_id: number;
  medicine_id: number;
  medicine?: Medicine;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  sort_order: number;
  notes?: string;
}

export interface ClinicalPackage {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  notes?: string;
  procedure_items?: ClinicalPackageProcedureItem[];
  medicine_items?: ClinicalPackageMedicineItem[];
}

export interface ClinicalPackageInput {
  code?: string;
  name: string;
  description?: string;
  is_active?: boolean;
  notes?: string;
  procedure_items: {
    procedure_id: number;
    sort_order?: number;
    notes?: string;
  }[];
  medicine_items: {
    medicine_id: number;
    quantity: number;
    unit?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    instructions?: string;
    sort_order?: number;
    notes?: string;
  }[];
}

export interface RoomClinicalPackage {
  id: number;
  room_id: number;
  clinical_package_id: number;
  clinical_package?: ClinicalPackage;
  is_active: boolean;
  notes?: string;
}

export const clinicalPackagesApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: string | boolean;
    room_id?: number;
    assigned_active_only?: string | boolean;
  }) => api.get('/clinical-packages', { params }),

  getById: (id: number) => api.get(`/clinical-packages/${id}`),

  create: (data: ClinicalPackageInput) => api.post('/clinical-packages', data),

  update: (id: number, data: ClinicalPackageInput) => api.put(`/clinical-packages/${id}`, data),

  delete: (id: number) => api.delete(`/clinical-packages/${id}`),
};

export const roomClinicalPackagesApi = {
  getByRoom: (roomId: number, params?: { is_active?: string | boolean; package_active_only?: string | boolean }) =>
    api.get(`/rooms/${roomId}/clinical-packages`, { params }),

  create: (roomId: number, data: { clinical_package_id: number; is_active?: boolean; notes?: string }) =>
    api.post(`/rooms/${roomId}/clinical-packages`, data),

  update: (roomId: number, assignmentId: number, data: { is_active?: boolean; notes?: string }) =>
    api.put(`/rooms/${roomId}/clinical-packages/${assignmentId}`, data),

  delete: (roomId: number, assignmentId: number) =>
    api.delete(`/rooms/${roomId}/clinical-packages/${assignmentId}`),
};