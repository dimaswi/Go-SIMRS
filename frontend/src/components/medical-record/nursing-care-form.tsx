import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import nursingMasterRaw from "@/master-data/nursing/sdki-slki-siki.master.json?raw";

interface NursingCareFormProps {
  visitId: number;
  readOnly?: boolean;
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
}: {
  record: NursingCare;
  canVerify: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onVerify: (id: number) => void;
  onEdit: (record: NursingCare) => void;
  onDelete: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

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
          </div>
        </div>

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

export function NursingCareForm({ visitId, readOnly = false }: NursingCareFormProps) {
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
  const canCreate = hasPermission("medical_records.nursing_care") && !readOnly;
  const canEdit = hasPermission("medical_records.nursing_care") && !readOnly;
  const canDelete = hasPermission("medical_records.nursing_care") && !readOnly;
  const canVerify = hasPermission("medical_records.nursing_care") && !readOnly;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
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
  }, [visitId, toast]);

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
          <div className="p-0">
            {records.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
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
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground border rounded-lg">
                <HeartPulse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan asuhan keperawatan</p>
                <p className="text-sm mt-1">Klik "Tambah Asuhan" untuk menambahkan catatan.</p>
                {canCreate && !readOnly && (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={handleOpenCreate} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Asuhan
                    </Button>
                  </div>
                )}
              </div>
            )}
            {canCreate && !readOnly && records.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleOpenCreate} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Asuhan
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal - Fullscreen */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-full w-full h-screen max-h-screen flex flex-col p-0 gap-0 rounded-none">
            <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5" />
                {editingId ? "Edit Asuhan Keperawatan" : "Tambah Asuhan Keperawatan Baru"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
            <Tabs value={activeFormTab} onValueChange={setActiveFormTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-2">
                  <Label>Pilih SDKI dari Master (Auto Isi)</Label>
                  <Select value={currentMasterCode || ""} onValueChange={handleApplyMasterSdki}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih diagnosis SDKI untuk isi otomatis" />
                    </SelectTrigger>
                    <SelectContent>
                      {nursingMasterItems.length === 0 ? (
                        <SelectItem value="__empty" disabled>
                          Master data SDKI belum terbaca.
                        </SelectItem>
                      ) : (
                        nursingMasterItems.map((item) => (
                          <SelectItem key={item.sdki.code} value={item.sdki.code}>
                            {item.sdki.code} - {item.sdki.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pilihan ini mengisi otomatis Diagnosis, Etiologi, Tanda-Gejala, Luaran, dan Intervensi.
                  </p>
                  {selectedMasterItem && (
                    <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground">
                        {selectedMasterItem.sdki.code} - {selectedMasterItem.sdki.label}
                      </p>
                      {selectedMasterItem.sdki.definisi && (
                        <p className="leading-relaxed">{selectedMasterItem.sdki.definisi}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">SLKI Utama: {(selectedMasterItem.slki?.luaran_utama || []).length}</Badge>
                        <Badge variant="outline">SLKI Tambahan: {(selectedMasterItem.slki?.luaran_tambahan || []).length}</Badge>
                        <Badge variant="outline">SIKI Utama: {(selectedMasterItem.siki?.intervensi_utama || []).length}</Badge>
                        <Badge variant="outline">SIKI Pendukung: {(selectedMasterItem.siki?.intervensi_pendukung || []).length}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <TabsList className="h-auto p-0 bg-transparent border-b border-border rounded-none w-full justify-start gap-6 mb-4 shrink-0">
                <TabsTrigger
                  value="diagnosis"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Form 3S (SDKI-SLKI-SIKI)
                </TabsTrigger>
              </TabsList>


              {/* Tab Diagnosis */}
              <TabsContent value="diagnosis" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal & Waktu</Label>
                    <Input
                      type="datetime-local"
                      value={formData.record_date}
                      onChange={(e) => handleChange("record_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select
                      value={formData.shift_type}
                      onValueChange={(v) => handleChange("shift_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Masalah</Label>
                    <Select
                      value={formData.problem_status}
                      onValueChange={(v) => handleChange("problem_status", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status masalah" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROBLEM_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4"><div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Diagnosis Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_diagnosis}
                          onChange={(e) => handleChange("nursing_diagnosis", e.target.value)}
                          placeholder="Contoh: Nyeri akut berhubungan dengan agen pencedera fisik"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kode SDKI</Label>
                        <Input
                          value={formData.nursing_diagnosis_code}
                          onChange={(e) => handleChange("nursing_diagnosis_code", e.target.value)}
                          placeholder="D.0077"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Etiologi (Penyebab/Berhubungan dengan)</Label>
                        <Textarea
                          value={formData.problem_etiology}
                          onChange={(e) => handleChange("problem_etiology", e.target.value)}
                          placeholder="Faktor yang berhubungan dengan masalah..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanda & Gejala (Ditandai dengan)</Label>
                        <Textarea
                          value={formData.signs_symptoms}
                          onChange={(e) => handleChange("signs_symptoms", e.target.value)}
                          placeholder="Batasan karakteristik yang ditemukan..."
                          rows={2}
                        />
                      </div>
                    </div>
                </div>

                {/* Luaran */}
                <div className="space-y-4"><div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="col-span-3 space-y-2">
                        <Label>Luaran Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_outcome}
                          onChange={(e) => handleChange("nursing_outcome", e.target.value)}
                          placeholder="Contoh: Tingkat nyeri menurun"
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Indikator Luaran</Label>
                        <Textarea
                          value={formData.outcome_indicators}
                          onChange={(e) => handleChange("outcome_indicators", e.target.value)}
                          placeholder="Indikator yang diukur..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Pencapaian</Label>
                        <Select
                          value={formData.outcome_target}
                          onValueChange={(v) => handleChange("outcome_target", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih target" />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTCOME_TARGETS.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                </div>

                <div className="space-y-4"><div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="col-span-3 space-y-2">
                        <Label>Intervensi Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_intervention}
                          onChange={(e) => handleChange("nursing_intervention", e.target.value)}
                          placeholder="Intervensi utama dan pendukung sesuai SIKI"
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tindakan Observasi</Label>
                        <Textarea
                          value={formData.observation_actions}
                          onChange={(e) => handleChange("observation_actions", e.target.value)}
                          placeholder="Ringkas tindakan observasi"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Terapeutik</Label>
                        <Textarea
                          value={formData.therapeutic_actions}
                          onChange={(e) => handleChange("therapeutic_actions", e.target.value)}
                          placeholder="Ringkas tindakan terapeutik"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Edukasi</Label>
                        <Textarea
                          value={formData.education_actions}
                          onChange={(e) => handleChange("education_actions", e.target.value)}
                          placeholder="Ringkas tindakan edukasi"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Kolaborasi</Label>
                        <Textarea
                          value={formData.collaboration_actions}
                          onChange={(e) => handleChange("collaboration_actions", e.target.value)}
                          placeholder="Ringkas tindakan kolaborasi"
                          rows={3}
                        />
                      </div>
                    </div>
                </div>

                <div className="space-y-2">
                  <Label>Catatan Tambahan</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Catatan ringkas asuhan keperawatan"
                    rows={2}
                  />
                </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
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
