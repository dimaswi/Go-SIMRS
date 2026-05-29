import { api } from './client';

// ===========================================================================
// CPPT INTERFACES
// ===========================================================================

export type CPPTFormat = 'soap' | 'sbar' | 'tbak';

export interface CPPT {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  record_date: string;
  profession: string;
  cppt_format?: CPPTFormat;
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
  cppt_format?: CPPTFormat;
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
  verified_by?: {
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

export const CPPT_FORMATS: { value: CPPTFormat; label: string }[] = [
  { value: 'soap', label: 'SOAP' },
  { value: 'sbar', label: 'SBAR' },
  { value: 'tbak', label: 'TBAK' },
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

export const getCPPTFormatLabel = (cpptFormat?: CPPTFormat): string => {
  const format = cpptFormat || 'soap';
  const found = CPPT_FORMATS.find(f => f.value === format);
  return found?.label || format.toUpperCase();
};

export const getShiftTypeLabel = (shiftType: string): string => {
  const found = SHIFT_TYPES.find(s => s.value === shiftType);
  return found?.label || shiftType;
};

// ===========================================================================
// NURSING CARE INTERFACES - Asuhan Keperawatan
// ===========================================================================

export interface NursingCare {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  record_date: string;
  shift_type?: string;
  // Pengkajian
  chief_complaint?: string;
  pain_assessment?: string;
  pain_scale?: number;
  consciousness_level?: string;
  functional_status?: string;
  fall_risk_assessment?: string;
  fall_risk_score?: number;
  nutrition_assessment?: string;
  skin_assessment?: string;
  pressure_ulcer_risk?: string;
  // Vital Signs
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  // Diagnosis Keperawatan (SDKI)
  nursing_diagnosis?: string;
  nursing_diagnosis_code?: string;
  problem_etiology?: string;
  signs_symptoms?: string;
  // Luaran (SLKI)
  nursing_outcome?: string;
  nursing_outcome_code?: string;
  outcome_indicators?: string;
  outcome_target?: string;
  // Intervensi (SIKI)
  nursing_intervention?: string;
  nursing_intervention_code?: string;
  observation_actions?: string;
  therapeutic_actions?: string;
  education_actions?: string;
  collaboration_actions?: string;
  // Implementasi
  implementation?: string;
  implementation_time?: string;
  patient_response?: string;
  // Evaluasi
  evaluation_subjective?: string;
  evaluation_objective?: string;
  evaluation_analysis?: string;
  evaluation_planning?: string;
  problem_status?: string;
  notes?: string;
  // Verification
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

export interface CreateNursingCareInput {
  record_date: string;
  shift_type?: string;
  chief_complaint?: string;
  pain_assessment?: string;
  pain_scale?: number;
  consciousness_level?: string;
  functional_status?: string;
  fall_risk_assessment?: string;
  fall_risk_score?: number;
  nutrition_assessment?: string;
  skin_assessment?: string;
  pressure_ulcer_risk?: string;
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  nursing_diagnosis?: string;
  nursing_diagnosis_code?: string;
  problem_etiology?: string;
  signs_symptoms?: string;
  nursing_outcome?: string;
  nursing_outcome_code?: string;
  outcome_indicators?: string;
  outcome_target?: string;
  nursing_intervention?: string;
  nursing_intervention_code?: string;
  observation_actions?: string;
  therapeutic_actions?: string;
  education_actions?: string;
  collaboration_actions?: string;
  implementation?: string;
  implementation_time?: string;
  patient_response?: string;
  evaluation_subjective?: string;
  evaluation_objective?: string;
  evaluation_analysis?: string;
  evaluation_planning?: string;
  problem_status?: string;
  notes?: string;
}

export interface UpdateNursingCareInput extends Partial<CreateNursingCareInput> {}

// ===========================================================================
// NURSING CARE API
// ===========================================================================

export const nursingCareApi = {
  getAll: (visitId: number, params?: { start_date?: string; end_date?: string; shift_type?: string; problem_status?: string }) => 
    api.get<{ data: NursingCare[] }>(`/visits/${visitId}/nursing-care`, { params }),
  
  getOne: (visitId: number, nursingId: number) => 
    api.get<{ data: NursingCare }>(`/visits/${visitId}/nursing-care/${nursingId}`),
  
  create: (visitId: number, data: CreateNursingCareInput) => 
    api.post<{ data: NursingCare }>(`/visits/${visitId}/nursing-care`, data),
  
  update: (visitId: number, nursingId: number, data: UpdateNursingCareInput) => 
    api.put<{ data: NursingCare }>(`/visits/${visitId}/nursing-care/${nursingId}`, data),
  
  verify: (visitId: number, nursingId: number) => 
    api.put<{ data: NursingCare }>(`/visits/${visitId}/nursing-care/${nursingId}/verify`),
  
  delete: (visitId: number, nursingId: number) => 
    api.delete(`/visits/${visitId}/nursing-care/${nursingId}`),
};

// ===========================================================================
// FALL RISK ASSESSMENT TYPES & API
// ===========================================================================

export interface FallRiskAssessment {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  record_date: string;
  scale_type: string;
  items_json: string;
  total_score: number;
  risk_level: string;
  risk_action: string;
  notes?: string;
  assessed_by_id?: number;
  assessed_by?: {
    id: number;
    nama_lengkap: string;
  };
}

export interface CreateFallRiskAssessmentInput {
  record_date: string;
  scale_type: string;
  items_json: string;
  total_score: number;
  risk_level: string;
  risk_action?: string;
  notes?: string;
}

export interface UpdateFallRiskAssessmentInput extends Partial<CreateFallRiskAssessmentInput> {}

export const fallRiskApi = {
  getAll: (visitId: number, params?: { scale_type?: string }) => 
    api.get<{ data: FallRiskAssessment[] }>(`/visits/${visitId}/fall-risk`, { params }),
  
  getOne: (visitId: number, assessmentId: number) => 
    api.get<{ data: FallRiskAssessment }>(`/visits/${visitId}/fall-risk/${assessmentId}`),
  
  create: (visitId: number, data: CreateFallRiskAssessmentInput) => 
    api.post<{ data: FallRiskAssessment }>(`/visits/${visitId}/fall-risk`, data),
  
  update: (visitId: number, assessmentId: number, data: UpdateFallRiskAssessmentInput) => 
    api.put<{ data: FallRiskAssessment }>(`/visits/${visitId}/fall-risk/${assessmentId}`, data),
  
  delete: (visitId: number, assessmentId: number) => 
    api.delete(`/visits/${visitId}/fall-risk/${assessmentId}`),
};

// ===========================================================================
// O2 USAGE (Penggunaan Oksigen)
// ===========================================================================

export interface O2UsageRecord {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  tank_type: string;
  flow_rate: number;
  delivery_method: string;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number;
  base_price: number;
  total_charge: number;
  billed: boolean;
  notes?: string;
  created_by_id?: number;
  created_by?: { id: number; full_name: string };
  stopped_by_id?: number;
  stopped_by?: { id: number; full_name: string };
}

export interface StartO2UsageInput {
  tank_type: string;
  flow_rate: number;
  delivery_method: string;
  started_at?: string;
  base_price?: number;
  notes?: string;
}

export interface StopO2UsageInput {
  stopped_at?: string;
  base_price?: number;
}

export interface UpdateO2UsageInput {
  started_at?: string;
  stopped_at?: string;
  flow_rate?: number;
  delivery_method?: string;
  tank_type?: string;
  base_price?: number;
  notes?: string;
}

export const o2UsageApi = {
  getAll: (visitId: number) =>
    api.get<{ data: O2UsageRecord[] }>(`/visits/${visitId}/o2-usage`),

  getOne: (visitId: number, recordId: number) =>
    api.get<{ data: O2UsageRecord }>(`/visits/${visitId}/o2-usage/${recordId}`),

  start: (visitId: number, data: StartO2UsageInput) =>
    api.post<{ data: O2UsageRecord }>(`/visits/${visitId}/o2-usage`, data),

  stop: (visitId: number, recordId: number, data: StopO2UsageInput) =>
    api.put<{ data: O2UsageRecord }>(`/visits/${visitId}/o2-usage/${recordId}/stop`, data),

  update: (visitId: number, recordId: number, data: UpdateO2UsageInput) =>
    api.put<{ data: O2UsageRecord }>(`/visits/${visitId}/o2-usage/${recordId}`, data),

  delete: (visitId: number, recordId: number) =>
    api.delete(`/visits/${visitId}/o2-usage/${recordId}`),
};

// ===========================================================================
// BHP USAGE (Penggunaan BHP Ruangan/Unit)
// ===========================================================================

export interface BHPUsageRecord {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  room_id: number;
  inventory_id: number;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  used_at: string;
  notes?: string;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    price: number;
  };
  created_by_id?: number;
  created_by?: {
    id: number;
    full_name: string;
  };
  updated_by_id?: number;
  updated_by?: {
    id: number;
    full_name: string;
  };
}

export interface BHPUsageAvailableItem {
  room_inventory_id: number;
  inventory_id: number;
  code: string;
  name: string;
  unit: string;
  price: number;
  current_stock: number;
}

export interface SaveBHPUsageInput {
  inventory_id: number;
  quantity: number;
  unit_price?: number;
  used_at?: string;
  notes?: string;
}

export const bhpUsageApi = {
  getAll: (visitId: number) =>
    api.get<{ data: BHPUsageRecord[] }>(`/visits/${visitId}/bhp-usage`),

  getOne: (visitId: number, usageId: number) =>
    api.get<{ data: BHPUsageRecord }>(`/visits/${visitId}/bhp-usage/${usageId}`),

  getAvailableItems: (visitId: number) =>
    api.get<{ data: BHPUsageAvailableItem[] }>(`/visits/${visitId}/bhp-usage/available-items`),

  create: (visitId: number, data: SaveBHPUsageInput) =>
    api.post<{ data: BHPUsageRecord }>(`/visits/${visitId}/bhp-usage`, data),

  update: (visitId: number, usageId: number, data: SaveBHPUsageInput) =>
    api.put<{ data: BHPUsageRecord }>(`/visits/${visitId}/bhp-usage/${usageId}`, data),

  delete: (visitId: number, usageId: number) =>
    api.delete(`/visits/${visitId}/bhp-usage/${usageId}`),
};

// ===========================================================================
// NURSING CARE CONSTANTS
// ===========================================================================

export const CONSCIOUSNESS_LEVELS = [
  { value: 'composmentis', label: 'Compos Mentis (CM)' },
  { value: 'apatis', label: 'Apatis' },
  { value: 'somnolen', label: 'Somnolen' },
  { value: 'sopor', label: 'Sopor' },
  { value: 'koma', label: 'Koma' },
];

export const FUNCTIONAL_STATUS = [
  { value: 'mandiri', label: 'Mandiri' },
  { value: 'partial', label: 'Dibantu Sebagian' },
  { value: 'total', label: 'Dibantu Total' },
];

export const PRESSURE_ULCER_RISK = [
  { value: 'rendah', label: 'Risiko Rendah' },
  { value: 'sedang', label: 'Risiko Sedang' },
  { value: 'tinggi', label: 'Risiko Tinggi' },
];

export const OUTCOME_TARGETS = [
  { value: 'meningkat', label: 'Meningkat' },
  { value: 'menurun', label: 'Menurun' },
  { value: 'membaik', label: 'Membaik' },
  { value: 'cukup', label: 'Cukup' },
  { value: 'sedang', label: 'Sedang' },
];

export const PROBLEM_STATUS = [
  { value: 'teratasi', label: 'Teratasi' },
  { value: 'teratasi_sebagian', label: 'Teratasi Sebagian' },
  { value: 'belum_teratasi', label: 'Belum Teratasi' },
];

export const getConsciousnessLevelLabel = (level: string): string => {
  const found = CONSCIOUSNESS_LEVELS.find(l => l.value === level);
  return found?.label || level;
};

export const getFunctionalStatusLabel = (status: string): string => {
  const found = FUNCTIONAL_STATUS.find(s => s.value === status);
  return found?.label || status;
};

export const getProblemStatusLabel = (status: string): string => {
  const found = PROBLEM_STATUS.find(s => s.value === status);
  return found?.label || status;
};

export const getProblemStatusColor = (status: string): string => {
  switch (status) {
    case 'teratasi':
      return 'bg-green-100 text-green-800';
    case 'teratasi_sebagian':
      return 'bg-yellow-100 text-yellow-800';
    case 'belum_teratasi':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ===========================================================================
// BED TRANSFER INTERFACES - Mutasi Pasien
// ===========================================================================

export interface BedTransfer {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  from_room_id: number;
  from_room?: {
    id: number;
    code: string;
    name: string;
    room_class?: string;
  };
  from_bed_id: number;
  from_bed?: {
    id: number;
    bed_number: string;
  };
  to_room_id: number;
  to_room?: {
    id: number;
    code: string;
    name: string;
    room_class?: string;
  };
  to_bed_id: number;
  to_bed?: {
    id: number;
    bed_number: string;
  };
  transfer_date: string;
  transfer_reason?: string;
  transfer_type?: string;
  old_inpatient_class?: string;
  new_inpatient_class?: string;
  notes?: string;
  created_by_id?: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface CreateBedTransferInput {
  to_room_id: number;
  to_bed_id: number;
  transfer_reason?: string;
  transfer_type?: string;
  notes?: string;
}

// ===========================================================================
// BED TRANSFER API
// ===========================================================================

export const bedTransferApi = {
  getAll: (visitId: number) => 
    api.get<{ data: BedTransfer[] }>(`/visits/${visitId}/bed-transfer`),
  
  getOne: (visitId: number, transferId: number) => 
    api.get<{ data: BedTransfer }>(`/visits/${visitId}/bed-transfer/${transferId}`),
  
  create: (visitId: number, data: CreateBedTransferInput) => 
    api.post<{ data: BedTransfer; message: string }>(`/visits/${visitId}/bed-transfer`, data),
};

// ===========================================================================
// BED TRANSFER CONSTANTS
// ===========================================================================

export const TRANSFER_TYPES = [
  { value: 'upgrade', label: 'Naik Kelas' },
  { value: 'downgrade', label: 'Turun Kelas' },
  { value: 'medical', label: 'Kebutuhan Medis' },
  { value: 'request', label: 'Permintaan Pasien' },
  { value: 'other', label: 'Lainnya' },
];

export const getTransferTypeLabel = (type: string): string => {
  const found = TRANSFER_TYPES.find(t => t.value === type);
  return found?.label || type;
};

// ===========================================================================
// UNIT TRANSFER INTERFACES - Mutasi Unit (Rawat Jalan/UGD)
// ===========================================================================

export interface UnitTransfer {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  from_room_id: number;
  from_room?: {
    id: number;
    code: string;
    name: string;
    service_type: string;
  };
  from_doctor_id?: number;
  from_doctor?: {
    id: number;
    nama_lengkap: string;
    gelar_depan?: string;
    gelar_belakang?: string;
  };
  to_room_id: number;
  to_room?: {
    id: number;
    code: string;
    name: string;
    service_type: string;
  };
  to_doctor_id?: number;
  to_doctor?: {
    id: number;
    nama_lengkap: string;
    gelar_depan?: string;
    gelar_belakang?: string;
  };
  transfer_date: string;
  transfer_reason?: string;
  notes?: string;
  created_by_id?: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface CreateUnitTransferInput {
  to_room_id: number;
  to_doctor_id?: number;
  transfer_reason?: string;
  notes?: string;
}

// ===========================================================================
// UNIT TRANSFER API
// ===========================================================================

export const unitTransferApi = {
  getAll: (visitId: number) =>
    api.get<{ data: UnitTransfer[] }>(`/visits/${visitId}/unit-transfer`),

  create: (visitId: number, data: CreateUnitTransferInput) =>
    api.post<{ data: UnitTransfer; message: string }>(`/visits/${visitId}/unit-transfer`, data),
};
