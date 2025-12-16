import { api } from "./client";

// ===========================================================================
// ICD-10 API (Diagnosis)
// ===========================================================================

export interface ICD10 {
  id: number;
  code: string;
  code2: string;
  display: string;
  valid_code: boolean;
  acc_pdx: boolean;
  asterisk: boolean;
  im: boolean;
  is_active: boolean;
  chapter?: string;
  chapter_name?: string;
}

export interface ICD10Stats {
  total: number;
  valid: number;
  headers: number;
}

export const icd10Api = {
  // Search ICD-10 codes
  search: async (params: { search?: string; limit?: number; valid_only?: boolean }) => {
    const response = await api.get<ICD10[]>("/icd10", { params });
    return response.data;
  },

  // Get by code
  getByCode: async (code: string) => {
    const response = await api.get<ICD10>(`/icd10/${encodeURIComponent(code)}`);
    return response.data;
  },

  // Get by ID
  getById: async (id: number) => {
    const response = await api.get<ICD10>(`/icd10/id/${id}`);
    return response.data;
  },

  // Get stats
  getStats: async () => {
    const response = await api.get<ICD10Stats>("/icd10/stats");
    return response.data;
  },

  // Get chapters
  getChapters: async () => {
    const response = await api.get<ICD10[]>("/icd10/chapters");
    return response.data;
  },

  // Create
  create: async (data: Omit<ICD10, "id">) => {
    const response = await api.post<ICD10>("/icd10", data);
    return response.data;
  },

  // Update
  update: async (id: number, data: Partial<ICD10>) => {
    const response = await api.put<ICD10>(`/icd10/${id}`, data);
    return response.data;
  },

  // Delete
  delete: async (id: number) => {
    const response = await api.delete(`/icd10/${id}`);
    return response.data;
  },
};

// ===========================================================================
// ICD-9-CM API (Procedures)
// ===========================================================================

export interface ICD9CM {
  id: number;
  code: string;
  code2: string;
  display: string;
  valid_code: boolean;
  acc_pdx: boolean;
  asterisk: boolean;
  im: boolean;
  is_active: boolean;
  chapter?: string;
  chapter_name?: string;
}

export interface ICD9CMStats {
  total: number;
  valid: number;
  headers: number;
}

export const icd9cmApi = {
  // Search ICD-9-CM codes
  search: async (params: { search?: string; limit?: number; valid_only?: boolean }) => {
    const response = await api.get<ICD9CM[]>("/icd9cm", { params });
    return response.data;
  },

  // Get by code
  getByCode: async (code: string) => {
    const response = await api.get<ICD9CM>(`/icd9cm/${encodeURIComponent(code)}`);
    return response.data;
  },

  // Get by ID
  getById: async (id: number) => {
    const response = await api.get<ICD9CM>(`/icd9cm/id/${id}`);
    return response.data;
  },

  // Get stats
  getStats: async () => {
    const response = await api.get<ICD9CMStats>("/icd9cm/stats");
    return response.data;
  },

  // Create
  create: async (data: Omit<ICD9CM, "id">) => {
    const response = await api.post<ICD9CM>("/icd9cm", data);
    return response.data;
  },

  // Update
  update: async (id: number, data: Partial<ICD9CM>) => {
    const response = await api.put<ICD9CM>(`/icd9cm/${id}`, data);
    return response.data;
  },

  // Delete
  delete: async (id: number) => {
    const response = await api.delete(`/icd9cm/${id}`);
    return response.data;
  },
};

// ===========================================================================
// ICD-O API (Morphology)
// ===========================================================================

export interface ICDOMorphology {
  id: number;
  code: string;
  code2: string;
  display: string;
  valid_code: boolean;
  is_active: boolean;
}

export const icdoApi = {
  // Search ICD-O Morphology codes
  search: async (params: { search?: string; limit?: number }) => {
    const response = await api.get<ICDOMorphology[]>("/icdo", { params });
    return response.data;
  },
};
