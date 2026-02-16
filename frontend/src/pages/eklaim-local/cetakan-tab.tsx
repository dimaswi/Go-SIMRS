/**
 * Cetakan Tab - Node tree cetakan rekam medis (PDF)
 * SEP di paling atas, lalu dikelompokkan per kategori
 * Bisa dipilih (checkbox), diurutkan (drag up/down), dan di-merge jadi 1 PDF
 */
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { printApi } from '@/lib/api/print';
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
} from 'lucide-react';

// ===== Types =====
interface CetakanNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  fetchBlob: () => Promise<Blob>;
  available: boolean;
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

  const nodes: CetakanNode[] = [];

  // === SEP (paling atas) ===
  if (sepId) {
    nodes.push({
      id: `sep-${sepId}`,
      label: 'Surat Eligibilitas Peserta (SEP)',
      icon: <CreditCard className="h-4 w-4" />,
      category: 'SEP',
      fetchBlob: () => printApi.blob.sep(sepId),
      available: true,
    });
  }

  // === A. Umum ===
  if (registrationId) {
    nodes.push({
      id: `admission-discharge-${registrationId}`,
      label: 'Ringkasan Masuk & Keluar Pasien',
      icon: <FileText className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.admissionDischargeSummary(registrationId, visitId),
      available: true,
    });
    nodes.push({
      id: `registration-receipt-${registrationId}`,
      label: 'Bukti Registrasi',
      icon: <FileText className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.registrationReceipt(registrationId),
      available: true,
    });
  }

  if (patientId) {
    nodes.push({
      id: `informed-consent-${patientId}`,
      label: 'Informed Consent / General Consent',
      icon: <FileCheck className="h-4 w-4" />,
      category: 'A. Umum',
      fetchBlob: () => printApi.blob.informedConsent(patientId),
      available: true,
    });
  }

  // === B. Rawat Jalan / Resume ===
  if (visitId) {
    nodes.push({
      id: `resume-${visitId}`,
      label: 'Resume Medis (Rawat Jalan / Rawat Inap)',
      icon: <Stethoscope className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.outpatientResume(visitId),
      available: true,
    });

    nodes.push({
      id: `inpatient-resume-${visitId}`,
      label: 'Resume Medis Rawat Inap',
      icon: <Stethoscope className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.inpatientResume(visitId),
      available: true,
    });

    nodes.push({
      id: `referral-letter-${visitId}`,
      label: 'Surat Rujukan',
      icon: <Send className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.referralLetter(visitId),
      available: !!originalRM.disposition && originalRM.disposition.disposition_type === 'rujuk',
    });

    nodes.push({
      id: `inpatient-certificate-${visitId}`,
      label: 'Surat Keterangan Rawat Inap',
      icon: <FileCheck className="h-4 w-4" />,
      category: 'B. Resume Medis',
      fetchBlob: () => printApi.blob.inpatientCertificate(visitId),
      available: true,
    });
  }

  // === C. UGD ===
  if (visitId) {
    nodes.push({
      id: `triage-${visitId}`,
      label: 'Formulir Triage UGD',
      icon: <AlertTriangle className="h-4 w-4" />,
      category: 'C. Gawat Darurat',
      fetchBlob: () => printApi.blob.triageForm(visitId),
      available: true,
    });
    nodes.push({
      id: `emergency-summary-${visitId}`,
      label: 'Ringkasan Pelayanan UGD',
      icon: <ClipboardList className="h-4 w-4" />,
      category: 'C. Gawat Darurat',
      fetchBlob: () => printApi.blob.emergencySummary(visitId),
      available: true,
    });
  }

  // === D. Rawat Inap ===
  if (visitId) {
    nodes.push({
      id: `cppt-${visitId}`,
      label: 'CPPT (Catatan Perkembangan Pasien)',
      icon: <ClipboardList className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.cppt(visitId),
      available: true,
    });
    nodes.push({
      id: `nursing-care-${visitId}`,
      label: 'Asuhan Keperawatan',
      icon: <Activity className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.nursingCare(visitId),
      available: true,
    });
    nodes.push({
      id: `fluid-balance-${visitId}`,
      label: 'Balance Cairan',
      icon: <Droplets className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.fluidBalance(visitId),
      available: true,
    });
    nodes.push({
      id: `bed-transfer-${visitId}`,
      label: 'Lembar Mutasi Pasien',
      icon: <BedDouble className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.bedTransfer(visitId),
      available: true,
    });
    nodes.push({
      id: `vital-sign-chart-${visitId}`,
      label: 'Grafik Tanda Vital',
      icon: <HeartPulse className="h-4 w-4" />,
      category: 'D. Rawat Inap',
      fetchBlob: () => printApi.blob.vitalSignChart(visitId),
      available: true,
    });
  }

  // === E. Penunjang (Lab, Radiology, Surgery) ===
  if (originalRM.lab_orders && originalRM.lab_orders.length > 0) {
    for (const order of originalRM.lab_orders) {
      nodes.push({
        id: `lab-result-${order.id}`,
        label: `Hasil Lab - ${order.order_number}`,
        icon: <FlaskConical className="h-4 w-4" />,
        category: 'E. Penunjang',
        fetchBlob: () => printApi.blob.labResult(order.id),
        available: order.status === 'completed',
      });
    }
  }

  if (originalRM.radiology_orders && originalRM.radiology_orders.length > 0) {
    for (const order of originalRM.radiology_orders) {
      nodes.push({
        id: `radiology-result-${order.id}`,
        label: `Hasil Radiologi - ${order.order_number}`,
        icon: <FileText className="h-4 w-4" />,
        category: 'E. Penunjang',
        fetchBlob: () => (printApi as any).blob.radiologyResult
          ? (printApi as any).blob.radiologyResult(order.id)
          : (printApi as any).radiologyResult(order.id),
        available: order.status === 'completed',
      });
    }
  }

  if (originalRM.surgery_orders && originalRM.surgery_orders.length > 0) {
    for (const order of originalRM.surgery_orders) {
      nodes.push({
        id: `surgery-note-${order.id}`,
        label: `Catatan Operasi - ${order.order_number}`,
        icon: <Scissors className="h-4 w-4" />,
        category: 'E. Penunjang',
        fetchBlob: () => (printApi as any).blob.procedureOrderResult
          ? (printApi as any).blob.procedureOrderResult(order.id)
          : (printApi as any).procedureOrderResult(order.id),
        available: order.status === 'completed',
      });
    }
  }

  // === F. Resep Obat ===
  if (originalRM.medicine_orders && originalRM.medicine_orders.length > 0) {
    for (const order of originalRM.medicine_orders) {
      nodes.push({
        id: `prescription-${order.id}`,
        label: `Resep Obat - ${order.order_number}`,
        icon: <Pill className="h-4 w-4" />,
        category: 'F. Farmasi',
        fetchBlob: () => printApi.blob.prescription(order.id),
        available: true,
      });
    }
  }

  return nodes;
}

// ===== Category tree node =====
function CategoryNode({
  category,
  nodes,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  category: string;
  nodes: CetakanNode[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
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
          {nodes.map((node) => (
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
              {!node.available && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Tidak tersedia</Badge>
              )}
            </div>
          ))}
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

  const allNodes = useMemo(() => buildCetakanNodes(detail, originalRM), [detail, originalRM]);

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
  }, [previewUrl]);

  // Preview single PDF
  const handlePreview = useCallback(async (node: CetakanNode) => {
    setLoadingPreview(true);
    closePreview();
    try {
      const blob = await node.fetchBlob();
      showPreview(blob, node.label);
    } catch {
      toast({ variant: 'destructive', title: 'Gagal', description: `Tidak dapat memuat PDF: ${node.label}` });
    } finally {
      setLoadingPreview(false);
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
    </div>
  );
}
