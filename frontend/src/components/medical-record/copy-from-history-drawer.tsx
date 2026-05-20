import { useEffect, useState, useMemo, Fragment } from "react";
import { cn } from "@/lib/utils";
import { visitsApi, medicalRecordsApi, patientAllergyApi } from "@/lib/api";
import type { Anamnesis, PhysicalExam, AssessmentPlan, Diagnosis, DiagnosisItem } from "@/lib/api";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Stethoscope,
  BedDouble,
  AlertTriangle,
  User,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { savePendingCopy } from "@/lib/form-persistence";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "./tab-indicator";

// Custom event for copy-from-history
export const COPY_FROM_HISTORY_EVENT = "copy-from-history";

export function emitCopyFromHistory(section: string, data: unknown) {
  window.dispatchEvent(
    new CustomEvent(COPY_FROM_HISTORY_EVENT, {
      detail: { section, data },
    })
  );
}

const isMeaningfulAllergySummary = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  return !/^(none|no known allergies|nkda|nka|nihil|\-|tidak ada|tidak ada alergi)$/.test(normalized);
};

const anamnesisFields = [
  "anamnesis_source",
  "functional_status",
  "chief_complaint",
  "history_of_present_illness",
  "onset",
  "duration",
  "severity",
  "location",
  "character",
  "aggravating_factors",
  "relieving_factors",
  "past_medical_history",
  "past_surgical_history",
  "family_history",
  "social_history",
  "smoking_status",
  "alcohol_use",
  "drug_use",
  "allergy_type",
  "allergy_reaction",
  "current_medications",
  "immunization_history",
  "menstrual_history",
  "obstetric_history",
  "review_of_systems",
] as const;

const physicalBodyFields = [
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
  "genitourinary",
  "other_findings",
] as const;

const physicalSupportingFields = [
  "pain_method",
  "pain_scale",
  "pain_location",
  "ecg_result",
  "ecg_interpretation",
  "ecg_notes",
  "ctg_result",
  "ctg_interpretation",
  "ctg_notes",
  "pelvic_result",
  "pelvic_notes",
] as const;

const assessmentPlanFields = [
  "clinical_assessment",
  "treatment_plan",
  "prognosis",
  "medication_plan",
  "diet_plan",
  "activity_plan",
  "education_plan",
  "procedure_plan",
  "consultation_plan",
  "monitoring_plan",
  "informed_consent",
] as const;

const hasMeaningfulValue = (value: unknown) => {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return value > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return false;
};

const countFilledFields = (source: Record<string, unknown>, fields: readonly string[]) =>
  fields.filter((field) => hasMeaningfulValue(source[field])).length;

const anamnesisTabTextFields = [
  "functional_status",
  "chief_complaint",
  "history_of_present_illness",
  "past_medical_history",
  "family_history",
  "social_history",
  "current_medications",
] as const;

const physicalExamTabBodyFields = [
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
] as const;

const getAnamnesisTabIndicator = (source: Record<string, unknown>, hasStructuredAllergy = false) => {
  const sourceFieldFilled = 1; // defaults to autoanamnesis in form
  const filledText = sourceFieldFilled + countFilledFields(source, anamnesisTabTextFields);
  const hasAllergy = isMeaningfulAllergySummary(source.allergies) || hasStructuredAllergy;
  const filled = filledText + (hasAllergy ? 1 : 0);
  return `${filled}/9`;
};

const getPhysicalExamTabIndicator = (source: Record<string, unknown>) => {
  const filledBody = countFilledFields(source, physicalExamTabBodyFields);
  const filledVitals = [
    hasMeaningfulValue(source.general_condition) ? 1 : 0,
    hasMeaningfulValue(source.consciousness) ? 1 : 0,
    hasMeaningfulValue(source.blood_pressure_systolic) || hasMeaningfulValue(source.systolic) ? 1 : 0,
    hasMeaningfulValue(source.blood_pressure_diastolic) || hasMeaningfulValue(source.diastolic) ? 1 : 0,
    hasMeaningfulValue(source.heart_rate) ? 1 : 0,
    hasMeaningfulValue(source.respiratory_rate) ? 1 : 0,
    hasMeaningfulValue(source.temperature) ? 1 : 0,
    hasMeaningfulValue(source.oxygen_saturation) ? 1 : 0,
    hasMeaningfulValue(source.pain_scale) ? 1 : 0,
    hasMeaningfulValue(source.pain_location) ? 1 : 0,
    hasMeaningfulValue(source.upper_arm_circum) ? 1 : 0,
    hasMeaningfulValue(source.head_circum) ? 1 : 0,
    hasMeaningfulValue(source.waist) ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  return `${filledBody + filledVitals}/26`;
};

const renderDetailRows = (rows: Array<{ label: string; value: string }>) => {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;
  }

  return (
    <div className="divide-y divide-border/40">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[145px_minmax(0,1fr)] gap-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">{row.label}</p>
          <p className="text-xs leading-5 text-foreground break-words">{row.value}</p>
        </div>
      ))}
    </div>
  );
};

interface CopyFromHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  currentVisitId: number;
  patientName?: string;
}

interface VisitHistoryItem {
  id: number;
  visit_number: string;
  visit_type: string;
  check_in_time?: string;
  start_time?: string;
  status: string;
  registration_id?: number;
  registration?: {
    registration_number: string;
    registration_date: string;
    registration_type: string;
  };
  room?: {
    name: string;
    service_type: string;
  };
  doctor?: {
    name: string;
    nama_lengkap?: string;
  };
  referral_from?: number;
}

interface VisitMedicalData {
  anamnesis?: Anamnesis | null;
  physicalExam?: PhysicalExam | null;
  diagnosis?: Diagnosis | null;
  assessmentPlan?: AssessmentPlan | null;
}

interface RegistrationGroup {
  registrationId: number;
  registrationNumber: string;
  registrationDate: string;
  visits: VisitHistoryItem[];
}

const visitTypeLabels: Record<string, string> = {
  consultation: "Konsultasi",
  lab: "Lab",
  radiology: "Radiologi",
  pharmacy: "Farmasi",
  inpatient: "Rawat Inap",
  outpatient: "Rawat Jalan",
  emergency: "UGD",
  surgery: "Operasi",
};

const getVisitTypeIcon = (type: string) => {
  switch (type) {
    case "inpatient":
      return <BedDouble className="h-4 w-4" />;
    case "emergency":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Stethoscope className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "Selesai";
    case "cancelled":
      return "Batal";
    case "in_progress":
      return "Proses";
    default:
      return status || "-";
  }
};

export function CopyFromHistoryDrawer({
  open,
  onOpenChange,
  patientId,
  currentVisitId,
  patientName,
}: CopyFromHistoryDrawerProps) {
  const { toast } = useToast();
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisitId, setExpandedVisitId] = useState<number | null>(null);
  const [visitData, setVisitData] = useState<Record<number, VisitMedicalData>>({});
  const [loadingData, setLoadingData] = useState<Set<number>>(new Set());
  const [copiedSections, setCopiedSections] = useState<Set<string>>(new Set());

  // Group visits by registration
  const registrationGroups = useMemo((): RegistrationGroup[] => {
    const groupMap = new Map<number, RegistrationGroup>();

    for (const visit of visits) {
      const regId = visit.registration_id || 0;
      if (!groupMap.has(regId)) {
        groupMap.set(regId, {
          registrationId: regId,
          registrationNumber: visit.registration?.registration_number || `REG-${regId}`,
          registrationDate: visit.registration?.registration_date || visit.start_time || visit.check_in_time || "",
          visits: [],
        });
      }
      groupMap.get(regId)!.visits.push(visit);
    }

    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()
    );
  }, [visits]);

  // Load visits when drawer opens
  useEffect(() => {
    if (open && patientId) {
      loadVisitHistory();
      setCopiedSections(new Set());
      setExpandedVisitId(null);
    }
  }, [open, patientId]);

  const loadVisitHistory = async () => {
    setLoading(true);
    try {
      const response = await visitsApi.getAll({ patient_id: patientId });
      const clinicalServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];

      // Only show clinical visits (not pharmacy/lab/radiology/surgery orders)
      const filteredVisits = (response.data || []).filter((v: any) => {
        // Exclude current visit
        if (v.id === currentVisitId) return false;
        const serviceType = v.room?.service_type;
        const isClinical = serviceType && clinicalServiceTypes.includes(serviceType);
        const isNormalConsultation = v.visit_type === "consultation" && !v.referral_from;
        const isOrder = v.referral_from != null;
        return (isClinical || isNormalConsultation) && !isOrder;
      });

      setVisits(filteredVisits);
    } catch (error) {
      console.error("Error loading visit history:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitMedicalData = async (visitId: number) => {
    if (visitData[visitId] || loadingData.has(visitId)) return;

    setLoadingData((prev) => new Set(prev).add(visitId));
    try {
      const [anamnesisRes, physicalExamRes, diagnosisRes, assessmentPlanRes] = await Promise.all([
        medicalRecordsApi.getAnamnesis(visitId).catch(() => ({ data: null })),
        medicalRecordsApi.getPhysicalExam(visitId).catch(() => ({ data: null })),
        medicalRecordsApi.getDiagnosis(visitId).catch(() => ({ data: null })),
        medicalRecordsApi.getAssessmentPlan(visitId).catch(() => ({ data: null })),
      ]);

      setVisitData((prev) => ({
        ...prev,
        [visitId]: {
          anamnesis: anamnesisRes.data as Anamnesis | null,
          physicalExam: physicalExamRes.data as PhysicalExam | null,
          diagnosis: diagnosisRes.data as Diagnosis | null,
          assessmentPlan: assessmentPlanRes.data as AssessmentPlan | null,
        },
      }));
    } catch (error) {
      console.error("Error loading medical data:", error);
    } finally {
      setLoadingData((prev) => {
        const next = new Set(prev);
        next.delete(visitId);
        return next;
      });
    }
  };

  const toggleVisitExpand = (visitId: number) => {
    if (expandedVisitId === visitId) {
      setExpandedVisitId(null);
    } else {
      setExpandedVisitId(visitId);
      loadVisitMedicalData(visitId);
    }
  };

  // Emit tab indicator immediately after copy so tabs update without needing to open them
  const emitIndicatorForCopy = (section: string, data: unknown) => {
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;

    if (section === "anamnesis") {
      emitMedicalRecordTabIndicator("anamnesis", getAnamnesisTabIndicator(d));
      emitMedicalRecordTabSaved("anamnesis", false);
    } else if (section === "physical-exam") {
      emitMedicalRecordTabIndicator("physical-exam", getPhysicalExamTabIndicator(d));
      emitMedicalRecordTabSaved("physical-exam", false);
    } else if (section === "diagnosis") {
      const items = Array.isArray(d.items) ? d.items : [];
      const itemDifferentials = items.filter((item) => typeof item?.differential_diagnosis === "string" && item.differential_diagnosis.trim()).length;
      const legacyDifferential = typeof d.differential_diagnosis === "string" && d.differential_diagnosis.trim() ? 1 : 0;
      const count = items.length + itemDifferentials + legacyDifferential;
      emitMedicalRecordTabIndicator("diagnosis", `${count}`);
      emitMedicalRecordTabSaved("diagnosis", false);
    } else if (section === "assessment-plan") {
      const filled = countFilledFields(d, assessmentPlanFields);
      emitMedicalRecordTabIndicator("assessment-plan", `${filled}/${assessmentPlanFields.length}`);
      emitMedicalRecordTabSaved("assessment-plan", false);
    }
  };

  const handleCopy = async (section: string, data: unknown, visitId: number) => {
    // Persist to localStorage so unmounted forms can pick it up when they mount
    savePendingCopy(section, data);
    // Dispatch event for already-mounted forms
    emitCopyFromHistory(section, data);
    const key = `${section}-${visitId}`;
    setCopiedSections((prev) => new Set(prev).add(key));

    // Immediately update tab indicators based on copied data
    emitIndicatorForCopy(section, data);

    // When copying anamnesis, also copy structured allergies recorded in source visit
    if (section === "anamnesis") {
      try {
        const allergyRes = await patientAllergyApi.getByVisit(visitId);
        const sourceAllergies = allergyRes.data?.data || [];
        if (sourceAllergies.length > 0) {
          await patientAllergyApi.bulkCreate({
            patient_id: patientId,
            visit_id: currentVisitId,
            allergies: sourceAllergies.map(a => ({
              snomed_code: a.snomed_code,
              snomed_display: a.snomed_display,
              category: a.category,
              criticality: a.criticality,
              notes: a.notes,
            })),
          }).catch(() => {});
          if (data && typeof data === "object") {
            emitMedicalRecordTabIndicator("anamnesis", getAnamnesisTabIndicator(data as Record<string, unknown>, true));
          }
          // Tell the anamnesis form to reload allergies
          window.dispatchEvent(new CustomEvent("reload-patient-allergies"));
        }
      } catch { /* source visit may not have structured allergies */ }
    }

    toast({
      title: "Data disalin",
      description: `Data ${getSectionLabel(section)} berhasil disalin ke kunjungan aktif. Silakan periksa dan edit sesuai kebutuhan.`,
    });

    // Reset copied indicator after 3 seconds
    setTimeout(() => {
      setCopiedSections((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 3000);
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      anamnesis: "Anamnesis",
      "physical-exam": "Pemeriksaan Fisik",
      diagnosis: "Diagnosis",
      "assessment-plan": "Assessment & Plan",
    };
    return labels[section] || section;
  };

  const getSectionMetric = (section: string, data: unknown): string | null => {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;

    if (section === "anamnesis") {
      const filledText = countFilledFields(d, anamnesisFields);
      const filled = filledText + (isMeaningfulAllergySummary(d.allergies) ? 1 : 0);
      return `${filled}/${anamnesisFields.length + 1}`;
    }

    if (section === "physical-exam") {
      const filledBody = countFilledFields(d, physicalBodyFields);
      const filledVitals = [
        hasMeaningfulValue(d.general_condition) ? 1 : 0,
        hasMeaningfulValue(d.consciousness) ? 1 : 0,
        hasMeaningfulValue(d.blood_pressure_systolic) || hasMeaningfulValue(d.systolic) ? 1 : 0,
        hasMeaningfulValue(d.blood_pressure_diastolic) || hasMeaningfulValue(d.diastolic) ? 1 : 0,
        hasMeaningfulValue(d.heart_rate) ? 1 : 0,
        hasMeaningfulValue(d.respiratory_rate) ? 1 : 0,
        hasMeaningfulValue(d.temperature) ? 1 : 0,
        hasMeaningfulValue(d.oxygen_saturation) ? 1 : 0,
        hasMeaningfulValue(d.weight) ? 1 : 0,
        hasMeaningfulValue(d.height) ? 1 : 0,
        hasMeaningfulValue(d.bmi) ? 1 : 0,
        hasMeaningfulValue(d.upper_arm_circum) ? 1 : 0,
        hasMeaningfulValue(d.head_circum) ? 1 : 0,
        hasMeaningfulValue(d.waist) ? 1 : 0,
      ].reduce((a, b) => a + b, 0);
      const filledSupporting = countFilledFields(d, physicalSupportingFields);
      const totalTarget = 15 + physicalBodyFields.length + physicalSupportingFields.length;
      return `${filledBody + filledVitals + filledSupporting}/${totalTarget}`;
    }

    if (section === "diagnosis") {
      const items = Array.isArray(d.items) ? d.items : [];
      const itemDifferentials = items.filter((item) => typeof item?.differential_diagnosis === "string" && item.differential_diagnosis.trim()).length;
      const legacyDifferential = typeof d.differential_diagnosis === "string" && d.differential_diagnosis.trim() ? 1 : 0;
      const count = items.length + itemDifferentials + legacyDifferential;
      return `${count}`;
    }

    if (section === "assessment-plan") {
      const filled = countFilledFields(d, assessmentPlanFields);
      return `${filled}/${assessmentPlanFields.length}`;
    }

    return null;
  };

  const hasData = (data: unknown): boolean => {
    if (!data) return false;
    if (typeof data !== "object") return false;
    const obj = data as Record<string, unknown>;
    // Check if any meaningful string field has content
    return Object.entries(obj).some(([key, value]) => {
      if (["id", "visit_id", "created_at", "updated_at", "created_by_id", "updated_by_id"].includes(key)) return false;
      if (typeof value === "string" && value.trim()) return true;
      if (typeof value === "number" && value > 0 && key !== "id" && key !== "visit_id") return true;
      if (typeof value === "boolean" && value) return true;
      if (Array.isArray(value) && value.length > 0) return true;
      return false;
    });
  };

  const renderAnamnesisPreview = (data: Anamnesis) => {
    const fields = [
      { label: "Sumber", value: data.anamnesis_source === "autoanamnesis" ? "Autoanamnesis" : data.anamnesis_source === "alloanamnesis" ? "Alloanamnesis" : data.anamnesis_source },
      { label: "Status Fungsional", value: data.functional_status },
      { label: "Keluhan Utama", value: data.chief_complaint },
      { label: "Riwayat Penyakit Sekarang", value: data.history_of_present_illness },
      { label: "Onset", value: data.onset },
      { label: "Durasi", value: data.duration },
      { label: "Derajat", value: data.severity },
      { label: "Lokasi", value: data.location },
      { label: "Karakter", value: data.character },
      { label: "Faktor Memberatkan", value: data.aggravating_factors },
      { label: "Faktor Meringankan", value: data.relieving_factors },
      { label: "Riwayat Penyakit Dahulu", value: data.past_medical_history },
      { label: "Riwayat Operasi", value: data.past_surgical_history },
      { label: "Riwayat Keluarga", value: data.family_history },
      { label: "Riwayat Sosial", value: data.social_history },
      { label: "Merokok", value: data.smoking_status },
      { label: "Alkohol", value: data.alcohol_use },
      { label: "Narkoba", value: data.drug_use },
      { label: "Alergi", value: data.allergies },
      { label: "Tipe Alergi", value: data.allergy_type },
      { label: "Reaksi Alergi", value: data.allergy_reaction },
      { label: "Obat Saat Ini", value: data.current_medications },
      { label: "Imunisasi", value: data.immunization_history },
      { label: "Riwayat Menstruasi", value: data.menstrual_history },
      { label: "Riwayat Obstetri", value: data.obstetric_history },
      { label: "Review of Systems", value: data.review_of_systems },
    ];
    const filledFields = fields.filter((f) => f.value?.trim()) as Array<{ label: string; value: string }>;
    if (filledFields.length === 0) return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;

    const heroRows = filledFields.filter((f) => f.label === "Keluhan Utama" || f.label === "Riwayat Penyakit Sekarang");
    const mainRows = filledFields.filter((f) => f.label !== "Keluhan Utama" && f.label !== "Riwayat Penyakit Sekarang");

    return (
      <div className="space-y-2">
        {heroRows.length > 0 && (
          <div className="space-y-1.5 border-l-2 border-primary/50 pl-2">
            {heroRows.map((row) => (
              <div key={row.label}>
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{row.label}</p>
                <p className="text-xs leading-5 text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        )}
        {renderDetailRows(mainRows)}
      </div>
    );
  };

  const renderPhysicalExamPreview = (data: PhysicalExam) => {
    const systolic = data.systolic || data.blood_pressure_systolic;
    const diastolic = data.diastolic || data.blood_pressure_diastolic;
    const vitalSigns = [
      data.general_condition ? { label: "Keadaan Umum", value: `${data.general_condition}` } : null,
      data.consciousness ? { label: "Kesadaran", value: `${data.consciousness}` } : null,
      systolic && diastolic ? { label: "TD", value: `${systolic}/${diastolic} mmHg` } : null,
      data.heart_rate ? { label: "HR", value: `${data.heart_rate}/mnt` } : null,
      data.respiratory_rate ? { label: "RR", value: `${data.respiratory_rate}/mnt` } : null,
      data.temperature ? { label: "Suhu", value: `${data.temperature}°C` } : null,
      data.oxygen_saturation ? { label: "SpO2", value: `${data.oxygen_saturation}%` } : null,
      data.weight ? { label: "BB", value: `${data.weight} kg` } : null,
      data.height ? { label: "TB", value: `${data.height} cm` } : null,
      data.bmi ? { label: "BMI", value: `${data.bmi}` } : null,
      data.upper_arm_circum ? { label: "LILA", value: `${data.upper_arm_circum}` } : null,
      data.head_circum ? { label: "Lingkar Kepala", value: `${data.head_circum}` } : null,
      data.waist ? { label: "Lingkar Perut", value: `${data.waist}` } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    const bodyParts = [
      { label: "Kepala", value: data.head },
      { label: "Mata", value: data.eyes },
      { label: "Telinga", value: data.ears },
      { label: "Hidung", value: data.nose },
      { label: "Tenggorokan", value: data.throat },
      { label: "Leher", value: data.neck },
      { label: "Dada", value: data.chest },
      { label: "Jantung", value: data.heart },
      { label: "Paru", value: data.lungs },
      { label: "Abdomen", value: data.abdomen },
      { label: "Ekstremitas", value: data.extremities },
      { label: "Kulit", value: data.skin },
      { label: "Neurologis", value: data.neurological },
      { label: "Genitourinaria", value: data.genitourinary },
      { label: "Temuan Lain", value: data.other_findings },
    ].filter((f) => f.value?.trim());

    const supporting = [
      data.pain_method ? { label: "Metode Nyeri", value: `${data.pain_method}` } : null,
      (data.pain_scale || data.pain_scale === 0) ? { label: "Skala Nyeri", value: `${data.pain_scale}` } : null,
      data.pain_location ? { label: "Lokasi Nyeri", value: `${data.pain_location}` } : null,
      data.ecg_result ? { label: "ECG", value: `${data.ecg_result}` } : null,
      data.ecg_interpretation ? { label: "Interpretasi ECG", value: `${data.ecg_interpretation}` } : null,
      data.ctg_result ? { label: "CTG", value: `${data.ctg_result}` } : null,
      data.ctg_interpretation ? { label: "Interpretasi CTG", value: `${data.ctg_interpretation}` } : null,
      data.pelvic_result ? { label: "Pemeriksaan Pelvis", value: `${data.pelvic_result}` } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    if (vitalSigns.length === 0 && bodyParts.length === 0 && supporting.length === 0) {
      return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;
    }

    return (
      <div className="space-y-2">
        {vitalSigns.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tanda Vital</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {vitalSigns.map((item) => (
                <span key={item.label} className="inline-flex items-center rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-foreground">
                  <span className="text-muted-foreground mr-1">{item.label}:</span>{item.value}
                </span>
              ))}
            </div>
          </div>
        )}
        {renderDetailRows(bodyParts as Array<{ label: string; value: string }>)}
        {supporting.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Pemeriksaan Penunjang</p>
            {renderDetailRows(supporting)}
          </div>
        )}
      </div>
    );
  };

  const renderDiagnosisPreview = (data: Diagnosis) => {
    const items = data.items || [];
    const hasItemDifferential = items.some((item) => item.differential_diagnosis?.trim());
    if (items.length === 0 && !data.clinical_impression && !data.differential_diagnosis && !hasItemDifferential) {
      return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;
    }

    const primaryCount = items.filter((i) => i.diagnosis_type === "primary").length;
    const secondaryCount = items.filter((i) => i.diagnosis_type === "secondary").length;
    const differentialCount = items.filter((i) => i.diagnosis_type === "differential").length;

    return (
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-border/50">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{items.length} ICD</Badge>
            {primaryCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{primaryCount} primer</Badge>}
            {secondaryCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{secondaryCount} sekunder</Badge>}
            {differentialCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{differentialCount} banding</Badge>}
          </div>
        )}
        {items.slice(0, 3).map((item: DiagnosisItem, idx: number) => (
          <div key={idx} className="space-y-1 border-b border-border/30 pb-1.5 last:border-b-0 last:pb-0">
            <div className="flex items-start gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 leading-4 flex-shrink-0">
                {item.icd10_code}
              </Badge>
              <span className="text-xs text-foreground leading-5 break-words">{item.icd10_name}</span>
            </div>
            {item.differential_diagnosis && (
              <p className="text-xs text-muted-foreground leading-5 break-words pl-7">DDx ICD: {item.differential_diagnosis}</p>
            )}
          </div>
        ))}
        {items.length > 3 && (
          <p className="text-[11px] text-muted-foreground">+{items.length - 3} diagnosis lainnya</p>
        )}
        {data.clinical_impression && (
          <p className="text-xs text-foreground leading-5 break-words"><span className="text-muted-foreground">Kesan Klinis:</span> {data.clinical_impression}</p>
        )}
        {data.differential_diagnosis && (
          <p className="text-xs text-foreground leading-5 break-words"><span className="text-muted-foreground">DDx:</span> {data.differential_diagnosis}</p>
        )}
      </div>
    );
  };

  const renderAssessmentPlanPreview = (data: AssessmentPlan) => {
    const fields = [
      { label: "Asesmen Klinis", value: data.clinical_assessment },
      { label: "Prognosis", value: data.prognosis },
      { label: "Rencana Terapi", value: data.treatment_plan },
      { label: "Rencana Obat", value: data.medication_plan },
      { label: "Rencana Diet", value: data.diet_plan },
      { label: "Rencana Aktivitas", value: data.activity_plan },
      { label: "Rencana Edukasi", value: data.education_plan },
      { label: "Rencana Prosedur", value: data.procedure_plan },
      { label: "Rencana Konsultasi", value: data.consultation_plan },
      { label: "Rencana Monitoring", value: data.monitoring_plan },
      { label: "Informed Consent", value: data.informed_consent },
    ];
    const filledFields = fields.filter((f) => f.value?.trim()) as Array<{ label: string; value: string }>;
    return renderDetailRows(filledFields);
  };

  const renderSectionCard = (
    section: string,
    data: unknown,
    visitId: number,
    renderPreview: (data: any) => React.ReactNode
  ) => {
    const hasSectionData = hasData(data);
    const copyKey = `${section}-${visitId}`;
    const isCopied = copiedSections.has(copyKey);

    const metric = getSectionMetric(section, data);

    return (
      <section className="py-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-4 w-0.5 bg-primary/70" />
            <p className="text-xs font-semibold truncate">{getSectionLabel(section)}</p>
            {metric && (
              <Badge variant="secondary" className="h-4 text-[9px] px-1.5 py-0 leading-4">
                {metric}
              </Badge>
            )}
          </div>
          {hasSectionData && (
            <Button
              variant={isCopied ? "default" : "outline"}
              size="sm"
              className={cn("h-5 text-[10px] gap-1 px-1.5", isCopied && "bg-green-600 hover:bg-green-600")}
              onClick={() => handleCopy(section, data, visitId)}
              disabled={isCopied}
            >
              {isCopied ? (
                <>
                  <Check className="h-3 w-3" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Salin
                </>
              )}
            </Button>
          )}
        </div>
        {hasSectionData ? renderPreview(data) : <p className="text-[11px] text-muted-foreground italic">Tidak ada data</p>}
      </section>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-screen max-w-[100vw] sm:w-[80vw] sm:max-w-[80vw] p-0">
        <SheetHeader className="px-3 py-2.5 border-b bg-muted/30">
          <div>
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <Copy className="h-3.5 w-3.5" />
              Salin dari Riwayat Kunjungan
            </SheetTitle>
            {patientName && (
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <User className="h-3 w-3" />
                {patientName}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 leading-4">
              Pilih kunjungan lama, lalu klik &quot;Salin&quot; pada bagian yang ingin disalin ke kunjungan aktif
            </p>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] [&_[data-radix-scroll-area-scrollbar]]:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Tidak ada riwayat kunjungan sebelumnya
            </div>
          ) : (
            <div className="p-2">
              <div className="border overflow-x-auto bg-background">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-muted/30 border-b">
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left font-medium px-2 py-2 w-[120px]">Tanggal</th>
                      <th className="text-left font-medium px-2 py-2 w-[110px]">Jenis</th>
                      <th className="text-left font-medium px-2 py-2">Unit / Dokter</th>
                      <th className="text-left font-medium px-2 py-2 w-[90px]">Status</th>
                      <th className="text-left font-medium px-2 py-2 w-[90px]">Ringkasan</th>
                      <th className="text-right font-medium px-2 py-2 w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationGroups.flatMap((group) =>
                      group.visits.map((visit) => {
                        const isExpanded = expandedVisitId === visit.id;
                        const data = visitData[visit.id];
                        const isLoadingDetail = loadingData.has(visit.id);
                        const doctorName = visit.doctor?.nama_lengkap || visit.doctor?.name;
                        const sectionFilled = data
                          ? [data.anamnesis, data.physicalExam, data.diagnosis, data.assessmentPlan].filter((sectionData) => hasData(sectionData)).length
                          : null;

                        return (
                          <Fragment key={visit.id}>
                            <tr
                              className={cn(
                                "border-b align-top cursor-pointer transition-colors",
                                isExpanded ? "bg-primary/5" : "hover:bg-muted/20"
                              )}
                              onClick={() => toggleVisitExpand(visit.id)}
                            >
                              <td className="px-2 py-2">
                                <div className="flex items-start gap-1.5">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="text-[11px] font-medium leading-4">
                                      {group.registrationDate
                                        ? format(new Date(group.registrationDate), "dd MMM yyyy", { locale: localeId })
                                        : "-"}
                                    </p>
                                    {visit.check_in_time && (
                                      <p className="text-[10px] text-muted-foreground leading-4">
                                        {format(new Date(visit.check_in_time), "HH:mm", { locale: localeId })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2 align-middle">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="text-muted-foreground flex h-4 w-4 items-center justify-center">{getVisitTypeIcon(visit.visit_type)}</span>
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 leading-4 whitespace-nowrap">
                                    {visitTypeLabels[visit.visit_type] || visit.visit_type}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <p className="text-[11px] font-medium leading-4 truncate">{visit.room?.name || "-"}</p>
                                {doctorName && <p className="text-[10px] text-muted-foreground leading-4 truncate">{doctorName}</p>}
                                <p className="text-[10px] text-muted-foreground leading-4 truncate">
                                  {visit.visit_number || visit.registration?.registration_number || `Visit #${visit.id}`}
                                </p>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1.5">
                                  {getStatusIcon(visit.status)}
                                  <span className="text-[10px] text-muted-foreground">{getStatusLabel(visit.status)}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 leading-4">
                                  {sectionFilled !== null ? `${sectionFilled}/4` : "4 bagian"}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleVisitExpand(visit.id);
                                  }}
                                  title={isExpanded ? "Tutup detail" : "Buka detail"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="border-b bg-gradient-to-b from-muted/15 to-background">
                                <td colSpan={6} className="px-2 py-2">
                                  {isLoadingDetail ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                      <span className="text-xs text-muted-foreground">Memuat rekam medis...</span>
                                    </div>
                                  ) : data ? (
                                    <div className="grid grid-cols-1 divide-y divide-border/60 border-l-2 border-primary/40 pl-3">
                                      {renderSectionCard("anamnesis", data.anamnesis, visit.id, renderAnamnesisPreview)}
                                      {renderSectionCard("physical-exam", data.physicalExam, visit.id, renderPhysicalExamPreview)}
                                      {renderSectionCard("diagnosis", data.diagnosis, visit.id, renderDiagnosisPreview)}
                                      {renderSectionCard("assessment-plan", data.assessmentPlan, visit.id, renderAssessmentPlanPreview)}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                                      Gagal memuat data
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
