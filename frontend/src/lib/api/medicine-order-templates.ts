import { api } from './client';

export interface DoctorMedicineTemplateItem {
  id: number;
  template_id: number;
  medicine_id: number;
  medicine?: {
    id: number;
    name: string;
    code: string;
    unit: string;
    strength?: string;
    form?: string;
    selling_price?: number;
  };
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
  sort_order: number;
}

export interface DoctorMedicineTemplate {
  id: number;
  name: string;
  notes: string;
  owner_employee_id: number;
  dpjp_employee_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: DoctorMedicineTemplateItem[];
}

export const medicineOrderTemplatesApi = {
  getAll: async (params?: { source_visit_id?: number; include_inactive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.source_visit_id) query.append('source_visit_id', String(params.source_visit_id));
    if (params?.include_inactive) query.append('include_inactive', 'true');
    return api.get<{ data: DoctorMedicineTemplate[] }>(`/medicine-orders/templates${query.toString() ? `?${query.toString()}` : ''}`);
  },

  create: async (data: {
    name: string;
    notes?: string;
    source_visit_id?: number;
    bind_to_dpjp?: boolean;
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
      sort_order?: number;
    }[];
  }) => {
    return api.post<{ data: DoctorMedicineTemplate }>('/medicine-orders/templates', data);
  },
};
