import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import {
  DialogDescription,
} from "@/components/ui/dialog";
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
  FileText,
  X,
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
    <tbody className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors align-middle">
        <td className="px-3 py-2.5 w-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="font-mono font-medium text-foreground">
            {format(new Date(cppt.record_date), "dd MMM yyyy", { locale: idLocale })}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {format(new Date(cppt.record_date), "HH:mm")}
          </div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex flex-wrap items-center gap-1">
            <Badge className={cn("rounded-none text-[10px] h-5 px-1.5 font-medium", getProfessionColor(cppt.profession))}>
              {getCPPTProfessionLabel(cppt.profession)}
            </Badge>
            <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono uppercase">
              {formatMeta.shortLabel}
            </Badge>
          </div>
        </td>
        <td className="px-3 py-2.5 max-w-[320px]">
          <p className="text-xs text-muted-foreground truncate">{getCPPTSummary()}</p>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            {(onSetCreatedBy || onSetApprovedBy) ? (
              <>
                {(cppt.created_by?.full_name || cppt.verified_by?.full_name) ? (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40 w-fit">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Selesai
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 text-muted-foreground w-fit">
                    Pending
                  </Badge>
                )}
                <div className="text-[10px] text-muted-foreground truncate">
                  {cppt.created_by?.full_name && <span>Pembuat: {cppt.created_by.full_name}</span>}
                  {cppt.verified_by?.full_name && <span className="ml-1">• Approval: {cppt.verified_by.full_name}</span>}
                </div>
              </>
            ) : (
              <>
                {cppt.is_verified ? (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40 w-fit">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 text-muted-foreground w-fit">
                    Pending
                  </Badge>
                )}
                <div className="text-[10px] text-muted-foreground truncate">
                  {cppt.created_by && <span>{cppt.created_by.full_name}</span>}
                  {cppt.is_verified && cppt.verified_by && <span className="ml-1">• {cppt.verified_by.full_name}</span>}
                </div>
              </>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            {canVerify && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-emerald-600 hover:bg-emerald-50" title="Verifikasi" onClick={() => onVerify(cppt.id)}>
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" title="Edit" onClick={() => onEdit(cppt)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && !cppt.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-destructive hover:bg-destructive/10" title="Hapus" onClick={() => onDelete(cppt.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onSetCreatedBy && staffOptions && staffOptions.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" title="Set Pembuat" onClick={() => openStaffModal("pembuat")}>
                <User className="h-3.5 w-3.5" />
              </Button>
            )}
            {onSetApprovedBy && staffOptions && staffOptions.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" title="Set Approval" onClick={() => openStaffModal("approval")}>
                <UserCheck className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
            <DialogContent className="max-w-sm rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-row items-center gap-2.5 space-y-0 text-left">
                <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                  {staffModalMode === "pembuat" ? <User className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                    {staffModalMode === "pembuat" ? "Pilih Pembuat" : "Pilih Approval"}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Pilih petugas penanggung jawab CPPT ini.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 text-xs rounded-none"
                    placeholder="Cari nama..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                  {filteredStaff.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Tidak ada hasil</p>
                  ) : (
                    filteredStaff.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
                        onClick={() => handlePickStaff(s.name)}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-none text-xs" onClick={() => setStaffModalOpen(false)}>
                  Batal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-neutral-50/30 dark:bg-neutral-900/20">
          <td colSpan={6} className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {cppt.subjective && (
                <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-background p-3">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    {formatMeta.fieldLabel.subjective}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">{cppt.subjective}</p>
                </div>
              )}
              {cppt.objective && (
                <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-background p-3">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    {formatMeta.fieldLabel.objective}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">{cppt.objective}</p>
                </div>
              )}
              {cppt.assessment && (
                <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-background p-3">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    {formatMeta.fieldLabel.assessment}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">{cppt.assessment}</p>
                </div>
              )}
              {cppt.plan && (
                <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-background p-3">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    {formatMeta.fieldLabel.plan}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">{cppt.plan}</p>
                </div>
              )}
            </div>

            {(cppt.blood_pressure || cppt.heart_rate || cppt.temperature || cppt.oxygen_saturation || cppt.respiratory_rate || cppt.pain_scale) && (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                {cppt.blood_pressure && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Activity className="h-3 w-3 text-muted-foreground" /> TD: {cppt.blood_pressure} mmHg
                  </span>
                )}
                {cppt.heart_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Heart className="h-3 w-3 text-muted-foreground" /> HR: {cppt.heart_rate} x/mnt
                  </span>
                ) : null}
                {cppt.respiratory_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    RR: {cppt.respiratory_rate} x/mnt
                  </span>
                ) : null}
                {cppt.temperature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Thermometer className="h-3 w-3 text-muted-foreground" /> T: {cppt.temperature}°C
                  </span>
                )}
                {cppt.oxygen_saturation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    SpO2: {cppt.oxygen_saturation}%
                  </span>
                ) : null}
                {cppt.pain_scale ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    Nyeri: {cppt.pain_scale}/10
                  </span>
                ) : null}
              </div>
            )}

            {cppt.instruction && (
              <div className="p-2.5 border border-neutral-200 dark:border-neutral-800 bg-background text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Instruksi Khusus: </span>
                <span className="text-foreground">{cppt.instruction}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              {cppt.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Dicatat: {cppt.created_by.full_name}
                </span>
              )}
              {cppt.is_verified && cppt.verified_by && (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Diverifikasi: {cppt.verified_by.full_name}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
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
  const canCreate = hasPermission("medical_records.cppt") && !readOnly && !useExternalData;
  const canEdit = hasPermission("medical_records.cppt") && !readOnly && !useExternalData;
  const canDelete = hasPermission("medical_records.cppt") && !readOnly && !useExternalData;
  const canVerify = hasPermission("medical_records.cppt") && !readOnly && !useExternalData;

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
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      {/* Header Section */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Catatan Perkembangan Pasien Terintegrasi (CPPT)
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dokumentasi perkembangan klinis terintegrasi antar profesi (SOAP, SBAR, TBAK).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {cppts.length} catatan
          </span>
          {canCreate && !readOnly && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah CPPT
            </Button>
          )}
        </div>
      </div>

      {/* Table / Empty Section */}
      <div className="p-4 sm:p-5">
        {cppts.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Tanggal/Waktu</th>
                  <th className="px-3 py-2 text-left">Profesi</th>
                  <th className="px-3 py-2 text-left">Ringkasan CPPT</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="w-28 px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
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
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ClipboardCheck className="h-4 w-4 opacity-60 shrink-0" />
            <span>
              {readOnly
                ? "Belum ada catatan CPPT pada RM duplikat."
                : "Belum ada catatan CPPT — klik Tambah CPPT untuk mulai mencatat perkembangan."}
            </span>
          </div>
        )}
      </div>

      {/* Create/Edit Modal - Fullscreen Monolithic */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !gap-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 sm:px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5 text-left">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {editingId ? "Edit Catatan CPPT" : "Tambah Catatan CPPT"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Lengkapi waktu, profesi, format catatan, tanda vital, dan instruksi khusus.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(false)}
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
            {/* Row 1 - Date, Profession, Format */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 px-4 py-3 bg-neutral-50/40 dark:bg-neutral-900/20">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tanggal & Waktu</Label>
                <Input
                  type="datetime-local"
                  value={formData.record_date}
                  onChange={(e) => handleChange("record_date", e.target.value)}
                  className="rounded-none h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Profesi</Label>
                <Select
                  value={formData.profession}
                  onValueChange={(v) => handleChange("profession", v)}
                >
                  <SelectTrigger className="rounded-none h-9 text-xs">
                    <SelectValue placeholder="Pilih profesi" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {CPPT_PROFESSIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Format CPPT</Label>
                <Select
                  value={normalizeCPPTFormat(formData.cppt_format)}
                  onValueChange={(v) => handleChange("cppt_format", v as CPPTFormat)}
                >
                  <SelectTrigger className="rounded-none h-9 text-xs">
                    <SelectValue placeholder="Pilih format" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {CPPT_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CPPT fields - flexible height, flat edge-to-edge */}
            <div className="flex-1 flex flex-col min-h-[260px]">
              <div className="bg-neutral-50 dark:bg-neutral-900 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Rincian Catatan ({selectedFormatMeta.shortLabel})
                </span>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div className="bg-background p-3.5 flex flex-col space-y-1.5">
                  <Label className="text-xs font-medium shrink-0">{selectedFormatMeta.fieldLabel.subjective}</Label>
                  <Textarea
                    value={formData.subjective}
                    onChange={(e) => handleChange("subjective", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.subjective}
                    className="flex-1 rounded-none resize-none text-xs"
                  />
                </div>
                <div className="bg-background p-3.5 flex flex-col space-y-1.5">
                  <Label className="text-xs font-medium shrink-0">{selectedFormatMeta.fieldLabel.objective}</Label>
                  <Textarea
                    value={formData.objective}
                    onChange={(e) => handleChange("objective", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.objective}
                    className="flex-1 rounded-none resize-none text-xs"
                  />
                </div>
                <div className="bg-background p-3.5 flex flex-col space-y-1.5">
                  <Label className="text-xs font-medium shrink-0">{selectedFormatMeta.fieldLabel.assessment}</Label>
                  <Textarea
                    value={formData.assessment}
                    onChange={(e) => handleChange("assessment", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.assessment}
                    className="flex-1 rounded-none resize-none text-xs"
                  />
                </div>
                <div className="bg-background p-3.5 flex flex-col space-y-1.5">
                  <Label className="text-xs font-medium shrink-0">{selectedFormatMeta.fieldLabel.plan}</Label>
                  <Textarea
                    value={formData.plan}
                    onChange={(e) => handleChange("plan", e.target.value)}
                    placeholder={selectedFormatMeta.placeholder.plan}
                    className="flex-1 rounded-none resize-none text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Vital Signs & Instruction - flat split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-y lg:divide-y-0 divide-neutral-200 dark:divide-neutral-800 shrink-0">
              <div className="lg:col-span-8 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 border-l-2 border-neutral-900 dark:border-neutral-100 pl-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Tanda Vital
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">TD (mmHg)</Label>
                    <Input
                      value={formData.blood_pressure}
                      onChange={(e) => handleChange("blood_pressure", e.target.value)}
                      placeholder="120/80"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">HR (x/mnt)</Label>
                    <Input
                      type="number"
                      value={formData.heart_rate || ""}
                      onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                      placeholder="80"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">RR (x/mnt)</Label>
                    <Input
                      type="number"
                      value={formData.respiratory_rate || ""}
                      onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                      placeholder="18"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Suhu (°C)</Label>
                    <Input
                      value={formData.temperature}
                      onChange={(e) => handleChange("temperature", e.target.value)}
                      placeholder="36.5"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">SpO2 (%)</Label>
                    <Input
                      type="number"
                      value={formData.oxygen_saturation || ""}
                      onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                      placeholder="98"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Nyeri (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={formData.pain_scale || ""}
                      onChange={(e) => handleChange("pain_scale", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="rounded-none h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 p-3.5 flex flex-col space-y-2">
                <div className="flex items-center gap-2 border-l-2 border-neutral-900 dark:border-neutral-100 pl-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Instruksi Khusus
                  </span>
                </div>
                <Textarea
                  value={formData.instruction}
                  onChange={(e) => handleChange("instruction", e.target.value)}
                  placeholder="Ketik instruksi khusus..."
                  className="flex-1 min-h-[68px] rounded-none resize-none text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="h-8 rounded-none text-xs px-4">
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-8 rounded-none text-xs px-4 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
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
        <AlertDialogContent className="rounded-none border-neutral-200 dark:border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold uppercase tracking-tight">
              Hapus CPPT?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Data CPPT ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 rounded-none text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-none text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
