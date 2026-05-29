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
  ingredients?: NutritionMenuIngredient[];
}

export interface NutritionIngredient {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  category?: string;
  default_unit: string;
  default_weight: number;
  is_active: boolean;
  notes?: string;
}

export interface NutritionMenuIngredient {
  id?: number;
  menu_id?: number;
  ingredient_id: number;
  ingredient?: NutritionIngredient;
  weight_per_portion: number;
  unit: string;
  notes?: string;
}

export interface NutritionIngredientInvoiceItem {
  id?: number;
  invoice_id?: number;
  ingredient_id: number;
  ingredient?: NutritionIngredient;
  quantity: number;
  unit: string; // satuan kemasan
  unit_weight: number; // berat/isi per kemasan
  weight_unit: string; // satuan berat/isi
  total_weight: number; // quantity * unit_weight
  unit_price: number;
  line_total: number;
  notes?: string;
}

export interface NutritionIngredientInvoice {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  invoice_number: string;
  invoice_date: string;
  supplier_name?: string;
  received_by_id?: number;
  received_by?: any;
  total_amount: number;
  notes?: string;
  items?: NutritionIngredientInvoiceItem[];
}

export interface NutritionIngredientInvoiceInput {
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  supplier_name?: string;
  notes?: string;
  items: {
    ingredient_id: number;
    quantity: number;
    unit: string;
    unit_price: number;
    notes?: string;
  }[];
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

export const nutritionIngredientUnitLabels: Record<string, string> = {
  gram: 'Gram',
  ml: 'Mililiter',
  pcs: 'Pcs',
  buah: 'Buah',
  sendok_makan: 'Sendok Makan',
  sendok_teh: 'Sendok Teh',
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

  createDietType: (data: { name: string; code?: string; description?: string }) =>
    api.post('/nutrition/diet-types', data),

  getMealTimes: () =>
    api.get('/nutrition/meal-times'),

  getIngredientUnits: () =>
    api.get('/nutrition/ingredient-units'),
};

export const nutritionIngredientApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; is_active?: string }) =>
    api.get('/nutrition/ingredients', { params }),

  getById: (id: number) =>
    api.get(`/nutrition/ingredients/${id}`),

  create: (data: Partial<NutritionIngredient>) =>
    api.post('/nutrition/ingredients', data),

  update: (id: number, data: Partial<NutritionIngredient>) =>
    api.put(`/nutrition/ingredients/${id}`, data),

  delete: (id: number) =>
    api.delete(`/nutrition/ingredients/${id}`),
};

export const nutritionIngredientInvoiceApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; start_date?: string; end_date?: string }) =>
    api.get('/nutrition/invoices', { params }),

  getById: (id: number) =>
    api.get(`/nutrition/invoices/${id}`),

  create: (data: NutritionIngredientInvoiceInput) =>
    api.post('/nutrition/invoices', data),

  update: (id: number, data: NutritionIngredientInvoiceInput) =>
    api.put(`/nutrition/invoices/${id}`, data),

  delete: (id: number) =>
    api.delete(`/nutrition/invoices/${id}`),
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

export interface NutritionIngredientUsageRow {
  ingredient_id: number;
  ingredient_code: string;
  ingredient_name: string;
  ingredient_category?: string;
  unit: string;
  total_usage: number;
}

export interface NutritionIngredientUsageSummary {
  rows: number;
  statuses: string[];
  start_date: string;
  end_date: string;
  meal_time?: string;
  diet_type?: string;
  room_name?: string;
  generated_at: string;
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

export const nutritionReportApi = {
  getIngredientUsage: (params?: { start_date?: string; end_date?: string; status?: string; meal_time?: string; diet_type?: string; room_name?: string }) =>
    api.get('/nutrition/reports/ingredient-usage', { params }),
};
