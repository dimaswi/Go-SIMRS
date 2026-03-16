import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, 
  Loader2, 
  Heart, 
  Utensils,
  Activity,
  GraduationCap,
  Stethoscope,
  Users,
  Eye,
  WandSparkles
} from "lucide-react";
import { medicalRecordsApi, type AssessmentPlan, type MedicalRecordSummary } from "@/lib/api/medical-records";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { medicineOrdersApi } from "@/lib/api/medicine-orders";
import { visitProceduresApi } from "@/lib/api/visit-procedures";
import { procedureOrdersApi } from "@/lib/api/procedure-orders";
import { useEditMode, EditModeBanner, EditConfirmDialog, PINVerificationDialog } from "./edit-mode-controller";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved, MEDICAL_RECORD_TAB_SAVED_EVENT } from "./tab-indicator";
import { COPY_FROM_HISTORY_EVENT } from "./copy-from-history-drawer";
import { saveFormDraft, loadFormDraft, clearFormDraft, loadPendingCopy, clearPendingCopy } from "@/lib/form-persistence";
import { useToast } from "@/hooks/use-toast";

interface AssessmentPlanFormProps {
  visitId: number;
  initialData?: AssessmentPlan;
  onSave?: (data: AssessmentPlan) => void;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
}

export function AssessmentPlanForm({ visitId, initialData, onSave, readOnly = false, isPatientDischarged = false }: AssessmentPlanFormProps) {
  const INFORMED_CONSENT_EDU_OPTION = "Informed consent";

  const DEFAULT_PROGNOSIS_OPTIONS = [
    "Baik",
    "Meragukan cenderung baik",
    "Meragukan cenderung buruk",
    "Buruk",
  ];

  const DIET_CHECKLIST_OPTIONS = [
    "Diet rendah garam",
    "Diet rendah gula",
    "Diet rendah lemak",
    "Diet tinggi protein",
    "Pembatasan cairan",
    "Makan porsi kecil tapi sering",
    "Hindari makanan pedas/asam",
    "Konsultasi gizi lanjutan",
  ];

  const EDUCATION_CHECKLIST_OPTIONS = [
    "Kondisi kesehatan dan diagnosis",
    "Penggunaan obat yang benar",
    "Diet dan nutrisi",
    "Manajemen nyeri",
    "Tanda bahaya dan kapan kembali",
    "Kepatuhan kontrol/rawat jalan",
    "Edukasi rujukan pasien",
    "Edukasi perencanaan pulang",
    INFORMED_CONSENT_EDU_OPTION,
  ];

  const BASE_ACTIVITY_OPTIONS = [
    "Aktivitas mandiri sesuai toleransi",
    "Aktivitas ringan, hindari aktivitas berat",
    "Istirahat cukup",
    "Mobilisasi bertahap",
    "Bed rest relatif",
    "Bed rest total",
  ];

  const MONITORING_CHECKLIST_OPTIONS = [
    "Pantau tanda vital berkala (TD, Nadi, RR, Suhu)",
    "Pantau skala nyeri",
    "Pantau mual muntah dan toleransi oral",
    "Pantau intake-output cairan",
    "Pantau efek samping obat",
    "Pantau hasil lab lanjutan",
    "Pantau hasil radiologi lanjutan",
    "Evaluasi ulang bila muncul tanda bahaya",
  ];

  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMedicationPlan, setSyncingMedicationPlan] = useState(false);
  const [syncingProcedurePlan, setSyncingProcedurePlan] = useState(false);
  const [syncingConsultationPlan, setSyncingConsultationPlan] = useState(false);
  const [generatingClinicalAssessment, setGeneratingClinicalAssessment] = useState(false);
  const [syncingActivityFromSupportOrders, setSyncingActivityFromSupportOrders] = useState(false);
  const [prognosisOptions, setPrognosisOptions] = useState<string[]>(DEFAULT_PROGNOSIS_OPTIONS);
  const [selectedDietItems, setSelectedDietItems] = useState<string[]>([]);
  const [selectedEducationItems, setSelectedEducationItems] = useState<string[]>([]);
  const [activityOrderSuggestions, setActivityOrderSuggestions] = useState<string[]>([]);
  const [selectedActivityItems, setSelectedActivityItems] = useState<string[]>([]);
  const [selectedMonitoringItems, setSelectedMonitoringItems] = useState<string[]>([]);
  const [assessmentPlanId, setAssessmentPlanId] = useState<number | undefined>();

  // Edit mode controller for post-discharge edits
  const {
    isEditing,
    editReason,
    showEditDialog,
    showPINDialog,
    setShowEditDialog,
    setShowPINDialog,
    setEditReason,
    handleRequestEdit,
    handleConfirmEdit,
    resetEditMode,
    requestPINVerification,
    // PIN related
    pin,
    verifyingPIN,
    pinInputRefs,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
  } = useEditMode({
    isPatientDischarged,
    recordType: "assessment_plan",
  });

  // Determine if form should be disabled
  const isFormDisabled = readOnly || (isPatientDischarged && !isEditing);
  const [formData, setFormData] = useState({
    clinical_assessment: initialData?.clinical_assessment || "",
    prognosis: initialData?.prognosis || "",
    treatment_plan: initialData?.treatment_plan || "",
    medication_plan: initialData?.medication_plan || "",
    diet_plan: initialData?.diet_plan || "",
    activity_plan: initialData?.activity_plan || "",
    education_plan: initialData?.education_plan || "",
    monitoring_plan: initialData?.monitoring_plan || "",
    procedure_plan: initialData?.procedure_plan || "",
    consultation_plan: initialData?.consultation_plan || "",
    informed_consent: (initialData as any)?.informed_consent || "",
  });

  // Load existing data
  useEffect(() => {
    const loadData = async () => {
      if (!visitId) return;
      setLoading(true);
      let serverDataLoaded = false;
      try {
        const response = await medicalRecordsApi.getAssessmentPlan(visitId);
        if (response.data) {
          addPrognosisOption(response.data.prognosis || "");
          setSelectedDietItems(extractSelectedItems(response.data.diet_plan, DIET_CHECKLIST_OPTIONS));
          setSelectedEducationItems(buildEducationSelections(response.data.education_plan, (response.data as any).informed_consent));
          setSelectedActivityItems(extractSelectedItems(response.data.activity_plan, BASE_ACTIVITY_OPTIONS));
          setSelectedMonitoringItems(extractSelectedItems(response.data.monitoring_plan, MONITORING_CHECKLIST_OPTIONS));
          setFormData({
            clinical_assessment: response.data.clinical_assessment || "",
            prognosis: response.data.prognosis || "",
            treatment_plan: response.data.treatment_plan || "",
            medication_plan: response.data.medication_plan || "",
            diet_plan: response.data.diet_plan || "",
            activity_plan: response.data.activity_plan || "",
            education_plan: response.data.education_plan || "",
            monitoring_plan: response.data.monitoring_plan || "",
            procedure_plan: response.data.procedure_plan || "",
            consultation_plan: response.data.consultation_plan || "",
            informed_consent: (response.data as any).informed_consent || "",
          });
          if (response.data.id) {
            setAssessmentPlanId(response.data.id);
            serverDataLoaded = true;
            emitMedicalRecordTabSaved("assessment-plan", true);
          }
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
        // Apply local draft only if server had no saved data (prevents overriding saved data)
        if (!serverDataLoaded) {
          const draft = loadFormDraft<typeof formData>(`mr-draft-assessment-plan-${visitId}`);
          if (draft) {
            setSelectedDietItems(extractSelectedItems(draft.diet_plan, DIET_CHECKLIST_OPTIONS));
            setSelectedEducationItems(buildEducationSelections(draft.education_plan, draft.informed_consent));
            setSelectedActivityItems(extractSelectedItems(draft.activity_plan, BASE_ACTIVITY_OPTIONS));
            setSelectedMonitoringItems(extractSelectedItems(draft.monitoring_plan, MONITORING_CHECKLIST_OPTIONS));
            setFormData(draft);
            emitMedicalRecordTabSaved("assessment-plan", false);
          }
        } else {
          // Server data loaded successfully — discard any stale draft
          clearFormDraft(`mr-draft-assessment-plan-${visitId}`);
        }
        // Check for pending copy from history (takes priority over draft)
        const pendingCopy = loadPendingCopy<any>("assessment-plan");
        if (pendingCopy) {
            addPrognosisOption(pendingCopy.prognosis || "");
          setSelectedDietItems(extractSelectedItems(pendingCopy.diet_plan, DIET_CHECKLIST_OPTIONS));
          setSelectedEducationItems(buildEducationSelections(pendingCopy.education_plan, pendingCopy.informed_consent));
          setSelectedActivityItems(extractSelectedItems(pendingCopy.activity_plan, BASE_ACTIVITY_OPTIONS));
          setSelectedMonitoringItems(extractSelectedItems(pendingCopy.monitoring_plan, MONITORING_CHECKLIST_OPTIONS));
          setFormData({
            clinical_assessment: pendingCopy.clinical_assessment || "",
            prognosis: pendingCopy.prognosis || "",
            treatment_plan: pendingCopy.treatment_plan || "",
            medication_plan: pendingCopy.medication_plan || "",
            diet_plan: pendingCopy.diet_plan || "",
            activity_plan: pendingCopy.activity_plan || "",
            education_plan: pendingCopy.education_plan || "",
            monitoring_plan: pendingCopy.monitoring_plan || "",
            procedure_plan: pendingCopy.procedure_plan || "",
            consultation_plan: pendingCopy.consultation_plan || "",
            informed_consent: pendingCopy.informed_consent || "",
          });
          emitMedicalRecordTabSaved("assessment-plan", false);
        }
      }
    };
    loadData();
  }, [visitId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    emitMedicalRecordTabSaved("assessment-plan", false);
  };

  const addPrognosisOption = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;

    setPrognosisOptions((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === normalized.toLowerCase());
      if (exists) return prev;
      return [normalized, ...prev];
    });
  };

  const formatChecklistPlan = (label: string, items: string[]) => {
    if (items.length === 0) return "";
    return [`${label}:`, ...items.map((item) => `- ${item}`)].join("\n");
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const extractSelectedItems = (text: string | undefined, options: string[]) => {
    const source = text || "";
    return options.filter((option) => new RegExp(escapeRegExp(option), "i").test(source));
  };

  const buildEducationSelections = (educationPlan?: string, informedConsent?: string) => {
    const selected = extractSelectedItems(educationPlan, EDUCATION_CHECKLIST_OPTIONS);
    const hasInformedConsent = Boolean(informedConsent?.trim());
    if (hasInformedConsent && !selected.includes(INFORMED_CONSENT_EDU_OPTION)) {
      return [...selected, INFORMED_CONSENT_EDU_OPTION];
    }
    return selected;
  };

  const handleToggleDietItem = (item: string) => {
    setSelectedDietItems((prev) => {
      const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
      setFormData((current) => ({
        ...current,
        diet_plan: formatChecklistPlan("Rencana diet", next),
      }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      return next;
    });
  };

  const handleToggleEducationItem = (item: string) => {
    setSelectedEducationItems((prev) => {
      const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
      setFormData((current) => ({
        ...current,
        education_plan: formatChecklistPlan("Rencana edukasi", next),
        informed_consent: next.includes(INFORMED_CONSENT_EDU_OPTION)
          ? INFORMED_CONSENT_EDU_OPTION
          : "",
      }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      return next;
    });
  };

  const formatActivityPlan = (items: string[]) => {
    if (items.length === 0) return "";
    return ["Rencana aktivitas:", ...items.map((item) => `- ${item}`)].join("\n");
  };

  const handleToggleActivityItem = (item: string) => {
    setSelectedActivityItems((prev) => {
      const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
      setFormData((current) => ({
        ...current,
        activity_plan: formatActivityPlan(next),
      }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      return next;
    });
  };

  const formatMonitoringPlan = (items: string[]) => {
    if (items.length === 0) return "";
    return ["Rencana monitoring:", ...items.map((item) => `- ${item}`)].join("\n");
  };

  const handleToggleMonitoringItem = (item: string) => {
    setSelectedMonitoringItems((prev) => {
      const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
      setFormData((current) => ({
        ...current,
        monitoring_plan: formatMonitoringPlan(next),
      }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      return next;
    });
  };

  const buildActivitySuggestionsFromOrders = (orders: any[]) => {
    const suggestions = new Set<string>();
    if (orders.length === 0) {
      return [] as string[];
    }

    suggestions.add("Aktivitas ringan, hindari aktivitas berat sampai evaluasi hasil penunjang");
    suggestions.add("Datang tepat waktu sesuai jadwal pemeriksaan penunjang");

    const content = orders
      .flatMap((order) => [order?.clinical_notes, order?.notes, ...(order?.items || []).map((item: any) => item?.notes), ...(order?.items || []).map((item: any) => item?.procedure?.name)])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/(puasa|fasting|npo)/.test(content)) {
      suggestions.add("Puasa sesuai instruksi sebelum pemeriksaan");
    }
    if (/(kontras|contrast|sedasi|sedation)/.test(content)) {
      suggestions.add("Observasi pasca pemeriksaan kontras/sedasi sesuai instruksi dokter");
    }

    return Array.from(suggestions);
  };

  const handleSyncActivityFromSupportOrders = async () => {
    setSyncingActivityFromSupportOrders(true);
    try {
      const [radRes, labRes] = await Promise.allSettled([
        procedureOrdersApi.getBySourceVisit(visitId, "radiology"),
        procedureOrdersApi.getBySourceVisit(visitId, "laboratory"),
      ]);

      const radOrders = radRes.status === "fulfilled" ? asArray<any>(radRes.value.data).filter((o) => o?.status !== "cancelled") : [];
      const labOrders = labRes.status === "fulfilled" ? asArray<any>(labRes.value.data).filter((o) => o?.status !== "cancelled") : [];
      const suggestions = buildActivitySuggestionsFromOrders([...radOrders, ...labOrders]);

      if (suggestions.length === 0) {
        toast({
          title: "Data belum tersedia",
          description: "Belum ada order penunjang radiologi/lab yang relevan untuk aktivitas.",
          variant: "destructive",
        });
        return;
      }

      setActivityOrderSuggestions(suggestions);
      setSelectedActivityItems((prev) => {
        const merged = Array.from(new Set([...prev, ...suggestions]));
        setFormData((current) => ({
          ...current,
          activity_plan: formatActivityPlan(merged),
        }));
        emitMedicalRecordTabSaved("assessment-plan", false);
        return merged;
      });

      toast({
        title: "Berhasil",
        description: "Saran aktivitas dari order penunjang berhasil diterapkan. Silakan review checkbox.",
      });
    } catch {
      toast({
        title: "Gagal",
        description: "Tidak dapat mengambil saran aktivitas dari order penunjang.",
        variant: "destructive",
      });
    } finally {
      setSyncingActivityFromSupportOrders(false);
    }
  };

  const asArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) {
      return value as T[];
    }
    if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
      const inner = (value as { data?: unknown }).data;
      return Array.isArray(inner) ? (inner as T[]) : [];
    }
    return [];
  };

  const handleAutoGenerateClinicalAssessment = async () => {
    setGeneratingClinicalAssessment(true);
    try {
      const response = await medicalRecordsApi.get(visitId);
      const summary = response.data as MedicalRecordSummary;

      const anamnesis = summary?.anamnesis;
      const physical = summary?.physical_exam;
      const diagnosis = summary?.diagnosis;

      const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      const pickFirstText = (...values: unknown[]) => values.map(toText).find(Boolean) || "-";

      const chiefComplaint = pickFirstText(anamnesis?.chief_complaint);
      const presentIllness = pickFirstText(anamnesis?.history_of_present_illness);

      const generalCondition = pickFirstText(physical?.general_condition);
      const consciousness = pickFirstText(physical?.consciousness);
      const bloodPressure = pickFirstText(physical?.blood_pressure, `${physical?.blood_pressure_systolic || ""}/${physical?.blood_pressure_diastolic || ""}`.replace(/^\/$/, ""));
      const heartRate = pickFirstText(physical?.heart_rate);
      const respiratoryRate = pickFirstText(physical?.respiratory_rate);
      const temperature = pickFirstText(physical?.temperature);

      const diagnosisItems = Array.isArray(diagnosis?.items) ? diagnosis.items : [];
      const primaryDiagnosis = diagnosisItems.find((item: any) => item?.diagnosis_type === "primary");
      const secondaryDiagnoses = diagnosisItems.filter((item: any) => item?.diagnosis_type !== "primary");
      const diagnosisSummary = pickFirstText(diagnosis?.clinical_impression);

      const primaryDiagnosisText = primaryDiagnosis
        ? `${primaryDiagnosis.icd10_code ? `${primaryDiagnosis.icd10_code} - ` : ""}${primaryDiagnosis.icd10_name || "Diagnosis utama"}`
        : "-";

      const secondaryText = secondaryDiagnoses.length > 0
        ? secondaryDiagnoses
            .slice(0, 3)
            .map((item: any) => `${item?.icd10_code ? `${item.icd10_code} - ` : ""}${item?.icd10_name || "Diagnosis"}`)
            .join("; ")
        : "-";

      const hasEnoughData = chiefComplaint !== "-" || presentIllness !== "-" || primaryDiagnosisText !== "-" || diagnosisSummary !== "-";
      if (!hasEnoughData) {
        toast({
          title: "Data belum cukup",
          description: "Lengkapi Anamnesis, Pemeriksaan Fisik, atau Diagnosis terlebih dahulu untuk auto generate.",
          variant: "destructive",
        });
        return;
      }

      const generatedText = [
        "Ringkasan klinis (auto-generate, silakan review):",
        "",
        "1. Anamnesis",
        `- Keluhan utama: ${chiefComplaint}`,
        `- Riwayat penyakit sekarang: ${presentIllness}`,
        "",
        "2. Pemeriksaan fisik",
        `- Keadaan umum: ${generalCondition}`,
        `- Kesadaran: ${consciousness}`,
        `- TD: ${bloodPressure}; Nadi: ${heartRate}; RR: ${respiratoryRate}; Suhu: ${temperature}`,
        "",
        "3. Diagnosis",
        `- Diagnosis utama: ${primaryDiagnosisText}`,
        `- Diagnosis penyerta/banding: ${secondaryText}`,
        `- Kesan diagnosis: ${diagnosisSummary}`,
      ].join("\n");

      setFormData((prev) => ({ ...prev, clinical_assessment: generatedText }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      toast({
        title: "Berhasil",
        description: "Kesan Klinis berhasil di-generate dari Anamnesis, Pemeriksaan Fisik, dan Diagnosis.",
      });
    } catch {
      toast({
        title: "Gagal generate",
        description: "Tidak dapat mengambil data ringkasan medis untuk auto generate.",
        variant: "destructive",
      });
    } finally {
      setGeneratingClinicalAssessment(false);
    }
  };

  const buildMedicationPlanFromOrders = async () => {
    const response = await medicineOrdersApi.getAll({ source_visit_id: visitId });
    const orders = asArray<any>(response.data);
    const activeOrders = orders.filter((order) => order?.status !== "cancelled");
    const itemLines = activeOrders.flatMap((order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      return items.map((item: any) => {
        const medicineName = item?.medicine?.name || item?.medicine_name || "Obat";
        const dosage = item?.dosage ? `, dosis ${item.dosage}` : "";
        const frequency = item?.frequency ? `, frekuensi ${item.frequency}` : "";
        const duration = item?.duration ? `, durasi ${item.duration}` : "";
        const route = item?.route ? `, rute ${item.route}` : "";
        return `- ${medicineName}${dosage}${frequency}${route}${duration}`;
      });
    });

    if (itemLines.length === 0) return "";
    return ["Rencana obat (diambil dari Order Obat):", ...itemLines].join("\n");
  };

  const buildProcedurePlanFromOrders = async () => {
    const response = await visitProceduresApi.getAll(visitId);
    const procedures = asArray<any>(response.data);
    const activeProcedures = procedures.filter((p) => p?.status !== "cancelled");
    const procedureLines = activeProcedures.map((p) => {
      const procedureName = p?.procedure?.name || "Tindakan";
      const status = p?.status ? ` (${p.status})` : "";
      const note = p?.notes ? ` - ${p.notes}` : "";
      return `- ${procedureName}${status}${note}`;
    });

    if (procedureLines.length === 0) return "";
    return ["Rencana tindakan (diambil dari Tindakan):", ...procedureLines].join("\n");
  };

  const buildConsultationPlanFromOrders = async () => {
    const response = await procedureOrdersApi.getBySourceVisit(visitId, "consultation");
    const orders = asArray<any>(response.data);
    const toTimestamp = (value?: string) => {
      if (!value) return Number.NaN;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? Number.NaN : time;
    };

    const getConsultationOrderTime = (order: any) => {
      const candidates = [
        order?.completed_at,
        order?.consultation?.updated_at,
        order?.consultation?.created_at,
        order?.updated_at,
        order?.created_at,
      ];

      for (const candidate of candidates) {
        const ts = toTimestamp(candidate);
        if (!Number.isNaN(ts)) return ts;
      }

      return Number.POSITIVE_INFINITY;
    };

    const activeOrders = orders
      .filter((order) => order?.status !== "cancelled")
      .sort((a, b) => {
        const ta = getConsultationOrderTime(a);
        const tb = getConsultationOrderTime(b);
        if (ta !== tb) return ta - tb;
        return (a?.id || 0) - (b?.id || 0);
      });

    const consultationBlocks = activeOrders.map((order, index) => {
      const targetRoom = order?.target_room?.name ? ` ke ${order.target_room.name}` : "";
      const consultantName = order?.consultation?.consultant?.nama_lengkap;
      const resultSummary = order?.result_summary?.trim?.() || "";
      const subjective = order?.consultation?.subjective?.trim?.() || "";
      const objective = order?.consultation?.objective?.trim?.() || "";
      const plan = order?.consultation?.plan?.trim?.() || "";
      const recommendation = order?.consultation?.recommendation?.trim?.() || "";
      const assessment = order?.consultation?.assessment?.trim?.() || "";
      const baseHeader = `- Konsultasi ${index + 1}${targetRoom}${consultantName ? ` (dr. ${consultantName})` : ""}`;

      if (resultSummary) {
        const formattedSummary = resultSummary
          .split("\n")
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => `  ${line}`)
          .join("\n");
        return [baseHeader, formattedSummary].join("\n");
      }

      if (subjective || objective || assessment || plan || recommendation) {
        const answerLines = [
          subjective ? `  S: ${subjective}` : "",
          objective ? `  O: ${objective}` : "",
          assessment ? `  A: ${assessment}` : "",
          plan ? `  P: ${plan}` : "",
          recommendation ? `  Rekomendasi: ${recommendation}` : "",
        ].filter(Boolean);
        return [baseHeader, ...answerLines].join("\n");
      }

      const notes = order?.clinical_notes || order?.notes || "";
      return `${baseHeader}${notes ? `\n  Catatan order: ${notes}` : ""}`;
    });

    if (consultationBlocks.length === 0) return "";
    return [
      "Rencana konsultasi (diambil dari jawaban dokter konsulen):",
      "",
      consultationBlocks.join("\n\n"),
    ].join("\n");
  };

  const handleSyncMedicationPlanFromOrders = async () => {
    setSyncingMedicationPlan(true);
    try {
      const medicationPlan = await buildMedicationPlanFromOrders();
      if (!medicationPlan) {
        toast({
          title: "Data belum tersedia",
          description: "Belum ada data Order Obat yang bisa diambil.",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({ ...prev, medication_plan: medicationPlan }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      toast({ title: "Berhasil", description: "Rencana Obat diambil dari Order Obat." });
    } catch {
      toast({
        title: "Gagal sinkronisasi",
        description: "Terjadi kendala saat mengambil Order Obat.",
        variant: "destructive",
      });
    } finally {
      setSyncingMedicationPlan(false);
    }
  };

  const handleSyncProcedurePlanFromOrders = async () => {
    setSyncingProcedurePlan(true);
    try {
      const procedurePlan = await buildProcedurePlanFromOrders();
      if (!procedurePlan) {
        toast({
          title: "Data belum tersedia",
          description: "Belum ada data Tindakan yang bisa diambil.",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({ ...prev, procedure_plan: procedurePlan }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      toast({ title: "Berhasil", description: "Rencana Tindakan diambil dari data Tindakan." });
    } catch {
      toast({
        title: "Gagal sinkronisasi",
        description: "Terjadi kendala saat mengambil data Tindakan.",
        variant: "destructive",
      });
    } finally {
      setSyncingProcedurePlan(false);
    }
  };

  const handleSyncConsultationPlanFromOrders = async () => {
    setSyncingConsultationPlan(true);
    try {
      const consultationPlan = await buildConsultationPlanFromOrders();
      if (!consultationPlan) {
        toast({
          title: "Data belum tersedia",
          description: "Belum ada data Order Konsultasi/Jawaban Konsulen yang bisa diambil.",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({ ...prev, consultation_plan: consultationPlan }));
      emitMedicalRecordTabSaved("assessment-plan", false);
      toast({ title: "Berhasil", description: "Rencana Konsultasi diambil dari jawaban dokter konsulen." });
    } catch {
      toast({
        title: "Gagal sinkronisasi",
        description: "Terjadi kendala saat mengambil Order Konsultasi.",
        variant: "destructive",
      });
    } finally {
      setSyncingConsultationPlan(false);
    }
  };

  const handleGenerateTreatmentPlanFromDetails = () => {
    const sections = [
      { label: "Rencana Obat", value: formData.medication_plan },
      { label: "Rencana Diet", value: formData.diet_plan },
      { label: "Rencana Aktivitas", value: formData.activity_plan },
      { label: "Rencana Edukasi", value: formData.education_plan },
      { label: "Rencana Tindakan", value: formData.procedure_plan },
      { label: "Rencana Konsultasi", value: formData.consultation_plan },
      { label: "Rencana Monitoring", value: formData.monitoring_plan },
    ]
      .map((item) => ({ label: item.label, value: item.value?.trim?.() || "" }))
      .filter((item) => item.value.length > 0);

    if (sections.length === 0) {
      toast({
        title: "Data belum ada",
        description: "Isi salah satu rencana detail dulu sebelum generate Rencana Penatalaksanaan.",
        variant: "destructive",
      });
      return;
    }

    const compactText = (value: string) =>
      value
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" | ");

    const generated = [
      "Ringkasan rencana penatalaksanaan:",
      ...sections.map((item) => `- ${item.label}: ${compactText(item.value)}`),
    ].join("\n");

    setFormData((prev) => ({
      ...prev,
      treatment_plan: generated,
    }));
    emitMedicalRecordTabSaved("assessment-plan", false);
    toast({
      title: "Berhasil",
      description: "Rencana Penatalaksanaan terisi otomatis dari rencana detail.",
    });
  };

  const doSave = async () => {
    setSaving(true);
    
    // Log edit if patient is discharged
    if (isPatientDischarged && assessmentPlanId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "assessment_plan",
          record_id: assessmentPlanId,
          action: "edit",
          reason: editReason || "Edit setelah pasien pulang",
        });
      } catch (error) {
        console.error("Failed to log edit:", error);
      }
    }
    
    try {
      const response = await medicalRecordsApi.saveAssessmentPlan(visitId, formData);
      toast({
        title: "Berhasil",
        description: "Assessment & Plan berhasil disimpan",
      });
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      emitMedicalRecordTabSaved("assessment-plan", true);
      clearFormDraft(`mr-draft-assessment-plan-${visitId}`);
      onSave?.(response.data);
      resetEditMode();
    } catch {
      toast({
        title: "Gagal",
        description: "Gagal menyimpan Assessment & Plan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If patient is discharged, verify PIN before saving
    if (isPatientDischarged) {
      requestPINVerification(doSave);
      return;
    }
    
    doSave();
  };

  const filledMainFields = [
    formData.clinical_assessment,
    formData.treatment_plan,
    formData.prognosis,
    formData.medication_plan,
    formData.diet_plan,
    formData.activity_plan,
    formData.education_plan,
    formData.procedure_plan,
    formData.consultation_plan,
    formData.monitoring_plan,
    formData.informed_consent
  ].filter(v => v && v.trim() !== "").length;

  const filledDetailFields = [
    formData.medication_plan,
    formData.diet_plan,
    formData.activity_plan,
    formData.education_plan,
    formData.procedure_plan,
    formData.consultation_plan,
  ].filter(v => v && v.trim() !== "").length;

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator("assessment-plan", `${filledMainFields}/11`);
  }, [filledMainFields, loading]);

  // Auto-save draft to localStorage on every form change
  useEffect(() => {
    if (loading) return;
    saveFormDraft(`mr-draft-assessment-plan-${visitId}`, formData);
  }, [formData, loading, visitId]);

  // Clear draft when save is confirmed by server
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "assessment-plan" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-assessment-plan-${visitId}`);
      }
    };
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
    return () => window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
  }, [visitId]);

  // Listen for copy-from-history events
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ section: string; data: any }>;
      if (ev.detail?.section !== "assessment-plan" || !ev.detail.data) return;
      clearPendingCopy("assessment-plan");
      const d = ev.detail.data;
      setSelectedDietItems(extractSelectedItems(d.diet_plan, DIET_CHECKLIST_OPTIONS));
      setSelectedEducationItems(buildEducationSelections(d.education_plan, d.informed_consent));
      setSelectedActivityItems(extractSelectedItems(d.activity_plan, BASE_ACTIVITY_OPTIONS));
      setSelectedMonitoringItems(extractSelectedItems(d.monitoring_plan, MONITORING_CHECKLIST_OPTIONS));
      setFormData({
        clinical_assessment: d.clinical_assessment || "",
        prognosis: d.prognosis || "",
        treatment_plan: d.treatment_plan || "",
        medication_plan: d.medication_plan || "",
        diet_plan: d.diet_plan || "",
        activity_plan: d.activity_plan || "",
        education_plan: d.education_plan || "",
        monitoring_plan: d.monitoring_plan || "",
        procedure_plan: d.procedure_plan || "",
        consultation_plan: d.consultation_plan || "",
        informed_consent: d.informed_consent || "",
      });
      emitMedicalRecordTabSaved("assessment-plan", false);
    };
    window.addEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
    return () => window.removeEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
  }, []);

  if (loading) {
    return (
      <div>
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
            <EditModeBanner
              isPatientDischarged={isPatientDischarged}
              isEditing={isEditing}
              onRequestEdit={handleRequestEdit}
              recordTypeLabel="Assessment & Plan"
            />
        <form onSubmit={handleSubmit}>
          <fieldset disabled={isFormDisabled} className="space-y-4 sm:space-y-6">
          
          {/* Section 1: Asesmen Klinis */}
          <div className="space-y-4">{/* Clinical Assessment / Clinical Impression */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label htmlFor="clinical_assessment" className="text-sm font-semibold">
                    Kesan Klinis (Clinical Impression) <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full sm:w-auto"
                    onClick={handleAutoGenerateClinicalAssessment}
                    disabled={isFormDisabled || generatingClinicalAssessment}
                  >
                    {generatingClinicalAssessment ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <WandSparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    Ambil dari Anamnesis, Pemeriksaan, dan Diagnosis
                  </Button>
                </div>
                <Textarea
                  id="clinical_assessment"
                  placeholder="Ringkasan kesan klinis berdasarkan anamnesis dan pemeriksaan fisik. Contoh: Pasien dengan gejala dispepsia fungsional, tidak ditemukan tanda bahaya (red flags)..."
                  value={formData.clinical_assessment}
                  onChange={(e) => handleChange("clinical_assessment", e.target.value)}
                  className="min-h-[150px] resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ringkasan kondisi klinis pasien berdasarkan anamnesis, pemeriksaan fisik, dan diagnosis kerja. Gunakan tombol Auto Generate untuk membuat draft otomatis.
                </p>
              </div>

              {/* Prognosis */}
              <div className="space-y-2">
                <Label htmlFor="prognosis" className="text-sm font-semibold">
                  Prognosis
                </Label>
                <Textarea
                  id="prognosis"
                  placeholder="Perkiraan luaran pasien berdasarkan kondisi klinis saat ini..."
                  value={formData.prognosis}
                  onChange={(e) => handleChange("prognosis", e.target.value)}
                  onBlur={(e) => addPrognosisOption(e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isFormDisabled}
                />
                <div className="flex flex-wrap gap-2">
                  {prognosisOptions.map((option) => {
                    const isActive = formData.prognosis.trim().toLowerCase() === option.toLowerCase();
                    return (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className="h-7"
                        disabled={isFormDisabled}
                        onClick={() => {
                          handleChange("prognosis", option);
                          addPrognosisOption(option);
                        }}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Klik pilihan cepat atau isi manual. Jika isi manual baru, nilainya otomatis ditambahkan ke daftar pilihan.
                </p>
              </div>
          </div>

          {/* Section 2: Monitoring */}
          <div className="space-y-4">
              {/* Monitoring Plan */}
              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="monitoring_plan" className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Rencana Monitoring
                </Label>
                <p className="text-xs text-muted-foreground">Checklist monitoring (otomatis terisi ke rencana)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MONITORING_CHECKLIST_OPTIONS.map((item) => (
                    <label key={item} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selectedMonitoringItems.includes(item)}
                        onCheckedChange={() => handleToggleMonitoringItem(item)}
                        disabled={isFormDisabled}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap min-h-[72px]">
                  {formData.monitoring_plan || "Belum ada pilihan monitoring"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tentukan apa yang dipantau, frekuensi monitoring, serta target/peringatan klinisnya.
                </p>
              </div>
          </div>

          {/* Section 3: Rencana Detail */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={filledDetailFields > 0 ? "default" : "outline"}>
                {filledDetailFields}/6
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Gunakan tombol per bagian untuk mengambil data order sesuai kebutuhan, tanpa menimpa semua rencana sekaligus.
            </p>
              <div className="space-y-4">
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label htmlFor="medication_plan" className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      Rencana Obat
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:w-auto"
                      onClick={handleSyncMedicationPlanFromOrders}
                      disabled={isFormDisabled || syncingMedicationPlan}
                    >
                      {syncingMedicationPlan ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WandSparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      Ambil dari Order Obat
                    </Button>
                  </div>
                  <Textarea
                    id="medication_plan"
                    placeholder="Obat-obatan yang akan diberikan..."
                    value={formData.medication_plan}
                    onChange={(e) => handleChange("medication_plan", e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="diet_plan" className="text-sm flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                    Rencana Diet
                  </Label>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Checklist diet (otomatis terisi ke rencana)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DIET_CHECKLIST_OPTIONS.map((item) => (
                        <label key={item} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={selectedDietItems.includes(item)}
                            onCheckedChange={() => handleToggleDietItem(item)}
                            disabled={isFormDisabled}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap min-h-[72px]">
                    {formData.diet_plan || "Belum ada pilihan diet"}
                  </div>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label htmlFor="activity_plan" className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Rencana Aktivitas
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:w-auto"
                      onClick={handleSyncActivityFromSupportOrders}
                      disabled={isFormDisabled || syncingActivityFromSupportOrders}
                    >
                      {syncingActivityFromSupportOrders ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WandSparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      Ambil Saran dari Order Penunjang
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Checklist aktivitas. Saran radiologi/lab akan ditambahkan otomatis saat tombol ditekan.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from(new Set([...BASE_ACTIVITY_OPTIONS, ...activityOrderSuggestions])).map((item) => (
                      <label key={item} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={selectedActivityItems.includes(item)}
                          onCheckedChange={() => handleToggleActivityItem(item)}
                          disabled={isFormDisabled}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                  <Textarea
                    id="activity_plan"
                    placeholder="Anjuran aktivitas fisik..."
                    value={formData.activity_plan}
                    onChange={(e) => handleChange("activity_plan", e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="education_plan" className="text-sm flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    Rencana Edukasi
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Opsional</Badge>
                  </Label>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Checklist edukasi (otomatis terisi ke rencana)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EDUCATION_CHECKLIST_OPTIONS.map((item) => (
                        <label key={item} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={selectedEducationItems.includes(item)}
                            onCheckedChange={() => handleToggleEducationItem(item)}
                            disabled={isFormDisabled}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap min-h-[72px]">
                    {formData.education_plan || "Belum ada pilihan edukasi"}
                  </div>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label htmlFor="procedure_plan" className="text-sm flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      Rencana Tindakan
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:w-auto"
                      onClick={handleSyncProcedurePlanFromOrders}
                      disabled={isFormDisabled || syncingProcedurePlan}
                    >
                      {syncingProcedurePlan ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WandSparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      Ambil dari Tindakan
                    </Button>
                  </div>
                  <Textarea
                    id="procedure_plan"
                    placeholder="Prosedur/tindakan yang akan dilakukan..."
                    value={formData.procedure_plan}
                    onChange={(e) => handleChange("procedure_plan", e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label htmlFor="consultation_plan" className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Rencana Konsultasi
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:w-auto"
                      onClick={handleSyncConsultationPlanFromOrders}
                      disabled={isFormDisabled || syncingConsultationPlan}
                    >
                      {syncingConsultationPlan ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WandSparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      Ambil dari Order Konsultasi
                    </Button>
                  </div>
                  <Textarea
                    id="consultation_plan"
                    placeholder="Konsultasi ke spesialis yang diperlukan..."
                    value={formData.consultation_plan}
                    onChange={(e) => handleChange("consultation_plan", e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>
          </div>

          {/* Section 4: Rencana Penatalaksanaan */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label htmlFor="treatment_plan" className="text-sm font-semibold">
                Rencana Penatalaksanaan <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full sm:w-auto"
                onClick={handleGenerateTreatmentPlanFromDetails}
                disabled={isFormDisabled}
              >
                <WandSparkles className="mr-1 h-3.5 w-3.5" />
                Ambil dari 6 Rencana
              </Button>
            </div>
            <Textarea
              id="treatment_plan"
              placeholder="Rencana penatalaksanaan yang akan dilakukan:
• Farmakologi: Obat-obatan yang akan diberikan
• Non-farmakologi: Diet, edukasi, modifikasi gaya hidup
• Pemeriksaan penunjang: Lab, radiologi yang diperlukan
• Konsultasi: Rujukan ke spesialis jika diperlukan
• Monitoring: Parameter yang perlu dipantau"
              value={formData.treatment_plan}
              onChange={(e) => handleChange("treatment_plan", e.target.value)}
              className="min-h-[180px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Letaknya dipindah ke paling bawah agar tidak terlewat. Gunakan tombol "Ambil dari 6 Rencana" untuk membuat ringkasan otomatis.
            </p>
          </div>

          {/* Submit Button */}
          {!isFormDisabled && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Assessment & Plan
            </Button>
          </div>
          )}
          </fieldset>
        </form>
      </div>
      <EditConfirmDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editReason={editReason}
        onEditReasonChange={setEditReason}
        onConfirm={handleConfirmEdit}
      />
      <PINVerificationDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        pin={pin}
        verifying={verifyingPIN}
        pinInputRefs={pinInputRefs}
        onPINChange={handlePINChange}
        onPINKeyDown={handlePINKeyDown}
        onVerify={handleVerifyPIN}
      />
    </div>
  );
}
