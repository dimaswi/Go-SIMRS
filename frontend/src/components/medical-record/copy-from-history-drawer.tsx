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
      const textFields = ["anamnesis_source", "functional_status", "chief_complaint", "history_of_present_illness", "past_medical_history", "family_history", "social_history", "current_medications"];
      const filledText = textFields.filter(f => { const v = d[f]; return typeof v === "string" && v.trim() !== ""; }).length;
      const filled = filledText + (isMeaningfulAllergySummary(d.allergies) ? 1 : 0);
      emitMedicalRecordTabIndicator("anamnesis", `${filled}/9`);
      emitMedicalRecordTabSaved("anamnesis", false);
    } else if (section === "physical-exam") {
      const bodySectionIds = ["head", "eyes", "ears", "nose", "throat", "neck", "chest", "heart", "lungs", "abdomen", "extremities", "skin", "neurological"];
      const filledBody = bodySectionIds.filter(id => { const v = d[id]; return typeof v === "string" && v.trim() !== ""; }).length;
      const filledVitals = [
        d.general_condition ? 1 : 0, d.consciousness ? 1 : 0,
        (d.blood_pressure_systolic || d.systolic) ? 1 : 0,
        (d.blood_pressure_diastolic || d.diastolic) ? 1 : 0,
        d.heart_rate ? 1 : 0, d.respiratory_rate ? 1 : 0,
        d.temperature ? 1 : 0, d.oxygen_saturation ? 1 : 0,
        d.upper_arm_circum ? 1 : 0, d.head_circum ? 1 : 0, d.waist ? 1 : 0,
      ].reduce((a, b) => a + b, 0);
      emitMedicalRecordTabIndicator("physical-exam", `${filledBody + filledVitals}/24`);
      emitMedicalRecordTabSaved("physical-exam", false);
    } else if (section === "diagnosis") {
      const items = Array.isArray(d.items) ? d.items : [];
      const count = items.length + (typeof d.clinical_impression === "string" && d.clinical_impression.trim() ? 1 : 0) + (typeof d.differential_diagnosis === "string" && d.differential_diagnosis.trim() ? 1 : 0);
      emitMedicalRecordTabIndicator("diagnosis", `${count}`);
      emitMedicalRecordTabSaved("diagnosis", false);
    } else if (section === "assessment-plan") {
      const apFields = ["clinical_assessment", "treatment_plan", "prognosis", "medication_plan", "diet_plan", "activity_plan", "education_plan", "procedure_plan", "consultation_plan", "monitoring_plan", "informed_consent"];
      const filled = apFields.filter(f => { const v = d[f]; return typeof v === "string" && v.trim() !== ""; }).length;
      emitMedicalRecordTabIndicator("assessment-plan", `${filled}/11`);
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
      const textFields = ["anamnesis_source", "functional_status", "chief_complaint", "history_of_present_illness", "past_medical_history", "family_history", "social_history", "current_medications"];
      const filledText = textFields.filter((f) => {
        const v = d[f];
        return typeof v === "string" && v.trim() !== "";
      }).length;
      const filled = filledText + (isMeaningfulAllergySummary(d.allergies) ? 1 : 0);
      return `${filled}/9`;
    }

    if (section === "physical-exam") {
      const bodySectionIds = ["head", "eyes", "ears", "nose", "throat", "neck", "chest", "heart", "lungs", "abdomen", "extremities", "skin", "neurological"];
      const filledBody = bodySectionIds.filter((id) => {
        const v = d[id];
        return typeof v === "string" && v.trim() !== "";
      }).length;
      const filledVitals = [
        d.general_condition ? 1 : 0,
        d.consciousness ? 1 : 0,
        (d.blood_pressure_systolic || d.systolic) ? 1 : 0,
        (d.blood_pressure_diastolic || d.diastolic) ? 1 : 0,
        d.heart_rate ? 1 : 0,
        d.respiratory_rate ? 1 : 0,
        d.temperature ? 1 : 0,
        d.oxygen_saturation ? 1 : 0,
        d.upper_arm_circum ? 1 : 0,
        d.head_circum ? 1 : 0,
        d.waist ? 1 : 0,
      ].reduce((a, b) => a + b, 0);
      return `${filledBody + filledVitals}/24`;
    }

    if (section === "diagnosis") {
      const items = Array.isArray(d.items) ? d.items : [];
      const count =
        items.length +
        (typeof d.clinical_impression === "string" && d.clinical_impression.trim() ? 1 : 0) +
        (typeof d.differential_diagnosis === "string" && d.differential_diagnosis.trim() ? 1 : 0);
      return `${count}`;
    }

    if (section === "assessment-plan") {
      const apFields = ["clinical_assessment", "treatment_plan", "prognosis", "medication_plan", "diet_plan", "activity_plan", "education_plan", "procedure_plan", "consultation_plan", "monitoring_plan", "informed_consent"];
      const filled = apFields.filter((f) => {
        const v = d[f];
        return typeof v === "string" && v.trim() !== "";
      }).length;
      return `${filled}/11`;
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
      { label: "Riwayat Penyakit Dahulu", value: data.past_medical_history },
      { label: "Riwayat Keluarga", value: data.family_history },
      { label: "Riwayat Sosial", value: data.social_history },
      { label: "Alergi", value: data.allergies },
      { label: "Obat Saat Ini", value: data.current_medications },
    ];
    const filledFields = fields.filter((f) => f.value?.trim());
    if (filledFields.length === 0) return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;

    return (
      <div className="space-y-1">
        {filledFields.map((f) => (
          <div key={f.label} className="grid grid-cols-[88px_1fr] gap-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase leading-4">{f.label}</p>
            <p className="text-xs text-foreground line-clamp-2 leading-4">{f.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderPhysicalExamPreview = (data: PhysicalExam) => {
    const vitalSigns = [
      data.general_condition && `Keadaan Umum: ${data.general_condition}`,
      data.consciousness && `Kesadaran: ${data.consciousness}`,
      (data.systolic || data.blood_pressure_systolic) && `TD: ${data.systolic || data.blood_pressure_systolic}/${data.diastolic || data.blood_pressure_diastolic} mmHg`,
      data.heart_rate && `HR: ${data.heart_rate}/mnt`,
      data.respiratory_rate && `RR: ${data.respiratory_rate}/mnt`,
      data.temperature && `Suhu: ${data.temperature}°C`,
      data.oxygen_saturation && `SpO2: ${data.oxygen_saturation}%`,
    ].filter(Boolean);

    const bodyParts = [
      { label: "Kepala", value: data.head },
      { label: "Mata", value: data.eyes },
      { label: "Leher", value: data.neck },
      { label: "Dada", value: data.chest },
      { label: "Abdomen", value: data.abdomen },
      { label: "Ekstremitas", value: data.extremities },
    ].filter((f) => f.value?.trim());

    if (vitalSigns.length === 0 && bodyParts.length === 0) {
      return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;
    }

    return (
      <div className="space-y-1">
        {vitalSigns.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase leading-4">Tanda Vital</p>
            <p className="text-xs text-foreground line-clamp-2 leading-4">{vitalSigns.join(" · ")}</p>
          </div>
        )}
        {bodyParts.map((f) => (
          <div key={f.label} className="grid grid-cols-[72px_1fr] gap-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase leading-4">{f.label}</p>
            <p className="text-xs text-foreground line-clamp-2 leading-4">{f.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderDiagnosisPreview = (data: Diagnosis) => {
    const items = data.items || [];
    if (items.length === 0 && !data.clinical_impression && !data.differential_diagnosis) {
      return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;
    }

    const primaryCount = items.filter((i) => i.diagnosis_type === "primary").length;

    return (
      <div className="space-y-1">
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{items.length} ICD</Badge>
            {primaryCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{primaryCount} primer</Badge>}
          </div>
        )}
        {items.slice(0, 2).map((item: DiagnosisItem, idx: number) => (
          <div key={idx} className="flex items-start gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 leading-4 flex-shrink-0">
              {item.icd10_code}
            </Badge>
            <span className="text-xs text-foreground line-clamp-1 leading-4">{item.icd10_name}</span>
          </div>
        ))}
        {data.clinical_impression && (
          <p className="text-xs text-foreground line-clamp-2 leading-4">{data.clinical_impression}</p>
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
      { label: "Rencana Edukasi", value: data.education_plan },
    ];
    const filledFields = fields.filter((f) => f.value?.trim());
    if (filledFields.length === 0) return <p className="text-xs text-muted-foreground italic">Tidak ada data</p>;

    return (
      <div className="space-y-1">
        {filledFields.map((f) => (
          <div key={f.label} className="grid grid-cols-[88px_1fr] gap-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase leading-4">{f.label}</p>
            <p className="text-xs text-foreground line-clamp-2 leading-4">{f.value}</p>
          </div>
        ))}
      </div>
    );
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
      <div className="rounded-md border bg-background/90 p-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[11px] font-semibold truncate">{getSectionLabel(section)}</p>
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
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[56%] sm:max-w-none p-0">
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
              Tidak ada riwayat kunjungan klinis sebelumnya
            </div>
          ) : (
            <div className="p-2">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b">
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
                              className="border-b align-top hover:bg-muted/20 cursor-pointer"
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
                                  <span className="text-[10px] text-muted-foreground capitalize">{visit.status}</span>
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
                              <tr className="border-b bg-muted/10">
                                <td colSpan={6} className="px-2 py-2">
                                  {isLoadingDetail ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                      <span className="text-xs text-muted-foreground">Memuat rekam medis...</span>
                                    </div>
                                  ) : data ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
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
