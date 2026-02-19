import { api } from './client';

// Integration Types - now includes all BPJS services as separate types
export type IntegrationType = 
  | 'bpjs' // Legacy
  | 'bpjs-antrian' 
  | 'bpjs-vclaim' 
  | 'bpjs-icare' 
  | 'bpjs-apotek' 
  | 'bpjs-rme' 
  | 'bpjs-aplicare'
  | 'satusehat' 
  | 'pcare'
  | 'eklaim';

// BPJS Service Types
export const BPJS_SERVICE_TYPES: IntegrationType[] = [
  'bpjs-antrian',
  'bpjs-vclaim',
  'bpjs-icare',
  'bpjs-apotek',
  'bpjs-rme',
  'bpjs-aplicare',
];

// Check if integration type is a BPJS type
export const isBPJSType = (type: IntegrationType | string): boolean => {
  return BPJS_SERVICE_TYPES.includes(type as IntegrationType) || type === 'bpjs';
};

// Get BPJS service display name
export const getBPJSServiceName = (type: IntegrationType | string): string => {
  switch (type) {
    case 'bpjs-antrian':
      return 'Antrian Online';
    case 'bpjs-vclaim':
      return 'VClaim';
    case 'bpjs-icare':
      return 'I-Care';
    case 'bpjs-apotek':
      return 'Apotek Online';
    case 'bpjs-rme':
      return 'RME';
    case 'bpjs-aplicare':
      return 'Aplicare';
    default:
      return 'BPJS';
  }
};

// Integration Config Types
export interface IntegrationConfigValue {
  key: string;
  value: string;
  has_value: boolean;
  description: string;
  is_secret: boolean;
}

export interface IntegrationConfigMap {
  [key: string]: IntegrationConfigValue;
}

export interface IntegrationConnectionTestResult {
  success: boolean;
  message?: string;
  error?: string;
  environment?: string;
  base_url?: string;
  response_code?: number;
  response_time?: string;
  response_body?: string;
}

export interface IntegrationSyncLog {
  id: number;
  integration: IntegrationType;
  endpoint: string;
  method: string;
  request_body: string;
  response_code: number;
  response_body: string;
  status: 'success' | 'failed' | 'timeout';
  error_message: string;
  request_at: string;
  response_at: string;
  duration_ms: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
}

export interface IntegrationSyncStats {
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  avg_duration_ms: number;
}

export interface IntegrationInfo {
  id: IntegrationType;
  name: string;
  description: string;
  available: boolean;
  configured: boolean;
}

// API Functions
export const integrationsApi = {
  // Get all available integrations
  getAll: () => 
    api.get<{ data: IntegrationInfo[] }>('/integrations'),

  // Get config for specific integration
  getConfig: (type: IntegrationType) => 
    api.get<{ data: IntegrationConfigMap }>(`/integrations/${type}/config`),
  
  // Update config for specific integration
  updateConfig: (type: IntegrationType, data: Record<string, string>) => 
    api.put<{ message: string }>(`/integrations/${type}/config`, data),
  
  // Initialize default config for integration
  initConfig: (type: IntegrationType) => 
    api.post<{ message: string }>(`/integrations/${type}/config/init`),

  // Reset config to defaults for integration
  resetConfig: (type: IntegrationType) => 
    api.post<{ message: string }>(`/integrations/${type}/config/reset`),
  
  // Test connection to external system
  testConnection: (type: IntegrationType) => 
    api.post<IntegrationConnectionTestResult>(`/integrations/${type}/test`),

  // Get sync logs for integration
  getLogs: (type: IntegrationType, params?: { status?: string; date?: string }) => 
    api.get<{ data: IntegrationSyncLog[] }>(`/integrations/${type}/logs`, { params }),
  
  // Get all sync logs
  getAllLogs: (params?: { integration?: string; limit?: number }) =>
    api.get<{ data: IntegrationSyncLog[] }>('/integrations/sync-logs', { params }),
  
  // Get sync statistics for integration
  getStats: (type: IntegrationType) => 
    api.get<{ data: IntegrationSyncStats }>(`/integrations/${type}/stats`),
};

// BPJS-specific types (for backward compatibility and BPJS-specific features)
export interface BPJSPoliMapping {
  id: number;
  room_id: number;
  room_code: string;
  room_name: string;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
  kode_dokter_bpjs: string;
  nama_dokter_bpjs: string;
  is_active: boolean;
  room?: {
    id: number;
    code: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreatePoliMappingRequest {
  room_id: number;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
  kode_dokter_bpjs?: string;
  nama_dokter_bpjs?: string;
}

export interface UpdatePoliMappingRequest {
  kode_poli_bpjs?: string;
  nama_poli_bpjs?: string;
  kode_dokter_bpjs?: string;
  nama_dokter_bpjs?: string;
  is_active?: boolean;
}

// BPJS-specific API (for mapping etc that is BPJS-only)
export const bpjsBridgingApi = {
  // Poli Mapping
  getPoliMappings: (params?: { room_id?: number; is_active?: boolean }) => 
    api.get<{ data: BPJSPoliMapping[] }>('/bpjs/mapping/poli', { params }),
  
  createPoliMapping: (data: CreatePoliMappingRequest) => 
    api.post<{ data: BPJSPoliMapping }>('/bpjs/mapping/poli', data),
  
  updatePoliMapping: (id: number, data: UpdatePoliMappingRequest) => 
    api.put<{ data: BPJSPoliMapping }>(`/bpjs/mapping/poli/${id}`, data),
  
  deletePoliMapping: (id: number) => 
    api.delete<{ message: string }>(`/bpjs/mapping/poli/${id}`),
};

// SatuSehat Readiness Response
export interface SatuSehatReadinessResponse {
  patients: {
    total: number;
    with_ihs: number;
    ready: boolean;
  };
  practitioners: {
    total: number;
    with_ihs: number;
    ready: boolean;
  };
  locations: {
    total: number;
    with_satusehat: number;
    ready: boolean;
  };
  encounters: {
    total_completed: number;
    sent: number;
    pending: number;
  };
}

// SatuSehat-specific API
export const satuSehatApi = {
  // Get readiness status
  getReadiness: () =>
    api.get<SatuSehatReadinessResponse>('/integrations/satusehat/readiness'),

  // Lookup Patient IHS Number
  lookupPatientIHS: (patientId: number) =>
    api.post<{ message: string; patient_id: number; nik: string; nama_lokal: string; nama_satusehat: string; satusehat_id: string }>(
      `/integrations/satusehat/patient/${patientId}/lookup`
    ),

  // Lookup Practitioner IHS Number
  lookupPractitionerIHS: (employeeId: number) =>
    api.post<{ message: string; employee_id: number; nik: string; nama_lokal: string; nama_satusehat: string; satusehat_id: string }>(
      `/integrations/satusehat/practitioner/${employeeId}/lookup`
    ),

  // Send Location to SatuSehat
  sendLocation: (roomId: number) =>
    api.post<{ message: string; room_id: number; room_name: string; satusehat_id: string }>(
      `/integrations/satusehat/location/${roomId}/send`
    ),

  // Send Encounter to SatuSehat (legacy - without diagnosis)
  sendEncounter: (visitId: number) =>
    api.post<{ message: string; visit_id: number; visit_number: string; satusehat_encounter_id: string }>(
      `/integrations/satusehat/encounter/${visitId}/send`
    ),

  // Send Encounter with Diagnosis to SatuSehat (new - complete flow)
  sendEncounterWithDiagnosis: (visitId: number) =>
    api.post<{ 
      message: string; 
      visit_id: number; 
      visit_number: string; 
      satusehat_encounter_id: string;
      conditions_sent: Array<{ diagnosis_id: number; icd10_code: string; condition_id: string; status: string }>;
      diagnosis_count: number;
    }>(
      `/integrations/satusehat/encounter/${visitId}/send-with-diagnosis`
    ),

  // Preview FHIR data that will be sent to SatuSehat
  previewEncounterFHIR: (visitId: number) =>
    api.get<{
      visit_id: number;
      visit_number: string;
      patient_name: string;
      patient_ihs: string;
      doctor_name: string;
      doctor_ihs: string;
      room_name: string;
      room_id: string;
      diagnosis_count: number;
      preview: {
        step_1_encounter_arrived: Record<string, unknown>;
        step_2_conditions: Array<Record<string, unknown>>;
        step_3_encounter_finished: Record<string, unknown>;
      };
      flow_explanation: string[];
      notes: string[];
    }>(`/integrations/satusehat/encounter/${visitId}/preview`),

  // Get comprehensive SatuSehat sync status
  getEncounterStatus: (visitId: number) =>
    api.get<{
      summary: {
        visit_id?: number;
        visit_number: string;
        patient_name: string;
        status: string;
        completion_percentage: number;
        required_resources: number;
        sent_required: number;
        ready_to_send: boolean;
      };
      resources: Array<{
        resource: string;
        required: boolean;
        sent?: boolean;
        all_sent?: boolean;
        total?: number;
        sent_count?: number;
        pending?: number;
        count?: number;
        available?: boolean;
        description: string;
        category?: string;
        examiner_ihs?: boolean;
        prerequisites?: string[];
        items?: Array<any>;
        note?: string;
      }>;
      prerequisites: {
        patient_ihs: boolean;
        practitioner_ihs: boolean;
        location_id: boolean;
        examiner_ihs?: boolean;
      };
      next_steps: string[];
    }>(`/integrations/satusehat/encounter/${visitId}/status`),

  // Send individual Condition (Diagnosis) to SatuSehat
  sendCondition: (diagnosisId: number) =>
    api.post<{ message: string; diagnosis_id: number; icd10_code: string; satusehat_condition_id: string }>(
      `/integrations/satusehat/condition/${diagnosisId}/send`
    ),

  // Send vital signs to SatuSehat
  sendVitalSigns: (visitId: number) =>
    api.post<{
      message: string;
      visit_id: number;
      encounter_id: string;
      observations_sent: Array<{ type: string; value: number; observation_id: string; status: string }>;
      total_sent: number;
    }>(
      `/integrations/satusehat/visit/${visitId}/send-vital-signs`
    ),

  // Send procedure to SatuSehat
  sendProcedure: (visitProcedureId: number) =>
    api.post<{
      message: string;
      visit_procedure_id: number;
      procedure_code: string;
      procedure_name: string;
      satusehat_procedure_id: string;
    }>(
      `/integrations/satusehat/procedure/${visitProcedureId}/send`
    ),

  // Send medication request to SatuSehat
  sendMedicationRequest: (medicationItemId: number) =>
    api.post<{
      message: string;
      satusehat_medication_request_id: string;
      fhir_response: any;
    }>(
      `/integrations/satusehat/medication/${medicationItemId}/send`
    ),

  // Send medication dispense to SatuSehat
  sendMedicationDispense: (medicationItemId: number) =>
    api.post<{
      message: string;
      satusehat_medication_dispense_id: string;
      fhir_response: any;
    }>(
      `/integrations/satusehat/medication-dispense/${medicationItemId}/send`
    ),

  // Get visit diagnoses with SatuSehat status
  getVisitDiagnoses: (visitId: number) =>
    api.get<{ 
      diagnoses: Array<{
        id: number;
        visit_id: number;
        icd10_code: string;
        icd10_name: string;
        type: string;
        clinical_status: string;
        verification_status: string;
        satusehat_condition_id?: string;
        satusehat_sent_at?: string;
      }>;
      total: number;
      has_primary: boolean;
      sent_count: number;
      ready_to_send: boolean;
    }>(`/integrations/satusehat/visit/${visitId}/diagnoses`),

  // Get organization info
  getOrganization: () =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/organization'),

  // Search patient by NIK
  searchPatient: (nik: string) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/patient', { params: { nik } }),

  // Search practitioner by NIK
  searchPractitioner: (nik: string) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/practitioner', { params: { nik } }),

  // Get encounters
  getEncounters: (params?: { subject?: string; date?: string; _count?: number }) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/encounters', { params }),

  // Get conditions
  getConditions: (encounterId: string) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/conditions', { params: { encounter: encounterId } }),

  // Get observations
  getObservations: (encounterId: string) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/observations', { params: { encounter: encounterId } }),

  // Get medications
  getMedications: (encounterId: string) =>
    api.get<{ data: Record<string, unknown> }>('/integrations/satusehat/medications', { params: { encounter: encounterId } }),

  // Get history
  getHistory: (params?: { start_date?: string; end_date?: string; _count?: number }) =>
    api.get<{ data: { total_encounters: number; encounters: Record<string, unknown>[]; summary: Record<string, number> } }>(
      '/integrations/satusehat/history',
      { params }
    ),

  // Send QuestionnaireResponse (pengkajian resep) to SatuSehat
  sendQuestionnaireResponse: (medicineOrderId: number) =>
    api.post<{
      message: string;
      satusehat_questionnaire_response_id: string;
      fhir_response: any;
    }>(`/integrations/satusehat/medicine-order/${medicineOrderId}/questionnaire-response`),

  // Send MedicationAdministration to SatuSehat
  sendMedicationAdministration: (itemId: number) =>
    api.post<{
      message: string;
      satusehat_medication_administration_id: string;
      fhir_response: any;
    }>(`/integrations/satusehat/medicine-order-item/${itemId}/administration`),

  // Send Composition (Resume Medis) to SatuSehat
  sendComposition: (visitId: number) =>
    api.post<{
      message: string;
      visit_id: number;
      visit_number: string;
      satusehat_composition_id: string;
      fhir_response: any;
    }>(`/integrations/satusehat/composition/${visitId}/send`),

  // Send ClinicalImpression to SatuSehat
  // type: history (Riwayat Perjalanan Penyakit), rationale (Rasional Klinis), prognosis (Prognosis), triage (Asesmen Triage IGD)
  sendClinicalImpression: (visitId: number, type: 'history' | 'rationale' | 'prognosis' | 'triage') =>
    api.post<{
      message: string;
      visit_id: number;
      visit_number: string;
      type: string;
      type_display: string;
      satusehat_clinical_impression_id: string;
      fhir_response: any;
    }>(`/integrations/satusehat/clinical-impression/${visitId}/send`, null, { params: { type } }),

  // Get ClinicalImpression status for a visit
  getClinicalImpressionStatus: (visitId: number) =>
    api.get<{
      visit_id: number;
      visit_number: string;
      prerequisites: {
        patient_ihs: boolean;
        practitioner_ihs: boolean;
        encounter_sent: boolean;
      };
      statuses: Array<{
        type: string;
        type_display: string;
        data_exists: boolean;
        data_field?: string;
        sent: boolean;
        satusehat_id?: string;
        sent_at?: string;
        can_send: boolean;
        blocked_by?: string;
      }>;
      summary: {
        total_types: number;
        total_available: number;
        total_sent: number;
        total_can_send: number;
      };
    }>(`/integrations/satusehat/clinical-impression/${visitId}/status`),

  // Send AllergyIntolerance to SatuSehat
  sendAllergyIntolerance: (allergyId: number) =>
    api.post<{
      message: string;
      allergy_id: number;
      snomed_code: string;
      snomed_display: string;
      satusehat_allergy_id: string;
    }>(`/integrations/satusehat/allergy/${allergyId}/send`),

  // Send all patient allergies for a visit
  sendVisitAllergies: (visitId: number) =>
    api.post<{
      message: string;
      visit_id: number;
      total_sent: number;
      allergies_sent: Array<{
        allergy_id: number;
        snomed_code: string;
        snomed_display: string;
        satusehat_allergy_id: string;
        status: string;
      }>;
    }>(`/integrations/satusehat/visit/${visitId}/send-allergies`),

  // Get allergy status for a patient
  getPatientAllergyStatus: (patientId: number) =>
    api.get<{
      patient_id: number;
      patient_name: string;
      prerequisites: {
        patient_ihs: boolean;
        encounter_sent: boolean;
      };
      allergies: Array<{
        id: number;
        snomed_code: string;
        snomed_display: string;
        category: string;
        criticality: string;
        is_active: boolean;
        sent: boolean;
        satusehat_id?: string;
        sent_at?: string;
        can_send: boolean;
        blocked_by?: string;
      }>;
      summary: {
        total: number;
        active: number;
        sent: number;
        can_send: number;
      };
    }>(`/integrations/satusehat/patient/${patientId}/allergies/status`),

  // ========== Lab/Radiology Resources ==========
  
  // Send ServiceRequest (lab/radiology order) to SatuSehat
  sendServiceRequest: (visitProcedureId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/fhir/servicerequest/${visitProcedureId}/send`),

  // Send Specimen to SatuSehat
  sendSpecimen: (visitProcedureId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/fhir/specimen/${visitProcedureId}/send`),

  // Send DiagnosticReport (with Observations) to SatuSehat
  sendDiagnosticReport: (visitProcedureId: number, conclusion?: string) =>
    api.post<{
      message: string;
      satusehat_id: string;
      observation_ids: string[];
      response: any;
    }>(`/integrations/satusehat/fhir/diagnosticreport/${visitProcedureId}/send`, { conclusion }),

  // Get Lab resource status for a visit procedure
  getLabResourceStatus: (visitProcedureId: number) =>
    api.get<{
      visit_procedure_id: number;
      procedure_name: string;
      procedure_type: string;
      status: string;
      has_loinc_mapping: boolean;
      loinc_code: string;
      loinc_display: string;
      is_laboratory: boolean;
      prerequisites: {
        patient_ihs: boolean;
        doctor_ihs: boolean;
        encounter_sent: boolean;
        loinc_mapping: boolean;
        specimen_mapping: boolean;
      };
      resources: Array<{
        resource: string;
        sent: boolean;
        satusehat_id?: string;
        can_send: boolean;
        blocked_by?: string;
      }>;
      observation_ids: string[];
      results_count: number;
    }>(`/integrations/satusehat/fhir/lab/${visitProcedureId}/status`),

  // Send all lab resources in sequence (ServiceRequest -> Specimen -> Observations -> DiagnosticReport)
  sendAllLabResources: (visitProcedureId: number, conclusion?: string) =>
    api.post<{
      message: string;
      results: {
        service_request_id?: string;
        service_request_note?: string;
        specimen_id?: string;
        specimen_note?: string;
        specimen_error?: string;
        observation_ids?: string[];
        diagnostic_report_id?: string;
        diagnostic_report_note?: string;
        diagnostic_report_error?: any;
      };
    }>(`/integrations/satusehat/fhir/lab/${visitProcedureId}/send-all`, { conclusion }),

  // ========== Lab/Radiology Resources from ProcedureOrder System ==========
  
  // Send ServiceRequest from ProcedureOrderItem
  sendServiceRequestFromOrder: (orderItemId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/servicerequest-order/${orderItemId}/send`),

  // Send Specimen from ProcedureOrderItem
  sendSpecimenFromOrder: (orderItemId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/specimen-order/${orderItemId}/send`),

  // Send DiagnosticReport from ProcedureOrderItem
  sendDiagnosticReportFromOrder: (orderItemId: number, conclusion?: string) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/diagnosticreport-order/${orderItemId}/send`, { conclusion }),

  // Get Lab resource status for ProcedureOrderItem
  getLabResourceStatusFromOrder: (orderItemId: number) =>
    api.get<{
      id: number;
      procedure_code: string;
      procedure_name: string;
      procedure_type: string;
      status: string;
      has_loinc_mapping: boolean;
      loinc_code: string;
      loinc_display: string;
      servicerequest: {
        sent: boolean;
        id: string;
      };
      specimen: {
        sent: boolean;
        id: string;
      };
      diagnosticreport: {
        sent: boolean;
        id: string;
      };
    }>(`/integrations/satusehat/lab-order/${orderItemId}/status`),

  // Send all lab resources from ProcedureOrderItem
  sendAllLabResourcesFromOrder: (orderItemId: number, conclusion?: string) =>
    api.post<{
      message: string;
      results: {
        service_request_id?: string;
        service_request_note?: string;
        specimen_id?: string;
        specimen_note?: string;
        specimen_error?: string;
        observation_ids?: string[];
        diagnostic_report_id?: string;
        diagnostic_report_note?: string;
        diagnostic_report_error?: any;
      };
    }>(`/integrations/satusehat/lab-order/${orderItemId}/send-all`, { conclusion }),

  // ========== MedicationStatement - Riwayat Pengobatan ==========

  // Send MedicationStatement from Anamnesis
  sendMedicationStatement: (anamnesisId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/medicationstatement/${anamnesisId}/send`),

  // Get MedicationStatement monitoring data
  getMedicationStatementMonitoring: (startDate?: string, endDate?: string) =>
    api.get<{
      data: {
        id: number;
        visit_id: number;
        visit_number: string;
        patient_name: string;
        patient_mrn: string;
        room_name: string;
        current_medications: string;
        created_at: string;
        has_encounter: boolean;
      }[];
      total: number;
    }>(`/integrations/satusehat/monitoring/medicationstatement`, {
      params: { start_date: startDate, end_date: endDate },
    }),

  // ========== CarePlan - Rencana Rawat / Instruksi ==========

  // Send CarePlan from CPPT
  sendCarePlanFromCPPT: (cpptId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/careplan/cppt/${cpptId}/send`),

  // Send CarePlan from Disposition (RTL)
  sendCarePlanFromDisposition: (dispositionId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/careplan/disposition/${dispositionId}/send`),

  // Send CarePlan from AssessmentPlan (Rencana Pengobatan - Rawat Jalan/IGD)
  sendCarePlanFromAssessmentPlan: (assessmentPlanId: number) =>
    api.post<{
      message: string;
      satusehat_id: string;
      response: any;
    }>(`/integrations/satusehat/careplan/assessment/${assessmentPlanId}/send`),

  // Get CarePlan monitoring data
  getCarePlanMonitoring: (startDate?: string, endDate?: string, source?: 'cppt' | 'disposition' | 'all') =>
    api.get<{
      data: {
        id: number;
        source: 'cppt' | 'disposition';
        visit_id: number;
        visit_number: string;
        patient_name: string;
        patient_mrn: string;
        room_name: string;
        title: string;
        description: string;
        created_at: string;
        has_encounter: boolean;
      }[];
      total: number;
    }>(`/integrations/satusehat/monitoring/careplan`, {
      params: { start_date: startDate, end_date: endDate, source },
    }),
};
