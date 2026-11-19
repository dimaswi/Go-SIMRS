import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  nursingCareApi,
  SHIFT_TYPES,
  OUTCOME_TARGETS,
  PROBLEM_STATUS,
  getShiftTypeLabel,
  getProblemStatusLabel,
  getProblemStatusColor,
} from "@/lib/api";
import type { NursingCare, CreateNursingCareInput } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  HeartPulse,
  User,
  Heart,
  Thermometer,
  Activity,
  ShieldCheck,
  FileText,
  Target,
  ClipboardList,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import nursingMasterRaw from "@/master-data/nursing/sdki-slki-siki.master.json?raw";

interface NursingCareFormProps {
  visitId: number;
  readOnly?: boolean;
  externalData?: NursingCare[];
  useExternalData?: boolean;
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (id: number, name: string) => void;
  onSetApprovedBy?: (id: number, name: string) => void;
}

interface NursingMasterItem {
  sdki: {
    code: string;
    label: string;
    definisi?: string;
    fisiologis?: string[];
    situasional?: string[];
    gejala_tanda?: {
      mayor?: {
        subjektif?: string[];
        objektif?: string[];
      };
      minor?: {
        subjektif?: string[];
        objektif?: string[];
      };
    };
  };
  slki?: {
    luaran_utama?: string[];
    luaran_tambahan?: string[];
  };
  siki?: {
    intervensi_utama?: string[];
    intervensi_pendukung?: string[];
  };
}

const normalizeSdkiCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

const toMultilineText = (title: string, values: string[] = []) => {
  if (values.length === 0) return "";
  return `${title}:\n${values.join("\n")}`;
};

const parsedNursingMasterItems: NursingMasterItem[] = (() => {
  try {
    const parsed = JSON.parse(nursingMasterRaw) as { items?: NursingMasterItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
})();

// Collapsible Row Component for Nursing Care
function NursingCareCollapsibleRow({
  record,
  canVerify,
  canEdit,
  canDelete,
  onVerify,
  onEdit,
  onDelete,
  staffOptions,
  onSetCreatedBy,
  onSetApprovedBy,
}: {
  record: NursingCare;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onVerify: (id: number) => void;
  onEdit: (record: NursingCare) => void;
  onDelete: (id: number) => void;
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (id: number, name: string) => void;
  onSetApprovedBy?: (id: number, name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState<"pembuat" | "approval">("pembuat");
  const [staffSearch, setStaffSearch] = useState("");

  const openStaffModal = (mode: "pembuat" | "approval") => {
    setStaffModalMode(mode);
    setStaffSearch("");
    setStaffModalOpen(true);
  };

  const handlePickStaff = (name: string) => {
    if (staffModalMode === "pembuat") onSetCreatedBy?.(record.id, name);
    else onSetApprovedBy?.(record.id, name);
    setStaffModalOpen(false);
  };

  const filteredStaff = (staffOptions || []).filter((s) =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()),
  );

  // Get summary of nursing diagnosis
  const getDiagnosisSummary = () => {
    if (record.nursing_diagnosis) {
      return record.nursing_diagnosis.substring(0, 50) + (record.nursing_diagnosis.length > 50 ? '...' : '');
    }
    return '-';
  };

  const countNumberedItems = (text?: string) => {
    if (!text) return 0;
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[\.)]/.test(line)).length;
  };

  const slkiCount = countNumberedItems(record.nursing_outcome);
  const sikiCount = countNumberedItems(record.nursing_intervention);

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
            {format(new Date(record.record_date), "dd MMM yyyy", { locale: idLocale })}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {format(new Date(record.record_date), "HH:mm")}
          </div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {record.shift_type ? (
            <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40">
              {getShiftTypeLabel(record.shift_type)}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className="px-3 py-2.5 max-w-[320px]">
          <p className="text-xs font-medium text-foreground truncate">{getDiagnosisSummary()}</p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {record.nursing_diagnosis_code && (
              <Badge variant="outline" className="rounded-none h-4 px-1.5 text-[10px] font-mono">
                {record.nursing_diagnosis_code}
              </Badge>
            )}
            {slkiCount > 0 && (
              <Badge variant="outline" className="rounded-none h-4 px-1.5 text-[10px] font-mono">
                SLKI {slkiCount}
              </Badge>
            )}
            {sikiCount > 0 && (
              <Badge variant="outline" className="rounded-none h-4 px-1.5 text-[10px] font-mono">
                SIKI {sikiCount}
              </Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              {record.problem_status && record.problem_status !== "-" ? (
                <Badge className={cn("rounded-none text-[10px] h-5 px-1.5", getProblemStatusColor(record.problem_status))}>
                  {getProblemStatusLabel(record.problem_status)}
                </Badge>
              ) : null}
              {record.is_verified && (
                <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40">
                  <ShieldCheck className="h-3 w-3" />
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {record.created_by && <span>{record.created_by.full_name}</span>}
              {record.is_verified && record.verified_by && <span className="ml-1">• {record.verified_by.full_name}</span>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            {canVerify && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-emerald-600 hover:bg-emerald-50" title="Verifikasi" onClick={() => onVerify(record.id)}>
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" title="Edit" onClick={() => onEdit(record)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-destructive hover:bg-destructive/10" title="Hapus" onClick={() => onDelete(record.id)}>
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
                    Pilih perawat atau petugas penanggung jawab asuhan ini.
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 text-xs">
              <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-blue-600 bg-background p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                    <FileText className="h-3.5 w-3.5 text-blue-600" /> SDKI
                  </p>
                  {record.nursing_diagnosis_code && (
                    <Badge variant="outline" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                      {record.nursing_diagnosis_code}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Diagnosis Keperawatan</p>
                  <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-foreground">
                    {record.nursing_diagnosis || "-"}
                  </div>
                </div>
                {record.problem_etiology && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Etiologi</p>
                    <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {record.problem_etiology}
                    </div>
                  </div>
                )}
                {record.signs_symptoms && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanda dan Gejala</p>
                    <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {record.signs_symptoms}
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-emerald-600 bg-background p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                    <Target className="h-3.5 w-3.5 text-emerald-600" /> SLKI
                  </p>
                  <Badge variant="outline" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                    Item {slkiCount || 0}
                  </Badge>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Luaran Keperawatan</p>
                  <div className="max-h-[220px] overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-foreground">
                    {record.nursing_outcome || "-"}
                  </div>
                </div>
                {record.outcome_target && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 p-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Target:</strong> {record.outcome_target}
                  </div>
                )}
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-amber-600 bg-background p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                    <ClipboardList className="h-3.5 w-3.5 text-amber-600" /> SIKI
                  </p>
                  <Badge variant="outline" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                    Item {sikiCount || 0}
                  </Badge>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Intervensi Keperawatan</p>
                  <div className="max-h-[250px] overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-foreground">
                    {record.nursing_intervention || "-"}
                  </div>
                </div>
              </div>

              {record.implementation && (
                <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-3 lg:col-span-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" /> Implementasi
                  </p>
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">{record.implementation}</p>
                  {record.patient_response && (
                    <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-neutral-200 dark:border-neutral-800">
                      <strong className="text-foreground">Respon:</strong> {record.patient_response}
                    </p>
                  )}
                </div>
              )}
            </div>

            {(record.evaluation_subjective || record.evaluation_objective || record.evaluation_analysis || record.evaluation_planning) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {record.evaluation_subjective && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-2.5">
                    <span className="font-bold font-mono text-[11px] text-muted-foreground">S:</span>
                    <p className="mt-0.5">{record.evaluation_subjective}</p>
                  </div>
                )}
                {record.evaluation_objective && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-2.5">
                    <span className="font-bold font-mono text-[11px] text-muted-foreground">O:</span>
                    <p className="mt-0.5">{record.evaluation_objective}</p>
                  </div>
                )}
                {record.evaluation_analysis && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-2.5">
                    <span className="font-bold font-mono text-[11px] text-muted-foreground">A:</span>
                    <p className="mt-0.5">{record.evaluation_analysis}</p>
                  </div>
                )}
                {record.evaluation_planning && (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-2.5">
                    <span className="font-bold font-mono text-[11px] text-muted-foreground">P:</span>
                    <p className="mt-0.5">{record.evaluation_planning}</p>
                  </div>
                )}
              </div>
            )}

            {(record.blood_pressure || record.heart_rate || record.temperature || record.oxygen_saturation || record.pain_scale) && (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                {record.blood_pressure && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Activity className="h-3 w-3 text-muted-foreground" /> TD: {record.blood_pressure} mmHg
                  </span>
                )}
                {record.heart_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Heart className="h-3 w-3 text-muted-foreground" /> HR: {record.heart_rate} x/mnt
                  </span>
                ) : null}
                {record.temperature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    <Thermometer className="h-3 w-3 text-muted-foreground" /> T: {record.temperature}°C
                  </span>
                )}
                {record.oxygen_saturation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    SpO2: {record.oxygen_saturation}%
                  </span>
                ) : null}
                {record.pain_scale ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-background">
                    Nyeri: {record.pain_scale}/10
                  </span>
                ) : null}
              </div>
            )}

            {record.notes && (
              <div className="p-2.5 border border-neutral-200 dark:border-neutral-800 bg-background text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Catatan: </span>
                <span className="text-foreground">{record.notes}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              {record.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Dicatat: {record.created_by.full_name}
                </span>
              )}
              {record.is_verified && record.verified_by && (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Diverifikasi: {record.verified_by.full_name}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

const defaultFormData: CreateNursingCareInput = {
  record_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  shift_type: "",
  chief_complaint: "",
  pain_assessment: "",
  pain_scale: 0,
  consciousness_level: "",
  functional_status: "",
  fall_risk_assessment: "",
  fall_risk_score: 0,
  nutrition_assessment: "",
  skin_assessment: "",
  pressure_ulcer_risk: "",
  blood_pressure: "",
  heart_rate: 0,
  respiratory_rate: 0,
  temperature: "",
  oxygen_saturation: 0,
  nursing_diagnosis: "",
  nursing_diagnosis_code: "",
  problem_etiology: "",
  signs_symptoms: "",
  nursing_outcome: "",
  nursing_outcome_code: "",
  outcome_indicators: "",
  outcome_target: "",
  nursing_intervention: "",
  nursing_intervention_code: "",
  observation_actions: "",
  therapeutic_actions: "",
  education_actions: "",
  collaboration_actions: "",
  implementation: "",
  implementation_time: "",
  patient_response: "",
  evaluation_subjective: "",
  evaluation_objective: "",
  evaluation_analysis: "",
  evaluation_planning: "",
  problem_status: "",
  notes: "",
};

export function NursingCareForm({
  visitId,
  readOnly = false,
  externalData,
  useExternalData = false,
  staffOptions,
  onSetCreatedBy,
  onSetApprovedBy,
}: NursingCareFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<NursingCare[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateNursingCareInput>(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nursingMasterItems] = useState<NursingMasterItem[]>(parsedNursingMasterItems);

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator("nursing-care", `${records.length}`);
  }, [loading, records.length]);
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null);
  const [activeFormTab, setActiveFormTab] = useState("pengkajian");

  // Permissions
  const canCreate = hasPermission("medical_records.nursing_care") && !readOnly && !useExternalData;
  const canEdit = hasPermission("medical_records.nursing_care") && !readOnly && !useExternalData;
  const canDelete = hasPermission("medical_records.nursing_care") && !readOnly && !useExternalData;
  const canVerify = hasPermission("medical_records.nursing_care") && !readOnly && !useExternalData;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    if (useExternalData) {
      setRecords(externalData || []);
      setLoading(false);
      return;
    }
    try {
      const res = await nursingCareApi.getAll(visitId);
      setRecords(res.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data asuhan keperawatan",
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
    setActiveFormTab("diagnosis");
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (record: NursingCare) => {
    if (record.is_verified) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Asuhan keperawatan yang sudah diverifikasi tidak dapat diubah",
      });
      return;
    }
    setEditingId(record.id);
    setFormData({
      record_date: format(new Date(record.record_date), "yyyy-MM-dd'T'HH:mm"),
      shift_type: record.shift_type || "",
      chief_complaint: record.chief_complaint || "",
      pain_assessment: record.pain_assessment || "",
      pain_scale: record.pain_scale || 0,
      consciousness_level: record.consciousness_level || "",
      functional_status: record.functional_status || "",
      fall_risk_assessment: record.fall_risk_assessment || "",
      fall_risk_score: record.fall_risk_score || 0,
      nutrition_assessment: record.nutrition_assessment || "",
      skin_assessment: record.skin_assessment || "",
      pressure_ulcer_risk: record.pressure_ulcer_risk || "",
      blood_pressure: record.blood_pressure || "",
      heart_rate: record.heart_rate || 0,
      respiratory_rate: record.respiratory_rate || 0,
      temperature: record.temperature || "",
      oxygen_saturation: record.oxygen_saturation || 0,
      nursing_diagnosis: record.nursing_diagnosis || "",
      nursing_diagnosis_code: record.nursing_diagnosis_code || "",
      problem_etiology: record.problem_etiology || "",
      signs_symptoms: record.signs_symptoms || "",
      nursing_outcome: record.nursing_outcome || "",
      nursing_outcome_code: record.nursing_outcome_code || "",
      outcome_indicators: record.outcome_indicators || "",
      outcome_target: record.outcome_target || "",
      nursing_intervention: record.nursing_intervention || "",
      nursing_intervention_code: record.nursing_intervention_code || "",
      observation_actions: record.observation_actions || "",
      therapeutic_actions: record.therapeutic_actions || "",
      education_actions: record.education_actions || "",
      collaboration_actions: record.collaboration_actions || "",
      implementation: record.implementation || "",
      implementation_time: record.implementation_time 
        ? format(new Date(record.implementation_time), "yyyy-MM-dd'T'HH:mm") 
        : "",
      patient_response: record.patient_response || "",
      evaluation_subjective: record.evaluation_subjective || "",
      evaluation_objective: record.evaluation_objective || "",
      evaluation_analysis: record.evaluation_analysis || "",
      evaluation_planning: record.evaluation_planning || "",
      problem_status: record.problem_status || "",
      notes: record.notes || "",
    });
    setActiveFormTab("diagnosis");
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateNursingCareInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyMasterSdki = (selectedCode: string) => {
    const selectedItem = nursingMasterItems.find(
      (item) => normalizeSdkiCode(item.sdki.code) === normalizeSdkiCode(selectedCode),
    );

    if (!selectedItem) return;

    const mayorSubjektif = selectedItem.sdki.gejala_tanda?.mayor?.subjektif ?? [];
    const mayorObjektif = selectedItem.sdki.gejala_tanda?.mayor?.objektif ?? [];
    const minorSubjektif = selectedItem.sdki.gejala_tanda?.minor?.subjektif ?? [];
    const minorObjektif = selectedItem.sdki.gejala_tanda?.minor?.objektif ?? [];

    const signsSymptomsText = [
      toMultilineText("Mayor Subjektif", mayorSubjektif),
      toMultilineText("Mayor Objektif", mayorObjektif),
      toMultilineText("Minor Subjektif", minorSubjektif),
      toMultilineText("Minor Objektif", minorObjektif),
    ]
      .filter(Boolean)
      .join("\n\n");

    const etiologyText = [
      toMultilineText("Fisiologis", selectedItem.sdki.fisiologis ?? []),
      toMultilineText("Situasional", selectedItem.sdki.situasional ?? []),
    ]
      .filter(Boolean)
      .join("\n\n");

    const outcomeText = [
      toMultilineText("Luaran Utama", selectedItem.slki?.luaran_utama ?? []),
      toMultilineText("Luaran Tambahan", selectedItem.slki?.luaran_tambahan ?? []),
    ]
      .filter(Boolean)
      .join("\n\n");

    const interventionText = [
      toMultilineText("Intervensi Utama", selectedItem.siki?.intervensi_utama ?? []),
      toMultilineText("Intervensi Pendukung", selectedItem.siki?.intervensi_pendukung ?? []),
    ]
      .filter(Boolean)
      .join("\n\n");

    setFormData((prev) => ({
      ...prev,
      nursing_diagnosis_code: selectedItem.sdki.code,
      nursing_diagnosis: selectedItem.sdki.label,
      nursing_outcome_code: "",
      nursing_intervention_code: "",
      problem_etiology: etiologyText || prev.problem_etiology,
      signs_symptoms: signsSymptomsText || prev.signs_symptoms,
      nursing_outcome: outcomeText || prev.nursing_outcome,
      nursing_intervention: interventionText || prev.nursing_intervention,
    }));
  };

  const currentMasterCode = nursingMasterItems.find(
    (item) => normalizeSdkiCode(item.sdki.code) === normalizeSdkiCode(formData.nursing_diagnosis_code || ""),
  )?.sdki.code;
  const selectedMasterItem = nursingMasterItems.find(
    (item) => normalizeSdkiCode(item.sdki.code) === normalizeSdkiCode(currentMasterCode || ""),
  );

  const nursingMasterOptions = useMemo(
    () =>
      nursingMasterItems.map((item) => ({
        value: item.sdki.code,
        label: `${item.sdki.code} - ${item.sdki.label}`,
      })),
    [nursingMasterItems]
  );


  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: CreateNursingCareInput = {
        ...formData,
        nursing_outcome_code: "",
        nursing_intervention_code: "",
      };

      if (editingId) {
        await nursingCareApi.update(visitId, editingId, payload);
        toast({
          title: "Berhasil",
          description: "Asuhan keperawatan berhasil diperbarui",
        });
      } else {
        await nursingCareApi.create(visitId, payload);
        toast({
          title: "Berhasil",
          description: "Asuhan keperawatan berhasil ditambahkan",
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
        description: error.response?.data?.error || "Gagal menyimpan asuhan keperawatan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Verify
  const handleVerify = async (recordId: number) => {
    try {
      await nursingCareApi.verify(visitId, recordId);
      toast({
        title: "Berhasil",
        description: "Asuhan keperawatan berhasil diverifikasi",
      });
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memverifikasi asuhan keperawatan",
      });
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!recordToDelete) return;

    try {
      await nursingCareApi.delete(visitId, recordToDelete);
      toast({
        title: "Berhasil",
        description: "Asuhan keperawatan berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus asuhan keperawatan",
      });
    }
  };

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
            Asuhan Keperawatan
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dokumentasi diagnosis (SDKI), luaran (SLKI), dan intervensi keperawatan (SIKI).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {records.length} catatan
          </span>
          {canCreate && !readOnly && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Asuhan
            </Button>
          )}
        </div>
      </div>

      {/* Table / Empty Section */}
      <div className="p-4 sm:p-5">
        {records.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Tanggal/Waktu</th>
                  <th className="px-3 py-2 text-left">Shift</th>
                  <th className="px-3 py-2 text-left">Diagnosis Keperawatan</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="w-28 px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              {records.map((record) => (
                <NursingCareCollapsibleRow
                  key={record.id}
                  record={record}
                  canVerify={canVerify}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onVerify={handleVerify}
                  onEdit={handleOpenEdit}
                  onDelete={(id) => {
                    setRecordToDelete(id);
                    setDeleteDialogOpen(true);
                  }}
                  staffOptions={staffOptions}
                  onSetCreatedBy={onSetCreatedBy}
                  onSetApprovedBy={onSetApprovedBy}
                />
              ))}
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <HeartPulse className="h-4 w-4 opacity-60 shrink-0" />
            <span>
              {readOnly
                ? "Belum ada catatan asuhan keperawatan pada RM duplikat."
                : "Belum ada catatan asuhan keperawatan — klik Tambah Asuhan untuk mulai mencatat."}
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
                <HeartPulse className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {editingId ? "Edit Asuhan Keperawatan" : "Tambah Asuhan Keperawatan Baru"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pilih diagnosis master SDKI untuk mengisi referensi luaran (SLKI) & intervensi (SIKI) secara otomatis.
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

          <div className="flex-1 flex flex-col overflow-y-auto">
            <Tabs value={activeFormTab} onValueChange={setActiveFormTab} className="flex-1 flex flex-col overflow-hidden gap-0 divide-y divide-neutral-200 dark:divide-neutral-800">
              {/* Top Section: Master Selection */}
              <div className="shrink-0 flex flex-wrap items-center gap-3 bg-neutral-50/40 dark:bg-neutral-900/20 px-4 py-2.5">
                <Label className="whitespace-nowrap text-xs font-medium">Pilih SDKI dari Master:</Label>
                <div className="w-full sm:w-[380px] [&_[role=combobox]]:h-9 [&_[role=combobox]]:rounded-none [&_[role=combobox]]:text-xs">
                  <Combobox
                    options={nursingMasterOptions}
                    value={currentMasterCode || ""}
                    onValueChange={(val) => handleApplyMasterSdki(val)}
                    placeholder="Pilih diagnosis SDKI..."
                    searchPlaceholder="Cari kode atau nama (mis. D.0001, napas)..."
                    emptyText="Diagnosis tidak ditemukan."
                    className="w-full"
                  />
                </div>
                {selectedMasterItem && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:ml-auto">
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] h-5 px-1.5">
                      SLKI: {(selectedMasterItem.slki?.luaran_utama || []).length} / {(selectedMasterItem.slki?.luaran_tambahan || []).length}
                    </Badge>
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] h-5 px-1.5">
                      SIKI: {(selectedMasterItem.siki?.intervensi_utama || []).length} / {(selectedMasterItem.siki?.intervensi_pendukung || []).length}
                    </Badge>
                  </div>
                )}
              </div>

              <TabsContent value="diagnosis" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col gap-0 divide-y divide-neutral-200 dark:divide-neutral-800 min-h-0">
                {/* Info Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 px-4 py-3 bg-background">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Waktu</Label>
                    <Input
                      type="datetime-local"
                      value={formData.record_date}
                      onChange={(e) => handleChange("record_date", e.target.value)}
                      className="h-9 text-xs rounded-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Shift</Label>
                    <Select value={formData.shift_type} onValueChange={(v) => handleChange("shift_type", v)}>
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue placeholder="Pilih shift" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {SHIFT_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Status Masalah</Label>
                    <Select value={formData.problem_status} onValueChange={(v) => handleChange("problem_status", v)}>
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {PROBLEM_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3 Columns Flat Split (no card inside card) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 divide-neutral-200 dark:divide-neutral-800 min-h-0">
                  {/* Column 1: SDKI */}
                  <div className="flex flex-col bg-background overflow-hidden">
                    <div className="bg-neutral-50 dark:bg-neutral-900 px-4 h-9 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                      <span className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                        SDKI (Diagnosis)
                      </span>
                      <span className="font-mono text-[11px] border border-neutral-200 dark:border-neutral-700 bg-background px-1.5 py-0.5 leading-none">
                        {formData.nursing_diagnosis_code || "D.----"}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                      <div className="flex flex-col shrink-0 space-y-1">
                        <Label className="text-xs font-medium">Diagnosis</Label>
                        <Textarea
                          value={formData.nursing_diagnosis}
                          onChange={(e) => handleChange("nursing_diagnosis", e.target.value)}
                          className="h-16 text-xs rounded-none resize-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 space-y-1">
                        <Label className="text-xs font-medium shrink-0">Etiologi (Penyebab)</Label>
                        <Textarea
                          value={formData.problem_etiology}
                          onChange={(e) => handleChange("problem_etiology", e.target.value)}
                          className="flex-1 text-xs rounded-none resize-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 space-y-1">
                        <Label className="text-xs font-medium shrink-0">Tanda & Gejala</Label>
                        <Textarea
                          value={formData.signs_symptoms}
                          onChange={(e) => handleChange("signs_symptoms", e.target.value)}
                          className="flex-1 text-xs rounded-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: SLKI & Notes */}
                  <div className="flex flex-col bg-background overflow-hidden">
                    <div className="bg-neutral-50 dark:bg-neutral-900 px-4 h-9 border-b border-neutral-200 dark:border-neutral-800 flex items-center shrink-0">
                      <span className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                        SLKI (Luaran)
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                      <div className="flex flex-col shrink-0 space-y-1">
                        <Label className="text-xs font-medium">Luaran Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_outcome}
                          onChange={(e) => handleChange("nursing_outcome", e.target.value)}
                          className="h-16 text-xs rounded-none resize-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 space-y-1">
                        <Label className="text-xs font-medium shrink-0">Indikator Luaran</Label>
                        <Textarea
                          value={formData.outcome_indicators}
                          onChange={(e) => handleChange("outcome_indicators", e.target.value)}
                          className="flex-1 text-xs rounded-none resize-none"
                        />
                      </div>
                      <div className="flex flex-col shrink-0 space-y-1">
                        <Label className="text-xs font-medium">Target Pencapaian</Label>
                        <Select value={formData.outcome_target} onValueChange={(v) => handleChange("outcome_target", v)}>
                          <SelectTrigger className="h-9 text-xs rounded-none">
                            <SelectValue placeholder="Pilih target..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {OUTCOME_TARGETS.map((t) => (
                              <SelectItem key={t.value} value={t.value} className="text-xs">
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col shrink-0 space-y-1">
                        <Label className="text-xs font-medium">Catatan</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => handleChange("notes", e.target.value)}
                          className="h-14 text-xs rounded-none resize-none"
                          placeholder="Catatan tambahan (opsional)..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: SIKI */}
                  <div className="flex flex-col bg-background overflow-hidden">
                    <div className="bg-neutral-50 dark:bg-neutral-900 px-4 h-9 border-b border-neutral-200 dark:border-neutral-800 flex items-center shrink-0">
                      <span className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                        SIKI (Intervensi)
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                      <div className="flex-1 flex flex-col min-h-0 space-y-1">
                        <Label className="text-xs font-medium shrink-0">Intervensi Utama / Pendukung</Label>
                        <Textarea
                          value={formData.nursing_intervention}
                          onChange={(e) => handleChange("nursing_intervention", e.target.value)}
                          className="flex-1 text-xs rounded-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0">
                        <div className="flex flex-col min-h-0 space-y-1">
                          <Label className="text-xs font-medium shrink-0">Observasi</Label>
                          <Textarea
                            value={formData.observation_actions}
                            onChange={(e) => handleChange("observation_actions", e.target.value)}
                            className="flex-1 text-xs rounded-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col min-h-0 space-y-1">
                          <Label className="text-xs font-medium shrink-0">Terapeutik</Label>
                          <Textarea
                            value={formData.therapeutic_actions}
                            onChange={(e) => handleChange("therapeutic_actions", e.target.value)}
                            className="flex-1 text-xs rounded-none resize-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0">
                        <div className="flex flex-col min-h-0 space-y-1">
                          <Label className="text-xs font-medium shrink-0">Edukasi</Label>
                          <Textarea
                            value={formData.education_actions}
                            onChange={(e) => handleChange("education_actions", e.target.value)}
                            className="flex-1 text-xs rounded-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col min-h-0 space-y-1">
                          <Label className="text-xs font-medium shrink-0">Kolaborasi</Label>
                          <Textarea
                            value={formData.collaboration_actions}
                            onChange={(e) => handleChange("collaboration_actions", e.target.value)}
                            className="flex-1 text-xs rounded-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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
              Hapus Asuhan Keperawatan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Data asuhan keperawatan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
