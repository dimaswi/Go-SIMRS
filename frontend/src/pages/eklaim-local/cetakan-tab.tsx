/**
 * Cetakan Tab - Node tree cetakan rekam medis (PDF)
 * SEP di paling atas, lalu dikelompokkan per kategori
 * Bisa dipilih (checkbox), diurutkan (drag up/down), dan di-merge jadi 1 PDF
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { printApi } from '@/lib/api/print';
import { signatureApi, DOCUMENT_TYPES } from '@/lib/api/signature';
import { SignOnBehalfDialog } from '@/components/signature/sign-on-behalf-dialog';
import { mergePdfs } from '@/lib/pdf-merge';
import type { MergeItem } from '@/lib/pdf-merge';
import type { EKlaimLocal, OriginalRM } from '@/lib/api/eklaim-local';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FileText,
  Download,
  Eye,
  Loader2,
  CreditCard,
  Stethoscope,
  HeartPulse,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  Pill,
  Send,
  FileCheck,
  Activity,
  BedDouble,
  Droplets,
  Scissors,
  PenLine,
} from 'lucide-react';

// ===== Types =====
interface CetakanNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  fetchBlob: () => Promise<Blob>;
  available: boolean;
  documentType: string;
  documentId: number;
  signerHint: string;
}

interface CetakanTabProps {
  detail: EKlaimLocal;
  originalRM: OriginalRM;
}

// ===== Build document list =====
function buildCetakanNodes(detail: EKlaimLocal, originalRM: OriginalRM): CetakanNode[] {
  const visitId = detail.visit_id;
  const sepId = detail.sep_id;
  const registrationId = detail.sep?.registration_id;
  const patientId = detail.sep?.patient_id;
  const rmDuplicateId = detail.rm_duplicate?.id;

  // Unique prefix per RM Duplikat — prevents ID collision when same visit has multiple RM Duplikat
  const p = `rmd${rmDuplicateId || 0}`;

  // Visit type detection
  const visitType = (detail.visit as any)?.visit_type ?? '';
  const roomType = (detail.visit as any)?.room?.type ?? '';
  const roomServiceType = (detail.visit as any)?.room?.service_type ?? '';
  const isUGDVisit =
    visitType === 'emergency' ||
    roomType === 'igd' || roomType === 'emergency' ||
    roomServiceType === 'ugd' || roomServiceType === 'igd';
  const isInpatientVisit =
    visitType === 'inpatient' ||
    roomType === 'inpatient' || roomType === 'ranap' ||
    roomServiceType === 'inpatient' ||
    detail.jenis_rawat === '1';

  // Data availability checks
  const hasTriageData = !!(originalRM.triage && originalRM.triage.id) || !!(detail.rm_duplicate?.has_triage);
  // UGD cetakan: visible if the visit itself is UGD, OR if triage data exists (ranap patient who entered via UGD)
  const isUGDOrHasTriage = isUGDVisit || hasTriageData;
  const hasCPPT = (originalRM.cppt_count ?? 0) > 0 || (detail.rm_duplicate?.cppt_notes?.length ?? 0) > 0;
  const hasFluidBalance = (originalRM.fluid_balance_count ?? 0) > 0 || (detail.rm_duplicate?.fluid_balances?.length ?? 0) > 0;
  const hasAnamnesis = !!(originalRM.anamnesis?.id) || !!(detail.rm_duplicate?.chief_complaint);
  const hasNursingCare = (originalRM.nursing_care_count ?? 0) > 0 || (detail.rm_duplicate?.nursing_cares?.length ?? 0) > 0;
  const hasVitalSigns = (originalRM.cppt_with_vitals_count ?? 0) > 0 || hasCPPT;
  const hasBedTransfer = (originalRM.bed_transfer_count ?? 0) > 0;

  const nodes: CetakanNode[] = [];

  // === SEP (paling atas) ===
  if (sepId) {
    nodes.push({
      id: `${p}-sep-${sepId}`,
      label: 'Surat Eligibilitas Peserta (SEP)',
      icon: <CreditCard className="h-4 w-4" />,
      category: 'SEP',
      fetchBlob: () => printApi.blob.sep(sepId, rmDuplicateId),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_SEP,
      documentId: rmDuplicateId || sepId,
      signerHint: 'Petugas Pendaftaran',
    });
  }

  // === A. Umum ===
  if (registrationId) {
    nodes.push({
      id: `${p}-admission-discharge-${registrationId}`,
      label: 'Ringkasan Masuk & Keluar Pasien',
      icon: <FileText className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.admissionDischargeSummary(registrationId, visitId, rmDuplicateId),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_ADMISSION,
      documentId: rmDuplicateId || registrationId,
      signerHint: 'DPJP',
    });
    nodes.push({
      id: `${p}-registration-receipt-${registrationId}`,
      label: 'Bukti Registrasi',
      icon: <FileText className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.registrationReceipt(registrationId, rmDuplicateId),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_REGISTRATION,
      documentId: rmDuplicateId || registrationId,
      signerHint: 'Petugas Pendaftaran',
    });
  }

  if (patientId) {
    nodes.push({
      id: `${p}-informed-consent-${patientId}`,
      label: 'Informed Consent / General Consent',
      icon: <FileCheck className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.informedConsent(patientId, rmDuplicateId),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_CONSENT,
      documentId: rmDuplicateId || patientId,
      signerHint: 'DPJP',
    });
  }

  // === B. Rawat Jalan / Resume ===
  if (visitId) {
    nodes.push({
      id: `${p}-resume-${visitId}`,
      label: 'Resume Medis (Rawat Jalan / Rawat Inap)',
      icon: <Stethoscope className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.outpatientResume(visitId, rmDuplicateId),
      available: hasAnamnesis,
      documentType: DOCUMENT_TYPES.RM_DUP_RESUME,
      documentId: rmDuplicateId || visitId,
      signerHint: 'DPJP',
    });

    nodes.push({
      id: `${p}-inpatient-resume-${visitId}`,
      label: 'Resume Medis Rawat Inap',
      icon: <Stethoscope className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.inpatientResume(visitId, rmDuplicateId),
      available: isInpatientVisit && hasAnamnesis,
      documentType: DOCUMENT_TYPES.RM_DUP_INPATIENT_RESUME,
      documentId: rmDuplicateId || visitId,
      signerHint: 'DPJP',
    });

    nodes.push({
      id: `${p}-referral-letter-${visitId}`,
      label: 'Surat Rujukan',
      icon: <Send className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.referralLetter(visitId, rmDuplicateId),
      available: (
        (detail.rm_duplicate?.disposition_type === 'rujuk') ||
        (!!originalRM.disposition && originalRM.disposition.disposition_type === 'rujuk')
      ),
      documentType: DOCUMENT_TYPES.RM_DUP_REFERRAL,
      documentId: rmDuplicateId || visitId,
      signerHint: 'DPJP',
    });

    nodes.push({
      id: `${p}-inpatient-certificate-${visitId}`,
      label: 'Surat Keterangan Rawat Inap',
      icon: <FileCheck className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.inpatientCertificate(visitId, rmDuplicateId),
      available: isInpatientVisit,
      documentType: DOCUMENT_TYPES.RM_DUP_INPATIENT_CERT,
      documentId: rmDuplicateId || visitId,
      signerHint: 'DPJP',
    });
  }

  // === C. UGD ===
  if (visitId) {
    nodes.push({
      id: `${p}-triage-${visitId}`,
      label: 'Formulir Triage UGD',
      icon: <AlertTriangle className="h-4 w-4" />,
      category: 'C. Gawat Darurat',
      fetchBlob: () => printApi.blob.triageForm(visitId, rmDuplicateId),
      available: isUGDOrHasTriage && hasTriageData,
      documentType: DOCUMENT_TYPES.RM_DUP_TRIAGE,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Dokter UGD',
    });
    nodes.push({
      id: `${p}-emergency-summary-${visitId}`,
      label: 'Ringkasan Pelayanan UGD',
      icon: <ClipboardList className="h-4 w-4" />,
      category: 'C. Gawat Darurat',
      fetchBlob: () => printApi.blob.emergencySummary(visitId, rmDuplicateId),
      available: isUGDOrHasTriage,
      documentType: DOCUMENT_TYPES.RM_DUP_EMERGENCY,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Dokter UGD',
    });
  }

  // === D. Rawat Inap ===
  if (visitId) {
    nodes.push({
      id: `${p}-cppt-${visitId}`,
      label: 'CPPT (Catatan Perkembangan Pasien)',
      icon: <ClipboardList className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.cppt(visitId, rmDuplicateId),
      available: isInpatientVisit && hasCPPT,
      documentType: DOCUMENT_TYPES.RM_DUP_CPPT,
      documentId: rmDuplicateId || visitId,
      signerHint: 'DPJP / Perawat',
    });
    nodes.push({
      id: `${p}-nursing-care-${visitId}`,
      label: 'Asuhan Keperawatan',
      icon: <Activity className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.nursingCare(visitId, rmDuplicateId),
      available: isInpatientVisit && hasNursingCare,
      documentType: DOCUMENT_TYPES.RM_DUP_NURSING_CARE,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Perawat',
    });
    nodes.push({
      id: `${p}-fluid-balance-${visitId}`,
      label: 'Balance Cairan',
      icon: <Droplets className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.fluidBalance(visitId, rmDuplicateId),
      available: isInpatientVisit && hasFluidBalance,
      documentType: DOCUMENT_TYPES.RM_DUP_FLUID_BALANCE,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Perawat',
    });
    nodes.push({
      id: `${p}-bed-transfer-${visitId}`,
      label: 'Lembar Mutasi Pasien',
      icon: <BedDouble className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.bedTransfer(visitId, rmDuplicateId),
      available: isInpatientVisit && hasBedTransfer,
      documentType: DOCUMENT_TYPES.RM_DUP_BED_TRANSFER,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Perawat',
    });
    nodes.push({
      id: `${p}-vital-sign-chart-${visitId}`,
      label: 'Grafik Tanda Vital',
      icon: <HeartPulse className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.vitalSignChart(visitId, rmDuplicateId),
      available: isInpatientVisit && hasVitalSigns,
      documentType: DOCUMENT_TYPES.RM_DUP_VITAL_SIGN,
      documentId: rmDuplicateId || visitId,
      signerHint: 'Perawat',
    });
  }

  // === E. Penunjang & F. Konsultasi — dari rm_duplicate.orders ===
  const rmOrders = detail.rm_duplicate?.orders ?? [];
  const labRMOrders = rmOrders.filter(o => o.order_type === 'laboratory');
  const radRMOrders = rmOrders.filter(o => o.order_type === 'radiology');
  const surgeryRMOrders = rmOrders.filter(o => o.order_type === 'surgery');
  const consultationRMOrders = rmOrders.filter(o => o.order_type === 'consultation');

  for (const order of labRMOrders) {
    const oid = order.id!;
    const label = order.order_number || `Lab #${oid}`;
    nodes.push({
      id: `${p}-lab-result-${oid}`,
      label: `Hasil Lab - ${label}`,
      icon: <FlaskConical className="h-4 w-4" />,
      category: 'E. Penunjang',
      fetchBlob: () => printApi.blob.rmDuplicateLabResult(oid),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_LAB_RESULT,
      documentId: oid,
      signerHint: 'Petugas Laboratorium',
    });
  }

  for (const order of radRMOrders) {
    const oid = order.id!;
    const label = order.order_number || `Radiologi #${oid}`;
    nodes.push({
      id: `${p}-radiology-result-${oid}`,
      label: `Hasil Radiologi - ${label}`,
      icon: <FileText className="h-4 w-4" />,
      category: 'E. Penunjang',
      fetchBlob: () => printApi.blob.rmDuplicateRadiologyResult(oid),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_RADIOLOGY_RESULT,
      documentId: oid,
      signerHint: 'Dokter Radiologi',
    });
  }

  for (const order of surgeryRMOrders) {
    const oid = order.id!;
    const label = order.order_number || `Operasi #${oid}`;
    nodes.push({
      id: `${p}-surgery-note-${oid}`,
      label: `Catatan Operasi - ${label}`,
      icon: <Scissors className="h-4 w-4" />,
      category: 'E. Penunjang',
      fetchBlob: () => printApi.blob.rmDuplicateProcedureResult(oid),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_SURGERY_REPORT,
      documentId: oid,
      signerHint: 'Dokter Operator',
    });
  }

  // === F. Konsultasi ===
  for (const order of consultationRMOrders) {
    const oid = order.id!;
    const label = order.order_number || `Konsultasi #${oid}`;
    nodes.push({
      id: `${p}-consultation-${oid}`,
      label: `Konsultasi - ${label}`,
      icon: <FileText className="h-4 w-4" />,
      category: 'F. Konsultasi',
      fetchBlob: () => printApi.blob.rmDuplicateProcedureResult(oid),
      available: true,
      documentType: DOCUMENT_TYPES.RM_DUP_CONSULTATION,
      documentId: oid,
      signerHint: 'Dokter Konsultan',
    });
  }

  // === G. Farmasi — dari rm_duplicate.medicine_items (group by order) ===
  const medicineOrders = detail.rm_duplicate?.orders?.filter(o => o.order_type === 'pharmacy') ?? [];
  // Fallback: gunakan originalRM.medicine_orders jika ada
  if (originalRM.medicine_orders && originalRM.medicine_orders.length > 0) {
    for (const order of originalRM.medicine_orders) {
      nodes.push({
        id: `${p}-prescription-${order.id}`,
        label: `Resep Obat - ${order.order_number}`,
        icon: <Pill className="h-4 w-4" />,
        category: 'G. Farmasi',
        fetchBlob: () => printApi.blob.prescription(order.id, rmDuplicateId),
        available: true,
        documentType: DOCUMENT_TYPES.RM_DUP_PRESCRIPTION,
        documentId: order.id,
        signerHint: 'DPJP / Apoteker',
      });
    }
  } else {
    for (const order of medicineOrders) {
      const oid = order.id!;
      nodes.push({
        id: `${p}-prescription-${oid}`,
        label: `Resep Obat - ${order.order_number}`,
        icon: <Pill className="h-4 w-4" />,
        category: 'G. Farmasi',
        fetchBlob: () => printApi.blob.rmDuplicatePrescription(oid),
        available: true,
        documentType: DOCUMENT_TYPES.RM_DUP_PRESCRIPTION,
        documentId: oid,
        signerHint: 'DPJP / Apoteker',
      });
    }
  }

  // === H. Billing / Rincian Biaya ===
  const rmBilling = detail.rm_duplicate?.billing;
  if (rmDuplicateId && rmBilling) {
    nodes.push({
      id: `${p}-billing-${rmBilling.id}`,
      label: 'Rincian Biaya Pelayanan',
      icon: <CreditCard className="h-4 w-4" />,
      category: 'H. Billing',
      fetchBlob: () => printApi.blob.rmDuplicateBilling(rmDuplicateId),
      available: (rmBilling.items?.length ?? 0) > 0,
      documentType: DOCUMENT_TYPES.RM_DUP_BILLING,
      documentId: rmDuplicateId,
      signerHint: 'Petugas Billing',
    });
  }

  return nodes;
}

// ===== Signature status type =====
interface SignatureStatus {
  is_signed: boolean;
  signer_name?: string;
  signed_at?: string;
}

// ===== Category tree node =====
function CategoryNode({
  category,
  nodes,
  selectedIds,
  onToggle,
  onSelectAll,
  signatureStatuses,
  onSign,
  nodePreviewLoading,
  onPreview,
}: {
  category: string;
  nodes: CetakanNode[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
  signatureStatuses: Map<string, SignatureStatus>;
  onSign: (node: CetakanNode) => void;
  nodePreviewLoading: string | null;
  onPreview: (node: CetakanNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const availableNodes = nodes.filter((n) => n.available);
  const allSelected = availableNodes.length > 0 && availableNodes.every((n) => selectedIds.has(n.id));
  const someSelected = availableNodes.some((n) => selectedIds.has(n.id));

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={(checked) => {
            const ids = availableNodes.map((n) => n.id);
            onSelectAll(ids, !!checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
        <span className="text-sm font-medium flex-1">{category}</span>
        <Badge variant="outline" className="text-[10px]">
          {availableNodes.filter((n) => selectedIds.has(n.id)).length}/{availableNodes.length}
        </Badge>
      </button>
      {open && (
        <div className="divide-y">
          {nodes.map((node) => {
            const sigKey = `${node.documentType}:${node.documentId}`;
            const sigStatus = signatureStatuses.get(sigKey);
            const isSigned = sigStatus?.is_signed ?? false;

            const isLoading = nodePreviewLoading === node.id;

            return (
              <div
                key={node.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 pl-10 text-sm transition-colors',
                  node.available ? 'hover:bg-muted/30' : 'opacity-40',
                  selectedIds.has(node.id) && 'bg-primary/5',
                )}
              >
                <Checkbox
                  checked={selectedIds.has(node.id)}
                  onCheckedChange={() => onToggle(node.id)}
                  disabled={!node.available}
                  className="shrink-0"
                />
                <span className="text-muted-foreground shrink-0">{node.icon}</span>
                <span className="flex-1 truncate">{node.label}</span>
                {/* Preview button */}
                {node.available && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview(node);
                        }}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preview dokumen</TooltipContent>
                  </Tooltip>
                )}
                {/* Signature status + button */}
                {node.available && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSigned ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="default"
                            className="text-[10px] bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSign(node);
                            }}
                          >
                            <PenLine className="h-3 w-3 mr-1" />
                            {sigStatus?.signer_name || 'Sudah TTD'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ditandatangani oleh: {sigStatus?.signer_name}</p>
                          {sigStatus?.signed_at && <p className="text-xs opacity-70">{new Date(sigStatus.signed_at).toLocaleString('id-ID')}</p>}
                          <p className="text-xs mt-1">Klik untuk mengganti TTD</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSign(node);
                            }}
                          >
                            <PenLine className="h-3 w-3" />
                            TTD
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Tandatangani dokumen ini</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                {!node.available && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Tidak tersedia</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====
export default function CetakanTab({ detail, originalRM }: CetakanTabProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Per-node preview loading state (node.id currently loading)
  const [nodePreviewLoading, setNodePreviewLoading] = useState<string | null>(null);

  // Signature state
  const [signatureStatuses, setSignatureStatuses] = useState<Map<string, SignatureStatus>>(new Map());
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<CetakanNode | null>(null);

  // Track currently previewed node for auto-refresh after signing
  const previewNodeRef = useRef<CetakanNode | null>(null);

  const allNodes = useMemo(() => buildCetakanNodes(detail, originalRM), [detail, originalRM]);

  // Batch load signature statuses
  const loadSignatureStatuses = useCallback(async () => {
    const availableNodes = allNodes.filter((n) => n.available && n.documentType && n.documentId);
    if (availableNodes.length === 0) return;

    const documents = availableNodes.map((n) => ({
      document_type: n.documentType,
      document_id: n.documentId,
    }));

    try {
      const res = await signatureApi.batchSignatureStatus(documents);
      const statuses = res.data?.statuses;
      if (statuses) {
        setSignatureStatuses(new Map(Object.entries(statuses)));
      }
    } catch {
      // silent fail
    }
  }, [allNodes]);

  useEffect(() => {
    loadSignatureStatuses();
  }, [loadSignatureStatuses]);

  const handleOpenSignDialog = useCallback((node: CetakanNode) => {
    setSignTarget(node);
    setSignDialogOpen(true);
  }, []);

  // Helper: show blob in preview area
  const showPreview = useCallback((blob: Blob, label: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewLabel(label);
    setPreviewBlob(blob);
  }, [previewUrl]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewLabel('');
    setPreviewBlob(null);
    previewNodeRef.current = null;
  }, [previewUrl]);

  const handleSignSuccess = useCallback(() => {
    loadSignatureStatuses();
    // Auto-refresh preview if the signed document is currently being previewed
    if (signTarget && previewNodeRef.current && signTarget.id === previewNodeRef.current.id) {
      const node = previewNodeRef.current;
      // Re-fetch the PDF after a short delay to get the newly cached (signed) version
      setTimeout(async () => {
        try {
          const blob = await node.fetchBlob();
          if (previewNodeRef.current?.id === node.id) {
            showPreview(blob, node.label);
          }
        } catch {
          // silent — user can manually re-click preview
        }
      }, 300);
    }
  }, [loadSignatureStatuses, signTarget, showPreview]);

  // Group by category preserving order
  const categories = useMemo(() => {
    const map = new Map<string, CetakanNode[]>();
    for (const node of allNodes) {
      if (!map.has(node.category)) map.set(node.category, []);
      map.get(node.category)!.push(node);
    }
    return Array.from(map.entries());
  }, [allNodes]);

  // Node map for quick lookup
  const nodeMap = useMemo(() => {
    const m = new Map<string, CetakanNode>();
    for (const n of allNodes) m.set(n.id, n);
    return m;
  }, [allNodes]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setOrderedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
    setOrderedIds((prev) => {
      if (select) {
        const existing = new Set(prev);
        return [...prev, ...ids.filter((id) => !existing.has(id))];
      }
      return prev.filter((x) => !ids.includes(x));
    });
  }, []);

  const handleSelectAllDocs = useCallback(() => {
    const available = allNodes.filter((n) => n.available).map((n) => n.id);
    setSelectedIds(new Set(available));
    setOrderedIds(available);
  }, [allNodes]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setOrderedIds([]);
  }, []);

  const handleMoveUp = useCallback((id: string) => {
    setOrderedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((id: string) => {
    setOrderedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOrderedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  // Preview single PDF (used by both tree Eye button and right panel)
  const handlePreview = useCallback(async (node: CetakanNode) => {
    previewNodeRef.current = node;
    setNodePreviewLoading(node.id);
    setLoadingPreview(true);
    closePreview();
    try {
      const blob = await node.fetchBlob();
      showPreview(blob, node.label);
    } catch {
      toast({ variant: 'destructive', title: 'Gagal', description: `Tidak dapat memuat PDF: ${node.label}` });
    } finally {
      setLoadingPreview(false);
      setNodePreviewLoading(null);
    }
  }, [toast, closePreview, showPreview]);

  // Merge selected → show in preview
  const handleMerge = useCallback(async () => {
    const items: MergeItem[] = orderedIds
      .filter((id) => selectedIds.has(id) && nodeMap.has(id))
      .map((id) => {
        const node = nodeMap.get(id)!;
        return { label: node.label, fetchBlob: node.fetchBlob };
      });

    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Pilih minimal 1 cetakan untuk di-merge.' });
      return;
    }

    setMerging(true);
    setMergeProgress(null);
    closePreview();
    try {
      const result = await mergePdfs(items, (current, total) => {
        setMergeProgress({ current, total });
      });

      if (result.failedItems.length > 0) {
        toast({
          variant: 'default',
          title: `${result.successCount} berhasil, ${result.failedItems.length} gagal`,
          description: `Gagal: ${result.failedItems.join(', ')}`,
        });
      }

      showPreview(result.blob, `Merge ${result.successCount} dokumen (${result.totalPages} halaman)`);

      toast({
        variant: 'success',
        title: 'Merge Berhasil!',
        description: `${result.totalPages} halaman dari ${result.successCount} dokumen.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Gagal merge', description: err?.message || 'Terjadi kesalahan saat merge PDF.' });
    } finally {
      setMerging(false);
      setMergeProgress(null);
    }
  }, [orderedIds, selectedIds, nodeMap, toast, closePreview, showPreview]);

  // Download from current preview blob
  const handleDownloadPreview = useCallback(() => {
    if (!previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.no_sep || 'Rekam-Medis'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({ variant: 'success', title: 'Download dimulai!' });
  }, [previewBlob, detail, toast]);

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Cetakan Rekam Medis (PDF)</h3>
          <p className="text-xs text-muted-foreground">
            Pilih cetakan, atur urutan, lalu merge/download menjadi 1 file PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAllDocs}>
            Pilih Semua
          </Button>
          {selectedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
              Batal Pilih
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {mergeProgress && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Memproses {mergeProgress.current}/{mergeProgress.total} dokumen...
          </p>
          <Progress value={(mergeProgress.current / mergeProgress.total) * 100} className="h-2" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Tree selection */}
        <div className="lg:col-span-2 space-y-2">
          {categories.map(([category, nodes]) => (
            <CategoryNode
              key={category}
              category={category}
              nodes={nodes}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              signatureStatuses={signatureStatuses}
              onSign={handleOpenSignDialog}
              nodePreviewLoading={nodePreviewLoading}
              onPreview={handlePreview}
            />
          ))}
        </div>

        {/* Right: Selected order & actions */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-3 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Urutan Cetakan</h4>
              <Badge variant="secondary" className="text-xs">{selectedCount} dipilih</Badge>
            </div>

            {orderedIds.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Belum ada cetakan yang dipilih.<br />Centang cetakan di sebelah kiri.
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {orderedIds.map((id, idx) => {
                  const node = nodeMap.get(id);
                  if (!node) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 p-1.5 rounded border bg-background text-xs group"
                    >
                      <span className="shrink-0 text-muted-foreground w-5 text-center font-mono text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="text-muted-foreground shrink-0">{node.icon}</span>
                      <span className="flex-1 truncate">{node.label}</span>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handlePreview(node)}
                          title="Preview"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleMoveUp(id)}
                          disabled={idx === 0}
                          title="Naik"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleMoveDown(id)}
                          disabled={idx === orderedIds.length - 1}
                          title="Turun"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={() => handleRemove(id)}
                          title="Hapus"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleMerge}
                disabled={selectedCount === 0 || merging}
                className="w-full"
              >
                {merging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Preview {selectedCount > 1 ? `& Merge (${selectedCount})` : `(${selectedCount})`}
              </Button>
            </div>
          </div>

          {/* Preview area — modal */}
          <Dialog open={!!(previewUrl || loadingPreview)} onOpenChange={(open) => { if (!open) closePreview(); }}>
            <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-sm font-medium truncate pr-4">
                    {previewLabel || 'Preview PDF'}
                  </DialogTitle>
                  {previewBlob && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (previewUrl) window.open(previewUrl, '_blank');
                        }}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Buka Tab
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleDownloadPreview}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </DialogHeader>
              <div className="flex-1 min-h-0">
                {loadingPreview ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
                  </div>
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sign on behalf dialog */}
      {signTarget && (
        <SignOnBehalfDialog
          open={signDialogOpen}
          onOpenChange={setSignDialogOpen}
          documentType={signTarget.documentType}
          documentId={signTarget.documentId}
          visitId={detail.visit_id}
          signerHint={signTarget.signerHint}
          documentTitle={signTarget.label}
          visitDoctor={(detail as any).visit?.doctor ? {
            id: (detail as any).visit.doctor.id,
            nama_lengkap: (detail as any).visit.doctor.nama_lengkap,
            spesialisasi: (detail as any).visit.doctor.spesialisasi,
            no_sip: (detail as any).visit.doctor.no_sip,
            no_str: (detail as any).visit.doctor.no_str,
          } : undefined}
          onSuccess={handleSignSuccess}
        />
      )}
    </div>
  );
}
