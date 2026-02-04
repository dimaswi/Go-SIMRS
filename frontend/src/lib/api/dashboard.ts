import { api } from './client';

// Dashboard Stats Types
export interface DashboardStats {
  // Patient Statistics
  total_patients: number;
  new_patients_today: number;
  new_patients_week: number;
  new_patients_month: number;
  active_patients: number;

  // Registration/Visit Statistics
  total_registrations: number;
  registrations_today: number;
  registrations_week: number;
  registrations_month: number;
  outpatient_today: number;
  inpatient_today: number;
  emergency_today: number;

  // Visit Statistics
  total_visits: number;
  visits_today: number;
  visits_week: number;
  visits_month: number;
  visits_in_progress: number;
  visits_waiting: number;
  visits_completed_today: number;

  // Billing Statistics
  total_revenue: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  pending_billings: number;
  paid_billings_today: number;
  total_billing_amount: number;
  unpaid_billing_amount: number;

  // Bed/Inpatient Statistics
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  bed_occupancy_rate: number;
  current_inpatients: number;

  // Medicine Order Statistics
  total_medicine_orders: number;
  medicine_orders_today: number;
  pending_medicine_orders: number;
  completed_medicine_orders_today: number;

  // Procedure Order Statistics
  total_procedure_orders: number;
  procedure_orders_today: number;
  pending_procedure_orders: number;
  lab_orders_today: number;
  radiology_orders_today: number;

  // Employee Statistics
  total_employees: number;
  total_doctors: number;
  total_nurses: number;
  active_employees: number;

  // Room Statistics
  total_rooms: number;
  active_rooms: number;
  poliklinik_rooms: number;
  inpatient_rooms: number;

  // Inventory Statistics
  total_inventory_items: number;
  low_stock_items: number;

  // Medicine Statistics
  total_medicines: number;
  low_stock_medicines: number;
}

export interface DashboardTrend {
  label: string;
  value: number;
  count: number;
}

export interface RoomVisitCount {
  room_id: number;
  room_name: string;
  room_code: string;
  count: number;
}

export interface DoctorVisitCount {
  doctor_id: number;
  doctor_name: string;
  count: number;
}

export interface ProcedureCount {
  procedure_id: number;
  procedure_name: string;
  procedure_code: string;
  count: number;
}

export interface MedicineCount {
  medicine_id: number;
  medicine_name: string;
  medicine_code: string;
  count: number;
}

export interface DiagnosisCount {
  diagnosis: string;
  count: number;
}

export interface DashboardCharts {
  registration_trends: DashboardTrend[];
  revenue_trends: DashboardTrend[];
  visit_type_trends: DashboardTrend[];
  payment_method_trends: DashboardTrend[];
  top_rooms: RoomVisitCount[];
  top_doctors: DoctorVisitCount[];
  top_procedures: ProcedureCount[];
  top_medicines: MedicineCount[];
  top_diagnoses: DiagnosisCount[];
}

export interface DashboardSummary {
  today: {
    registrations: number;
    visits: number;
    revenue: number;
    new_patients: number;
    registrations_change: number;
    visits_change: number;
    revenue_change: number;
  };
  week: {
    registrations: number;
    visits: number;
    revenue: number;
    registrations_change: number;
    revenue_change: number;
  };
  month: {
    registrations: number;
    visits: number;
    revenue: number;
    registrations_change: number;
    revenue_change: number;
  };
  queue_status: {
    waiting: number;
    in_progress: number;
    completed: number;
  };
}

export interface RoomBedStatus {
  room_id: number;
  room_name: string;
  room_code: string;
  room_class: string;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_rate: number;
}

export interface BedMonitoringData {
  rooms: RoomBedStatus[];
  summary: {
    total_beds: number;
    occupied_beds: number;
    available_beds: number;
    occupancy_rate: number;
  };
}

export interface RecentActivity {
  recent_registrations: any[];
  recent_visits: any[];
  recent_payments: any[];
}

// Dashboard API
export const dashboardApi = {
  // Get main dashboard statistics
  getStats: () => api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats'),

  // Get chart data
  getCharts: (period: 'week' | 'month' | 'year' = 'week') =>
    api.get<{ success: boolean; data: DashboardCharts }>(`/dashboard/charts?period=${period}`),

  // Get dashboard summary with comparisons
  getSummary: () => api.get<{ success: boolean; data: DashboardSummary }>('/dashboard/summary'),

  // Get recent activity
  getRecentActivity: (limit: number = 10) =>
    api.get<{ success: boolean; data: RecentActivity }>(`/dashboard/recent?limit=${limit}`),

  // Get bed monitoring data
  getBedMonitoring: () =>
    api.get<{ success: boolean; data: BedMonitoringData }>('/dashboard/bed-monitoring'),
};
