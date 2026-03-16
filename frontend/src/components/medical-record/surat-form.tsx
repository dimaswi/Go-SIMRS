/**
 * Unified Surat (Letters/Certificates) Form Component
 * Menggabungkan semua jenis surat ke dalam satu tab dengan pilihan jenis surat
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Save,
  Loader2,
  FileText,
  Calendar,
  Printer,
  Trash2,
  Clock,
  Plus,
  Edit,
  ShieldCheck,
  Heart,
  Baby,
  Briefcase,
  Activity,
  Skull,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import {
  medicalRecordsApi,
  printApi,
  signatureApi,
  visitsApi,
  DOCUMENT_TYPES,
} from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import type {
  SickLetter,
  HealthCertificate,
  BirthCertificate,
  LeaveCertificate,
  MCUCertificate,
} from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// ============================================================
// TYPES
// ============================================================

type LetterType =
  | "sick-letter"
  | "health-certificate"
  | "birth-certificate"
  | "leave-certificate"
  | "mcu-certificate"
  | "death-certificate";

interface SuratFormProps {
  visitId: number;
  readOnly?: boolean;
}

interface LetterTypeOption {
  id: LetterType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const letterTypes: LetterTypeOption[] = [
  {
    id: "sick-letter",
    label: "Surat Sakit",
    icon: <FileText className="h-5 w-5" />,
    description: "Surat keterangan sakit untuk pasien",
    color: "",
  },
  {
    id: "health-certificate",
    label: "Surat Sehat",
    icon: <Heart className="h-5 w-5" />,
    description: "Surat keterangan sehat",
    color: "",
  },
  {
    id: "birth-certificate",
    label: "Surat Kelahiran",
    icon: <Baby className="h-5 w-5" />,
    description: "Surat keterangan kelahiran bayi",
    color: "",
  },
  {
    id: "leave-certificate",
    label: "Surat Cuti",
    icon: <Briefcase className="h-5 w-5" />,
    description: "Surat keterangan cuti medis",
    color: "",
  },
  {
    id: "mcu-certificate",
    label: "MCU",
    icon: <Activity className="h-5 w-5" />,
    description: "Surat Medical Check-Up",
    color: "",
  },
  {
    id: "death-certificate",
    label: "Surat Kematian",
    icon: <Skull className="h-5 w-5" />,
    description: "Surat keterangan kematian",
    color: "",
  },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function SuratForm({ visitId, readOnly = false }: SuratFormProps) {
  const [selectedType, setSelectedType] = useState<LetterType | null>(null);
  const [letterCounts, setLetterCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Load counts for all letter types
  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const [sick, health, birth, leave, mcu, death] = await Promise.allSettled([
        medicalRecordsApi.getSickLetters(visitId),
        medicalRecordsApi.getHealthCertificates(visitId),
        medicalRecordsApi.getBirthCertificates(visitId),
        medicalRecordsApi.getLeaveCertificates(visitId),
        medicalRecordsApi.getMCUCertificates(visitId),
        medicalRecordsApi.getDeathCertificates(visitId),
      ]);
      setLetterCounts({
        "sick-letter": sick.status === "fulfilled" ? (sick.value.data?.length || 0) : 0,
        "health-certificate": health.status === "fulfilled" ? (health.value.data?.length || 0) : 0,
        "birth-certificate": birth.status === "fulfilled" ? (birth.value.data?.length || 0) : 0,
        "leave-certificate": leave.status === "fulfilled" ? (leave.value.data?.length || 0) : 0,
        "mcu-certificate": mcu.status === "fulfilled" ? (mcu.value.data?.length || 0) : 0,
        "death-certificate": death.status === "fulfilled" ? (death.value.data?.length || 0) : 0,
      });
    } catch {
      // ignore
    } finally {
      setLoadingCounts(false);
    }
  }, [visitId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleCountUpdate = (type: LetterType, count: number) => {
    setLetterCounts((prev) => ({ ...prev, [type]: count }));
  };

  if (loadingCounts) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show type selector or form content
  if (!selectedType) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">Pilih Jenis Surat</Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {letterTypes.map((lt) => {
            const count = letterCounts[lt.id] || 0;
            return (
              <button
                key={lt.id}
                type="button"
                onClick={() => setSelectedType(lt.id)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all flex flex-col gap-2 group",
                  "border-muted hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {lt.icon}
                    <span className="font-semibold text-sm">{lt.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {count > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {count}
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{lt.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedTypeInfo = letterTypes.find((lt) => lt.id === selectedType)!;

  return (
    <div>
      {/* Header with back button */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedType(null)}
          className="gap-1 -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali
        </Button>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded">
            {selectedTypeInfo.icon}
          </span>
          <span className="font-medium">{selectedTypeInfo.label}</span>
        </div>
      </div>

      {/* Render appropriate form */}
      {selectedType === "sick-letter" && (
        <SickLetterSubForm
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("sick-letter", c)}
        />
      )}
      {selectedType === "health-certificate" && (
        <HealthCertificateSubForm
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("health-certificate", c)}
        />
      )}
      {selectedType === "birth-certificate" && (
        <BirthCertificateSubForm
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("birth-certificate", c)}
        />
      )}
      {selectedType === "leave-certificate" && (
        <LeaveCertificateSubForm
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("leave-certificate", c)}
        />
      )}
      {selectedType === "mcu-certificate" && (
        <MCUCertificateSubForm
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("mcu-certificate", c)}
        />
      )}
      {selectedType === "death-certificate" && (
        <DeathCertificateSubFormWrapper
          visitId={visitId}
          readOnly={readOnly}
          onCountChange={(c) => handleCountUpdate("death-certificate", c)}
        />
      )}
    </div>
  );
}

// ============================================================
// SUB FORM: SURAT SAKIT
// ============================================================

interface SubFormProps {
  visitId: number;
  readOnly?: boolean;
  onCountChange?: (count: number) => void;
}

function SickLetterSubForm({ visitId, readOnly = false, onCountChange }: SubFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [letters, setLetters] = useState<SickLetter[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Signature
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean }>>({});

  const defaultForm = {
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    days: 1,
    purpose: "Untuk dapat dipergunakan sebagaimana mestinya",
    institution: "",
    notes: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.getSickLetters(visitId);
      const data = res.data || [];
      setLetters(data);
      onCountChange?.(data.length);
      data.forEach((l: SickLetter) => checkSignature(l.id));
    } catch {
      setLetters([]);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkSignature = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.SICK_LETTER, id);
      setSignatureStatuses((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setSignatureStatuses((prev) => ({ ...prev, [id]: { is_signed: false } }));
    }
  };

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const d = { ...formData, [field]: value };
    if (d.start_date && d.end_date) {
      const days = differenceInDays(new Date(d.end_date), new Date(d.start_date)) + 1;
      d.days = days > 0 ? days : 1;
    }
    setFormData(d);
  };

  const handleDaysChange = (v: number) => {
    const days = v > 0 ? v : 1;
    setFormData({
      ...formData,
      days,
      end_date: format(addDays(new Date(formData.start_date), days - 1), "yyyy-MM-dd"),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await medicalRecordsApi.saveSickLetter(visitId, {
        id: editingId || undefined,
        visit_id: visitId,
        ...formData,
        reason: "",
      } as any);
      toast({ title: "Berhasil", description: editingId ? "Surat sakit diperbarui" : "Surat sakit disimpan" });
      await loadData();
      setFormData(defaultForm);
      setEditingId(null);
      setActiveTab("history");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (l: SickLetter) => {
    setFormData({
      start_date: l.start_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      end_date: l.end_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      days: l.days || 1,
      purpose: l.purpose || "Untuk dapat dipergunakan sebagaimana mestinya",
      institution: l.institution || "",
      notes: l.notes || "",
    });
    setEditingId(l.id);
    setActiveTab("form");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await medicalRecordsApi.deleteSickLetter(visitId, deletingId);
      toast({ title: "Berhasil", description: "Surat sakit dihapus" });
      await loadData();
      if (editingId === deletingId) { setFormData(defaultForm); setEditingId(null); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handlePrint = async (id: number) => {
    setPrinting(true);
    try {
      await printApi.sickLetterById(visitId, id);
      toast({ title: "Berhasil", description: "Surat dicetak" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencetak" });
    } finally {
      setPrinting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <SubFormTabs activeTab={activeTab} setActiveTab={setActiveTab} editingId={editingId} count={letters.length} />
      <div className="pt-4">
        {activeTab === "form" && (
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Mulai</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => handleDateChange("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Selesai</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => handleDateChange("end_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label><Clock className="h-3.5 w-3.5 inline mr-1" />Jumlah Hari</Label>
                <Input type="number" min="1" value={formData.days} onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tujuan / Keperluan</Label>
              <Input placeholder="Untuk dapat dipergunakan sebagaimana mestinya" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi / Perusahaan</Label>
              <Input placeholder="Nama instansi (opsional)" value={formData.institution} onChange={(e) => setFormData({ ...formData, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan Tambahan</Label>
              <Textarea placeholder="Catatan tambahan (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Update" : "Simpan"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setFormData(defaultForm); setEditingId(null); }}>Batal</Button>}
              </div>
            )}
          </fieldset>
        )}
        {activeTab === "history" && (
          <HistoryTable
            items={letters}
            columns={[
              { key: "letter_number", label: "No. Surat" },
              { key: "date", label: "Tanggal", render: (l: any) => <>{fmtDate(l.start_date)}{l.days > 1 && <span className="text-muted-foreground"> → {fmtDate(l.end_date)}</span>}</> },
              { key: "days", label: "Lama", render: (l: any) => <Badge variant="secondary">{l.days} hari</Badge> },
              { key: "institution", label: "Tujuan", render: (l: any) => l.institution || l.purpose || "-" },
            ]}
            signatureStatuses={signatureStatuses}
            readOnly={readOnly}
            printing={printing}
            onPrint={handlePrint}
            onEdit={handleEdit}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onSign={(id) => { setSignatureLetterId(id); setShowSignatureDialog(true); }}
            emptyMessage="Belum ada surat sakit."
          />
        )}
      </div>
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Hapus Surat Sakit?" />
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.SICK_LETTER}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle="Surat Sakit"
          onSuccess={() => { checkSignature(signatureLetterId); setSignatureLetterId(null); toast({ variant: "success", title: "Berhasil", description: "Ditandatangani" }); }}
        />
      )}
    </>
  );
}

// ============================================================
// SUB FORM: SURAT SEHAT (Health Certificate)
// ============================================================

function HealthCertificateSubForm({ visitId, readOnly = false, onCountChange }: SubFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [items, setItems] = useState<HealthCertificate[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Signature
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean }>>({});

  const defaultForm = {
    exam_date: format(new Date(), "yyyy-MM-dd"),
    purpose: "Untuk dapat dipergunakan sebagaimana mestinya",
    institution: "",
    result: "sehat",
    notes: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.getHealthCertificates(visitId);
      const data = res.data || [];
      setItems(data);
      onCountChange?.(data.length);
      data.forEach((l: HealthCertificate) => checkSignature(l.id));
    } catch { setItems([]); } finally { setLoading(false); }
  }, [visitId]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkSignature = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.HEALTH_CERTIFICATE, id);
      setSignatureStatuses((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setSignatureStatuses((prev) => ({ ...prev, [id]: { is_signed: false } }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await medicalRecordsApi.saveHealthCertificate(visitId, { id: editingId || undefined, visit_id: visitId, ...formData } as any);
      toast({ title: "Berhasil", description: editingId ? "Surat sehat diperbarui" : "Surat sehat disimpan" });
      await loadData();
      setFormData(defaultForm);
      setEditingId(null);
      setActiveTab("history");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setSaving(false); }
  };

  const handleEdit = (item: HealthCertificate) => {
    setFormData({
      exam_date: item.exam_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      purpose: item.purpose || "",
      institution: item.institution || "",
      result: item.result || "sehat",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setActiveTab("form");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await medicalRecordsApi.deleteHealthCertificate(visitId, deletingId);
      toast({ title: "Berhasil", description: "Surat sehat dihapus" });
      await loadData();
      if (editingId === deletingId) { setFormData(defaultForm); setEditingId(null); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setDeleteDialogOpen(false); setDeletingId(null); }
  };

  const handlePrint = async (id: number) => {
    setPrinting(true);
    try {
      await printApi.healthCertificate(visitId, id);
      toast({ title: "Berhasil", description: "Surat dicetak" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencetak" });
    } finally {
      setPrinting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <SubFormTabs activeTab={activeTab} setActiveTab={setActiveTab} editingId={editingId} count={items.length} />
      <div className="pt-4">
        {activeTab === "form" && (
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Pemeriksaan</Label>
                <Input type="date" value={formData.exam_date} onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasil Pemeriksaan</Label>
                <Select value={formData.result} onValueChange={(v) => setFormData({ ...formData, result: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sehat">Sehat</SelectItem>
                    <SelectItem value="sehat_dengan_catatan">Sehat dengan Catatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tujuan / Keperluan</Label>
              <Input placeholder="Untuk dapat dipergunakan sebagaimana mestinya" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi / Perusahaan</Label>
              <Input placeholder="Nama instansi (opsional)" value={formData.institution} onChange={(e) => setFormData({ ...formData, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea placeholder="Catatan tambahan (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Update" : "Simpan"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setFormData(defaultForm); setEditingId(null); }}>Batal</Button>}
              </div>
            )}
          </fieldset>
        )}
        {activeTab === "history" && (
          <HistoryTable
            items={items}
            columns={[
              { key: "letter_number", label: "No. Surat" },
              { key: "date", label: "Tanggal", render: (l: any) => fmtDate(l.exam_date) },
              { key: "result", label: "Hasil", render: (l: any) => <Badge variant={l.result === "sehat" ? "default" : "secondary"} className={l.result === "sehat" ? "bg-green-600" : ""}>{l.result === "sehat" ? "Sehat" : "Sehat (Catatan)"}</Badge> },
              { key: "institution", label: "Tujuan", render: (l: any) => l.institution || l.purpose || "-" },
            ]}
            signatureStatuses={signatureStatuses}
            readOnly={readOnly}
            printing={printing}
            onPrint={handlePrint}
            onEdit={handleEdit}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onSign={(id) => { setSignatureLetterId(id); setShowSignatureDialog(true); }}
            emptyMessage="Belum ada surat sehat."
          />
        )}
      </div>
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Hapus Surat Sehat?" />
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.HEALTH_CERTIFICATE}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle="Surat Sehat"
          onSuccess={() => { checkSignature(signatureLetterId); setSignatureLetterId(null); toast({ variant: "success", title: "Berhasil", description: "Ditandatangani" }); }}
        />
      )}
    </>
  );
}

// ============================================================
// SUB FORM: SURAT KELAHIRAN (Birth Certificate)
// ============================================================

function BirthCertificateSubForm({ visitId, readOnly = false, onCountChange }: SubFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [items, setItems] = useState<BirthCertificate[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Signature
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean }>>({});

  const defaultForm = {
    birth_date: format(new Date(), "yyyy-MM-dd"),
    birth_time: format(new Date(), "HH:mm"),
    baby_name: "",
    gender: "laki-laki",
    birth_weight: "",
    birth_length: "",
    birth_method: "normal",
    mother_name: "",
    father_name: "",
    mother_mrn: "",
    dpjp_name: "",
    midwife_name: "",
    notes: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.getBirthCertificates(visitId);
      const data = res.data || [];
      setItems(data);
      onCountChange?.(data.length);
      data.forEach((l: BirthCertificate) => checkSignature(l.id));
    } catch { setItems([]); } finally { setLoading(false); }
  }, [visitId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-fill mother/father names from patient/registration data
  useEffect(() => {
    const fetchVisitData = async () => {
      try {
        const visitRes = await visitsApi.getById(visitId);
        const patient = visitRes.data?.registration?.patient;
        const doctor = visitRes.data?.doctor;
        if (patient) {
          const patientName = (patient.nama_lengkap || "").trim();
          const defaultMotherName = patientName ? `Ny. ${patientName}` : "";
          const defaultBabyName = defaultMotherName ? `By ${defaultMotherName}` : "";
          setFormData((prev) => ({
            ...prev,
            mother_name: prev.mother_name || defaultMotherName,
            baby_name: prev.baby_name || defaultBabyName,
            mother_mrn: prev.mother_mrn || patient.no_rm || "",
            father_name: prev.father_name || (
              patient.hubungan_penanggung_jawab?.toLowerCase() === "suami"
                ? patient.nama_penanggung_jawab || ""
                : ""
            ),
            dpjp_name: prev.dpjp_name || doctor?.nama_lengkap || "",
          }));
        }
      } catch { /* visit data may not be accessible */ }
    };
    fetchVisitData();
  }, [visitId]);

  const checkSignature = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.BIRTH_CERTIFICATE, id);
      setSignatureStatuses((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setSignatureStatuses((prev) => ({ ...prev, [id]: { is_signed: false } }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await medicalRecordsApi.saveBirthCertificate(visitId, {
        id: editingId || undefined,
        visit_id: visitId,
        ...formData,
        birth_weight: formData.birth_weight ? parseFloat(formData.birth_weight) : 0,
        birth_length: formData.birth_length ? parseFloat(formData.birth_length) : 0,
      } as any);
      toast({ title: "Berhasil", description: editingId ? "Surat kelahiran diperbarui" : "Surat kelahiran disimpan" });
      await loadData();
      setFormData(defaultForm);
      setEditingId(null);
      setActiveTab("history");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setSaving(false); }
  };

  const handleEdit = (item: BirthCertificate) => {
    setFormData({
      birth_date: item.birth_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      birth_time: item.birth_time || "",
      baby_name: item.baby_name || "",
      gender: item.gender || "laki-laki",
      birth_weight: item.birth_weight ? String(item.birth_weight) : "",
      birth_length: item.birth_length ? String(item.birth_length) : "",
      birth_method: item.birth_method || "normal",
      mother_name: item.mother_name || "",
      father_name: item.father_name || "",
      mother_mrn: item.mother_mrn || "",
      dpjp_name: item.dpjp_name || "",
      midwife_name: item.midwife_name || "",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setActiveTab("form");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await medicalRecordsApi.deleteBirthCertificate(visitId, deletingId);
      toast({ title: "Berhasil", description: "Surat kelahiran dihapus" });
      await loadData();
      if (editingId === deletingId) { setFormData(defaultForm); setEditingId(null); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setDeleteDialogOpen(false); setDeletingId(null); }
  };

  const handlePrint = async (id: number) => {
    setPrinting(true);
    try {
      await printApi.birthCertificate(visitId, id);
      toast({ title: "Berhasil", description: "Surat dicetak" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencetak" });
    } finally {
      setPrinting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <SubFormTabs activeTab={activeTab} setActiveTab={setActiveTab} editingId={editingId} count={items.length} />
      <div className="pt-4">
        {activeTab === "form" && (
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Lahir</Label>
                <Input type="date" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label><Clock className="h-3.5 w-3.5 inline mr-1" />Waktu Lahir</Label>
                <Input type="time" value={formData.birth_time} onChange={(e) => setFormData({ ...formData, birth_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Kelamin</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laki-laki">Laki-laki</SelectItem>
                    <SelectItem value="perempuan">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Bayi</Label>
              <Input placeholder="Nama bayi (opsional jika belum ditentukan)" value={formData.baby_name} onChange={(e) => setFormData({ ...formData, baby_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Berat Lahir (gram)</Label>
                <Input type="number" placeholder="cth: 3200" value={formData.birth_weight} onChange={(e) => setFormData({ ...formData, birth_weight: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Panjang Lahir (cm)</Label>
                <Input type="number" placeholder="cth: 49" value={formData.birth_length} onChange={(e) => setFormData({ ...formData, birth_length: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Metode Persalinan</Label>
                <Select value={formData.birth_method} onValueChange={(v) => setFormData({ ...formData, birth_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal / Spontan</SelectItem>
                    <SelectItem value="sectio_caesarea">Sectio Caesarea</SelectItem>
                    <SelectItem value="vakum">Vakum Ekstraksi</SelectItem>
                    <SelectItem value="forcep">Forcep</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nama Ibu</Label>
                <Input placeholder="Ny. Nama lengkap ibu" value={formData.mother_name} onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>NORM Ibu</Label>
                <Input placeholder="Nomor rekam medis ibu" value={formData.mother_mrn} onChange={(e) => setFormData({ ...formData, mother_mrn: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nama Ayah</Label>
                <Input placeholder="Nama lengkap ayah" value={formData.father_name} onChange={(e) => setFormData({ ...formData, father_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nama DPJP</Label>
                <Input placeholder="Nama dokter penanggung jawab" value={formData.dpjp_name} onChange={(e) => setFormData({ ...formData, dpjp_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Nama Bidan</Label>
                <Input placeholder="Nama bidan penolong" value={formData.midwife_name} onChange={(e) => setFormData({ ...formData, midwife_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea placeholder="Catatan tambahan (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Update" : "Simpan"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setFormData(defaultForm); setEditingId(null); }}>Batal</Button>}
              </div>
            )}
          </fieldset>
        )}
        {activeTab === "history" && (
          <HistoryTable
            items={items}
            columns={[
              { key: "letter_number", label: "No. Surat" },
              { key: "date", label: "Tanggal Lahir", render: (l: any) => <>{fmtDate(l.birth_date)}{l.birth_time && <span className="text-muted-foreground"> {l.birth_time}</span>}</> },
              { key: "baby", label: "Bayi", render: (l: any) => <>{l.baby_name || "Belum diberi nama"} <Badge variant="secondary" className="ml-1">{l.gender === "laki-laki" ? "L" : "P"}</Badge></> },
              { key: "weight", label: "BB / PB", render: (l: any) => <>{l.birth_weight ? `${l.birth_weight}g` : "-"} / {l.birth_length ? `${l.birth_length}cm` : "-"}</> },
            ]}
            signatureStatuses={signatureStatuses}
            readOnly={readOnly}
            printing={printing}
            onPrint={handlePrint}
            onEdit={handleEdit}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onSign={(id) => { setSignatureLetterId(id); setShowSignatureDialog(true); }}
            emptyMessage="Belum ada surat kelahiran."
          />
        )}
      </div>
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Hapus Surat Kelahiran?" />
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.BIRTH_CERTIFICATE}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle="Surat Kelahiran"
          onSuccess={() => { checkSignature(signatureLetterId); setSignatureLetterId(null); toast({ variant: "success", title: "Berhasil", description: "Ditandatangani" }); }}
        />
      )}
    </>
  );
}

// ============================================================
// SUB FORM: SURAT CUTI (Leave Certificate)
// ============================================================

function LeaveCertificateSubForm({ visitId, readOnly = false, onCountChange }: SubFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [items, setItems] = useState<LeaveCertificate[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Signature
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean }>>({});

  const defaultForm = {
    leave_type: "sakit",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    days: 1,
    reason: "",
    diagnosis: "",
    institution: "",
    notes: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.getLeaveCertificates(visitId);
      const data = res.data || [];
      setItems(data);
      onCountChange?.(data.length);
      data.forEach((l: LeaveCertificate) => checkSignature(l.id));
    } catch { setItems([]); } finally { setLoading(false); }
  }, [visitId]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkSignature = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.LEAVE_CERTIFICATE, id);
      setSignatureStatuses((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setSignatureStatuses((prev) => ({ ...prev, [id]: { is_signed: false } }));
    }
  };

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const d = { ...formData, [field]: value };
    if (d.start_date && d.end_date) {
      const days = differenceInDays(new Date(d.end_date), new Date(d.start_date)) + 1;
      d.days = days > 0 ? days : 1;
    }
    setFormData(d);
  };

  const handleDaysChange = (v: number) => {
    const days = v > 0 ? v : 1;
    setFormData({
      ...formData,
      days,
      end_date: format(addDays(new Date(formData.start_date), days - 1), "yyyy-MM-dd"),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await medicalRecordsApi.saveLeaveCertificate(visitId, { id: editingId || undefined, visit_id: visitId, ...formData } as any);
      toast({ title: "Berhasil", description: editingId ? "Surat cuti diperbarui" : "Surat cuti disimpan" });
      await loadData();
      setFormData(defaultForm);
      setEditingId(null);
      setActiveTab("history");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setSaving(false); }
  };

  const handleEdit = (item: LeaveCertificate) => {
    setFormData({
      leave_type: item.leave_type || "sakit",
      start_date: item.start_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      end_date: item.end_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      days: item.days || 1,
      reason: item.reason || "",
      diagnosis: item.diagnosis || "",
      institution: item.institution || "",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setActiveTab("form");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await medicalRecordsApi.deleteLeaveCertificate(visitId, deletingId);
      toast({ title: "Berhasil", description: "Surat cuti dihapus" });
      await loadData();
      if (editingId === deletingId) { setFormData(defaultForm); setEditingId(null); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setDeleteDialogOpen(false); setDeletingId(null); }
  };

  const handlePrint = async (id: number) => {
    setPrinting(true);
    try {
      await printApi.leaveCertificate(visitId, id);
      toast({ title: "Berhasil", description: "Surat dicetak" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencetak" });
    } finally {
      setPrinting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
  };

  const leaveTypeLabels: Record<string, string> = {
    sakit: "Sakit",
    hamil: "Hamil",
    melahirkan: "Melahirkan",
    lainnya: "Lainnya",
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <SubFormTabs activeTab={activeTab} setActiveTab={setActiveTab} editingId={editingId} count={items.length} />
      <div className="pt-4">
        {activeTab === "form" && (
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Jenis Cuti</Label>
              <Select value={formData.leave_type} onValueChange={(v) => setFormData({ ...formData, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sakit">Cuti Sakit</SelectItem>
                  <SelectItem value="hamil">Cuti Hamil</SelectItem>
                  <SelectItem value="melahirkan">Cuti Melahirkan</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Mulai</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => handleDateChange("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Selesai</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => handleDateChange("end_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label><Clock className="h-3.5 w-3.5 inline mr-1" />Jumlah Hari</Label>
                <Input type="number" min="1" value={formData.days} onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Alasan</Label>
              <Textarea placeholder="Alasan / keterangan cuti" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Diagnosis</Label>
              <Input placeholder="Diagnosis terkait (opsional)" value={formData.diagnosis} onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi / Perusahaan</Label>
              <Input placeholder="Nama instansi (opsional)" value={formData.institution} onChange={(e) => setFormData({ ...formData, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea placeholder="Catatan tambahan (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Update" : "Simpan"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setFormData(defaultForm); setEditingId(null); }}>Batal</Button>}
              </div>
            )}
          </fieldset>
        )}
        {activeTab === "history" && (
          <HistoryTable
            items={items}
            columns={[
              { key: "letter_number", label: "No. Surat" },
              { key: "type", label: "Jenis", render: (l: any) => <Badge variant="secondary">{leaveTypeLabels[l.leave_type] || l.leave_type}</Badge> },
              { key: "date", label: "Periode", render: (l: any) => <>{fmtDate(l.start_date)} → {fmtDate(l.end_date)}</> },
              { key: "days", label: "Lama", render: (l: any) => <Badge variant="secondary">{l.days} hari</Badge> },
            ]}
            signatureStatuses={signatureStatuses}
            readOnly={readOnly}
            printing={printing}
            onPrint={handlePrint}
            onEdit={handleEdit}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onSign={(id) => { setSignatureLetterId(id); setShowSignatureDialog(true); }}
            emptyMessage="Belum ada surat cuti."
          />
        )}
      </div>
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Hapus Surat Cuti?" />
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.LEAVE_CERTIFICATE}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle="Surat Cuti"
          onSuccess={() => { checkSignature(signatureLetterId); setSignatureLetterId(null); toast({ variant: "success", title: "Berhasil", description: "Ditandatangani" }); }}
        />
      )}
    </>
  );
}

// ============================================================
// SUB FORM: MCU (Medical Check-Up)
// ============================================================

function MCUCertificateSubForm({ visitId, readOnly = false, onCountChange }: SubFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [items, setItems] = useState<MCUCertificate[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Signature
  const [signatureLetterId, setSignatureLetterId] = useState<number | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatuses, setSignatureStatuses] = useState<Record<number, { is_signed: boolean }>>({});

  const defaultForm = {
    exam_date: format(new Date(), "yyyy-MM-dd"),
    purpose: "",
    institution: "",
    conclusion: "layak",
    recommendation: "",
    notes: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.getMCUCertificates(visitId);
      const data = res.data || [];
      setItems(data);
      onCountChange?.(data.length);
      data.forEach((l: MCUCertificate) => checkSignature(l.id));
    } catch { setItems([]); } finally { setLoading(false); }
  }, [visitId]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkSignature = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.MCU_CERTIFICATE, id);
      setSignatureStatuses((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setSignatureStatuses((prev) => ({ ...prev, [id]: { is_signed: false } }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await medicalRecordsApi.saveMCUCertificate(visitId, { id: editingId || undefined, visit_id: visitId, ...formData } as any);
      toast({ title: "Berhasil", description: editingId ? "Surat MCU diperbarui" : "Surat MCU disimpan" });
      await loadData();
      setFormData(defaultForm);
      setEditingId(null);
      setActiveTab("history");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setSaving(false); }
  };

  const handleEdit = (item: MCUCertificate) => {
    setFormData({
      exam_date: item.exam_date?.split("T")[0] || format(new Date(), "yyyy-MM-dd"),
      purpose: item.purpose || "",
      institution: item.institution || "",
      conclusion: item.conclusion || "layak",
      recommendation: item.recommendation || "",
      notes: item.notes || "",
    });
    setEditingId(item.id);
    setActiveTab("form");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await medicalRecordsApi.deleteMCUCertificate(visitId, deletingId);
      toast({ title: "Berhasil", description: "Surat MCU dihapus" });
      await loadData();
      if (editingId === deletingId) { setFormData(defaultForm); setEditingId(null); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.response?.data?.error || "Terjadi kesalahan" });
    } finally { setDeleteDialogOpen(false); setDeletingId(null); }
  };

  const handlePrint = async (id: number) => {
    setPrinting(true);
    try {
      await printApi.mcuCertificate(visitId, id);
      toast({ title: "Berhasil", description: "Surat dicetak" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencetak" });
    } finally {
      setPrinting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
  };

  const conclusionLabels: Record<string, string> = {
    layak: "Layak",
    tidak_layak: "Tidak Layak",
    layak_dengan_catatan: "Layak (Catatan)",
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <SubFormTabs activeTab={activeTab} setActiveTab={setActiveTab} editingId={editingId} count={items.length} />
      <div className="pt-4">
        {activeTab === "form" && (
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label><Calendar className="h-3.5 w-3.5 inline mr-1" />Tanggal Pemeriksaan</Label>
                <Input type="date" value={formData.exam_date} onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Kesimpulan</Label>
                <Select value={formData.conclusion} onValueChange={(v) => setFormData({ ...formData, conclusion: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="layak">Layak</SelectItem>
                    <SelectItem value="tidak_layak">Tidak Layak</SelectItem>
                    <SelectItem value="layak_dengan_catatan">Layak dengan Catatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tujuan / Keperluan MCU</Label>
              <Input placeholder="cth: Pemeriksaan kesehatan calon karyawan" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi / Perusahaan</Label>
              <Input placeholder="Nama instansi (opsional)" value={formData.institution} onChange={(e) => setFormData({ ...formData, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Rekomendasi</Label>
              <Textarea placeholder="Rekomendasi dokter (opsional)" value={formData.recommendation} onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea placeholder="Catatan tambahan (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Update" : "Simpan"}
                </Button>
                {editingId && <Button variant="outline" onClick={() => { setFormData(defaultForm); setEditingId(null); }}>Batal</Button>}
              </div>
            )}
          </fieldset>
        )}
        {activeTab === "history" && (
          <HistoryTable
            items={items}
            columns={[
              { key: "letter_number", label: "No. Surat" },
              { key: "date", label: "Tanggal", render: (l: any) => fmtDate(l.exam_date) },
              { key: "conclusion", label: "Kesimpulan", render: (l: any) => {
                const color = l.conclusion === "layak" ? "bg-green-600" : l.conclusion === "tidak_layak" ? "bg-destructive" : "";
                return <Badge variant="default" className={color}>{conclusionLabels[l.conclusion] || l.conclusion}</Badge>;
              }},
              { key: "institution", label: "Instansi", render: (l: any) => l.institution || l.purpose || "-" },
            ]}
            signatureStatuses={signatureStatuses}
            readOnly={readOnly}
            printing={printing}
            onPrint={handlePrint}
            onEdit={handleEdit}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onSign={(id) => { setSignatureLetterId(id); setShowSignatureDialog(true); }}
            emptyMessage="Belum ada surat MCU."
          />
        )}
      </div>
      <DeleteDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title="Hapus Surat MCU?" />
      {signatureLetterId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.MCU_CERTIFICATE}
          documentId={signatureLetterId}
          visitId={visitId}
          documentTitle="Surat MCU"
          onSuccess={() => { checkSignature(signatureLetterId); setSignatureLetterId(null); toast({ variant: "success", title: "Berhasil", description: "Ditandatangani" }); }}
        />
      )}
    </>
  );
}

// ============================================================
// DEATH CERTIFICATE WRAPPER (uses existing DeathCertificateForm)
// ============================================================

import { DeathCertificateForm } from "./death-certificate-form";

function DeathCertificateSubFormWrapper({ visitId, readOnly = false }: SubFormProps) {
  return <DeathCertificateForm visitId={visitId} readOnly={readOnly} />;
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function SubFormTabs({
  activeTab,
  setActiveTab,
  editingId,
  count,
}: {
  activeTab: "form" | "history";
  setActiveTab: (t: "form" | "history") => void;
  editingId: number | null;
  count: number;
}) {
  return (
    <div className="border-b">
      <div className="flex">
        <button
          onClick={() => setActiveTab("form")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors relative",
            activeTab === "form" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {editingId ? "Edit Surat" : "Buat Surat"}
          </span>
          {activeTab === "form" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors relative",
            activeTab === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Riwayat
            {count > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {count}
              </Badge>
            )}
          </span>
          {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>
    </div>
  );
}

interface ColumnDef {
  key: string;
  label: string;
  render?: (item: any) => React.ReactNode;
}

function HistoryTable({
  items,
  columns,
  signatureStatuses,
  readOnly,
  printing,
  onPrint,
  onEdit,
  onDelete,
  onSign,
  emptyMessage,
}: {
  items: any[];
  columns: ColumnDef[];
  signatureStatuses?: Record<number, { is_signed: boolean }>;
  readOnly?: boolean;
  printing?: boolean;
  onPrint?: (id: number) => void;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
  onSign?: (id: number) => void;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>{emptyMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
          {signatureStatuses && <TableHead>Status</TableHead>}
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            {columns.map((col) => (
              <TableCell key={col.key} className={col.key === "letter_number" ? "font-medium" : ""}>
                {col.render ? col.render(item) : item[col.key] || "-"}
              </TableCell>
            ))}
            {signatureStatuses && (
              <TableCell>
                {signatureStatuses[item.id]?.is_signed ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <ShieldCheck className="h-3 w-3" />Signed
                  </Badge>
                ) : (
                  <Badge variant="secondary">Belum</Badge>
                )}
              </TableCell>
            )}
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {onPrint && (
                  <Button size="sm" variant="ghost" onClick={() => onPrint(item.id)} disabled={printing} title="Cetak">
                    <Printer className="h-4 w-4" />
                  </Button>
                )}
                {onSign && signatureStatuses && !signatureStatuses[item.id]?.is_signed && !readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => onSign(item.id)} title="Tanda Tangan" className="text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                )}
                {!readOnly && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => onEdit(item)} title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)} title="Hapus" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus surat ini? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground">
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
