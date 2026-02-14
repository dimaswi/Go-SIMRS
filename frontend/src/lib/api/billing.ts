import { api } from './client';

export interface BillingItem {
  id: number;
  billing_id: number;
  source_visit_id?: number;
  source_visit?: {
    id: number;
    visit_type: string;
    room?: { id: number; code: string; name: string };
    doctor?: { id: number; nama_lengkap: string };
  };
  item_type: 'registration' | 'procedure' | 'radiology' | 'laboratory' | 'consultation' | 'medicine' | 'room' | 'other';
  reference_id: number;
  reference_type: string;
  reference_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  // Tariff components
  administrasi: number;
  sarana: number;
  bhp: number;
  dokter_operator: number;
  dokter_anastesi: number;
  dokter_lainnya: number;
  penata_anastesi: number;
  paramedis: number;
  non_medis: number;
  // Performer info
  performed_by_id?: number;
  performed_by_name?: string;
  performed_by_role?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BillingPayment {
  id: number;
  payment_number: string;
  billing_id: number;
  payment_method: 'cash' | 'bpjs' | 'insurance' | 'debit' | 'credit' | 'transfer' | 'card' | 'qris' | 'other';
  amount: number;
  payment_date: string;
  received_amount: number;
  change_amount: number;
  bpjs_number?: string;
  bpjs_claim_code?: string;
  bpjs_amount?: number;
  insurance_name?: string;
  insurance_number?: string;
  insurance_claim_code?: string;
  insurance_amount?: number;
  bank_name?: string;
  card_number?: string;
  reference_number?: string;
  cashier_id: number;
  cashier?: any;
  status: 'completed' | 'voided' | 'refunded';
  voided_by_id?: number;
  voided_by?: any;
  voided_at?: string;
  voided_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Billing {
  id: number;
  billing_number: string;
  visit_id: number;
  visit?: any;
  registration_id: number;
  registration?: any;
  patient_class: string;
  total_amount: number;
  discount_amount: number;
  adjust_amount: number;
  final_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'cancelled';
  payment_method: 'cash' | 'bpjs' | 'insurance';
  bpjs_number?: string;
  insurance_name?: string;
  insurance_no?: string;
  paid_at?: string;
  discount_reason?: string;
  adjust_reason?: string;
  generated_by_id?: number;
  generated_by?: any;
  generated_at?: string;
  finalized_by_id?: number;
  finalized_by?: any;
  finalized_at?: string;
  notes?: string;
  items?: BillingItem[];
  payments?: BillingPayment[];
  created_at: string;
  updated_at: string;
}

export interface RegistrationTariff {
  id: number;
  service_type: string;
  payment_method: string;
  tariff_amount: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentRequest {
  payment_method: string;
  amount: number;
  received_amount?: number;
  bpjs_number?: string;
  bpjs_claim_code?: string;
  insurance_name?: string;
  insurance_number?: string;
  insurance_claim_code?: string;
  bank_name?: string;
  card_number?: string;
  reference_number?: string;
  notes?: string;
}

export const billingApi = {
  // Get all billings with filters
  getAll: async (params?: {
    status?: string;
    payment_method?: string;
    start_date?: string;
    end_date?: string;
    visit_id?: number;
    registration_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get<{ data: Billing[]; meta: { page: number; limit: number; total: number } }>('/billing', { params });
  },

  // Get billing by ID
  getById: async (id: number) => {
    return api.get<Billing>(`/billing/${id}`);
  },

  // Get billing by visit ID (returns billing + all visits for the registration)
  getByVisitId: async (visitId: number) => {
    return api.get<{ billing: Billing; visits: any[] }>(`/billing/visit/${visitId}`);
  },

  // Generate billing for a visit
  generate: async (visitId: number) => {
    return api.post<Billing>(`/billing/generate/${visitId}`);
  },

  // Finalize billing
  finalize: async (id: number) => {
    return api.post<Billing>(`/billing/${id}/finalize`);
  },

  // Update discount/adjustment
  updateDiscount: async (id: number, data: {
    discount_amount?: number;
    discount_reason?: string;
    adjust_amount?: number;
    adjust_reason?: string;
  }) => {
    return api.put<Billing>(`/billing/${id}/discount`, data);
  },

  // Cancel billing
  cancel: async (id: number, reason: string) => {
    return api.post<Billing>(`/billing/${id}/cancel`, { reason });
  },

  // Create payment
  createPayment: async (billingId: number, data: CreatePaymentRequest) => {
    return api.post<{ payment: BillingPayment; billing: Billing }>(`/billing/${billingId}/payments`, data);
  },

  // Get payments for billing
  getPayments: async (billingId: number) => {
    return api.get<BillingPayment[]>(`/billing/${billingId}/payments`);
  },

  // Void payment
  voidPayment: async (paymentId: number, reason: string) => {
    return api.post<{ payment: BillingPayment; billing: Billing }>(`/billing/payments/${paymentId}/void`, { reason });
  },

  // Get billable registrations (per registration, not per visit)
  getBillableRegistrations: async (params?: {
    payment_method?: string;
    date?: string;
    status?: string;
    search?: string;
    limit?: number;
  }) => {
    return api.get<any[]>('/billing/billable-registrations', { params });
  },

  // Legacy: Get billable visits (completed visits without billing)
  getBillableVisits: async (params?: {
    room_id?: number;
    date?: string;
    limit?: number;
  }) => {
    return api.get<any[]>('/billing/billable-visits', { params });
  },
};

export const registrationTariffApi = {
  // Get all tariffs
  getAll: async (serviceType?: string) => {
    return api.get<RegistrationTariff[]>('/registration-tariffs', { params: { service_type: serviceType } });
  },

  // Create tariff
  create: async (data: Partial<RegistrationTariff>) => {
    return api.post<RegistrationTariff>('/registration-tariffs', data);
  },

  // Update tariff
  update: async (id: number, data: Partial<RegistrationTariff>) => {
    return api.put<RegistrationTariff>(`/registration-tariffs/${id}`, data);
  },

  // Delete tariff
  delete: async (id: number) => {
    return api.delete(`/registration-tariffs/${id}`);
  },
};
