import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { DOCUMENT_TYPES, printApi } from "@/lib/api";

export type MRPrintStatus = "ready" | "partial" | "missing-data" | "unavailable";

export interface MRPrintEntry {
  key: string;
  mrCode: string;
  title: string;
  category: string;
  status: MRPrintStatus;
  description: string;
  handler?: () => Promise<void>;
  documentType?: string;
  documentId?: number;
  sourceVisitId?: number;
}

export interface MRPrintContext {
  visitId: number;
  visit: any;
  medicalRecord: any;
  medicineOrders: any[];
  procedureOrders: any[];
  sickLetters: any[];
  healthCertificates: any[];
  birthCertificates: any[];
  leaveCertificates: any[];
  mcuCertificates: any[];
  deathCertificates: any[];
  unitTransfers: any[];
  spriDoc: any;
  suratKontrolDoc: any;
  isUGDVisit: boolean;
  isInpatientVisit: boolean;
  isPharmacyVisit: boolean;
  hasAnamnesis: boolean;
  hasDiagnosis: boolean;
  hasAnyMedicalData: boolean;
  hasTriage: boolean;
  hasReferral: boolean;
  followUpRegistrationId?: number | null;
  completedLabOrders: any[];
  completedRadiologyOrders: any[];
  completedSurgeryOrders: any[];
  completedConsultationOrders: any[];
  completedMedicineOrders: any[];
  pharmacyMedicineOrders: any[];
  hasBersalin: boolean;
}

interface MRMeta {
  code: string;
  title: string;
  category: string;
}

const mr51: MRMeta = {
  code: "MR.51",
  title: "Surat-Surat & Keterangan",
  category: "Lainnya",
};

type MRBuilder = (ctx: MRPrintContext) => MRPrintEntry[];

const formatDateShort = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd/MM/yy", { locale: localeId });
  } catch {
    return "";
  }
};

const makeEntry = (
  meta: MRMeta,
  status: MRPrintStatus,
  description: string,
  overrides: Partial<MRPrintEntry> = {},
): MRPrintEntry => ({
  key: `${meta.code}-${overrides.key ?? meta.title.toLowerCase().replace(/\s+/g, "-")}`,
  mrCode: meta.code,
  title: meta.title,
  category: meta.category,
  status,
  description,
  ...overrides,
});

const makeCollectionEntries = (
  meta: MRMeta,
  items: any[],
  build: (item: any, index: number) => Partial<MRPrintEntry> & { description: string },
  emptyDescription: string,
): MRPrintEntry[] => {
  if (items.length === 0) {
    return [makeEntry(meta, "missing-data", emptyDescription)];
  }

  return items.map((item, index) => {
    const built = build(item, index);
    return makeEntry(meta, built.status ?? "ready", built.description, built);
  });
};

const mr00: MRMeta = { code: "MR.0", title: "Identitas Pasien / Label", category: "Umum" };
const mr01: MRMeta = { code: "MR.01", title: "Ringkasan Masuk dan Keluar", category: "Umum" };
const mr02: MRMeta = { code: "MR.02", title: "Anamnesis dan Pemeriksaan Dokter", category: "Rawat Jalan" };
const mr03: MRMeta = { code: "MR.03", title: "Asesmen Awal Medis Rawat Jalan", category: "Rawat Jalan" };
const mr04: MRMeta = { code: "MR.04", title: "Asesmen Awal Medis Rawat Inap", category: "Rawat Inap" };
const mr05: MRMeta = { code: "MR.05", title: "Asesmen Awal Keperawatan", category: "Rawat Inap" };
const mr06: MRMeta = { code: "MR.06", title: "Triage / Asesmen Gawat Darurat", category: "UGD" };
const mr07: MRMeta = { code: "MR.07", title: "CPPT", category: "Rawat Inap" };
const mr08: MRMeta = { code: "MR.08", title: "Catatan Harian Dokter", category: "Rawat Inap" };
const mr09: MRMeta = { code: "MR.09", title: "Catatan Asuhan Keperawatan", category: "Rawat Inap" };
const mr10: MRMeta = { code: "MR.10", title: "Observasi Tanda Vital / Monitoring", category: "Rawat Inap" };
const mr11: MRMeta = { code: "MR.11", title: "Lembar Instruksi Dokter", category: "Rawat Inap" };
const mr12: MRMeta = { code: "MR.12", title: "Lembar Pemberian Obat / MAR", category: "Farmasi" };
const mr13: MRMeta = { code: "MR.13", title: "Order Obat / Resep", category: "Farmasi" };
const mr14: MRMeta = { code: "MR.14", title: "Telaah Resep / Verifikasi Farmasi", category: "Farmasi" };
const mr15: MRMeta = { code: "MR.15", title: "Penyerahan Obat / PIO", category: "Farmasi" };
const mr16: MRMeta = { code: "MR.16", title: "Hasil Laboratorium", category: "Laboratorium" };
const mr17: MRMeta = { code: "MR.17", title: "Hasil Radiologi", category: "Radiologi" };
const mr18: MRMeta = { code: "MR.18", title: "Hasil Penunjang Lain", category: "Penunjang" };
const mr19: MRMeta = { code: "MR.19", title: "Permintaan Laboratorium", category: "Laboratorium" };
const mr20: MRMeta = { code: "MR.20", title: "Permintaan Radiologi", category: "Radiologi" };
const mr21: MRMeta = { code: "MR.21", title: "Konsultasi Antar Dokter", category: "Konsultasi" };
const mr22: MRMeta = { code: "MR.22", title: "Daftar Masalah / Diagnosis", category: "Rawat Jalan" };
const mr23: MRMeta = { code: "MR.23", title: "ICD Diagnosis dan Prosedur", category: "Klaim" };
const mr24: MRMeta = { code: "MR.24", title: "Persetujuan Tindakan Medis", category: "Legal" };
const mr25: MRMeta = { code: "MR.25", title: "Penolakan Tindakan Medis", category: "Legal" };
const mr26: MRMeta = { code: "MR.26", title: "Persetujuan Anestesi", category: "Operasi" };
const mr27: MRMeta = { code: "MR.27", title: "Checklist Keselamatan Operasi", category: "Operasi" };
const mr28: MRMeta = { code: "MR.28", title: "Laporan Operasi / Tindakan", category: "Operasi" };
const mr29: MRMeta = { code: "MR.29", title: "Catatan Anestesi", category: "Operasi" };
const mr30: MRMeta = { code: "MR.30", title: "Catatan Pemulihan / Recovery Room", category: "Operasi" };
const mr31: MRMeta = { code: "MR.31", title: "Catatan Transfusi Darah", category: "Rawat Inap" };
const mr32: MRMeta = { code: "MR.32", title: "Intake Output / Balance Cairan", category: "Rawat Inap" };
const mr33: MRMeta = { code: "MR.33", title: "Lembar Nutrisi / Asesmen Gizi", category: "Gizi" };
const mr34: MRMeta = { code: "MR.34", title: "Discharge Planning", category: "Rawat Inap" };
const mr35: MRMeta = { code: "MR.35", title: "Resume Medis / Ringkasan Pulang", category: "Resume" };
const mr36: MRMeta = { code: "MR.36", title: "Surat Kontrol / Tindak Lanjut", category: "Surat" };
const mr37: MRMeta = { code: "MR.37", title: "Surat Rujukan Masuk", category: "Surat" };
const mr38: MRMeta = { code: "MR.38", title: "Surat Rujukan Keluar", category: "Surat" };
const mr39: MRMeta = { code: "MR.39", title: "Surat Keterangan Sakit / Sehat", category: "Surat" };
const mr40: MRMeta = { code: "MR.40", title: "Surat Kematian", category: "Surat" };
const mr41: MRMeta = { code: "MR.41", title: "Kejadian Khusus / Insiden Keselamatan", category: "Mutu" };
const mr42: MRMeta = { code: "MR.42", title: "Edukasi Pasien dan Keluarga", category: "Edukasi" };
const mr43: MRMeta = { code: "MR.43", title: "Persetujuan Pulang Paksa / APS", category: "Legal" };
const mr44: MRMeta = { code: "MR.44", title: "Isolasi / Infeksi / Surveilans", category: "Rawat Inap" };
const mr45: MRMeta = { code: "MR.45", title: "Rehabilitasi Medik / Fisioterapi", category: "Rehab" };
const mr46: MRMeta = { code: "MR.46", title: "Hemodialisa", category: "Penunjang" };
const mr47: MRMeta = { code: "MR.47", title: "Kebidanan / Partograf / Persalinan", category: "Kebidanan" };
const mr48: MRMeta = { code: "MR.48", title: "Neonatal / Bayi Baru Lahir", category: "Kebidanan" };
const mr49: MRMeta = { code: "MR.49", title: "Imunisasi / Tumbuh Kembang", category: "Anak" };
const mr50: MRMeta = { code: "MR.50", title: "Klaim / Kelengkapan BPJS / SEP", category: "Klaim" };

function buildMR00(ctx: MRPrintContext): MRPrintEntry[] {
  const patientId = ctx.visit?.registration?.patient?.id;
  if (!patientId) {
    return [makeEntry(mr00, "missing-data", "Data pasien belum lengkap untuk mencetak label identitas.")];
  }

  return [
    makeEntry(mr00, "ready", "Cetak label pasien sesuai style label saat ini.", {
      handler: () => printApi.patientLabel(patientId, 4),
      key: "patient-label",
    }),
  ];
}

function buildMR01(ctx: MRPrintContext): MRPrintEntry[] {
  const registrationId = ctx.visit?.registration_id;
  if (!registrationId) {
    return [makeEntry(mr01, "missing-data", "Registrasi kunjungan belum ditemukan.")];
  }

  return [
    makeEntry(mr01, "ready", "Cetak ringkasan masuk dan keluar pasien.", {
      handler: () => printApi.admissionDischargeSummary(registrationId, ctx.visitId),
      key: "admission-discharge-summary",
    }),
  ];
}

function buildMR02(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.hasAnamnesis && !ctx.hasDiagnosis) {
    return [makeEntry(mr02, "missing-data", "Belum ada data anamnesis atau pemeriksaan dokter di kunjungan ini.")];
  }
  return [makeEntry(mr02, "partial", "Modul klinis tersedia, tetapi belum ada cetakan khusus MR.02.")];
}

function buildMR03(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.hasAnyMedicalData) {
    return [makeEntry(mr03, "missing-data", "Asesmen awal rawat jalan belum terisi.")];
  }
  return [makeEntry(mr03, "partial", "Elemen asesmen tersedia, tetapi belum dirakit menjadi cetakan MR.03 khusus.")];
}

function buildMR04(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr04, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  return [makeEntry(mr04, "partial", "Asesmen rawat inap ada di modul, tetapi belum ada cetakan MR.04 khusus.")];
}

function buildMR05(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr05, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  return [makeEntry(mr05, "partial", "Asuhan keperawatan ada, tetapi asesmen awal keperawatan belum punya cetakan khusus.")];
}

function buildMR06(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isUGDVisit) {
    return [makeEntry(mr06, "missing-data", "Kunjungan ini bukan UGD.")];
  }
  if (!ctx.hasTriage) {
    return [makeEntry(mr06, "missing-data", "Form triage belum tersedia di kunjungan ini.")];
  }
  return [
    makeEntry(mr06, "ready", "Cetak formulir triage UGD.", {
      handler: () => printApi.triageForm(ctx.visitId),
      documentType: DOCUMENT_TYPES.TRIAGE,
      documentId: ctx.visitId,
      key: "triage",
    }),
  ];
}

function buildMR07(ctx: MRPrintContext): MRPrintEntry[] {
  const count = ctx.medicalRecord?.cppt_count || 0;
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr07, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  if (count <= 0) {
    return [makeEntry(mr07, "missing-data", "Belum ada entri CPPT untuk dicetak.")];
  }
  return [
    makeEntry(mr07, "ready", `Cetak CPPT (${count} entri).`, {
      handler: () => printApi.cppt(ctx.visitId),
      documentType: DOCUMENT_TYPES.CPPT,
      documentId: ctx.visitId,
      key: "cppt",
    }),
  ];
}

function buildMR08(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr08, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  return [makeEntry(mr08, "partial", "Catatan harian dokter masih tergabung di CPPT, belum ada cetakan terpisah.")];
}

function buildMR09(ctx: MRPrintContext): MRPrintEntry[] {
  const count = ctx.medicalRecord?.nursing_care_count || 0;
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr09, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  if (count <= 0) {
    return [makeEntry(mr09, "missing-data", "Belum ada catatan asuhan keperawatan untuk dicetak.")];
  }
  return [
    makeEntry(mr09, "ready", `Cetak asuhan keperawatan (${count} entri).`, {
      handler: () => printApi.nursingCare(ctx.visitId),
      documentType: DOCUMENT_TYPES.NURSING_CARE,
      documentId: ctx.visitId,
      key: "nursing-care",
    }),
  ];
}

function buildMR10(ctx: MRPrintContext): MRPrintEntry[] {
  const count = ctx.medicalRecord?.vital_sign_count || 0;
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr10, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  if (count <= 0) {
    return [makeEntry(mr10, "missing-data", "Belum ada data grafik tanda vital untuk dicetak.")];
  }
  return [
    makeEntry(mr10, "ready", `Cetak grafik vital sign (${count} entri).`, {
      handler: () => printApi.vitalSignChart(ctx.visitId),
      documentType: DOCUMENT_TYPES.VITAL_SIGN,
      documentId: ctx.visitId,
      key: "vital-sign",
    }),
  ];
}

function buildMR11(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr11, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  return [makeEntry(mr11, "partial", "Instruksi dokter masih menyatu dengan CPPT/assessment-plan, belum ada cetakan khusus.")];
}

function buildMR12(): MRPrintEntry[] {
  return [makeEntry(mr12, "partial", "Timesheet pemberian obat tersedia di workflow, tetapi belum ada cetakan MR.12 khusus.")];
}

function buildMR13(ctx: MRPrintContext): MRPrintEntry[] {
  if (ctx.isPharmacyVisit) {
    return makeCollectionEntries(
      mr13,
      ctx.pharmacyMedicineOrders,
      (order, index) => ({
        key: `prescription-thermal-${order.id}`,
        title: `${mr13.title} #${index + 1}`,
        description: "Cetak resep pasien versi thermal dari workstation farmasi.",
        handler: () => printApi.prescriptionThermal(order.id),
      }),
      "Belum ada resep farmasi yang bisa dicetak di kunjungan ini.",
    );
  }

  return makeCollectionEntries(
    mr13,
    ctx.completedMedicineOrders,
    (order, index) => {
      const orderDate = formatDateShort(order.created_at);
      return {
        key: `prescription-${order.id}`,
        title: `${mr13.title} ${orderDate || `#${index + 1}`}`.trim(),
        description: "Cetak resep obat dari order yang sudah selesai/diserahkan.",
        handler: () => printApi.prescription(order.id),
        documentType: DOCUMENT_TYPES.PRESCRIPTION,
        documentId: order.id,
      };
    },
    "Belum ada order obat selesai yang bisa dicetak.",
  );
}

function buildMR14(ctx: MRPrintContext): MRPrintEntry[] {
  const hasReview =
    ctx.medicineOrders.some((order) => order?.initial_review_completed || order?.final_review_completed) ||
    ctx.pharmacyMedicineOrders.length > 0;
  if (!hasReview) {
    return [makeEntry(mr14, "missing-data", "Belum ada aktivitas telaah resep pada kunjungan ini.")];
  }
  return [makeEntry(mr14, "partial", "Telaah resep tersedia di workflow farmasi, tetapi belum ada cetakan khusus MR.14.")];
}

function buildMR15(ctx: MRPrintContext): MRPrintEntry[] {
  const hasDispense = ctx.medicineOrders.some((order) => order?.final_review_completed || order?.status === "dispensed" || order?.status === "completed");
  if (!hasDispense) {
    return [makeEntry(mr15, "missing-data", "Belum ada penyerahan obat / PIO pada kunjungan ini.")];
  }
  return [makeEntry(mr15, "partial", "Penyerahan obat dan PIO tersedia di workflow, tetapi belum ada cetakan khusus MR.15.")];
}

function buildMR16(ctx: MRPrintContext): MRPrintEntry[] {
  return makeCollectionEntries(
    mr16,
    ctx.completedLabOrders,
    (order, index) => ({
      key: `lab-result-${order.id}`,
      title: `${mr16.title} ${formatDateShort(order.completed_at || order.created_at) || `#${index + 1}`}`.trim(),
      description: "Cetak hasil laboratorium dari order yang selesai.",
      handler: () => printApi.laboratoryResult(order.id),
      documentType: DOCUMENT_TYPES.LAB_RESULT,
      documentId: order.id,
      sourceVisitId: order.source_visit_id,
    }),
    "Belum ada hasil laboratorium yang selesai.",
  );
}

function buildMR17(ctx: MRPrintContext): MRPrintEntry[] {
  return makeCollectionEntries(
    mr17,
    ctx.completedRadiologyOrders,
    (order, index) => ({
      key: `radiology-result-${order.id}`,
      title: `${mr17.title} ${formatDateShort(order.completed_at || order.created_at) || `#${index + 1}`}`.trim(),
      description: "Cetak hasil radiologi dari order yang selesai.",
      handler: () => printApi.radiologyResult(order.id),
      documentType: DOCUMENT_TYPES.RADIOLOGY_RESULT,
      documentId: order.id,
      sourceVisitId: order.source_visit_id,
    }),
    "Belum ada hasil radiologi yang selesai.",
  );
}

function buildMR18(ctx: MRPrintContext): MRPrintEntry[] {
  if (ctx.completedSurgeryOrders.length > 0) {
    return makeCollectionEntries(
      mr18,
      ctx.completedSurgeryOrders,
      (order, index) => ({
        key: `procedure-result-${order.id}`,
        title: `${mr18.title} ${formatDateShort(order.completed_at || order.created_at) || `#${index + 1}`}`.trim(),
        description: "Cetak hasil penunjang/tindakan yang memakai print prosedur generik.",
        handler: () => printApi.procedureOrderResult(order.id),
        documentType: DOCUMENT_TYPES.OPERATIVE_REPORT,
        documentId: order.id,
        sourceVisitId: order.source_visit_id,
      }),
      "Belum ada hasil penunjang lain yang selesai.",
    );
  }

  return [makeEntry(mr18, "partial", "Jejak penunjang lain ada di modul, tetapi belum ada registry cetak khusus yang lengkap.")];
}

function buildMR19(ctx: MRPrintContext): MRPrintEntry[] {
  const orders = ctx.procedureOrders.filter((order) => order.order_type === "laboratory");
  return makeCollectionEntries(
    mr19,
    orders,
    (order, index) => ({
      key: `lab-order-${order.id}`,
      title: `${mr19.title} ${formatDateShort(order.created_at) || `#${index + 1}`}`.trim(),
      description: "Cetak permintaan pemeriksaan laboratorium.",
      handler: () => printApi.labOrder(order.id),
      sourceVisitId: order.source_visit_id,
    }),
    "Belum ada permintaan laboratorium di kunjungan ini.",
  );
}

function buildMR20(ctx: MRPrintContext): MRPrintEntry[] {
  const orders = ctx.procedureOrders.filter((order) => order.order_type === "radiology");
  if (orders.length === 0) {
    return [makeEntry(mr20, "missing-data", "Belum ada permintaan radiologi di kunjungan ini.")];
  }
  return [makeEntry(mr20, "partial", "Order radiologi tersedia, tetapi belum ada endpoint cetak order radiologi yang dedicated.")];
}

function buildMR21(ctx: MRPrintContext): MRPrintEntry[] {
  return makeCollectionEntries(
    mr21,
    ctx.completedConsultationOrders,
    (order, index) => ({
      key: `consultation-result-${order.id}`,
      title: `${mr21.title} ${formatDateShort(order.completed_at || order.created_at) || `#${index + 1}`}`.trim(),
      description: "Cetak hasil konsultasi antar dokter.",
      handler: () => printApi.procedureOrderResult(order.id),
      documentType: DOCUMENT_TYPES.CONSULTATION_RESULT,
      documentId: order.id,
      sourceVisitId: order.source_visit_id,
    }),
    "Belum ada hasil konsultasi yang selesai.",
  );
}

function buildMR22(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.hasDiagnosis) {
    return [makeEntry(mr22, "missing-data", "Belum ada diagnosis pada kunjungan ini.")];
  }
  return [makeEntry(mr22, "partial", "Diagnosis tersedia di modul, tetapi belum ada cetakan daftar masalah / diagnosis khusus.")];
}

function buildMR23(): MRPrintEntry[] {
  return [makeEntry(mr23, "partial", "Coding ICD dan klaim tersedia di modul klaim, tetapi belum dipusatkan ke print launcher ini.")];
}

function buildMR24(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.visitId) {
    return [makeEntry(mr24, "missing-data", "Kunjungan belum valid untuk cetak informed consent.")];
  }
  const entries: MRPrintEntry[] = [
    makeEntry(mr24, "ready", "Cetak Persetujuan Tindakan Kedokteran (Informed Consent).", {
      handler: () => printApi.informedConsentReceipt(ctx.visitId),
      documentType: DOCUMENT_TYPES.INFORMED_CONSENT,
      documentId: ctx.visitId,
      key: "informed-consent-receipt",
    }),
  ];
  if (ctx.isInpatientVisit) {
    entries.push(
      makeEntry(mr24, "ready", "Cetak Persetujuan Umum Rawat Inap (General Consent).", {
        handler: () => printApi.generalConsentInpatient(ctx.visitId),
        documentType: DOCUMENT_TYPES.GENERAL_CONSENT_INPATIENT,
        documentId: ctx.visitId,
        key: "general-consent-inpatient",
      })
    );
  }
  return entries;
}

function buildMR25(): MRPrintEntry[] {
  return [makeEntry(mr25, "unavailable", "Belum ditemukan modul atau cetakan penolakan tindakan medis.")];
}

function buildMR26(): MRPrintEntry[] {
  return [makeEntry(mr26, "partial", "Jejak anestesi ada di modul tindakan, tetapi belum ada cetakan persetujuan anestesi khusus.")];
}

function buildMR27(): MRPrintEntry[] {
  return [makeEntry(mr27, "partial", "Checklist keselamatan operasi belum punya workflow cetak yang dedicated.")];
}

function buildMR28(ctx: MRPrintContext): MRPrintEntry[] {
  return makeCollectionEntries(
    mr28,
    ctx.completedSurgeryOrders,
    (order, index) => ({
      key: `operative-report-${order.id}`,
      title: `${mr28.title} ${formatDateShort(order.completed_at || order.created_at) || `#${index + 1}`}`.trim(),
      description: "Cetak hasil operasi / tindakan dari order yang selesai.",
      handler: () => printApi.procedureOrderResult(order.id),
      documentType: DOCUMENT_TYPES.OPERATIVE_REPORT,
      documentId: order.id,
      sourceVisitId: order.source_visit_id,
    }),
    "Belum ada order operasi / tindakan yang selesai.",
  );
}

function buildMR29(): MRPrintEntry[] {
  return [makeEntry(mr29, "unavailable", "Belum ada modul/cetakan catatan anestesi khusus.")];
}

function buildMR30(): MRPrintEntry[] {
  return [makeEntry(mr30, "unavailable", "Belum ada modul/cetakan recovery room khusus.")];
}

function buildMR31(): MRPrintEntry[] {
  return [makeEntry(mr31, "partial", "Ada jejak transfusi di balance cairan, tetapi belum ada cetakan khusus transfusi darah.")];
}

function buildMR32(ctx: MRPrintContext): MRPrintEntry[] {
  const count = ctx.medicalRecord?.fluid_balance_count || 0;
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr32, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  if (count <= 0) {
    return [makeEntry(mr32, "missing-data", "Belum ada data balance cairan untuk dicetak.")];
  }
  return [
    makeEntry(mr32, "ready", `Cetak balance cairan (${count} entri).`, {
      handler: () => printApi.fluidBalance(ctx.visitId),
      documentType: DOCUMENT_TYPES.FLUID_BALANCE,
      documentId: ctx.visitId,
      key: "fluid-balance",
    }),
  ];
}

function buildMR33(): MRPrintEntry[] {
  return [makeEntry(mr33, "partial", "Order gizi tersedia, tetapi belum ada cetakan asesmen gizi klinis khusus.")];
}

function buildMR34(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.isInpatientVisit) {
    return [makeEntry(mr34, "missing-data", "Kunjungan ini bukan rawat inap.")];
  }
  return [makeEntry(mr34, "partial", "Discharge planning tersedia di modul, tetapi belum ada cetakan khusus MR.34.")];
}

function buildMR35(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.hasAnyMedicalData) {
    return [makeEntry(mr35, "missing-data", "Belum ada data medis yang cukup untuk resume.")];
  }

  if (ctx.isUGDVisit) {
    return [
      makeEntry(mr35, "ready", "Cetak ringkasan pelayanan UGD.", {
        handler: () => printApi.emergencySummary(ctx.visitId),
        documentType: DOCUMENT_TYPES.EMERGENCY_SUMMARY,
        documentId: ctx.visitId,
        key: "emergency-summary",
      }),
    ];
  }

  if (ctx.isInpatientVisit) {
    return [
      makeEntry(mr35, "ready", "Cetak resume medis rawat inap.", {
        handler: () => printApi.inpatientResume(ctx.visitId),
        documentType: DOCUMENT_TYPES.VISIT_RESUME,
        documentId: ctx.visitId,
        key: "inpatient-resume",
      }),
    ];
  }

  return [
    makeEntry(mr35, "ready", "Cetak resume medis rawat jalan.", {
      handler: () => printApi.outpatientResume(ctx.visitId),
      documentType: DOCUMENT_TYPES.VISIT_RESUME,
      documentId: ctx.visitId,
      key: "outpatient-resume",
    }),
  ];
}

function buildMR36(ctx: MRPrintContext): MRPrintEntry[] {
  if (ctx.suratKontrolDoc?.id) {
    return [
      makeEntry(mr36, "ready", "Cetak Surat Kontrol / SKDP.", {
        handler: () => printApi.suratKontrol(ctx.suratKontrolDoc.id),
        documentType: DOCUMENT_TYPES.SURAT_KONTROL,
        documentId: ctx.suratKontrolDoc.id,
        key: `surat-kontrol-${ctx.suratKontrolDoc.id}`,
      }),
    ];
  }
  if (ctx.followUpRegistrationId) {
    return [
      makeEntry(mr36, "partial", "Cetak Surat Kontrol follow-up dari SIMRS umum.", {
        handler: () => printApi.suratKontrolSimrs(ctx.followUpRegistrationId as number),
        key: `surat-kontrol-simrs-${ctx.followUpRegistrationId}`,
      }),
    ];
  }
  if (ctx.spriDoc?.id) {
    return [
      makeEntry(mr36, "partial", "Cetak SPRI sebagai tindak lanjut rawat inap BPJS.", {
        handler: () => printApi.spri(ctx.spriDoc.id),
        documentType: DOCUMENT_TYPES.SPRI,
        documentId: ctx.spriDoc.id,
        key: `spri-${ctx.spriDoc.id}`,
      }),
    ];
  }
  return [makeEntry(mr36, "missing-data", "Belum ada surat kontrol / tindak lanjut di kunjungan ini.")];
}

function buildMR37(): MRPrintEntry[] {
  return [makeEntry(mr37, "partial", "Data rujukan masuk ada di integrasi, tetapi belum ada cetakan MR.37 yang dipusatkan di launcher ini.")];
}

function buildMR38(ctx: MRPrintContext): MRPrintEntry[] {
  if (!ctx.hasReferral) {
    return [makeEntry(mr38, "missing-data", "Kunjungan ini tidak memiliki disposisi rujukan keluar.")];
  }
  return [
    makeEntry(mr38, "ready", "Cetak surat rujukan keluar.", {
      handler: () => printApi.referralLetter(ctx.visitId),
      documentType: DOCUMENT_TYPES.REFERRAL_LETTER,
      documentId: ctx.visitId,
      key: "referral-letter",
    }),
  ];
}

function buildMR39(ctx: MRPrintContext): MRPrintEntry[] {
  const entries = [
    ...makeCollectionEntries(
      mr39,
      ctx.sickLetters,
      (letter, index) => ({
        key: `sick-letter-${letter.id}`,
        title: `${mr39.title} - Surat Sakit ${formatDateShort(letter.start_date) || `#${index + 1}`}`.trim(),
        description: `Cetak surat sakit ${letter.days} hari.`,
        handler: () => printApi.sickLetterById(ctx.visitId, letter.id),
        documentType: DOCUMENT_TYPES.SICK_LETTER,
        documentId: letter.id,
      }),
      "",
    ).filter((entry) => entry.description !== ""),
    ...makeCollectionEntries(
      mr39,
      ctx.healthCertificates,
      (cert, index) => ({
        key: `health-certificate-${cert.id}`,
        title: `${mr39.title} - Surat Sehat ${formatDateShort(cert.exam_date) || `#${index + 1}`}`.trim(),
        description: "Cetak surat keterangan sehat.",
        handler: () => printApi.healthCertificate(ctx.visitId, cert.id),
        documentType: DOCUMENT_TYPES.HEALTH_CERTIFICATE,
        documentId: cert.id,
      }),
      "",
    ).filter((entry) => entry.description !== ""),
    ...makeCollectionEntries(
      mr39,
      ctx.leaveCertificates,
      (cert, index) => ({
        key: `leave-certificate-${cert.id}`,
        title: `${mr39.title} - Surat Cuti ${formatDateShort(cert.start_date) || `#${index + 1}`}`.trim(),
        description: "Cetak surat keterangan cuti.",
        handler: () => printApi.leaveCertificate(ctx.visitId, cert.id),
        documentType: DOCUMENT_TYPES.LEAVE_CERTIFICATE,
        documentId: cert.id,
      }),
      "",
    ).filter((entry) => entry.description !== ""),
    ...makeCollectionEntries(
      mr39,
      ctx.mcuCertificates,
      (cert, index) => ({
        key: `mcu-certificate-${cert.id}`,
        title: `${mr39.title} - Surat MCU ${formatDateShort(cert.exam_date) || `#${index + 1}`}`.trim(),
        description: "Cetak surat MCU.",
        handler: () => printApi.mcuCertificate(ctx.visitId, cert.id),
        documentType: DOCUMENT_TYPES.MCU_CERTIFICATE,
        documentId: cert.id,
      }),
      "",
    ).filter((entry) => entry.description !== ""),
  ];

  if (entries.length === 0) {
    return [makeEntry(mr39, "missing-data", "Belum ada surat sakit/sehat/cuti/MCU yang tersimpan.")];
  }

  return entries;
}

function buildMR40(ctx: MRPrintContext): MRPrintEntry[] {
  return makeCollectionEntries(
    mr40,
    ctx.deathCertificates,
    (cert, index) => ({
      key: `death-certificate-${cert.id}`,
      title: `${mr40.title} ${formatDateShort(cert.death_datetime) || `#${index + 1}`}`.trim(),
      description: "Cetak surat kematian.",
      handler: () => printApi.deathCertificate(ctx.visitId, cert.id),
      documentType: DOCUMENT_TYPES.DEATH_CERTIFICATE,
      documentId: cert.id,
    }),
    "Belum ada surat kematian di kunjungan ini.",
  );
}

function buildMR41(): MRPrintEntry[] {
  return [makeEntry(mr41, "unavailable", "Belum ada modul/cetakan kejadian khusus atau insiden keselamatan pasien.")];
}

function buildMR42(ctx: MRPrintContext): MRPrintEntry[] {
  const hasEducationSignal =
    ctx.medicineOrders.some((order) => order?.final_review_completed) ||
    !!ctx.medicalRecord?.assessment_plan?.informed_consent;
  if (!hasEducationSignal) {
    return [makeEntry(mr42, "missing-data", "Belum ada jejak edukasi pasien/keluarga yang cukup di kunjungan ini.")];
  }
  return [makeEntry(mr42, "partial", "Jejak edukasi ada di PIO dan assessment plan, tetapi belum ada cetakan edukasi khusus.")];
}

function buildMR43(): MRPrintEntry[] {
  return [makeEntry(mr43, "unavailable", "Belum ada modul/cetakan persetujuan pulang paksa / APS.")];
}

function buildMR44(): MRPrintEntry[] {
  return [makeEntry(mr44, "partial", "Jejak isolasi ada di data rawat inap, tetapi belum ada cetakan surveilans/isolasi khusus.")];
}

function buildMR45(): MRPrintEntry[] {
  return [makeEntry(mr45, "unavailable", "Belum ada modul/cetakan rehabilitasi medik atau fisioterapi khusus.")];
}

function buildMR46(): MRPrintEntry[] {
  return [makeEntry(mr46, "unavailable", "Belum ada modul/cetakan hemodialisa khusus.")];
}

function buildMR47(ctx: MRPrintContext): MRPrintEntry[] {
  const entries: MRPrintEntry[] = [];
  
  // Bersalin Record (if visit has bersalin data)
  if (ctx.hasBersalin) {
    entries.push(
      makeEntry(mr47, "ready", "Cetak Rekam Medis Bersalin (Asesmen, Partograf & Persalinan).", {
        handler: () => printApi.bersalinRecord(ctx.visitId),
        documentType: DOCUMENT_TYPES.BERSALIN,
        documentId: ctx.visitId,
        key: "bersalin",
      })
    );
  }

  // Birth Certificates
  const birthEntries = makeCollectionEntries(
    mr47,
    ctx.birthCertificates,
    (cert, index) => ({
      key: `birth-certificate-${cert.id}`,
      title: `${mr47.title} - Surat Kelahiran ${formatDateShort(cert.birth_date) || `#${index + 1}`}`.trim(),
      description: "Cetak surat kelahiran sebagai output persalinan yang sudah ada.",
      handler: () => printApi.birthCertificate(ctx.visitId, cert.id),
      documentType: DOCUMENT_TYPES.BIRTH_CERTIFICATE,
      documentId: cert.id,
      status: "partial",
    }),
    "",
  ).filter((entry) => entry.description !== "");
  
  entries.push(...birthEntries);

  if (entries.length === 0) {
    return [makeEntry(mr47, "missing-data", "Belum ada data persalinan/surat kelahiran di kunjungan ini.")];
  }

  return entries;
}

function buildMR48(): MRPrintEntry[] {
  return [makeEntry(mr48, "partial", "Surat kelahiran ada, tetapi asesmen neonatal/bayi baru lahir belum punya cetakan khusus.")];
}

function buildMR49(): MRPrintEntry[] {
  return [makeEntry(mr49, "unavailable", "Belum ada workflow cetak imunisasi / tumbuh kembang yang jelas di SIMRS ini.")];
}

function buildMR50(ctx: MRPrintContext): MRPrintEntry[] {
  const entries: MRPrintEntry[] = [];
  if (ctx.suratKontrolDoc?.id) {
    entries.push(
      makeEntry(mr50, "partial", "Surat Kontrol BPJS tersedia sebagai dokumen pendukung klaim/tindak lanjut.", {
        handler: () => printApi.suratKontrol(ctx.suratKontrolDoc.id),
        documentType: DOCUMENT_TYPES.SURAT_KONTROL,
        documentId: ctx.suratKontrolDoc.id,
        key: `bpjs-surat-kontrol-${ctx.suratKontrolDoc.id}`,
      }),
    );
  }
  if (ctx.spriDoc?.id) {
    entries.push(
      makeEntry(mr50, "partial", "SPRI BPJS tersedia sebagai dokumen pendukung rawat inap.", {
        handler: () => printApi.spri(ctx.spriDoc.id),
        documentType: DOCUMENT_TYPES.SPRI,
        documentId: ctx.spriDoc.id,
        key: `bpjs-spri-${ctx.spriDoc.id}`,
      }),
    );
  }
  if (entries.length > 0) {
    return entries;
  }
  return [makeEntry(mr50, "partial", "Modul BPJS dan e-klaim tersedia, tetapi dokumen pendukung belum semuanya dipusatkan di launcher ini.")];
}

const buildMR51: MRBuilder = (ctx) => {
  const entries: MRPrintEntry[] = [];
  
  if (ctx.sickLetters && ctx.sickLetters.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.sickLetters, (l) => ({
      key: `sick-${l.id}`,
      description: `Surat Keterangan Sakit - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.sickLetterById(ctx.visitId, l.id),
      documentType: DOCUMENT_TYPES.SICK_LETTER,
      documentId: l.id
    }), ""));
  }
  
  if (ctx.healthCertificates && ctx.healthCertificates.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.healthCertificates, (l) => ({
      key: `health-${l.id}`,
      description: `Surat Keterangan Sehat - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.healthCertificate(ctx.visitId, l.id),
      documentType: DOCUMENT_TYPES.HEALTH_CERTIFICATE,
      documentId: l.id
    }), ""));
  }
  
  if (ctx.birthCertificates && ctx.birthCertificates.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.birthCertificates, (l) => ({
      key: `birth-${l.id}`,
      description: `Surat Keterangan Kelahiran - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.birthCertificate(ctx.visitId, l.id),
      documentType: "birth_certificate", // Adjust if needed
      documentId: l.id
    }), ""));
  }
  
  if (ctx.leaveCertificates && ctx.leaveCertificates.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.leaveCertificates, (l) => ({
      key: `leave-${l.id}`,
      description: `Surat Keterangan Cuti - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.leaveCertificate(ctx.visitId, l.id),
      documentType: "leave_certificate",
      documentId: l.id
    }), ""));
  }
  
  if (ctx.mcuCertificates && ctx.mcuCertificates.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.mcuCertificates, (l) => ({
      key: `mcu-${l.id}`,
      description: `Surat Keterangan MCU - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.mcuCertificate(ctx.visitId, l.id),
      documentType: "mcu_certificate",
      documentId: l.id
    }), ""));
  }
  
  if (ctx.deathCertificates && ctx.deathCertificates.length > 0) {
    entries.push(...makeCollectionEntries(mr51, ctx.deathCertificates, (l) => ({
      key: `death-${l.id}`,
      description: `Surat Keterangan Kematian - ${formatDateShort(l.created_at)}`,
      handler: () => printApi.deathCertificate(ctx.visitId, l.id),
      documentType: "death_certificate",
      documentId: l.id
    }), ""));
  }
  
  if (entries.length === 0) {
    return [makeEntry(mr51, "missing-data", "Tidak ada surat / keterangan untuk kunjungan ini.")];
  }
  
  return entries;
}

const builders: MRBuilder[] = [
  buildMR00,
  buildMR01,
  buildMR02,
  buildMR03,
  buildMR04,
  buildMR05,
  buildMR06,
  buildMR07,
  buildMR08,
  buildMR09,
  buildMR10,
  buildMR11,
  buildMR12,
  buildMR13,
  buildMR14,
  buildMR15,
  buildMR16,
  buildMR17,
  buildMR18,
  buildMR19,
  buildMR20,
  buildMR21,
  buildMR22,
  buildMR23,
  buildMR24,
  buildMR25,
  buildMR26,
  buildMR27,
  buildMR28,
  buildMR29,
  buildMR30,
  buildMR31,
  buildMR32,
  buildMR33,
  buildMR34,
  buildMR35,
  buildMR36,
  buildMR37,
  buildMR38,
  buildMR39,
  buildMR40,
  buildMR41,
  buildMR42,
  buildMR43,
  buildMR44,
  buildMR45,
  buildMR46,
  buildMR47,
  buildMR48,
  buildMR49,
  buildMR50,
  buildMR51,
];

export function buildMRPrintEntries(ctx: MRPrintContext): MRPrintEntry[] {
  return builders.flatMap((builder) => builder(ctx));
}
