import { api } from './client';
import type { SnomedMaster } from './loinc';

// ============================================================================
// Patient Allergy Types
// ============================================================================

export interface PatientAllergy {
  id: number;
  patient_id: number;
  visit_id?: number;
  snomed_code: string;
  snomed_display: string;
  category: AllergyCategory;
  criticality: AllergyCriticality;
  notes?: string;
  onset_date?: string;
  recorded_at: string;
  recorded_by?: number;
  satusehat_id?: string;
  satusehat_sent_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  patient?: {
    id: number;
    name: string;
    medical_record_number: string;
  };
  visit?: {
    id: number;
    visit_number: string;
  };
  recorded_by_user?: {
    id: number;
    full_name: string;
  };
}

export type AllergyCategory = 'medication' | 'food' | 'environment' | 'biologic';
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';

export interface AllergyCategoryOption {
  value: AllergyCategory;
  label: string;
}

export interface AllergyCriticalityOption {
  value: AllergyCriticality;
  label: string;
}

export interface AllergyOptions {
  categories: AllergyCategoryOption[];
  criticalities: AllergyCriticalityOption[];
}

export interface CreateAllergyInput {
  patient_id: number;
  visit_id?: number;
  snomed_code: string;
  snomed_display: string;
  category?: AllergyCategory;
  criticality?: AllergyCriticality;
  notes?: string;
}

export interface BulkCreateAllergiesInput {
  patient_id: number;
  visit_id?: number;
  allergies: {
    snomed_code: string;
    snomed_display: string;
    category?: AllergyCategory;
    criticality?: AllergyCriticality;
    notes?: string;
  }[];
}

export interface BulkCreateAllergiesResponse {
  message: string;
  created: PatientAllergy[];
  skipped: string[];
  count: number;
}

// ============================================================================
// Patient Allergy API
// ============================================================================

export const patientAllergyApi = {
  // Get allergy options (categories, criticalities)
  getOptions: () => 
    api.get<AllergyOptions>('/patient-allergies/options'),

  // Search SNOMED CT for allergy
  searchSnomed: (query: string, limit = 20) =>
    api.get<{ data: SnomedMaster[] }>('/patient-allergies/snomed/search', {
      params: { q: query, limit }
    }),

  // Get allergies by patient
  getByPatient: (patientId: number) =>
    api.get<{ data: PatientAllergy[] }>(`/patient-allergies/patient/${patientId}`),

  // Get allergy history by patient (including inactive)
  getHistoryByPatient: (patientId: number) =>
    api.get<{ data: PatientAllergy[] }>(`/patient-allergies/patient/${patientId}/history`),

  // Get active allergies count for patient
  getCountByPatient: (patientId: number) =>
    api.get<{ count: number }>(`/patient-allergies/patient/${patientId}/count`),

  // Get allergies by visit (returns all patient allergies)
  getByVisit: (visitId: number) =>
    api.get<{ data: PatientAllergy[] }>(`/patient-allergies/visit/${visitId}`),

  // Create single allergy
  create: (data: CreateAllergyInput) =>
    api.post<{ message: string; data: PatientAllergy }>('/patient-allergies', data),

  // Create multiple allergies (bulk)
  bulkCreate: (data: BulkCreateAllergiesInput) =>
    api.post<BulkCreateAllergiesResponse>('/patient-allergies/bulk', data),

  // Update allergy
  update: (id: number, data: Partial<PatientAllergy>) =>
    api.put<{ message: string; data: PatientAllergy }>(`/patient-allergies/${id}`, data),

  // Delete allergy (soft delete - sets is_active = false)
  delete: (id: number) =>
    api.delete<{ message: string }>(`/patient-allergies/${id}`),
};

// ============================================================================
// Allergy Category/Criticality Helpers
// ============================================================================

export const ALLERGY_CATEGORY_LABELS: Record<AllergyCategory, string> = {
  medication: 'Obat',
  food: 'Makanan',
  environment: 'Lingkungan',
  biologic: 'Biologis',
};

export const ALLERGY_CRITICALITY_LABELS: Record<AllergyCriticality, string> = {
  low: 'Rendah',
  high: 'Tinggi',
  'unable-to-assess': 'Tidak Dapat Dinilai',
};

export const ALLERGY_CRITICALITY_COLORS: Record<AllergyCriticality, string> = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-red-100 text-red-800 border-red-300',
  'unable-to-assess': 'bg-gray-100 text-gray-800 border-gray-300',
};
