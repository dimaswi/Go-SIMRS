import { api } from './client';

// ============================================================
// Report API — calls backend /api/reports/* endpoints
// ============================================================

const buildParams = (startDate?: string, endDate?: string, extra?: Record<string, string>) => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (extra) Object.assign(params, extra);
  return { params };
};

const downloadExcel = async (url: string, startDate?: string, endDate?: string, extra?: Record<string, string>) => {
  const params: Record<string, string> = { format: 'excel' };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (extra) Object.assign(params, extra);
  const res = await api.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const disposition = res.headers['content-disposition'];
  link.download = disposition ? disposition.split('filename=')[1]?.replace(/"/g, '') || 'report.xlsx' : 'report.xlsx';
  link.click();
  URL.revokeObjectURL(link.href);
};

// ---- Category A: Kunjungan & Pasien ----
export const reportVisitsApi = {
  daily: (s?: string, e?: string) => api.get('/reports/visits/daily', buildParams(s, e)),
  perPatient: (s?: string, e?: string, limit?: string) => api.get('/reports/visits/per-patient', buildParams(s, e, limit ? { limit } : undefined)),
  byRoom: (s?: string, e?: string) => api.get('/reports/visits/by-room', buildParams(s, e)),
  byDoctor: (s?: string, e?: string) => api.get('/reports/visits/by-doctor', buildParams(s, e)),
  demographics: (s?: string, e?: string) => api.get('/reports/visits/demographics', buildParams(s, e)),
  regions: (s?: string, e?: string, level?: string) => api.get('/reports/visits/regions', buildParams(s, e, level ? { level } : undefined)),
  topDiagnoses: (s?: string, e?: string, limit?: string) => api.get('/reports/visits/top-diagnoses', buildParams(s, e, limit ? { limit } : undefined)),
  newVsOld: (s?: string, e?: string) => api.get('/reports/visits/new-vs-old', buildParams(s, e)),
  paymentMethods: (s?: string, e?: string) => api.get('/reports/visits/payment-methods', buildParams(s, e)),
  referrals: (s?: string, e?: string) => api.get('/reports/visits/referrals', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/visits/${endpoint}`, s, e),
};

// ---- Category B: BPJS ----
export const reportBpjsApi = {
  daily: (s?: string, e?: string) => api.get('/reports/bpjs/daily', buildParams(s, e)),
  sep: (s?: string, e?: string) => api.get('/reports/bpjs/sep', buildParams(s, e)),
  suratKontrol: (s?: string, e?: string) => api.get('/reports/bpjs/surat-kontrol', buildParams(s, e)),
  antrean: (s?: string, e?: string) => api.get('/reports/bpjs/antrean', buildParams(s, e)),
  eklaim: (s?: string, e?: string) => api.get('/reports/bpjs/eklaim', buildParams(s, e)),
  byPoli: (s?: string, e?: string) => api.get('/reports/bpjs/by-poli', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/bpjs/${endpoint}`, s, e),
};

// ---- Category C: Keuangan ----
export const reportBillingApi = {
  dailyRevenue: (s?: string, e?: string) => api.get('/reports/billing/daily-revenue', buildParams(s, e)),
  byPayment: (s?: string, e?: string) => api.get('/reports/billing/by-payment', buildParams(s, e)),
  byRoom: (s?: string, e?: string) => api.get('/reports/billing/by-room', buildParams(s, e)),
  byDoctor: (s?: string, e?: string) => api.get('/reports/billing/by-doctor', buildParams(s, e)),
  receivables: () => api.get('/reports/billing/receivables'),
  byItemType: (s?: string, e?: string) => api.get('/reports/billing/by-item-type', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/billing/${endpoint}`, s, e),
};

// ---- Category D: Rawat Inap ----
export const reportInpatientApi = {
  indicators: (s?: string, e?: string) => api.get('/reports/inpatient/indicators', buildParams(s, e)),
  census: () => api.get('/reports/inpatient/census'),
  list: (s?: string, e?: string) => api.get('/reports/inpatient/list', buildParams(s, e)),
  byRoom: (s?: string, e?: string) => api.get('/reports/inpatient/by-room', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/inpatient/${endpoint}`, s, e),
};

// ---- Category E: Farmasi ----
export const reportPharmacyApi = {
  daily: (s?: string, e?: string) => api.get('/reports/pharmacy/daily', buildParams(s, e)),
  topMedicines: (s?: string, e?: string) => api.get('/reports/pharmacy/top-medicines', buildParams(s, e)),
  byDoctor: (s?: string, e?: string) => api.get('/reports/pharmacy/by-doctor', buildParams(s, e)),
  byDepo: (s?: string, e?: string) => api.get('/reports/pharmacy/by-depo', buildParams(s, e)),
  tat: (s?: string, e?: string) => api.get('/reports/pharmacy/tat', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/pharmacy/${endpoint}`, s, e),
};

// ---- Category F: Penunjang ----
export const reportPenunjangApi = {
  daily: (s?: string, e?: string) => api.get('/reports/penunjang/daily', buildParams(s, e)),
  topLab: (s?: string, e?: string) => api.get('/reports/penunjang/top-lab', buildParams(s, e)),
  topRadiology: (s?: string, e?: string) => api.get('/reports/penunjang/top-radiology', buildParams(s, e)),
  criticalResults: (s?: string, e?: string) => api.get('/reports/penunjang/critical-results', buildParams(s, e)),
  tat: (s?: string, e?: string) => api.get('/reports/penunjang/tat', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/penunjang/${endpoint}`, s, e),
};

// ---- Category G: Layanan ----
export const reportServicesApi = {
  perPatient: (s?: string, e?: string) => api.get('/reports/services/per-patient', buildParams(s, e)),
  summary: (s?: string, e?: string) => api.get('/reports/services/summary', buildParams(s, e)),
  byPayment: (s?: string, e?: string) => api.get('/reports/services/by-payment', buildParams(s, e)),
  byClass: (s?: string, e?: string) => api.get('/reports/services/by-class', buildParams(s, e)),
  surgeryPatients: (s?: string, e?: string) => api.get('/reports/services/surgery-patients', buildParams(s, e)),
  surgerySchedule: (s?: string, e?: string) => api.get('/reports/services/surgery-schedule', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/services/${endpoint}`, s, e),
};

// ---- Category H: Inventaris ----
export const reportInventoryApi = {
  medicineStock: () => api.get('/reports/inventory/medicine-stock'),
  expiredMedicines: () => api.get('/reports/inventory/expired-medicines'),
  stock: () => api.get('/reports/inventory/stock'),
  mutations: (s?: string, e?: string) => api.get('/reports/inventory/mutations', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/inventory/${endpoint}`, s, e),
};

// ---- Category I: SDM ----
export const reportHrApi = {
  summary: () => api.get('/reports/hr/summary'),
  doctors: () => api.get('/reports/hr/doctors'),
  licenseExpiry: () => api.get('/reports/hr/license-expiry'),
  doctorWorkload: (s?: string, e?: string) => api.get('/reports/hr/doctor-workload', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/hr/${endpoint}`, s, e),
};

// ---- Category J: Kemenkes ----
export const reportKemenkesApi = {
  rl12Beds: () => api.get('/reports/kemenkes/rl12-beds'),
  rl31OutpatientDiseases: (s?: string, e?: string) => api.get('/reports/kemenkes/rl31-top-diseases-outpatient', buildParams(s, e)),
  rl32InpatientDiseases: (s?: string, e?: string) => api.get('/reports/kemenkes/rl32-top-diseases-inpatient', buildParams(s, e)),
  rl4aVisits: (s?: string, e?: string) => api.get('/reports/kemenkes/rl4a-visits', buildParams(s, e)),
  rl51Workforce: () => api.get('/reports/kemenkes/rl51-workforce'),
  qualityIndicators: (s?: string, e?: string) => api.get('/reports/kemenkes/quality-indicators', buildParams(s, e)),
  exportExcel: (endpoint: string, s?: string, e?: string) => downloadExcel(`/reports/kemenkes/${endpoint}`, s, e),
};
