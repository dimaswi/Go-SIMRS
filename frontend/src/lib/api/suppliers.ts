import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Supplier {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  npwp: string;
  contact_person: string;
  contact_phone: string;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierFormData {
  code?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  npwp?: string;
  contact_person?: string;
  contact_phone?: string;
  bank_name?: string;
  bank_account?: string;
  bank_account_name?: string;
  notes?: string;
  is_active?: boolean;
}

export interface SuppliersResponse {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface SupplierResponse {
  data: Supplier;
}

export const suppliersApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => api.get<SuppliersResponse>("/suppliers", { params }),

  getAllActive: () => api.get<{ data: Supplier[] }>("/suppliers/all"),

  getById: (id: number) => api.get<SupplierResponse>(`/suppliers/${id}`),

  create: (data: SupplierFormData) => api.post<SupplierResponse>("/suppliers", data),

  update: (id: number, data: SupplierFormData) =>
    api.put<SupplierResponse>(`/suppliers/${id}`, data),

  delete: (id: number) => api.delete(`/suppliers/${id}`),
};

export default suppliersApi;
