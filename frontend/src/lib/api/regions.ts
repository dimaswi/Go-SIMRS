import { api } from './client';

export interface Province {
  id: string;
  name: string;
}

export interface Regency {
  id: string;
  province_id: string;
  name: string;
  province?: Province;
  districts?: District[];
}

export interface District {
  id: string;
  regency_id: string;
  name: string;
  regency?: Regency;
  villages?: Village[];
}

export interface Village {
  id: string;
  district_id: string;
  name: string;
  district?: District;
}

export interface RegionStats {
  provinces: number;
  regencies: number;
  districts: number;
  villages: number;
}

export const regionsApi = {
  getStats: () => 
    api.get<{ data: RegionStats }>('/regions/stats'),
  
  // Provinces
  getProvinces: () => 
    api.get<{ data: Province[] }>('/regions/provinces'),
  
  getProvince: (id: string) => 
    api.get<{ data: Province & { regencies?: Regency[] } }>(`/regions/provinces/${id}`),
  
  createProvince: (data: { id: string; name: string }) =>
    api.post<{ data: Province; message: string }>('/regions/provinces', data),
  
  updateProvince: (id: string, data: { name: string }) =>
    api.put<{ data: Province; message: string }>(`/regions/provinces/${id}`, data),
  
  // Regencies
  getAllRegencies: () =>
    api.get<{ data: (Regency & { province?: Province })[] }>('/regions/all-regencies'),
  
  getRegencies: (provinceId: string) => 
    api.get<{ data: Regency[] }>(`/regions/regencies/${provinceId}`),
  
  getRegency: (id: string) => 
    api.get<{ data: Regency }>(`/regions/regency/${id}`),
  
  createRegency: (data: { id: string; province_id: string; name: string }) =>
    api.post<{ data: Regency; message: string }>('/regions/regencies', data),
  
  updateRegency: (id: string, data: { name: string }) =>
    api.put<{ data: Regency; message: string }>(`/regions/regency/${id}`, data),
  
  // Districts
  getDistricts: (regencyId: string) => 
    api.get<{ data: District[] }>(`/regions/districts/${regencyId}`),
  
  getDistrict: (id: string) => 
    api.get<{ data: District }>(`/regions/district/${id}`),
  
  createDistrict: (data: { id: string; regency_id: string; name: string }) =>
    api.post<{ data: District; message: string }>('/regions/districts', data),
  
  updateDistrict: (id: string, data: { name: string }) =>
    api.put<{ data: District; message: string }>(`/regions/district/${id}`, data),
  
  // Villages
  getVillages: (districtId: string) => 
    api.get<{ data: Village[] }>(`/regions/villages/${districtId}`),
  
  getVillage: (id: string) => 
    api.get<{ data: Village }>(`/regions/village/${id}`),
  
  createVillage: (data: { id: string; district_id: string; name: string }) =>
    api.post<{ data: Village; message: string }>('/regions/villages', data),
  
  updateVillage: (id: string, data: { name: string }) =>
    api.put<{ data: Village; message: string }>(`/regions/village/${id}`, data),
};
