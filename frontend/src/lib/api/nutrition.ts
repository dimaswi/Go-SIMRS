import { api } from './client';

// ==========================================
// NUTRITION API (Gizi)
// ==========================================

// Types
export interface NutritionMenu {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  diet_types?: string; // JSON array string
  calories: number;
  protein: number;
  fat: number;
  carbohydrate: number;
  fiber: number;
  sodium: number;
  serving_size?: string;
  unit_price: number;
  is_active: boolean;
  notes?: string;
}

export interface NutritionPackageItem {
  id: number;
  package_id: number;
  menu_id: number;
  menu?: NutritionMenu;
  quantity: number;
  notes?: string;
}

export interface NutritionPackage {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  description?: string;
  diet_type: string;
  meal_time: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbohydrate: number;
  price: number;
  is_active: boolean;
  notes?: string;
  items?: NutritionPackageItem[];
}

export interface NutritionPackageInput {
  code?: string;
  name: string;
  description?: string;
  diet_type: string;
  meal_time: string;
  price: number;
  is_active: boolean;
  notes?: string;
  items: {
    menu_id: number;
    quantity: number;
    notes?: string;
  }[];
}

// Labels
export const nutritionCategoryLabels: Record<string, string> = {
  makanan_pokok: 'Makanan Pokok',
  lauk: 'Lauk Pauk',
  sayur: 'Sayuran',
  buah: 'Buah-buahan',
  snack: 'Makanan Ringan',
  minuman: 'Minuman',
  suplemen: 'Suplemen Gizi',
  lainnya: 'Lainnya',
};

export const nutritionDietTypeLabels: Record<string, string> = {
  biasa: 'Diet Biasa',
  lunak: 'Makanan Lunak',
  saring: 'Makanan Saring',
  cair: 'Makanan Cair',
  dm: 'Diet Diabetes Mellitus',
  rendah_garam: 'Diet Rendah Garam',
  rendah_lemak: 'Diet Rendah Lemak',
  tinggi_kalori: 'Diet Tinggi Kalori Tinggi Protein',
  rendah_protein: 'Diet Rendah Protein',
  rendah_purin: 'Diet Rendah Purin',
  lambung: 'Diet Lambung',
  jantung: 'Diet Jantung',
  ginjal: 'Diet Ginjal',
  hati: 'Diet Hati',
  lainnya: 'Diet Lainnya',
};

export const nutritionMealTimeLabels: Record<string, string> = {
  pagi: 'Makan Pagi',
  snack_pagi: 'Snack Pagi',
  siang: 'Makan Siang',
  snack_sore: 'Snack Sore',
  sore: 'Makan Sore',
  snack_malam: 'Snack Malam',
};

export const nutritionCategoryColors: Record<string, string> = {
  makanan_pokok: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  lauk: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  sayur: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  buah: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  snack: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  minuman: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  suplemen: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  lainnya: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

// API

export const nutritionMenuApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; diet_type?: string; is_active?: string }) =>
    api.get('/nutrition/menus', { params }),

  getById: (id: number) =>
    api.get(`/nutrition/menus/${id}`),

  create: (data: Partial<NutritionMenu>) =>
    api.post('/nutrition/menus', data),

  update: (id: number, data: Partial<NutritionMenu>) =>
    api.put(`/nutrition/menus/${id}`, data),

  delete: (id: number) =>
    api.delete(`/nutrition/menus/${id}`),

  getCategories: () =>
    api.get('/nutrition/categories'),

  getDietTypes: () =>
    api.get('/nutrition/diet-types'),

  getMealTimes: () =>
    api.get('/nutrition/meal-times'),
};

export const nutritionPackageApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; diet_type?: string; meal_time?: string; is_active?: string }) =>
    api.get('/nutrition/meal-packages', { params }),

  getById: (id: number) =>
    api.get(`/nutrition/meal-packages/${id}`),

  create: (data: NutritionPackageInput) =>
    api.post('/nutrition/meal-packages', data),

  update: (id: number, data: NutritionPackageInput) =>
    api.put(`/nutrition/meal-packages/${id}`, data),

  delete: (id: number) =>
    api.delete(`/nutrition/meal-packages/${id}`),
};

// ==========================================
// Nutrition Order Types & API
// ==========================================

export interface NutritionOrderItem {
  id: number;
  order_id: number;
  menu_id: number;
  menu?: NutritionMenu;
  quantity: number;
  notes?: string;
}

export interface NutritionOrder {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  visit?: any;
  patient_id: number;
  patient?: any;
  order_date: string;
  meal_time: string;
  diet_type: string;
  status: string;
  package_id?: number;
  package?: NutritionPackage;
  room_name?: string;
  bed_name?: string;
  ordered_by_id?: number;
  ordered_by?: any;
  prepared_at?: string;
  delivered_at?: string;
  delivered_by_id?: number;
  allergy_notes?: string;
  special_notes?: string;
  items?: NutritionOrderItem[];
}

export interface CreateNutritionOrderInput {
  visit_id: number;
  meal_time: string;
  diet_type: string;
  order_date: string;
  package_id?: number;
  allergy_notes?: string;
  special_notes?: string;
  items?: {
    menu_id: number;
    quantity: number;
    notes?: string;
  }[];
}

export const nutritionOrderStatusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Dikonfirmasi',
  preparing: 'Sedang Disiapkan',
  delivered: 'Sudah Diantar',
  cancelled: 'Dibatalkan',
};

export const nutritionOrderStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  preparing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const nutritionOrderApi = {
  getAll: (params?: { visit_id?: number; patient_id?: number; date?: string; status?: string; meal_time?: string; room_name?: string; page?: number; limit?: number }) =>
    api.get('/nutrition/orders', { params }),

  getById: (id: number) =>
    api.get(`/nutrition/orders/${id}`),

  create: (data: CreateNutritionOrderInput) =>
    api.post('/nutrition/orders', data),

  updateStatus: (id: number, status: string) =>
    api.put(`/nutrition/orders/${id}/status`, { status }),

  delete: (id: number) =>
    api.delete(`/nutrition/orders/${id}`),

  getKitchenDashboard: (date?: string) =>
    api.get('/nutrition/kitchen', { params: { date } }),
};
