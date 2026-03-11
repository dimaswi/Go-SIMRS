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
  CONSCIOUSNESS_LEVELS,
  FUNCTIONAL_STATUS,
  PRESSURE_ULCER_RISK,
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
  Calendar,
  Heart,
  Thermometer,
  Activity,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Target,
  ClipboardList,
  Stethoscope,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface NursingCareFormProps {
  visitId: number;
  readOnly?: boolean;
}

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
            {record.nursing_diagnosis_code && (
              <span className="text-xs text-primary">{record.nursing_diagnosis_code}</span>
            )}
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
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
              {/* Diagnosis Keperawatan */}
              {record.nursing_diagnosis && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Diagnosis Keperawatan
                    {record.nursing_diagnosis_code && (
                      <span className="text-xs font-normal text-muted-foreground">({record.nursing_diagnosis_code})</span>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">{record.nursing_diagnosis}</p>
                  {record.problem_etiology && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Etiologi:</strong> {record.problem_etiology}
                    </p>
                  )}
                </div>
              )}

              {/* Luaran */}
              {record.nursing_outcome && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" /> Luaran Keperawatan
                    {record.nursing_outcome_code && (
                      <span className="text-xs font-normal text-muted-foreground">({record.nursing_outcome_code})</span>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">{record.nursing_outcome}</p>
                  {record.outcome_target && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Target:</strong> {record.outcome_target}
                    </p>
                  )}
                </div>
              )}

              {/* Intervensi */}
              {record.nursing_intervention && (
                <div className="bg-muted/50 border rounded-lg p-3">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> Intervensi Keperawatan
                    {record.nursing_intervention_code && (
                      <span className="text-xs font-normal text-muted-foreground">({record.nursing_intervention_code})</span>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">{record.nursing_intervention}</p>
                </div>
              )}

              {/* Implementasi */}
              {record.implementation && (
                <div className="bg-muted/50 border rounded-lg p-3">
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
    setActiveFormTab("pengkajian");
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
    setActiveFormTab("pengkajian");
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (field: keyof CreateNursingCareInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await nursingCareApi.update(visitId, editingId, formData);
        toast({
          title: "Berhasil",
          description: "Asuhan keperawatan berhasil diperbarui",
        });
      } else {
        await nursingCareApi.create(visitId, formData);
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
          <div className="pb-2">
            <div className="flex items-center justify-between">
              
              {canCreate && !readOnly && (
                <Button onClick={handleOpenCreate} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Asuhan
                </Button>
              )}
            </div>
          </div>
          <div className="p-0">
            {records.length > 0 ? (
              <div>
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
              <div className="py-12 text-center text-muted-foreground">
                <HeartPulse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan asuhan keperawatan</p>
                <p className="text-sm mt-1">Klik "Tambah Asuhan" untuk menambahkan catatan.</p>
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
              <TabsList className="h-auto p-0 bg-transparent border-b border-border rounded-none w-full justify-start gap-6 mb-4 shrink-0">
                <TabsTrigger 
                  value="pengkajian"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Pengkajian
                </TabsTrigger>
                <TabsTrigger 
                  value="diagnosis"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Diagnosis
                </TabsTrigger>
                <TabsTrigger 
                  value="intervensi"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Intervensi
                </TabsTrigger>
                <TabsTrigger 
                  value="implementasi"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Implementasi
                </TabsTrigger>
                <TabsTrigger 
                  value="evaluasi"
                  className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  Evaluasi
                </TabsTrigger>
              </TabsList>

              {/* Tab Pengkajian */}
              <TabsContent value="pengkajian" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                {/* Row 1 - Date, Shift */}
                <div className="space-y-4"><div className="grid grid-cols-3 gap-4">
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
                        <Label>Status Kesadaran</Label>
                        <Select
                          value={formData.consciousness_level}
                          onValueChange={(v) => handleChange("consciousness_level", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tingkat kesadaran" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONSCIOUSNESS_LEVELS.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2 - Keluhan */}
                    <div className="space-y-2 mt-4">
                      <Label>Keluhan Utama</Label>
                      <Textarea
                        value={formData.chief_complaint}
                        onChange={(e) => handleChange("chief_complaint", e.target.value)}
                        placeholder="Keluhan yang dirasakan pasien..."
                        rows={2}
                      />
                    </div>
                </div>

                {/* Vital Signs */}
                <div className="space-y-4"><div className="grid grid-cols-3 md:grid-cols-6 gap-3">
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

                    {/* Pain Assessment */}
                    <div className="space-y-2 mt-4">
                      <Label>Pengkajian Nyeri (Lokasi, Karakteristik, Durasi)</Label>
                      <Textarea
                        value={formData.pain_assessment}
                        onChange={(e) => handleChange("pain_assessment", e.target.value)}
                        placeholder="Deskripsi nyeri..."
                        rows={2}
                      />
                    </div>
                </div>

                {/* Risk Assessments */}
                <div className="space-y-4"><div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status Fungsional (ADL)</Label>
                        <Select
                          value={formData.functional_status}
                          onValueChange={(v) => handleChange("functional_status", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            {FUNCTIONAL_STATUS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Risiko Luka Tekan</Label>
                        <Select
                          value={formData.pressure_ulcer_risk}
                          onValueChange={(v) => handleChange("pressure_ulcer_risk", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih risiko" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRESSURE_ULCER_RISK.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Fall Risk */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>Pengkajian Risiko Jatuh</Label>
                        <Textarea
                          value={formData.fall_risk_assessment}
                          onChange={(e) => handleChange("fall_risk_assessment", e.target.value)}
                          placeholder="Deskripsi pengkajian risiko jatuh..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Skor Risiko Jatuh (Morse Fall Scale)</Label>
                        <Input
                          type="number"
                          value={formData.fall_risk_score || ""}
                          onChange={(e) => handleChange("fall_risk_score", parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Nutrition & Skin */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>Pengkajian Nutrisi</Label>
                        <Textarea
                          value={formData.nutrition_assessment}
                          onChange={(e) => handleChange("nutrition_assessment", e.target.value)}
                          placeholder="Status nutrisi pasien..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pengkajian Kulit/Integritas Kulit</Label>
                        <Textarea
                          value={formData.skin_assessment}
                          onChange={(e) => handleChange("skin_assessment", e.target.value)}
                          placeholder="Kondisi kulit pasien..."
                          rows={2}
                        />
                      </div>
                    </div>
                </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab Diagnosis */}
              <TabsContent value="diagnosis" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
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
                      <div className="col-span-2 space-y-2">
                        <Label>Luaran Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_outcome}
                          onChange={(e) => handleChange("nursing_outcome", e.target.value)}
                          placeholder="Contoh: Tingkat nyeri menurun"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kode SLKI</Label>
                        <Input
                          value={formData.nursing_outcome_code}
                          onChange={(e) => handleChange("nursing_outcome_code", e.target.value)}
                          placeholder="L.08066"
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
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="intervensi" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                <div className="space-y-4"><div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Intervensi Keperawatan</Label>
                        <Textarea
                          value={formData.nursing_intervention}
                          onChange={(e) => handleChange("nursing_intervention", e.target.value)}
                          placeholder="Contoh: Manajemen nyeri"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kode SIKI</Label>
                        <Input
                          value={formData.nursing_intervention_code}
                          onChange={(e) => handleChange("nursing_intervention_code", e.target.value)}
                          placeholder="I.08238"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tindakan Observasi</Label>
                        <Textarea
                          value={formData.observation_actions}
                          onChange={(e) => handleChange("observation_actions", e.target.value)}
                          placeholder="1. Identifikasi lokasi, karakteristik nyeri&#10;2. Monitor TTV"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Terapeutik</Label>
                        <Textarea
                          value={formData.therapeutic_actions}
                          onChange={(e) => handleChange("therapeutic_actions", e.target.value)}
                          placeholder="1. Berikan teknik nonfarmakologi&#10;2. Kolaborasi pemberian analgetik"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Edukasi</Label>
                        <Textarea
                          value={formData.education_actions}
                          onChange={(e) => handleChange("education_actions", e.target.value)}
                          placeholder="1. Jelaskan penyebab nyeri&#10;2. Ajarkan teknik relaksasi"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Kolaborasi</Label>
                        <Textarea
                          value={formData.collaboration_actions}
                          onChange={(e) => handleChange("collaboration_actions", e.target.value)}
                          placeholder="1. Kolaborasi pemberian analgetik&#10;2. Kolaborasi dengan tim nyeri"
                          rows={3}
                        />
                      </div>
                    </div>
                </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab Implementasi */}
              <TabsContent value="implementasi" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                <div className="space-y-4"><div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label>Tindakan yang Dilakukan</Label>
                          <Textarea
                            value={formData.implementation}
                            onChange={(e) => handleChange("implementation", e.target.value)}
                            placeholder="Deskripsi tindakan yang telah dilakukan..."
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Waktu Implementasi</Label>
                          <Input
                            type="datetime-local"
                            value={formData.implementation_time}
                            onChange={(e) => handleChange("implementation_time", e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Respon Pasien</Label>
                        <Textarea
                          value={formData.patient_response}
                          onChange={(e) => handleChange("patient_response", e.target.value)}
                          placeholder="Bagaimana respon pasien terhadap tindakan yang diberikan..."
                          rows={3}
                        />
                      </div>
                    </div>
                </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab Evaluasi */}
              <TabsContent value="evaluasi" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4 pb-4">
                <div className="space-y-4"><div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="font-medium">S - Subjektif</Label>
                        <Textarea
                          value={formData.evaluation_subjective}
                          onChange={(e) => handleChange("evaluation_subjective", e.target.value)}
                          placeholder="Keluhan pasien setelah tindakan..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium">O - Objektif</Label>
                        <Textarea
                          value={formData.evaluation_objective}
                          onChange={(e) => handleChange("evaluation_objective", e.target.value)}
                          placeholder="Hasil observasi/pemeriksaan..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium">A - Analisis</Label>
                        <Textarea
                          value={formData.evaluation_analysis}
                          onChange={(e) => handleChange("evaluation_analysis", e.target.value)}
                          placeholder="Analisis masalah keperawatan..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium">P - Planning</Label>
                        <Textarea
                          value={formData.evaluation_planning}
                          onChange={(e) => handleChange("evaluation_planning", e.target.value)}
                          placeholder="Rencana tindak lanjut..."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label>Catatan Tambahan</Label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => handleChange("notes", e.target.value)}
                          placeholder="Catatan tambahan..."
                        />
                      </div>
                    </div>
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
