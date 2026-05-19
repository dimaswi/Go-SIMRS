/**
 * Medical Record Print Dropdown
 * Button dengan dropdown menu untuk mencetak dokumen rekam medis
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Loader2, Printer, ShieldCheck, ShieldX, FileText, FolderOpen, CheckCircle2 } from "lucide-react";
import { authApi, visitsApi, medicalRecordsApi, medicineOrdersApi, procedureOrdersApi, printApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import { unitTransferApi } from "@/lib/api/inpatient";
import { vclaimApi, type SPRILocal, type SuratKontrolLocal } from "@/lib/api/vclaim";
import { SignOnBehalfDialog } from "@/components/signature/sign-on-behalf-dialog";
import { RevokePINDialog } from "@/components/signature/revoke-pin-dialog";
import { useAuthStore } from "@/lib/store";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface PrintSelectProps {
  visitId: number;
  isInpatient?: boolean;
  isEmergency?: boolean;
  refreshTrigger?: number; // Increment this to trigger data reload
  iconOnly?: boolean;
  triggerClassName?: string;
}

interface PrintOption {
  value: string;
  label: string;
  category: string;
  handler: () => Promise<void>;
  documentType?: string; // For signature
  documentId?: number;   // For signature
  sourceVisitId?: number; // For order-based docs: the orderer's visit
}


const ORDER_DOC_TYPES = new Set<string>([
  DOCUMENT_TYPES.LAB_RESULT,
  DOCUMENT_TYPES.RADIOLOGY_RESULT,
  DOCUMENT_TYPES.OPERATIVE_REPORT,
  DOCUMENT_TYPES.CONSULTATION_RESULT,
]);

const ELIGIBILITY_DOC_TYPES = new Set<string>([
  DOCUMENT_TYPES.CONSULTATION_RESULT,
  DOCUMENT_TYPES.SPRI,
  DOCUMENT_TYPES.SURAT_KONTROL,
]);

// Format date to Indonesian short
function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd/MM/yy", { locale: localeId });
  } catch {
    return "";
  }
}

export function MedicalRecordPrintSelect({ 
  visitId, 
  isInpatient = false,
  isEmergency = false,
  refreshTrigger = 0,
  iconOnly = false,
  triggerClassName,
}: PrintSelectProps) {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [visit, setVisit] = useState<any>(null);
  const [medicalRecord, setMedicalRecord] = useState<any>(null);
  const [medicineOrders, setMedicineOrders] = useState<any[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<any[]>([]);
  const [sickLetters, setSickLetters] = useState<any[]>([]);
  const [healthCertificates, setHealthCertificates] = useState<any[]>([]);
  const [birthCertificates, setBirthCertificates] = useState<any[]>([]);
  const [leaveCertificates, setLeaveCertificates] = useState<any[]>([]);
  const [mcuCertificates, setMcuCertificates] = useState<any[]>([]);
  const [deathCertificates, setDeathCertificates] = useState<any[]>([]);
  const [unitTransfers, setUnitTransfers] = useState<any[]>([]);
  const [spriDoc, setSpriDoc] = useState<SPRILocal | null>(null);
  const [suratKontrolDoc, setSuratKontrolDoc] = useState<SuratKontrolLocal | null>(null);
  
  // Signature state
  const [signatureStatuses, setSignatureStatuses] = useState<Record<string, { is_signed: boolean; signer_name?: string; required_signatures?: number; signed_signatures?: number; is_fully_signed?: boolean; signed_slots?: Record<string, boolean> }>>({});
  const [signEligibility, setSignEligibility] = useState<Record<string, { allowed: boolean; reason?: string }>>({});
  const [showSignOnBehalfDialog, setShowSignOnBehalfDialog] = useState(false);
  const [signOnBehalfDoc, setSignOnBehalfDoc] = useState<{ type: string; id: number; title: string; requiredSignatures?: number; signatureSlot?: string; signerTypeFilter?: "Dokter" | "Perawat" } | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeDoc, setRevokeDoc] = useState<{ type: string; id: number; title: string } | null>(null);
  const statusFetchAtRef = useRef<Record<string, number>>({});
  const lastBatchRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  // Load data when component mounts or refreshTrigger changes
  useEffect(() => {
    if (visitId) {
      loadData();
    }
  }, [visitId, refreshTrigger]);


  // Listen for custom event to refresh print options
  useEffect(() => {
    const handleRefresh = () => {
      if (visitId) {
        loadData();
      }
    };
    
    window.addEventListener("refresh-print-options", handleRefresh);
    return () => {
      window.removeEventListener("refresh-print-options", handleRefresh);
    };
  }, [visitId]);

  // Ensure employee_id is available in user store for accurate TTD authorization checks.
  useEffect(() => {
    let active = true;

    if (!user || user.employee_id) {
      return () => {
        active = false;
      };
    }

    authApi.getProfile()
      .then((res) => {
        if (!active || !res.data) return;
        setUser({ ...user, ...res.data });
      })
      .catch(() => {
        // Keep current session if profile refresh fails.
      });

    return () => {
      active = false;
    };
  }, [user?.id, user?.employee_id, setUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const visitRes = await visitsApi.getById(visitId);
      setVisit(visitRes.data);
      const visitRegistrationId = visitRes.data?.registration_id;

      try {
        const mrRes = await medicalRecordsApi.get(visitId);
        setMedicalRecord(mrRes.data);
      } catch {
        setMedicalRecord(null);
      }

      try {
        // For pharmacy visits, load orders by pharmacy_visit_id (current visit)
        // For other visits, load orders by source_visit_id (orders created from this visit)
        const isPharmacy = visitRes.data?.visit_type === "pharmacy" || visitRes.data?.room?.service_type === "farmasi";
        const moRes = isPharmacy 
          ? await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId })
          : await medicineOrdersApi.getAll({ source_visit_id: visitId });
        setMedicineOrders(moRes.data || []);
      } catch {
        setMedicineOrders([]);
      }

      try {
        // Load from both source and target visit contexts.
        // Consultation screen often opens from target visit, while order list may be expected from source visit.
        const [poSourceRes, poTargetRes] = await Promise.all([
          procedureOrdersApi.getAll({ source_visit_id: visitId }),
          procedureOrdersApi.getAll({ target_visit_id: visitId }),
        ]);

        const mergedOrders = [...(poSourceRes.data || []), ...(poTargetRes.data || [])];
        const uniqueOrders = Array.from(new Map(mergedOrders.map((order) => [order.id, order])).values());
        setProcedureOrders(uniqueOrders);
      } catch {
        setProcedureOrders([]);
      }

      try {
        // Load sick letters
        const slRes = await medicalRecordsApi.getSickLetters(visitId);
        setSickLetters(slRes.data || []);
      } catch {
        setSickLetters([]);
      }

      try {
        const res = await medicalRecordsApi.getHealthCertificates(visitId);
        setHealthCertificates(res.data || []);
      } catch {
        setHealthCertificates([]);
      }

      try {
        const res = await medicalRecordsApi.getBirthCertificates(visitId);
        setBirthCertificates(res.data || []);
      } catch {
        setBirthCertificates([]);
      }

      try {
        const res = await medicalRecordsApi.getLeaveCertificates(visitId);
        setLeaveCertificates(res.data || []);
      } catch {
        setLeaveCertificates([]);
      }

      try {
        const res = await medicalRecordsApi.getMCUCertificates(visitId);
        setMcuCertificates(res.data || []);
      } catch {
        setMcuCertificates([]);
      }

      try {
        const res = await medicalRecordsApi.getDeathCertificates(visitId);
        setDeathCertificates(res.data || []);
      } catch {
        setDeathCertificates([]);
      }

      try {
        const res = await unitTransferApi.getAll(visitId);
        setUnitTransfers(res.data?.data || []);
      } catch {
        setUnitTransfers([]);
      }

      try {
        const res = await vclaimApi.getSPRIByVisit(visitId);
        if (res.data?.data) {
          setSpriDoc(res.data.data);
        } else if (visitRegistrationId) {
          const regRes = await vclaimApi.getSPRIByRegistration(visitRegistrationId);
          setSpriDoc(regRes.data?.data || null);
        } else {
          setSpriDoc(null);
        }
      } catch {
        if (visitRegistrationId) {
          try {
            const regRes = await vclaimApi.getSPRIByRegistration(visitRegistrationId);
            setSpriDoc(regRes.data?.data || null);
          } catch {
            setSpriDoc(null);
          }
        } else {
          setSpriDoc(null);
        }
      }

      try {
        const res = await vclaimApi.getSuratKontrolByVisit(visitId);
        if (res.data?.data) {
          setSuratKontrolDoc(res.data.data);
        } else if (visitRegistrationId) {
          const regRes = await vclaimApi.getSuratKontrolByRegistration(visitRegistrationId);
          setSuratKontrolDoc(regRes.data?.data || null);
        } else {
          setSuratKontrolDoc(null);
        }
      } catch {
        if (visitRegistrationId) {
          try {
            const regRes = await vclaimApi.getSuratKontrolByRegistration(visitRegistrationId);
            setSuratKontrolDoc(regRes.data?.data || null);
          } catch {
            setSuratKontrolDoc(null);
          }
        } else {
          setSuratKontrolDoc(null);
        }
      }
    } catch (error) {
      console.error("Error loading print data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check signature status for a document
  const checkSignatureStatus = async (docType: string, docId: number, force = false) => {
    if (!open) return;
    const key = `${docType}-${docId}`;
    const now = Date.now();
    const prevAt = statusFetchAtRef.current[key] || 0;
    if (!force && now-prevAt < 8000) return; // dedupe aggressive polling
    statusFetchAtRef.current[key] = now;
    try {
      const res = await signatureApi.getDocumentSignature(docType, docId);
      setSignatureStatuses(prev => ({ ...prev, [key]: res.data }));
    } catch {
      setSignatureStatuses(prev => ({ ...prev, [key]: { is_signed: false } }));
    }
  };


  useEffect(() => {
    let active = true;

    const docsToCheck: Array<{ type: string; id: number }> = [];

    const consultationOrders = procedureOrders.filter((order) => {
      if (order.order_type !== "consultation") return false;
      const hasCompletedOrValidatedItems = order.items?.some((i: any) => i.status === "completed" || i.status === "validated") || false;
      return order.status === "completed" || order.status === "validated" || hasCompletedOrValidatedItems;
    });

    consultationOrders.forEach((order) => {
      docsToCheck.push({ type: DOCUMENT_TYPES.CONSULTATION_RESULT, id: order.id });
    });

    if (spriDoc?.id) {
      docsToCheck.push({ type: DOCUMENT_TYPES.SPRI, id: spriDoc.id });
    }

    if (suratKontrolDoc?.id) {
      docsToCheck.push({ type: DOCUMENT_TYPES.SURAT_KONTROL, id: suratKontrolDoc.id });
    }

    if (docsToCheck.length === 0) {
      return () => {
        active = false;
      };
    }

    const checkEligibility = async () => {
      await Promise.all(
        docsToCheck.map(async (doc) => {
          try {
            const res = await signatureApi.canSignDocument(doc.type, doc.id);
            if (!active) return;
            setSignEligibility((prev) => ({
              ...prev,
              [`${doc.type}-${doc.id}`]: {
                allowed: !!res.data?.allowed,
                reason: res.data?.reason,
              },
            }));
          } catch {
            if (!active) return;
            setSignEligibility((prev) => ({
              ...prev,
              [`${doc.type}-${doc.id}`]: { allowed: false },
            }));
          }
        })
      );
    };

    checkEligibility();

    return () => {
      active = false;
    };
  }, [procedureOrders, spriDoc?.id, suratKontrolDoc?.id]);

  const handleSignDocument = (docType: string, docId: number, title: string, slot?: "left" | "right") => {
    setSignOnBehalfDoc({
      type: docType,
      id: docId,
      title,
      requiredSignatures: 2,
      signatureSlot: slot,
      signerTypeFilter: undefined,
    });
    setShowSignOnBehalfDialog(true);
  };

  const handleRevokeDocument = (docType: string, docId: number, title: string) => {
    setRevokeDoc({ type: docType, id: docId, title });
    setShowRevokeDialog(true);
  };

  const handleRevokeSuccess = () => {
    if (revokeDoc) {
      checkSignatureStatus(revokeDoc.type, revokeDoc.id, true);
    }
    setRevokeDoc(null);
  };

  const isDocumentSigned = (docType: string, docId: number) => {
    const status = signatureStatuses[`${docType}-${docId}`];
    return status?.is_fully_signed ?? status?.is_signed ?? false;
  };

  const getSignatureProgress = (docType?: string, docId?: number) => {
    if (!docType || !docId) return { signed: 0, required: 1 };
    const key = `${docType}-${docId}`;
    const status = signatureStatuses[key];
    const required = status?.required_signatures || 2;
    const signed = status?.signed_signatures || (status?.is_signed ? required : 0);
    return { signed, required };
  };

  const canSignDocument = (docType?: string, docId?: number) => {
    if (!docType || !docId) return true;

    const eligibility = signEligibility[`${docType}-${docId}`];
    if (docType === DOCUMENT_TYPES.CONSULTATION_RESULT) {
      const order = procedureOrders.find((o) => o.id === docId && o.order_type === "consultation");
      if (!order) return true;

      // If viewing from orderer's visit, never show TTD
      if (order.source_visit_id === visitId) return false;

      // If backend eligibility check returned, use it
      if (eligibility) return eligibility.allowed;

      return true;
    }

    if (ELIGIBILITY_DOC_TYPES.has(docType)) {
      // For SPRI/Surat Kontrol and consultation (fallback), require explicit backend eligibility.
      return eligibility?.allowed === true;
    }

    return true;
  };

  const getSignReason = (docType?: string, docId?: number) => {
    if (!docType || !docId) return undefined;
    return signEligibility[`${docType}-${docId}`]?.reason;
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

  // Determine visit type
  const roomType = visit?.room?.type || "";
  const serviceType = visit?.room?.service_type || "";
  const isUGDVisit = isEmergency || roomType === "igd" || roomType === "emergency";
  const isInpatientVisit = isInpatient || roomType === "inpatient" || roomType === "rawat_inap";
  const isPharmacyVisit = visit?.visit_type === "pharmacy" || serviceType === "farmasi";
  
  // Check data availability
  const hasAnamnesis = medicalRecord?.anamnesis?.id > 0;
  const hasDiagnosis = (medicalRecord?.diagnoses?.length || 0) > 0;
  const hasAnyMedicalData = hasAnamnesis || hasDiagnosis;
  const hasTriage = medicalRecord?.triage?.id > 0;
  const hasReferral = medicalRecord?.disposition?.disposition_type === "rujuk";
  const followUpRegistrationId = medicalRecord?.disposition?.follow_up_registration_id;
  
  // Completed orders - include orders with completed/validated items too
  const completedLabOrders = procedureOrders.filter(o => 
    o.order_type === "laboratory" && 
    (o.status === "completed" || o.status === "validated" || o.items?.some((i: any) => i.status === "completed" || i.status === "validated"))
  );
  const completedRadiologyOrders = procedureOrders.filter(o => 
    o.order_type === "radiology" && 
    (o.status === "completed" || o.status === "validated" || o.items?.some((i: any) => i.status === "completed" || i.status === "validated"))
  );
  const completedSurgeryOrders = procedureOrders.filter(o => 
    o.order_type === "surgery" && 
    (o.status === "completed" || o.status === "validated" || o.items?.some((i: any) => i.status === "completed" || i.status === "validated"))
  );
  const completedConsultationOrders = procedureOrders.filter(o =>
    o.order_type === "consultation" &&
    (o.status === "completed" || o.status === "validated" || o.items?.some((i: any) => i.status === "completed" || i.status === "validated"))
  );
  const completedMedicineOrders = medicineOrders.filter(o => o.status === "completed" || o.status === "dispensed");
  // For pharmacy visit - show all orders that have items
  const pharmacyMedicineOrders = medicineOrders.filter(o => (o.items?.length || 0) > 0);

  // Build print options
  const buildPrintOptions = (): PrintOption[] => {
    const options: PrintOption[] = [];

    // ============ FARMASI (only for pharmacy visits) ============
    if (isPharmacyVisit && pharmacyMedicineOrders.length > 0) {
      // Etiket Obat
      pharmacyMedicineOrders.forEach((order) => {
        options.push({
          value: `etiket-obat-${order.id}`,
          label: "Etiket Obat",
          category: "Farmasi",
          handler: () => printApi.medicineLabels(order.id),
        });
      });
      // Resep Obat (thermal for patient)
      pharmacyMedicineOrders.forEach((order) => {
        options.push({
          value: `resep-obat-${order.id}`,
          label: "Resep Obat",
          category: "Farmasi",
          handler: () => printApi.prescriptionThermal(order.id),
        });
      });
    }

    // ============ REKAM MEDIS ============
    if (hasAnyMedicalData) {
      if (isUGDVisit) {
        options.push({
          value: "resume-ugd",
          label: "Resume Medis",
          category: "UGD",
          handler: () => printApi.outpatientResume(visitId),
          documentType: DOCUMENT_TYPES.VISIT_RESUME,
          documentId: visitId,
        });
      } else if (isInpatientVisit) {
        options.push({
          value: "resume-ranap",
          label: "Resume Medis",
          category: "Rawat Inap",
          handler: () => printApi.inpatientResume(visitId),
          documentType: DOCUMENT_TYPES.VISIT_RESUME,
          documentId: visitId,
        });
      } else {
        options.push({
          value: "resume-rajal",
          label: "Resume Medis",
          category: "Rawat Jalan",
          handler: () => printApi.outpatientResume(visitId),
          documentType: DOCUMENT_TYPES.VISIT_RESUME,
          documentId: visitId,
        });
      }
    }

    // ============ UGD ============
    if (isUGDVisit) {
      if (hasTriage) {
        options.push({
          value: "triage",
          label: "Formulir Triage",
          category: "UGD",
          handler: () => printApi.triageForm(visitId),
          documentType: DOCUMENT_TYPES.TRIAGE,
          documentId: visitId,
        });
      }
      if (medicalRecord) {
        options.push({
          value: "emergency-summary",
          label: "Ringkasan Pelayanan",
          category: "UGD",
          handler: () => printApi.emergencySummary(visitId),
          documentType: DOCUMENT_TYPES.EMERGENCY_SUMMARY,
          documentId: visitId,
        });
      }
    }

    // ============ RAWAT INAP ============
    if (isInpatientVisit) {
      const cpptCount = medicalRecord?.cppt_count || 0;
      const nursingCareCount = medicalRecord?.nursing_care_count || 0;
      const fluidBalanceCount = medicalRecord?.fluid_balance_count || 0;
      const vitalSignCount = medicalRecord?.vital_sign_count || 0;
      const bedTransferCount = medicalRecord?.bed_transfer_count || 0;

      if (cpptCount > 0) {
        options.push({
          value: "cppt",
          label: `CPPT (${cpptCount} entri)`,
          category: "Rawat Inap",
          handler: () => printApi.cppt(visitId),
          documentType: DOCUMENT_TYPES.CPPT,
          documentId: visitId,
        });
      }
      if (nursingCareCount > 0) {
        options.push({
          value: "nursing-care",
          label: `Asuhan Keperawatan (${nursingCareCount} entri)`,
          category: "Rawat Inap",
          handler: () => printApi.nursingCare(visitId),
          documentType: DOCUMENT_TYPES.NURSING_CARE,
          documentId: visitId,
        });
      }
      if (fluidBalanceCount > 0) {
        options.push({
          value: "fluid-balance",
          label: `Balance Cairan (${fluidBalanceCount} entri)`,
          category: "Rawat Inap",
          handler: () => printApi.fluidBalance(visitId),
          documentType: DOCUMENT_TYPES.FLUID_BALANCE,
          documentId: visitId,
        });
      }
      if (vitalSignCount > 0) {
        options.push({
          value: "vital-sign",
          label: `Grafik Vital Sign (${vitalSignCount} entri)`,
          category: "Rawat Inap",
          handler: () => printApi.vitalSignChart(visitId),
          documentType: DOCUMENT_TYPES.VITAL_SIGN,
          documentId: visitId,
        });
      }
      if (bedTransferCount > 0) {
        options.push({
          value: "bed-transfer",
          label: `Mutasi Pasien (${bedTransferCount} entri)`,
          category: "Rawat Inap",
          handler: () => printApi.bedTransfer(visitId),
          documentType: DOCUMENT_TYPES.BED_TRANSFER,
          documentId: visitId,
        });
      }
    }

    // ============ MUTASI UNIT (Rawat Jalan / UGD) ============
    if (!isInpatientVisit && unitTransfers.length > 0) {
      options.push({
        value: "unit-transfer",
        label: `Mutasi Unit (${unitTransfers.length})`,
        category: isUGDVisit ? "UGD" : "Rawat Jalan",
        handler: () => printApi.unitTransfer(visitId),
      });
    }

    // ============ FARMASI (Resep - only for non-pharmacy visits) ============
    if (!isPharmacyVisit) {
      completedMedicineOrders.forEach((order, idx) => {
        const orderDate = formatDateShort(order.created_at);
        options.push({
          value: `prescription-${order.id}`,
          label: `Resep ${orderDate || `#${idx + 1}`}`,
          category: "Farmasi",
          handler: () => printApi.prescription(order.id),
          documentType: DOCUMENT_TYPES.PRESCRIPTION,
          documentId: order.id,
        });
      });
    }

    // ============ LABORATORIUM ============
    completedLabOrders.forEach((order) => {
      options.push({
        value: `lab-${order.id}`,
        label: `Hasil Laboratorium`,
        category: "Laboratorium",
        handler: () => printApi.laboratoryResult(order.id),
        documentType: DOCUMENT_TYPES.LAB_RESULT,
        documentId: order.id,
        sourceVisitId: order.source_visit_id,
      });
    });

    // ============ RADIOLOGI ============
    completedRadiologyOrders.forEach((order) => {
      options.push({
        value: `radiology-${order.id}`,
        label: `Hasil Radiologi`,
        category: "Radiologi",
        handler: () => printApi.radiologyResult(order.id),
        documentType: DOCUMENT_TYPES.RADIOLOGY_RESULT,
        documentId: order.id,
        sourceVisitId: order.source_visit_id,
      });
    });

    // ============ OPERASI ============
    completedSurgeryOrders.forEach((order) => {
      options.push({
        value: `surgery-${order.id}`,
        label: `Hasil Operasi`,
        category: "Operasi",
        handler: () => printApi.procedureOrderResult(order.id),
        documentType: DOCUMENT_TYPES.OPERATIVE_REPORT,
        documentId: order.id,
        sourceVisitId: order.source_visit_id,
      });
    });

    // ============ KONSULTASI ============
    completedConsultationOrders.forEach((order) => {
      options.push({
        value: `consultation-${order.id}`,
        label: `Hasil Konsultasi`,
        category: "Konsultasi",
        handler: () => printApi.procedureOrderResult(order.id),
        documentType: DOCUMENT_TYPES.CONSULTATION_RESULT,
        documentId: order.id,
        sourceVisitId: order.source_visit_id,
      });
    });

    // ============ SURAT ============
    // Saved sick letters
    sickLetters.forEach((letter, idx) => {
      const letterDate = formatDateShort(letter.start_date);
      options.push({
        value: `sick-letter-${letter.id}`,
        label: `Surat Sakit ${letterDate || `#${idx + 1}`} (${letter.days} hari)`,
        category: "Surat",
        handler: () => printApi.sickLetterById(visitId, letter.id),
        documentType: DOCUMENT_TYPES.SICK_LETTER,
        documentId: letter.id,
      });
    });

    healthCertificates.forEach((cert, idx) => {
      const certDate = formatDateShort(cert.exam_date);
      options.push({
        value: `health-certificate-${cert.id}`,
        label: `Surat Sehat ${certDate || `#${idx + 1}`}`,
        category: "Surat",
        handler: () => printApi.healthCertificate(visitId, cert.id),
        documentType: DOCUMENT_TYPES.HEALTH_CERTIFICATE,
        documentId: cert.id,
      });
    });

    birthCertificates.forEach((cert, idx) => {
      const certDate = formatDateShort(cert.birth_date);
      options.push({
        value: `birth-certificate-${cert.id}`,
        label: `Surat Kelahiran ${certDate || `#${idx + 1}`}`,
        category: "Surat",
        handler: () => printApi.birthCertificate(visitId, cert.id),
        documentType: DOCUMENT_TYPES.BIRTH_CERTIFICATE,
        documentId: cert.id,
      });
    });

    leaveCertificates.forEach((cert, idx) => {
      const certDate = formatDateShort(cert.start_date);
      options.push({
        value: `leave-certificate-${cert.id}`,
        label: `Surat Cuti ${certDate || `#${idx + 1}`}`,
        category: "Surat",
        handler: () => printApi.leaveCertificate(visitId, cert.id),
        documentType: DOCUMENT_TYPES.LEAVE_CERTIFICATE,
        documentId: cert.id,
      });
    });

    mcuCertificates.forEach((cert, idx) => {
      const certDate = formatDateShort(cert.exam_date);
      options.push({
        value: `mcu-certificate-${cert.id}`,
        label: `Surat MCU ${certDate || `#${idx + 1}`}`,
        category: "Surat",
        handler: () => printApi.mcuCertificate(visitId, cert.id),
        documentType: DOCUMENT_TYPES.MCU_CERTIFICATE,
        documentId: cert.id,
      });
    });

    deathCertificates.forEach((cert, idx) => {
      const certDate = formatDateShort(cert.death_datetime);
      options.push({
        value: `death-certificate-${cert.id}`,
        label: `Surat Kematian ${certDate || `#${idx + 1}`}`,
        category: "Surat",
        handler: () => printApi.deathCertificate(visitId, cert.id),
        documentType: DOCUMENT_TYPES.DEATH_CERTIFICATE,
        documentId: cert.id,
      });
    });
    
    if (hasReferral) {
      options.push({
        value: "referral-letter",
        label: "Surat Rujukan",
        category: "Surat",
        handler: () => printApi.referralLetter(visitId),
        documentType: DOCUMENT_TYPES.REFERRAL_LETTER,
        documentId: visitId,
      });
    }

    if (suratKontrolDoc?.id) {
      const skDate = formatDateShort(suratKontrolDoc.tgl_rencana_kontrol);
      options.push({
        value: `surat-kontrol-${suratKontrolDoc.id}`,
        label: `Surat Kontrol ${skDate || ""}`.trim(),
        category: "Surat",
        handler: () => printApi.suratKontrol(suratKontrolDoc.id),
        documentType: DOCUMENT_TYPES.SURAT_KONTROL,
        documentId: suratKontrolDoc.id,
      });
    } else if (followUpRegistrationId) {
      const simrsDate = formatDateShort(medicalRecord?.disposition?.follow_up_date);
      options.push({
        value: `surat-kontrol-simrs-${followUpRegistrationId}`,
        label: `Surat Kontrol SIMRS ${simrsDate || ""}`.trim(),
        category: "Surat",
        handler: () => printApi.suratKontrolSimrs(followUpRegistrationId),
      });
    }

    if (spriDoc?.id) {
      const spriDate = formatDateShort(spriDoc.tgl_rencana_kontrol);
      options.push({
        value: `spri-${spriDoc.id}`,
        label: `SPRI ${spriDate || ""}`.trim(),
        category: "Surat",
        handler: () => printApi.spri(spriDoc.id),
        documentType: DOCUMENT_TYPES.SPRI,
        documentId: spriDoc.id,
      });
    }
    
    if (isInpatientVisit) {
      options.push({
        value: "inpatient-certificate",
        label: "Surat Keterangan Rawat Inap",
        category: "Surat",
        handler: () => printApi.inpatientCertificate(visitId),
        documentType: DOCUMENT_TYPES.INPATIENT_CERT,
        documentId: visitId,
      });
    }

    return options;
  };

  const printOptions = useMemo(() => buildPrintOptions(), [
    hasAnyMedicalData,
    isUGDVisit,
    hasTriage,
    isInpatientVisit,
    medicalRecord,
    completedMedicineOrders,
    completedLabOrders,
    completedRadiologyOrders,
    completedSurgeryOrders,
    completedConsultationOrders,
    sickLetters,
    healthCertificates,
    birthCertificates,
    leaveCertificates,
    mcuCertificates,
    deathCertificates,
    hasReferral,
    suratKontrolDoc,
    followUpRegistrationId,
    spriDoc,
    visitId,
    unitTransfers.length,
  ]);

  const batchDocs = useMemo(
    () =>
      printOptions
        .filter((o) => o.documentType && o.documentId)
        .map((o) => ({ document_type: o.documentType as string, document_id: o.documentId as number })),
    [printOptions]
  );
  const batchDocsKey = useMemo(
    () => batchDocs.map((d) => `${d.document_type}:${d.document_id}`).sort().join("|"),
    [batchDocs]
  );

  // Keep signature status in sync for every row shown in drawer.
  useEffect(() => {
    if (!open || batchDocs.length === 0) return;
    const now = Date.now();
    if (lastBatchRef.current.key === batchDocsKey && now-lastBatchRef.current.at < 8000) {
      return;
    }
    lastBatchRef.current = { key: batchDocsKey, at: now };

    let active = true;
    signatureApi.batchSignatureStatus(batchDocs)
      .then((res) => {
        if (!active) return;
        const statuses = res.data?.statuses || {};
        const mapped: Record<string, { is_signed: boolean; signer_name?: string; required_signatures?: number; signed_signatures?: number; is_fully_signed?: boolean; signed_slots?: Record<string, boolean> }> = {};
        Object.entries(statuses).forEach(([key, val]: any) => {
          const [docType, docId] = key.split(":");
          if (!docType || !docId) return;
          mapped[`${docType}-${docId}`] = val || { is_signed: false };
        });
        setSignatureStatuses((prev) => ({ ...prev, ...mapped }));
      })
      .catch(() => {
        // Keep previous status map if batch refresh fails.
      });

    return () => {
      active = false;
    };
  }, [open, batchDocsKey]);

  // Group options by category
  const groupedOptions = printOptions.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = [];
    }
    acc[option.category].push(option);
    return acc;
  }, {} as Record<string, PrintOption[]>);

  const categoryOrder = ["Umum", "Rawat Jalan", "UGD", "Rawat Inap", "Farmasi", "Laboratorium", "Radiologi", "Operasi", "Konsultasi", "Surat"];
  const sortedCategories = Object.keys(groupedOptions).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );
  const signedOptionsCount = printOptions.filter((option) =>
    option.documentType && option.documentId ? isDocumentSigned(option.documentType, option.documentId) : false
  ).length;

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "UGD":
        return "border-red-200 bg-red-50 text-red-700";
      case "Rawat Inap":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "Rawat Jalan":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "Farmasi":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "Laboratorium":
        return "border-violet-200 bg-violet-50 text-violet-700";
      case "Radiologi":
        return "border-sky-200 bg-sky-50 text-sky-700";
      case "Operasi":
        return "border-rose-200 bg-rose-50 text-rose-700";
      case "Konsultasi":
        return "border-teal-200 bg-teal-50 text-teal-700";
      case "Surat":
        return "border-slate-200 bg-slate-50 text-slate-700";
      default:
        return "border-muted bg-muted/50 text-muted-foreground";
    }
  };

  const handleItemClick = async (option: PrintOption) => {
    await handlePrint(option.handler, option.label);
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn(
          "text-xs whitespace-nowrap",
          iconOnly ? "h-8 w-8 rounded-none p-0" : "h-7 gap-1 px-2.5",
          triggerClassName
        )}
        aria-label="Memuat opsi cetak"
        title="Memuat opsi cetak"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {!iconOnly && "Memuat..."}
      </Button>
    );
  }

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || printing}
          className={cn(
            "text-xs whitespace-nowrap shrink-0",
            iconOnly ? "relative h-8 w-8 rounded-none p-0" : "h-7 gap-1 px-2.5",
            triggerClassName
          )}
          aria-label="Cetak rekam medis"
          title="Cetak rekam medis"
        >
          {loading || printing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          {!iconOnly && "Cetak"}
          {!iconOnly && printOptions.length > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "h-4 min-w-4 px-1 text-[10px] leading-none",
                iconOnly ? "absolute -right-1 -top-1" : "ml-0.5"
              )}
            >
              {printOptions.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-screen max-w-[100vw] p-0 sm:w-[50vw] sm:max-w-[50vw]">
        <SheetHeader className="border-b bg-muted/30 px-3 py-3 sm:px-5 sm:py-4">
          <div className="pr-8">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Printer className="h-4 w-4" />
              Pilihan Cetak Rekam Medis
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs">
              Pilih dokumen yang ingin dicetak, cek status tanda tangan, dan akses aksi dokumen dalam satu daftar yang ringkas.
            </SheetDescription>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Dokumen</span>
              </div>
              <p className="mt-1 text-lg font-semibold leading-none">{printOptions.length}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Kategori</span>
              </div>
              <p className="mt-1 text-lg font-semibold leading-none">{sortedCategories.length}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wide">Tertanda</span>
              </div>
              <p className="mt-1 text-lg font-semibold leading-none">{signedOptionsCount}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">{visit?.registration?.patient?.nama_lengkap || "Pasien"}</Badge>
            <Badge variant="outline" className="font-normal">Kunjungan #{visit?.id || visitId}</Badge>
            {printing && <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10"><Loader2 className="h-3 w-3 animate-spin" />Mencetak...</Badge>}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-246px)] sm:h-[calc(100vh-214px)]">
          {printOptions.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-6 text-center">
              <Printer className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">Belum ada dokumen yang bisa dicetak</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Opsi cetak akan muncul otomatis setelah dokumen rekam medis, order, atau surat tersedia.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-3 sm:p-4">
              {sortedCategories.map((category) => (
                <section key={category} className="overflow-hidden rounded-xl border bg-background">
                  <div className="flex flex-col gap-2 border-b bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{category}</h3>
                      <Badge variant="outline" className={cn("text-[10px]", getCategoryBadgeClass(category))}>
                        {groupedOptions[category].length} dokumen
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Aksi cetak dan tanda tangan tersedia per baris</p>
                  </div>
                  <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[42%] px-4 text-xs">Dokumen</TableHead>
                        <TableHead className="w-[18%] text-xs">Kategori</TableHead>
                        <TableHead className="w-[18%] text-xs">Tanda Tangan</TableHead>
                        <TableHead className="w-[22%] px-4 text-right text-xs">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedOptions[category].map((option) => {
                        const canSign = canSignDocument(option.documentType, option.documentId);
                        const signReason = getSignReason(option.documentType, option.documentId);
                        const signProgress = getSignatureProgress(option.documentType, option.documentId);
                        const isCompleted = signProgress.signed >= signProgress.required;
                        const isSigned = option.documentType && option.documentId ? isCompleted : false;
                        const status = option.documentType && option.documentId ? signatureStatuses[`${option.documentType}-${option.documentId}`] : undefined;
                        const slotLeftSigned = !!status?.signed_slots?.left;
                        const slotRightSigned = !!status?.signed_slots?.right;
                        const isOrderDoc = option.documentType ? ORDER_DOC_TYPES.has(option.documentType) : false;
                        const isOrdererView = isOrderDoc && option.sourceVisitId === visitId;
                        const isRestrictedDoc = option.documentType ? ELIGIBILITY_DOC_TYPES.has(option.documentType) : false;
                        const canRevoke = option.documentType
                          ? (!isOrdererView && (!isRestrictedDoc || canSign))
                          : false;

                        return (
                          <TableRow key={option.value}>
                            <TableCell className="px-4 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{option.label}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {option.documentType && option.documentId
                                    ? "Dokumen mendukung proses tanda tangan elektronik"
                                    : "Dokumen siap dicetak langsung"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className={cn("text-[10px]", getCategoryBadgeClass(category))}>
                                {category}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              {option.documentType && option.documentId ? (
                                isSigned ? (
                                  <Badge className="gap-1 bg-green-600 hover:bg-green-600">
                                    <ShieldCheck className="h-3 w-3" />
                                    Signed {Math.min(signProgress.signed, signProgress.required)}/{signProgress.required}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                                    <ShieldX className="h-3 w-3" />
                                    Belum {signProgress.signed}/{signProgress.required}
                                  </Badge>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end">
                                {option.documentType && option.documentId && !isSigned && canSign && (!slotLeftSigned || !slotRightSigned) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => handleSignDocument(
                                      option.documentType!,
                                      option.documentId!,
                                      option.label,
                                      !slotLeftSigned ? "left" : "right"
                                    )}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    TTD
                                  </Button>
                                )}
                                {option.documentType && option.documentId && !isSigned && !canSign && (
                                  <span className="text-[11px] text-muted-foreground">{signReason || "Tidak bisa TTD"}</span>
                                )}
                                {option.documentType && option.documentId && isSigned && canRevoke && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                                    onClick={() => handleRevokeDocument(option.documentType!, option.documentId!, option.label)}
                                  >
                                    <ShieldX className="h-3.5 w-3.5" />
                                    Batal
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="h-8 px-3 text-xs"
                                  disabled={printing}
                                  onClick={() => handleItemClick(option)}
                                >
                                  {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                  Cetak
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* Signature Dialog */}
    {signOnBehalfDoc && (
      <SignOnBehalfDialog
        open={showSignOnBehalfDialog}
        onOpenChange={(open) => {
          setShowSignOnBehalfDialog(open);
        }}
        documentType={signOnBehalfDoc.type}
        documentId={signOnBehalfDoc.id}
        visitId={visitId}
        documentTitle={signOnBehalfDoc.title}
        signerHint="Pilih penandatangan"
        signerTypeFilter={signOnBehalfDoc.signerTypeFilter}
        signatureSlot={signOnBehalfDoc.signatureSlot}
        requiredSignatures={signOnBehalfDoc.requiredSignatures}
        visitDoctor={visit?.doctor ? {
          id: visit.doctor.id,
          nama_lengkap: visit.doctor.nama_lengkap,
        } : undefined}
        onSuccess={() => {
          checkSignatureStatus(signOnBehalfDoc.type, signOnBehalfDoc.id, true);
          setSignOnBehalfDoc(null);
        }}
      />
    )}

    {revokeDoc && (
      <RevokePINDialog
        open={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
        documentType={revokeDoc.type}
        documentId={revokeDoc.id}
        documentTitle={revokeDoc.title}
        onSuccess={handleRevokeSuccess}
      />
    )}
    </>
  );
}
