/**
 * Print API - Backend PDF generation endpoints
 */

import { api } from "./client";

const BASE_URL = "/print";

/**
 * Helper to open PDF in new tab from blob response
 */
const openPdfInNewTab = (blob: Blob) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Don't revoke immediately to allow the tab to load
  setTimeout(() => window.URL.revokeObjectURL(url), 5000);
};

/**
 * Helper for PDF API calls - opens in new tab
 */
const fetchPdf = async (endpoint: string) => {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });
  openPdfInNewTab(response.data);
  return response.data;
};

/**
 * Helper to fetch PDF as blob without opening a new tab
 * Used for embedding PDF in iframe/viewer
 */
const fetchPdfBlob = async (endpoint: string): Promise<Blob> => {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });
  return response.data;
};

/**
 * Fetch PDF blob with signature lookup params appended
 * Used by cetakan tab to tell backend which signature to look up
 */
export const fetchPdfBlobWithSig = async (
  endpoint: string,
  sigType: string,
  sigId: number,
): Promise<Blob> => {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${endpoint}${separator}sig_type=${encodeURIComponent(sigType)}&sig_id=${sigId}`;
  return fetchPdfBlob(url);
};

/**
 * Fetch available document types for a visit
 */
export const fetchAvailableDocs = async (visitId: number): Promise<string[]> => {
  const response = await api.get(`${BASE_URL}/available-docs/${visitId}`);
  return response.data?.available_docs || [];
};

export const printApi = {
  // =========================================================================
  // A. UMUM
  // =========================================================================

  /**
   * Print patient labels
   * @param patientId - Patient ID
   * @param copies - Number of label copies (default: 4)
   */
  patientLabel: async (patientId: number, copies = 4) => {
    return fetchPdf(`${BASE_URL}/patient-label/${patientId}?copies=${copies}`);
  },

  /**
   * Print informed consent / general consent (Persetujuan Umum)
   * @param patientId - Patient ID
   */
  informedConsent: async (patientId: number) => {
    return fetchPdf(`${BASE_URL}/informed-consent/${patientId}`);
  },

  /**
   * Print MR.1 - Ringkasan Masuk dan Keluar Pasien
   * @param registrationId - Registration ID
   */
  admissionDischargeSummary: async (registrationId: number, visitId?: number) => {
    const url = visitId
      ? `${BASE_URL}/admission-discharge-summary/${registrationId}?visit_id=${visitId}`
      : `${BASE_URL}/admission-discharge-summary/${registrationId}`;
    return fetchPdf(url);
  },

  /**
   * Print Bukti Registrasi / Tanda Pendaftaran
   * @param registrationId - Registration ID
   */
  registrationReceipt: async (registrationId: number) => {
    return fetchPdf(`${BASE_URL}/registration-receipt/${registrationId}`);
  },

  /**
   * Print SEP (Surat Eligibilitas Peserta) - BPJS
   * @param sepId - SEP ID
   */
  sep: async (sepId: number) => {
    return fetchPdf(`${BASE_URL}/sep/${sepId}`);
  },

  /**
   * Print SPRI (Surat Perintah Rawat Inap) - BPJS
   * @param spriId - SPRI record ID
   */
  spri: async (spriId: number) => {
    return fetchPdf(`${BASE_URL}/spri/${spriId}`);
  },

  /**
   * Print Surat Kontrol / SKDP - BPJS
   * @param suratKontrolId - SuratKontrol record ID
   */
  suratKontrol: async (suratKontrolId: number) => {
    return fetchPdf(`${BASE_URL}/surat-kontrol/${suratKontrolId}`);
  },

  /**
   * Print Surat Kontrol Umum (SIMRS follow-up)
   * @param registrationId - Follow-up registration ID
   */
  suratKontrolSimrs: async (registrationId: number) => {
    return fetchPdf(`${BASE_URL}/surat-kontrol-simrs/${registrationId}`);
  },

  /**
   * Print Formulir Permohonan DPJP
   * @param visitId - Visit ID
   */
  dpjpRequest: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/dpjp-request/${visitId}`);
  },

  /**
   * Print Bukti Pemberian Informed Consent per Kunjungan
   * @param visitId - Visit ID
   */
  informedConsentReceipt: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/informed-consent-receipt/${visitId}`);
  },

  // =========================================================================
  // B. RAWAT JALAN
  // =========================================================================

  /**
   * Print outpatient resume (Resume Rawat Jalan)
   */
  outpatientResume: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/outpatient-resume/${visitId}`);
  },

  /**
   * Print sick letter (Surat Keterangan Sakit)
   * @param visitId - Visit ID
   * @param days - Number of sick days
   * @param startDate - Start date (YYYY-MM-DD format)
   */
  sickLetter: async (visitId: number, days: number, startDate: string) => {
    return fetchPdf(`${BASE_URL}/sick-letter/${visitId}?days=${days}&start_date=${startDate}`);
  },

  /**
   * Print sick letter by saved record ID
   * @param visitId - Visit ID
   * @param letterId - Sick letter record ID
   */
  sickLetterById: async (visitId: number, letterId: number) => {
    return fetchPdf(`${BASE_URL}/sick-letter/${visitId}?letter_id=${letterId}`);
  },

  /**
   * Print referral letter (Surat Rujukan)
   * @param visitId - Visit ID with disposition type = rujuk
   */
  referralLetter: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/referral-letter/${visitId}`);
  },

  // =========================================================================
  // C. GAWAT DARURAT (UGD)
  // =========================================================================

  /**
   * Print triage form (Formulir Triage UGD)
   */
  triageForm: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/triage/${visitId}`);
  },

  /**
   * Print emergency summary (Ringkasan Pelayanan UGD)
   */
  emergencySummary: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/emergency-summary/${visitId}`);
  },

  // =========================================================================
  // D. RAWAT INAP
  // =========================================================================

  /**
   * Print inpatient resume (Resume Rawat Inap)
   */
  inpatientResume: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/inpatient-resume/${visitId}`);
  },

  /**
   * Print CPPT (Catatan Perkembangan Pasien Terintegrasi)
   */
  cppt: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/cppt/${visitId}`);
  },

  /**
   * Print nursing care (Asuhan Keperawatan SDKI-SLKI-SIKI)
   */
  nursingCare: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/nursing-care/${visitId}`);
  },

  /**
   * Print fluid balance (Catatan Balance Cairan)
   */
  fluidBalance: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/fluid-balance/${visitId}`);
  },

  /**
   * Print bed transfer (Lembar Mutasi Pasien)
   */
  bedTransfer: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/bed-transfer/${visitId}`);
  },

  /**
   * Print unit transfer (Lembar Mutasi Unit Rawat Jalan/UGD)
   */
  unitTransfer: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/unit-transfer/${visitId}`);
  },

  /**
   * Print vital sign chart (Grafik Tanda Vital)
   */
  vitalSignChart: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/vital-sign-chart/${visitId}`);
  },

  /**
   * Print inpatient certificate (Surat Keterangan Rawat Inap)
   */
  inpatientCertificate: async (visitId: number) => {
    return fetchPdf(`${BASE_URL}/inpatient-certificate/${visitId}`);
  },

  /**
   * Print death certificate (Surat Kematian)
   * @param visitId - Visit ID
   * @param certificateId - Death certificate record ID
   */
  deathCertificate: async (visitId: number, certificateId: number) => {
    return fetchPdf(`${BASE_URL}/death-certificate/${visitId}?certificate_id=${certificateId}`);
  },

  /**
   * Print health certificate (Surat Keterangan Sehat)
   * @param visitId - Visit ID
   * @param certificateId - Health certificate record ID
   */
  healthCertificate: async (visitId: number, certificateId: number) => {
    return fetchPdf(`${BASE_URL}/health-certificate/${visitId}?certificate_id=${certificateId}`);
  },

  /**
   * Print birth certificate (Surat Keterangan Kelahiran)
   * @param visitId - Visit ID
   * @param certificateId - Birth certificate record ID
   */
  birthCertificate: async (visitId: number, certificateId: number) => {
    return fetchPdf(`${BASE_URL}/birth-certificate/${visitId}?certificate_id=${certificateId}`);
  },

  /**
   * Print leave certificate (Surat Keterangan Cuti)
   * @param visitId - Visit ID
   * @param certificateId - Leave certificate record ID
   */
  leaveCertificate: async (visitId: number, certificateId: number) => {
    return fetchPdf(`${BASE_URL}/leave-certificate/${visitId}?certificate_id=${certificateId}`);
  },

  /**
   * Print MCU certificate (Surat Keterangan MCU)
   * @param visitId - Visit ID
   * @param certificateId - MCU certificate record ID
   */
  mcuCertificate: async (visitId: number, certificateId: number) => {
    return fetchPdf(`${BASE_URL}/mcu-certificate/${visitId}?certificate_id=${certificateId}`);
  },

  // =========================================================================
  // E. ORDER & PENUNJANG
  // =========================================================================

  /**
   * Print prescription (Resep Obat)
   * @param orderId - Medicine order ID
   */
  prescription: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/prescription/${orderId}`);
  },

  /**
   * Print lab order (Permintaan Pemeriksaan Lab)
   * @param orderId - Procedure order ID
   */
  labOrder: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/lab-order/${orderId}`);
  },

  /**
   * Print lab result (Hasil Pemeriksaan Lab)
   * @param orderId - Procedure order ID
   */
  labResult: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/lab-result/${orderId}`);
  },

  /**
   * Print laboratory result - all items (Hasil Laboratorium - semua item)
   * @param orderId - Procedure order ID
   */
  laboratoryResult: async (orderId: number) => {
    return fetchPdf(`/procedure-orders/${orderId}/print-lab`);
  },

  /**
   * Print laboratory result - single item (Hasil Laboratorium - satu item)
   * @param itemId - Procedure order item ID
   */
  laboratoryResultItem: async (itemId: number) => {
    return fetchPdf(`/procedure-orders/items/${itemId}/print-lab`);
  },

  /**
   * Print radiology result - all items (Hasil Radiologi - semua item)
   * @param orderId - Procedure order ID
   */
  radiologyResult: async (orderId: number) => {
    return fetchPdf(`/procedure-orders/${orderId}/print-radiology`);
  },

  /**
   * Print radiology result - single item (Hasil Radiologi - satu item)
   * @param itemId - Procedure order item ID
   */
  radiologyResultItem: async (itemId: number) => {
    return fetchPdf(`/procedure-orders/items/${itemId}/print-radiology`);
  },

  /**
   * Print procedure order result - generic (Hasil Tindakan - umum/operasi)
   * @param orderId - Procedure order ID
   */
  procedureOrderResult: async (orderId: number) => {
    return fetchPdf(`/procedure-orders/${orderId}/print`);
  },

  /**
   * Print queue ticket (Tiket Antrian - Thermal 100mm x 80mm)
   * @param queueId - Room queue ID
   */
  queueTicket: async (queueId: number) => {
    return fetchPdf(`${BASE_URL}/queue-ticket/${queueId}`);
  },

  /**
   * Print registration ticket (Tiket Registrasi - Thermal 100mm x 80mm)
   * @param registrationId - Registration ID
   */
  registrationTicket: async (registrationId: number) => {
    return fetchPdf(`${BASE_URL}/registration-ticket/${registrationId}`);
  },

  /**
   * Print medicine label - single item (Etiket Obat - Thermal 100mm x 40mm)
   * @param itemId - Medicine order item ID
   */
  medicineLabel: async (itemId: number) => {
    return fetchPdf(`${BASE_URL}/medicine-label/${itemId}`);
  },

  /**
   * Print medicine labels - all items in order (Etiket Obat - Thermal 100mm x 40mm per label)
   * @param orderId - Medicine order ID
   */
  medicineLabels: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/medicine-labels/${orderId}`);
  },

  /**
   * Print prescription thermal (Resep Obat - Thermal 100mm width) for patient
   * @param orderId - Medicine order ID
   */
  prescriptionThermal: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/prescription-thermal/${orderId}`);
  },

  // =========================================================================
  // G. BILLING & KEUANGAN
  // =========================================================================

  /**
   * Print billing invoice (Faktur/Kuitansi Pembayaran)
   * @param billingId - Billing ID
   * @param options - Optional: mode ('per_visit') or visit_id filter
   */
  billing: async (billingId: number, options?: { mode?: string; visit_id?: number }) => {
    let url = `${BASE_URL}/billing/${billingId}`;
    const params = new URLSearchParams();
    if (options?.mode) params.set('mode', options.mode);
    if (options?.visit_id) params.set('visit_id', String(options.visit_id));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return fetchPdf(url);
  },

  /**
   * Print nutrition food etiket (thermal label)
   * @param orderId - Nutrition order ID
   */
  nutritionEtiket: async (orderId: number) => {
    return fetchPdf(`${BASE_URL}/nutrition-etiket/${orderId}`);
  },

  // =========================================================================
  // H. BLOB (return PDF blob for embedding, no new tab)
  // =========================================================================

  blob: {
    informedConsent: (patientId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/informed-consent/${patientId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    admissionDischargeSummary: (registrationId: number, visitId?: number, rmDuplicateId?: number) => {
      const params = new URLSearchParams();
      if (visitId) params.append('visit_id', visitId.toString());
      if (rmDuplicateId) params.append('rm_duplicate_id', rmDuplicateId.toString());
      const qs = params.toString();
      return fetchPdfBlob(`${BASE_URL}/admission-discharge-summary/${registrationId}${qs ? `?${qs}` : ''}`);
    },
    registrationReceipt: (registrationId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/registration-receipt/${registrationId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    outpatientResume: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/outpatient-resume/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    inpatientResume: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/inpatient-resume/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    sickLetter: (visitId: number, days: number, startDate: string) =>
      fetchPdfBlob(`${BASE_URL}/sick-letter/${visitId}?days=${days}&start_date=${startDate}`),
    sickLetterById: (visitId: number, letterId: number) =>
      fetchPdfBlob(`${BASE_URL}/sick-letter/${visitId}?letter_id=${letterId}`),
    referralLetter: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/referral-letter/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    inpatientCertificate: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/inpatient-certificate/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    deathCertificate: (visitId: number, certificateId: number) =>
      fetchPdfBlob(`${BASE_URL}/death-certificate/${visitId}?certificate_id=${certificateId}`),
    triageForm: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/triage/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    emergencySummary: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/emergency-summary/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    cppt: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/cppt/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    nursingCare: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/nursing-care/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    fluidBalance: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/fluid-balance/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    bedTransfer: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/bed-transfer/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    vitalSignChart: (visitId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/vital-sign-chart/${visitId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    prescription: (orderId: number) => fetchPdfBlob(`${BASE_URL}/prescription/${orderId}`),
    prescriptionThermal: (orderId: number) => fetchPdfBlob(`${BASE_URL}/prescription-thermal/${orderId}`),
    labOrder: (orderId: number) => fetchPdfBlob(`${BASE_URL}/lab-order/${orderId}`),
    labResult: (orderId: number) => fetchPdfBlob(`${BASE_URL}/lab-result/${orderId}`),
    laboratoryResult: (orderId: number) => fetchPdfBlob(`/procedure-orders/${orderId}/print-lab`),
    radiologyResult: (orderId: number) => fetchPdfBlob(`/procedure-orders/${orderId}/print-radiology`),
    procedureOrderResult: (orderId: number) => fetchPdfBlob(`/procedure-orders/${orderId}/print`),
    queueTicket: (queueId: number) => fetchPdfBlob(`${BASE_URL}/queue-ticket/${queueId}`),
    medicineLabel: (itemId: number) => fetchPdfBlob(`${BASE_URL}/medicine-label/${itemId}`),
    medicineLabels: (orderId: number) => fetchPdfBlob(`${BASE_URL}/medicine-labels/${orderId}`),
    billing: (billingId: number) => fetchPdfBlob(`${BASE_URL}/billing/${billingId}`),
    nutritionEtiket: (orderId: number) => fetchPdfBlob(`${BASE_URL}/nutrition-etiket/${orderId}`),
    sep: (sepId: number, rmDuplicateId?: number) =>
      fetchPdfBlob(`${BASE_URL}/sep/${sepId}${rmDuplicateId ? `?rm_duplicate_id=${rmDuplicateId}` : ''}`),
    spri: (spriId: number) => fetchPdfBlob(`${BASE_URL}/spri/${spriId}`),
    suratKontrol: (suratKontrolId: number) => fetchPdfBlob(`${BASE_URL}/surat-kontrol/${suratKontrolId}`),

    // RM Duplicate Order Prints
    rmDuplicateLabOrder: (rmOrderId: number) => fetchPdfBlob(`${BASE_URL}/rm-duplicate/lab-order/${rmOrderId}`),
    rmDuplicateLabResult: (rmOrderId: number) => fetchPdfBlob(`${BASE_URL}/rm-duplicate/lab-result/${rmOrderId}`),
    rmDuplicateRadiologyResult: (rmOrderId: number) => fetchPdfBlob(`${BASE_URL}/rm-duplicate/radiology-result/${rmOrderId}`),
    rmDuplicateProcedureResult: (rmOrderId: number) => fetchPdfBlob(`${BASE_URL}/rm-duplicate/procedure-result/${rmOrderId}`),
  },
};
