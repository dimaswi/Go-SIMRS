import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
              <span className="font-medium">{format(new Date(record.record_date), "dd MMM yyyy", { locale: idLocale })}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(record.record_date), "HH:mm")}</span>
            </div>
          </div>
          <div className="col-span-2">
            {record.shift_type && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {getShiftTypeLabel(record.shift_type)}
              </Badge>
            )}
          </div>
          <div className="col-span-4">
            <p className="text-xs text-muted-foreground truncate">{getDiagnosisSummary()}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {record.nursing_diagnosis_code && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {record.nursing_diagnosis_code}
                </Badge>
              )}
              {slkiCount > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  SLKI {slkiCount}
                </Badge>
              )}
              {sikiCount > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  SIKI {sikiCount}
                </Badge>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                {record.problem_status ? (
                  <Badge className={getProblemStatusColor(record.problem_status)}>
                    {getProblemStatusLabel(record.problem_status)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">-</Badge>
                )}
                {record.is_verified && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <ShieldCheck className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {record.created_by && <span>{record.created_by.full_name}</span>}
                {record.is_verified && record.verified_by && <span className="ml-1">• {record.verified_by.full_name}</span>}
              </div>
            </div>
          </div>
          <div className="col-span-1 flex items-center gap-1">
            {canVerify && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => onVerify(record.id)}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canEdit && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(record)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && !record.is_verified && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(record.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold flex items-center gap-1.5 text-blue-900">
                    <FileText className="h-3.5 w-3.5" /> SDKI
                  </p>
                  {record.nursing_diagnosis_code && (
                    <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-800">
                      {record.nursing_diagnosis_code}
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-medium text-blue-900 mb-1">Diagnosis Keperawatan</p>
                <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-blue-950/90">
                  {record.nursing_diagnosis || "-"}
                </div>
                {record.problem_etiology && (
                  <div className="mt-2 rounded-md border border-blue-100 bg-white p-2">
                    <p className="text-[11px] font-medium text-blue-800 mb-1">Etiologi</p>
                    <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {record.problem_etiology}
                    </div>
                  </div>
                )}
                {record.signs_symptoms && (
                  <div className="mt-2 rounded-md border border-blue-100 bg-white p-2">
                    <p className="text-[11px] font-medium text-blue-800 mb-1">Tanda dan Gejala</p>
                    <div className="max-h-24 overflow-auto pr-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {record.signs_symptoms}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold flex items-center gap-1.5 text-emerald-900">
                    <Target className="h-3.5 w-3.5" /> SLKI
                  </p>
                  <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-800">
                    Item {slkiCount || 0}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-emerald-900 mb-1">Luaran Keperawatan</p>
                <div className="max-h-[230px] overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-emerald-950/90">
                  {record.nursing_outcome || "-"}
                </div>
                {record.outcome_target && (
                  <div className="mt-2 rounded-md border border-emerald-100 bg-white p-2 text-xs text-muted-foreground">
                    <strong>Target:</strong> {record.outcome_target}
                  </div>
                )}
              </div>

              <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                    <ClipboardList className="h-3.5 w-3.5" /> SIKI
                  </p>
                  <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-800">
                    Item {sikiCount || 0}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-amber-900 mb-1">Intervensi Keperawatan</p>
                <div className="max-h-[260px] overflow-auto pr-1 whitespace-pre-wrap leading-relaxed text-amber-950/90">
                  {record.nursing_intervention || "-"}
                </div>
              </div>

              {/* Implementasi */}
              {record.implementation && (
                <div className="bg-muted/50 border rounded-lg p-3 lg:col-span-3">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" /> Implementasi
                  </p>
                  <p className="whitespace-pre-wrap">{record.implementation}</p>
                  {record.patient_response && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Respon:</strong> {record.patient_response}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Evaluasi SOAP */}
            {(record.evaluation_subjective || record.evaluation_objective || record.evaluation_analysis || record.evaluation_planning) && (
              <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {record.evaluation_subjective && (
                  <div className="bg-muted/50 border rounded p-2">
                    <span className="font-medium">S:</span>
                    <p>{record.evaluation_subjective}</p>
                  </div>
                )}
                {record.evaluation_objective && (
                  <div className="bg-muted/50 border rounded p-2">
                    <span className="font-medium">O:</span>
                    <p>{record.evaluation_objective}</p>
                  </div>
                )}
                {record.evaluation_analysis && (
                  <div className="bg-muted/50 border rounded p-2">
                    <span className="font-medium">A:</span>
                    <p>{record.evaluation_analysis}</p>
                  </div>
                )}
                {record.evaluation_planning && (
                  <div className="bg-muted/50 border rounded p-2">
                    <span className="font-medium">P:</span>
                    <p>{record.evaluation_planning}</p>
                  </div>
                )}
              </div>
            )}

            {/* Vital Signs */}
            {(record.blood_pressure || record.heart_rate || record.temperature) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {record.blood_pressure && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Activity className="h-3 w-3" /> TD: {record.blood_pressure} mmHg
                  </span>
                )}
                {record.heart_rate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Heart className="h-3 w-3" /> HR: {record.heart_rate} x/mnt
                  </span>
                ) : null}
                {record.temperature && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    <Thermometer className="h-3 w-3" /> T: {record.temperature}°C
                  </span>
                )}
                {record.oxygen_saturation ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    SpO2: {record.oxygen_saturation}%
                  </span>
                ) : null}
                {record.pain_scale ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
                    Nyeri: {record.pain_scale}/10
                  </span>
                ) : null}
              </div>
            )}

            {/* Notes */}
            {record.notes && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Catatan:</p>
                <p>{record.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {record.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Dicatat: {record.created_by.full_name}
                </span>
              )}
              {record.is_verified && record.verified_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Diverifikasi: {record.verified_by.full_name}
                </span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
          <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Asuhan Keperawatan</span>
                {canCreate && !readOnly && (
                  <Button onClick={handleOpenCreate} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Tanggal/Waktu</div>
                  <div className="col-span-2">Shift</div>
                  <div className="col-span-4">Diagnosis Keperawatan</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1">Aksi</div>
                </div>
                <div className="divide-y">
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
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <HeartPulse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan asuhan keperawatan</p>
                <p className="text-sm mt-1">
                  {readOnly
                    ? "Belum ada catatan asuhan keperawatan pada RM duplikat."
                    : 'Klik "Tambah Asuhan" untuk menambahkan asuhan baru.'}
                </p>
              </div>
            )}
          </div>
          </div>
        </div>

      {/* Create/Edit Modal - Fullscreen Monolithic, No Scroll */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <HeartPulse className="h-4 w-4" />
              {editingId ? "Edit Asuhan Keperawatan" : "Tambah Asuhan Keperawatan Baru"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-6 w-6 rounded-none text-muted-foreground hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 gap-3">
            <Tabs value={activeFormTab} onValueChange={setActiveFormTab} className="flex-1 flex flex-col overflow-hidden gap-3">
              {/* Top Section: Master Selection */}
              <div className="shrink-0 flex items-center gap-4 bg-muted/10 border border-border/70 p-2">
                <Label className="whitespace-nowrap text-xs">Pilih SDKI dari Master:</Label>
                <Select value={currentMasterCode || ""} onValueChange={handleApplyMasterSdki}>
                  <SelectTrigger className="w-[300px] h-8 text-xs rounded-none border-border/70">
                    <SelectValue placeholder="Pilih diagnosis SDKI..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {nursingMasterItems.length === 0 ? (
                      <SelectItem value="__empty" disabled className="text-xs">
                        Master data SDKI belum terbaca.
                      </SelectItem>
                    ) : (
                      nursingMasterItems.map((item) => (
                        <SelectItem key={item.sdki.code} value={item.sdki.code} className="text-xs">
                          {item.sdki.code} - {item.sdki.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedMasterItem && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground ml-auto">
                    <Badge variant="outline" className="rounded-none font-normal text-[10px] border-border/70">
                      SLKI: {(selectedMasterItem.slki?.luaran_utama || []).length} / {(selectedMasterItem.slki?.luaran_tambahan || []).length}
                    </Badge>
                    <Badge variant="outline" className="rounded-none font-normal text-[10px] border-border/70">
                      SIKI: {(selectedMasterItem.siki?.intervensi_utama || []).length} / {(selectedMasterItem.siki?.intervensi_pendukung || []).length}
                    </Badge>
                  </div>
                )}
              </div>

              <TabsContent value="diagnosis" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col gap-3 min-h-0">
                {/* Info Row */}
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  <div className="flex items-center gap-2 bg-muted/10 border border-border/70 p-2">
                    <Label className="text-[10px] uppercase text-muted-foreground w-20">Waktu</Label>
                    <Input
                      type="datetime-local"
                      value={formData.record_date}
                      onChange={(e) => handleChange("record_date", e.target.value)}
                      className="h-7 text-[10px] rounded-none border-border/70 w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-muted/10 border border-border/70 p-2">
                    <Label className="text-[10px] uppercase text-muted-foreground w-12">Shift</Label>
                    <Select value={formData.shift_type} onValueChange={(v) => handleChange("shift_type", v)}>
                      <SelectTrigger className="h-7 text-[10px] rounded-none border-border/70 w-full">
                        <SelectValue placeholder="Shift" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {SHIFT_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-[10px]">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/10 border border-border/70 p-2">
                    <Label className="text-[10px] uppercase text-muted-foreground w-20">Status</Label>
                    <Select value={formData.problem_status} onValueChange={(v) => handleChange("problem_status", v)}>
                      <SelectTrigger className="h-7 text-[10px] rounded-none border-border/70 w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {PROBLEM_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-[10px]">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3 Columns Layout for Data */}
                <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
                  {/* Column 1: SDKI */}
                  <div className="flex flex-col border border-border/70 bg-background overflow-hidden">
                    <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between shrink-0">
                      <span>SDKI (Diagnosis)</span>
                      <span className="font-mono text-primary bg-primary/10 px-1">{formData.nursing_diagnosis_code || "D.----"}</span>
                    </div>
                    <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                      <div className="flex flex-col shrink-0">
                        <Label className="text-[10px] text-muted-foreground mb-1">Diagnosis</Label>
                        <Textarea
                          value={formData.nursing_diagnosis}
                          onChange={(e) => handleChange("nursing_diagnosis", e.target.value)}
                          className="h-16 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Etiologi (Penyebab)</Label>
                        <Textarea
                          value={formData.problem_etiology}
                          onChange={(e) => handleChange("problem_etiology", e.target.value)}
                          className="flex-1 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Tanda & Gejala</Label>
                        <Textarea
                          value={formData.signs_symptoms}
                          onChange={(e) => handleChange("signs_symptoms", e.target.value)}
                          className="flex-1 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: SLKI & Notes */}
                  <div className="flex flex-col border border-border/70 bg-background overflow-hidden">
                    <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                      SLKI (Luaran)
                    </div>
                    <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                      <div className="flex flex-col shrink-0">
                        <Label className="text-[10px] text-muted-foreground mb-1">Luaran Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_outcome}
                          onChange={(e) => handleChange("nursing_outcome", e.target.value)}
                          className="h-16 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Indikator Luaran</Label>
                        <Textarea
                          value={formData.outcome_indicators}
                          onChange={(e) => handleChange("outcome_indicators", e.target.value)}
                          className="flex-1 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                      <div className="flex flex-col shrink-0">
                        <Label className="text-[10px] text-muted-foreground mb-1">Target Pencapaian</Label>
                        <Select value={formData.outcome_target} onValueChange={(v) => handleChange("outcome_target", v)}>
                          <SelectTrigger className="h-7 text-xs rounded-none border-border/70">
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
                      <div className="flex flex-col shrink-0 mt-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase">Catatan</Label>
                        </div>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => handleChange("notes", e.target.value)}
                          className="h-12 text-xs rounded-none border-border/70 resize-none bg-muted/10 focus-visible:bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: SIKI */}
                  <div className="flex flex-col border border-border/70 bg-background overflow-hidden">
                    <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                      SIKI (Intervensi)
                    </div>
                    <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                      <div className="flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Intervensi Utama / Pendukung</Label>
                        <Textarea
                          value={formData.nursing_intervention}
                          onChange={(e) => handleChange("nursing_intervention", e.target.value)}
                          className="flex-1 text-xs rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <div className="flex flex-col min-h-0">
                          <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Observasi</Label>
                          <Textarea
                            value={formData.observation_actions}
                            onChange={(e) => handleChange("observation_actions", e.target.value)}
                            className="flex-1 text-[10px] rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                          />
                        </div>
                        <div className="flex flex-col min-h-0">
                          <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Terapeutik</Label>
                          <Textarea
                            value={formData.therapeutic_actions}
                            onChange={(e) => handleChange("therapeutic_actions", e.target.value)}
                            className="flex-1 text-[10px] rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <div className="flex flex-col min-h-0">
                          <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Edukasi</Label>
                          <Textarea
                            value={formData.education_actions}
                            onChange={(e) => handleChange("education_actions", e.target.value)}
                            className="flex-1 text-[10px] rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                          />
                        </div>
                        <div className="flex flex-col min-h-0">
                          <Label className="text-[10px] text-muted-foreground mb-1 shrink-0">Kolaborasi</Label>
                          <Textarea
                            value={formData.collaboration_actions}
                            onChange={(e) => handleChange("collaboration_actions", e.target.value)}
                            className="flex-1 text-[10px] rounded-none border-border/70 resize-none bg-muted/5 focus-visible:bg-background"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="px-4 py-3 border-t bg-muted/30 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-none text-xs">
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-none text-xs">
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
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
              <AlertDialogTitle>Hapus Asuhan Keperawatan?</AlertDialogTitle>
              <AlertDialogDescription>
                Data asuhan keperawatan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
