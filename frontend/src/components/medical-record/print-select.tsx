/**
 * Medical Record Print Dropdown
 * Button dengan dropdown menu untuk mencetak dokumen rekam medis
 */

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Printer, ChevronDown, ShieldCheck } from "lucide-react";
import { visitsApi, medicalRecordsApi, medicineOrdersApi, procedureOrdersApi, printApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface PrintSelectProps {
  visitId: number;
  isInpatient?: boolean;
  isEmergency?: boolean;
  refreshTrigger?: number; // Increment this to trigger data reload
}

interface PrintOption {
  value: string;
  label: string;
  category: string;
  handler: () => Promise<void>;
  documentType?: string; // For signature
  documentId?: number;   // For signature
}

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
  refreshTrigger = 0
}: PrintSelectProps) {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [visit, setVisit] = useState<any>(null);
  const [medicalRecord, setMedicalRecord] = useState<any>(null);
  const [medicineOrders, setMedicineOrders] = useState<any[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<any[]>([]);
  const [sickLetters, setSickLetters] = useState<any[]>([]);
  
  // Signature state
  const [signatureStatuses, setSignatureStatuses] = useState<Record<string, { is_signed: boolean; signer_name?: string }>>({});
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureDoc, setSignatureDoc] = useState<{ type: string; id: number; title: string } | null>(null);

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
        // Load procedure orders - for lab/radiology visits, also load by target_visit_id
        const isLabOrRadiology = visitRes.data?.visit_type === "lab" || visitRes.data?.visit_type === "radiology" ||
          visitRes.data?.room?.service_type === "laboratorium" || visitRes.data?.room?.service_type === "radiologi";
        
        if (isLabOrRadiology) {
          // For lab/radiology workstation - load orders where this visit is the target
          const poRes = await procedureOrdersApi.getAll({ target_visit_id: visitId });
          setProcedureOrders(poRes.data || []);
        } else {
          // For other visits - load orders created from this visit
          const poRes = await procedureOrdersApi.getAll({ source_visit_id: visitId });
          setProcedureOrders(poRes.data || []);
        }
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
    } catch (error) {
      console.error("Error loading print data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check signature status for a document
  const checkSignatureStatus = async (docType: string, docId: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(docType, docId);
      setSignatureStatuses(prev => ({ ...prev, [`${docType}-${docId}`]: res.data }));
    } catch {
      setSignatureStatuses(prev => ({ ...prev, [`${docType}-${docId}`]: { is_signed: false } }));
    }
  };

  // Check signatures for visit-level documents
  useEffect(() => {
    if (visitId) {
      // Check resume signature
      checkSignatureStatus(DOCUMENT_TYPES.VISIT_RESUME, visitId);
      // Check referral if exists
      if (medicalRecord?.disposition?.disposition_type === "rujuk") {
        checkSignatureStatus(DOCUMENT_TYPES.REFERRAL_LETTER, visitId);
      }
    }
  }, [visitId, medicalRecord]);

  const handleSignDocument = (docType: string, docId: number, title: string) => {
    setSignatureDoc({ type: docType, id: docId, title });
    setShowSignatureDialog(true);
  };

  const handleSignatureSuccess = () => {
    if (signatureDoc) {
      checkSignatureStatus(signatureDoc.type, signatureDoc.id);
    }
    setSignatureDoc(null);
  };

  const isDocumentSigned = (docType: string, docId: number) => {
    return signatureStatuses[`${docType}-${docId}`]?.is_signed || false;
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
        });
      }
      if (medicalRecord) {
        options.push({
          value: "emergency-summary",
          label: "Ringkasan Pelayanan",
          category: "UGD",
          handler: () => printApi.emergencySummary(visitId),
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
          label: `CPPT (${cpptCount})`,
          category: "Rawat Inap",
          handler: () => printApi.cppt(visitId),
        });
      }
      if (nursingCareCount > 0) {
        options.push({
          value: "nursing-care",
          label: `Asuhan Keperawatan (${nursingCareCount})`,
          category: "Rawat Inap",
          handler: () => printApi.nursingCare(visitId),
        });
      }
      if (fluidBalanceCount > 0) {
        options.push({
          value: "fluid-balance",
          label: `Balance Cairan (${fluidBalanceCount})`,
          category: "Rawat Inap",
          handler: () => printApi.fluidBalance(visitId),
        });
      }
      if (vitalSignCount > 0) {
        options.push({
          value: "vital-sign",
          label: `Grafik Vital Sign (${vitalSignCount})`,
          category: "Rawat Inap",
          handler: () => printApi.vitalSignChart(visitId),
        });
      }
      if (bedTransferCount > 0) {
        options.push({
          value: "bed-transfer",
          label: `Mutasi Pasien (${bedTransferCount})`,
          category: "Rawat Inap",
          handler: () => printApi.bedTransfer(visitId),
        });
      }
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
      });
    });

    // ============ RADIOLOGI ============
    completedRadiologyOrders.forEach((order) => {
      options.push({
        value: `radiology-${order.id}`,
        label: `Hasil Radiologi`,
        category: "Radiologi",
        handler: () => printApi.radiologyResult(order.id),
      });
    });

    // ============ OPERASI ============
    completedSurgeryOrders.forEach((order) => {
      options.push({
        value: `surgery-${order.id}`,
        label: `Hasil Operasi`,
        category: "Operasi",
        handler: () => printApi.procedureOrderResult(order.id),
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

  const printOptions = buildPrintOptions();

  // Group options by category
  const groupedOptions = printOptions.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = [];
    }
    acc[option.category].push(option);
    return acc;
  }, {} as Record<string, PrintOption[]>);

  const categoryOrder = ["Umum", "Rawat Jalan", "UGD", "Rawat Inap", "Farmasi", "Laboratorium", "Radiologi", "Operasi", "Surat"];
  const sortedCategories = Object.keys(groupedOptions).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const handleItemClick = async (option: PrintOption) => {
    await handlePrint(option.handler, option.label);
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat...
      </Button>
    );
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={printing} className="gap-1.5">
          {printing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Cetak
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {sortedCategories.map((category, idx) => (
          <div key={category}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {category}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {groupedOptions[category].map((option) => {
                const isSigned = option.documentType && option.documentId 
                  ? isDocumentSigned(option.documentType, option.documentId) 
                  : false;
                return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleItemClick(option)}
                  className="cursor-pointer flex justify-between items-center"
                >
                  <span>{option.label}</span>
                  <div className="flex items-center gap-1">
                    {option.documentType && option.documentId && (
                      isSigned ? (
                        <Badge variant="default" className="text-[10px] h-5 bg-green-600 gap-0.5">
                          <ShieldCheck className="h-3 w-3" />
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSignDocument(option.documentType!, option.documentId!, option.label);
                          }}
                        >
                          <ShieldCheck className="h-3 w-3" />
                        </Button>
                      )
                    )}
                  </div>
                </DropdownMenuItem>
              );})}
            </DropdownMenuGroup>
          </div>
        ))}
        {printOptions.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Tidak ada cetakan tersedia
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Signature Dialog */}
    {signatureDoc && (
      <SignaturePINDialog
        open={showSignatureDialog}
        onOpenChange={setShowSignatureDialog}
        documentType={signatureDoc.type}
        documentId={signatureDoc.id}
        visitId={visitId}
        documentTitle={signatureDoc.title}
        onSuccess={handleSignatureSuccess}
      />
    )}
    </>
  );
}
