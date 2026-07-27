import { useState, useEffect, useMemo, Fragment } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Save,
  Loader2,
  Heart,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Activity,
  Stethoscope,
} from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import type { PhysicalExam } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  useEditMode,
  EditModeBanner,
  EditConfirmDialog,
  PINVerificationDialog,
} from "./edit-mode-controller";
import {
  emitMedicalRecordTabIndicator,
  emitMedicalRecordTabSaved,
  MEDICAL_RECORD_TAB_SAVED_EVENT,
} from "./tab-indicator";
import { COPY_FROM_HISTORY_EVENT } from "./copy-from-history-drawer";
import {
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  loadPendingCopy,
  clearPendingCopy,
} from "@/lib/form-persistence";
import { useToast } from "@/hooks/use-toast";

interface PhysicalExamFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  isEmergency?: boolean;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
  externalData?: Partial<PhysicalExam>;
  useExternalData?: boolean;
  footerSaveOnly?: boolean;
}

// Physical exam sections
const physicalExamSections = [
  {
    id: "head",
    label: "Kepala",
    defaultNormal:
      "Normocephal, tidak ada deformitas, rambut distribusi merata",
  },
  {
    id: "eyes",
    label: "Mata",
    defaultNormal:
      "Konjungtiva anemis (-/-), sklera ikterik (-/-), pupil isokor 3mm/3mm, refleks cahaya (+/+)",
  },
  {
    id: "ears",
    label: "Telinga",
    defaultNormal:
      "Serumen minimal, membran timpani intak bilateral, nyeri tekan tragus (-/-)",
  },
  {
    id: "nose",
    label: "Hidung",
    defaultNormal:
      "Septum deviasi (-), sekret (-/-), pernapasan cuping hidung (-)",
  },
  {
    id: "throat",
    label: "Tenggorokan",
    defaultNormal: "Faring tidak hiperemis, tonsil T1/T1, uvula di tengah",
  },
  {
    id: "neck",
    label: "Leher",
    defaultNormal:
      "JVP tidak meningkat, pembesaran KGB (-), kaku kuduk (-), tiroid tidak teraba membesar",
  },
  {
    id: "chest",
    label: "Dada/Thorax",
    defaultNormal:
      "Bentuk dan pergerakan simetris, retraksi (-), fremitus taktil simetris",
  },
  {
    id: "heart",
    label: "Jantung",
    defaultNormal:
      "BJ I-II reguler, murmur (-), gallop (-), batas jantung dalam batas normal",
  },
  {
    id: "lungs",
    label: "Paru",
    defaultNormal: "Suara napas vesikuler (+/+), ronkhi (-/-), wheezing (-/-)",
  },
  {
    id: "abdomen",
    label: "Abdomen",
    defaultNormal:
      "Datar, supel, bising usus (+) normal, hepar/lien tidak teraba, nyeri tekan (-)",
  },
  {
    id: "extremities",
    label: "Ekstremitas",
    defaultNormal:
      "Akral hangat, CRT <2 detik, edema (-/-), kekuatan motorik 5/5",
  },
  {
    id: "skin",
    label: "Kulit",
    defaultNormal:
      "Warna sawo matang, turgor baik, tidak pucat, tidak ikterik, ruam (-)",
  },
  {
    id: "neurological",
    label: "Neurologis",
    defaultNormal:
      "GCS E4V5M6 (15), refleks fisiologis (+) normal, refleks patologis (-), meningeal sign (-)",
  },
];

const calculateBMI = (weight: number, height: number): number => {
  const h = height / 100;
  if (weight > 0 && h > 0) {
    return Math.round((weight / (h * h)) * 10) / 10;
  }
  return 0;
};

const getBMICategory = (bmi: number): { label: string; color: string } => {
  if (bmi === 0) return { label: "-", color: "text-muted-foreground" };
  if (bmi < 18.5) return { label: "Underweight", color: "text-yellow-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-orange-600" };
  return { label: "Obese", color: "text-red-600" };
};

type VitalStatus = "none" | "low" | "high" | "borderline" | "normal";

const getVitalStatus = (
  value: number,
  normalMin: number,
  normalMax: number,
  warningMin?: number,
  warningMax?: number,
): VitalStatus => {
  if (!value || value <= 0) return "none";

  if (value < normalMin) {
    if (warningMin !== undefined && value >= warningMin) return "borderline";
    return "low";
  }

  if (value > normalMax) {
    if (warningMax !== undefined && value <= warningMax) return "borderline";
    return "high";
  }

  return "normal";
};

const getVitalStatusLabel = (status: VitalStatus) => {
  switch (status) {
    case "low":
      return "Di bawah";
    case "high":
      return "Di atas";
    case "borderline":
      return "Batas";
    case "normal":
      return "Normal";
    default:
      return null;
  }
};

const getVitalStatusBadgeClass = (status: VitalStatus) => {
  switch (status) {
    case "normal":
      return "bg-green-50 text-green-700 border-green-200";
    case "borderline":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "low":
    case "high":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "";
  }
};

const getVitalStatusInputClass = (status: VitalStatus) => {
  switch (status) {
    case "normal":
      return "border-green-300 focus-visible:ring-green-500";
    case "borderline":
      return "border-yellow-300 focus-visible:ring-yellow-500";
    case "low":
    case "high":
      return "border-red-300 focus-visible:ring-red-500";
    default:
      return "";
  }
};

const defaultFormData = {
  general_condition: "",
  consciousness: "",
  blood_pressure_systolic: "",
  blood_pressure_diastolic: "",
  heart_rate: "",
  respiratory_rate: "",
  temperature: "",
  oxygen_saturation: "",
  weight: "",
  height: "",
  bmi: 0,
  upper_arm_circum: "",
  head_circum: "",
  waist: "",
  head: "",
  eyes: "",
  ears: "",
  nose: "",
  throat: "",
  neck: "",
  chest: "",
  heart: "",
  lungs: "",
  abdomen: "",
  extremities: "",
  skin: "",
  neurological: "",
  other_findings: "",
  ecg_performed: false,
  ecg_result: "",
  ecg_interpretation: "",
  ecg_notes: "",
  ctg_performed: false,
  ctg_result: "",
  ctg_interpretation: "",
  ctg_notes: "",
  pelvic_performed: false,
  pelvic_result: "",
  pelvic_notes: "",
  pain_method: "nrs",
  pain_scale: 0,
  pain_location: "Tidak ada nyeri",
};

const parseBloodPressure = (
  value: string | null | undefined,
): { systolic: number; diastolic: number } => {
  if (!value) return { systolic: 0, diastolic: 0 };
  const match = value.match(/(\d{2,3})\s*\/?\s*(\d{2,3})/);
  if (!match) return { systolic: 0, diastolic: 0 };
  return {
    systolic: Number(match[1]) || 0,
    diastolic: Number(match[2]) || 0,
  };
};

const painLocationOptionsBase = [
  { value: "kepala", label: "Kepala" },
  { value: "wajah", label: "Wajah" },
  { value: "mata", label: "Mata" },
  { value: "telinga", label: "Telinga" },
  { value: "hidung", label: "Hidung" },
  { value: "mulut", label: "Mulut" },
  { value: "gigi", label: "Gigi" },
  { value: "rahang", label: "Rahang" },
  { value: "leher", label: "Leher" },
  { value: "bahu_kanan", label: "Bahu Kanan" },
  { value: "bahu_kiri", label: "Bahu Kiri" },
  { value: "lengan_atas_kanan", label: "Lengan Atas Kanan" },
  { value: "lengan_atas_kiri", label: "Lengan Atas Kiri" },
  { value: "siku_kanan", label: "Siku Kanan" },
  { value: "siku_kiri", label: "Siku Kiri" },
  { value: "lengan_bawah_kanan", label: "Lengan Bawah Kanan" },
  { value: "lengan_bawah_kiri", label: "Lengan Bawah Kiri" },
  { value: "pergelangan_tangan_kanan", label: "Pergelangan Tangan Kanan" },
  { value: "pergelangan_tangan_kiri", label: "Pergelangan Tangan Kiri" },
  { value: "tangan_kanan", label: "Tangan Kanan" },
  { value: "tangan_kiri", label: "Tangan Kiri" },
  { value: "jari_tangan", label: "Jari Tangan" },
  { value: "dada", label: "Dada" },
  { value: "payudara", label: "Payudara" },
  { value: "ulu_hati", label: "Ulu Hati / Epigastrium" },
  { value: "perut_atas", label: "Perut Atas" },
  { value: "perut_bawah", label: "Perut Bawah" },
  { value: "perut_kanan_atas", label: "Perut Kanan Atas" },
  { value: "perut_kiri_atas", label: "Perut Kiri Atas" },
  { value: "perut_kanan_bawah", label: "Perut Kanan Bawah" },
  { value: "perut_kiri_bawah", label: "Perut Kiri Bawah" },
  { value: "pinggang_kanan", label: "Pinggang Kanan" },
  { value: "pinggang_kiri", label: "Pinggang Kiri" },
  { value: "punggung_atas", label: "Punggung Atas" },
  { value: "punggung_tengah", label: "Punggung Tengah" },
  { value: "punggung_bawah", label: "Punggung Bawah" },
  { value: "bokong", label: "Bokong" },
  { value: "selangkangan", label: "Selangkangan" },
  { value: "genital", label: "Area Genital" },
  { value: "panggul", label: "Panggul" },
  { value: "paha_kanan", label: "Paha Kanan" },
  { value: "paha_kiri", label: "Paha Kiri" },
  { value: "lutut_kanan", label: "Lutut Kanan" },
  { value: "lutut_kiri", label: "Lutut Kiri" },
  { value: "betis_kanan", label: "Betis Kanan" },
  { value: "betis_kiri", label: "Betis Kiri" },
  { value: "tulang_kering", label: "Tulang Kering" },
  { value: "pergelangan_kaki_kanan", label: "Pergelangan Kaki Kanan" },
  { value: "pergelangan_kaki_kiri", label: "Pergelangan Kaki Kiri" },
  { value: "kaki_kanan", label: "Kaki Kanan" },
  { value: "kaki_kiri", label: "Kaki Kiri" },
  { value: "jari_kaki", label: "Jari Kaki" },
  { value: "seluruh_tubuh", label: "Seluruh Tubuh" },
  { value: "multi_lokasi", label: "Multi Lokasi" },
];

export function PhysicalExamForm({
  visitId,
  onSave,
  isEmergency = false,
  readOnly = false,
  isPatientDischarged = false,
  externalData,
  useExternalData = false,
  footerSaveOnly = false,
}: PhysicalExamFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [checkedSections, setCheckedSections] = useState<
    Record<string, boolean>
  >({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [physicalExamId, setPhysicalExamId] = useState<number | undefined>();

  // Fetch master data for general condition and consciousness
  const { getOptions } = useMultipleMasterData([
    "general_condition",
    "consciousness_level",
  ]);

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
    recordType: "physical_exam",
  });

  // Determine if form should be disabled
  const isFormDisabled =
    readOnly || (!useExternalData && isPatientDischarged && !isEditing);

  const applyLoadedData = (loadedData: typeof defaultFormData) => {
    setFormData(loadedData);
    const checked: Record<string, boolean> = {};
    physicalExamSections.forEach((section) => {
      const value = loadedData[section.id as keyof typeof loadedData];
      if (value && typeof value === "string" && value.trim() !== "") {
        checked[section.id] = true;
      }
    });
    setCheckedSections(checked);
  };

  useEffect(() => {
    if (useExternalData) {
      const d = externalData || {};
      const bp = parseBloodPressure((d as any).blood_pressure);
      const loadedData = {
        general_condition: d.general_condition || "",
        consciousness: d.consciousness || "",
        blood_pressure_systolic: String(
          (d as any).systolic ||
          (d as any).blood_pressure_systolic ||
          bp.systolic ||
          ""
        ),
        blood_pressure_diastolic: String(
          (d as any).diastolic ||
          (d as any).blood_pressure_diastolic ||
          bp.diastolic ||
          ""
        ),
        heart_rate: Number(d.heart_rate) ? String(Number(d.heart_rate)) : "",
        respiratory_rate: Number(d.respiratory_rate) ? String(Number(d.respiratory_rate)) : "",
        temperature: Number(d.temperature) ? String(Number(d.temperature)) : "",
        oxygen_saturation: Number(d.oxygen_saturation) ? String(Number(d.oxygen_saturation)) : "",
        weight: Number(d.weight) ? String(Number(d.weight)) : "",
        height: Number(d.height) ? String(Number(d.height)) : "",
        bmi: Number(d.bmi) || 0,
        upper_arm_circum: (d as any).upper_arm_circum || "",
        head_circum: d.head_circum || "",
        waist: d.waist || "",
        head: d.head || "",
        eyes: d.eyes || "",
        ears: d.ears || "",
        nose: d.nose || "",
        throat: d.throat || "",
        neck: d.neck || "",
        chest: d.chest || (d as any).thorax || "",
        heart: d.heart || (d as any).cardiac || "",
        lungs: d.lungs || (d as any).pulmonary || "",
        abdomen: d.abdomen || "",
        extremities: d.extremities || "",
        skin: d.skin || "",
        neurological: d.neurological || "",
        other_findings: d.other_findings || "",
        ecg_performed: (d as any).ecg_performed || false,
        ecg_result: (d as any).ecg_result || "",
        ecg_interpretation: (d as any).ecg_interpretation || "",
        ecg_notes: (d as any).ecg_notes || "",
        ctg_performed: (d as any).ctg_performed || false,
        ctg_result: (d as any).ctg_result || "",
        ctg_interpretation: (d as any).ctg_interpretation || "",
        ctg_notes: (d as any).ctg_notes || "",
        pelvic_performed: (d as any).pelvic_performed || false,
        pelvic_result: (d as any).pelvic_result || "",
        pelvic_notes: (d as any).pelvic_notes || "",
        pain_method: (d as any).pain_method || "nrs",
        pain_scale: Number((d as any).pain_scale) || 0,
        pain_location: (d as any).pain_location || "Tidak ada nyeri",
      };
      applyLoadedData(loadedData);
      setLoading(false);
      return;
    }

    const loadPhysicalExam = async () => {
      let hasExistingPhysicalExam = false;
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getPhysicalExam(visitId);
        const data = response.data as PhysicalExam & {
          ecg_performed?: boolean;
          ecg_result?: string;
          ecg_interpretation?: string;
          ecg_notes?: string;
          ctg_performed?: boolean;
          ctg_result?: string;
          ctg_interpretation?: string;
          ctg_notes?: string;
          pelvic_performed?: boolean;
          pelvic_result?: string;
          pelvic_notes?: string;
        };
        if (data && data.id) {
          hasExistingPhysicalExam = true;
          const parseNum = (val: string | number | undefined): number => {
            if (typeof val === "number") return val;
            if (typeof val === "string") return parseFloat(val) || 0;
            return 0;
          };

          const loadedData = {
            general_condition: data.general_condition || "",
            consciousness: data.consciousness || "",
            blood_pressure_systolic:
              data.systolic !== undefined ? String(data.systolic) : (data.blood_pressure_systolic !== undefined ? String(data.blood_pressure_systolic) : ""),
            blood_pressure_diastolic:
              data.diastolic !== undefined ? String(data.diastolic) : (data.blood_pressure_diastolic !== undefined ? String(data.blood_pressure_diastolic) : ""),
            heart_rate: parseNum(data.heart_rate) !== 0 ? String(parseNum(data.heart_rate)) : "",
            respiratory_rate: parseNum(data.respiratory_rate) !== 0 ? String(parseNum(data.respiratory_rate)) : "",
            temperature: parseNum(data.temperature) !== 0 ? String(parseNum(data.temperature)) : "",
            oxygen_saturation: parseNum(data.oxygen_saturation) !== 0 ? String(parseNum(data.oxygen_saturation)) : "",
            weight: parseNum(data.weight) !== 0 ? String(parseNum(data.weight)) : "",
            height: parseNum(data.height) !== 0 ? String(parseNum(data.height)) : "",
            bmi: data.bmi || 0,
            upper_arm_circum: data.upper_arm_circum || "",
            head_circum: data.head_circum || "",
            waist: data.waist || "",
            head: data.head || "",
            eyes: data.eyes || "",
            ears: data.ears || "",
            nose: data.nose || "",
            throat: data.throat || "",
            neck: data.neck || "",
            chest: data.chest || data.thorax || "",
            heart: data.heart || data.cardiac || "",
            lungs: data.lungs || data.pulmonary || "",
            abdomen: data.abdomen || "",
            extremities: data.extremities || "",
            skin: data.skin || "",
            neurological: data.neurological || "",
            other_findings: data.other_findings || "",
            ecg_performed: data.ecg_performed || false,
            ecg_result: data.ecg_result || "",
            ecg_interpretation: data.ecg_interpretation || "",
            ecg_notes: data.ecg_notes || "",
            ctg_performed: data.ctg_performed || false,
            ctg_result: data.ctg_result || "",
            ctg_interpretation: data.ctg_interpretation || "",
            ctg_notes: data.ctg_notes || "",
            pelvic_performed: data.pelvic_performed || false,
            pelvic_result: data.pelvic_result || "",
            pelvic_notes: data.pelvic_notes || "",
            pain_method: data.pain_method || "nrs",
            pain_scale: data.pain_scale || 0,
            pain_location: data.pain_location || "Tidak ada nyeri",
          };

          applyLoadedData(loadedData);
          setPhysicalExamId(data.id);
          emitMedicalRecordTabSaved("physical-exam", true);
        }
      } catch {
        // No existing data
      } finally {
        setLoading(false);
        // Apply local draft if exists — overrides server data if user had unsaved changes
        const draft = loadFormDraft<{
          formData: typeof defaultFormData;
          checkedSections: Record<string, boolean>;
        }>(`mr-draft-physical-exam-${visitId}`);
        if (draft) {
          if (!draft.formData.pain_location) draft.formData.pain_location = "Tidak ada nyeri";
          setFormData(draft.formData);
          setCheckedSections(draft.checkedSections);
          emitMedicalRecordTabSaved("physical-exam", false);
        }

        // Check for pending copy from history (takes priority over draft)
        const pendingCopy = loadPendingCopy<any>("physical-exam");
        if (pendingCopy) {
          const newData = {
            general_condition: pendingCopy.general_condition || "",
            consciousness: pendingCopy.consciousness || "",
            blood_pressure_systolic: String(
              pendingCopy.systolic || pendingCopy.blood_pressure_systolic || ""
            ),
            blood_pressure_diastolic: String(
              pendingCopy.diastolic || pendingCopy.blood_pressure_diastolic || ""
            ),
            heart_rate: pendingCopy.heart_rate ? String(pendingCopy.heart_rate) : "",
            respiratory_rate: pendingCopy.respiratory_rate ? String(pendingCopy.respiratory_rate) : "",
            temperature: pendingCopy.temperature ? String(pendingCopy.temperature) : "",
            oxygen_saturation: pendingCopy.oxygen_saturation ? String(pendingCopy.oxygen_saturation) : "",
            weight: pendingCopy.weight ? String(pendingCopy.weight) : "",
            height: pendingCopy.height ? String(pendingCopy.height) : "",
            bmi: Number(pendingCopy.bmi) || 0,
            upper_arm_circum: pendingCopy.upper_arm_circum || "",
            head_circum: pendingCopy.head_circum || "",
            waist: pendingCopy.waist || "",
            head: pendingCopy.head || "",
            eyes: pendingCopy.eyes || "",
            ears: pendingCopy.ears || "",
            nose: pendingCopy.nose || "",
            throat: pendingCopy.throat || "",
            neck: pendingCopy.neck || "",
            chest: pendingCopy.chest || pendingCopy.thorax || "",
            heart: pendingCopy.heart || pendingCopy.cardiac || "",
            lungs: pendingCopy.lungs || pendingCopy.pulmonary || "",
            abdomen: pendingCopy.abdomen || "",
            extremities: pendingCopy.extremities || "",
            skin: pendingCopy.skin || "",
            neurological: pendingCopy.neurological || "",
            other_findings: pendingCopy.other_findings || "",
            ecg_performed: pendingCopy.ecg_performed || false,
            ecg_result: pendingCopy.ecg_result || "",
            ecg_interpretation: pendingCopy.ecg_interpretation || "",
            ecg_notes: pendingCopy.ecg_notes || "",
            ctg_performed: pendingCopy.ctg_performed || false,
            ctg_result: pendingCopy.ctg_result || "",
            ctg_interpretation: pendingCopy.ctg_interpretation || "",
            ctg_notes: pendingCopy.ctg_notes || "",
            pelvic_performed: pendingCopy.pelvic_performed || false,
            pelvic_result: pendingCopy.pelvic_result || "",
            pelvic_notes: pendingCopy.pelvic_notes || "",
            pain_method: pendingCopy.pain_method || "nrs",
            pain_scale: Number(pendingCopy.pain_scale) || 0,
            pain_location: pendingCopy.pain_location || "",
          };
          applyLoadedData(newData);
          emitMedicalRecordTabSaved("physical-exam", false);
        }

        // Auto-load from triage when physical exam does not exist yet.
        if (!hasExistingPhysicalExam && !draft && !pendingCopy) {
          try {
            const triageRes = await medicalRecordsApi.getTriage(visitId);
            const triage = triageRes.data as any;
            if (triage?.id) {
              const bp = parseBloodPressure(triage.blood_pressure || "");
              setFormData((prev) => ({
                ...prev,
                consciousness: prev.consciousness || triage.consciousness || "",
                blood_pressure_systolic:
                  prev.blood_pressure_systolic ||
                  (bp.systolic ? String(bp.systolic) : ""),
                blood_pressure_diastolic:
                  prev.blood_pressure_diastolic ||
                  (bp.diastolic ? String(bp.diastolic) : ""),
                heart_rate:
                  prev.heart_rate ||
                  (triage.heart_rate ? String(triage.heart_rate) : ""),
                respiratory_rate:
                  prev.respiratory_rate ||
                  (triage.breathing_rate
                    ? String(triage.breathing_rate)
                    : triage.respiratory_rate
                    ? String(triage.respiratory_rate)
                    : ""),
                temperature:
                  prev.temperature ||
                  (triage.temperature ? String(triage.temperature) : ""),
                oxygen_saturation:
                  prev.oxygen_saturation ||
                  (triage.oxygen_saturation
                    ? String(triage.oxygen_saturation)
                    : ""),
                pain_method: triage.pain_method || prev.pain_method || "nrs",
                pain_scale: prev.pain_scale || Number(triage.pain_scale) || 0,
                pain_location: prev.pain_location || triage.pain_location || "",
              }));
              emitMedicalRecordTabSaved("physical-exam", false);
            }
          } catch {
            // Triage may not exist; ignore.
          }
        }
      }
    };

    loadPhysicalExam();
  }, [visitId, useExternalData, externalData]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "weight" || field === "height") {
        const weight = field === "weight" ? Number(value) : Number(prev.weight);
        const height = field === "height" ? Number(value) : Number(prev.height);
        updated.bmi = calculateBMI(weight, height);
      }
      return updated;
    });
    emitMedicalRecordTabSaved("physical-exam", false);
  };

  const handleCheckSection = (sectionId: string, checked: boolean) => {
    setCheckedSections((prev) => ({ ...prev, [sectionId]: checked }));

    if (checked) {
      // When checked, set normal value and expand row
      const section = physicalExamSections.find((s) => s.id === sectionId);
      if (section) {
        handleChange(sectionId, section.defaultNormal);
      }
      setExpandedRows((prev) => ({ ...prev, [sectionId]: true }));
    } else {
      // When unchecked, clear value and collapse
      handleChange(sectionId, "");
      setExpandedRows((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  const toggleRowExpand = (sectionId: string) => {
    setExpandedRows((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSetAllNormal = () => {
    const allChecked = physicalExamSections.every((s) => checkedSections[s.id]);

    if (allChecked) {
      // Uncheck all
      setCheckedSections({});
      setExpandedRows({});
      physicalExamSections.forEach((section) => {
        handleChange(section.id, "");
      });
    } else {
      // Check all with normal values
      const newChecked: Record<string, boolean> = {};
      physicalExamSections.forEach((section) => {
        newChecked[section.id] = true;
        handleChange(section.id, section.defaultNormal);
      });
      setCheckedSections(newChecked);
    }
  };

  const handleLoadFromTriage = async () => {
    try {
      const triageRes = await medicalRecordsApi.getTriage(visitId);
      const triage = triageRes.data as any;
      if (!triage?.id) {
        toast({
          variant: "destructive",
          title: "Data triase tidak ditemukan",
          description:
            "Belum ada data triase yang bisa dimuat ke pemeriksaan fisik.",
        });
        return;
      }

      const bp = parseBloodPressure(triage.blood_pressure || "");
      setFormData((prev) => ({
        ...prev,
        consciousness: triage.consciousness || prev.consciousness || "",
        blood_pressure_systolic:
          (bp.systolic ? String(bp.systolic) : "") || prev.blood_pressure_systolic,
        blood_pressure_diastolic:
          (bp.diastolic ? String(bp.diastolic) : "") || prev.blood_pressure_diastolic,
        heart_rate:
          (triage.heart_rate ? String(triage.heart_rate) : "") || prev.heart_rate,
        respiratory_rate:
          (triage.breathing_rate
            ? String(triage.breathing_rate)
            : triage.respiratory_rate
            ? String(triage.respiratory_rate)
            : "") || prev.respiratory_rate,
        temperature:
          (triage.temperature ? String(triage.temperature) : "") || prev.temperature,
        oxygen_saturation:
          (triage.oxygen_saturation
            ? String(triage.oxygen_saturation)
            : "") || prev.oxygen_saturation,
        pain_method: triage.pain_method || prev.pain_method || "nrs",
        pain_scale: Number(triage.pain_scale) || prev.pain_scale,
        pain_location: triage.pain_location || prev.pain_location || "",
      }));
      emitMedicalRecordTabSaved("physical-exam", false);
      toast({
        title: "Berhasil",
        description: "Data triase berhasil dimuat ke pemeriksaan fisik.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal memuat triase",
        description: "Terjadi kesalahan saat mengambil data triase.",
      });
    }
  };

  const doSave = async () => {
    // Parse numeric fields to numbers to prevent JSON unmarshal errors when empty
    const payload = {
      ...formData,
      blood_pressure_systolic: formData.blood_pressure_systolic ? Number(formData.blood_pressure_systolic) : 0,
      blood_pressure_diastolic: formData.blood_pressure_diastolic ? Number(formData.blood_pressure_diastolic) : 0,
      systolic: formData.blood_pressure_systolic ? Number(formData.blood_pressure_systolic) : 0,
      diastolic: formData.blood_pressure_diastolic ? Number(formData.blood_pressure_diastolic) : 0,
      heart_rate: formData.heart_rate ? Number(formData.heart_rate) : 0,
      respiratory_rate: formData.respiratory_rate ? Number(formData.respiratory_rate) : 0,
      temperature: formData.temperature ? Number(formData.temperature) : 0,
      oxygen_saturation: formData.oxygen_saturation ? Number(formData.oxygen_saturation) : 0,
      weight: formData.weight ? Number(formData.weight) : 0,
      height: formData.height ? Number(formData.height) : 0,
      bmi: formData.bmi ? Number(formData.bmi) : 0,
    };

    if (useExternalData) {
      onSave?.(payload);
      return;
    }

    // Log edit if patient is discharged
    if (isPatientDischarged && physicalExamId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "physical_exam",
          record_id: physicalExamId,
          action: "edit",
          reason: editReason || "Edit setelah pasien pulang",
        });
      } catch (error) {
        console.error("Failed to log edit:", error);
      }
    }

    onSave?.(payload);
    resetEditMode();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If patient is discharged, verify PIN before saving
    if (!useExternalData && isPatientDischarged) {
      requestPINVerification(doSave);
      return;
    }

    doSave();
  };

  const bmiCategory = getBMICategory(formData.bmi);
  const painLocationOptions = useMemo(() => {
    const selected = (formData.pain_location || "").trim();
    if (!selected) return painLocationOptionsBase;
    if (painLocationOptionsBase.some((option) => option.value === selected))
      return painLocationOptionsBase;

    return [
      { value: selected, label: `${selected} (custom)` },
      ...painLocationOptionsBase,
    ];
  }, [formData.pain_location]);
  const systolicStatus = getVitalStatus(
    Number(formData.blood_pressure_systolic),
    90,
    120,
    80,
    129,
  );
  const diastolicStatus = getVitalStatus(
    Number(formData.blood_pressure_diastolic),
    60,
    80,
    50,
    89,
  );
  const heartRateStatus = getVitalStatus(Number(formData.heart_rate), 60, 100, 50, 110);
  const respiratoryStatus = getVitalStatus(
    Number(formData.respiratory_rate),
    12,
    20,
    10,
    24,
  );
  const temperatureStatus = getVitalStatus(
    Number(formData.temperature),
    36.1,
    37.2,
    35.5,
    37.9,
  );
  const spo2Status = getVitalStatus(
    Number(formData.oxygen_saturation),
    95,
    100,
    90,
    100,
  );
  const filledBodySections = Object.keys(checkedSections).filter(
    (k) => checkedSections[k],
  ).length;
  const isNoPain = formData.pain_location === "Tidak ada nyeri";
  const filledVitalSigns = [
    formData.general_condition ? 1 : 0,
    formData.consciousness ? 1 : 0,
    Number(formData.blood_pressure_systolic) > 0 ? 1 : 0,
    Number(formData.blood_pressure_diastolic) > 0 ? 1 : 0,
    Number(formData.heart_rate) > 0 ? 1 : 0,
    Number(formData.respiratory_rate) > 0 ? 1 : 0,
    Number(formData.temperature) > 0 ? 1 : 0,
    Number(formData.oxygen_saturation) > 0 ? 1 : 0,
    formData.upper_arm_circum ? 1 : 0,
    formData.head_circum ? 1 : 0,
    formData.waist ? 1 : 0,
  ].reduce((a, b) => a + b, 0) + (isNoPain ? 3 : (
    (formData.pain_method ? 1 : 0) +
    (Number(formData.pain_scale) > 0 ? 1 : 0) +
    (formData.pain_location ? 1 : 0)
  ));
  const filledPhysicalExam = filledBodySections + filledVitalSigns;
  const totalPhysicalExam = physicalExamSections.length + 14; // 13 body sections + 14 core fields
  const allPhysicalChecked = filledBodySections === physicalExamSections.length;

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator(
      "physical-exam",
      `${filledPhysicalExam}/${totalPhysicalExam}`,
    );
  }, [filledPhysicalExam, loading]);

  // Auto-save draft to localStorage on every form change
  useEffect(() => {
    if (useExternalData) return;
    if (loading) return;
    saveFormDraft(`mr-draft-physical-exam-${visitId}`, {
      formData,
      checkedSections,
    });
  }, [formData, checkedSections, loading, visitId, useExternalData]);

  // Clear draft when save is confirmed by server
  useEffect(() => {
    if (useExternalData) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "physical-exam" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-physical-exam-${visitId}`);
      }
    };
    window.addEventListener(
      MEDICAL_RECORD_TAB_SAVED_EVENT,
      handler as EventListener,
    );
    return () =>
      window.removeEventListener(
        MEDICAL_RECORD_TAB_SAVED_EVENT,
        handler as EventListener,
      );
  }, [visitId, useExternalData]);

  // Listen for copy-from-history events
  useEffect(() => {
    if (useExternalData) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ section: string; data: any }>;
      if (ev.detail?.section !== "physical-exam" || !ev.detail.data) return;
      clearPendingCopy("physical-exam");
      const d = ev.detail.data;
      const newData = {
        general_condition: d.general_condition || "",
        consciousness: d.consciousness || "",
        blood_pressure_systolic: d.systolic || d.blood_pressure_systolic ? String(d.systolic || d.blood_pressure_systolic) : "",
        blood_pressure_diastolic: d.diastolic || d.blood_pressure_diastolic ? String(d.diastolic || d.blood_pressure_diastolic) : "",
        heart_rate: d.heart_rate ? String(d.heart_rate) : "",
        respiratory_rate: d.respiratory_rate ? String(d.respiratory_rate) : "",
        temperature: d.temperature ? String(d.temperature) : "",
        oxygen_saturation: d.oxygen_saturation ? String(d.oxygen_saturation) : "",
        weight: d.weight ? String(d.weight) : "",
        height: d.height ? String(d.height) : "",
        bmi: d.bmi ? Number(d.bmi) : 0,
        upper_arm_circum: d.upper_arm_circum || "",
        head_circum: d.head_circum || "",
        waist: d.waist || "",
        head: d.head || "",
        eyes: d.eyes || "",
        ears: d.ears || "",
        nose: d.nose || "",
        throat: d.throat || "",
        neck: d.neck || "",
        chest: d.chest || d.thorax || "",
        heart: d.heart || d.cardiac || "",
        lungs: d.lungs || d.pulmonary || "",
        abdomen: d.abdomen || "",
        extremities: d.extremities || "",
        skin: d.skin || "",
        neurological: d.neurological || "",
        other_findings: d.other_findings || "",
        ecg_performed: d.ecg_performed || false,
        ecg_result: d.ecg_result || "",
        ecg_interpretation: d.ecg_interpretation || "",
        ecg_notes: d.ecg_notes || "",
        ctg_performed: d.ctg_performed || false,
        ctg_result: d.ctg_result || "",
        ctg_interpretation: d.ctg_interpretation || "",
        ctg_notes: d.ctg_notes || "",
        pelvic_performed: d.pelvic_performed || false,
        pelvic_result: d.pelvic_result || "",
        pelvic_notes: d.pelvic_notes || "",
        pain_method: d.pain_method || "nrs",
        pain_scale: d.pain_scale ? Number(d.pain_scale) : 0,
        pain_location: d.pain_location || "",
      };
      setFormData(newData);
      // Auto-check sections that have data
      const checked: Record<string, boolean> = {};
      [
        "head",
        "eyes",
        "ears",
        "nose",
        "throat",
        "neck",
        "chest",
        "heart",
        "lungs",
        "abdomen",
        "extremities",
        "skin",
        "neurological",
      ].forEach((key) => {
        if (
          newData[key as keyof typeof newData] &&
          String(newData[key as keyof typeof newData]).trim()
        ) {
          checked[key] = true;
        }
      });
      setCheckedSections(checked);
      emitMedicalRecordTabSaved("physical-exam", false);
    };
    window.addEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(
        COPY_FROM_HISTORY_EVENT,
        handler as EventListener,
      );
  }, [useExternalData]);

  if (loading) {
    return (
      <div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        {!useExternalData && (
          <EditModeBanner
            isPatientDischarged={isPatientDischarged}
            isEditing={isEditing}
            onRequestEdit={handleRequestEdit}
            recordTypeLabel="Pemeriksaan Fisik"
          />
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset
            disabled={isFormDisabled}
            className="space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11"
          >
            {/* Section 1: Kondisi Umum & Tanda Vital */}
            <div className="border border-border/70">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Kondisi Umum, Vital, dan Antropometri
              </div>
              <div className="space-y-7 p-3 sm:p-4">
                {/* Kondisi Umum */}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="general_condition" className="text-sm">
                        Keadaan Umum
                      </Label>
                      <Combobox allowCustomValue
                        options={getOptions("general_condition")}
                        value={formData.general_condition}
                        onValueChange={(v) =>
                          handleChange("general_condition", v)
                        }
                        placeholder="Pilih keadaan umum"
                        searchPlaceholder="Cari keadaan umum..."
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consciousness" className="text-sm">
                        Kesadaran
                      </Label>
                      <Combobox allowCustomValue
                        options={getOptions("consciousness_level")}
                        value={formData.consciousness}
                        onValueChange={(v) => handleChange("consciousness", v)}
                        placeholder="Pilih tingkat kesadaran"
                        searchPlaceholder="Cari tingkat kesadaran..."
                        disabled={isFormDisabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Tanda Vital */}
                <div>
                  {isEmergency && !isFormDisabled && (
                    <div className="mb-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={handleLoadFromTriage}
                      >
                        Ambil Data Triase
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="blood_pressure_systolic"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        Sistolik{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(systolicStatus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(systolicStatus),
                            )}
                          >
                            {getVitalStatusLabel(systolicStatus)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="blood_pressure_systolic"
                          type="number"
                          placeholder="120"
                          value={formData.blood_pressure_systolic === "" ? "" : formData.blood_pressure_systolic}
                          onChange={(e) =>
                            handleChange(
                              "blood_pressure_systolic",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-12",
                            getVitalStatusInputClass(systolicStatus),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          mmHg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="blood_pressure_diastolic"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        Diastolik{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(diastolicStatus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(diastolicStatus),
                            )}
                          >
                            {getVitalStatusLabel(diastolicStatus)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="blood_pressure_diastolic"
                          type="number"
                          placeholder="80"
                          value={formData.blood_pressure_diastolic === "" ? "" : formData.blood_pressure_diastolic}
                          onChange={(e) =>
                            handleChange(
                              "blood_pressure_diastolic",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-12",
                            getVitalStatusInputClass(diastolicStatus),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          mmHg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="heart_rate"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        Nadi{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(heartRateStatus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(heartRateStatus),
                            )}
                          >
                            {getVitalStatusLabel(heartRateStatus)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="heart_rate"
                          type="number"
                          placeholder="80"
                          value={formData.heart_rate === "" ? "" : formData.heart_rate}
                          onChange={(e) =>
                            handleChange(
                              "heart_rate",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-10",
                            getVitalStatusInputClass(heartRateStatus),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          x/m
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="respiratory_rate"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        Napas{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(respiratoryStatus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(respiratoryStatus),
                            )}
                          >
                            {getVitalStatusLabel(respiratoryStatus)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="respiratory_rate"
                          type="number"
                          placeholder="20"
                          value={formData.respiratory_rate === "" ? "" : formData.respiratory_rate}
                          onChange={(e) =>
                            handleChange(
                              "respiratory_rate",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-10",
                            getVitalStatusInputClass(respiratoryStatus),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          x/m
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="temperature"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        Suhu{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(temperatureStatus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(temperatureStatus),
                            )}
                          >
                            {getVitalStatusLabel(temperatureStatus)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          placeholder="36.5"
                          value={formData.temperature === "" ? "" : formData.temperature}
                          onChange={(e) =>
                            handleChange(
                              "temperature",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-8",
                            getVitalStatusInputClass(temperatureStatus),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          °C
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="oxygen_saturation"
                        className="text-xs flex flex-wrap items-center gap-1.5 leading-5"
                      >
                        SpO2{" "}
                        {isEmergency && (
                          <span className="text-destructive">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                        {getVitalStatusLabel(spo2Status) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1 py-0 h-4",
                              getVitalStatusBadgeClass(spo2Status),
                            )}
                          >
                            {getVitalStatusLabel(spo2Status)}
                          </Badge>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="oxygen_saturation"
                          type="number"
                          placeholder="98"
                          value={formData.oxygen_saturation === "" ? "" : formData.oxygen_saturation}
                          onChange={(e) =>
                            handleChange(
                              "oxygen_saturation",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          required={isEmergency}
                          className={cn(
                            "pr-6",
                            getVitalStatusInputClass(spo2Status),
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skala Nyeri */}
                <div>
                  <div className="flex items-center justify-between mb-4 bg-muted/20 p-3 px-4 rounded-lg border border-border/70">
                    <div className="space-y-0.5">
                      <Label htmlFor="no_pain" className="text-sm font-semibold cursor-pointer">
                        Tidak Ada Nyeri
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Aktifkan jika pasien tidak mengalami nyeri
                      </p>
                    </div>
                    <Switch
                      id="no_pain"
                      checked={formData.pain_location === "Tidak ada nyeri"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleChange("pain_location", "Tidak ada nyeri");
                          handleChange("pain_scale", 0);
                        } else {
                          handleChange("pain_location", "");
                        }
                      }}
                      disabled={isFormDisabled}
                    />
                  </div>
                  {formData.pain_location !== "Tidak ada nyeri" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pain_method" className="text-xs">
                        Metode Penilaian Nyeri
                      </Label>
                      <Select
                        value={formData.pain_method}
                        onValueChange={(value) =>
                          handleChange("pain_method", value)
                        }
                        disabled={isFormDisabled}
                      >
                        <SelectTrigger id="pain_method">
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nrs">
                            NRS (Numeric Rating Scale)
                          </SelectItem>
                          <SelectItem value="wong_baker">
                            Wong-Baker FACES
                          </SelectItem>
                          <SelectItem value="vas">
                            VAS (Visual Analog Scale)
                          </SelectItem>
                          <SelectItem value="flacc">
                            FLACC (bayi/anak non-verbal)
                          </SelectItem>
                          <SelectItem value="bps">
                            BPS (pasien ICU/ventilator)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pain_location" className="text-xs">
                        Lokasi Nyeri
                      </Label>
                      <Combobox allowCustomValue
                        options={painLocationOptions}
                        value={formData.pain_location || ""}
                        onValueChange={(value) =>
                          handleChange("pain_location", value)
                        }
                        placeholder="Pilih lokasi nyeri"
                        searchPlaceholder="Cari lokasi nyeri..."
                        emptyText="Lokasi tidak ditemukan"
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pain_scale" className="text-xs">
                        Skala Nyeri (0-10)
                      </Label>
                      {/* Wong-Baker FACES visual */}
                      {formData.pain_method === "wong_baker" && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pb-1">
                          {[0, 2, 4, 6, 8, 10].map((v) => (
                            <TooltipProvider key={v}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isFormDisabled}
                                    onClick={() =>
                                      handleChange("pain_scale", v)
                                    }
                                    className={cn(
                                      "h-10 w-full text-2xl cursor-pointer rounded-lg transition-all",
                                      formData.pain_scale === v
                                        ? "bg-primary/10 ring-2 ring-primary"
                                        : "hover:bg-muted",
                                    )}
                                  >
                                    {v === 0
                                      ? "😊"
                                      : v === 2
                                        ? "🙂"
                                        : v === 4
                                          ? "😐"
                                          : v === 6
                                            ? "🙁"
                                            : v === 8
                                              ? "😢"
                                              : "😭"}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {v === 0
                                      ? "Tidak nyeri"
                                      : v === 2
                                        ? "Nyeri ringan"
                                        : v === 4
                                          ? "Nyeri sedang"
                                          : v === 6
                                            ? "Nyeri cukup berat"
                                            : v === 8
                                              ? "Nyeri berat"
                                              : "Nyeri sangat berat"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      )}
                      {/* NRS / VAS numeric bar */}
                      {(formData.pain_method === "nrs" ||
                        formData.pain_method === "vas") && (
                        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 pb-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={isFormDisabled}
                              onClick={() => handleChange("pain_scale", v)}
                              className={cn(
                                "h-9 w-full text-xs font-medium rounded transition-all",
                                formData.pain_scale === v
                                  ? "ring-2 ring-primary text-primary-foreground " +
                                      (v <= 3
                                        ? "bg-green-500"
                                        : v <= 6
                                          ? "bg-yellow-500"
                                          : "bg-red-500")
                                  : v <= 3
                                    ? "bg-green-100 hover:bg-green-200 text-green-800"
                                    : v <= 6
                                      ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                                      : "bg-red-100 hover:bg-red-200 text-red-800",
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* FLACC / BPS numeric bar */}
                      {(formData.pain_method === "flacc" ||
                        formData.pain_method === "bps") && (
                        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 pb-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={isFormDisabled}
                              onClick={() => handleChange("pain_scale", v)}
                              className={cn(
                                "h-9 w-full text-xs font-medium rounded transition-all",
                                formData.pain_scale === v
                                  ? "ring-2 ring-primary text-primary-foreground " +
                                      (v <= 3
                                        ? "bg-green-500"
                                        : v <= 6
                                          ? "bg-yellow-500"
                                          : "bg-red-500")
                                  : v <= 3
                                    ? "bg-green-100 hover:bg-green-200 text-green-800"
                                    : v <= 6
                                      ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                                      : "bg-red-100 hover:bg-red-200 text-red-800",
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formData.pain_method === "flacc"
                          ? "FLACC: Face, Legs, Activity, Cry, Consolability — untuk bayi/anak yang belum bisa bicara"
                          : formData.pain_method === "bps"
                            ? "BPS: Behavioral Pain Scale — untuk pasien di bawah sedasi/ventilator"
                            : formData.pain_method === "wong_baker"
                              ? "Pilih wajah yang paling sesuai dengan kondisi nyeri pasien"
                              : "0 = Tidak nyeri, 1-3 = Ringan, 4-6 = Sedang, 7-10 = Berat"}
                      </p>
                    </div>
                  </div>
                  )}
                </div>

                {/* Antropometri */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] text-muted-foreground">
                      Input dalam satuan cm/kg
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="weight"
                        className="text-xs flex items-center gap-1.5"
                      >
                        Berat Badan
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          placeholder="70"
                          value={formData.weight === "" ? "" : formData.weight}
                          onChange={(e) =>
                            handleChange(
                              "weight",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          kg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="height"
                        className="text-xs flex items-center gap-1.5"
                      >
                        Tinggi Badan
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          SatuSehat
                        </Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          placeholder="170"
                          value={formData.height === "" ? "" : formData.height}
                          onChange={(e) =>
                            handleChange(
                              "height",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="upper_arm_circum"
                        className="text-xs flex items-center gap-1.5"
                      >
                        Lingkar Lengan Atas
                      </Label>
                      <div className="relative">
                        <Input
                          id="upper_arm_circum"
                          type="number"
                          step="0.1"
                          placeholder="24"
                          value={formData.upper_arm_circum || ""}
                          onChange={(e) =>
                            handleChange("upper_arm_circum", e.target.value)
                          }
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="head_circum"
                        className="text-xs flex items-center gap-1.5"
                      >
                        Lingkar Kepala
                      </Label>
                      <div className="relative">
                        <Input
                          id="head_circum"
                          type="number"
                          step="0.1"
                          placeholder="52"
                          value={formData.head_circum || ""}
                          onChange={(e) =>
                            handleChange("head_circum", e.target.value)
                          }
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="waist"
                        className="text-xs flex items-center gap-1.5"
                      >
                        Lingkar Perut
                      </Label>
                      <div className="relative">
                        <Input
                          id="waist"
                          type="number"
                          step="0.1"
                          placeholder="80"
                          value={formData.waist || ""}
                          onChange={(e) =>
                            handleChange("waist", e.target.value)
                          }
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        BMI
                      </Label>
                      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
                        <span className="font-medium">
                          {formData.bmi || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          kg/m²
                        </span>
                        {formData.bmi > 0 && (
                          <Badge
                            variant="outline"
                            className={cn("ml-auto text-xs", bmiCategory.color)}
                          >
                            {bmiCategory.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pemeriksaan Fisik - Table with Checkbox Column */}
            <div className="border border-border/70">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <div className="flex flex-col justify-between sm:flex-row sm:items-center sm:gap-2">
                  <div>Pemeriksaan Fisik</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllNormal}
                    disabled={isFormDisabled}
                    className="gap-2"
                  >
                    {allPhysicalChecked ? (
                      <>
                        <X className="h-4 w-4" />
                        Hapus Semua
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Semua Normal
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-4 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"></div>
                <div className="w-full overflow-x-auto">
                  <div className="space-y-3 md:hidden">
                    {physicalExamSections.map((section) => {
                      const isChecked = checkedSections[section.id] || false;
                      const value = formData[
                        section.id as keyof typeof formData
                      ] as string;

                      return (
                        <div
                          key={`mobile-${section.id}`}
                          className={cn(
                            "rounded-lg border p-3",
                            isChecked && "bg-green-50/50 dark:bg-green-950/10",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              id={`mobile-check-${section.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleCheckSection(
                                  section.id,
                                  checked as boolean,
                                )
                              }
                              disabled={isFormDisabled}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <Label
                                htmlFor={`mobile-check-${section.id}`}
                                className="text-sm font-medium"
                              >
                                {section.label}
                              </Label>
                              {isChecked ? (
                                <Textarea
                                  id={`mobile-field-${section.id}`}
                                  placeholder={`Hasil pemeriksaan ${section.label.toLowerCase()}...`}
                                  value={value || ""}
                                  onChange={(e) =>
                                    handleChange(section.id, e.target.value)
                                  }
                                  className="mt-2 min-h-[96px] resize-none text-sm"
                                  disabled={isFormDisabled}
                                />
                              ) : (
                                <p className="mt-1 text-xs text-muted-foreground italic">
                                  Belum diperiksa
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block w-full overflow-x-auto">
                    <table className="w-full min-w-[680px] caption-bottom text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr className="bg-muted/50 border-b">
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px] text-center">
                            ✓
                          </th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[130px]">
                            Bagian
                          </th>
                          <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                            Hasil Pemeriksaan
                          </th>
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {physicalExamSections.map((section) => {
                          const isChecked =
                            checkedSections[section.id] || false;
                          const isExpanded = expandedRows[section.id] || false;
                          const value = formData[
                            section.id as keyof typeof formData
                          ] as string;

                          return (
                            <Fragment key={section.id}>
                              <tr
                                className={cn(
                                  "border-b transition-colors hover:bg-muted/50",
                                  isChecked &&
                                    "bg-green-50/50 dark:bg-green-950/10",
                                  isChecked &&
                                    "cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-950/20",
                                )}
                                onClick={() =>
                                  isChecked && toggleRowExpand(section.id)
                                }
                              >
                                <td
                                  className="p-2 align-middle text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    id={`check-${section.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      handleCheckSection(
                                        section.id,
                                        checked as boolean,
                                      )
                                    }
                                    disabled={isFormDisabled}
                                  />
                                </td>
                                <td className="p-4 align-middle font-medium">
                                  {section.label}
                                </td>
                                <td className="p-4 align-middle">
                                  {isChecked ? (
                                    <span className="text-sm text-muted-foreground line-clamp-1">
                                      {value || "-"}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground/50 italic">
                                      Belum diperiksa
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 align-middle">
                                  {isChecked && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRowExpand(section.id);
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={4} className="p-0">
                                    <div className="px-4 py-3 bg-muted/30 border-t">
                                      <Textarea
                                        id={section.id}
                                        placeholder={`Hasil pemeriksaan ${section.label.toLowerCase()}...`}
                                        value={value || ""}
                                        onChange={(e) =>
                                          handleChange(
                                            section.id,
                                            e.target.value,
                                          )
                                        }
                                        className="min-h-[80px] resize-none text-sm"
                                        disabled={isFormDisabled}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Temuan Lain */}
                <div className="pt-4">
                  <Label
                    htmlFor="other_findings"
                    className="text-sm font-medium"
                  >
                    Temuan Lain
                  </Label>
                  <Textarea
                    id="other_findings"
                    placeholder="Temuan pemeriksaan fisik lainnya..."
                    value={formData.other_findings}
                    onChange={(e) =>
                      handleChange("other_findings", e.target.value)
                    }
                    className="mt-2 min-h-[60px] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Pemeriksaan Penunjang - Table with Checkbox Column */}
            <div className="border border-border/70">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Pemeriksaan Penunjang Terkait
              </div>
              <div className="space-y-4 p-3 sm:p-4">
                <div className="md:hidden space-y-3">
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      formData.ecg_performed &&
                        "bg-purple-50/50 dark:bg-purple-950/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mobile-ecg-performed"
                        checked={formData.ecg_performed}
                        onCheckedChange={(checked) => {
                          handleChange("ecg_performed", checked as boolean);
                          if (!checked) {
                            handleChange("ecg_result", "");
                            handleChange("ecg_interpretation", "");
                            handleChange("ecg_notes", "");
                          }
                        }}
                        disabled={isFormDisabled}
                      />
                      <Label
                        htmlFor="mobile-ecg-performed"
                        className="text-sm font-medium"
                      >
                        EKG / ECG
                      </Label>
                    </div>
                    {formData.ecg_performed && (
                      <div className="mt-3 space-y-2">
                        <Input
                          placeholder="Hasil EKG"
                          value={formData.ecg_result}
                          onChange={(e) =>
                            handleChange("ecg_result", e.target.value)
                          }
                          disabled={isFormDisabled}
                        />
                        <Input
                          placeholder="Interpretasi"
                          value={formData.ecg_interpretation}
                          onChange={(e) =>
                            handleChange("ecg_interpretation", e.target.value)
                          }
                          disabled={isFormDisabled}
                        />
                        <Textarea
                          placeholder="Catatan detail EKG"
                          value={formData.ecg_notes}
                          onChange={(e) =>
                            handleChange("ecg_notes", e.target.value)
                          }
                          className="min-h-[96px] resize-none text-sm"
                          disabled={isFormDisabled}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      formData.ctg_performed &&
                        "bg-blue-50/50 dark:bg-blue-950/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mobile-ctg-performed"
                        checked={formData.ctg_performed}
                        onCheckedChange={(checked) => {
                          handleChange("ctg_performed", checked as boolean);
                          if (!checked) {
                            handleChange("ctg_result", "");
                            handleChange("ctg_interpretation", "");
                            handleChange("ctg_notes", "");
                          }
                        }}
                        disabled={isFormDisabled}
                      />
                      <Label
                        htmlFor="mobile-ctg-performed"
                        className="text-sm font-medium"
                      >
                        CTG
                      </Label>
                    </div>
                    {formData.ctg_performed && (
                      <div className="mt-3 space-y-2">
                        <Input
                          placeholder="Hasil CTG"
                          value={formData.ctg_result}
                          onChange={(e) =>
                            handleChange("ctg_result", e.target.value)
                          }
                          disabled={isFormDisabled}
                        />
                        <Input
                          placeholder="Interpretasi"
                          value={formData.ctg_interpretation}
                          onChange={(e) =>
                            handleChange("ctg_interpretation", e.target.value)
                          }
                          disabled={isFormDisabled}
                        />
                        <Textarea
                          placeholder="Catatan detail CTG"
                          value={formData.ctg_notes}
                          onChange={(e) =>
                            handleChange("ctg_notes", e.target.value)
                          }
                          className="min-h-[96px] resize-none text-sm"
                          disabled={isFormDisabled}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      formData.pelvic_performed &&
                        "bg-orange-50/50 dark:bg-orange-950/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mobile-pelvic-performed"
                        checked={formData.pelvic_performed}
                        onCheckedChange={(checked) => {
                          handleChange("pelvic_performed", checked as boolean);
                          if (!checked) {
                            handleChange("pelvic_result", "");
                            handleChange("pelvic_notes", "");
                          }
                        }}
                        disabled={isFormDisabled}
                      />
                      <Label
                        htmlFor="mobile-pelvic-performed"
                        className="text-sm font-medium"
                      >
                        Pemeriksaan Pelvis
                      </Label>
                    </div>
                    {formData.pelvic_performed && (
                      <div className="mt-3 space-y-2">
                        <Input
                          placeholder="Hasil pemeriksaan pelvis"
                          value={formData.pelvic_result}
                          onChange={(e) =>
                            handleChange("pelvic_result", e.target.value)
                          }
                          disabled={isFormDisabled}
                        />
                        <Textarea
                          placeholder="Catatan detail pelvis"
                          value={formData.pelvic_notes}
                          onChange={(e) =>
                            handleChange("pelvic_notes", e.target.value)
                          }
                          className="min-h-[96px] resize-none text-sm"
                          disabled={isFormDisabled}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden md:block w-full overflow-x-auto">
                  <table className="w-full min-w-[760px] caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="bg-muted/50 border-b">
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px] text-center">
                          ✓
                        </th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[180px]">
                          Pemeriksaan
                        </th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                          Hasil Pemeriksaan
                        </th>
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {/* ECG Row */}
                      <>
                        <tr
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50",
                            formData.ecg_performed &&
                              "bg-purple-50/50 dark:bg-purple-950/10",
                            formData.ecg_performed &&
                              "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20",
                          )}
                          onClick={() =>
                            formData.ecg_performed &&
                            setExpandedRows((prev) => ({
                              ...prev,
                              ecg: !prev.ecg,
                            }))
                          }
                        >
                          <td
                            className="p-2 align-middle text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              id="ecg_performed"
                              checked={formData.ecg_performed}
                              onCheckedChange={(checked) => {
                                handleChange(
                                  "ecg_performed",
                                  checked as boolean,
                                );
                                if (checked) {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ecg: true,
                                  }));
                                } else {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ecg: false,
                                  }));
                                  handleChange("ecg_result", "");
                                  handleChange("ecg_interpretation", "");
                                  handleChange("ecg_notes", "");
                                }
                              }}
                              disabled={isFormDisabled}
                            />
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <Heart
                                className={cn(
                                  "h-4 w-4",
                                  formData.ecg_performed
                                    ? "text-red-500"
                                    : "text-muted-foreground",
                                )}
                              />
                              <div>
                                <span className="font-medium">EKG / ECG</span>
                                <p className="text-xs text-muted-foreground">
                                  Elektrokardiogram
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {formData.ecg_performed ? (
                              <div className="text-sm">
                                {formData.ecg_result ||
                                formData.ecg_interpretation ? (
                                  <div className="space-y-0.5">
                                    {formData.ecg_result && (
                                      <p className="text-muted-foreground line-clamp-1">
                                        <span className="font-medium">
                                          Hasil:
                                        </span>{" "}
                                        {formData.ecg_result}
                                      </p>
                                    )}
                                    {formData.ecg_interpretation && (
                                      <p className="text-muted-foreground line-clamp-1">
                                        <span className="font-medium">
                                          Interpretasi:
                                        </span>{" "}
                                        {formData.ecg_interpretation}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50 italic">
                                    Klik untuk mengisi detail
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground/50 italic">
                                Belum dilakukan
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-middle">
                            {formData.ecg_performed && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ecg: !prev.ecg,
                                  }));
                                }}
                              >
                                {expandedRows.ecg ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {expandedRows.ecg && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <div className="px-4 py-3 bg-muted/30 border-t space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ecg_result"
                                    className="text-sm font-medium"
                                  >
                                    Hasil EKG
                                  </Label>
                                  <Input
                                    id="ecg_result"
                                    placeholder="Sinus rhythm, HR 80x/menit..."
                                    value={formData.ecg_result}
                                    onChange={(e) =>
                                      handleChange("ecg_result", e.target.value)
                                    }
                                    disabled={isFormDisabled}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ecg_interpretation"
                                    className="text-sm font-medium"
                                  >
                                    Interpretasi
                                  </Label>
                                  <Input
                                    id="ecg_interpretation"
                                    placeholder="Normal / Abnormal"
                                    value={formData.ecg_interpretation}
                                    onChange={(e) =>
                                      handleChange(
                                        "ecg_interpretation",
                                        e.target.value,
                                      )
                                    }
                                    disabled={isFormDisabled}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ecg_notes"
                                    className="text-sm font-medium flex items-center gap-2"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Catatan Detail EKG
                                  </Label>
                                  <Textarea
                                    id="ecg_notes"
                                    placeholder={`Irama: Sinus rhythm
Rate: 80x/menit
Axis: Normal
Gelombang P: Normal
Interval PR: 0.16 detik
Kompleks QRS: 0.08 detik
Segmen ST: Isoelektrik
Gelombang T: Normal
Kesimpulan: EKG dalam batas normal`}
                                    value={formData.ecg_notes}
                                    onChange={(e) =>
                                      handleChange("ecg_notes", e.target.value)
                                    }
                                    className="min-h-[120px] resize-none font-mono text-sm"
                                    disabled={isFormDisabled}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>

                      {/* Pelvis Row */}
                      <>
                        <tr
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50",
                            formData.pelvic_performed &&
                              "bg-pink-50/50 dark:bg-pink-950/10",
                            formData.pelvic_performed &&
                              "cursor-pointer hover:bg-pink-100/50 dark:hover:bg-pink-950/20",
                          )}
                          onClick={() =>
                            formData.pelvic_performed &&
                            setExpandedRows((prev) => ({
                              ...prev,
                              pelvic: !prev.pelvic,
                            }))
                          }
                        >
                          <td
                            className="p-2 align-middle text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              id="pelvic_performed"
                              checked={formData.pelvic_performed}
                              onCheckedChange={(checked) => {
                                handleChange(
                                  "pelvic_performed",
                                  checked as boolean,
                                );
                                if (checked) {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    pelvic: true,
                                  }));
                                } else {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    pelvic: false,
                                  }));
                                  handleChange("pelvic_result", "");
                                  handleChange("pelvic_notes", "");
                                }
                              }}
                              disabled={isFormDisabled}
                            />
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <Stethoscope
                                className={cn(
                                  "h-4 w-4",
                                  formData.pelvic_performed
                                    ? "text-pink-500"
                                    : "text-muted-foreground",
                                )}
                              />
                              <div>
                                <span className="font-medium">
                                  Pemeriksaan Pelvis
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  Pemeriksaan panggul / ginekologi
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {formData.pelvic_performed ? (
                              formData.pelvic_result ? (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {formData.pelvic_result}
                                </p>
                              ) : (
                                <span className="text-sm text-muted-foreground/50 italic">
                                  Klik untuk mengisi detail
                                </span>
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground/50 italic">
                                Belum dilakukan
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-middle">
                            {formData.pelvic_performed && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    pelvic: !prev.pelvic,
                                  }));
                                }}
                              >
                                {expandedRows.pelvic ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {expandedRows.pelvic && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <div className="px-4 py-3 bg-muted/30 border-t space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="pelvic_result"
                                    className="text-sm font-medium"
                                  >
                                    Hasil Pemeriksaan Pelvis
                                  </Label>
                                  <Input
                                    id="pelvic_result"
                                    placeholder="Inspekulo: portio livide, OUE tertutup..."
                                    value={formData.pelvic_result}
                                    onChange={(e) =>
                                      handleChange(
                                        "pelvic_result",
                                        e.target.value,
                                      )
                                    }
                                    disabled={isFormDisabled}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="pelvic_notes"
                                    className="text-sm font-medium flex items-center gap-2"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Catatan Detail Pelvis
                                  </Label>
                                  <Textarea
                                    id="pelvic_notes"
                                    placeholder={`Inspekulo: ...\nVaginal Toucher: ...\nKesimpulan: ...`}
                                    value={formData.pelvic_notes}
                                    onChange={(e) =>
                                      handleChange(
                                        "pelvic_notes",
                                        e.target.value,
                                      )
                                    }
                                    className="min-h-[80px] resize-none font-mono text-sm"
                                    disabled={isFormDisabled}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>

                      {/* CTG Row */}
                      <>
                        <tr
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50",
                            formData.ctg_performed &&
                              "bg-blue-50/50 dark:bg-blue-950/10",
                            formData.ctg_performed &&
                              "cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-950/20",
                          )}
                          onClick={() =>
                            formData.ctg_performed &&
                            setExpandedRows((prev) => ({
                              ...prev,
                              ctg: !prev.ctg,
                            }))
                          }
                        >
                          <td
                            className="p-2 align-middle text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              id="ctg_performed"
                              checked={formData.ctg_performed}
                              onCheckedChange={(checked) => {
                                handleChange(
                                  "ctg_performed",
                                  checked as boolean,
                                );
                                if (checked) {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ctg: true,
                                  }));
                                } else {
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ctg: false,
                                  }));
                                  handleChange("ctg_result", "");
                                  handleChange("ctg_interpretation", "");
                                  handleChange("ctg_notes", "");
                                }
                              }}
                              disabled={isFormDisabled}
                            />
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <Activity
                                className={cn(
                                  "h-4 w-4",
                                  formData.ctg_performed
                                    ? "text-blue-500"
                                    : "text-muted-foreground",
                                )}
                              />
                              <div>
                                <span className="font-medium">CTG</span>
                                <p className="text-xs text-muted-foreground">
                                  Cardiotocography (monitoring janin)
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {formData.ctg_performed ? (
                              <div className="text-sm">
                                {formData.ctg_result ||
                                formData.ctg_interpretation ? (
                                  <div className="space-y-0.5">
                                    {formData.ctg_result && (
                                      <p className="text-muted-foreground line-clamp-1">
                                        <span className="font-medium">
                                          Hasil:
                                        </span>{" "}
                                        {formData.ctg_result}
                                      </p>
                                    )}
                                    {formData.ctg_interpretation && (
                                      <p className="text-muted-foreground line-clamp-1">
                                        <span className="font-medium">
                                          Interpretasi:
                                        </span>{" "}
                                        {formData.ctg_interpretation}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50 italic">
                                    Klik untuk mengisi detail
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground/50 italic">
                                Belum dilakukan
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-middle">
                            {formData.ctg_performed && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRows((prev) => ({
                                    ...prev,
                                    ctg: !prev.ctg,
                                  }));
                                }}
                              >
                                {expandedRows.ctg ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {expandedRows.ctg && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <div className="px-4 py-3 bg-muted/30 border-t space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ctg_result"
                                    className="text-sm font-medium"
                                  >
                                    Hasil CTG
                                  </Label>
                                  <Input
                                    id="ctg_result"
                                    placeholder="Baseline FHR: 140 bpm, Variabilitas: moderate..."
                                    value={formData.ctg_result}
                                    onChange={(e) =>
                                      handleChange("ctg_result", e.target.value)
                                    }
                                    disabled={isFormDisabled}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ctg_interpretation"
                                    className="text-sm font-medium"
                                  >
                                    Interpretasi
                                  </Label>
                                  <Input
                                    id="ctg_interpretation"
                                    placeholder="Reaktif / Non-Reaktif"
                                    value={formData.ctg_interpretation}
                                    onChange={(e) =>
                                      handleChange(
                                        "ctg_interpretation",
                                        e.target.value,
                                      )
                                    }
                                    disabled={isFormDisabled}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="ctg_notes"
                                    className="text-sm font-medium flex items-center gap-2"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Catatan Detail CTG
                                  </Label>
                                  <Textarea
                                    id="ctg_notes"
                                    placeholder={`Baseline FHR: ...\nVariabilitas: ...\nAkselerasi: ...\nDeselerasi: ...\nKontraksi: ...\nKesimpulan: ...`}
                                    value={formData.ctg_notes}
                                    onChange={(e) =>
                                      handleChange("ctg_notes", e.target.value)
                                    }
                                    className="min-h-[100px] resize-none font-mono text-sm"
                                    disabled={isFormDisabled}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t">
                  <p className="text-xs text-muted-foreground italic">
                    * Pemeriksaan penunjang lainnya (EEG, USG, dll) akan
                    ditambahkan kemudian
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            {!isFormDisabled && !footerSaveOnly && (
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
                <Button type="submit" className="gap-2 w-full sm:w-auto">
                  <Save className="h-4 w-4" />
                  Simpan Pemeriksaan Fisik
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </div>
      {!useExternalData && (
        <>
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
        </>
      )}
    </div>
  );
}

