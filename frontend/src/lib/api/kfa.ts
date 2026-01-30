import { api } from './client';

// ============================================================================
// KFA (Kode Farmasi Indonesia) Types
// ============================================================================

export type KFAProductType = 'obat' | 'alat_kesehatan';

export interface KFAMaster {
  id: number;
  kfa_code: string;
  kfa_name: string;
  kfa_type: KFAProductType;
  kfa_farmalkes: string;
  form: string;
  strength: string;
  manufacturer: string;
  category: string;
  is_active: boolean;
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineKFAMapping {
  id: number;
  medicine_id: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    generic_name: string;
    form: string;
    strength: string;
    unit: string;
    manufacturer: string;
    category: string;
    type: string;
  };
  kfa_code: string;
  kfa_name: string;
  kfa_type: KFAProductType;
  kfa_farmalkes: string;
  kfa_display_name: string;
  kfa_form: string;
  kfa_strength: string;
  kfa_manufacturer: string;
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
  satusehat_medication_id: string;
  satusehat_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KFAMappingStats {
  total_medicines: number;
  total_mapped: number;
  total_unmapped: number;
  total_verified: number;
  total_kfa_master: number;
  mapped_percentage: number;
  verified_percentage: number;
  ready_for_satusehat: number;
}

export interface UnmappedMedicine {
  id: number;
  code: string;
  name: string;
  generic_name: string;
  form: string;
  strength: string;
  unit: string;
  manufacturer: string;
  category: string;
  type: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateKFAMasterRequest {
  kfa_code: string;
  kfa_name: string;
  kfa_type?: KFAProductType;
  kfa_farmalkes?: string;
  form?: string;
  strength?: string;
  manufacturer?: string;
  category?: string;
  is_active?: boolean;
}

export interface CreateMedicineKFAMappingRequest {
  medicine_id: number;
  kfa_code: string;
  kfa_name: string;
  kfa_type?: KFAProductType;
  kfa_farmalkes?: string;
  kfa_display_name?: string;
  kfa_form?: string;
  kfa_strength?: string;
  kfa_manufacturer?: string;
  is_verified?: boolean;
  is_active?: boolean;
  notes?: string;
}

// ============================================================================
// KFA Master API
// ============================================================================

export const kfaMasterApi = {
  // Get all KFA master data with filters and pagination
  getAll: (params?: {
    search?: string;
    product_type?: KFAProductType;
    category?: string;
    form?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<{ data: KFAMaster[]; total: number; page: number; limit: number }>('/kfa/master', { params }),

  // Get single KFA master by ID
  getById: (id: number) => api.get<{ data: KFAMaster }>(`/kfa/master/${id}`),

  // Create new KFA master
  create: (data: CreateKFAMasterRequest) =>
    api.post<{ message: string; data: KFAMaster }>('/kfa/master', data),

  // Update KFA master
  update: (id: number, data: CreateKFAMasterRequest) =>
    api.put<{ message: string; data: KFAMaster }>(`/kfa/master/${id}`, data),

  // Delete KFA master
  delete: (id: number) => api.delete<{ message: string }>(`/kfa/master/${id}`),

  // Search KFA master for autocomplete
  search: (query: string) =>
    api.get<{ data: KFAMaster[] }>('/kfa/master/search', { params: { q: query } }),
};

// ============================================================================
// Medicine KFA Mapping API
// ============================================================================

export const kfaMappingApi = {
  // Get all mappings with filters and pagination
  getAll: (params?: {
    search?: string;
    medicine_id?: number;
    is_verified?: boolean;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<{ data: MedicineKFAMapping[]; total: number; page: number; limit: number }>('/kfa/mapping', { params }),

  // Get single mapping by ID
  getById: (id: number) => api.get<{ data: MedicineKFAMapping }>(`/kfa/mapping/${id}`),

  // Get mapping by medicine ID
  getByMedicineId: (medicineId: number) =>
    api.get<{ data: MedicineKFAMapping }>(`/kfa/mapping/medicine/${medicineId}`),

  // Create new mapping with validation
  create: async (data: CreateMedicineKFAMappingRequest) => {
    // Frontend validation
    if (!data.medicine_id) {
      throw new Error('Medicine ID is required');
    }
    if (!data.kfa_code || data.kfa_code.trim() === '') {
      throw new Error('KFA Code cannot be blank');
    }
    if (!data.kfa_name || data.kfa_name.trim() === '') {
      throw new Error('KFA Name cannot be blank');
    }

    return api.post<{ message: string; data: MedicineKFAMapping }>('/kfa/mapping', data);
  },

  // Update mapping
  update: (id: number, data: CreateMedicineKFAMappingRequest) =>
    api.put<{ message: string; data: MedicineKFAMapping }>(`/kfa/mapping/${id}`, data),

  // Delete mapping
  delete: (id: number) => api.delete<{ message: string }>(`/kfa/mapping/${id}`),

  // Verify mapping
  verify: (id: number) =>
    api.post<{ message: string; data: MedicineKFAMapping }>(`/kfa/mapping/${id}/verify`),

  // Send standalone Medication resource to SatuSehat
  sendToSatuSehat: (mappingId: number) =>
    api.post<{
      message: string;
      mapping_id: number;
      medicine_name: string;
      kfa_code: string;
      satusehat_medication_id: string;
      fhir_response: Record<string, unknown>;
    }>(`/kfa/medication/send/${mappingId}`),
};

// ============================================================================
// KFA Statistics API
// ============================================================================

export const kfaStatsApi = {
  // Get mapping statistics
  getStats: () => api.get<KFAMappingStats>('/kfa/stats'),

  // Get unmapped medicines
  getUnmapped: (params?: {
    search?: string;
    category?: string;
    form?: string;
    page?: number;
    limit?: number;
  }) => api.get<{ data: UnmappedMedicine[]; total: number; page: number; limit: number }>('/kfa/unmapped', { params }),
};

// ============================================================================
// KFA Lookup from SatuSehat API
// ============================================================================

export interface KFALookupResult {
  kfa_code: string;
  name: string;
  display_name: string;
  manufacturer: string;
  dosage_form: string;
  farmalkes?: string;
  nie?: string;
}

export const kfaLookupApi = {
  // Lookup KFA by code from SatuSehat API
  lookupByCode: async (code: string) => {
    if (!code || code.trim() === '') {
      throw new Error('KFA code is required');
    }
    try {
      const response = await api.get<{ found: boolean; data: KFALookupResult }>(`/kfa/lookup/code/${code}`);
      return response;
    } catch (error: any) {
      // Provide more helpful error messages
      if (error.response?.status === 404) {
        throw new Error(`KFA code "${code}" not found in SatuSehat`);
      }
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.error || 'Invalid KFA code format');
      }
      throw error;
    }
  },

  // Search KFA from SatuSehat API
  search: async (query: string) => {
    if (!query || query.trim() === '') {
      return { data: { total: 0, data: [] } };
    }
    if (query.trim().length < 3) {
      throw new Error('Search query must be at least 3 characters');
    }
    try {
      const response = await api.get<{ total: number; data: KFALookupResult[] }>('/kfa/lookup/search', { params: { q: query } });
      return response;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.error || 'Invalid search query');
      }
      throw error;
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert KFA lookup result to mapping request format
 * Useful for autofilling form data from SatuSehat API lookup
 */
export function kfaResultToMappingData(
  result: KFALookupResult,
  medicineId: number
): Omit<CreateMedicineKFAMappingRequest, 'medicine_id'> & { medicine_id: number } {
  return {
    medicine_id: medicineId,
    kfa_code: result.kfa_code || '',
    kfa_name: result.name || '',
    kfa_display_name: result.display_name || result.name || '',
    kfa_form: result.dosage_form || '',
    kfa_manufacturer: result.manufacturer || '',
    kfa_farmalkes: result.farmalkes || '',
    kfa_type: 'obat' as KFAProductType,
    is_active: true,
  };
}

/**
 * Validate KFA mapping data before submission
 */
export function validateKFAMapping(data: CreateMedicineKFAMappingRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.medicine_id) {
    errors.push('Medicine ID is required');
  }
  if (!data.kfa_code || data.kfa_code.trim() === '') {
    errors.push('KFA Code cannot be blank');
  }
  if (!data.kfa_name || data.kfa_name.trim() === '') {
    errors.push('KFA Name cannot be blank');
  }

  // Recommended fields
  if (!data.kfa_display_name || data.kfa_display_name.trim() === '') {
    errors.push('Display name is recommended for FHIR resources');
  }
  if (!data.kfa_form || data.kfa_form.trim() === '') {
    errors.push('Dosage form is recommended');
  }
  if (!data.kfa_manufacturer || data.kfa_manufacturer.trim() === '') {
    errors.push('Manufacturer is recommended');
  }

  return {
    valid: errors.length === 0 || errors.every(e => e.includes('recommended')),
    errors,
  };
}
