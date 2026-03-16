/**
 * Medical Record Print Dialog
 * Dialog untuk memilih dan mencetak berbagai dokumen rekam medis
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  Printer, 
  FileText, 
  User, 
  Pill, 
  FlaskConical, 
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Calendar,
  FileCheck,
  Clock,
  Scan,
  Activity,
  Droplets,
  HeartPulse,
  BedDouble,
  AlertTriangle,
  Stethoscope
} from "lucide-react";
import { visitsApi, medicalRecordsApi, medicineOrdersApi, procedureOrdersApi, printApi } from "@/lib/api";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  visitData?: any;
  isInpatient?: boolean;
  isEmergency?: boolean;
}

type PrintCategory = "umum" | "rekam-medis" | "ugd" | "rawat-inap" | "order" | "farmasi" | "surat";

interface PrintItem {
  id: string;
  type: "label" | "rekam-medis" | "surat" | "farmasi" | "lab" | "radiology" | "ugd" | "rawat-inap";
  label: string;
  orderDate?: string;
  orderNumber?: string;
  paperSize: string;
  category: PrintCategory;
  icon: React.ReactNode;
  available: boolean;
  handler: () => void;
  details?: {
    items?: string[];
    status?: string;
    completedAt?: string;
    doctor?: string;
  };
}

// Format date to Indonesian
function formatDateId(dateStr?: string) {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: localeId });
  } catch {
    return dateStr;
  }
}

export function MedicalRecordPrintDialog({ 
  open, 
  onOpenChange, 
  visitId, 
  visitData: _visitData,
  isInpatient = false,
  isEmergency = false
}: PrintDialogProps) {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [visit, setVisit] = useState<any>(null);
  const [medicalRecord, setMedicalRecord] = useState<any>(null);
  const [medicineOrders, setMedicineOrders] = useState<any[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<PrintCategory>("umum");
  
  // Sick letter options
  const [sickLetterDays, setSickLetterDays] = useState(1);
  const [sickLetterStartDate, setSickLetterStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  
  // Label options
  const [labelCopies, setLabelCopies] = useState(4);

  useEffect(() => {
    if (open && visitId) {
      loadData();
      setExpandedItems(new Set());
    }
  }, [open, visitId]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const visitRes = await visitsApi.getById(visitId);
      setVisit(visitRes.data);

      try {
        const mrRes = await medicalRecordsApi.get(visitId);
        setMedicalRecord(mrRes.data);
      } catch {
        setMedicalRecord(null);
      }

      try {
        const moRes = await medicineOrdersApi.getAll({ source_visit_id: visitId });
        setMedicineOrders(moRes.data || []);
      } catch {
        setMedicineOrders([]);
      }

      try {
        const poRes = await procedureOrdersApi.getAll({ source_visit_id: visitId });
        setProcedureOrders(poRes.data || []);
      } catch {
        setProcedureOrders([]);
      }
    } catch (error) {
      console.error("Error loading print data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data untuk cetak",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (printFn: () => Promise<void>, description: string) => {
    setPrinting(true);
    try {
      await printFn();
      toast({
        title: "Sukses",
        description: `${description} berhasil dibuka`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || `Gagal mencetak ${description}`,
      });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintOutpatientResume = () => {
    handlePrint(() => printApi.outpatientResume(visitId), "Resume Rawat Jalan");
  };

  const handlePrintInpatientResume = () => {
    handlePrint(() => printApi.inpatientResume(visitId), "Resume Rawat Inap");
  };

  const handlePrintPatientLabel = () => {
    if (!visit?.registration?.patient?.id) return;
    handlePrint(() => printApi.patientLabel(visit.registration.patient.id, labelCopies), "Label Pasien");
  };

  const handlePrintSickLetter = () => {
    handlePrint(() => printApi.sickLetter(visitId, sickLetterDays, sickLetterStartDate), "Surat Keterangan Sakit");
  };

  const handlePrintPrescription = (orderId: number) => {
    handlePrint(() => printApi.prescription(orderId), "Resep Obat");
  };

  const handlePrintLabResult = (orderId: number) => {
    handlePrint(() => printApi.labResult(orderId), "Hasil Laboratorium");
  };

  // UGD Print Handlers
  const handlePrintTriageForm = () => {
    handlePrint(() => printApi.triageForm(visitId), "Formulir Triage");
  };

  const handlePrintEmergencySummary = () => {
    handlePrint(() => printApi.emergencySummary(visitId), "Ringkasan Pelayanan UGD");
  };

  // Rawat Inap Print Handlers
  const handlePrintCPPT = () => {
    handlePrint(() => printApi.cppt(visitId), "CPPT");
  };

  const handlePrintNursingCare = () => {
    handlePrint(() => printApi.nursingCare(visitId), "Asuhan Keperawatan");
  };

  const handlePrintFluidBalance = () => {
    handlePrint(() => printApi.fluidBalance(visitId), "Balance Cairan");
  };

  const handlePrintBedTransfer = () => {
    handlePrint(() => printApi.bedTransfer(visitId), "Mutasi Pasien");
  };

  const handlePrintVitalSignChart = () => {
    handlePrint(() => printApi.vitalSignChart(visitId), "Grafik Vital Sign");
  };

  // Surat Print Handlers
  const handlePrintReferralLetter = () => {
    handlePrint(() => printApi.referralLetter(visitId), "Surat Rujukan");
  };

  const handlePrintInpatientCertificate = () => {
    handlePrint(() => printApi.inpatientCertificate(visitId), "Surat Keterangan Rawat Inap");
  };

  const completedLabOrders = procedureOrders.filter(o => o.order_type === "laboratory" && o.status === "completed");
  const completedRadiologyOrders = procedureOrders.filter(o => o.order_type === "radiology" && o.status === "completed");

  // Determine visit type from room
  const roomType = visit?.room?.type || "";
  const isUGDVisit = isEmergency || roomType === "igd" || roomType === "emergency";
  const isInpatientVisit = isInpatient || roomType === "inpatient" || roomType === "rawat_inap";

  const buildPrintItems = (): PrintItem[] => {
    const items: PrintItem[] = [];

    // Label Pasien
    items.push({
      id: "patient-label",
      type: "label",
      label: "Label Pasien",
      paperSize: "Label 50x20mm",
      category: "umum",
      icon: <User className="h-4 w-4" />,
      available: !!visit,
      handler: handlePrintPatientLabel,
      details: {
        items: ["Nama", "No RM", "TTL", "Jenis Kelamin", "Gol Darah"],
        status: "Tersedia",
      }
    });

    // Rekam Medis - only show if there's actual data
    const hasAnamnesis = medicalRecord?.anamnesis?.id > 0;
    const hasDiagnosis = (medicalRecord?.diagnoses?.length || 0) > 0;
    const hasAnyMedicalData = hasAnamnesis || hasDiagnosis;

    if (hasAnyMedicalData) {
      if (isUGDVisit) {
        // UGD - Resume Medis UGD (sama dengan rawat jalan tapi untuk UGD)
        items.push({
          id: "outpatient-resume",
          type: "rekam-medis",
          label: "Resume Medis UGD",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "rekam-medis",
          icon: <FileText className="h-4 w-4" />,
          available: true,
          handler: handlePrintOutpatientResume,
          details: {
            items: ["Anamnesis", "Pemeriksaan Fisik", "Diagnosis", "Terapi", "Rencana"],
            status: "Lengkap",
            doctor: visit?.doctor?.nama_lengkap,
          }
        });
      } else if (isInpatientVisit) {
        // Rawat Inap
        items.push({
          id: "inpatient-resume",
          type: "rekam-medis",
          label: "Resume Medis Rawat Inap",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "rekam-medis",
          icon: <FileText className="h-4 w-4" />,
          available: true,
          handler: handlePrintInpatientResume,
          details: {
            items: ["Info Rawat Inap", "Diagnosis Akhir", "Status Keluar", "Obat Pulang"],
            status: "Lengkap",
            doctor: visit?.doctor?.nama_lengkap,
          }
        });
      } else {
        // Rawat Jalan
        items.push({
          id: "outpatient-resume",
          type: "rekam-medis",
          label: "Resume Medis Rawat Jalan",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "rekam-medis",
          icon: <FileText className="h-4 w-4" />,
          available: true,
          handler: handlePrintOutpatientResume,
          details: {
            items: ["Anamnesis", "Pemeriksaan Fisik", "Diagnosis", "Terapi", "Rencana"],
            status: "Lengkap",
            doctor: visit?.doctor?.nama_lengkap,
          }
        });
      }
    }

    // ======= UGD Documents =======
    if (isUGDVisit) {
      const hasTriage = medicalRecord?.triage?.id > 0;
      
      if (hasTriage) {
        items.push({
          id: "triage-form",
          type: "ugd",
          label: "Formulir Triage",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "ugd",
          icon: <AlertTriangle className="h-4 w-4" />,
          available: true,
          handler: handlePrintTriageForm,
          details: {
            items: ["Cara Datang", "Level Triage", "ABC", "GCS", "Vital Signs", "Tindakan Segera"],
            status: `Level ${medicalRecord?.triage?.triage_level || "-"}`,
          }
        });
      }

      if (medicalRecord) {
        items.push({
          id: "emergency-summary",
          type: "ugd",
          label: "Ringkasan Pelayanan UGD",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "ugd",
          icon: <Stethoscope className="h-4 w-4" />,
          available: true,
          handler: handlePrintEmergencySummary,
          details: {
            items: ["Triage", "Anamnesis", "Pemeriksaan", "Diagnosis", "Tindakan", "Disposisi"],
            status: "Tersedia",
            doctor: visit?.doctor?.nama_lengkap,
          }
        });
      }
    }

    // ======= Rawat Inap Documents =======
    if (isInpatientVisit) {
      const cpptCount = medicalRecord?.cppt_count || 0;
      const nursingCareCount = medicalRecord?.nursing_care_count || 0;
      const fluidBalanceCount = medicalRecord?.fluid_balance_count || 0;
      const vitalSignCount = medicalRecord?.vital_sign_count || 0;
      const bedTransferCount = medicalRecord?.bed_transfer_count || 0;

      if (cpptCount > 0) {
        items.push({
          id: "cppt",
          type: "rawat-inap",
          label: "CPPT (Catatan Perkembangan)",
          orderDate: visit?.created_at,
          paperSize: "A4 Landscape",
          category: "rawat-inap",
          icon: <FileText className="h-4 w-4" />,
          available: true,
          handler: handlePrintCPPT,
          details: {
            items: ["SOAP", "Vital Signs", "Verifikasi", "Profesi"],
            status: `${cpptCount} catatan`,
          }
        });
      }

      if (nursingCareCount > 0) {
        items.push({
          id: "nursing-care",
          type: "rawat-inap",
          label: "Asuhan Keperawatan (SDKI-SLKI-SIKI)",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "rawat-inap",
          icon: <HeartPulse className="h-4 w-4" />,
          available: true,
          handler: handlePrintNursingCare,
          details: {
            items: ["Pengkajian", "Diagnosis Keperawatan", "Luaran", "Intervensi", "Implementasi", "Evaluasi"],
            status: `${nursingCareCount} catatan`,
          }
        });
      }

      if (fluidBalanceCount > 0) {
        items.push({
          id: "fluid-balance",
          type: "rawat-inap",
          label: "Balance Cairan",
          orderDate: visit?.created_at,
          paperSize: "A4 Landscape",
          category: "rawat-inap",
          icon: <Droplets className="h-4 w-4" />,
          available: true,
          handler: handlePrintFluidBalance,
          details: {
            items: ["Intake (Oral/IV/Enteral)", "Output (Urine/Feses/Drain)", "Balance"],
            status: `${fluidBalanceCount} catatan`,
          }
        });
      }

      if (vitalSignCount > 0) {
        items.push({
          id: "vital-sign-chart",
          type: "rawat-inap",
          label: "Grafik Tanda Vital",
          orderDate: visit?.created_at,
          paperSize: "A4 Landscape",
          category: "rawat-inap",
          icon: <Activity className="h-4 w-4" />,
          available: true,
          handler: handlePrintVitalSignChart,
          details: {
            items: ["TD", "Nadi", "RR", "Suhu", "SpO2", "Nyeri"],
            status: `${vitalSignCount} catatan`,
          }
        });
      }

      if (bedTransferCount > 0) {
        items.push({
          id: "bed-transfer",
          type: "rawat-inap",
          label: "Lembar Mutasi Pasien",
          orderDate: visit?.created_at,
          paperSize: "A4",
          category: "rawat-inap",
          icon: <BedDouble className="h-4 w-4" />,
          available: true,
          handler: handlePrintBedTransfer,
          details: {
            items: ["Dari Ruangan", "Ke Ruangan", "Jenis Transfer", "Alasan"],
            status: `${bedTransferCount} mutasi`,
          }
        });
      }
    }

    // Farmasi
    medicineOrders.forEach((order) => {
      const orderDate = order.created_at ? formatDateId(order.created_at) : "-";
      items.push({
        id: `prescription-${order.id}`,
        type: "farmasi",
        label: orderDate,
        orderNumber: order.order_number,
        orderDate: order.created_at,
        paperSize: "A4",
        category: "farmasi",
        icon: <Pill className="h-4 w-4" />,
        available: true,
        handler: () => handlePrintPrescription(order.id),
        details: {
          items: order.items?.map((item: any) => 
            `${item.medicine?.name || "Obat"} x${item.quantity}`
          ) || [],
          status: order.status === "completed" ? "Selesai" : order.status === "processing" ? "Diproses" : "Pending",
          completedAt: order.completed_at,
        }
      });
    });

    // Lab Results
    completedLabOrders.forEach((order) => {
      const orderDate = order.created_at ? formatDateId(order.created_at) : "-";
      items.push({
        id: `lab-result-${order.id}`,
        type: "lab",
        label: orderDate,
        orderNumber: order.order_number,
        orderDate: order.created_at,
        paperSize: "A4",
        category: "order",
        icon: <FlaskConical className="h-4 w-4" />,
        available: true,
        handler: () => handlePrintLabResult(order.id),
        details: {
          items: order.items?.map((item: any) => item.procedure?.name || "Pemeriksaan") || [],
          status: "Selesai",
          completedAt: order.completed_at,
        }
      });
    });

    // Radiology Results
    completedRadiologyOrders.forEach((order) => {
      const orderDate = order.created_at ? formatDateId(order.created_at) : "-";
      items.push({
        id: `radiology-result-${order.id}`,
        type: "radiology",
        label: orderDate,
        orderNumber: order.order_number,
        orderDate: order.created_at,
        paperSize: "A4",
        category: "order",
        icon: <Scan className="h-4 w-4" />,
        available: true,
        handler: () => handlePrintLabResult(order.id),
        details: {
          items: order.items?.map((item: any) => item.procedure?.name || "Pemeriksaan") || [],
          status: "Selesai",
          completedAt: order.completed_at,
        }
      });
    });

    // Surat - only show if diagnosis exists
    if (hasDiagnosis) {
      items.push({
        id: "sick-letter",
        type: "surat",
        label: "Surat Keterangan Sakit",
        paperSize: "A4",
        category: "surat",
        icon: <ClipboardList className="h-4 w-4" />,
        available: true,
        handler: handlePrintSickLetter,
        details: {
          status: "Tersedia",
        }
      });
    }

    // Surat Rujukan - show if disposition type is 'rujuk'
    const hasReferral = medicalRecord?.disposition?.disposition_type === "rujuk";
    if (hasReferral) {
      items.push({
        id: "referral-letter",
        type: "surat",
        label: "Surat Rujukan",
        paperSize: "A4",
        category: "surat",
        icon: <FileCheck className="h-4 w-4" />,
        available: true,
        handler: handlePrintReferralLetter,
        details: {
          status: "Tersedia",
        }
      });
    }

    // Surat Keterangan Rawat Inap - show for inpatient visits
    if (isInpatientVisit) {
      items.push({
        id: "inpatient-certificate",
        type: "surat",
        label: "Surat Keterangan Rawat Inap",
        paperSize: "A4",
        category: "surat",
        icon: <BedDouble className="h-4 w-4" />,
        available: true,
        handler: handlePrintInpatientCertificate,
        details: {
          status: "Tersedia",
        }
      });
    }

    return items;
  };

  const printItems = buildPrintItems();
  
  const categorizedItems: Record<PrintCategory, PrintItem[]> = {
    umum: printItems.filter(o => o.category === "umum"),
    "rekam-medis": printItems.filter(o => o.category === "rekam-medis"),
    ugd: printItems.filter(o => o.category === "ugd"),
    "rawat-inap": printItems.filter(o => o.category === "rawat-inap"),
    order: printItems.filter(o => o.category === "order"),
    farmasi: printItems.filter(o => o.category === "farmasi"),
    surat: printItems.filter(o => o.category === "surat"),
  };

  // Build tabs dynamically based on visit type
  const baseTabs: { value: PrintCategory; label: string; icon: React.ReactNode }[] = [
    { value: "umum", label: "Umum", icon: <User className="h-4 w-4" /> },
    { value: "rekam-medis", label: "Rekam Medis", icon: <FileText className="h-4 w-4" /> },
  ];
  
  // Add UGD tab if applicable
  if (isUGDVisit) {
    baseTabs.push({ value: "ugd", label: "UGD", icon: <AlertTriangle className="h-4 w-4" /> });
  }
  
  // Add Rawat Inap tab if applicable
  if (isInpatientVisit) {
    baseTabs.push({ value: "rawat-inap", label: "Rawat Inap", icon: <BedDouble className="h-4 w-4" /> });
  }
  
  const tabs: { value: PrintCategory; label: string; icon: React.ReactNode }[] = [
    ...baseTabs,
    { value: "order", label: "Order", icon: <FlaskConical className="h-4 w-4" /> },
    { value: "farmasi", label: "Farmasi", icon: <Pill className="h-4 w-4" /> },
    { value: "surat", label: "Surat", icon: <ClipboardList className="h-4 w-4" /> },
  ];

  const getTypeBadgeVariant = (type: PrintItem["type"]): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "rekam-medis": return "default";
      case "farmasi": return "secondary";
      case "ugd": return "destructive";
      case "rawat-inap": return "default";
      default: return "outline";
    }
  };

  const getTypeLabel = (type: PrintItem["type"]) => {
    switch (type) {
      case "label": return "Label";
      case "rekam-medis": return "Rekam Medis";
      case "surat": return "Surat";
      case "farmasi": return "Resep";
      case "lab": return "Hasil Lab";
      case "radiology": return "Hasil Radiologi";
      case "ugd": return "UGD";
      case "rawat-inap": return "Rawat Inap";
      default: return type;
    }
  };

  const currentItems = categorizedItems[activeTab] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-full h-screen max-h-screen overflow-hidden flex flex-col p-0 rounded-none">
        <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Cetak Dokumen Rekam Medis
            {printing && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
          <DialogDescription>
            Pilih dokumen yang ingin dicetak
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Memuat data...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Inline Tabs with Underline */}
            <div className="border-b px-6 shrink-0">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium transition-colors relative",
                      activeTab === tab.value
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {tab.icon}
                      {tab.label}
                      {categorizedItems[tab.value].length > 0 && (
                        <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                          {categorizedItems[tab.value].length}
                        </Badge>
                      )}
                    </span>
                    {activeTab === tab.value && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-6 py-4">
              {currentItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Tidak ada dokumen tersedia untuk kategori ini
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Dokumen</TableHead>
                        <TableHead className="w-28">Tipe</TableHead>
                        <TableHead className="w-28">Kertas</TableHead>
                        <TableHead className="w-24 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentItems.map((item) => (
                        <>
                          <TableRow 
                            key={item.id} 
                            className={cn(!item.available && "opacity-50")}
                          >
                            <TableCell className="py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleExpand(item.id)}
                              >
                                {expandedItems.has(item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-md",
                                  item.available ? "bg-primary/10" : "bg-muted"
                                )}>
                                  {item.icon}
                                </div>
                                <div>
                                  <div className="font-medium">{item.label}</div>
                                  {item.orderNumber && (
                                    <div className="text-xs text-muted-foreground">{item.orderNumber}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant={getTypeBadgeVariant(item.type)}>
                                {getTypeLabel(item.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="text-sm text-muted-foreground">{item.paperSize}</span>
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              <Button
                                size="sm"
                                disabled={!item.available || printing}
                                onClick={item.handler}
                              >
                                {printing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Printer className="h-4 w-4 mr-1" />
                                    Cetak
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Row */}
                          {expandedItems.has(item.id) && (
                            <TableRow key={`${item.id}-detail`} className="bg-muted/50 hover:bg-muted/50">
                              <TableCell colSpan={5} className="py-3">
                                <div className="pl-10 space-y-2">
                                  {/* Detail Info */}
                                  <div className="flex flex-wrap gap-4 text-sm">
                                    {item.details?.status && (
                                      <div className="flex items-center gap-1.5">
                                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Status:</span>
                                        <Badge variant={item.details.status === "Selesai" || item.details.status === "Lengkap" || item.details.status === "Tersedia" ? "default" : "secondary"}>
                                          {item.details.status}
                                        </Badge>
                                      </div>
                                    )}
                                    {item.orderDate && (
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Tanggal:</span>
                                        <span>{formatDateId(item.orderDate)}</span>
                                      </div>
                                    )}
                                    {item.details?.completedAt && (
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Selesai:</span>
                                        <span>{formatDateId(item.details.completedAt)}</span>
                                      </div>
                                    )}
                                    {item.details?.doctor && (
                                      <div className="flex items-center gap-1.5">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Dokter:</span>
                                        <span>{item.details.doctor}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Items List */}
                                  {item.details?.items && item.details.items.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Isi Dokumen:</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {item.details.items.map((detailItem, idx) => (
                                          <Badge key={idx} variant="outline" className="font-normal">
                                            {detailItem}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Special options for sick letter */}
                  {activeTab === "surat" && (
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                      <div className="font-medium text-sm">Opsi Surat Keterangan Sakit</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Jumlah Hari Istirahat</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={sickLetterDays}
                            onChange={e => setSickLetterDays(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Tanggal Mulai</Label>
                          <Input
                            type="date"
                            value={sickLetterStartDate}
                            onChange={e => setSickLetterStartDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Special options for labels */}
                  {activeTab === "umum" && (
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                      <div className="font-medium text-sm">Opsi Label Pasien</div>
                      <div className="max-w-xs space-y-1.5">
                        <Label className="text-sm">Jumlah Cetak</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={labelCopies}
                          onChange={e => setLabelCopies(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
