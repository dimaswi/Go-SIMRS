import { api } from './client';

// ============================================================================
// LOINC & SNOMED CT Types - Sesuai struktur database Kemkes IHS
// Table: loinc, snomed_ct
// ============================================================================

export type LoincClassType = 'laboratory' | 'radiology';

// LoincMaster - sesuai tabel loinc Kemkes IHS (23 kolom)
export interface LoincMaster {
  id: number;
  kategori_pemeriksaan: string;
  nama_pemeriksaan: string;
  permintaan_hasil: string;
  spesimen: string;
  tipe_hasil_pemeriksaan: string;
  satuan: string;
  metode_analisis: string;
  code: string;
  display: string;
  component: string;
  property: string;
  timing: string;
  system: string;
  scale: string;
  method: string;
  unit_of_measure: string;
  code_system: string;
  body_site_code: string;
  body_site_display: string;
  body_site_code_sistem: string;  // PERHATIKAN: "sistem" bukan "system"
  version_first_released: string;
  version_last_changed: string;
}

// SnomedMaster - sesuai tabel snomed_ct Kemkes IHS
export interface SnomedMaster {
  pk_id: number;
  id: number;
  effectiveTime: number | null;
  active: number;
  moduleId: string;
  conceptId: string;
  languageCode: string;
  typeId: string;
  term: string;
  caseSignificanceId: string;
}

export interface ProcedureLoincMapping {
  id: number;
  procedure_id: number;
  procedure?: {
    id: number;
    code: string;
    name: string;
    procedure_type: string;
    procedure_group: string;
    specialty: string;
  };
  loinc_code: string;
  loinc_display: string;
  snomed_category_code: string;
  snomed_category_display: string;
  snomed_specimen_code: string;
  snomed_specimen_display: string;
  snomed_bodysite_code: string;
  snomed_bodysite_display: string;
  is_verified: boolean;
  verified_at?: string;
  verified_by_id?: number;
  verified_by?: {
    id: number;
    full_name: string;
    username: string;
  };
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LoincMappingStats {
  total_procedures: number;
  total_procedures_lab: number;
  total_procedures_rad: number;
  total_mapped: number;
  total_unmapped: number;
  total_verified: number;
  total_loinc_master: number;
  total_snomed_master: number;
  mapped_percentage: number;
  verified_percentage: number;
  ready_for_satusehat: number;
}

export interface UnmappedProcedure {
  id: number;
  code: string;
  name: string;
  procedure_type: string;
  procedure_group: string;
  specialty: string;
  description: string;
  is_active: boolean;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateProcedureLoincMappingRequest {
  procedure_id: number;
  loinc_code: string;
  loinc_display: string;
  snomed_category_code: string;
  snomed_category_display?: string;
  snomed_specimen_code?: string;
  snomed_specimen_display?: string;
  snomed_bodysite_code?: string;
  snomed_bodysite_display?: string;
  is_verified?: boolean;
  is_active?: boolean;
  notes?: string;
}

// ============================================================================
// LOINC Master API (Struktur Kemkes IHS)
// ============================================================================

export const loincMasterApi = {
  // Get all LOINC master data with filters and pagination
  getAll: (params?: {
    search?: string;
    kategori?: string;         // Filter by kategori_pemeriksaan
    class_type?: LoincClassType; // For compatibility: maps to kategori=Radiologi or not
    spesimen?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ data: LoincMaster[]; total: number; page: number; limit: number }>('/loinc/master', { params }),

  // Get single LOINC master by ID
  getById: (id: number) => api.get<{ data: LoincMaster }>(`/loinc/master/${id}`),

  // Search LOINC master for autocomplete (optimized for dropdown)
  search: (query: string, classType?: LoincClassType, limit?: number) =>
    api.get<{ data: LoincMaster[] }>('/loinc/master/search', { 
      params: { q: query, class_type: classType, limit } 
    }),

  // Lookup LOINC by exact code
  lookupByCode: async (code: string) => {
    if (!code || code.trim() === '') {
      throw new Error('LOINC code is required');
    }
    try {
      const response = await api.get<{ found: boolean; data: LoincMaster }>(`/loinc/master/lookup/${code}`);
      return response;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`LOINC code "${code}" not found in master data`);
      }
      throw error;
    }
  },

  // Get list of kategori pemeriksaan for filter dropdown
  getKategoriList: () => api.get<{ data: string[] }>('/loinc/master/kategori'),

  // Get list of spesimen for filter dropdown
  getSpesimenList: () => api.get<{ data: string[] }>('/loinc/master/spesimen'),
};

// ============================================================================
// SNOMED Master API (Read-only dari Kemkes IHS)
// Struktur: id, effectiveTime, active, moduleId, conceptId, languageCode, typeId, term, caseSignificanceId
// ============================================================================

export const snomedMasterApi = {
  // Get all SNOMED master data with filters and pagination
  // NOTE: Always use search filter to avoid loading all rows
  getAll: (params?: {
    search?: string;       // REQUIRED for performance!
    page?: number;
    limit?: number;
  }) => api.get<{ data: SnomedMaster[]; total: number; page: number; limit: number }>('/loinc/snomed', { params }),

  // Get single SNOMED master by ID
  getById: (id: number) => api.get<{ data: SnomedMaster }>(`/loinc/snomed/${id}`),

  // Search SNOMED for autocomplete (optimized - max 30 results)
  search: (query: string, limit?: number) =>
    api.get<{ data: SnomedMaster[] }>('/loinc/snomed/search', { 
      params: { q: query, limit } 
    }),

  // Lookup SNOMED by conceptId
  lookupByCode: async (code: string) => {
    if (!code || code.trim() === '') {
      throw new Error('SNOMED conceptId is required');
    }
    try {
      const response = await api.get<{ found: boolean; data: SnomedMaster }>(`/loinc/snomed/lookup/${code}`);
      return response;
    } catch (error: unknown) {
      const err = error as { response?: { status: number }; message?: string };
      if (err.response?.status === 404) {
        throw new Error(`SNOMED conceptId "${code}" not found in master data`);
      }
      throw error;
    }
  },
};

// ============================================================================
// Procedure LOINC Mapping API
// ============================================================================

export const loincMappingApi = {
  // Get all mappings with filters and pagination
  getAll: (params?: {
    search?: string;
    procedure_id?: number;
    procedure_type?: 'laboratory' | 'radiology';
    is_verified?: boolean;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<{ data: ProcedureLoincMapping[]; total: number; page: number; limit: number }>('/loinc/mapping', { params }),

  // Get single mapping by ID
  getById: (id: number) => api.get<{ data: ProcedureLoincMapping }>(`/loinc/mapping/${id}`),

  // Get mapping by procedure ID
  getByProcedureId: (procedureId: number) =>
    api.get<{ data: ProcedureLoincMapping }>(`/loinc/mapping/procedure/${procedureId}`),

  // Create new mapping with validation
  create: async (data: CreateProcedureLoincMappingRequest) => {
    // Frontend validation
    if (!data.procedure_id) {
      throw new Error('Procedure ID is required');
    }
    if (!data.loinc_code || data.loinc_code.trim() === '') {
      throw new Error('LOINC Code cannot be blank');
    }
    if (!data.loinc_display || data.loinc_display.trim() === '') {
      throw new Error('LOINC Display Name cannot be blank');
    }
    if (!data.snomed_category_code || data.snomed_category_code.trim() === '') {
      throw new Error('SNOMED Category Code is required');
    }

    return api.post<{ message: string; data: ProcedureLoincMapping }>('/loinc/mapping', data);
  },

  // Update mapping
  update: (id: number, data: CreateProcedureLoincMappingRequest) =>
    api.put<{ message: string; data: ProcedureLoincMapping }>(`/loinc/mapping/${id}`, data),

  // Delete mapping
  delete: (id: number) => api.delete<{ message: string }>(`/loinc/mapping/${id}`),

  // Verify mapping
  verify: (id: number) =>
    api.post<{ message: string; data: ProcedureLoincMapping }>(`/loinc/mapping/${id}/verify`),
};

// ============================================================================
// LOINC Statistics API
// ============================================================================

export const loincStatsApi = {
  // Get mapping statistics
  getStats: () => api.get<LoincMappingStats>('/loinc/stats'),

  // Get unmapped procedures
  getUnmapped: (params?: {
    search?: string;
    procedure_type?: 'laboratory' | 'radiology';
    page?: number;
    limit?: number;
  }) => api.get<{ data: UnmappedProcedure[]; total: number; page: number; limit: number }>('/loinc/unmapped', { params }),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert LOINC master result to mapping request format
 * Sesuai dengan struktur Kemkes IHS
 */
export function loincResultToMappingData(
  loincResult: LoincMaster,
  procedureId: number,
  categoryCode?: string
): CreateProcedureLoincMappingRequest {
  // Determine category based on kategori_pemeriksaan (Radiologi = imaging, otherwise = lab)
  const isRadiology = loincResult.kategori_pemeriksaan === 'Radiologi';
  const defaultCategory = isRadiology ? '363679005' : '108252007';
  
  return {
    procedure_id: procedureId,
    loinc_code: loincResult.code,
    // Gunakan nama_pemeriksaan (Indonesia) atau display (English)
    loinc_display: loincResult.nama_pemeriksaan || loincResult.display,
    snomed_category_code: categoryCode || defaultCategory,
    snomed_category_display: isRadiology ? 'Imaging' : 'Laboratory procedure',
    is_active: true,
  };
}

/**
 * Validate LOINC mapping data before submission
 */
export function validateLoincMapping(data: CreateProcedureLoincMappingRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.procedure_id) {
    errors.push('Procedure ID is required');
  }
  if (!data.loinc_code || data.loinc_code.trim() === '') {
    errors.push('LOINC Code cannot be blank');
  }
  if (!data.loinc_display || data.loinc_display.trim() === '') {
    errors.push('LOINC Display Name cannot be blank');
  }
  if (!data.snomed_category_code || data.snomed_category_code.trim() === '') {
    errors.push('SNOMED Category Code is required');
  }

  // Recommended fields (warnings)
  if (data.snomed_category_code === '108252007' && (!data.snomed_specimen_code || data.snomed_specimen_code.trim() === '')) {
    errors.push('Specimen code is recommended for laboratory procedures');
  }
  if (data.snomed_category_code === '363679005' && (!data.snomed_bodysite_code || data.snomed_bodysite_code.trim() === '')) {
    errors.push('Body site code is recommended for radiology procedures');
  }

  return {
    valid: errors.filter(e => !e.includes('recommended')).length === 0,
    errors,
  };
}

/**
 * Common SNOMED CT codes for quick access
 */
export const SNOMED_CODES = {
  // Categories
  LABORATORY_PROCEDURE: '108252007',
  IMAGING: '363679005',
  SURGICAL_PROCEDURE: '387713003',
  COUNSELING: '409063005',
  EDUCATION: '409073007',
  EVALUATION: '386053000',
  PHYSICAL_THERAPY: '91251008',

  // Common Specimens
  BLOOD: '119297000',
  SERUM: '119364003',
  PLASMA: '119361006',
  URINE: '122575003',
  STOOL: '119339001',
  SPUTUM: '258609006',
  SWAB: '119295008',
  NASOPHARYNGEAL_SWAB: '258500001',
  THROAT_SWAB: '258529004',
  WOUND_SWAB: '257261003',
  TISSUE: '119378002',
  CSF: '258450006',
  VENOUS_BLOOD: '446131002',
  CAPILLARY_BLOOD: '122554006',

  // Common Body Sites
  WHOLE_BODY: '38266002',
  THORAX: '816092008',
  ABDOMEN: '818981001',
  HEAD: '69536005',
  NECK: '45048000',
  SPINE: '181268008',
  CERVICAL_SPINE: '122494005',
  THORACIC_SPINE: '122495006',
  LUMBAR_SPINE: '122496007',
  HEART: '80891009',
  LUNG: '39607008',
  BRAIN: '12738006',
  KIDNEY: '64033007',
  LIVER: '10200004',
  SHOULDER: '16982005',
  KNEE: '72696002',
  HIP: '24136001',
  BREAST: '76752008',
  THYROID: '263355003',
  RIGHT: '6921000',
  LEFT: '7771000',
  BILATERAL: '51440002',
};

/**
 * Get SNOMED display text by code
 */
export function getSnomedDisplay(code: string): string {
  const displayMap: Record<string, string> = {
    '108252007': 'Laboratory procedure',
    '363679005': 'Imaging',
    '387713003': 'Surgical procedure',
    '119297000': 'Blood specimen',
    '119364003': 'Serum specimen',
    '119361006': 'Plasma specimen',
    '122575003': 'Urine specimen',
    '119339001': 'Stool specimen',
    '258609006': 'Sputum specimen',
    '119295008': 'Swab specimen',
    '38266002': 'Entire body',
    '816092008': 'Thorax',
    '818981001': 'Abdomen',
    '69536005': 'Head',
    '181268008': 'Spine',
    '80891009': 'Heart',
    '39607008': 'Lung',
    '12738006': 'Brain',
  };
  return displayMap[code] || code;
}
