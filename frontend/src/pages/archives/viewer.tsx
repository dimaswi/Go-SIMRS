/**
 * Archive Medical Record Viewer
 * Halaman untuk melihat rekam medis dari arsip
 * Layout: Sidebar (grouped by registration > visit > documents) + Content (PDF viewer)
 * Features: PDF preview, multi-select, PDF bundling/merge
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { visitsApi, printApi, medicineOrdersApi, procedureOrdersApi } from "@/lib/api";
import { fetchAvailableDocs } from "@/lib/api/print";
import { mergePdfs } from "@/lib/pdf-merge";
import { patientsApi } from "@/lib/api/patients";
import type { Visit } from "@/lib/api/visits";
import type { MedicineOrder } from "@/lib/api/medicine-orders";
import type { ProcedureOrder } from "@/lib/api/procedure-orders";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Stethoscope,
  Activity,
  Droplets,
  HeartPulse,
  BedDouble,
  AlertTriangle,
  ClipboardList,
  Pill,
  FlaskConical,
  User,
  Send,
  FileCheck,
  ListChecks,
  Merge,
  X,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

// === Types ===

interface DocItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  fetchBlob: () => Promise<Blob>;
  docKey?: string;
}

interface SelectedDoc {
  docItem: DocItem;
  visitId: number;
  visitIndex: number;
  docIndex: number;
}

interface VisitOrders {
  medicineOrders: MedicineOrder[];
  procedureOrders: ProcedureOrder[];
  loaded: boolean;
}

interface RegistrationGroup {
  registrationId: number;
  registrationNumber: string;
  registrationDate: string;
  registrationType: string;
  visits: Visit[];
}

// === Helpers ===

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

function getRegTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    outpatient: "Rawat Jalan",
    inpatient: "Rawat Inap",
    emergency: "UGD",
  };
  return labels[type] || type;
}

function getRegTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    outpatient: "bg-blue-50 text-blue-700 border-blue-200",
    inpatient: "bg-purple-50 text-purple-700 border-purple-200",
    emergency: "bg-red-50 text-red-700 border-red-200",
  };
  return colors[type] || "bg-gray-50 text-gray-700 border-gray-200";
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
      icon: <FileText className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.inpatientResume(visit.id),
      docKey: "resume",
    });
  } else if (isEmergency) {
    docs.push({
      id: `resume-${visit.id}`,
      label: "Resume Medis UGD",
      icon: <FileText className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.outpatientResume(visit.id),
      docKey: "resume",
    });
  } else {
    docs.push({
      id: `resume-${visit.id}`,
      label: "Resume Medis Rawat Jalan",
      icon: <FileText className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.outpatientResume(visit.id),
      docKey: "resume",
    });
  }

  docs.push({
    id: `referral-letter-${visit.id}`,
    label: "Surat Rujukan",
    icon: <Send className="h-4 w-4" />,
    fetchBlob: () => printApi.blob.referralLetter(visit.id),
    docKey: "referral_letter",
  });

  if (isEmergency) {
    docs.push({
      id: `triage-${visit.id}`,
      label: "Formulir Triage UGD",
      icon: <AlertTriangle className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.triageForm(visit.id),
      docKey: "triage",
    });
    docs.push({
      id: `emergency-summary-${visit.id}`,
      label: "Ringkasan Pelayanan UGD",
      icon: <ClipboardList className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.emergencySummary(visit.id),
      docKey: "emergency_summary",
    });
  }

  if (isInpatient) {
    docs.push({
      id: `cppt-${visit.id}`,
      label: "CPPT",
      icon: <Stethoscope className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.cppt(visit.id),
      docKey: "cppt",
    });
    docs.push({
      id: `nursing-care-${visit.id}`,
      label: "Asuhan Keperawatan",
      icon: <Activity className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.nursingCare(visit.id),
      docKey: "nursing_care",
    });
    docs.push({
      id: `fluid-balance-${visit.id}`,
      label: "Balance Cairan",
      icon: <Droplets className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.fluidBalance(visit.id),
      docKey: "fluid_balance",
    });
    docs.push({
      id: `bed-transfer-${visit.id}`,
      label: "Lembar Mutasi Pasien",
      icon: <BedDouble className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.bedTransfer(visit.id),
      docKey: "bed_transfer",
    });
    docs.push({
      id: `vital-sign-chart-${visit.id}`,
      label: "Grafik Tanda Vital",
      icon: <HeartPulse className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.vitalSignChart(visit.id),
      docKey: "vital_sign_chart",
    });
  }

  if (isInpatient || isEmergency) {
    docs.push({
      id: `inpatient-certificate-${visit.id}`,
      label: "Surat Keterangan Rawat Inap",
      icon: <FileCheck className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.inpatientCertificate(visit.id),
      docKey: "inpatient_certificate",
    });
  }

  return docs;
}

function getOrderDocs(
  _visitId: number,
  medicineOrders: MedicineOrder[],
  procedureOrders: ProcedureOrder[]
): DocItem[] {
  const docs: DocItem[] = [];

  for (const order of medicineOrders) {
    docs.push({
      id: `prescription-${order.id}`,
      label: `Resep Obat - ${order.order_number}`,
      icon: <Pill className="h-4 w-4" />,
      fetchBlob: () => printApi.blob.prescription(order.id),
    });
  }

  for (const order of procedureOrders) {
    if (order.order_type === "laboratory") {
      docs.push({
        id: `lab-order-${order.id}`,
        label: `Permintaan Lab - ${order.order_number}`,
        icon: <FlaskConical className="h-4 w-4" />,
        fetchBlob: () => printApi.blob.labOrder(order.id),
      });
      if (order.status === "completed") {
        docs.push({
          id: `lab-result-${order.id}`,
          label: `Hasil Lab - ${order.order_number}`,
          icon: <FlaskConical className="h-4 w-4" />,
          fetchBlob: () => printApi.blob.labResult(order.id),
        });
      }
    }
  }

  return docs;
}

// === Component ===

export default function ArchiveViewerPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [expandedVisitIds, setExpandedVisitIds] = useState<Set<number>>(new Set());
  const [expandedRegIds, setExpandedRegIds] = useState<Set<number>>(new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [visitOrdersMap, setVisitOrdersMap] = useState<Record<number, VisitOrders>>({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [visitAvailableDocs, setVisitAvailableDocs] = useState<Record<number, string[]>>({});

  // Bundle mode
  const [bundleMode, setBundleMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Map<string, SelectedDoc>>(new Map());
  const [isBundling, setIsBundling] = useState(false);
  const [bundleProgress, setBundleProgress] = useState<{ current: number; total: number } | null>(null);

  // Group visits by registration
  const registrationGroups = useMemo((): RegistrationGroup[] => {
    const groupMap = new Map<number, RegistrationGroup>();

    for (const visit of visits) {
      const regId = visit.registration_id;
      if (!groupMap.has(regId)) {
        groupMap.set(regId, {
          registrationId: regId,
          registrationNumber: visit.registration?.registration_number || `REG-${regId}`,
          registrationDate: visit.registration?.registration_date || visit.start_time || "",
          registrationType: visit.registration?.registration_type || visit.visit_type,
          visits: [],
        });
      }
      groupMap.get(regId)!.visits.push(visit);
    }

    // Sort by registration date descending (newest first)
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()
    );
  }, [visits]);

  const loadData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [patientRes, visitsRes] = await Promise.all([
        patientsApi.getById(Number(patientId)),
        visitsApi.getAll({
          patient_id: Number(patientId),
          status: "completed",
        }),
      ]);
      setPatient(patientRes.data);

      const mainVisits = (visitsRes.data || []).filter(
        (v: Visit) => !["lab", "radiology", "pharmacy", "surgery", "consultation", "procedure"].includes(v.visit_type)
      );
      setVisits(mainVisits);
    } catch {
      toast({
        title: "Gagal memuat data",
        description: "Tidak dapat memuat data pasien dan kunjungan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadOrdersForVisit = useCallback(async (visitId: number) => {
    if (visitOrdersMap[visitId]?.loaded) return;

    setLoadingOrders(true);
    try {
      const [medRes, procRes, availDocs] = await Promise.all([
        medicineOrdersApi.getAll({ source_visit_id: visitId }),
        procedureOrdersApi.getAll({ source_visit_id: visitId }),
        fetchAvailableDocs(visitId),
      ]);
      setVisitOrdersMap((prev) => ({
        ...prev,
        [visitId]: {
          medicineOrders: medRes.data || [],
          procedureOrders: procRes.data || [],
          loaded: true,
        },
      }));
      setVisitAvailableDocs((prev) => ({
        ...prev,
        [visitId]: availDocs,
      }));
    } catch {
      setVisitOrdersMap((prev) => ({
        ...prev,
        [visitId]: { medicineOrders: [], procedureOrders: [], loaded: true },
      }));
    } finally {
      setLoadingOrders(false);
    }
  }, [visitOrdersMap]);

  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleSelectDoc = async (doc: DocItem) => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setPdfError(null);
    setSelectedDocId(doc.id);
    setLoadingPdf(true);

    try {
      const blob = await doc.fetchBlob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setPdfError("Data untuk dokumen ini belum tersedia pada kunjungan ini.");
      } else {
        setPdfError("Gagal memuat dokumen. Silakan coba lagi.");
      }
    } finally {
      setLoadingPdf(false);
    }
  };

  const toggleReg = (regId: number) => {
    setExpandedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) {
        next.delete(regId);
      } else {
        next.add(regId);
      }
      return next;
    });
  };

  const toggleVisit = (visitId: number) => {
    setExpandedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(visitId)) {
        next.delete(visitId);
      } else {
        next.add(visitId);
        loadOrdersForVisit(visitId);
      }
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
      const orderDocs = getOrderDocs(visit.id, orders.medicineOrders, orders.procedureOrders);
      return [...filteredBaseDocs, ...orderDocs];
    }
    return filteredBaseDocs;
  };

  // === Bundle helpers ===

  const toggleDocSelection = (doc: DocItem, visitId: number, visitIdx: number, docIdx: number) => {
    setSelectedDocs((prev) => {
      const next = new Map(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else {
        next.set(doc.id, { docItem: doc, visitId, visitIndex: visitIdx, docIndex: docIdx });
      }
      return next;
    });
  };

  const toggleVisitSelection = (visit: Visit, visitIdx: number, docs: DocItem[]) => {
    const allSelected = docs.length > 0 && docs.every((d) => selectedDocs.has(d.id));
    setSelectedDocs((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        docs.forEach((d) => next.delete(d.id));
      } else {
        docs.forEach((d, docIdx) => {
          next.set(d.id, { docItem: d, visitId: visit.id, visitIndex: visitIdx, docIndex: docIdx });
        });
      }
      return next;
    });
  };

  const getVisitCheckboxState = (docs: DocItem[]): boolean | "indeterminate" => {
    if (docs.length === 0) return false;
    const count = docs.filter((d) => selectedDocs.has(d.id)).length;
    if (count === 0) return false;
    if (count === docs.length) return true;
    return "indeterminate";
  };

  const getRegCheckboxState = (regVisits: Visit[]): boolean | "indeterminate" => {
    let totalDocs = 0;
    let totalSelected = 0;
    for (const v of regVisits) {
      const docs = getDocsForVisit(v);
      totalDocs += docs.length;
      totalSelected += docs.filter((d) => selectedDocs.has(d.id)).length;
    }
    if (totalDocs === 0) return false;
    if (totalSelected === 0) return false;
    if (totalSelected === totalDocs) return true;
    return "indeterminate";
  };

  const toggleRegSelection = (group: RegistrationGroup) => {
    const state = getRegCheckboxState(group.visits);
    setSelectedDocs((prev) => {
      const next = new Map(prev);
      if (state === true) {
        // Deselect all docs in this registration
        for (const v of group.visits) {
          const docs = getDocsForVisit(v);
          docs.forEach((d) => next.delete(d.id));
        }
      } else {
        // Select all docs in this registration
        // Find the global visit index
        let globalVisitIdx = 0;
        for (const g of registrationGroups) {
          for (const v of g.visits) {
            if (v.registration_id === group.registrationId) {
              const docs = getDocsForVisit(v);
              docs.forEach((d, docIdx) => {
                next.set(d.id, { docItem: d, visitId: v.id, visitIndex: globalVisitIdx, docIndex: docIdx });
              });
            }
            globalVisitIdx++;
          }
        }
      }
      return next;
    });
  };

  const exitBundleMode = () => {
    setBundleMode(false);
    setSelectedDocs(new Map());
  };

  const handleBundle = async () => {
    if (selectedDocs.size === 0) return;

    const sortedDocs = Array.from(selectedDocs.values()).sort((a, b) => {
      if (a.visitIndex !== b.visitIndex) return a.visitIndex - b.visitIndex;
      return a.docIndex - b.docIndex;
    });

    const mergeItems = sortedDocs.map((sd) => ({
      label: sd.docItem.label,
      fetchBlob: sd.docItem.fetchBlob,
    }));

    setIsBundling(true);
    setBundleProgress(null);

    try {
      const result = await mergePdfs(mergeItems, (current, total) => {
        setBundleProgress({ current, total });
      });

      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
      const url = window.URL.createObjectURL(result.blob);
      setPdfUrl(url);
      setPdfError(null);
      setSelectedDocId(null);

      if (result.failedItems.length > 0) {
        toast({
          title: "Sebagian dokumen gagal dimuat",
          description: `${result.failedItems.length} dokumen dilewati: ${result.failedItems.join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "PDF berhasil digabungkan",
          description: `${result.totalPages} halaman dari ${result.successCount} dokumen`,
        });
      }

      exitBundleMode();
    } catch {
      toast({
        title: "Gagal menggabungkan PDF",
        description: "Tidak ada dokumen yang berhasil dimuat. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsBundling(false);
      setBundleProgress(null);
    }
  };

  // === Render ===

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build a global visit index for ordering in bundle
  let globalVisitIdx = 0;
  const visitGlobalIndexMap = new Map<number, number>();
  for (const group of registrationGroups) {
    for (const v of group.visits) {
      visitGlobalIndexMap.set(v.id, globalVisitIdx++);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col relative">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/archives")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
        <div className="h-6 w-px bg-border" />
        {patient && (
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{patient.nama_lengkap}</p>
              <p className="text-xs text-muted-foreground">
                No. RM: {patient.no_rm}
                {patient.tanggal_lahir && (
                  <>
                    {" "}&middot;{" "}
                    {format(new Date(patient.tanggal_lahir), "dd MMM yyyy", { locale: idLocale })}
                  </>
                )}
                {patient.jenis_kelamin && (
                  <>
                    {" "}&middot; {patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Riwayat Registrasi</h3>
              <p className="text-xs text-muted-foreground">
                {registrationGroups.length} registrasi &middot; {visits.length} kunjungan
              </p>
            </div>
            <Button
              variant={bundleMode ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => (bundleMode ? exitBundleMode() : setBundleMode(true))}
              title={bundleMode ? "Batal pilih" : "Pilih & gabungkan PDF"}
            >
              {bundleMode ? <X className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {registrationGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Tidak ada data</p>
              </div>
            ) : (
              <div className={cn("p-2 space-y-1", bundleMode && selectedDocs.size > 0 && "pb-20")}>
                {registrationGroups.map((group) => {
                  const isRegExpanded = expandedRegIds.has(group.registrationId);
                  const regCheckState = bundleMode && isRegExpanded ? getRegCheckboxState(group.visits) : false;
                  const hasSingleVisit = group.visits.length === 1;

                  return (
                    <Collapsible
                      key={group.registrationId}
                      open={isRegExpanded}
                      onOpenChange={() => toggleReg(group.registrationId)}
                    >
                      {/* Registration header */}
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                            isRegExpanded && "bg-accent"
                          )}
                        >
                          {bundleMode && isRegExpanded && (
                            <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={regCheckState}
                                onCheckedChange={() => toggleRegSelection(group)}
                              />
                            </div>
                          )}
                          <div className="mt-0.5">
                            {isRegExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0", getRegTypeBadgeColor(group.registrationType))}
                              >
                                {getRegTypeLabel(group.registrationType)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <CalendarDays className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {group.registrationDate
                                  ? format(new Date(group.registrationDate), "dd MMM yyyy", { locale: idLocale })
                                  : "-"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {group.registrationNumber}
                              {!hasSingleVisit && (
                                <span className="ml-1 opacity-70">
                                  &middot; {group.visits.length} kunjungan
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="ml-3 border-l pl-2 mr-1 mb-1 space-y-0.5">
                          {group.visits.map((visit) => {
                            const isVisitExpanded = expandedVisitIds.has(visit.id);
                            const docs = getDocsForVisit(visit);
                            const isLoadingThisVisit = isVisitExpanded && loadingOrders && !visitOrdersMap[visit.id]?.loaded;
                            const vIdx = visitGlobalIndexMap.get(visit.id) ?? 0;
                            const visitCheckState = bundleMode && isVisitExpanded ? getVisitCheckboxState(docs) : false;

                            // If only 1 visit in registration, show docs directly
                            if (hasSingleVisit) {
                              // Auto-load orders for this visit when registration expands
                              if (!visitOrdersMap[visit.id]?.loaded && !loadingOrders) {
                                loadOrdersForVisit(visit.id);
                              }

                              return (
                                <div key={visit.id} className="space-y-0.5 py-1">
                                  <p className="text-[11px] text-muted-foreground px-2 mb-1">
                                    {visit.room?.name || "-"}
                                    {visit.doctor?.nama_lengkap && <> &middot; {visit.doctor.nama_lengkap}</>}
                                  </p>
                                  {loadingOrders && !visitOrdersMap[visit.id]?.loaded && (
                                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Memuat dokumen...
                                    </div>
                                  )}
                                  {docs.map((doc, docIdx) => (
                                    <div
                                      key={doc.id}
                                      className={cn(
                                        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors text-left",
                                        selectedDocId === doc.id && !bundleMode ? "bg-primary/10 font-medium" : "hover:bg-accent",
                                        bundleMode && selectedDocs.has(doc.id) && "bg-primary/10"
                                      )}
                                    >
                                      {bundleMode && (
                                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            checked={selectedDocs.has(doc.id)}
                                            onCheckedChange={() => toggleDocSelection(doc, visit.id, vIdx, docIdx)}
                                          />
                                        </div>
                                      )}
                                      <button
                                        className="flex items-center gap-2 flex-1 min-w-0"
                                        onClick={() => handleSelectDoc(doc)}
                                      >
                                        {doc.icon}
                                        <span className="truncate">{doc.label}</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            // Multiple visits: nested collapsible per visit
                            return (
                              <Collapsible
                                key={visit.id}
                                open={isVisitExpanded}
                                onOpenChange={() => toggleVisit(visit.id)}
                              >
                                <CollapsibleTrigger asChild>
                                  <button
                                    className={cn(
                                      "flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                                      isVisitExpanded && "bg-accent/50"
                                    )}
                                  >
                                    {bundleMode && isVisitExpanded && docs.length > 0 && (
                                      <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={visitCheckState}
                                          onCheckedChange={() => toggleVisitSelection(visit, vIdx, docs)}
                                        />
                                      </div>
                                    )}
                                    <div className="mt-0.5">
                                      {isVisitExpanded ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
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
                                        <span className="text-[11px] text-muted-foreground">
                                          {visit.room?.name || "-"}
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
                                  <div className="ml-4 mr-1 mb-1 space-y-0.5">
                                    {isLoadingThisVisit && (
                                      <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Memuat dokumen...
                                      </div>
                                    )}
                                    {docs.map((doc, docIdx) => (
                                      <div
                                        key={doc.id}
                                        className={cn(
                                          "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors text-left",
                                          selectedDocId === doc.id && !bundleMode ? "bg-primary/10 font-medium" : "hover:bg-accent",
                                          bundleMode && selectedDocs.has(doc.id) && "bg-primary/10"
                                        )}
                                      >
                                        {bundleMode && (
                                          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                              checked={selectedDocs.has(doc.id)}
                                              onCheckedChange={() => toggleDocSelection(doc, visit.id, vIdx, docIdx)}
                                            />
                                          </div>
                                        )}
                                        <button
                                          className="flex items-center gap-2 flex-1 min-w-0"
                                          onClick={() => handleSelectDoc(doc)}
                                        >
                                          {doc.icon}
                                          <span className="truncate">{doc.label}</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Content - PDF Viewer */}
        <div className="flex-1 bg-muted/10">
          {loadingPdf ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">Memuat dokumen...</p>
              </div>
            </div>
          ) : pdfError ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">{pdfError}</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="h-full w-full border-0" title="PDF Viewer" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {bundleMode
                    ? "Centang dokumen yang ingin digabungkan, lalu klik Gabungkan PDF"
                    : "Pilih dokumen dari sidebar untuk melihat rekam medis"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating action bar for bundle */}
      {bundleMode && selectedDocs.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
          <Badge variant="secondary" className="text-xs">
            {selectedDocs.size} dokumen dipilih
          </Badge>
          <Button size="sm" onClick={handleBundle} disabled={isBundling}>
            {isBundling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {bundleProgress
                  ? `Menggabungkan ${bundleProgress.current}/${bundleProgress.total}...`
                  : "Mempersiapkan..."}
              </>
            ) : (
              <>
                <Merge className="mr-2 h-4 w-4" />
                Gabungkan PDF
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={exitBundleMode} disabled={isBundling}>
            Batal
          </Button>
        </div>
      )}
    </div>
  );
}
