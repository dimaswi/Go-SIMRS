import { api } from './client';

// V2 - Separated table interfaces
export interface Triage {
  id: number;
  visit_id: number;
  triage_level?: string;
  arrival_mode?: string;
  triage_complaint?: string;
  // ABC Assessment
  airway?: string;
  airway_note?: string;
  breathing?: string;
  breathing_note?: string;
  circulation?: string;
  circulation_note?: string;
  // Vital Signs for Triage
  blood_pressure?: string;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  oxygen_saturation?: number;
  // Consciousness
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  // Pain & Assessment
  pain_scale?: number;
  triage_assessment?: string;
  immediate_actions?: string;
  // Tracking
  created_by_id?: number;
  updated_by_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Anamnesis {
  id: number;
  visit_id: number;
  chief_complaint?: string;
  history_of_present_illness?: string;
  onset?: string;
  duration?: string;
  severity?: string;
  location?: string;
  character?: string;
  aggravating_factors?: string;
  relieving_factors?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  family_history?: string;
  social_history?: string;
  smoking_status?: string;
  alcohol_use?: string;
  drug_use?: string;
  allergies?: string;
  allergy_type?: string;
  allergy_reaction?: string;
  current_medications?: string;
  immunization_history?: string;
  menstrual_history?: string;
  obstetric_history?: string;
  review_of_systems?: string;
  created_by_id?: number;
  updated_by_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PhysicalExam {
  id: number;
  visit_id: number;
  general_condition?: string;
  consciousness?: string;
  // Vital Signs (from backend - can be string or number)
  blood_pressure?: string;
  systolic?: number;
  diastolic?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: string | number;
  respiratory_rate?: string | number;
  temperature?: string | number;
  oxygen_saturation?: string | number;
  weight?: string | number;
  height?: string | number;
  bmi?: number;
  // Systemic Examination (new fields)
  head?: string;
  eyes?: string;
  ears?: string;
  nose?: string;
  throat?: string;
  neck?: string;
  chest?: string;
  heart?: string;
  lungs?: string;
  abdomen?: string;
  extremities?: string;
  skin?: string;
  neurological?: string;
  genitourinary?: string;
  other_findings?: string;
  // Legacy fields from backend
  head_neck?: string;
  ent?: string;
  thorax?: string;
  cardiac?: string;
  pulmonary?: string;
  musculoskel?: string;
  // Extra fields
  liver?: string;
  spleen?: string;
  lymph_nodes?: string;
  mental_status?: string;
  cranial_nerves?: string;
  motor?: string;
  sensory?: string;
  reflexes?: string;
  musculoskeletal?: string;
  created_by_id?: number;
  updated_by_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DiagnosisItem {
  id?: number;
  diagnosis_id?: number;
  icd10_code: string;
  icd10_name: string;
  diagnosis_type: 'primary' | 'secondary' | 'differential';
  clinical_status?: string;
  verification_status?: string;
  severity?: string;
  body_site?: string;
  onset_date?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Diagnosis {
  id: number;
  visit_id: number;
  clinical_impression?: string;
  differential_diagnosis?: string;
  items?: DiagnosisItem[];
  created_by_id?: number;
  updated_by_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentPlan {
  id: number;
  visit_id: number;
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
  created_by_id?: number;
  updated_by_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Disposition {
  id: number;
  visit_id: number;
  disposition_type?: string;
  disposition_note?: string;
  discharge_status?: string;
  discharge_condition?: string;
  // Discharge instructions
  discharge_instruction?: string;
  discharge_medication?: string;
  // For referral
  referral_facility?: string;
  referral_reason?: string;
  referral_urgency?: string;
  // For admission / rawat inap
  admission_type?: string;
  admission_ward?: string;
  admission_reason?: string;
  admission_room_id?: number;
  admission_bed_id?: number;
  admission_room?: { id: number; name: string; code: string };
  admission_bed?: { id: number; bed_number: string };
  // For death
  death_time?: string;
  death_cause?: string;
  // Follow-up / Kontrol
  follow_up_date?: string;
  follow_up_instruction?: string;
  follow_up_room_id?: number;
  follow_up_room?: { id: number; name: string; code: string };
  // Created records
  inpatient_visit_id?: number;
  follow_up_registration_id?: number;
  // Audit
  discharged_by_id?: number;
  discharged_by?: { id: number; name: string };
  created_at?: string;
  updated_at?: string;
}

export interface MedicalRecordSummary {
  triage?: Triage;
  anamnesis?: Anamnesis;
  physical_exam?: PhysicalExam;
  diagnosis?: Diagnosis;
  assessment_plan?: AssessmentPlan;
  disposition?: Disposition;
}

// Legacy interface for backward compatibility
export interface MedicalRecord {
  id: number;
  visit_id: number;
  // Triage
  triage_level?: string;
  arrival_mode?: string;
  triage_complaint?: string;
  airway?: string;
  breathing?: string;
  circulation?: string;
  pain_scale?: number;
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  triage_assessment?: string;
  immediate_actions?: string;
  // Anamnesis
  chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  family_history?: string;
  social_history?: string;
  allergies?: string;
  current_medications?: string;
  // Physical Exam
  general_condition?: string;
  consciousness?: string;
  blood_pressure?: string;
  heart_rate?: string;
  respiratory_rate?: string;
  temperature?: string;
  oxygen_saturation?: string;
  weight?: string;
  height?: string;
  head_neck?: string;
  thorax?: string;
  abdomen?: string;
  extremities?: string;
  neurological?: string;
  other_findings?: string;
  // Relations
  diagnoses?: Array<{
    id: number;
    icd10_code: string;
    icd10_name: string;
    type: 'primary' | 'secondary';
  }>;
}

export const medicalRecordsApi = {
  // Get complete medical record summary for a visit (all sections)
  get: async (visitId: number) => {
    return api.get<MedicalRecordSummary>(`/visits/${visitId}/medical-record`);
  },

  // Triage endpoints
  getTriage: async (visitId: number) => {
    return api.get<Triage>(`/visits/${visitId}/triage`);
  },
  saveTriage: async (visitId: number, data: Partial<Triage>) => {
    return api.post<Triage>(`/visits/${visitId}/triage`, data);
  },

  // Anamnesis endpoints
  getAnamnesis: async (visitId: number) => {
    return api.get<Anamnesis>(`/visits/${visitId}/anamnesis`);
  },
  saveAnamnesis: async (visitId: number, data: Partial<Anamnesis>) => {
    return api.post<Anamnesis>(`/visits/${visitId}/anamnesis`, data);
  },

  // Physical Exam endpoints
  getPhysicalExam: async (visitId: number) => {
    return api.get<PhysicalExam>(`/visits/${visitId}/physical-exam`);
  },
  savePhysicalExam: async (visitId: number, data: Partial<PhysicalExam>) => {
    return api.post<PhysicalExam>(`/visits/${visitId}/physical-exam`, data);
  },

  // Diagnosis endpoints
  getDiagnosis: async (visitId: number) => {
    return api.get<Diagnosis>(`/visits/${visitId}/diagnosis`);
  },
  saveDiagnosis: async (visitId: number, data: Partial<Diagnosis>) => {
    return api.post<Diagnosis>(`/visits/${visitId}/diagnosis`, data);
  },

  // Assessment Plan endpoints
  getAssessmentPlan: async (visitId: number) => {
    return api.get<AssessmentPlan>(`/visits/${visitId}/assessment-plan`);
  },
  saveAssessmentPlan: async (visitId: number, data: Partial<AssessmentPlan>) => {
    return api.post<AssessmentPlan>(`/visits/${visitId}/assessment-plan`, data);
  },

  // Disposition endpoints
  getDisposition: async (visitId: number) => {
    return api.get<Disposition>(`/visits/${visitId}/disposition`);
  },
  saveDisposition: async (visitId: number, data: Partial<Disposition>) => {
    return api.post<Disposition>(`/visits/${visitId}/disposition`, data);
  },
  checkPendingOrders: async (visitId: number) => {
    return api.get<{
      has_pending_orders: boolean;
      pending_medicine_orders: number;
      pending_procedure_orders: number;
      pending_pharmacy_visits: number;
      can_discharge: boolean;
      is_inpatient: boolean;
      visit_type: string;
      registration_type: string;
    }>(`/visits/${visitId}/pending-orders`);
  },
};
