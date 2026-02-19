import { api } from './client';

const API_BASE = '/quality-cost';

// ==================== Types ====================

export interface IndicatorStandards {
  bor_min: number;
  bor_max: number;
  alos_min: number;
  alos_max: number;
  toi_min: number;
  toi_max: number;
  bto_min: number;
  bto_max: number;
  ndr_max: number;
  gdr_max: number;
}

export interface HospitalIndicators {
  bor: number;
  alos: number;
  toi: number;
  bto: number;
  ndr: number;
  gdr: number;
  standards: IndicatorStandards;
}

export interface QualityMetricsResponse {
  indicators: HospitalIndicators;
  period: string;
  total_beds: number;
  total_discharges: number;
  total_deaths: number;
  deaths_after_48h: number;
  total_patient_days: number;
}

export interface CostAnalysisSummary {
  total_cases: number;
  total_actual_cost: number;
  total_claim_amount: number;
  cost_recovery_rate: number;
  surplus_cases: number;
  deficit_cases: number;
  total_surplus: number;
  total_deficit: number;
  net_balance: number;
  avg_cost_per_case: number;
  avg_claim_per_case: number;
  drug_cost_ratio: number;
}

export interface CostCaseDetail {
  id: number;
  billing_number: string;
  patient_name: string;
  mrn: string;
  visit_type: string;
  diagnosis: string;
  inacbg_code: string;
  inacbg_tariff: number;
  actual_cost: number;
  difference: number;
  difference_percent: number;
  los: number;
  payment_method: string;
  status: string;
  discharge_date?: string;
}

export interface TopLossCase extends CostCaseDetail {
  loss_reason: string;
}

export interface CostByCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface ClaimAgeGroup {
  age_range: string;
  count: number;
  amount: number;
}

export interface PendingClaimSummary {
  total_pending_claims: number;
  total_pending_amount: number;
  oldest_pending_days: number;
  by_age_group: ClaimAgeGroup[];
}

export interface QualityTrendPoint {
  period: string;
  bor: number;
  alos: number;
}

// ==================== API Functions ====================

export const qualityCostApi = {
  // Quality Metrics
  getQualityMetrics: (period: string = 'month', month?: string) =>
    api.get<{ success: boolean; data: QualityMetricsResponse }>(
      `${API_BASE}/quality-metrics`,
      { params: { period, month } }
    ),

  getQualityTrends: (period: string = 'year', month?: string) =>
    api.get<{ success: boolean; data: QualityTrendPoint[] }>(
      `${API_BASE}/quality-trends`,
      { params: { period, month } }
    ),

  // Cost Analysis
  getCostSummary: (period: string = 'month', paymentMethod?: string, month?: string) =>
    api.get<{ success: boolean; data: CostAnalysisSummary }>(
      `${API_BASE}/cost-summary`,
      { params: { period, payment_method: paymentMethod, month } }
    ),

  getCostCases: (params: {
    period?: string;
    sort_by?: string;
    sort_order?: string;
    payment_method?: string;
    month?: string;
  }) =>
    api.get<{
      success: boolean;
      data: CostCaseDetail[];
      meta: { total: number; page: number; limit: number; pages: number };
    }>(`${API_BASE}/cost-cases`, { params }),

  getTopLossCases: (period: string = 'month', month?: string) =>
    api.get<{ success: boolean; data: TopLossCase[] }>(
      `${API_BASE}/top-loss-cases`,
      { params: { period, month } }
    ),

  getCostByCategory: (period: string = 'month', month?: string) =>
    api.get<{ success: boolean; data: CostByCategory[]; total: number }>(
      `${API_BASE}/cost-by-category`,
      { params: { period, month } }
    ),

  getPendingClaims: () =>
    api.get<{ success: boolean; data: PendingClaimSummary }>(
      `${API_BASE}/pending-claims`
    ),
};

export default qualityCostApi;
