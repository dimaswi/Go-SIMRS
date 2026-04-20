import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  cpptApi,
  CPPT_FORMATS,
  CPPT_PROFESSIONS,
  getCPPTProfessionLabel,
} from "@/lib/api";
import type { CPPT, CPPTFormat, CreateCPPTInput } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  ClipboardCheck,
  User,
  UserCheck,
  Heart,
  Thermometer,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CPPTFormProps {
  visitId: number;
  readOnly?: boolean;
  externalData?: CPPT[];
  useExternalData?: boolean;
  /** Options for the set-creator / set-approver dropdowns (rm-duplicate mode) */
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (cpptId: number, name: string) => void;
  onSetApprovedBy?: (cpptId: number, name: string) => void;
}

type CPPTFormatFieldKey = "subjective" | "objective" | "assessment" | "plan";

type CPPTFormatMeta = {
  shortLabel: string;
  summaryPrefix: Record<CPPTFormatFieldKey, string>;
  fieldLabel: Record<CPPTFormatFieldKey, string>;
  placeholder: Record<CPPTFormatFieldKey, string>;
};

const CPPT_FORMAT_META: Record<CPPTFormat, CPPTFormatMeta> = {
  soap: {
    shortLabel: "SOAP",
    summaryPrefix: { subjective: "S", objective: "O", assessment: "A", plan: "P" },
    fieldLabel: {
      subjective: "S - Subjektif (Keluhan)",
      objective: "O - Objektif (Pemeriksaan)",
      assessment: "A - Asesmen (Diagnosis)",
      plan: "P - Plan (Rencana)",
    },
    placeholder: {
      subjective: "Keluhan yang dirasakan pasien...",
      objective: "Hasil pemeriksaan fisik, vital sign, lab...",
      assessment: "Diagnosis atau masalah keperawatan...",
      plan: "Rencana tindakan atau terapi...",
    },
  },
  sbar: {
    shortLabel: "SBAR",
    summaryPrefix: { subjective: "S", objective: "B", assessment: "A", plan: "R" },
    fieldLabel: {
      subjective: "S - Situation",
      objective: "B - Background",
      assessment: "A - Assessment",
      plan: "R - Recommendation",
    },
    placeholder: {
      subjective: "Kondisi pasien saat ini yang perlu disampaikan...",
      objective: "Latar belakang klinis yang relevan...",
      assessment: "Penilaian klinis saat ini...",
      plan: "Rekomendasi/tindak lanjut yang diminta...",
    },
  },
  tbak: {
    shortLabel: "TBAK",
    summaryPrefix: { subjective: "T", objective: "B", assessment: "A", plan: "K" },
    fieldLabel: {
      subjective: "T - Tulis",
      objective: "B - Baca Kembali",
      assessment: "A - Analisis",
      plan: "K - Konfirmasi",
    },
    placeholder: {
      subjective: "Pesan/instruksi yang ditulis dengan jelas...",
      objective: "Hasil baca ulang pesan oleh penerima...",
      assessment: "Analisis kesesuaian pesan dengan kondisi pasien...",
      plan: "Konfirmasi akhir tindakan/instruksi...",
    },
  },
};

const normalizeCPPTFormat = (value?: string): CPPTFormat => {
  if (value === "sbar" || value === "tbak") {
    return value;
  }
  return "soap";
};

const getCPPTFormatMeta = (value?: string): CPPTFormatMeta => {
  return CPPT_FORMAT_META[normalizeCPPTFormat(value)];
};

// Collapsible Row Component for CPPT
function CPPTCollapsibleRow({
  cppt,
  canVerify,
  canEdit,
  canDelete,
  onVerify,
  onEdit,
  onDelete,
  getProfessionColor,
  staffOptions,
  onSetCreatedBy,
  onSetApprovedBy,
}: {
  cppt: CPPT;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onVerify: (id: number) => void;
  onEdit: (cppt: CPPT) => void;
  onDelete: (id: number) => void;
  getProfessionColor: (profession: string) => string;
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (cpptId: number, name: string) => void;
  onSetApprovedBy?: (cpptId: number, name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // State for staff-picker modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState<"pembuat" | "approval">("pembuat");
  const [staffSearch, setStaffSearch] = useState("");

  const openStaffModal = (mode: "pembuat" | "approval") => {
    setStaffModalMode(mode);
    setStaffSearch("");
    setStaffModalOpen(true);
  };

  const handlePickStaff = (name: string) => {
    if (staffModalMode === "pembuat") onSetCreatedBy?.(cppt.id, name);
    else onSetApprovedBy?.(cppt.id, name);
    setStaffModalOpen(false);
  };

  const filteredStaff = (staffOptions || []).filter((s) =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()),
  );

  const formatMeta = getCPPTFormatMeta(cppt.cppt_format);

  // Get summary of CPPT fields according to selected format
  const getCPPTSummary = () => {
    const parts = [];
    if (cppt.subjective) {
      parts.push(
        `${formatMeta.summaryPrefix.subjective}: ${cppt.subjective.substring(0, 30)}${cppt.subjective.length > 30 ? "..." : ""}`,
      );
    }
    if (cppt.objective) {
      parts.push(
        `${formatMeta.summaryPrefix.objective}: ${cppt.objective.substring(0, 30)}${cppt.objective.length > 30 ? "..." : ""}`,
      );
    }
    if (cppt.assessment) {
      parts.push(
        `${formatMeta.summaryPrefix.assessment}: ${cppt.assessment.substring(0, 30)}${cppt.assessment.length > 30 ? "..." : ""}`,
      );
    }
    return parts.join(" | ") || "-";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="hover:bg-muted/30">
        {/* Table Row */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
          <div className="col-span-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col">
              <span className="font-medium">{format(new Date(cppt.record_date), "dd MMM yyyy", { locale: idLocale })}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(cppt.record_date), "HH:mm")}</span>
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col gap-1">
              <Badge className={getProfessionColor(cppt.profession)}>
                {getCPPTProfessionLabel(cppt.profession)}
              </Badge>
              <Badge variant="outline" className="w-fit text-[10px] uppercase">
                {formatMeta.shortLabel}
              </Badge>
            </div>
          </div>
          <div className="col-span-4">
            <p className="text-xs text-muted-foreground truncate">{getCPPTSummary()}</p>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col gap-0.5">
              {/* In rm-duplicate mode: show Selesai + names when both are set */}
              {(onSetCreatedBy || onSetApprovedBy) ? (
                <>
                  {(cppt.created_by?.full_name || cppt.verified_by?.full_name) ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Selesai
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground w-fit">Pending</Badge>
                  )}
                  <div className="text-[10px] text-muted-foreground truncate">
                    {cppt.created_by?.full_name && <span>Pembuat: {cppt.created_by.full_name}</span>}
                    {cppt.verified_by?.full_name && <span className="ml-1">• Approval: {cppt.verified_by.full_name}</span>}
                  </div>
                </>
              ) : (
                <>
                  {cppt.is_verified ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground w-fit">Pending</Badge>
                  )}
                  <div className="text-[10px] text-muted-foreground truncate">
                    {cppt.created_by && <span>{cppt.created_by.full_name}</span>}
                    {cppt.is_verified && cppt.verified_by && <span className="ml-1">• {cppt.verified_by.full_name}</span>}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="col-span-1 flex items-center gap-1">
            {/* Standard (non-duplicate) action buttons */}
            {canVerify && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => onVerify(cppt.id)}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canEdit && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cppt)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(cppt.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {/* RM-duplicate mode: set Pembuat and Approval via modal */}
            {onSetCreatedBy && staffOptions && staffOptions.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Set Pembuat" onClick={() => openStaffModal("pembuat")}>
                <User className="h-4 w-4" />
              </Button>
            )}
            {onSetApprovedBy && staffOptions && staffOptions.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Set Approval" onClick={() => openStaffModal("approval")}>
                <UserCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Staff Picker Modal */}
        <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {staffModalMode === "pembuat" ? "Pilih Pembuat" : "Pilih Approval"}
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Cari nama..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y rounded-md border">
              {filteredStaff.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada hasil</p>
              ) : (
                filteredStaff.map((s) => (
                  <button
                    key={s.id}
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => handlePickStaff(s.name)}
                  >
                    {s.name}
                  </button>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStaffModalOpen(false)}>Batal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 ml-8 mr-4">
            {/* CPPT content by selected format */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {cppt.subjective && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">{formatMeta.fieldLabel.subjective}</p>
                  <p className="whitespace-pre-wrap">{cppt.subjective}</p>
                </div>
              )}
              {cppt.objective && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">{formatMeta.fieldLabel.objective}</p>
                  <p className="whitespace-pre-wrap">{cppt.objective}</p>
                </div>
              )}
              {cppt.assessment && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">{formatMeta.fieldLabel.assessment}</p>
                  <p className="whitespace-pre-wrap">{cppt.assessment}</p>
                </div>
              )}
              {cppt.plan && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium text-foreground mb-1">{formatMeta.fieldLabel.plan}</p>
                  <p className="whitespace-pre-wrap">{cppt.plan}</p>
                </div>
              )}
            </div>

            {/* Vital Signs */}
            {(cppt.blood_pressure || cppt.heart_rate || cppt.temperature || cppt.oxygen_saturation) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {cppt.blood_pressure && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Activity className="h-3 w-3" /> TD: {cppt.blood_pressure} mmHg
                  </span>
                )}
                {cppt.heart_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Heart className="h-3 w-3" /> HR: {cppt.heart_rate} x/mnt
                  </span>
                ) : null}
                {cppt.respiratory_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    RR: {cppt.respiratory_rate} x/mnt
                  </span>
                ) : null}
                {cppt.temperature && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Thermometer className="h-3 w-3" /> T: {cppt.temperature}°C
                  </span>
                )}
                {cppt.oxygen_saturation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    SpO2: {cppt.oxygen_saturation}%
                  </span>
                ) : null}
                {cppt.pain_scale ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    Nyeri: {cppt.pain_scale}/10
                  </span>
                ) : null}
              </div>
            )}

            {/* Instruction */}
            {cppt.instruction && (
              <div className="mt-3 p-2 bg-muted/50 rounded border">
                <p className="text-xs font-medium text-muted-foreground">Instruksi:</p>
                <p className="text-sm">{cppt.instruction}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {cppt.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Dicatat: {cppt.created_by.full_name}
                </span>
              )}
              {cppt.is_verified && cppt.verified_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Diverifikasi: {cppt.verified_by.full_name}
                </span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const defaultFormData: CreateCPPTInput = {
  record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  profession: "dokter",
  cppt_format: "soap",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  instruction: "",
  blood_pressure: "",
  heart_rate: 0,
  respiratory_rate: 0,
  temperature: "",
  oxygen_saturation: 0,
  pain_scale: 0,
};

export function CPPTForm({
  visitId,
  readOnly = false,
  externalData,
  useExternalData = false,
  staffOptions,
  onSetCreatedBy,
  onSetApprovedBy,
}: CPPTFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cppts, setCppts] = useState<CPPT[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateCPPTInput>(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator("cppt", `${cppts.length}`);
  }, [cppts.length, loading]);
  const [cpptToDelete, setCpptToDelete] = useState<number | null>(null);

  // Permissions
  const canCreate = hasPermission("medical_records.cppt") && !readOnly;
  const canEdit = hasPermission("medical_records.cppt") && !readOnly;
  const canDelete = hasPermission("medical_records.cppt") && !readOnly;
  const canVerify = hasPermission("medical_records.cppt") && !readOnly;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    if (useExternalData) {
      setCppts(externalData || []);
      setLoading(false);
      return;
    }
    try {
      const res = await cpptApi.getAll(visitId);
      setCppts(res.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data CPPT",
      });
    } finally {
      setLoading(false);
    }
  }, [externalData, useExternalData, visitId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (cppt: CPPT) => {
    if (cppt.is_verified) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "CPPT yang sudah diverifikasi tidak dapat diubah",
      });
      return;
    }
    setEditingId(cppt.id);
    setFormData({
      record_date: format(new Date(cppt.record_date), "yyyy-MM-dd'T'HH:mm"),
      profession: cppt.profession,
      cppt_format: normalizeCPPTFormat(cppt.cppt_format),
      subjective: cppt.subjective || "",
      objective: cppt.objective || "",
      assessment: cppt.assessment || "",
      plan: cppt.plan || "",
      instruction: cppt.instruction || "",
      blood_pressure: cppt.blood_pressure || "",
      heart_rate: cppt.heart_rate || 0,
      respiratory_rate: cppt.respiratory_rate || 0,
      temperature: cppt.temperature || "",
      oxygen_saturation: cppt.oxygen_saturation || 0,
      pain_scale: cppt.pain_scale || 0,
    });
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateCPPTInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save
  const handleSave = async () => {
    if (!formData.profession) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Profesi harus dipilih",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: CreateCPPTInput = {
        ...formData,
        cppt_format: normalizeCPPTFormat(formData.cppt_format),
      };

      if (editingId) {
        await cpptApi.update(visitId, editingId, payload);
        toast({
          title: "Berhasil",
          description: "CPPT berhasil diperbarui",
        });
      } else {
        await cpptApi.create(visitId, payload);
        toast({
          title: "Berhasil",
          description: "CPPT berhasil ditambahkan",
        });
      }
      setIsModalOpen(false);
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan CPPT",
      });
    } finally {
      setSaving(false);
    }
  };

  // Verify
  const handleVerify = async (cpptId: number) => {
    try {
      await cpptApi.verify(visitId, cpptId);
      toast({
        title: "Berhasil",
        description: "CPPT berhasil diverifikasi",
      });
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memverifikasi CPPT",
      });
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!cpptToDelete) return;

    try {
      await cpptApi.delete(visitId, cpptToDelete);
      toast({
        title: "Berhasil",
        description: "CPPT berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      setCpptToDelete(null);
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus CPPT",
      });
    }
  };

  // Get profession badge color
  const getProfessionColor = (_profession: string) => {
    return "bg-muted text-muted-foreground";
  };

  const selectedFormatMeta = getCPPTFormatMeta(formData.cppt_format);

  if (loading) {
    return (
      <div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Catatan CPPT</p>
                <p className="text-xs text-muted-foreground">Total catatan: {cppts.length}</p>
              </div>
              {canCreate && !readOnly && (
                <Button onClick={handleOpenCreate} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah CPPT
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Daftar CPPT
            </div>
            {cppts.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Tanggal/Waktu</div>
                  <div className="col-span-2">Profesi</div>
                  <div className="col-span-4">Ringkasan CPPT</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1">Aksi</div>
                </div>
                <div className="divide-y">
                  {cppts.map((cppt) => (
                    <CPPTCollapsibleRow
                      key={cppt.id}
                      cppt={cppt}
                      canVerify={canVerify}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onVerify={handleVerify}
                      onEdit={handleOpenEdit}
                      onDelete={(id) => {
                        setCpptToDelete(id);
                        setDeleteDialogOpen(true);
                      }}
                      getProfessionColor={getProfessionColor}
                      staffOptions={staffOptions}
                      onSetCreatedBy={onSetCreatedBy}
                      onSetApprovedBy={onSetApprovedBy}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan CPPT</p>
                <p className="text-sm mt-1">
                  {readOnly
                    ? "Belum ada catatan CPPT pada RM duplikat."
                    : 'Klik "Tambah CPPT" untuk menambahkan catatan perkembangan.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal - Fullscreen */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-full w-full h-screen max-h-screen flex flex-col p-0 gap-0 rounded-none">
          <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {editingId ? "Edit CPPT" : "Tambah CPPT Baru"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="grid gap-4 pb-4">
              {/* Row 1 - Date, Profession, Format */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal & Waktu</Label>
                  <Input
                    type="datetime-local"
                    value={formData.record_date}
                    onChange={(e) => handleChange("record_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profesi</Label>
                  <Select
                    value={formData.profession}
                    onValueChange={(v) => handleChange("profession", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih profesi" />
                    </SelectTrigger>
                    <SelectContent>
                      {CPPT_PROFESSIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format CPPT</Label>
                  <Select
                    value={normalizeCPPTFormat(formData.cppt_format)}
                    onValueChange={(v) => handleChange("cppt_format", v as CPPTFormat)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih format" />
                    </SelectTrigger>
                    <SelectContent>
                      {CPPT_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CPPT fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{selectedFormatMeta.fieldLabel.subjective}</Label>
                  <Textarea
                    value={formData.subjective}
                    onChange={(e) => handleChange("subjective", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.subjective}
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{selectedFormatMeta.fieldLabel.objective}</Label>
                  <Textarea
                    value={formData.objective}
                    onChange={(e) => handleChange("objective", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.objective}
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{selectedFormatMeta.fieldLabel.assessment}</Label>
                  <Textarea
                    value={formData.assessment}
                    onChange={(e) => handleChange("assessment", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.assessment}
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{selectedFormatMeta.fieldLabel.plan}</Label>
                  <Textarea
                    value={formData.plan}
                    onChange={(e) => handleChange("plan", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.plan}
                    rows={6}
                  />
                </div>
              </div>

            {/* Vital Signs */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium mb-3 block">Tanda Vital (Opsional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">TD (mmHg)</Label>
                  <Input
                    value={formData.blood_pressure}
                    onChange={(e) => handleChange("blood_pressure", e.target.value)}
                    placeholder="120/80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HR (x/mnt)</Label>
                  <Input
                    type="number"
                    value={formData.heart_rate || ""}
                    onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">RR (x/mnt)</Label>
                  <Input
                    type="number"
                    value={formData.respiratory_rate || ""}
                    onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                    placeholder="18"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Suhu (°C)</Label>
                  <Input
                    value={formData.temperature}
                    onChange={(e) => handleChange("temperature", e.target.value)}
                    placeholder="36.5"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SpO2 (%)</Label>
                  <Input
                    type="number"
                    value={formData.oxygen_saturation || ""}
                    onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                    placeholder="98"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nyeri (0-10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.pain_scale || ""}
                    onChange={(e) => handleChange("pain_scale", parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Instruction */}
            <div className="space-y-2">
              <Label>Instruksi Khusus</Label>
              <Textarea
                value={formData.instruction}
                onChange={(e) => handleChange("instruction", e.target.value)}
                placeholder="Instruksi khusus untuk perawatan pasien..."
                rows={2}
              />
            </div>
          </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-muted/50 shrink-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus CPPT?</AlertDialogTitle>
            <AlertDialogDescription>
              Data CPPT ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
