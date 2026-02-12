/**
 * Bed Detail Fullscreen Modal
 * Modal fullscreen yang muncul ketika bed diklik di floor plan.
 * Tabs:
 *   1. Info Pasien — data lengkap pasien + info klinis dari bedside summary
 *   2. Riwayat Kunjungan — tree node dokumen PDF seperti archive viewer
 *   3. CPPT — form CPPT seperti di medical record
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  bedsideApi,
  visitsApi,
  printApi,
  medicineOrdersApi,
  procedureOrdersApi,
  patientsApi,
  medicalRecordsApi,
  type BedsideSummary,
} from "@/lib/api";
import type { PhysicalExam } from "@/lib/api/medical-records";
import { fetchAvailableDocs } from "@/lib/api/print";
import type { Visit } from "@/lib/api/visits";
import type { MedicineOrder } from "@/lib/api/medicine-orders";
import type { ProcedureOrder } from "@/lib/api/procedure-orders";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import {
  X,
  User,
  Stethoscope,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Loader2,
  AlertTriangle,
  FileText,
  Pill,
  FlaskConical,
  Send,
  ClipboardList,
  BedDouble,
  HeartPulse,
  FileCheck,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { FloorPlanBed, FloorPlanUnit } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

interface BedDetailModalProps {
  open: boolean;
  onClose: () => void;
  bed: FloorPlanBed;
  unit: FloorPlanUnit;
}

interface DocItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  fetchBlob: () => Promise<Blob>;
  docKey?: string;
}

interface VisitOrders {
  medicineOrders: MedicineOrder[];
  procedureOrders: ProcedureOrder[];
  loaded: boolean;
}

type TabKey = "patient-info" | "visit-history" | "cppt";

// ============================================================================
// Helpers
// ============================================================================

function getVisitTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    outpatient: "Rawat Jalan",
    inpatient: "Rawat Inap",
    emergency: "UGD",
    consultation: "Konsultasi",
    surgery: "Bedah",
  };
  return labels[type] || type;
}

function getVisitTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    outpatient: "bg-blue-100 text-blue-800",
    inpatient: "bg-purple-100 text-purple-800",
    emergency: "bg-red-100 text-red-800",
    consultation: "bg-green-100 text-green-800",
    surgery: "bg-orange-100 text-orange-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

function getBaseDocsForVisit(visit: Visit): DocItem[] {
  const docs: DocItem[] = [];
  const roomType = visit.room?.room_type || "";
  const isInpatient = visit.visit_type === "inpatient" || roomType === "rawat_inap";
  const isEmergency = visit.visit_type === "emergency" || roomType === "igd" || roomType === "emergency";

  if (isInpatient) {
    docs.push({
      id: `resume-${visit.id}`,
      label: "Resume Medis Rawat Inap",
      icon: <FileText className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.inpatientResume(visit.id),
      docKey: "resume",
    });
  } else if (isEmergency) {
    docs.push({
      id: `resume-${visit.id}`,
      label: "Resume Medis UGD",
      icon: <FileText className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.outpatientResume(visit.id),
      docKey: "resume",
    });
  } else {
    docs.push({
      id: `resume-${visit.id}`,
      label: "Resume Medis Rawat Jalan",
      icon: <FileText className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.outpatientResume(visit.id),
      docKey: "resume",
    });
  }

  docs.push({
    id: `referral-letter-${visit.id}`,
    label: "Surat Rujukan",
    icon: <Send className="h-3.5 w-3.5" />,
    fetchBlob: () => printApi.blob.referralLetter(visit.id),
    docKey: "referral_letter",
  });

  if (isEmergency) {
    docs.push({
      id: `triage-${visit.id}`,
      label: "Formulir Triage UGD",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.triageForm(visit.id),
      docKey: "triage",
    });
    docs.push({
      id: `emergency-summary-${visit.id}`,
      label: "Ringkasan Pelayanan UGD",
      icon: <ClipboardList className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.emergencySummary(visit.id),
      docKey: "emergency_summary",
    });
  }

  if (isInpatient) {
    docs.push({
      id: `cppt-${visit.id}`,
      label: "CPPT",
      icon: <Stethoscope className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.cppt(visit.id),
      docKey: "cppt",
    });
    docs.push({
      id: `nursing-care-${visit.id}`,
      label: "Asuhan Keperawatan",
      icon: <Activity className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.nursingCare(visit.id),
      docKey: "nursing_care",
    });
    docs.push({
      id: `fluid-balance-${visit.id}`,
      label: "Balance Cairan",
      icon: <Droplets className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.fluidBalance(visit.id),
      docKey: "fluid_balance",
    });
    docs.push({
      id: `bed-transfer-${visit.id}`,
      label: "Lembar Mutasi Pasien",
      icon: <BedDouble className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.bedTransfer(visit.id),
      docKey: "bed_transfer",
    });
    docs.push({
      id: `vital-sign-chart-${visit.id}`,
      label: "Grafik Tanda Vital",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.vitalSignChart(visit.id),
      docKey: "vital_sign_chart",
    });
  }

  if (isInpatient || isEmergency) {
    docs.push({
      id: `inpatient-certificate-${visit.id}`,
      label: "Surat Keterangan Rawat Inap",
      icon: <FileCheck className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.inpatientCertificate(visit.id),
      docKey: "inpatient_certificate",
    });
  }

  return docs;
}

function getOrderDocs(
  medicineOrders: MedicineOrder[],
  procedureOrders: ProcedureOrder[]
): DocItem[] {
  const docs: DocItem[] = [];
  for (const order of medicineOrders) {
    docs.push({
      id: `prescription-${order.id}`,
      label: `Resep Obat - ${order.order_number}`,
      icon: <Pill className="h-3.5 w-3.5" />,
      fetchBlob: () => printApi.blob.prescription(order.id),
    });
  }
  for (const order of procedureOrders) {
    if (order.order_type === "laboratory") {
      docs.push({
        id: `lab-order-${order.id}`,
        label: `Permintaan Lab - ${order.order_number}`,
        icon: <FlaskConical className="h-3.5 w-3.5" />,
        fetchBlob: () => printApi.blob.labOrder(order.id),
      });
      if (order.status === "completed") {
        docs.push({
          id: `lab-result-${order.id}`,
          label: `Hasil Lab - ${order.order_number}`,
          icon: <FlaskConical className="h-3.5 w-3.5" />,
          fetchBlob: () => printApi.blob.labResult(order.id),
        });
      }
    }
  }
  return docs;
}

// ============================================================================
// Sub-components
// ============================================================================

function VitalBadge({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
  unit: string;
  color: string;
}) {
  if (value == null) return null;
  const colorMap: Record<string, string> = {
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs", colorMap[color] || colorMap.gray)}>
      {icon}
      <div>
        <span className="font-semibold">{value}</span>
        {unit && <span className="ml-0.5 opacity-70">{unit}</span>}
        <span className="block text-[10px] opacity-60">{label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function BedDetailModal({ open, onClose, bed, unit }: BedDetailModalProps) {
  const { toast } = useToast();
  const patient = bed.current_patient;
  const visitId = patient?.visit_id;

  const [activeTab, setActiveTab] = useState<TabKey>("patient-info");
  const [bedsideData, setBedsideData] = useState<BedsideSummary | null>(null);
  const [loadingBedside, setLoadingBedside] = useState(false);
  const [patientFull, setPatientFull] = useState<any>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [physicalExam, setPhysicalExam] = useState<PhysicalExam | null>(null);
  const [loadingPhysicalExam, setLoadingPhysicalExam] = useState(false);

  // Visit history state
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [expandedVisitIds, setExpandedVisitIds] = useState<Set<number>>(new Set());
  const [visitOrdersMap, setVisitOrdersMap] = useState<Record<number, VisitOrders>>({});
  const [visitAvailableDocs, setVisitAvailableDocs] = useState<Record<number, string[]>>({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Load bedside summary + patient data
  useEffect(() => {
    if (!open || !visitId) return;

    setActiveTab("patient-info");
    setBedsideData(null);
    setPatientFull(null);
    setPhysicalExam(null);
    setVisits([]);
    setExpandedVisitIds(new Set());
    setVisitOrdersMap({});
    setVisitAvailableDocs({});
    setSelectedDocId(null);
    setPdfUrl(null);
    setPdfError(null);

    const loadBedside = async () => {
      setLoadingBedside(true);
      try {
        const res = await bedsideApi.getSummary(visitId);
        setBedsideData(res.data.data);
      } catch {
        // silent
      } finally {
        setLoadingBedside(false);
      }
    };

    const loadPatient = async () => {
      if (!patient?.patient_id) return;
      setLoadingPatient(true);
      try {
        const res = await patientsApi.getById(patient.patient_id);
        setPatientFull(res.data);
      } catch {
        // silent
      } finally {
        setLoadingPatient(false);
      }
    };

    const loadPhysicalExam = async () => {
      setLoadingPhysicalExam(true);
      try {
        const res = await medicalRecordsApi.getPhysicalExam(visitId);
        setPhysicalExam(res.data);
      } catch {
        // silent — not all visits have physical exam
      } finally {
        setLoadingPhysicalExam(false);
      }
    };

    loadBedside();
    loadPatient();
    loadPhysicalExam();
  }, [open, visitId, patient?.patient_id]);

  // Load visit history when tab switches to history
  useEffect(() => {
    if (activeTab !== "visit-history" || !patient?.patient_id || visits.length > 0) return;

    const loadVisits = async () => {
      setLoadingVisits(true);
      try {
        const res = await visitsApi.getAll({ patient_id: patient.patient_id! });
        const mainVisits = (res.data || []).filter(
          (v: Visit) => !["lab", "radiology", "pharmacy", "surgery", "consultation", "procedure"].includes(v.visit_type)
            && v.status !== "cancelled"
        );
        setVisits(mainVisits);
      } catch {
        toast({ variant: "destructive", title: "Gagal memuat riwayat kunjungan" });
      } finally {
        setLoadingVisits(false);
      }
    };
    loadVisits();
  }, [activeTab, patient?.patient_id, visits.length, toast]);

  // Cleanup PDF URL
  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Visit history helpers
  const loadOrdersForVisit = useCallback(async (vId: number) => {
    if (visitOrdersMap[vId]?.loaded) return;
    setLoadingOrders(true);
    try {
      const [medRes, procRes, availDocs] = await Promise.all([
        medicineOrdersApi.getAll({ source_visit_id: vId }),
        procedureOrdersApi.getAll({ source_visit_id: vId }),
        fetchAvailableDocs(vId),
      ]);
      setVisitOrdersMap((prev) => ({
        ...prev,
        [vId]: { medicineOrders: medRes.data || [], procedureOrders: procRes.data || [], loaded: true },
      }));
      setVisitAvailableDocs((prev) => ({ ...prev, [vId]: availDocs }));
    } catch {
      setVisitOrdersMap((prev) => ({
        ...prev,
        [vId]: { medicineOrders: [], procedureOrders: [], loaded: true },
      }));
    } finally {
      setLoadingOrders(false);
    }
  }, [visitOrdersMap]);

  const toggleVisit = (vId: number) => {
    setExpandedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(vId)) next.delete(vId);
      else { next.add(vId); loadOrdersForVisit(vId); }
      return next;
    });
  };

  const getDocsForVisit = (visit: Visit): DocItem[] => {
    const baseDocs = getBaseDocsForVisit(visit);
    const orders = visitOrdersMap[visit.id];
    const availDocs = visitAvailableDocs[visit.id];
    const filteredBaseDocs = availDocs
      ? baseDocs.filter((doc) => !doc.docKey || availDocs.includes(doc.docKey))
      : baseDocs;
    if (orders?.loaded) {
      return [...filteredBaseDocs, ...getOrderDocs(orders.medicineOrders, orders.procedureOrders)];
    }
    return filteredBaseDocs;
  };

  const handleSelectDoc = async (doc: DocItem) => {
    if (pdfUrl) { window.URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    setPdfError(null);
    setSelectedDocId(doc.id);
    setLoadingPdf(true);
    try {
      const blob = await doc.fetchBlob();
      setPdfUrl(window.URL.createObjectURL(blob));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setPdfError("Data untuk dokumen ini belum tersedia.");
      } else {
        setPdfError("Gagal memuat dokumen.");
      }
    } finally {
      setLoadingPdf(false);
    }
  };

  // Bedside computed
  const bedsidePatient = bedsideData?.visit?.registration?.patient;
  const bedsideDoctor = bedsideData?.visit?.doctor;
  const bedsideRoom = bedsideData?.visit?.room;
  const bedsideBed = bedsideData?.visit?.bed;

  // Physical exam vitals
  const peVitals = physicalExam;
  const formatPeBP = () => {
    if (!peVitals) return undefined;
    if (peVitals.blood_pressure) return peVitals.blood_pressure;
    const sys = peVitals.systolic || peVitals.blood_pressure_systolic;
    const dia = peVitals.diastolic || peVitals.blood_pressure_diastolic;
    if (sys && dia) return `${sys}/${dia}`;
    return undefined;
  };

  const patientAge = useMemo(() => {
    const dob = patientFull?.tanggal_lahir || bedsidePatient?.tanggal_lahir;
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  }, [patientFull?.tanggal_lahir, bedsidePatient?.tanggal_lahir]);

  // Sort visits by date descending
  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime());
  }, [visits]);

  if (!open) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "patient-info", label: "Info Pasien" },
    { key: "visit-history", label: "Riwayat Kunjungan" },
    { key: "cppt", label: "CPPT" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full">
          <BedDouble className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold truncate">{patient?.name || "Pasien"}</h1>
              {patient?.gender && (
                <Badge variant={patient.gender === "L" ? "default" : "secondary"} className="text-[10px] shrink-0">
                  {patient.gender === "L" ? "L" : "P"}
                </Badge>
              )}
              {patient?.insurance_type && (
                <Badge variant="outline" className="text-[10px] shrink-0">{patient.insurance_type}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              RM: {patient?.medical_record_number || "-"} · {unit.name} / {bed.bed_number}
              {patientAge != null && <> · {patientAge} thn</>}
              {bedsideData && <> · Hari ke-{bedsideData.days_of_stay}</>}
            </p>
          </div>
        </div>
      </div>

      {/* Inline Tabs */}
      <div className="border-b px-4 shrink-0">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* ============================================================== */}
        {/* TAB 1: Info Pasien                                             */}
        {/* ============================================================== */}
        {activeTab === "patient-info" && (
          <ScrollArea className="h-full">
            {loadingBedside || loadingPatient || loadingPhysicalExam ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Patient Identity + Clinical Overview — Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT: Patient Identity */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-7 w-7 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold truncate">{patientFull?.nama_lengkap || patient?.name}</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{patientFull?.no_rm || patient?.medical_record_number}</span>
                          <span>·</span>
                          <span>{(patientFull?.jenis_kelamin || patient?.gender) === "L" ? "Laki-laki" : "Perempuan"}</span>
                          {patientAge != null && (
                            <>
                              <span>·</span>
                              <span>{patientAge} thn</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Identitas */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identitas</span>
                      <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                        <span className="text-muted-foreground">NIK</span>
                        <span className="font-mono font-medium">{patientFull?.nik || patient?.nik || "-"}</span>

                        <span className="text-muted-foreground">Tempat Lahir</span>
                        <span className="font-medium">{patientFull?.tempat_lahir || "-"}</span>

                        <span className="text-muted-foreground">Tgl Lahir</span>
                        <span className="font-medium">
                          {patientFull?.tanggal_lahir
                            ? format(new Date(patientFull.tanggal_lahir), "dd MMMM yyyy", { locale: idLocale })
                            : patient?.birth_date
                            ? format(new Date(patient.birth_date), "dd MMMM yyyy", { locale: idLocale })
                            : "-"}
                        </span>

                        <span className="text-muted-foreground">Gol. Darah</span>
                        <span className="font-medium">
                          {patientFull?.golongan_darah || "-"}
                          {patientFull?.rhesus && patientFull.rhesus !== "Tidak Diketahui" && ` (${patientFull.rhesus})`}
                        </span>

                        <span className="text-muted-foreground">Agama</span>
                        <span className="font-medium">{patientFull?.agama || "-"}</span>

                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium">{patientFull?.status_perkawinan || "-"}</span>

                        <span className="text-muted-foreground">Pendidikan</span>
                        <span className="font-medium">{patientFull?.pendidikan_terakhir || "-"}</span>

                        <span className="text-muted-foreground">Pekerjaan</span>
                        <span className="font-medium">{patientFull?.pekerjaan || "-"}</span>

                        {patientFull?.suku && (
                          <>
                            <span className="text-muted-foreground">Suku</span>
                            <span className="font-medium">{patientFull.suku}</span>
                          </>
                        )}

                        {patientFull?.kewarganegaraan && (
                          <>
                            <span className="text-muted-foreground">WN</span>
                            <span className="font-medium">{patientFull.kewarganegaraan}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alamat */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alamat</span>
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-muted-foreground text-xs">Alamat KTP</span>
                          <p className="font-medium">
                            {patientFull?.alamat_ktp || "-"}
                            {patientFull?.rt_ktp && patientFull?.rw_ktp && ` RT ${patientFull.rt_ktp}/RW ${patientFull.rw_ktp}`}
                          </p>
                          {(patientFull?.kelurahan_ktp || patientFull?.kecamatan_ktp) && (
                            <p className="text-muted-foreground text-xs">
                              {[patientFull?.kelurahan_ktp, patientFull?.kecamatan_ktp, patientFull?.kota_ktp, patientFull?.provinsi_ktp].filter(Boolean).join(", ")}
                              {patientFull?.kode_pos_ktp && ` ${patientFull.kode_pos_ktp}`}
                            </p>
                          )}
                        </div>
                        {patientFull?.alamat_domisili && patientFull.alamat_domisili !== patientFull?.alamat_ktp && (
                          <div>
                            <span className="text-muted-foreground text-xs">Alamat Domisili</span>
                            <p className="font-medium">
                              {patientFull.alamat_domisili}
                              {patientFull?.rt_domisili && patientFull?.rw_domisili && ` RT ${patientFull.rt_domisili}/RW ${patientFull.rw_domisili}`}
                            </p>
                            {(patientFull?.kelurahan_domisili || patientFull?.kecamatan_domisili) && (
                              <p className="text-muted-foreground text-xs">
                                {[patientFull?.kelurahan_domisili, patientFull?.kecamatan_domisili, patientFull?.kota_domisili, patientFull?.provinsi_domisili].filter(Boolean).join(", ")}
                                {patientFull?.kode_pos_domisili && ` ${patientFull.kode_pos_domisili}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Kontak */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontak</span>
                      <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                        <span className="text-muted-foreground">Telepon</span>
                        <span className="font-medium">{patientFull?.no_telepon || patient?.phone || "-"}</span>

                        {patientFull?.no_hp && (
                          <>
                            <span className="text-muted-foreground">HP</span>
                            <span className="font-medium">{patientFull.no_hp}</span>
                          </>
                        )}

                        {patientFull?.no_hp_alternatif && (
                          <>
                            <span className="text-muted-foreground">HP Alternatif</span>
                            <span className="font-medium">{patientFull.no_hp_alternatif}</span>
                          </>
                        )}

                        {patientFull?.email && (
                          <>
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-medium">{patientFull.email}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Jaminan Kesehatan */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jaminan Kesehatan</span>
                      <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                        <span className="text-muted-foreground">Jenis</span>
                        <span className="font-medium">
                          <Badge variant="secondary" className="text-xs">
                            {patientFull?.jenis_jaminan || patient?.insurance_type || "Umum"}
                          </Badge>
                        </span>

                        {(patientFull?.no_bpjs || patient?.insurance_number) && (
                          <>
                            <span className="text-muted-foreground">No. BPJS</span>
                            <span className="font-mono font-medium">{patientFull?.no_bpjs || patient?.insurance_number}</span>
                          </>
                        )}

                        {patientFull?.kelas_bpjs && (
                          <>
                            <span className="text-muted-foreground">Kelas</span>
                            <span className="font-medium">{patientFull.kelas_bpjs}</span>
                          </>
                        )}

                        {patientFull?.faskes_tingkat_1 && (
                          <>
                            <span className="text-muted-foreground">Faskes TK 1</span>
                            <span className="font-medium">{patientFull.faskes_tingkat_1}</span>
                          </>
                        )}

                        {patientFull?.nama_asuransi && (
                          <>
                            <span className="text-muted-foreground">Asuransi</span>
                            <span className="font-medium">{patientFull.nama_asuransi}</span>
                          </>
                        )}

                        {patientFull?.no_polis_asuransi && (
                          <>
                            <span className="text-muted-foreground">No. Polis</span>
                            <span className="font-mono font-medium">{patientFull.no_polis_asuransi}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Penanggung Jawab */}
                    {patientFull?.nama_penanggung_jawab && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Penanggung Jawab</span>
                        <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                          <span className="text-muted-foreground">Nama</span>
                          <span className="font-medium">{patientFull.nama_penanggung_jawab}</span>

                          {patientFull?.hubungan_penanggung_jawab && (
                            <>
                              <span className="text-muted-foreground">Hubungan</span>
                              <span className="font-medium">{patientFull.hubungan_penanggung_jawab}</span>
                            </>
                          )}

                          {patientFull?.telepon_penanggung_jawab && (
                            <>
                              <span className="text-muted-foreground">Telepon</span>
                              <span className="font-medium">{patientFull.telepon_penanggung_jawab}</span>
                            </>
                          )}

                          {patientFull?.alamat_penanggung_jawab && (
                            <>
                              <span className="text-muted-foreground">Alamat</span>
                              <span className="font-medium">{patientFull.alamat_penanggung_jawab}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Data Orang Tua (if any) */}
                    {(patientFull?.nama_ayah || patientFull?.nama_ibu) && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Orang Tua</span>
                        <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                          {patientFull?.nama_ayah && (
                            <>
                              <span className="text-muted-foreground">Nama Ayah</span>
                              <span className="font-medium">{patientFull.nama_ayah}</span>
                            </>
                          )}
                          {patientFull?.pekerjaan_ayah && (
                            <>
                              <span className="text-muted-foreground">Pekerjaan</span>
                              <span className="font-medium">{patientFull.pekerjaan_ayah}</span>
                            </>
                          )}
                          {patientFull?.nama_ibu && (
                            <>
                              <span className="text-muted-foreground">Nama Ibu</span>
                              <span className="font-medium">{patientFull.nama_ibu}</span>
                            </>
                          )}
                          {patientFull?.pekerjaan_ibu && (
                            <>
                              <span className="text-muted-foreground">Pekerjaan</span>
                              <span className="font-medium">{patientFull.pekerjaan_ibu}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Riwayat Medis dari Master Pasien */}
                    {(patientFull?.alergi_obat || patientFull?.alergi_makanan || patientFull?.alergi_lainnya || patientFull?.penyakit_kronis || patientFull?.riwayat_operasi || patientFull?.obat_rutin || patientFull?.disabilitas) && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Riwayat Medis</span>
                        <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                          {patientFull?.alergi_obat && (
                            <>
                              <span className="text-muted-foreground">Alergi Obat</span>
                              <span className="font-medium text-red-600">{patientFull.alergi_obat}</span>
                            </>
                          )}
                          {patientFull?.alergi_makanan && (
                            <>
                              <span className="text-muted-foreground">Alergi Makanan</span>
                              <span className="font-medium text-red-600">{patientFull.alergi_makanan}</span>
                            </>
                          )}
                          {patientFull?.alergi_lainnya && (
                            <>
                              <span className="text-muted-foreground">Alergi Lainnya</span>
                              <span className="font-medium text-red-600">{patientFull.alergi_lainnya}</span>
                            </>
                          )}
                          {patientFull?.penyakit_kronis && (
                            <>
                              <span className="text-muted-foreground">Peny. Kronis</span>
                              <span className="font-medium">{patientFull.penyakit_kronis}</span>
                            </>
                          )}
                          {patientFull?.riwayat_operasi && (
                            <>
                              <span className="text-muted-foreground">Rwy. Operasi</span>
                              <span className="font-medium">{patientFull.riwayat_operasi}</span>
                            </>
                          )}
                          {patientFull?.obat_rutin && (
                            <>
                              <span className="text-muted-foreground">Obat Rutin</span>
                              <span className="font-medium">{patientFull.obat_rutin}</span>
                            </>
                          )}
                          {patientFull?.disabilitas && (
                            <>
                              <span className="text-muted-foreground">Disabilitas</span>
                              <span className="font-medium">{patientFull.disabilitas}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Allergies from bedside (active visit) */}
                    {bedsideData?.allergies && bedsideData.allergies.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-800">Alergi (Kunjungan Aktif)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {bedsideData.allergies.map((a, i) => (
                            <Badge key={i} variant="destructive" className="text-[11px]">
                              {a.snomed_display || a.snomed_code}
                              {a.category && <span className="ml-1 opacity-70">({a.category})</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Catatan Khusus */}
                    {patientFull?.catatan_khusus && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <span className="text-xs font-semibold text-blue-800">Catatan Khusus</span>
                        <p className="text-sm mt-1">{patientFull.catatan_khusus}</p>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Clinical Overview */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Admission Summary Banner */}
                    <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Ruangan</span>
                          <p className="text-sm font-semibold mt-0.5">{bedsideBed?.room_unit?.room?.name || bedsideRoom?.name || patient?.room_name || "-"}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Kamar / Bed</span>
                          <p className="text-sm font-semibold mt-0.5">{unit.name} / {bed.bed_number}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">DPJP</span>
                          <p className="text-sm font-semibold mt-0.5">{bedsideDoctor?.name || patient?.doctor_name || "-"}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Lama Rawat</span>
                          <p className="text-sm font-semibold mt-0.5">
                            {bedsideData ? `${bedsideData.days_of_stay} hari` : "-"}
                            {(bedsideData?.visit?.admission_time || patient?.admission_date) && (
                              <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                                (sejak {format(new Date(bedsideData?.visit?.admission_time || patient?.admission_date || ""), "dd MMM yyyy", { locale: idLocale })})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pemeriksaan Fisik */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-semibold">Pemeriksaan Fisik</span>
                      </div>
                      {peVitals ? (
                        <div className="space-y-4">
                          {/* Keadaan Umum & Kesadaran */}
                          {(peVitals.general_condition || peVitals.consciousness) && (
                            <div className="grid grid-cols-2 gap-3">
                              {peVitals.general_condition && (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Keadaan Umum</span>
                                  <p className="text-sm font-semibold mt-0.5">{peVitals.general_condition}</p>
                                </div>
                              )}
                              {peVitals.consciousness && (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Kesadaran</span>
                                  <p className="text-sm font-semibold mt-0.5">{peVitals.consciousness}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tanda Vital */}
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            <VitalBadge icon={<Heart className="h-3 w-3" />} label="Nadi" value={peVitals.heart_rate} unit="bpm" color="red" />
                            <VitalBadge icon={<Gauge className="h-3 w-3" />} label="TD" value={formatPeBP()} unit="" color="blue" />
                            <VitalBadge icon={<Thermometer className="h-3 w-3" />} label="Suhu" value={peVitals.temperature} unit="°C" color="orange" />
                            <VitalBadge icon={<Wind className="h-3 w-3" />} label="RR" value={peVitals.respiratory_rate} unit="x/mnt" color="teal" />
                            <VitalBadge icon={<Droplets className="h-3 w-3" />} label="SpO2" value={peVitals.oxygen_saturation} unit="%" color="purple" />
                          </div>

                          {/* Antropometri */}
                          {(peVitals.weight || peVitals.height || peVitals.bmi) && (
                            <div className="grid grid-cols-3 gap-2">
                              {peVitals.weight && (
                                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                                  <span className="text-[11px] text-muted-foreground">BB</span>
                                  <p className="text-sm font-bold">{peVitals.weight} <span className="text-[11px] font-normal text-muted-foreground">kg</span></p>
                                </div>
                              )}
                              {peVitals.height && (
                                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                                  <span className="text-[11px] text-muted-foreground">TB</span>
                                  <p className="text-sm font-bold">{peVitals.height} <span className="text-[11px] font-normal text-muted-foreground">cm</span></p>
                                </div>
                              )}
                              {peVitals.bmi && (
                                <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                                  <span className="text-[11px] text-muted-foreground">BMI</span>
                                  <p className="text-sm font-bold">{peVitals.bmi}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pemeriksaan Sistematis */}
                          {(() => {
                            const systemicFields: { label: string; key: keyof PhysicalExam }[] = [
                              { label: "Kepala", key: "head" },
                              { label: "Mata", key: "eyes" },
                              { label: "Telinga", key: "ears" },
                              { label: "Hidung", key: "nose" },
                              { label: "Tenggorokan", key: "throat" },
                              { label: "Leher", key: "neck" },
                              { label: "Dada", key: "chest" },
                              { label: "Jantung", key: "heart" },
                              { label: "Paru", key: "lungs" },
                              { label: "Abdomen", key: "abdomen" },
                              { label: "Ekstremitas", key: "extremities" },
                              { label: "Kulit", key: "skin" },
                              { label: "Neurologis", key: "neurological" },
                              { label: "Genitourinari", key: "genitourinary" },
                              { label: "Temuan Lain", key: "other_findings" },
                            ];
                            const filled = systemicFields.filter(f => peVitals[f.key]);
                            if (filled.length === 0) return null;
                            return (
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemeriksaan Sistematis</span>
                                <div className="mt-2 rounded-lg border divide-y">
                                  {filled.map((f) => (
                                    <div key={f.key} className="grid grid-cols-[120px_1fr] gap-2 px-3 py-2 text-sm">
                                      <span className="text-muted-foreground font-medium">{f.label}</span>
                                      <span>{String(peVitals[f.key])}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">Belum ada data pemeriksaan fisik</p>
                      )}
                    </div>

                    {/* Diagnoses */}
                    {bedsideData?.diagnoses && bedsideData.diagnoses.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Stethoscope className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-semibold">Diagnosa</span>
                        </div>
                        <div className="rounded-lg border divide-y">
                          {bedsideData.diagnoses.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 px-3 py-2">
                              <Badge
                                variant={d.type === "primary" ? "default" : "outline"}
                                className="text-[10px] shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center p-0 rounded-full"
                              >
                                {d.type === "primary" ? "P" : "S"}
                              </Badge>
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-primary">{d.icd_code}</span>
                                <span className="text-xs text-muted-foreground ml-2">{d.description || d.icd_description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Medications */}
                    {bedsideData?.medicine_orders && bedsideData.medicine_orders.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Pill className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-semibold">Obat Aktif</span>
                        </div>
                        <div className="rounded-lg border divide-y">
                          {bedsideData.medicine_orders.flatMap(o => o.items || []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                              <span className="font-medium">{item.medicine?.name || "-"}</span>
                              <span className="text-muted-foreground">{item.dosage} · {item.frequency} · {item.route}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        )}

        {/* ============================================================== */}
        {/* TAB 2: Riwayat Kunjungan (Tree + PDF viewer)                   */}
        {/* ============================================================== */}
        {activeTab === "visit-history" && (
          <div className="flex h-full overflow-hidden">
            {/* Sidebar Tree */}
            <div className="w-80 shrink-0 border-r bg-muted/30 flex flex-col">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Riwayat Kunjungan</h3>
                <p className="text-xs text-muted-foreground">{visits.length} kunjungan</p>
              </div>
              <ScrollArea className="flex-1">
                {loadingVisits ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sortedVisits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-xs text-muted-foreground">Tidak ada data</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {sortedVisits.map((visit) => {
                      const isExpanded = expandedVisitIds.has(visit.id);
                      const docs = getDocsForVisit(visit);
                      const isLoadingThis = isExpanded && loadingOrders && !visitOrdersMap[visit.id]?.loaded;

                      return (
                        <Collapsible key={visit.id} open={isExpanded} onOpenChange={() => toggleVisit(visit.id)}>
                          <CollapsibleTrigger asChild>
                            <button
                              className={cn(
                                "flex w-full items-start gap-1.5 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                                isExpanded && "bg-accent"
                              )}
                            >
                              <div className="mt-0.5">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant="secondary"
                                    className={cn("text-[10px] px-1 py-0", getVisitTypeBadgeColor(visit.visit_type))}
                                  >
                                    {getVisitTypeLabel(visit.visit_type)}
                                  </Badge>
                                  {visit.status === "in_progress" && (
                                    <Badge variant="default" className="text-[10px] px-1 py-0 bg-green-600">
                                      Aktif
                                    </Badge>
                                  )}
                                  {(visit.status === "waiting" || visit.status === "in_queue") && (
                                    <Badge variant="default" className="text-[10px] px-1 py-0 bg-amber-500">
                                      Menunggu
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {visit.room?.name || "-"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[11px] text-muted-foreground">
                                    {visit.start_time
                                      ? format(new Date(visit.start_time), "dd MMM yyyy", { locale: idLocale })
                                      : "-"}
                                  </span>
                                </div>
                                {visit.doctor?.nama_lengkap && (
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {visit.doctor.nama_lengkap}
                                  </p>
                                )}
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 border-l pl-2 mr-1 mb-1 space-y-0.5">
                              {isLoadingThis && (
                                <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Memuat dokumen...
                                </div>
                              )}
                              {docs.map((doc) => (
                                <button
                                  key={doc.id}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors text-left hover:bg-accent",
                                    selectedDocId === doc.id && "bg-primary/10 font-medium"
                                  )}
                                  onClick={() => handleSelectDoc(doc)}
                                >
                                  {doc.icon}
                                  <span className="truncate">{doc.label}</span>
                                </button>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-muted/10">
              {loadingPdf ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    <p className="mt-2 text-xs text-muted-foreground">Memuat dokumen...</p>
                  </div>
                </div>
              ) : pdfError ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">{pdfError}</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="h-full w-full border-0" title="PDF Viewer" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pilih dokumen dari sidebar kiri untuk melihat PDF
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CPPT                                                    */}
        {/* ============================================================== */}
        {activeTab === "cppt" && visitId && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <CPPTForm visitId={visitId} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
