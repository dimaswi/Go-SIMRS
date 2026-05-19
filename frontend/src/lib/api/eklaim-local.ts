import { api } from './client';

// ==================== TYPES ====================

export interface EKlaimLocal {
  id: number;
  sep_id: number;
  sep?: SEPData;
  visit_id: number;
  visit?: any;
  no_sep: string;
  no_kartu: string;
  nama_pasien: string;

  // Status tracking
  status: EKlaimLocalStatus;

  // new_claim
  new_claim_sent_at?: string;
  new_claim_response?: string;
  new_claim_success: boolean;

  // set_claim_data
  set_claim_data_sent_at?: string;
  set_claim_data_response?: string;
  set_claim_data_success: boolean;

  // grouper
  grouper_sent_at?: string;
  grouper_response?: string;
  grouper_success: boolean;
  cbg_code: string;
  cbg_description: string;
  cbg_tariff: number;
  hospital_tariff: number;
  tariff_diff: number;

  // final
  final_sent_at?: string;
  final_response?: string;
  final_success: boolean;

  // Form data
  form_data_saved: boolean;
  tgl_masuk: string;
  tgl_pulang: string;
  cara_masuk: string;
  jenis_rawat: string;
  kelas_rawat: string;
  discharge_status: string;
  tarif_rs: number;
  diagnosa: string;
  procedure: string;
  diagnosa_inagrouper: string;
  procedure_inagrouper: string;

  // ICU
  icu_indikator: string;
  icu_los: string;
  ventilator_hour: string;

  // Neonatus
  birth_weight: string;

  // Sub-acute / Chronic
  adl_sub_acute: string;
  adl_chronic: string;

  // Coder
  coder_nik: string;

  // Upgrade
  upgrade_class_ind: string;
  upgrade_class_class: string;
  upgrade_class_los: string;
  upgrade_class_payor: string;
  add_payment_pct: string;

  // Ventilator detail
  ventilator_use_ind: string;
  ventilator_start: string;
  ventilator_stop: string;

  // Vital signs
  sistole: number;
  diastole: number;

  // Tarif & Payor
  kode_tarif: string;
  payor_id: string;
  payor_cd: string;
  cob_cd: string;
  nama_dokter: string;
  tarif_poli_eks: string;

  // Khusus COVID / BBL / Hemodialisa / Stroke
  nomor_kartu_t: string;
  bayi_lahir_status_cd: number;
  dializer_single_use: number;
  kantong_darah: number;
  alteplase_ind: number;

  // APGAR menit 1
  apgar_menit1_appearance: number;
  apgar_menit1_pulse: number;
  apgar_menit1_grimace: number;
  apgar_menit1_activity: number;
  apgar_menit1_respiration: number;
  // APGAR menit 5
  apgar_menit5_appearance: number;
  apgar_menit5_pulse: number;
  apgar_menit5_grimace: number;
  apgar_menit5_activity: number;
  apgar_menit5_respiration: number;

  // Persalinan
  persalinan_usia_kehamilan: string;
  persalinan_gravida: string;
  persalinan_partus: string;
  persalinan_abortus: string;
  persalinan_onset_kontraksi: string;
  persalinan_delivery_json: string;

  // === iDRG Tracking ===
  idrg_diagnosa: string;
  idrg_procedure: string;
  idrg_diagnosa_response: string;
  idrg_procedure_response: string;
  idrg_grouper_sent_at?: string;
  idrg_grouper_response: string;
  idrg_grouper_success: boolean;
  idrg_code: string;
  idrg_description: string;
  idrg_cost_weight: string;
  idrg_status_cd: string;
  idrg_final_sent_at?: string;
  idrg_final_success: boolean;

  // === INACBG Tracking ===
  inacbg_diagnosa: string;
  inacbg_procedure: string;
  inacbg_diagnosa_response: string;
  inacbg_procedure_response: string;
  inacbg_import_response: string;
  inacbg_grouper_stage1_sent_at?: string;
  inacbg_grouper_stage1_response: string;
  inacbg_grouper_stage1_success: boolean;
  special_cmg_options: string;
  selected_special_cmg: string;
  inacbg_grouper_stage2_sent_at?: string;
  inacbg_grouper_stage2_response: string;
  inacbg_grouper_stage2_success: boolean;
  inacbg_cbg_code: string;
  inacbg_cbg_description: string;
  inacbg_base_tariff: string;
  inacbg_tariff: string;
  inacbg_status_cd: string;
  inacbg_final_sent_at?: string;
  inacbg_final_success: boolean;

  // === Claim Final & Send ===
  claim_final_sent_at?: string;
  claim_final_response: string;
  claim_final_success: boolean;
  claim_send_sent_at?: string;
  claim_send_response: string;
  claim_send_success: boolean;
  claim_reedit_sent_at?: string;
  claim_reedit_response: string;
  claim_data_last_sync_at?: string;

  // === Button visibility (from GetButtonVisibility) ===
  buttons?: Record<string, boolean>;

  // Error
  last_error?: string;
  last_error_at?: string;

  // Relations
  rm_duplicate?: EKlaimRMDuplicate;
  logs?: EKlaimLocalLog[];
  created_by?: any;
  created_by_id?: number;

  created_at: string;
  updated_at: string;
}

export type EKlaimLocalStatus =
  | 'draft'
  | 'new_claim'
  | 'set_claim_data'
  | 'idrg_coded'
  | 'idrg_grouped'
  | 'idrg_final'
  | 'inacbg_imported'
  | 'inacbg_coded'
  | 'inacbg_grouped'
  | 'inacbg_final'
  | 'claim_final'
  | 'claim_sent'
  // Legacy statuses (backward compat)
  | 'grouped'
  | 'finalized'
  | 'sent';

export interface SEPData {
  id: number;
  no_sep: string;
  no_kartu: string;
  nama_pasien: string;
  tgl_sep: string;
  tgl_lahir: string;
  jenis_kelamin: string;
  jns_pelayanan: string;
  kls_rawat_hak: string;
  no_mr: string;
  diag_awal: string;
  nama_diagnosa: string;
  kode_poli: string;
  nama_poli: string;
  nama_dpjp: string;
  ppk_pelayanan: string;
  status: string;
  patient_id: number;
  patient?: any;
  visit_id?: number;
  visit?: any;
  registration_id?: number;
}

export interface EKlaimRMDuplicate {
  id: number;
  eklaim_local_id: number;
  visit_id: number;

  // Anamnesis meta
  anamnesis_source?: string;
  functional_status?: string;
  original_diagnoses_json?: string;
  original_procedures_json?: string;
  original_tarif_json?: string;
  original_rm_json?: string;

  // Anamnesis
  chief_complaint: string;
  history_of_present_illness: string;
  past_medical_history: string;
  family_history: string;
  social_history: string;
  allergies: string;
  current_medications: string;
  review_of_systems: string;

  // Physical Exam / Vital Signs
  general_condition: string;
  consciousness: string;
  blood_pressure: string;
  systolic: number;
  diastolic: number;
  heart_rate: string;
  respiratory_rate: string;
  temperature: string;
  oxygen_saturation: string;
  weight: string;
  height: string;
  bmi: number;
  waist: string;
  head_circum: string;
  pain_method: string;
  pain_scale: number;
  pain_location: string;

  // Body Systems (legacy composite)
  head_neck: string;
  eyes: string;
  ent: string;
  thorax: string;
  cardiac: string;
  pulmonary: string;
  abdomen: string;
  extremities: string;
  neurological: string;
  skin: string;

  // Body Systems (new individual)
  head: string;
  ears: string;
  nose: string;
  throat: string;
  neck: string;
  chest: string;
  heart: string;
  lungs: string;
  musculoskel: string;
  genitourinary: string;
  other_findings: string;

  // ECG
  ecg_performed: boolean;
  ecg_result: string;
  ecg_interpretation: string;
  ecg_notes: string;

  // Assessment & Plan
  clinical_assessment: string;
  prognosis: string;
  treatment_plan: string;
  medication_plan: string;
  diet_plan: string;
  activity_plan: string;
  education_plan: string;
  monitoring_plan: string;
  procedure_plan: string;
  consultation_plan: string;

  // Disposition
  disposition_type: string;
  disposition_note: string;
  rm_discharge_status: string;
  discharge_condition: string;
  discharge_instruction: string;
  discharge_medication: string;
  follow_up_instruction: string;
  follow_up_date: string;
  referral_facility: string;
  referral_reason: string;
  referral_diagnosis: string;
  referral_therapy: string;
  referral_notes: string;
  death_time: string;
  death_cause: string;

  // Relations
  diagnoses: EKlaimRMDiagnosis[];
  procedures: EKlaimRMProcedure[];
  orders: EKlaimRMOrder[];
  medicine_items: EKlaimRMMedicineItem[];
  cppt_notes: EKlaimRMCPPT[];
  nursing_cares: EKlaimRMNursingCare[];
  fluid_balances: EKlaimRMFluidBalance[];
  billing?: EKlaimRMBilling;

  // Tarif (18-field E-Klaim breakdown)
  tarif_prosedur_non_bedah: number;
  tarif_prosedur_bedah: number;
  tarif_konsultasi: number;
  tarif_tenaga_ahli: number;
  tarif_keperawatan: number;
  tarif_penunjang: number;
  tarif_radiologi: number;
  tarif_laboratorium: number;
  tarif_pelayanan_darah: number;
  tarif_rehabilitasi: number;
  tarif_kamar: number;
  tarif_rawat_intensif: number;
  tarif_obat: number;
  tarif_obat_kronis: number;
  tarif_obat_kemoterapi: number;
  tarif_alkes: number;
  tarif_bmhp: number;
  tarif_sewa_alat: number;
  total_tarif: number;

  // Inpatient-specific fields
  admission_date: string;
  discharge_date: string;
  length_of_stay: number;
  accommodation_tariff_per_day: number;

  duplicated_at?: string;
  duplicated_by?: any;

  // Triage UGD
  has_triage: boolean;
  triage_arrival_mode: string;
  triage_complaint: string;
  triage_level: string;
  triage_airway: string;
  triage_airway_note: string;
  triage_breathing: string;
  triage_breathing_note: string;
  triage_circulation: string;
  triage_circulation_note: string;
  triage_blood_pressure: string;
  triage_heart_rate: string;
  triage_respiratory_rate: string;
  triage_temperature: string;
  triage_oxygen_saturation: string;
  triage_pain_scale: number;
  triage_gcs_e: number;
  triage_gcs_v: number;
  triage_gcs_m: number;
  triage_assessment: string;
  triage_immediate_actions: string;
}

export interface EKlaimRMDiagnosis {
  id?: number;
  rm_duplicate_id?: number;
  icd10_code: string;
  icd10_name: string;
  type: 'primary' | 'secondary' | 'complication';
  sequence: number;
}

export interface EKlaimRMProcedure {
  id?: number;
  rm_duplicate_id?: number;
  icd9_code: string;
  name: string;
  multiplicity: number;
  setting: string;
  sequence: number;
}

export interface EKlaimRMOrder {
  id?: number;
  rm_duplicate_id?: number;
  order_type: 'laboratory' | 'radiology' | 'surgery' | 'consultation' | 'pharmacy';
  source_order_id?: number;
  order_number: string;
  priority: string;
  clinical_notes: string;
  diagnosis: string;
  notes: string;

  // Order-level results (radiology/surgery)
  result_summary: string;
  conclusion: string;
  suggestion: string;
  is_critical: boolean;
  critical_notes: string;

  // Consultation-specific (SOAP)
  consultant_name: string;
  specialty: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  recommendation: string;
  consultation_fee: number;

  // Surgery-specific
  surgeon_name: string;
  anesthesia_type: string;
  scheduled_date?: string;

  // Fake order support
  is_fake: boolean;
  fake_date?: string;

  // Items within this order
  items: EKlaimRMOrderItem[];

  sequence: number;
}

export interface EKlaimRMOrderItem {
  id?: number;
  eklaim_rm_order_id?: number;
  procedure_id: number;
  procedure?: {
    id: number;
    name: string;
    code: string;
    parameters?: ProcedureParameterRef[];
  };
  procedure_name: string;
  source_item_id?: number;
  notes: string;
  results: EKlaimRMOrderResult[];
  sequence: number;
}

export interface EKlaimRMOrderResult {
  id?: number;
  eklaim_rm_order_item_id?: number;
  procedure_parameter_id: number;
  procedure_parameter?: ProcedureParameterRef;
  parameter_name: string;
  source_result_id?: number;
  value: string;
  numeric_value: number;
  is_normal: boolean;
  is_low: boolean;
  is_high: boolean;
  is_critical: boolean;
  notes: string;
  sequence: number;
}

// Reference to ProcedureParameter (from master table — used for dynamic rendering)
export interface ProcedureParameterRef {
  id: number;
  name: string;
  code?: string;
  input_type: string;
  unit: string;
  options?: string;
  normal_min?: number;
  normal_max?: number;
  normal_text?: string;
  critical_min?: number;
  critical_max?: number;
  decimal_places?: number;
  is_required?: boolean;
  sort_order?: number;
}

export interface EKlaimRMMedicineItem {
  id?: number;
  rm_duplicate_id?: number;
  medicine_id?: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    selling_price: number;
  };
  medicine_name: string;
  dosage: string;
  frequency: string;
  route: string;
  quantity: number;
  unit: string;
  duration: string;
  instructions: string;
  unit_price: number;
  sub_total: number;
  is_fake: boolean;
  fake_date?: string;
  notes: string;
  sequence: number;
}

export interface EKlaimRMCPPT {
  id?: number;
  rm_duplicate_id?: number;
  record_date: string;
  profession: string;
  cppt_format?: "soap" | "sbar" | "tbak";
  staff_name: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  instruction: string;
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  pain_scale?: number;
  is_fake: boolean;
  notes: string;
  sequence: number;
  created_by_name?: string;
  approved_by_name?: string;
}

export interface EKlaimRMFluidBalance {
  id?: number;
  rm_duplicate_id?: number;
  record_date: string;
  shift_type: string;
  staff_name: string;
  oral_drink: number;
  oral_food: number;
  oral_medicine: number;
  iv_fluid: number;
  iv_medicine: number;
  blood_product: number;
  enteral_feed: number;
  other_intake: number;
  urine_amount: number;
  feces_amount: number;
  vomit_amount: number;
  drain_amount: number;
  blood_loss: number;
  iwl: number;
  other_output: number;
  total_intake: number;
  total_output: number;
  balance: number;
  is_fake: boolean;
  notes: string;
  sequence: number;
  created_by_name?: string;
  approved_by_name?: string;
}

export interface EKlaimRMNursingCare {
  id?: number;
  rm_duplicate_id?: number;
  record_date: string;
  shift_type: string;
  staff_name: string;
  chief_complaint: string;
  pain_assessment: string;
  pain_scale?: number;
  consciousness_level: string;
  functional_status: string;
  fall_risk_assessment: string;
  fall_risk_score?: number;
  nutrition_assessment: string;
  skin_assessment: string;
  pressure_ulcer_risk: string;
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: string;
  oxygen_saturation?: number;
  nursing_diagnosis: string;
  nursing_diagnosis_code: string;
  problem_etiology: string;
  signs_symptoms: string;
  nursing_outcome: string;
  nursing_outcome_code: string;
  outcome_indicators: string;
  outcome_target: string;
  nursing_intervention: string;
  nursing_intervention_code: string;
  observation_actions: string;
  therapeutic_actions: string;
  education_actions: string;
  collaboration_actions: string;
  implementation: string;
  implementation_time: string;
  patient_response: string;
  evaluation_subjective: string;
  evaluation_objective: string;
  evaluation_analysis: string;
  evaluation_planning: string;
  problem_status: string;
  is_fake: boolean;
  notes: string;
  sequence: number;
  created_by_name?: string;
  approved_by_name?: string;
}

export interface EKlaimRMBilling {
  id: number;
  rm_duplicate_id: number;
  total_amount: number;
  discount_amount: number;
  discount_reason: string;
  adjust_amount: number;
  adjust_reason: string;
  final_amount: number;
  remaining_amount: number;
  paid_amount: number;
  notes: string;
  items?: EKlaimRMBillingItem[];
  created_at: string;
  updated_at: string;
}

export interface EKlaimRMBillingItem {
  id: number;
  eklaim_rm_billing_id: number;
  item_type: string; // 'procedure' | 'medicine'
  reference_id: number;
  reference_type: string; // 'order_item' | 'medicine_item'
  reference_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  performed_by_id?: number;
  performed_by_name: string;
  performed_by_role: string;
  notes: string;
  sequence: number;
}

export interface EKlaimLocalLog {
  id: number;
  eklaim_local_id: number;
  method: string;
  request_body?: string;
  response_code?: string;
  response_body?: string;
  response_time_ms: number;
  is_success: boolean;
  error_message?: string;
  user_id?: number;
  user?: any;
  created_at: string;
}

export interface SEPWithClaim extends SEPData {
  eklaim_local?: EKlaimLocal;
}

// ==================== ORIGINAL RM TYPES ====================

export interface OriginalRM {
  anamnesis?: OriginalAnamnesis;
  physical_examination?: OriginalPhysicalExam;
  diagnoses?: OriginalDiagnosis[];
  assessment_plan?: OriginalAssessmentPlan;
  disposition?: OriginalDisposition;
  lab_orders?: OriginalProcedureOrder[];
  radiology_orders?: OriginalProcedureOrder[];
  surgery_orders?: OriginalProcedureOrder[];
  consultation_orders?: OriginalProcedureOrder[];
  medicine_orders?: OriginalMedicineOrder[];
  triage?: OriginalTriage;
  // Document availability counts
  nursing_care_count?: number;
  cppt_with_vitals_count?: number;
  bed_transfer_count?: number;
  cppt_count?: number;
  fluid_balance_count?: number;
}

export interface OriginalTriage {
  id: number;
  arrival_mode?: string;
  triage_complaint?: string;
  triage_level?: string;
  airway?: string;
  airway_note?: string;
  breathing?: string;
  breathing_note?: string;
  circulation?: string;
  circulation_note?: string;
  blood_pressure?: string;
  heart_rate?: string;
  breathing_rate?: string;
  temperature?: string;
  oxygen_saturation?: string;
  pain_scale?: number;
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  consciousness?: string;
  triage_assessment?: string;
  immediate_actions?: string;
}

export interface OriginalAnamnesis {
  id: number;
  chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  family_history?: string;
  social_history?: string;
  allergies?: string;
  current_medications?: string;
  review_of_systems?: string;
  recorded_by?: any;
}

export interface OriginalPhysicalExam {
  id: number;
  general_condition?: string;
  consciousness?: string;
  blood_pressure?: string;
  systolic?: number;
  diastolic?: number;
  heart_rate?: string;
  respiratory_rate?: string;
  temperature?: string;
  oxygen_saturation?: string;
  weight?: string;
  height?: string;
  bmi?: number;
  head_neck?: string;
  eyes?: string;
  ent?: string;
  thorax?: string;
  cardiac?: string;
  pulmonary?: string;
  abdomen?: string;
  extremities?: string;
  skin?: string;
  neurological?: string;
  musculoskel?: string;
  genitourinary?: string;
  other_findings?: string;
  examined_by?: any;
}

export interface OriginalDiagnosis {
  id: number;
  icd10_code: string;
  icd10_name: string;
  type: string;
  clinical_status?: string;
  verification_status?: string;
  severity?: string;
  note?: string;
  diagnosed_by?: any;
}

export interface OriginalAssessmentPlan {
  id: number;
  clinical_assessment?: string;
  prognosis?: string;
  treatment_plan?: string;
  medication_plan?: string;
  diet_plan?: string;
  activity_plan?: string;
  education_plan?: string;
  monitoring_plan?: string;
  procedure_plan?: string;
  consultation_plan?: string;
  assessed_by?: any;
}

export interface OriginalDisposition {
  id: number;
  disposition_type: string;
  disposition_note?: string;
  discharge_status?: string;
  discharge_condition?: string;
  discharge_instruction?: string;
  discharge_medication?: string;
  follow_up_date?: string;
  follow_up_instruction?: string;
  referral_facility?: string;
  referral_reason?: string;
  discharged_by?: any;
}

export interface OriginalProcedureOrder {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  priority: string;
  clinical_notes?: string;
  diagnosis?: string;
  result_summary?: string;
  conclusion?: string;
  suggestion?: string;
  is_critical: boolean;
  critical_notes?: string;
  items?: OriginalProcedureOrderItem[];
  performed_by?: any;
  validated_by?: any;
  surgeon_doctor?: any;
  consultation?: { id: number; consultant?: any; subjective?: string; objective?: string; assessment?: string; plan?: string; recommendation?: string };
  completed_at?: string;
}

export interface OriginalProcedureOrderItem {
  id: number;
  procedure?: { id: number; name: string; code?: string };
  notes?: string;
  results?: OriginalProcedureOrderResult[];
}

export interface OriginalProcedureOrderResult {
  id: number;
  value?: string;
  procedure_parameter?: { id: number; name: string; unit?: string; normal_min?: number; normal_max?: number; normal_text?: string };
  is_normal?: boolean;
  is_low?: boolean;
  is_high?: boolean;
  is_critical?: boolean;
}

export interface OriginalMedicineOrder {
  id: number;
  order_number: string;
  prescription_type?: string;
  status: string;
  notes?: string;
  items?: OriginalMedicineOrderItem[];
  ordered_by?: any;
}

export interface OriginalMedicineOrderItem {
  id: number;
  medicine?: { id: number; name: string; code?: string; form?: string; strength?: string };
  quantity: number;
  dispensed_qty?: number;
  status?: string;
  unit?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  instructions?: string;
}

export interface EKlaimDetailResponse {
  data: EKlaimLocal;
  original_rm: OriginalRM;
}

// ==================== LABELS ====================

export const eklaimLocalStatusLabels: Record<EKlaimLocalStatus, string> = {
  draft: 'Draft',
  new_claim: 'New Claim',
  set_claim_data: 'Data Terisi',
  idrg_coded: 'iDRG Coded',
  idrg_grouped: 'iDRG Grouped',
  idrg_final: 'iDRG Final',
  inacbg_imported: 'INACBG Imported',
  inacbg_coded: 'INACBG Coded',
  inacbg_grouped: 'INACBG Grouped',
  inacbg_final: 'INACBG Final',
  claim_final: 'Claim Final',
  claim_sent: 'Terkirim',
  // Legacy
  grouped: 'Grouped',
  finalized: 'Final',
  sent: 'Terkirim',
};

export const eklaimLocalStatusColors: Record<EKlaimLocalStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  new_claim: 'bg-blue-100 text-blue-800',
  set_claim_data: 'bg-purple-100 text-purple-800',
  idrg_coded: 'bg-indigo-100 text-indigo-800',
  idrg_grouped: 'bg-indigo-200 text-indigo-900',
  idrg_final: 'bg-cyan-100 text-cyan-800',
  inacbg_imported: 'bg-teal-100 text-teal-800',
  inacbg_coded: 'bg-teal-200 text-teal-900',
  inacbg_grouped: 'bg-orange-100 text-orange-800',
  inacbg_final: 'bg-amber-100 text-amber-800',
  claim_final: 'bg-green-100 text-green-800',
  claim_sent: 'bg-green-600 text-white',
  // Legacy
  grouped: 'bg-orange-100 text-orange-800',
  finalized: 'bg-green-100 text-green-800',
  sent: 'bg-green-600 text-white',
};

export const caraMasukOptions = [
  { value: 'gp', label: 'Rujukan FKTP (GP)' },
  { value: 'hosp-trans', label: 'Rujukan FKRTL (Transfer RS)' },
  { value: 'mp', label: 'Rujukan Spesialis' },
  { value: 'outp', label: 'Dari Rawat Jalan' },
  { value: 'inp', label: 'Dari Rawat Inap' },
  { value: 'emd', label: 'Dari Rawat Darurat (IGD)' },
  { value: 'born', label: 'Lahir di RS' },
  { value: 'nursing', label: 'Rujukan Panti Jompo' },
  { value: 'psych', label: 'Rujukan RS Jiwa' },
  { value: 'rehab', label: 'Rujukan Fasilitas Rehab' },
  { value: 'other', label: 'Lain-lain' },
];

export const jenisRawatOptions = [
  { value: '1', label: 'Rawat Inap' },
  { value: '2', label: 'Rawat Jalan' },
  { value: '3', label: 'IGD' },
];

export const kelasRawatOptions = [
  { value: '1', label: 'Kelas 1' },
  { value: '2', label: 'Kelas 2' },
  { value: '3', label: 'Kelas 3' },
];

export const dischargeStatusOptions = [
  { value: '1', label: 'Atas Persetujuan Dokter' },
  { value: '2', label: 'Dirujuk' },
  { value: '3', label: 'Atas Permintaan Sendiri' },
  { value: '4', label: 'Meninggal' },
  { value: '5', label: 'Lain-lain' },
  { value: '7', label: 'Meninggal > 48 Jam' },
  { value: '8', label: 'Meninggal < 48 Jam' },
  { value: '9', label: 'Pulang Paksa/Melarikan Diri' },
];

export const kodeTarifOptions = [
  { value: 'AP', label: 'AP - RS Kelas A Pemerintah' },
  { value: 'AS', label: 'AS - RS Kelas A Swasta' },
  { value: 'BP', label: 'BP - RS Kelas B Pemerintah' },
  { value: 'BS', label: 'BS - RS Kelas B Swasta' },
  { value: 'CP', label: 'CP - RS Kelas C Pemerintah' },
  { value: 'CS', label: 'CS - RS Kelas C Swasta' },
  { value: 'DP', label: 'DP - RS Kelas D Pemerintah' },
  { value: 'DS', label: 'DS - RS Kelas D Swasta' },
  { value: 'RSCM', label: 'RSCM - RSUPN Cipto Mangunkusumo' },
  { value: 'RSJP', label: 'RSJP - RSJPD Harapan Kita' },
  { value: 'RSD', label: 'RSD - RS Kanker Dharmais' },
  { value: 'RSAB', label: 'RSAB - RSAB Harapan Kita' },
];

export const payorOptions = [
  { value: '3', label: 'JKN', cd: 'JKN' },
  { value: '78', label: 'Jaminan KK/PAK (JKKPAK)', cd: 'JKKPAK' },
  { value: '77', label: 'Jaminan Pemulihan Kesehatan Prioritas (JPKP)', cd: 'JPKP' },
  { value: '76', label: 'Jampersal (JPS)', cd: 'JPS' },
  { value: '71', label: 'Jaminan COVID-19', cd: 'COVID-19' },
  { value: '72', label: 'Jaminan KIPI', cd: 'KIPI' },
  { value: '73', label: 'Jaminan Bayi Baru Lahir (BBL)', cd: 'BBL' },
  { value: '74', label: 'Jaminan Perpanjangan Masa Rawat (PMR)', cd: 'PMR' },
  { value: '75', label: 'Jaminan Co-Insidense (CO-INS)', cd: 'CO-INS' },
];

export const upgradeClassClassOptions = [
  { value: 'kelas_1', label: 'Kelas 1' },
  { value: 'kelas_2', label: 'Kelas 2' },
  { value: 'vip', label: 'VIP' },
];

export const upgradeClassPayorOptions = [
  { value: 'peserta', label: 'Peserta' },
  { value: 'pemberi_kerja', label: 'Pemberi Kerja' },
  { value: 'asuransi_tambahan', label: 'Asuransi Tambahan' },
];

export const nomorKartuTOptions = [
  { value: 'nik', label: 'NIK' },
  { value: 'kitas', label: 'KITAS/KITAP' },
  { value: 'paspor', label: 'Paspor' },
  { value: 'kartu_jkn', label: 'Kartu JKN (BPJS)' },
  { value: 'kk', label: 'Kartu Keluarga' },
  { value: 'unhcr', label: 'Dokumen UNHCR' },
  { value: 'kelurahan', label: 'Dokumen Kelurahan' },
  { value: 'dinsos', label: 'Dokumen Dinas Sosial' },
  { value: 'dinkes', label: 'Dokumen Dinas Kesehatan' },
  { value: 'sjp', label: 'Surat Jaminan Perawatan (SJP)' },
  { value: 'klaim_ibu', label: 'Klaim Ibu (Mandatori BBL)' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const bayiLahirStatusOptions = [
  { value: 1, label: 'Tanpa Kelainan' },
  { value: 2, label: 'Dengan Kelainan' },
];

export const onsetKontraksiOptions = [
  { value: 'spontan', label: 'Spontan' },
  { value: 'induksi', label: 'Induksi' },
  { value: 'non_spontan_non_induksi', label: 'Non Spontan Non Induksi' },
];

export const deliveryMethodOptions = [
  { value: 'vaginal', label: 'Vaginal' },
  { value: 'sc', label: 'Sectio Caesarea (SC)' },
];

export const letakJaninOptions = [
  { value: 'kepala', label: 'Kepala' },
  { value: 'sungsang', label: 'Sungsang' },
  { value: 'lintang', label: 'Lintang' },
];

export const kondisiBayiOptions = [
  { value: 'livebirth', label: 'Lahir Hidup (Livebirth)' },
  { value: 'stillbirth', label: 'Lahir Mati (Stillbirth)' },
];

export const shkLokasiOptions = [
  { value: 'tumit', label: 'Tumit' },
  { value: 'vena', label: 'Vena' },
];

export const shkAlasanOptions = [
  { value: 'tidak-dapat', label: 'Tidak Dapat' },
  { value: 'akses-sulit', label: 'Akses Sulit' },
];

// ==================== API ====================

export interface DashboardData {
  bulan: string;
  tgl_from: string;
  tgl_to: string;
  total_claims: number;
  status_counts: { status: EKlaimLocalStatus; count: number }[];
  jenis_rawat_counts: { jenis_rawat: string; count: number }[];
  kelas_rawat_counts: { kelas_rawat: string; count: number }[];
  financial: {
    total_inacbg_tariff: number;
    total_tarif_rs: number;
    avg_inacbg_tariff: number;
    avg_tarif_rs: number;
    claim_count: number;
  };
  recent_claims: {
    id: number;
    no_sep: string;
    nama_pasien: string;
    status: EKlaimLocalStatus;
    jenis_rawat: string;
    kelas_rawat: string;
    tgl_masuk: string;
    tgl_pulang: string;
    inacbg_cbg_code: string;
    inacbg_tariff: string;
    tarif_rs: number;
    created_at: string;
  }[];
  top_cbg: {
    cbg_code: string;
    cbg_description: string;
    count: number;
    total_tariff: number;
  }[];
  daily_claims: { date: string; count: number; total_inacbg: number; total_tarif_rs: number }[];
  pending_actions: {
    draft: number;
    new_claim: number;
    pending_grouper: number;
    pending_final: number;
    pending_send: number;
  };
}

export const eklaimLocalApi = {
  // Dashboard
  getDashboard: async (bulan?: string): Promise<DashboardData> => {
    const response = await api.get('/eklaim-local/dashboard', { params: bulan ? { bulan } : {} });
    return response.data;
  },

  // Ping server
  ping: async () => {
    const response = await api.get('/eklaim-local/ping');
    return response.data;
  },

  // ========= List SEP =========
  getListSEP: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    tgl_from?: string;
    tgl_to?: string;
    claim_status?: string;
    jns_pelayanan?: string;
  }) => {
    const response = await api.get('/eklaim-local/list-sep', { params });
    return response.data;
  },

  getSEPDetail: async (sepId: number) => {
    const response = await api.get(`/eklaim-local/list-sep/${sepId}`);
    return response.data;
  },

  duplicateRM: async (sepId: number) => {
    const response = await api.post(`/eklaim-local/list-sep/${sepId}/duplicate-rm`);
    return response.data;
  },

  createClaim: async (sepId: number, data: {
    nomor_kartu: string;
    nomor_sep: string;
    nomor_rm: string;
    nama_pasien: string;
    tgl_lahir: string;
    gender: number;
  }) => {
    const response = await api.post(`/eklaim-local/list-sep/${sepId}/create-claim`, data);
    return response.data;
  },

  // ========= E-Klaim Local =========
  getList: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    jenis_rawat?: string;
    kelas_rawat?: string;
    tgl_from?: string;
    tgl_to?: string;
  }) => {
    const response = await api.get('/eklaim-local', { params });
    return response.data;
  },

  getDetail: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}`);
    return response.data;
  },

  initRMDuplicate: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/init-rm-duplicate`);
    return response.data;
  },

  updateRMDuplicate: async (id: number, data: Partial<Omit<EKlaimRMDuplicate, 'id' | 'eklaim_local_id' | 'visit_id' | 'total_tarif' | 'duplicated_at' | 'duplicated_by' | 'original_diagnoses_json' | 'original_procedures_json' | 'original_tarif_json' | 'original_rm_json'>>) => {
    const response = await api.put(`/eklaim-local/${id}/rm-duplicate`, data);
    return response.data;
  },

  updateRMDuplicateAnamnesis: async (id: number, data: {
    anamnesis_source?: string;
    functional_status?: string;
    chief_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: string;
    family_history?: string;
    social_history?: string;
    allergies?: string;
    current_medications?: string;
    review_of_systems?: string;
  }) => {
    const response = await api.put(`/eklaim-local/${id}/rm-duplicate/anamnesis`, data);
    return response.data;
  },

  syncRMFromVisit: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/sync-rm-from-visit`);
    return response.data;
  },

  syncPharmacyFromVisit: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/sync-pharmacy-from-visit`);
    return response.data;
  },

  syncPharmacyOrderFromVisit: async (id: number, sourceOrderId: number) => {
    const response = await api.post(`/eklaim-local/${id}/sync-pharmacy-order-from-visit`, {
      source_order_id: sourceOrderId,
    });
    return response.data;
  },

  createPharmacyOrder: async (id: number, data?: { prescriber_id?: number; order_date?: string }) => {
    const response = await api.post(`/eklaim-local/${id}/create-pharmacy-order`, data || {});
    return response.data;
  },

  syncBillingTarif: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/sync-billing-tarif`);
    return response.data;
  },

  recalculateRMDuplicateBilling: async (eklaimId: number, rmDuplicateId: number) => {
    const response = await api.post(`/eklaim-local/${eklaimId}/rm-duplicate/${rmDuplicateId}/recalculate-billing`);
    return response.data;
  },

  // ========= API Calls to E-Klaim Server =========
  sendNewClaim: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/new-claim`);
    return response.data;
  },

  sendUpdatePatient: async (id: number, data?: {
    nomor_kartu?: string;
    nomor_rm?: string;
    nama_pasien?: string;
    tgl_lahir?: string;
    gender?: number;
  }) => {
    const response = await api.post(`/eklaim-local/${id}/update-patient`, data || {});
    return response.data;
  },

  sendSetClaimData: async (id: number, data: any) => {
    const response = await api.post(`/eklaim-local/${id}/set-claim-data`, data);
    return response.data;
  },

  sendGrouper: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/grouper`);
    return response.data;
  },

  sendFinal: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/final`);
    return response.data;
  },

  sendCancel: async (id: number, reason: string) => {
    const response = await api.post(`/eklaim-local/${id}/cancel`, { reason });
    return response.data;
  },

  deleteClaim: async (id: number) => {
    const response = await api.delete(`/eklaim-local/${id}/delete-claim`);
    return response.data;
  },

  sendReedit: async (id: number, data: { diagnosa: string; procedure: string; reason: string }) => {
    const response = await api.post(`/eklaim-local/${id}/reedit`, data);
    return response.data;
  },

  getClaimData: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/claim-data`);
    return response.data;
  },

  getClaimPrint: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/claim-print`);
    return response.data;
  },

  syncClaimDataFromEKlaim: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/sync-claim-data`);
    return response.data;
  },

  // ========= iDRG Flow =========
  sendIDRGDiagnosaSet: async (id: number, data: { diagnosa: string }) => {
    const response = await api.post(`/eklaim-local/${id}/idrg-diagnosa`, data);
    return response.data;
  },

  getIDRGDiagnosa: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/idrg-diagnosa`);
    return response.data;
  },

  sendIDRGProcedureSet: async (id: number, data: { procedure: string }) => {
    const response = await api.post(`/eklaim-local/${id}/idrg-procedure`, data);
    return response.data;
  },

  getIDRGProcedure: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/idrg-procedure`);
    return response.data;
  },

  sendGrouperIDRG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/grouper-idrg`);
    return response.data;
  },

  sendFinalIDRG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/final-idrg`);
    return response.data;
  },

  sendReeditIDRG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/reedit-idrg`);
    return response.data;
  },

  // ========= INACBG Flow =========
  sendImportINACBG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/import-inacbg`);
    return response.data;
  },

  sendINACBGDiagnosaSet: async (id: number, data: { diagnosa: string }) => {
    const response = await api.post(`/eklaim-local/${id}/inacbg-diagnosa`, data);
    return response.data;
  },

  getINACBGDiagnosa: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/inacbg-diagnosa`);
    return response.data;
  },

  sendINACBGProcedureSet: async (id: number, data: { procedure: string }) => {
    const response = await api.post(`/eklaim-local/${id}/inacbg-procedure`, data);
    return response.data;
  },

  getINACBGProcedure: async (id: number) => {
    const response = await api.get(`/eklaim-local/${id}/inacbg-procedure`);
    return response.data;
  },

  sendGrouperINACBGStage1: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/grouper-inacbg-stage1`);
    return response.data;
  },

  sendGrouperINACBGStage2: async (id: number, data: { special_cmg: string }) => {
    const response = await api.post(`/eklaim-local/${id}/grouper-inacbg-stage2`, data);
    return response.data;
  },

  sendFinalINACBG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/final-inacbg`);
    return response.data;
  },

  sendReeditINACBG: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/reedit-inacbg`);
    return response.data;
  },

  // ========= Claim Send & Re-edit =========
  sendClaimSend: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/send-claim`);
    return response.data;
  },

  sendClaimReedit: async (id: number) => {
    const response = await api.post(`/eklaim-local/${id}/reedit-claim`);
    return response.data;
  },

  // ========= Search APIs =========
  searchDiagnosisIDRG: async (keyword: string) => {
    const response = await api.get('/eklaim-local/search/idrg-diagnosa', { params: { keyword } });
    return response.data;
  },

  searchProceduresIDRG: async (keyword: string) => {
    const response = await api.get('/eklaim-local/search/idrg-procedure', { params: { keyword } });
    return response.data;
  },

  searchDiagnosisINACBG: async (keyword: string) => {
    const response = await api.get('/eklaim-local/search/inacbg-diagnosa', { params: { keyword } });
    return response.data;
  },

  searchProceduresINACBG: async (keyword: string) => {
    const response = await api.get('/eklaim-local/search/inacbg-procedure', { params: { keyword } });
    return response.data;
  },

  // ========= Report =========
  getClaimStatus: async (params: {
    tgl_masuk_from: string;
    tgl_masuk_to: string;
    jenis_rawat?: string;
    status?: string;
  }) => {
    const response = await api.get('/eklaim-local/claim-status', { params });
    return response.data;
  },

  // ========= Logs =========
  getLogs: async (id: number, params?: { page?: number; per_page?: number }) => {
    const response = await api.get(`/eklaim-local/${id}/logs`, { params });
    return response.data;
  },

  getAllLogs: async (params?: {
    page?: number;
    per_page?: number;
    method?: string;
    status?: string;
    search?: string;
  }) => {
    const response = await api.get('/eklaim-local/logs', { params });
    return response.data;
  },

  // ========= Defaults =========
  getDefaults: async (): Promise<{ coder_nik: string; kode_tarif: string }> => {
    const response = await api.get('/eklaim-local/defaults');
    return response.data;
  },

  // === Casemix RM Standalone ===
  getCasemixRM: (visitId: number) =>
    api.get(`/eklaim-local/casemix-rm/${visitId}`).then((res) => res.data),

  updateCasemixAnamnesis: (visitId: number, data: any) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/anamnesis`, data).then((res) => res.data),

  updateCasemixTriage: (visitId: number, data: Record<string, unknown>) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/triage`, data).then((res) => res.data),

  updateCasemixPhysicalExam: (visitId: number, data: Record<string, unknown>) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/physical-exam`, data).then((res) => res.data),

  updateCasemixAssessmentPlan: (visitId: number, data: Record<string, unknown>) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/assessment-plan`, data).then((res) => res.data),

  updateCasemixDisposition: (visitId: number, data: Record<string, unknown>) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/disposition`, data).then((res) => res.data),

  // Diagnoses
  addCasemixDiagnosis: (visitId: number, data: Record<string, unknown>) =>
    api.post(`/eklaim-local/casemix-rm/${visitId}/diagnoses`, data).then((res) => res.data),

  removeCasemixDiagnosis: (visitId: number, diagId: number) =>
    api.delete(`/eklaim-local/casemix-rm/${visitId}/diagnoses/${diagId}`).then((res) => res.data),

  updateCasemixDiagnoses: (visitId: number, diagnoses: Record<string, unknown>[]) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/diagnoses`, diagnoses).then((res) => res.data),

  // Procedures
  addCasemixProcedure: (visitId: number, data: Record<string, unknown>) =>
    api.post(`/eklaim-local/casemix-rm/${visitId}/procedures`, data).then((res) => res.data),

  removeCasemixProcedure: (visitId: number, procId: number) =>
    api.delete(`/eklaim-local/casemix-rm/${visitId}/procedures/${procId}`).then((res) => res.data),

  updateCasemixProcedures: (visitId: number, procedures: Record<string, unknown>[]) =>
    api.put(`/eklaim-local/casemix-rm/${visitId}/procedures`, procedures).then((res) => res.data),
};

