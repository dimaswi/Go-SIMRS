import { api } from './client';

// ===========================================================================
// CPPT INTERFACES
// ===========================================================================

export interface CPPT {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  record_date: string;
  profession: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  instruction?: string;
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  pain_scale?: number;
  is_verified: boolean;
  verified_by_id?: number;
  verified_by?: {
    id: number;
    username: string;
    full_name: string;
  };
  verified_at?: string;
  created_by_id?: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface CreateCPPTInput {
  record_date: string;
  profession: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  instruction?: string;
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  pain_scale?: number;
}

export interface UpdateCPPTInput extends Partial<CreateCPPTInput> {}

// ===========================================================================
// FLUID BALANCE INTERFACES
// ===========================================================================

export interface FluidBalance {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  record_date: string;
  shift_type: string;
  // Intake
  oral_drink: number;
  oral_food: number;
  oral_medicine: number;
  iv_fluid: number;
  iv_medicine: number;
  blood_product: number;
  enteral_feed: number;
  other_intake: number;
  other_intake_note?: string;
  // Output
  urine_amount: number;
  urine_color?: string;
  urine_catheter: boolean;
  feces_amount: number;
  feces_freq: number;
  feces_type?: string;
  vomit_amount: number;
  vomit_freq: number;
  drain_amount: number;
  drain_type?: string;
  drain_color?: string;
  blood_loss: number;
  blood_loss_note?: string;
  iwl: number;
  other_output: number;
  other_output_note?: string;
  // Calculated
  total_intake: number;
  total_output: number;
  balance: number;
  notes?: string;
  created_by_id?: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface CreateFluidBalanceInput {
  record_date: string;
  shift_type: string;
  oral_drink?: number;
  oral_food?: number;
  oral_medicine?: number;
  iv_fluid?: number;
  iv_medicine?: number;
  blood_product?: number;
  enteral_feed?: number;
  other_intake?: number;
  other_intake_note?: string;
  urine_amount?: number;
  urine_color?: string;
  urine_catheter?: boolean;
  feces_amount?: number;
  feces_freq?: number;
  feces_type?: string;
  vomit_amount?: number;
  vomit_freq?: number;
  drain_amount?: number;
  drain_type?: string;
  drain_color?: string;
  blood_loss?: number;
  blood_loss_note?: string;
  iwl?: number;
  other_output?: number;
  other_output_note?: string;
  notes?: string;
}

export interface UpdateFluidBalanceInput extends Partial<CreateFluidBalanceInput> {}

export interface FluidBalanceSummary {
  date: string;
  total_intake: number;
  total_output: number;
  balance: number;
}

// ===========================================================================
// CPPT API
// ===========================================================================

export const cpptApi = {
  getAll: (visitId: number, params?: { profession?: string; start_date?: string; end_date?: string }) => 
    api.get<{ data: CPPT[] }>(`/visits/${visitId}/cppt`, { params }),
  
  getOne: (visitId: number, cpptId: number) => 
    api.get<{ data: CPPT }>(`/visits/${visitId}/cppt/${cpptId}`),
  
  create: (visitId: number, data: CreateCPPTInput) => 
    api.post<{ data: CPPT }>(`/visits/${visitId}/cppt`, data),
  
  update: (visitId: number, cpptId: number, data: UpdateCPPTInput) => 
    api.put<{ data: CPPT }>(`/visits/${visitId}/cppt/${cpptId}`, data),
  
  verify: (visitId: number, cpptId: number) => 
    api.put<{ data: CPPT }>(`/visits/${visitId}/cppt/${cpptId}/verify`),
  
  delete: (visitId: number, cpptId: number) => 
    api.delete(`/visits/${visitId}/cppt/${cpptId}`),
};

// ===========================================================================
// FLUID BALANCE API
// ===========================================================================

export const fluidBalanceApi = {
  getAll: (visitId: number, params?: { start_date?: string; end_date?: string; shift_type?: string }) => 
    api.get<{ data: FluidBalance[] }>(`/visits/${visitId}/fluid-balance`, { params }),
  
  getOne: (visitId: number, balanceId: number) => 
    api.get<{ data: FluidBalance }>(`/visits/${visitId}/fluid-balance/${balanceId}`),
  
  getSummary: (visitId: number) => 
    api.get<{ data: FluidBalanceSummary[] }>(`/visits/${visitId}/fluid-balance/summary`),
  
  create: (visitId: number, data: CreateFluidBalanceInput) => 
    api.post<{ data: FluidBalance }>(`/visits/${visitId}/fluid-balance`, data),
  
  update: (visitId: number, balanceId: number, data: UpdateFluidBalanceInput) => 
    api.put<{ data: FluidBalance }>(`/visits/${visitId}/fluid-balance/${balanceId}`, data),
  
  delete: (visitId: number, balanceId: number) => 
    api.delete(`/visits/${visitId}/fluid-balance/${balanceId}`),
};

// ===========================================================================
// CONSTANTS
// ===========================================================================

export const CPPT_PROFESSIONS = [
  { value: 'dokter', label: 'Dokter' },
  { value: 'perawat', label: 'Perawat' },
  { value: 'bidan', label: 'Bidan' },
  { value: 'gizi', label: 'Ahli Gizi' },
  { value: 'farmasi', label: 'Farmasi' },
  { value: 'fisioterapi', label: 'Fisioterapi' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const SHIFT_TYPES = [
  { value: 'pagi', label: 'Pagi (07:00 - 14:00)' },
  { value: 'siang', label: 'Siang (14:00 - 21:00)' },
  { value: 'malam', label: 'Malam (21:00 - 07:00)' },
];

export const getCPPTProfessionLabel = (profession: string): string => {
  const found = CPPT_PROFESSIONS.find(p => p.value === profession);
  return found?.label || profession;
};

export const getShiftTypeLabel = (shiftType: string): string => {
  const found = SHIFT_TYPES.find(s => s.value === shiftType);
  return found?.label || shiftType;
};
