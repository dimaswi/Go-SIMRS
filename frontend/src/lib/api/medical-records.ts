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
  breathing_rate?: string; // Backend field name
  circulation?: string;
  circulation_note?: string;
  // Vital Signs for Triage
  blood_pressure?: string;
  heart_rate?: number | string;
  respiratory_rate?: number; // Frontend field name (alias)
  temperature?: number | string;
  oxygen_saturation?: number | string;
  // Consciousness
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  // Pain & Assessment
  pain_method?: string;
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
  anamnesis_source?: string;
  functional_status?: string;
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
  upper_arm_circum?: string;
  head_circum?: string;
  waist?: string;
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
  // Supporting Examinations - ECG
  ecg_performed?: boolean;
  ecg_result?: string;
  ecg_interpretation?: string;
  ecg_notes?: string;
  // Supporting Examinations - CTG
  ctg_performed?: boolean;
  ctg_result?: string;
  ctg_interpretation?: string;
  ctg_notes?: string;
  // Supporting Examinations - Pelvis
  pelvic_performed?: boolean;
  pelvic_result?: string;
  pelvic_notes?: string;
  // Pain Assessment
  pain_method?: string;
  pain_scale?: number;
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
  informed_consent?: string;
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
  // For referral (Surat Rujukan)
  referral_facility?: string;
  referral_address?: string;
  referral_phone?: string;
  referral_specialist?: string;
  referral_reason?: string;
  referral_urgency?: string;
  referral_diagnosis?: string;
  referral_therapy?: string;
  referral_lab_result?: string;
  referral_notes?: string;
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
  outpatient_room_id?: number
  outpatient_doctor_id?: number
  transfer_reason?: string
  created_at?: string;
  updated_at?: string;
}

export interface SickLetter {
  id: number;
  visit_id: number;
  letter_number?: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  purpose?: string;
  institution?: string;
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeathCertificate {
  id: number;
  visit_id: number;
  certificate_number?: string;
  death_type: string; // doa, dod, inpatient_death
  death_datetime: string;
  death_location?: string;
  primary_cause_code?: string;
  primary_cause_name?: string;
  secondary_cause_code?: string;
  secondary_cause_name?: string;
  underlying_cause_code?: string;
  underlying_cause_name?: string;
  manner_of_death?: string; // natural, accident, suicide, homicide, undetermined, pending
  duration_of_illness?: string;
  autopsy_performed?: boolean;
  autopsy_findings?: string;
  declaring_doctor_id?: number;
  declaring_doctor?: { id: number; nama_lengkap: string };
  declaring_doctor_name?: string;
  witness_name?: string;
  witness_relation?: string;
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HealthCertificate {
  id: number;
  visit_id: number;
  letter_number?: string;
  exam_date: string;
  purpose?: string;
  institution?: string;
  result?: string; // sehat, sehat_dengan_catatan
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BirthCertificate {
  id: number;
  visit_id: number;
  letter_number?: string;
  birth_date: string;
  birth_time?: string;
  baby_name?: string;
  gender: string;
  birth_weight?: number;
  birth_length?: number;
  birth_method?: string;
  mother_name?: string;
  father_name?: string;
  mother_mrn?: string;
  dpjp_name?: string;
  midwife_name?: string;
  apgar_score?: string;
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveCertificate {
  id: number;
  visit_id: number;
  letter_number?: string;
  leave_type: string; // sakit, hamil, melahirkan, lainnya
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  diagnosis?: string;
  institution?: string;
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MCUCertificate {
  id: number;
  visit_id: number;
  letter_number?: string;
  exam_date: string;
  purpose?: string;
  institution?: string;
  conclusion?: string; // layak, tidak_layak, layak_dengan_catatan
  recommendation?: string;
  notes?: string;
  status?: string;
  issued_by_id?: number;
  issued_by?: { id: number; nama_lengkap: string };
  issued_at?: string;
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
  cancelDisposition: async (visitId: number) => {
    return api.delete<{ message: string }>(`/visits/${visitId}/disposition`);
  },
  cancelFollowUpRegistration: async (visitId: number) => {
    return api.delete<{ message: string }>(`/visits/${visitId}/follow-up-registration`);
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

  // Consultation endpoints - untuk visit konsultasi
  getConsultation: async (visitId: number) => {
    return api.get(`/visits/${visitId}/consultation`);
  },
  saveConsultation: async (visitId: number, data: { 
    subjective: string; 
    objective: string; 
    assessment: string; 
    plan: string;
    recommendation?: string;
    notes?: string;
  }) => {
    return api.post(`/visits/${visitId}/consultation`, data);
  },

  // Sick Letter endpoints - Surat Keterangan Sakit
  getSickLetter: async (visitId: number) => {
    return api.get<SickLetter>(`/visits/${visitId}/sick-letter`);
  },
  getSickLetters: async (visitId: number) => {
    return api.get<SickLetter[]>(`/visits/${visitId}/sick-letters`);
  },
  saveSickLetter: async (visitId: number, data: Partial<SickLetter>) => {
    return api.post<SickLetter>(`/visits/${visitId}/sick-letter`, data);
  },
  deleteSickLetter: async (visitId: number, letterId: number) => {
    return api.delete(`/visits/${visitId}/sick-letter/${letterId}`);
  },

  // Death Certificate - Surat Kematian
  getDeathCertificate: async (visitId: number) => {
    return api.get<DeathCertificate>(`/visits/${visitId}/death-certificate`);
  },
  getDeathCertificates: async (visitId: number) => {
    return api.get<DeathCertificate[]>(`/visits/${visitId}/death-certificates`);
  },
  saveDeathCertificate: async (visitId: number, data: Partial<DeathCertificate>) => {
    return api.post<DeathCertificate>(`/visits/${visitId}/death-certificate`, data);
  },
  deleteDeathCertificate: async (visitId: number, certId: number) => {
    return api.delete(`/visits/${visitId}/death-certificate/${certId}`);
  },

  // Health Certificate - Surat Keterangan Sehat
  getHealthCertificates: async (visitId: number) => {
    return api.get<HealthCertificate[]>(`/visits/${visitId}/health-certificates`);
  },
  saveHealthCertificate: async (visitId: number, data: Partial<HealthCertificate>) => {
    return api.post<HealthCertificate>(`/visits/${visitId}/health-certificate`, data);
  },
  deleteHealthCertificate: async (visitId: number, certId: number) => {
    return api.delete(`/visits/${visitId}/health-certificate/${certId}`);
  },

  // Birth Certificate - Surat Keterangan Kelahiran
  getBirthCertificates: async (visitId: number) => {
    return api.get<BirthCertificate[]>(`/visits/${visitId}/birth-certificates`);
  },
  saveBirthCertificate: async (visitId: number, data: Partial<BirthCertificate>) => {
    return api.post<BirthCertificate>(`/visits/${visitId}/birth-certificate`, data);
  },
  deleteBirthCertificate: async (visitId: number, certId: number) => {
    return api.delete(`/visits/${visitId}/birth-certificate/${certId}`);
  },

  // Leave Certificate - Surat Keterangan Cuti
  getLeaveCertificates: async (visitId: number) => {
    return api.get<LeaveCertificate[]>(`/visits/${visitId}/leave-certificates`);
  },
  saveLeaveCertificate: async (visitId: number, data: Partial<LeaveCertificate>) => {
    return api.post<LeaveCertificate>(`/visits/${visitId}/leave-certificate`, data);
  },
  deleteLeaveCertificate: async (visitId: number, certId: number) => {
    return api.delete(`/visits/${visitId}/leave-certificate/${certId}`);
  },

  // MCU Certificate - Medical Check-Up
  getMCUCertificates: async (visitId: number) => {
    return api.get<MCUCertificate[]>(`/visits/${visitId}/mcu-certificates`);
  },
  saveMCUCertificate: async (visitId: number, data: Partial<MCUCertificate>) => {
    return api.post<MCUCertificate>(`/visits/${visitId}/mcu-certificate`, data);
  },
  deleteMCUCertificate: async (visitId: number, certId: number) => {
    return api.delete(`/visits/${visitId}/mcu-certificate/${certId}`);
  },
};
