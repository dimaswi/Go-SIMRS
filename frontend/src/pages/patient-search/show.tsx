import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { type ColumnDef } from "@/components/ui/data-table-utils";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import {
  patientsApi,
  registrationApi,
  bpjsApi,
  type Patient,
  type Registration,
  api
} from "@/lib/api";
import { medicineOrdersApi } from "@/lib/api/medicine-orders";
import { visitsApi, type Visit } from "@/lib/api/visits";
import { billingApi, type Billing } from "@/lib/api/billing";
import { vclaimApi, type SEPLocal } from "@/lib/api/vclaim";
import { printApi, fetchAvailableDocs } from "@/lib/api/print";
import { procedureOrdersApi } from "@/lib/api/procedure-orders";
import type { MedicineOrder } from "@/lib/api/medicine-orders";
import type { ProcedureOrder } from "@/lib/api/procedure-orders";
import { admissionRequestApi, type AdmissionRequest } from "@/lib/api/admission-request";
import { mergePdfs } from "@/lib/pdf-merge";
import { setPageTitle } from "@/lib/page-title";
import { RegistrationSheet } from "@/components/registration/registration-sheet";
import { SEPDetailSheet } from "@/components/sep/sep-detail-sheet";
import {
  User,
  Loader2,
  MapPin,
  Phone,
  Shield,
  Heart,
  ChevronDown,
  ChevronRight,
  FileText,
  FileSignature,
  UserCheck,
  AlertTriangle,
  CreditCard,
  Eye,
  Pencil,
  UserPlus,
  ClipboardList,
  FileCheck,
  Printer,
  Trash2,
  MoreHorizontal,
  BedDouble,
  ArrowRight,
  Stethoscope,
  Activity,
  Droplets,
  HeartPulse,
  Pill,
  FlaskConical,
  Send,
  ListChecks,
  Merge,
  X,

  FolderOpen,
  ArrowLeft,
  Briefcase,
  Dna,
  Fingerprint,

} from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


// === Helpers ===
function getRmVisitTypeBadgeColor(type: string): string {
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

export default function PatientSearchShow() {
  const { id: patientId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = searchParams.get("q") || "";
  const activeTab = searchParams.get("tab") || "detail";

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("tab", value);
      return prev;
    });
  };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [seps, setSeps] = useState<SEPLocal[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingBillings, setLoadingBillings] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loadingSeps, setLoadingSeps] = useState(false);
  const [expandedRegistrations, setExpandedRegistrations] = useState<Set<number>>(new Set());

  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [loadingAdmissionRequests, setLoadingAdmissionRequests] = useState(false);
  const [registrationSheetOpen, setRegistrationSheetOpen] = useState(false);
  const [launchingFingerprint, setLaunchingFingerprint] = useState(false);
  const [deleteSepId, setDeleteSepId] = useState<SEPLocal | null>(null);
  const [deletingSep, setDeletingSep] = useState(false);
  const [selectedSep, setSelectedSep] = useState<SEPLocal | null>(null);
  const [sepDetailOpen, setSepDetailOpen] = useState(false);
  // === Rekam Medis State ===
  const [rmVisits, setRmVisits] = useState<Visit[]>([]);
  const [loadingRm, setLoadingRm] = useState(false);
  const [rmLoaded, setRmLoaded] = useState(false);
  const [rmExpandedVisitIds, setRmExpandedVisitIds] = useState<Set<number>>(new Set());
  const [rmExpandedRegIds, setRmExpandedRegIds] = useState<Set<number>>(new Set());
  const [rmSelectedDocId, setRmSelectedDocId] = useState<string | null>(null);
  const [rmPdfUrl, setRmPdfUrl] = useState<string | null>(null);
  const [rmPdfError, setRmPdfError] = useState<string | null>(null);
  const [rmLoadingPdf, setRmLoadingPdf] = useState(false);
  const [rmVisitOrdersMap, setRmVisitOrdersMap] = useState<Record<number, VisitOrders>>({});
  const [rmLoadingOrders, setRmLoadingOrders] = useState(false);
  const [rmVisitAvailableDocs, setRmVisitAvailableDocs] = useState<Record<number, string[]>>({});
  const [rmBundleMode, setRmBundleMode] = useState(false);
  const [rmSelectedDocs, setRmSelectedDocs] = useState<Map<string, SelectedDoc>>(new Map());
  const [rmIsBundling, setRmIsBundling] = useState(false);
  const [rmBundleProgress, setRmBundleProgress] = useState<{ current: number; total: number } | null>(null);

  const toggleRegistrationExpand = (regId: number) => {
    setExpandedRegistrations(prev => {
      const next = new Set(prev);
      if (next.has(regId)) {
        next.delete(regId);
      } else {
        next.add(regId);
      }
      return next;
    });
  };

  const visitsByRegistration = useMemo(() => {
    const map = new Map<number, Visit[]>();
    for (const visit of visits) {
      const regId = visit.registration_id;
      if (regId) {
        if (!map.has(regId)) map.set(regId, []);
        map.get(regId)!.push(visit);
      }
    }
    return map;
  }, [visits]);

  // === Rekam Medis Logic ===
  const rmRegistrationGroups = useMemo((): RegistrationGroup[] => {
    const groupMap = new Map<number, RegistrationGroup>();
    for (const visit of rmVisits) {
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
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()
    );
  }, [rmVisits]);

  const loadRmVisits = useCallback(async () => {
    if (!patientId || rmLoaded) return;
    setLoadingRm(true);
    try {
      const visitsRes = await visitsApi.getAll({
        patient_id: Number(patientId),
        status: "completed",
      });
      const mainVisits = (visitsRes.data || []).filter(
        (v: Visit) => !["lab", "radiology", "pharmacy", "surgery", "consultation", "procedure"].includes(v.visit_type)
      );
      setRmVisits(mainVisits);
      setRmLoaded(true);
    } catch {
      toast({
        title: "Gagal memuat rekam medis",
        description: "Tidak dapat memuat data rekam medis",
        variant: "destructive",
      });
    } finally {
      setLoadingRm(false);
    }
  }, [patientId, rmLoaded, toast]);

  useEffect(() => {
    if (activeTab === "rekam-medis") {
      loadRmVisits();
    }
  }, [activeTab, loadRmVisits]);

  useEffect(() => {
    return () => {
      if (rmPdfUrl) window.URL.revokeObjectURL(rmPdfUrl);
    };
  }, [rmPdfUrl]);

  const loadRmOrdersForVisit = useCallback(async (visitId: number) => {
    if (rmVisitOrdersMap[visitId]?.loaded) return;
    setRmLoadingOrders(true);
    try {
      const [medRes, procRes, availDocs] = await Promise.all([
        medicineOrdersApi.getAll({ source_visit_id: visitId }),
        procedureOrdersApi.getAll({ source_visit_id: visitId }),
        fetchAvailableDocs(visitId),
      ]);
      setRmVisitOrdersMap((prev) => ({
        ...prev,
        [visitId]: {
          medicineOrders: medRes.data || [],
          procedureOrders: procRes.data || [],
          loaded: true,
        },
      }));
      setRmVisitAvailableDocs((prev) => ({
        ...prev,
        [visitId]: availDocs,
      }));
    } catch {
      setRmVisitOrdersMap((prev) => ({
        ...prev,
        [visitId]: { medicineOrders: [], procedureOrders: [], loaded: true },
      }));
    } finally {
      setRmLoadingOrders(false);
    }
  }, [rmVisitOrdersMap]);

  const handleRmSelectDoc = async (doc: DocItem) => {
    if (rmPdfUrl) {
      window.URL.revokeObjectURL(rmPdfUrl);
      setRmPdfUrl(null);
    }
    setRmPdfError(null);
    setRmSelectedDocId(doc.id);
    setRmLoadingPdf(true);
    try {
      const blob = await doc.fetchBlob();
      const url = window.URL.createObjectURL(blob);
      setRmPdfUrl(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setRmPdfError("Data untuk dokumen ini belum tersedia pada kunjungan ini.");
      } else {
        setRmPdfError("Gagal memuat dokumen. Silakan coba lagi.");
      }
    } finally {
      setRmLoadingPdf(false);
    }
  };

  const toggleRmReg = (regId: number) => {
    setRmExpandedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  };

  const toggleRmVisit = (visitId: number) => {
    setRmExpandedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(visitId)) {
        next.delete(visitId);
      } else {
        next.add(visitId);
        loadRmOrdersForVisit(visitId);
      }
      return next;
    });
  };

  const getRmDocsForVisit = (visit: Visit): DocItem[] => {
    const baseDocs = getBaseDocsForVisit(visit);
    const orders = rmVisitOrdersMap[visit.id];
    const availDocs = rmVisitAvailableDocs[visit.id];
    const filteredBaseDocs = availDocs
      ? baseDocs.filter((doc) => !doc.docKey || availDocs.includes(doc.docKey))
      : baseDocs;
    if (orders?.loaded) {
      const orderDocs = getOrderDocs(visit.id, orders.medicineOrders, orders.procedureOrders);
      return [...filteredBaseDocs, ...orderDocs];
    }
    return filteredBaseDocs;
  };

  const toggleRmDocSelection = (doc: DocItem, visitId: number, visitIdx: number, docIdx: number) => {
    setRmSelectedDocs((prev) => {
      const next = new Map(prev);
      if (next.has(doc.id)) next.delete(doc.id);
      else next.set(doc.id, { docItem: doc, visitId, visitIndex: visitIdx, docIndex: docIdx });
      return next;
    });
  };



  const getRmRegCheckboxState = (regVisits: Visit[]): boolean | "indeterminate" => {
    let totalDocs = 0;
    let totalSelected = 0;
    for (const v of regVisits) {
      const docs = getRmDocsForVisit(v);
      totalDocs += docs.length;
      totalSelected += docs.filter((d) => rmSelectedDocs.has(d.id)).length;
    }
    if (totalDocs === 0) return false;
    if (totalSelected === 0) return false;
    if (totalSelected === totalDocs) return true;
    return "indeterminate";
  };

  const toggleRmRegSelection = (group: RegistrationGroup) => {
    const state = getRmRegCheckboxState(group.visits);
    setRmSelectedDocs((prev) => {
      const next = new Map(prev);
      if (state === true) {
        for (const v of group.visits) {
          const docs = getRmDocsForVisit(v);
          docs.forEach((d) => next.delete(d.id));
        }
      } else {
        let globalVisitIdx = 0;
        for (const g of rmRegistrationGroups) {
          for (const v of g.visits) {
            if (v.registration_id === group.registrationId) {
              const docs = getRmDocsForVisit(v);
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

  const exitRmBundleMode = () => {
    setRmBundleMode(false);
    setRmSelectedDocs(new Map());
  };

  const handleRmBundle = async () => {
    if (rmSelectedDocs.size === 0) return;
    const sortedDocs = Array.from(rmSelectedDocs.values()).sort((a, b) => {
      if (a.visitIndex !== b.visitIndex) return a.visitIndex - b.visitIndex;
      return a.docIndex - b.docIndex;
    });
    const mergeItems = sortedDocs.map((sd) => ({
      label: sd.docItem.label,
      fetchBlob: sd.docItem.fetchBlob,
    }));
    setRmIsBundling(true);
    setRmBundleProgress(null);
    try {
      const result = await mergePdfs(mergeItems, (current, total) => {
        setRmBundleProgress({ current, total });
      });
      if (rmPdfUrl) window.URL.revokeObjectURL(rmPdfUrl);
      const url = window.URL.createObjectURL(result.blob);
      setRmPdfUrl(url);
      setRmPdfError(null);
      setRmSelectedDocId(null);
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
      exitRmBundleMode();
    } catch {
      toast({
        title: "Gagal menggabungkan PDF",
        description: "Tidak ada dokumen yang berhasil dimuat. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setRmIsBundling(false);
      setRmBundleProgress(null);
    }
  };

  // === Data Loading ===
  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const response = await patientsApi.getById(Number(patientId));
      const patientData = response.data;
      setPatient(patientData);
      loadVisits(Number(patientId));
      loadRegistrations(Number(patientId));
      loadSeps(Number(patientId));
      loadAdmissionRequests(Number(patientId));
      if (patientData?.no_rm) {
        loadBillings(patientData.no_rm);
      }
    } catch (error) {
      console.error("Error loading patient:", error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const loadVisits = async (pId: number) => {
    setLoadingVisits(true);
    try {
      const res = await visitsApi.getAll({ patient_id: pId });
      setVisits(res?.data || []);
    } catch {
      setVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  const loadBillings = async (noRm: string) => {
    setLoadingBillings(true);
    try {
      const res = await billingApi.getAll({ search: noRm, limit: 100 });
      setBillings(res?.data?.data || []);
    } catch {
      setBillings([]);
    } finally {
      setLoadingBillings(false);
    }
  };

  const loadRegistrations = async (pId: number) => {
    setLoadingRegistrations(true);
    try {
      const res = await registrationApi.getAll({ patient_id: pId, limit: 100 });
      setRegistrations(res?.data?.data || []);
    } catch {
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const loadSeps = async (pId: number) => {
    setLoadingSeps(true);
    try {
      const res = await vclaimApi.getSEPList({ patient_id: pId, limit: 100 });
      // vclaimApi returns { data: SEPLocal[] } directly in the response body if unintercepted
      // However, to be safe against both AxiosResponse and direct body, we handle both:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = res?.data as any;
      setSeps(Array.isArray(data) ? data : (data?.data || []));
    } catch {
      setSeps([]);
    } finally {
      setLoadingSeps(false);
    }
  };

  const loadAdmissionRequests = async (pId: number) => {
    setLoadingAdmissionRequests(true);
    try {
      const res = await admissionRequestApi.getAll({ patient_id: pId, limit: 100 });
      setAdmissionRequests(res?.data?.data || []);
    } catch {
      setAdmissionRequests([]);
    } finally {
      setLoadingAdmissionRequests(false);
    }
  };

  useEffect(() => {
    setPageTitle("Detail Pasien");
    loadPatient();
  }, [loadPatient]);

  const handleBack = () => {
    if (query) navigate(`/patient-search?q=${encodeURIComponent(query)}`);
    else navigate(-1);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd MMMM yyyy", { locale: id });
    } catch {
      return "-";
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "-";
    try {
      const age = differenceInYears(new Date(), parseISO(birthDate));
      return `${age} tahun`;
    } catch {
      return "-";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd MMM yyyy HH:mm", { locale: id });
    } catch {
      return "-";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Aktif": return "success";
      case "Tidak Aktif": return "secondary";
      case "Meninggal": return "destructive";
      default: return "outline";
    }
  };

  const getVisitStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "waiting":
      case "in_queue": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const getVisitStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Selesai";
      case "in_progress": return "Aktif";
      case "waiting": return "Menunggu";
      case "in_queue": return "Antrian";
      case "cancelled": return "Batal";
      default: return status;
    }
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case "consultation": return "Konsul";
      case "procedure": return "Tindakan";
      case "lab": return "Laboratorium";
      case "radiology": return "Radiologi";
      case "pharmacy": return "Farmasi";
      case "inpatient": return "Rawat Inap";
      case "outpatient": return "Rawat Jalan";
      case "emergency": return "IGD";
      default: return type;
    }
  };

  const getRegistrationStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "registered":
      case "in_queue": return "outline";
      case "cancelled": return "destructive";
      case "discharge": return "success";
      default: return "outline";
    }
  };

  const getRegistrationStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Selesai";
      case "in_progress": return "Aktif";
      case "registered": return "Terdaftar";
      case "in_queue": return "Antrian";
      case "cancelled": return "Batal";
      case "scheduled": return "Terjadwal";
      case "no_show": return "Tidak Hadir";
      case "discharge": return "Pulang";
      default: return status;
    }
  };

  const getSepStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "deleted": return "destructive";
      default: return "outline";
    }
  };

  const getSepStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Aktif";
      case "deleted": return "Dihapus";
      default: return status;
    }
  };

  const getJenisPelayanan = (jns: string) => jns === "1" ? "Rawat Inap" : "Rawat Jalan";

  const handleDeleteSep = async () => {
    if (!deleteSepId?.no_sep) return;
    setDeletingSep(true);
    try {
      await api.delete(`/bpjs/vclaim/sep/${deleteSepId.no_sep}`);
      toast({ title: "Berhasil", description: "SEP berhasil dihapus" });
      setDeleteSepId(null);
      loadSeps(Number(patientId));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menghapus SEP" });
    } finally {
      setDeletingSep(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!patient) return;
    try { await printApi.patientLabel(patient.id, 4); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    catch (error: any) { toast({ variant: "destructive", title: "Error", description: "Gagal mencetak label" }); }
  };


  const handleViewSep = (sep: SEPLocal) => {
    setSelectedSep(sep);
    setSepDetailOpen(true);
  };

  // === Column Definitions ===
  const sepColumns = useMemo<ColumnDef<SEPLocal>[]>(() => [
    {
      accessorKey: "no_sep",
      header: "No. SEP",
      cell: ({ row }) => <span className="font-mono font-medium text-xs">{row.original.no_sep}</span>,
    },
    {
      accessorKey: "tgl_sep",
      header: "Tgl SEP",
      cell: ({ row }) => <span className="text-xs">{row.original.tgl_sep ? format(parseISO(row.original.tgl_sep), "dd/MM/yyyy") : "-"}</span>,
    },
    {
      accessorKey: "jns_pelayanan",
      header: "Layanan",
      cell: ({ row }) => <Badge variant="outline" className="text-[10px] uppercase">{getJenisPelayanan(row.original.jns_pelayanan)}</Badge>,
    },
    {
      accessorKey: "nama_poli",
      header: "Poli",
      cell: ({ row }) => <span className="text-xs">{row.original.nama_poli || "-"}</span>,
    },
    {
      accessorKey: "nama_diagnosa",
      header: "Diagnosa",
      cell: ({ row }) => <span className="text-xs truncate max-w-[150px] block" title={row.original.nama_diagnosa}>{row.original.nama_diagnosa || "-"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={getSepStatusVariant(row.original.status)} className="text-[10px]">{getSepStatusLabel(row.original.status)}</Badge>,
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewSep(row.original)} className="text-xs"><Eye className="mr-2 h-3.5 w-3.5" /> Detail</DropdownMenuItem>
              <DropdownMenuItem onClick={() => printApi.sep(row.original.id)} className="text-xs"><Printer className="mr-2 h-3.5 w-3.5" /> Cetak SEP</DropdownMenuItem>
              {row.original.status === "active" && (
                <DropdownMenuItem className="text-destructive text-xs focus:text-destructive" onClick={() => setDeleteSepId(row.original)}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }
  ], []);

  const admissionColumns = useMemo<ColumnDef<AdmissionRequest>[]>(() => [
    {
      accessorKey: "request_number",
      header: "No. Request",
      cell: ({ row }) => <span className="font-mono font-medium text-xs">{row.original.request_number}</span>,
    },
    {
      accessorKey: "priority",
      header: "Prioritas",
      cell: ({ row }) => {
        const p = row.original.priority;
        return (
          <Badge variant={p === "emergency" ? "destructive" : p === "urgent" ? "default" : "secondary"} className={cn("text-[10px] uppercase", p === "urgent" && "bg-orange-500 hover:bg-orange-600 text-white")}>
            {p}
          </Badge>
        );
      }
    },
    {
      accessorKey: "source_visit",
      header: "Asal Unit",
      cell: ({ row }) => <span className="text-xs">{row.original.source_visit?.room?.name || "-"}</span>,
    },
    {
      accessorKey: "preferred_class",
      header: "Kelas",
      cell: ({ row }) => <span className="text-xs capitalize">{row.original.preferred_class?.replace(/_/g, ' ') || "-"}</span>,
    },
    {
      accessorKey: "requested_at",
      header: "Tgl Request",
      cell: ({ row }) => <span className="text-xs">{row.original.requested_at ? format(parseISO(row.original.requested_at), "dd/MM/yyyy HH:mm") : "-"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <Badge variant="outline" className={cn(
            "text-[10px] uppercase",
            s === "pending" && "bg-yellow-50 text-yellow-700 border-yellow-200",
            s === "approved" && "bg-green-50 text-green-700 border-green-200",
            s === "rejected" && "bg-red-50 text-red-700 border-red-200"
          )}>
            {s === "pending" ? "Menunggu" : s === "approved" ? "Disetujui" : s === "rejected" ? "Ditolak" : s}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => navigate(row.original.status === "pending" ? `/admisi/${row.original.id}` : row.original.inpatient_visit_id ? `/visits/${row.original.inpatient_visit_id}` : `/admisi/${row.original.id}`)}>
            {row.original.status === "pending" ? <ArrowRight className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
            {row.original.status === "pending" ? "Proses" : "Detail"}
          </Button>
        </div>
      )
    }
  ], [navigate]);

  const billingColumns = useMemo<ColumnDef<Billing>[]>(() => [
    {
      accessorKey: "billing_number",
      header: "No. Billing",
      cell: ({ row }) => <span className="font-mono font-medium text-xs">{row.original.billing_number}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Tanggal",
      cell: ({ row }) => <span className="text-xs">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      accessorKey: "payment_method",
      header: "Metode",
      cell: ({ row }) => <Badge variant="outline" className="text-[10px] uppercase">{row.original.payment_method}</Badge>,
    },
    {
      accessorKey: "final_amount",
      header: "Total",
      cell: ({ row }) => <span className="text-xs font-medium">{formatCurrency(row.original.final_amount)}</span>,
    },
    {
      accessorKey: "paid_amount",
      header: "Dibayar",
      cell: ({ row }) => <span className="text-xs text-green-600">{formatCurrency(row.original.paid_amount)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'paid' ? 'default' : 'outline'} className="text-[10px] uppercase">
          {row.original.status === 'paid' ? 'Lunas' : row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/billings/${row.original.id}`)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ], [navigate]);

  const registrationColumns = useMemo<ColumnDef<Registration>[]>(() => [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        const regId = row.original.id || row.original.ID;
        const isExpanded = expandedRegistrations.has(regId!);
        return (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleRegistrationExpand(regId!)}>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        );
      },
      size: 40,
    },
    {
      accessorKey: "registration_number",
      header: "No. Registrasi",
      cell: ({ row }) => <span className="font-mono font-medium text-xs">{row.original.registration_number}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Tanggal",
      cell: ({ row }) => <span className="text-xs">{formatDateTime(row.original.created_at || row.original.CreatedAt)}</span>,
    },
    {
      accessorKey: "registration_type",
      header: "Tipe",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider", getRegTypeBadgeColor(row.original.registration_type))}>
          {getRegTypeLabel(row.original.registration_type)}
        </Badge>
      ),
    },
    {
      accessorKey: "destination_room",
      header: "Tujuan",
      cell: ({ row }) => (
        <span className="text-xs flex items-center gap-1.5">
          <Stethoscope className="h-3 w-3 text-muted-foreground" />
          {row.original.destination_room?.name || '-'}
        </span>
      ),
    },
    {
      accessorKey: "doctor",
      header: "Dokter",
      cell: ({ row }) => <span className="text-xs">{row.original.doctor?.nama_lengkap || row.original.doctor?.name || '-'}</span>,
    },
    {
      accessorKey: "payment_method",
      header: "Jaminan",
      cell: ({ row }) => <Badge variant="outline" className="text-[10px] uppercase">{row.original.payment_method}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getRegistrationStatusVariant(row.original.status)} className="text-[10px] uppercase tracking-wider">
          {getRegistrationStatusLabel(row.original.status)}
        </Badge>
      ),
    },
  ], [expandedRegistrations]);

  // Custom row rendering for registration table with collapsible visits
  const registrationTableMeta = useMemo(() => ({
    renderSubRow: (row: Registration) => {
      const regId = row.id || row.ID;
      if (!regId || !expandedRegistrations.has(regId)) return null;
      const regVisits = visitsByRegistration.get(regId) || [];
      const mainVisits = regVisits.filter(v => ['outpatient', 'inpatient', 'emergency', 'consultation'].includes(v.visit_type));
      const orderVisits = regVisits.filter(v => !['outpatient', 'inpatient', 'emergency', 'consultation'].includes(v.visit_type));

      return (
        <tr key={`sub-${regId}`}>
          <td colSpan={8} className="p-0 border-b">
            <div className="bg-muted/20 pl-12 pr-4 py-3">
              {loadingVisits ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Memuat kunjungan...</div>
              ) : regVisits.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic py-1">Belum ada kunjungan terkait registrasi ini.</div>
              ) : (
                <div className="space-y-3">
                  {/* Main visits as compact table rows */}
                  {mainVisits.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-1.5">Kunjungan</p>
                      <div className="border divide-y bg-background">
                        {mainVisits.map((visit) => (
                          <div key={visit.id} className="flex items-center gap-3 px-3 h-9 text-xs group hover:bg-muted/30 transition-colors">
                            <Badge variant="secondary" className={cn("text-[9px] uppercase tracking-wider shrink-0 h-5 rounded-none", getRmVisitTypeBadgeColor(visit.visit_type))}>
                              {getVisitTypeLabel(visit.visit_type)}
                            </Badge>
                            <span className="font-medium truncate">{visit.room?.name || '-'}</span>
                            <span className="text-muted-foreground truncate hidden lg:inline">—</span>
                            <span className="text-muted-foreground truncate hidden lg:inline flex-1">{visit.doctor?.user?.name || visit.doctor?.name || '-'}</span>
                            <Badge variant={getVisitStatusVariant(visit.status)} className="text-[9px] uppercase tracking-wider shrink-0 h-5 rounded-none">{getVisitStatusLabel(visit.status)}</Badge>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => navigate(`/visits/${visit.id}`)}><Eye className="h-3 w-3" /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 rounded-none"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { if (regId) printApi.admissionDischargeSummary(regId, visit.id); }} className="text-xs"><FileText className="mr-2 h-3.5 w-3.5" /> MR.1 Ringkasan</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printApi.dpjpRequest(visit.id)} className="text-xs"><UserCheck className="mr-2 h-3.5 w-3.5" /> Permohonan DPJP</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printApi.informedConsentReceipt(visit.id)} className="text-xs"><FileSignature className="mr-2 h-3.5 w-3.5" /> Informed Consent</DropdownMenuItem>
                                  {visit.visit_type === 'outpatient' && <DropdownMenuItem onClick={() => printApi.outpatientResume(visit.id)} className="text-xs"><ClipboardList className="mr-2 h-3.5 w-3.5" /> Resume Rawat Jalan</DropdownMenuItem>}
                                  {visit.visit_type === 'emergency' && <DropdownMenuItem onClick={() => printApi.emergencySummary(visit.id)} className="text-xs"><ClipboardList className="mr-2 h-3.5 w-3.5" /> Resume IGD</DropdownMenuItem>}
                                  {visit.visit_type === 'inpatient' && <DropdownMenuItem onClick={() => printApi.inpatientResume(visit.id)} className="text-xs"><ClipboardList className="mr-2 h-3.5 w-3.5" /> Resume Rawat Inap</DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order visits as compact inline items */}
                  {orderVisits.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-1.5">Penunjang</p>
                      <div className="border divide-y bg-background">
                        {orderVisits.map((visit) => (
                          <div key={visit.id} className="flex items-center gap-3 px-3 h-9 text-xs group hover:bg-muted/30 transition-colors">
                            {visit.visit_type === 'lab' ? <FlaskConical className="h-3 w-3 text-cyan-600 shrink-0" /> : visit.visit_type === 'pharmacy' ? <Pill className="h-3 w-3 text-amber-600 shrink-0" /> : <Activity className="h-3 w-3 shrink-0" />}
                            <Badge variant="outline" className="text-[9px] uppercase px-1 h-5 rounded-none shrink-0">{getVisitTypeLabel(visit.visit_type)}</Badge>
                            <span className="font-medium truncate flex-1">{visit.room?.name || '-'}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => navigate(`/visits/${visit.id}`)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEP info inline */}
                  {row.sep_number && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                      <Shield className="h-3 w-3" />
                      <span>SEP:</span>
                      <span className="font-mono font-semibold text-primary">{row.sep_number}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    },
  }), [expandedRegistrations, visitsByRegistration, loadingVisits, navigate]);

  const handleLaunchFingerprint = useCallback(async () => {
    setLaunchingFingerprint(true);
    try {
      const response = await bpjsApi.launchFingerprintApp({
        auto_submit: true,
        bpjs_card_number: patient?.no_bpjs || undefined,
      });
      toast({
        variant: "success",
        title: "Aplikasi sidik jari dibuka",
        description: response.data.message,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || "Gagal membuka aplikasi sidik jari BPJS";
      const detail = error.response?.data?.detail;
      toast({
        variant: "destructive",
        title: "Gagal",
        description: detail ? `${message}: ${detail}` : message,
      });
    } finally {
      setLaunchingFingerprint(false);
    }
  }, [patient?.no_bpjs, toast]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Memuat data pasien...</p>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <PageShell className="h-screen flex flex-col overflow-hidden">
      <div className="flex-none">
        <PageHeader
          title="Profil & Rekam Medis"
          description={`${patient.nama_lengkap} • No. RM: ${patient.no_rm}`}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBack} className="h-8">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Kembali
              </Button>
              <Separator orientation="vertical" className="h-5 mx-1" />
              <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${patient.id}/edit`)} className="h-8 text-yellow-600 border-yellow-200 hover:bg-yellow-50">
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              {patient.status === "Aktif" && (
                <>
                  <Button size="sm" onClick={() => setRegistrationSheetOpen(true)} className="h-8">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Daftar Baru
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={handleLaunchFingerprint}
                    disabled={launchingFingerprint}
                    title="Buka aplikasi sidik jari BPJS"
                    aria-label="Buka aplikasi sidik jari BPJS"
                  >
                    {launchingFingerprint ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Fingerprint className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <PageContent className="flex-1 overflow-hidden pb-4">
        <div className="grid grid-cols-12 gap-6 h-full">
          {/* Sidebar Info */}
          <div className="col-span-12 lg:col-span-3 h-full overflow-hidden flex flex-col">
            <div className="rounded-none border bg-card shadow-sm overflow-hidden flex flex-col max-h-full">
              <div className="h-32 flex-none bg-muted/30 relative flex items-center justify-center">
                {patient.foto ? (
                  <img src={`/${patient.foto}`} alt={patient.nama_lengkap} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground/20" />
                )}
                <Badge variant={getStatusVariant(patient.status)} className="absolute top-2 right-2 uppercase tracking-wider text-[9px] rounded-none px-1.5 h-4">
                  {patient.status}
                </Badge>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
                <div className="space-y-0.5">
                  <h2 className="font-bold text-base leading-tight truncate">{patient.nama_lengkap}</h2>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{patient.nik || "TIDAK ADA NIK"}</p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                      <Dna className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold leading-none mb-1">Gender / Umur</p>
                      <p className="font-medium text-[11px]">{patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} • {calculateAge(patient.tanggal_lahir)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold leading-none mb-1">Kontak</p>
                      <p className="font-medium text-[11px]">{patient.no_hp || patient.no_telepon || "-"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold leading-none mb-1">Domisili</p>
                      <p className="font-medium text-[11px] truncate" title={patient.alamat_domisili || patient.alamat_ktp}>
                        {patient.alamat_domisili || patient.alamat_ktp || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold leading-none mb-1">Jaminan Utama</p>
                      <p className="font-medium text-[11px] capitalize">{patient.jenis_jaminan || "UMUM"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold uppercase text-red-600 flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5" /> Peringatan Medis
                  </h4>
                  <div className="space-y-1.5">
                    <div className="p-1.5 rounded-none bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                      <p className="text-[9px] font-bold text-red-700 dark:text-red-400 leading-none mb-0.5 uppercase">ALERGI OBAT</p>
                      <p className="text-[10px] font-medium text-red-800 dark:text-red-300 line-clamp-1">{patient.alergi_obat || "Tidak ada data"}</p>
                    </div>
                    <div className="p-1.5 rounded-none bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                      <p className="text-[9px] font-bold text-red-700 dark:text-red-400 leading-none mb-0.5 uppercase">PENYAKIT KRONIS</p>
                      <p className="text-[10px] font-medium text-red-800 dark:text-red-300 line-clamp-1">{patient.penyakit_kronis || "Tidak ada data"}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <Button variant="outline" className="w-full h-7 text-[10px] rounded-none" onClick={handlePrintLabel}>
                    <Printer className="h-3 w-3 mr-1.5" /> Cetak Label
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Tabs Content */}
          <div className="col-span-12 lg:col-span-9 h-full flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={handleTabChange} variant="inline" className="w-full flex-1 flex flex-col overflow-hidden">
              <div className="flex-none">
                <TabsList className="bg-transparent h-10 w-full justify-start border-b rounded-none mb-4 p-0 gap-6">
                  <TabsTrigger value="detail" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <User className="h-3.5 w-3.5" /> Detail Profil
                  </TabsTrigger>
                  <TabsTrigger value="pendaftaran" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <ClipboardList className="h-3.5 w-3.5" /> Registrasi
                  </TabsTrigger>
                  <TabsTrigger value="sep" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <FileCheck className="h-3.5 w-3.5" /> BPJS SEP
                  </TabsTrigger>
                  <TabsTrigger value="rekam-medis" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <FolderOpen className="h-3.5 w-3.5" /> Rekam Medis
                  </TabsTrigger>
                  <TabsTrigger value="rawat-inap" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <BedDouble className="h-3.5 w-3.5" /> Admisi
                    {admissionRequests.filter(r => r.status === 'pending').length > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-red-500 rounded-none">{admissionRequests.filter(r => r.status === 'pending').length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="pembayaran" className="h-10 text-xs gap-1.5 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1">
                    <CreditCard className="h-3.5 w-3.5" /> Pembayaran
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Detail Pasien Tab */}
                <TabsContent value="detail" className="m-0 focus-visible:outline-none pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-none border bg-card shadow-sm p-6 space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Identitas Lengkap</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Tempat Lahir</Label>
                          <p className="text-sm font-medium">{patient.tempat_lahir || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Tanggal Lahir</Label>
                          <p className="text-sm font-medium">{formatDate(patient.tanggal_lahir)}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Golongan Darah</Label>
                          <p className="text-sm font-medium">{patient.golongan_darah || "-"} ({patient.rhesus || "-"})</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Agama</Label>
                          <p className="text-sm font-medium">{patient.agama || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Pekerjaan</Label>
                          <p className="text-sm font-medium">{patient.pekerjaan || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Status Kawin</Label>
                          <p className="text-sm font-medium">{patient.status_perkawinan || "-"}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Pendidikan</Label>
                          <p className="text-sm font-medium">{patient.pendidikan_terakhir || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-none border bg-card shadow-sm p-6 space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Informasi Alamat</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="p-3 rounded-none bg-muted/20 border border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Alamat KTP</p>
                          <p className="text-xs leading-relaxed">{patient.alamat_ktp || "-"}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            {patient.kelurahan_ktp}, {patient.kecamatan_ktp}, {patient.kota_ktp}, {patient.provinsi_ktp}
                          </p>
                        </div>
                        <div className="p-3 rounded-none bg-muted/20 border border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Alamat Domisili</p>
                          <p className="text-xs leading-relaxed">{patient.alamat_domisili || patient.alamat_ktp || "-"}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            {patient.kelurahan_domisili || patient.kelurahan_ktp}, {patient.kecamatan_domisili || patient.kecamatan_ktp}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 rounded-none border bg-card shadow-sm p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Keluarga & Penanggung Jawab</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nama Ayah</Label>
                          <p className="text-sm font-medium">{patient.nama_ayah || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nama Ibu</Label>
                          <p className="text-sm font-medium">{patient.nama_ibu || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nama Pasangan</Label>
                          <p className="text-sm font-medium">{patient.nama_suami_istri || "-"}</p>
                        </div>
                        <Separator className="md:col-span-3" />
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nama Penanggung Jawab</Label>
                          <p className="text-sm font-medium">{patient.nama_pj || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Hubungan PJ</Label>
                          <p className="text-sm font-medium">{patient.hubungan_pj || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">No. Telp PJ</Label>
                          <p className="text-sm font-medium">{patient.no_telepon_pj || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Riwayat Pendaftaran Tab */}
                <TabsContent value="pendaftaran" className="m-0 focus-visible:outline-none">
                  <div className="rounded-none overflow-hidden">
                    <div className="relative">
                      {loadingRegistrations && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <DataTable
                        columns={registrationColumns}
                        data={registrations}
                        searchPlaceholder="Cari pendaftaran..."
                        tableId={`patient-reg-${patientId}`}
                        meta={registrationTableMeta}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Riwayat SEP Tab */}
                <TabsContent value="sep" className="m-0 focus-visible:outline-none">
                  <div className="rounded-none overflow-hidden">
                    <div className="relative">
                      {loadingSeps && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <DataTable
                        columns={sepColumns}
                        data={seps}
                        searchPlaceholder="Cari SEP..."
                        tableId={`patient-sep-${patientId}`}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Rekam Medis Tab */}
                <TabsContent value="rekam-medis" className="m-0 focus-visible:outline-none">
                  <div className="rounded-none border bg-card shadow-sm overflow-hidden">
                    <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-primary" /> Arsip Rekam Medis Digital
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant={rmBundleMode ? "default" : "outline"} size="sm" onClick={() => (rmBundleMode ? exitRmBundleMode() : setRmBundleMode(true))} className="h-8 rounded-none">
                          {rmBundleMode ? <X className="h-3.5 w-3.5 mr-1.5" /> : <ListChecks className="h-3.5 w-3.5 mr-1.5" />}
                          {rmBundleMode ? "Batal Pilih" : "Gabungkan PDF"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex relative" style={{ height: "650px" }}>
                      {/* Sidebar */}
                      <div className="w-80 flex-shrink-0 border-r bg-muted/10 flex flex-col overflow-hidden sticky top-0 h-full">
                        <ScrollArea className="flex-1">
                          <div className={cn("p-4 space-y-2", rmBundleMode && rmSelectedDocs.size > 0 && "pb-24")}>
                            {rmRegistrationGroups.length === 0 && !loadingRm && (
                              <div className="text-center py-20">
                                <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-xs text-muted-foreground font-medium">Tidak ada data rekam medis</p>
                              </div>
                            )}
                            {loadingRm && (
                              <div className="flex flex-col items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-primary/40 mb-2" />
                                <p className="text-[10px] text-muted-foreground">Memuat Arsip...</p>
                              </div>
                            )}
                            {rmRegistrationGroups.map((group) => {
                              const isRegExpanded = rmExpandedRegIds.has(group.registrationId);
                              const regCheckState = rmBundleMode && isRegExpanded ? getRmRegCheckboxState(group.visits) : false;

                              return (
                                <Collapsible key={group.registrationId} open={isRegExpanded} onOpenChange={() => toggleRmReg(group.registrationId)}>
                                  <div className={cn("group flex flex-col rounded-none border bg-background transition-all mb-1", isRegExpanded && "border-primary/20 shadow-sm ring-1 ring-primary/5")}>
                                    <CollapsibleTrigger asChild>
                                      <div className={cn("flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors", isRegExpanded && "bg-muted/20")}>
                                        {rmBundleMode && (
                                          <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
                                            <Checkbox checked={regCheckState} onCheckedChange={() => toggleRmRegSelection(group)} />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <Badge variant="outline" className={cn("text-[8px] px-1 h-3.5 uppercase font-bold", getRegTypeBadgeColor(group.registrationType))}>{getRegTypeLabel(group.registrationType)}</Badge>
                                            <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(group.registrationDate), "dd/MM/yyyy", { locale: id })}</span>
                                          </div>
                                          <p className="text-[11px] font-bold truncate leading-tight">{group.registrationNumber}</p>
                                        </div>
                                        <div className="mt-1">{isRegExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}</div>
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t bg-muted/5">
                                      <div className="p-2 space-y-1">
                                        {group.visits.map((visit) => {
                                          const isVisitExpanded = rmExpandedVisitIds.has(visit.id);
                                          const docs = getRmDocsForVisit(visit);
                                          const vIdx = rmRegistrationGroups.findIndex(g => g.registrationId === group.registrationId);

                                          return (
                                            <div key={visit.id} className="space-y-1">
                                              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => toggleRmVisit(visit.id)}>
                                                <div className="w-4 flex justify-center">{isVisitExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[10px] font-bold truncate leading-none mb-0.5">{visit.room?.name || "-"}</p>
                                                  <p className="text-[9px] text-muted-foreground truncate">{visit.doctor?.nama_lengkap || "-"}</p>
                                                </div>
                                              </div>
                                              {isVisitExpanded && (
                                                <div className="ml-6 space-y-0.5 pb-2">
                                                  {rmLoadingOrders && !rmVisitOrdersMap[visit.id]?.loaded && (
                                                    <div className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Memuat...</div>
                                                  )}
                                                  {docs.map((doc, docIdx) => (
                                                    <div key={doc.id} className={cn("flex items-center gap-2 p-1.5 rounded-md transition-colors", rmSelectedDocId === doc.id && !rmBundleMode ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent/50")}>
                                                      {rmBundleMode && (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                          <Checkbox checked={rmSelectedDocs.has(doc.id)} onCheckedChange={() => toggleRmDocSelection(doc, visit.id, vIdx, docIdx)} className={cn(rmSelectedDocId === doc.id && "border-primary-foreground")} />
                                                        </div>
                                                      )}
                                                      <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => handleRmSelectDoc(doc)}>
                                                        {doc.icon}
                                                        <span className="text-[10px] font-medium truncate">{doc.label}</span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* PDF Viewer */}
                      <div className="flex-1 bg-muted/20 flex flex-col">
                        {rmLoadingPdf ? (
                          <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="h-12 w-12 rounded-none bg-background shadow-lg flex items-center justify-center mb-3">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">Menyiapkan Dokumen Digital...</p>
                          </div>
                        ) : rmPdfError ? (
                          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <AlertTriangle className="h-12 w-12 text-destructive/20 mb-4" />
                            <h4 className="text-sm font-bold text-destructive/80 mb-1">Terjadi Kendala</h4>
                            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{rmPdfError}</p>
                          </div>
                        ) : rmPdfUrl ? (
                          <iframe src={rmPdfUrl} className="flex-1 border-0" title="PDF Viewer" />
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
                            <FolderOpen className="h-20 w-20 text-muted-foreground mb-4" />
                            <h4 className="text-sm font-bold mb-1">Pilih Dokumen Rekam Medis</h4>
                            <p className="text-xs max-w-xs leading-relaxed">Pilih salah satu dokumen dari daftar kunjungan di samping untuk menampilkan arsip digital.</p>
                          </div>
                        )}
                        {rmBundleMode && rmSelectedDocs.size > 0 && (
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-background/95 backdrop-blur-md border border-primary/20 rounded-none px-6 py-4 shadow-2xl z-50 ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Siap Digabungkan</p>
                              <p className="text-xs font-bold leading-none">{rmSelectedDocs.size} Dokumen Terpilih</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <Button size="sm" onClick={handleRmBundle} disabled={rmIsBundling} className="h-9 px-5 gap-2 shadow-lg shadow-primary/20 rounded-none">
                              {rmIsBundling ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {rmBundleProgress ? `${rmBundleProgress.current}/${rmBundleProgress.total}` : "Memproses..."}
                                </>
                              ) : (
                                <><Merge className="h-4 w-4" /> Gabungkan PDF</>
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-red-50 hover:text-red-600" onClick={exitRmBundleMode}><X className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Admisi Tab */}
                <TabsContent value="rawat-inap" className="m-0 focus-visible:outline-none">
                  <div className="rounded-none bg-card shadow-sm overflow-hidden">
                    <div className="relative">
                      {loadingAdmissionRequests && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <DataTable
                        columns={admissionColumns}
                        data={admissionRequests}
                        searchPlaceholder="Cari permintaan..."
                        tableId={`patient-admission-${patientId}`}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Pembayaran Tab */}
                <TabsContent value="pembayaran" className="m-0 focus-visible:outline-none">
                  <div className="rounded-none bg-card shadow-sm overflow-hidden">
                    <div className="relative">
                      {loadingBillings && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <DataTable
                        columns={billingColumns}
                        data={billings}
                        searchPlaceholder="Cari billing..."
                        tableId={`patient-billing-${patientId}`}
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </PageContent>

      {/* Sheets & Dialogs */}
      <RegistrationSheet
        open={registrationSheetOpen}
        onOpenChange={setRegistrationSheetOpen}
        patient={patient}
        onSuccess={() => {
          setRegistrationSheetOpen(false);
          loadRegistrations(Number(patientId));
          loadVisits(Number(patientId));
        }}
      />

      <SEPDetailSheet
        open={sepDetailOpen}
        onOpenChange={setSepDetailOpen}
        sep={selectedSep}
      />

      <AlertDialog open={!!deleteSepId} onOpenChange={(open) => !open && setDeleteSepId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEP?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. SEP nomor <strong>{deleteSepId?.no_sep}</strong> akan dihapus permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSep}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSep} disabled={deletingSep} className="bg-destructive hover:bg-destructive/90">
              {deletingSep ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
