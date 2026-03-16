import { api } from './client';

// ========================================
// INTERFACES
// ========================================

// Procedure Types
export type ProcedureType = 'medical' | 'consultation' | 'radiology' | 'laboratory';

// Patient Class Types
export type PatientClass = 
  | 'non_kelas' 
  | 'kelas_3' 
  | 'kelas_2' 
  | 'kelas_1' 
  | 'vip' 
  | 'vvip' 
  | 'hcu' 
  | 'intensif' 
  | 'isolasi';

// Input Types for Parameters
export type ParameterInputType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime';

// Procedure Parameter
export interface ProcedureParameter {
  id: number;
  created_at: string;
  updated_at: string;
  procedure_id: number;
  code: string;
  name: string;
  description: string;
  input_type: ParameterInputType;
  options: string;
  unit: string;
  normal_min?: number;
  normal_max?: number;
  normal_text: string;
  critical_min?: number;
  critical_max?: number;
  decimal_places: number;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

// Tariff for each patient class
export interface ProcedureTariff {
  id: number;
  created_at: string;
  updated_at: string;
  procedure_id: number;
  patient_class: PatientClass;
  administrasi: number;
  sarana: number;
  bhp: number;
  dokter_operator: number;
  dokter_anastesi: number;
  dokter_lainnya: number;
  penata_anastesi: number;
  paramedis: number;
  non_medis: number;
}

// Tariff request for create/update
export interface TariffRequest {
  patient_class: PatientClass;
  administrasi: number;
  sarana: number;
  bhp: number;
  dokter_operator: number;
  dokter_anastesi: number;
  dokter_lainnya: number;
  penata_anastesi: number;
  paramedis: number;
  non_medis: number;
}

export interface Procedure {
  id: number;
  created_at: string;
  updated_at: string;
  
  // Basic Information
  code: string;
  name: string;
  description: string;
  
  // Procedure Type
  procedure_type: ProcedureType;
  
  // INA-CBG Classification
  inacbg_code: string;
  inacbg_name: string;
  procedure_group: string;
  specialty: string;
  body_system: string;
  
  // Classification Codes
  icd9cm_code: string;
  icd10pcs_code: string;
  
  // Tariffs by Patient Class
  tariffs: ProcedureTariff[];
  
  // Parameters
  parameters?: ProcedureParameter[];
  
  // Procedure Details
  duration: number;
  requires_anesthesia: boolean;
  anesthesia_type: string;
  is_emergency: boolean;
  is_surgical: boolean;
  
  // Service Type
  service_type: string;
  
  // Status
  is_active: boolean;
}

export interface RoomProcedure {
  id: number;
  created_at: string;
  updated_at: string;
  room_id: number;
  procedure_id: number;
  procedure?: Procedure;
  is_available: boolean;
  max_per_day: number;
  requires_booking: boolean;
  notes: string;
}

export interface ProcedureCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  parent_id?: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface PatientClassOption {
  code: PatientClass;
  label: string;
}

// ========================================
// REQUEST INTERFACES
// ========================================

export interface CreateProcedureRequest {
  code: string;
  name: string;
  description?: string;
  procedure_type?: ProcedureType;
  inacbg_code?: string;
  inacbg_name?: string;
  procedure_group?: string;
  specialty?: string;
  body_system?: string;
  icd9cm_code?: string;
  icd10pcs_code?: string;
  duration?: number;
  requires_anesthesia?: boolean;
  anesthesia_type?: string;
  is_emergency?: boolean;
  is_surgical?: boolean;
  service_type?: string;
  is_active?: boolean;
  tariffs?: TariffRequest[];
}

// Parameter Request
export interface CreateParameterRequest {
  code: string;
  name: string;
  description?: string;
  input_type: ParameterInputType;
  options?: string;
  unit?: string;
  normal_min?: number;
  normal_max?: number;
  normal_text?: string;
  critical_min?: number;
  critical_max?: number;
  decimal_places?: number;
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateRoomProcedureRequest {
  procedure_id: number;
  is_available?: boolean;
  max_per_day?: number;
  requires_booking?: boolean;
  notes?: string;
}

export interface ProcedureFilters {
  search?: string;
  procedure_type?: ProcedureType;
  procedure_group?: string;
  specialty?: string;
  service_type?: string;
  is_active?: boolean;
  is_surgical?: boolean;
}

// ========================================
// PROCEDURE API
// ========================================

export const proceduresApi = {
  // Get all procedures
  getAll: (filters?: ProcedureFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.procedure_type) params.append('procedure_type', filters.procedure_type);
    if (filters?.procedure_group) params.append('procedure_group', filters.procedure_group);
    if (filters?.specialty) params.append('specialty', filters.specialty);
    if (filters?.service_type) params.append('service_type', filters.service_type);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.is_surgical !== undefined) params.append('is_surgical', String(filters.is_surgical));
    
    const queryString = params.toString();
    return api.get<{ data: Procedure[] }>(`/procedures${queryString ? `?${queryString}` : ''}`);
  },

  // Get single procedure
  getById: (id: number, includeParameters: boolean = false) => {
    const params = includeParameters ? '?include_parameters=true' : '';
    return api.get<{ data: Procedure }>(`/procedures/${id}${params}`);
  },

  // Create procedure
  create: (data: CreateProcedureRequest) => {
    return api.post<{ data: Procedure }>('/procedures', data);
  },

  // Update procedure
  update: (id: number, data: CreateProcedureRequest) => {
    return api.put<{ data: Procedure }>(`/procedures/${id}`, data);
  },

  // Delete procedure
  delete: (id: number) => {
    return api.delete(`/procedures/${id}`);
  },

  // Get procedure categories
  getCategories: () => {
    return api.get<{ data: ProcedureCategory[] }>('/procedure-categories');
  },

  // Get patient classes
  getPatientClasses: () => {
    return api.get<{ data: PatientClassOption[] }>('/patient-classes');
  },

  // Get procedure types
  getProcedureTypes: () => {
    return api.get<{ data: Array<{ code: string; name: string }> }>('/procedure-types');
  },

  // Get input types for parameters
  getInputTypes: () => {
    return api.get<{ data: Array<{ code: string; name: string }> }>('/input-types');
  },

  // Get parameter templates
  getParameterTemplates: () => {
    return api.get<{ data: Record<string, CreateParameterRequest[]> }>('/parameter-templates');
  },
};

// ========================================
// PROCEDURE PARAMETERS API
// ========================================

export const procedureParametersApi = {
  // Get all parameters for a procedure
  getAll: (procedureId: number) => {
    return api.get<{ data: ProcedureParameter[] }>(`/procedures/${procedureId}/parameters`);
  },

  // Get single parameter
  getById: (procedureId: number, parameterId: number) => {
    return api.get<{ data: ProcedureParameter }>(`/procedures/${procedureId}/parameters/${parameterId}`);
  },

  // Create parameter
  create: (procedureId: number, data: CreateParameterRequest) => {
    return api.post<{ data: ProcedureParameter }>(`/procedures/${procedureId}/parameters`, data);
  },

  // Update parameter
  update: (procedureId: number, parameterId: number, data: CreateParameterRequest) => {
    return api.put<{ data: ProcedureParameter }>(`/procedures/${procedureId}/parameters/${parameterId}`, data);
  },

  // Delete parameter
  delete: (procedureId: number, parameterId: number) => {
    return api.delete(`/procedures/${procedureId}/parameters/${parameterId}`);
  },

  // Bulk create parameters
  bulkCreate: (procedureId: number, parameters: CreateParameterRequest[]) => {
    return api.post<{ data: ProcedureParameter[]; message: string }>(
      `/procedures/${procedureId}/parameters/bulk`,
      { parameters }
    );
  },

  // Apply default parameters based on procedure type
  applyDefaults: (procedureId: number, templateName: string) => {
    return api.post<{ data: ProcedureParameter[]; message: string }>(
      `/procedures/${procedureId}/parameters/apply-defaults`,
      { template_name: templateName }
    );
  },

  // Reorder parameters
  reorder: (procedureId: number, parameterIds: number[]) => {
    return api.put<{ message: string }>(
      `/procedures/${procedureId}/parameters/reorder`,
      { parameter_ids: parameterIds }
    );
  },
};

// ========================================
// ROOM PROCEDURE API
// ========================================

export const roomProceduresApi = {
  // Get procedures assigned to a room
  getByRoom: (roomId: number) => {
    return api.get<{ data: RoomProcedure[] }>(`/rooms/${roomId}/procedures`);
  },

  // Assign procedure to room
  create: (roomId: number, data: CreateRoomProcedureRequest) => {
    return api.post<{ data: RoomProcedure }>(`/rooms/${roomId}/procedures`, data);
  },

  // Bulk assign procedures to room
  bulkAssign: (roomId: number, procedureIds: number[]) => {
    return api.post<{ data: RoomProcedure[], skipped: number[], message: string }>(
      `/rooms/${roomId}/procedures/bulk`,
      { procedure_ids: procedureIds }
    );
  },

  // Update room procedure
  update: (roomId: number, rpId: number, data: CreateRoomProcedureRequest) => {
    return api.put<{ data: RoomProcedure }>(`/rooms/${roomId}/procedures/${rpId}`, data);
  },

  // Remove procedure from room
  delete: (roomId: number, rpId: number) => {
    return api.delete(`/rooms/${roomId}/procedures/${rpId}`);
  },
};

// ========================================
// CONSTANTS
// ========================================

// Procedure types
export const PROCEDURE_TYPES: Array<{ code: ProcedureType; label: string }> = [
  { code: 'medical', label: 'Tindakan Medis' },
  { code: 'consultation', label: 'Konsultasi' },
  { code: 'radiology', label: 'Radiologi' },
  { code: 'laboratory', label: 'Laboratorium' },
];

// Input types for parameters
export const INPUT_TYPES: Array<{ code: ParameterInputType; label: string }> = [
  { code: 'text', label: 'Teks' },
  { code: 'textarea', label: 'Teks Panjang' },
  { code: 'number', label: 'Angka' },
  { code: 'select', label: 'Pilihan' },
  { code: 'checkbox', label: 'Centang' },
  { code: 'date', label: 'Tanggal' },
  { code: 'datetime', label: 'Tanggal & Waktu' },
];

// All patient classes in order
export const PATIENT_CLASSES: PatientClass[] = [
  'non_kelas',
  'kelas_3',
  'kelas_2',
  'kelas_1',
  'vip',
  'vvip',
  'hcu',
  'intensif',
  'isolasi',
];

// Tariff components
export const TARIFF_COMPONENTS = [
  { key: 'administrasi', label: 'Administrasi' },
  { key: 'sarana', label: 'Sarana' },
  { key: 'bhp', label: 'BHP' },
  { key: 'dokter_operator', label: 'Dokter Operator' },
  { key: 'dokter_anastesi', label: 'Dokter Anastesi' },
  { key: 'dokter_lainnya', label: 'Dokter Lainnya' },
  { key: 'penata_anastesi', label: 'Penata Anastesi' },
  { key: 'paramedis', label: 'Paramedis' },
  { key: 'non_medis', label: 'Non Medis' },
] as const;

// ========================================
// HELPER FUNCTIONS
// ========================================

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Get patient class label
export const getPatientClassLabel = (patientClass: PatientClass): string => {
  const labels: Record<PatientClass, string> = {
    'non_kelas': 'Non Kelas',
    'kelas_3': 'Kelas III',
    'kelas_2': 'Kelas II',
    'kelas_1': 'Kelas I',
    'vip': 'VIP',
    'vvip': 'VVIP',
    'hcu': 'HCU',
    'intensif': 'Intensif',
    'isolasi': 'Isolasi',
  };
  return labels[patientClass] || patientClass;
};

// Calculate total tariff for a patient class
export const calculateTotalTariff = (tariff: ProcedureTariff | TariffRequest): number => {
  return (
    tariff.administrasi +
    tariff.sarana +
    tariff.bhp +
    tariff.dokter_operator +
    tariff.dokter_anastesi +
    tariff.dokter_lainnya +
    tariff.penata_anastesi +
    tariff.paramedis +
    tariff.non_medis
  );
};

// Get tariff by patient class
export const getTariffByClass = (
  tariffs: ProcedureTariff[] | undefined,
  patientClass: PatientClass
): ProcedureTariff | undefined => {
  return tariffs?.find(t => t.patient_class === patientClass);
};

// Initialize empty tariffs for all patient classes
export const initializeEmptyTariffs = (): TariffRequest[] => {
  return PATIENT_CLASSES.map(patientClass => ({
    patient_class: patientClass,
    administrasi: 0,
    sarana: 0,
    bhp: 0,
    dokter_operator: 0,
    dokter_anastesi: 0,
    dokter_lainnya: 0,
    penata_anastesi: 0,
    paramedis: 0,
    non_medis: 0,
  }));
};

// Convert procedure tariffs to request format
export const tariffsToRequest = (tariffs: ProcedureTariff[]): TariffRequest[] => {
  return tariffs.map(t => ({
    patient_class: t.patient_class,
    administrasi: t.administrasi,
    sarana: t.sarana,
    bhp: t.bhp,
    dokter_operator: t.dokter_operator,
    dokter_anastesi: t.dokter_anastesi,
    dokter_lainnya: t.dokter_lainnya,
    penata_anastesi: t.penata_anastesi,
    paramedis: t.paramedis,
    non_medis: t.non_medis,
  }));
};

// Get procedure group label
export const getProcedureGroupLabel = (group: string): string => {
  const labels: Record<string, string> = {
    'bedah': 'Bedah',
    'non_bedah': 'Non-Bedah',
    'diagnostik': 'Diagnostik',
    'rehabilitasi': 'Rehabilitasi',
    'konsultasi': 'Konsultasi',
    'tindakan_medis': 'Tindakan Medis',
    'penunjang': 'Penunjang Medis',
  };
  return labels[group] || group;
};

// Get specialty label
export const getSpecialtyLabel = (specialty: string): string => {
  const labels: Record<string, string> = {
    'umum': 'Umum',
    'bedah': 'Bedah',
    'anak': 'Anak',
    'kandungan': 'Kandungan & Kebidanan',
    'penyakit_dalam': 'Penyakit Dalam',
    'jantung': 'Jantung & Pembuluh Darah',
    'saraf': 'Saraf',
    'mata': 'Mata',
    'tht': 'THT',
    'kulit': 'Kulit & Kelamin',
    'gigi': 'Gigi & Mulut',
    'orthopedi': 'Orthopedi',
    'urologi': 'Urologi',
    'psikiatri': 'Psikiatri',
    'radiologi': 'Radiologi',
    'laboratorium': 'Laboratorium',
    'anestesi': 'Anestesi',
    'icu': 'ICU',
  };
  return labels[specialty] || specialty;
};

// Get anesthesia type label
export const getAnesthesiaTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'local': 'Lokal',
    'regional': 'Regional',
    'general': 'Umum (General)',
    'sedation': 'Sedasi',
  };
  return labels[type] || type;
};

// Get service type label
export const getServiceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'all': 'Semua',
    'rawat_jalan': 'Rawat Jalan',
    'rawat_inap': 'Rawat Inap',
    'penunjang': 'Penunjang',
  };
  return labels[type] || type;
};

// Get procedure type label
export const normalizeProcedureType = (type?: string): ProcedureType | undefined => {
  if (!type) return undefined;

  if (type === 'consultasi') return 'consultation';

  if (type === 'medical' || type === 'consultation' || type === 'radiology' || type === 'laboratory') {
    return type;
  }

  return undefined;
};

// Get procedure type label
export const getProcedureTypeLabel = (type: string): string => {
  const normalizedType = normalizeProcedureType(type);

  const labels: Record<ProcedureType, string> = {
    'medical': 'Tindakan Medis',
    'consultation': 'Konsultasi',
    'radiology': 'Radiologi',
    'laboratory': 'Laboratorium',
  };
  return normalizedType ? labels[normalizedType] : type;
};

// Get input type label
export const getInputTypeLabel = (type: ParameterInputType): string => {
  const labels: Record<ParameterInputType, string> = {
    'text': 'Teks',
    'textarea': 'Teks Panjang',
    'number': 'Angka',
    'select': 'Pilihan',
    'checkbox': 'Centang',
    'date': 'Tanggal',
    'datetime': 'Tanggal & Waktu',
  };
  return labels[type] || type;
};

// Parse options string to array
export const parseOptions = (options: string): string[] => {
  if (!options) return [];
  try {
    return JSON.parse(options);
  } catch {
    return options.split(',').map(s => s.trim()).filter(Boolean);
  }
};

// Format options array to string
export const formatOptions = (options: string[]): string => {
  return JSON.stringify(options);
};

// Check if parameter value is critical
export const isParameterCritical = (
  value: number,
  param: ProcedureParameter
): boolean => {
  if (param.critical_min !== undefined && value < param.critical_min) return true;
  if (param.critical_max !== undefined && value > param.critical_max) return true;
  return false;
};

// Check if parameter value is abnormal
export const isParameterAbnormal = (
  value: number,
  param: ProcedureParameter
): boolean => {
  if (param.normal_min !== undefined && value < param.normal_min) return true;
  if (param.normal_max !== undefined && value > param.normal_max) return true;
  return false;
};

// Format normal range display
export const formatNormalRange = (param: ProcedureParameter): string => {
  if (param.normal_text) return param.normal_text;
  if (param.normal_min !== undefined && param.normal_max !== undefined) {
    return `${param.normal_min} - ${param.normal_max}${param.unit ? ' ' + param.unit : ''}`;
  }
  if (param.normal_min !== undefined) {
    return `≥ ${param.normal_min}${param.unit ? ' ' + param.unit : ''}`;
  }
  if (param.normal_max !== undefined) {
    return `≤ ${param.normal_max}${param.unit ? ' ' + param.unit : ''}`;
  }
  return '-';
};
