import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eklaimLocalApi } from "@/lib/api/eklaim-local";
import type {
  EKlaimRMDuplicate,
  EKlaimRMDiagnosis,
  EKlaimRMProcedure,
  EKlaimRMOrder,
  EKlaimRMOrderItem,
  EKlaimRMOrderResult,
  EKlaimRMMedicineItem,
  EKlaimRMCPPT,
  EKlaimRMFluidBalance,
  EKlaimRMNursingCare,
} from "@/lib/api/eklaim-local";
import { proceduresApi, procedureParametersApi } from "@/lib/api/procedures";
import type {
  Procedure,
  ProcedureParameter,
  ProcedureType,
} from "@/lib/api/procedures";
import { medicinesApi } from "@/lib/api/medicines";
import { employeesApi } from "@/lib/api/employees";
import { useToast } from "@/hooks/use-toast";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import {
  Loader2,
  X,
  Stethoscope,
  HeartPulse,
  FlaskConical,
  ScanLine,
  Scissors,
  ClipboardList,
  LogOut,
  DollarSign,
  Activity,
  RefreshCw,
  Pill,
  MessageSquare,
  FileText,
  Droplets,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ICD9CMCombobox } from "@/components/ui/icd9cm-combobox";
import { cn } from "@/lib/utils";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { TriageForm } from "@/components/medical-record/triage-form";
import { medicalRecordsApi } from "@/lib/api";
import type { CPPT, FluidBalance, NursingCare, PhysicalExam } from "@/lib/api";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { SurgeryWorkstation } from "../../components/medical-record/surgery-workstation";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import type {
  ProcedureOrder,
  ProcedureOrderItem,
  SubmitResultsInput,
} from "@/lib/api/procedure-orders";
import type { MedicineOrder, MedicineOrderItem } from "@/lib/api";
import nursingMasterRaw from "@/master-data/nursing/sdki-slki-siki.master.json?raw";

interface RMDuplicateTabProps {
  eklaimId: number;
  rmDuplicate: EKlaimRMDuplicate | null | undefined;
  visit?: any;
  onSaved: () => void;
  stickyTopOffset?: number;
}

// ── Section definitions ──
const SECTIONS = [
  { id: "visit-data", label: "Data Kunjungan", icon: Calendar },
  { id: "anamnesis", label: "Anamnesis", icon: Stethoscope },
  { id: "physical-exam", label: "Pemeriksaan Fisik", icon: HeartPulse },
  { id: "triage", label: "Triage UGD", icon: AlertTriangle },
  { id: "diagnoses", label: "Diagnosa", icon: ClipboardList },
  { id: "procedures", label: "Prosedur ICD-9", icon: Activity },
  { id: "lab-orders", label: "Laboratorium", icon: FlaskConical },
  { id: "radiology-orders", label: "Radiologi", icon: ScanLine },
  { id: "surgery-orders", label: "Operasi", icon: Scissors },
  { id: "consultation-orders", label: "Konsultasi", icon: MessageSquare },
  { id: "medicines", label: "Obat / Farmasi", icon: Pill },
  { id: "assessment", label: "Assessment & Plan", icon: FileText },
  { id: "disposition", label: "Disposisi", icon: LogOut },
  { id: "cppt", label: "CPPT", icon: MessageSquare },
  { id: "fluid-balance", label: "Balance Cairan", icon: Droplets },
  { id: "nursing-care", label: "Asuhan Keperawatan", icon: HeartPulse },
  { id: "billing", label: "Billing Duplikat", icon: DollarSign },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const pad2 = (value: number) => String(value).padStart(2, "0");

const getCurrentDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const getCurrentDateTimeValue = () => {
  const now = new Date();
  return `${getCurrentDateValue()}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
};

const createEmptyDuplicateCPPT = (sequence: number): EKlaimRMCPPT => ({
  record_date: getCurrentDateTimeValue(),
  profession: "dokter",
  cppt_format: "soap",
  staff_name: "",
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
  is_fake: true,
  notes: "",
  sequence,
  created_by_name: "",
  approved_by_name: "",
});

const createEmptyDuplicateFluidBalance = (sequence: number): EKlaimRMFluidBalance => ({
  record_date: getCurrentDateValue(),
  shift_type: "pagi",
  staff_name: "",
  oral_drink: 0,
  oral_food: 0,
  oral_medicine: 0,
  iv_fluid: 0,
  iv_medicine: 0,
  blood_product: 0,
  enteral_feed: 0,
  other_intake: 0,
  urine_amount: 0,
  feces_amount: 0,
  vomit_amount: 0,
  drain_amount: 0,
  blood_loss: 0,
  iwl: 0,
  other_output: 0,
  total_intake: 0,
  total_output: 0,
  balance: 0,
  is_fake: true,
  notes: "",
  sequence,
  created_by_name: "",
  approved_by_name: "",
});

const createEmptyDuplicateNursingCare = (sequence: number): EKlaimRMNursingCare => ({
  record_date: getCurrentDateTimeValue(),
  shift_type: "pagi",
  staff_name: "",
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
  problem_status: "belum_teratasi",
  is_fake: true,
  notes: "",
  sequence,
  created_by_name: "",
  approved_by_name: "",
});

const DUPLICATE_CPPT_PROFESSIONS = [
  { value: "dokter", label: "Dokter" },
  { value: "perawat", label: "Perawat" },
  { value: "farmasi", label: "Farmasi" },
  { value: "gizi", label: "Gizi" },
  { value: "bidan", label: "Bidan" },
  { value: "lainnya", label: "Lainnya" },
];

const DUPLICATE_SHIFT_TYPES = [
  { value: "pagi", label: "Pagi" },
  { value: "siang", label: "Siang" },
  { value: "malam", label: "Malam" },
];

const DUPLICATE_OUTCOME_TARGETS = [
  { value: "meningkat", label: "Meningkat" },
  { value: "menurun", label: "Menurun" },
  { value: "membaik", label: "Membaik" },
  { value: "cukup", label: "Cukup" },
  { value: "sedang", label: "Sedang" },
];

const DUPLICATE_PROBLEM_STATUS = [
  { value: "teratasi", label: "Teratasi" },
  { value: "teratasi_sebagian", label: "Teratasi Sebagian" },
  { value: "belum_teratasi", label: "Belum Teratasi" },
];

// ── Nursing master data for SDKI auto-fill in duplicate nursing care dialog ──
interface DuplicateNursingMasterItem {
  sdki: {
    code: string;
    label: string;
    definisi?: string;
    fisiologis?: string[];
    situasional?: string[];
    gejala_tanda?: {
      mayor?: { subjektif?: string[]; objektif?: string[] };
      minor?: { subjektif?: string[]; objektif?: string[] };
    };
  };
  slki?: { luaran_utama?: string[]; luaran_tambahan?: string[] };
  siki?: { intervensi_utama?: string[]; intervensi_pendukung?: string[] };
}
const normalizeDuplicateSdkiCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
const buildDuplicateMultilineText = (title: string, values: string[] = []) =>
  values.length === 0 ? "" : `${title}:\n${values.join("\n")}`;
const parsedDuplicateNursingMasterItems: DuplicateNursingMasterItem[] = (() => {
  try {
    const parsed = JSON.parse(nursingMasterRaw) as { items?: DuplicateNursingMasterItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
})();

/** Format a date-like string (ISO/fake_date) as DDMMYYYY */
function fmtDateCode(d?: string): string {
  if (!d || d.length < 10) return new Date().toLocaleDateString("en-GB").replace(/\//g, "");
  return d.slice(8, 10) + d.slice(5, 7) + d.slice(0, 4);
}

export default function RMDuplicateTab({
  eklaimId,
  rmDuplicate,
  visit,
  onSaved,
  stickyTopOffset,
}: RMDuplicateTabProps) {
  const { toast } = useToast();
  const activeVisitId = Number(visit?.id || rmDuplicate?.visit_id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("anamnesis");
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [visitPhysicalExam, setVisitPhysicalExam] = useState<Partial<PhysicalExam> | null>(null);

  const originalPhysicalExam = useMemo(() => {
    try {
      const raw = rmDuplicate?.original_rm_json;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.physical_exam || null;
    } catch {
      return null;
    }
  }, [rmDuplicate?.original_rm_json]);

  useEffect(() => {
    const visitId = Number(visit?.id || rmDuplicate?.visit_id || 0);
    if (!visitId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await medicalRecordsApi.getPhysicalExam(visitId);
        if (!cancelled) setVisitPhysicalExam(res?.data || null);
      } catch {
        if (!cancelled) setVisitPhysicalExam(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visit?.id, rmDuplicate?.visit_id]);

  // ── Anamnesis ──
  const [anamnesisSource, setAnamnesisSource] = useState("autoanamnesis");
  const [functionalStatus, setFunctionalStatus] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState("");
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [socialHistory, setSocialHistory] = useState("");
  const [allergies, setAllergies] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [reviewOfSystems, setReviewOfSystems] = useState("");

  // ── Physical Exam / Vital Signs ──
  const [generalCondition, setGeneralCondition] = useState("");
  const [consciousness, setConsciousness] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [systolic, setSystolic] = useState(0);
  const [diastolic, setDiastolic] = useState(0);
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bmi, setBmi] = useState(0);
  const [waist, setWaist] = useState("");
  const [headCircum, setHeadCircum] = useState("");
  const [painMethod, setPainMethod] = useState("nrs");
  const [painScale, setPainScale] = useState(0);
  const [painLocation, setPainLocation] = useState("");

  // ── Body Systems (legacy) ──
  const [, setHeadNeck] = useState("");
  const [eyes, setEyes] = useState("");
  const [, setEnt] = useState("");
  const [, setThorax] = useState("");
  const [, setCardiac] = useState("");
  const [, setPulmonary] = useState("");
  const [abdomen, setAbdomen] = useState("");
  const [extremities, setExtremities] = useState("");
  const [neurological, setNeurological] = useState("");
  const [skin, setSkin] = useState("");

  // ── Body Systems (new individual) ──
  const [head, setHead] = useState("");
  const [ears, setEars] = useState("");
  const [nose, setNose] = useState("");
  const [throat, setThroat] = useState("");
  const [neck, setNeck] = useState("");
  const [chest, setChest] = useState("");
  const [heartExam, setHeartExam] = useState("");
  const [lungs, setLungs] = useState("");
  const [, setMusculoskel] = useState("");
  const [, setGenitourinary] = useState("");
  const [otherFindings, setOtherFindings] = useState("");

  // ── ECG ──
  const [ecgPerformed, setEcgPerformed] = useState(false);
  const [ecgResult, setEcgResult] = useState("");
  const [ecgInterpretation, setEcgInterpretation] = useState("");
  const [ecgNotes, setEcgNotes] = useState("");

  // ── Assessment & Plan ──
  const [clinicalAssessment, setClinicalAssessment] = useState("");
  const [prognosis, setPrognosis] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medicationPlan, setMedicationPlan] = useState("");
  const [dietPlan, setDietPlan] = useState("");
  const [activityPlan, setActivityPlan] = useState("");
  const [educationPlan, setEducationPlan] = useState("");
  const [monitoringPlan, setMonitoringPlan] = useState("");
  const [procedurePlan, setProcedurePlan] = useState("");
  const [consultationPlan, setConsultationPlan] = useState("");

  // ── Disposition ──
  const [dispositionType, setDispositionType] = useState("");
  const [dispositionNote, setDispositionNote] = useState("");
  const [rmDischargeStatus, setRmDischargeStatus] = useState("");
  const [dischargeCondition, setDischargeCondition] = useState("");
  const [dischargeInstruction, setDischargeInstruction] = useState("");
  const [dischargeMedication, setDischargeMedication] = useState("");
  const [followUpInstruction, setFollowUpInstruction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [referralFacility, setReferralFacility] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [referralDiagnosis, setReferralDiagnosis] = useState("");
  const [referralTherapy, setReferralTherapy] = useState("");
  const [referralNotes, setReferralNotes] = useState("");
  const [deathTime, setDeathTime] = useState("");
  const [deathCause, setDeathCause] = useState("");

  // ── Triage UGD ──
  const [triageArrivalMode, setTriageArrivalMode] = useState("");
  const [triageComplaint, setTriageComplaint] = useState("");
  const [triageLevel, setTriageLevel] = useState("");
  const [triageAirway, setTriageAirway] = useState("");
  const [triageAirwayNote, setTriageAirwayNote] = useState("");
  const [triageBreathing, setTriageBreathing] = useState("");
  const [triageBreathingNote, setTriageBreathingNote] = useState("");
  const [triageCirculation, setTriageCirculation] = useState("");
  const [triageCirculationNote, setTriageCirculationNote] = useState("");
  const [triageBloodPressure, setTriageBloodPressure] = useState("");
  const [triageHeartRate, setTriageHeartRate] = useState("");
  const [triageRespiratoryRate, setTriageRespiratoryRate] = useState("");
  const [triageTemperature, setTriageTemperature] = useState("");
  const [triageOxygenSat, setTriageOxygenSat] = useState("");
  const [triagePainScale, setTriagePainScale] = useState(0);
  const [triageGCSE, setTriageGCSE] = useState(4);
  const [triageGCSV, setTriageGCSV] = useState(5);
  const [triageGCSM, setTriageGCSM] = useState(6);
  const [triageAssessment, setTriageAssessment] = useState("");
  const [triageImmediateAction, setTriageImmediateAction] = useState("");

  useMultipleMasterData([
    "arrival_mode",
    "triage_level",
    "airway_status",
    "breathing_status",
    "circulation_status",
  ]);

  const [diagnoses, setDiagnoses] = useState<EKlaimRMDiagnosis[]>([]);
  const [procedures, setProcedures] = useState<EKlaimRMProcedure[]>([]);
  const [orders, setOrders] = useState<EKlaimRMOrder[]>([]);
  const [medicineItems, setMedicineItems] = useState<EKlaimRMMedicineItem[]>([]);
  // Incremented each time populateFromRM runs so workstation components (Lab, Radiology,
  // Surgery, Consultation, Pharmacy) remount WITH the loaded adapter data instead of the
  // empty-state adapter they captured on first mount.
  const [rmDataVersion, setRmDataVersion] = useState(0);
  const [cpptNotes, setCpptNotes] = useState<EKlaimRMCPPT[]>([]);
  const [fluidBalances, setFluidBalances] = useState<EKlaimRMFluidBalance[]>([]);
  const [nursingCares, setNursingCares] = useState<EKlaimRMNursingCare[]>([]);
  const [cpptDialogOpen, setCpptDialogOpen] = useState(false);
  const [fluidBalanceDialogOpen, setFluidBalanceDialogOpen] = useState(false);
  const [nursingCareDialogOpen, setNursingCareDialogOpen] = useState(false);
  const [newCppt, setNewCppt] = useState<EKlaimRMCPPT>(createEmptyDuplicateCPPT(1));
  const [newFluidBalance, setNewFluidBalance] = useState<EKlaimRMFluidBalance>(
    createEmptyDuplicateFluidBalance(1),
  );
  const [newNursingCare, setNewNursingCare] = useState<EKlaimRMNursingCare>(
    createEmptyDuplicateNursingCare(1),
  );
  const [duplicateNursingMasterCode, setDuplicateNursingMasterCode] = useState("");

  const [, setTarifProsedurNonBedah] = useState(0);
  const [, setTarifProsedurBedah] = useState(0);
  const [, setTarifKonsultasi] = useState(0);
  const [, setTarifTenagaAhli] = useState(0);
  const [, setTarifKeperawatan] = useState(0);
  const [, setTarifPenunjang] = useState(0);
  const [, setTarifRadiologi] = useState(0);
  const [, setTarifLaboratorium] = useState(0);
  const [, setTarifPelayananDarah] = useState(0);
  const [, setTarifRehabilitasi] = useState(0);
  const [, setTarifKamar] = useState(0);
  const [, setTarifRawatIntensif] = useState(0);
  const [, setTarifObat] = useState(0);
  const [, setTarifObatKronis] = useState(0);
  const [, setTarifObatKemoterapi] = useState(0);
  const [, setTarifAlkes] = useState(0);
  const [, setTarifBMHP] = useState(0);
  const [, setTarifSewaAlat] = useState(0);

  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [lengthOfStay, setLengthOfStay] = useState(0);
  const [, setAccommodationTariffPerDay] = useState(0);

  const [procSearchTerm, setProcSearchTerm] = useState("");
  const [procSearchResults, setProcSearchResults] = useState<Procedure[]>([]);
  const [searchingProcs, setSearchingProcs] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const [quickAddOrderType, setQuickAddOrderType] = useState<
    EKlaimRMOrder["order_type"] | null
  >(null);
  const [quickAddFakeDate, setQuickAddFakeDate] = useState<string | null>(null);
  const [quickAddAddedNames, setQuickAddAddedNames] = useState<string[]>([]);

  const closeQuickAddDialog = () => {
    setQuickAddOrderType(null);
    setQuickAddFakeDate(null);
    setQuickAddAddedNames([]);
    setProcSearchTerm("");
    setProcSearchResults([]);
  };

  const [duplicateDoctorOptions, setDuplicateDoctorOptions] = useState<
    { id: number; name: string }[]
  >([]);

  useEffect(() => {
    let active = true;
    const loadDoctors = async () => {
      try {
        const res = await employeesApi.getAll({ is_active: "true", limit: 300 });
        const rows = res.data?.data || [];
        const filtered = rows
          .filter((emp) => {
            const hay = `${emp.tipe_karyawan || ""} ${emp.jabatan || ""} ${emp.spesialisasi || ""}`.toLowerCase();
            return hay.includes("dokter") || hay.includes("dr");
          })
          .map((emp) => ({ id: emp.id, name: emp.nama_lengkap }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const unique = filtered.filter(
          (item, idx, arr) => arr.findIndex((x) => x.name === item.name) === idx,
        );
        if (active) setDuplicateDoctorOptions(unique);
      } catch {
        if (active) setDuplicateDoctorOptions([]);
      }
    };

    loadDoctors();
    return () => {
      active = false;
    };
  }, []);

  // ══════════════════════════════════════════════
  // Data population
  // ══════════════════════════════════════════════
  const populateFromRM = useCallback((rm: EKlaimRMDuplicate) => {
    let originalPE: any = null;
    try {
      if (rm.original_rm_json) {
        const parsed = JSON.parse(rm.original_rm_json);
        originalPE = parsed?.physical_exam || null;
      }
    } catch {
      originalPE = null;
    }

    setAnamnesisSource(rm.anamnesis_source || "autoanamnesis");
    setFunctionalStatus(rm.functional_status || "");
    setChiefComplaint(rm.chief_complaint || "");
    setHistoryOfPresentIllness(rm.history_of_present_illness || "");
    setPastMedicalHistory(rm.past_medical_history || "");
    setFamilyHistory(rm.family_history || "");
    setSocialHistory(rm.social_history || "");
    setAllergies(rm.allergies || "");
    setCurrentMedications(rm.current_medications || "");
    setReviewOfSystems(rm.review_of_systems || "");
    setGeneralCondition(rm.general_condition || originalPE?.general_condition || "");
    setConsciousness(rm.consciousness || originalPE?.consciousness || "");
    setBloodPressure(rm.blood_pressure || originalPE?.blood_pressure || "");
    setSystolic(rm.systolic || originalPE?.systolic || originalPE?.blood_pressure_systolic || 0);
    setDiastolic(rm.diastolic || originalPE?.diastolic || originalPE?.blood_pressure_diastolic || 0);
    setHeartRate(rm.heart_rate || originalPE?.heart_rate || "");
    setRespiratoryRate(rm.respiratory_rate || originalPE?.respiratory_rate || "");
    setTemperature(rm.temperature || originalPE?.temperature || "");
    setOxygenSaturation(rm.oxygen_saturation || originalPE?.oxygen_saturation || "");
    setWeight(rm.weight || originalPE?.weight || "");
    setHeight(rm.height || originalPE?.height || "");
    setBmi(rm.bmi || originalPE?.bmi || 0);
    setWaist(rm.waist || originalPE?.waist || "");
    setHeadCircum(rm.head_circum || originalPE?.head_circum || "");
    setPainMethod(rm.pain_method || originalPE?.pain_method || "nrs");
    setPainScale(rm.pain_scale ?? originalPE?.pain_scale ?? 0);
    setPainLocation(rm.pain_location || originalPE?.pain_location || "");
    setHeadNeck(rm.head_neck || originalPE?.head_neck || "");
    setEyes(rm.eyes || originalPE?.eyes || "");
    setEnt(rm.ent || originalPE?.ent || "");
    setThorax(rm.thorax || originalPE?.thorax || "");
    setCardiac(rm.cardiac || originalPE?.cardiac || "");
    setPulmonary(rm.pulmonary || originalPE?.pulmonary || "");
    setAbdomen(rm.abdomen || originalPE?.abdomen || "");
    setExtremities(rm.extremities || originalPE?.extremities || "");
    setNeurological(rm.neurological || originalPE?.neurological || "");
    setSkin(rm.skin || originalPE?.skin || "");
    setHead(rm.head || originalPE?.head || rm.head_neck || originalPE?.head_neck || "");
    setEars(rm.ears || originalPE?.ears || rm.ent || originalPE?.ent || "");
    setNose(rm.nose || originalPE?.nose || rm.ent || originalPE?.ent || "");
    setThroat(rm.throat || originalPE?.throat || rm.ent || originalPE?.ent || "");
    setNeck(rm.neck || originalPE?.neck || rm.head_neck || originalPE?.head_neck || "");
    setChest(rm.chest || rm.thorax || originalPE?.chest || originalPE?.thorax || "");
    setHeartExam(rm.heart || rm.cardiac || originalPE?.heart || originalPE?.cardiac || "");
    setLungs(rm.lungs || rm.pulmonary || originalPE?.lungs || originalPE?.pulmonary || "");
    setMusculoskel(rm.musculoskel || originalPE?.musculoskel || "");
    setGenitourinary(rm.genitourinary || originalPE?.genitourinary || "");
    setOtherFindings(rm.other_findings || originalPE?.other_findings || "");
    setEcgPerformed(rm.ecg_performed || false);
    setEcgResult(rm.ecg_result || "");
    setEcgInterpretation(rm.ecg_interpretation || "");
    setEcgNotes(rm.ecg_notes || "");
    setClinicalAssessment(rm.clinical_assessment || "");
    setPrognosis(rm.prognosis || "");
    setTreatmentPlan(rm.treatment_plan || "");
    setMedicationPlan(rm.medication_plan || "");
    setDietPlan(rm.diet_plan || "");
    setActivityPlan(rm.activity_plan || "");
    setEducationPlan(rm.education_plan || "");
    setMonitoringPlan(rm.monitoring_plan || "");
    setProcedurePlan(rm.procedure_plan || "");
    setConsultationPlan(rm.consultation_plan || "");
    setDispositionType(rm.disposition_type || "");
    setDispositionNote(rm.disposition_note || "");
    setRmDischargeStatus(rm.rm_discharge_status || "");
    setDischargeCondition(rm.discharge_condition || "");
    setDischargeInstruction(rm.discharge_instruction || "");
    setDischargeMedication(rm.discharge_medication || "");
    setFollowUpInstruction(rm.follow_up_instruction || "");
    setFollowUpDate(rm.follow_up_date || "");
    setReferralFacility(rm.referral_facility || "");
    setReferralReason(rm.referral_reason || "");
    setReferralDiagnosis(rm.referral_diagnosis || "");
    setReferralTherapy(rm.referral_therapy || "");
    setReferralNotes(rm.referral_notes || "");
    setDeathTime(rm.death_time || "");
    setDeathCause(rm.death_cause || "");

    // Triage UGD
    setTriageArrivalMode(rm.triage_arrival_mode || "");
    setTriageComplaint(rm.triage_complaint || "");
    setTriageLevel(rm.triage_level || "");
    setTriageAirway(rm.triage_airway || "");
    setTriageAirwayNote(rm.triage_airway_note || "");
    setTriageBreathing(rm.triage_breathing || "");
    setTriageBreathingNote(rm.triage_breathing_note || "");
    setTriageCirculation(rm.triage_circulation || "");
    setTriageCirculationNote(rm.triage_circulation_note || "");
    setTriageBloodPressure(rm.triage_blood_pressure || "");
    setTriageHeartRate(rm.triage_heart_rate || "");
    setTriageRespiratoryRate(rm.triage_respiratory_rate || "");
    setTriageTemperature(rm.triage_temperature || "");
    setTriageOxygenSat(rm.triage_oxygen_saturation || "");
    setTriagePainScale(rm.triage_pain_scale ?? 0);
    setTriageGCSE(rm.triage_gcs_e ?? 4);
    setTriageGCSV(rm.triage_gcs_v ?? 5);
    setTriageGCSM(rm.triage_gcs_m ?? 6);
    setTriageAssessment(rm.triage_assessment || "");
    setTriageImmediateAction(rm.triage_immediate_actions || "");

    setDiagnoses(rm.diagnoses || []);
    setProcedures(rm.procedures || []);
    setOrders(
      (rm.orders || []).map((o: EKlaimRMOrder) => ({
        ...o,
        fake_date: o.fake_date
          ? o.fake_date.replace("Z", "").replace(/\+.*$/, "").slice(0, 19)
          : undefined,
      })),
    );
    setMedicineItems(
      (rm.medicine_items || []).map((item: EKlaimRMMedicineItem) => ({
        ...item,
        // Strip timezone suffix so fake_date matches the same normalisation
        // applied to orders above (e.g. "2026-03-29T03:10:29Z" → "2026-03-29T03:10:29").
        fake_date: item.fake_date
          ? item.fake_date.replace("Z", "").replace(/\+.*$/, "").slice(0, 19)
          : undefined,
      })),
    );
    setCpptNotes(rm.cppt_notes || []);
    setFluidBalances(rm.fluid_balances || []);
    setNursingCares(rm.nursing_cares || []);

    setTarifProsedurNonBedah(rm.tarif_prosedur_non_bedah || 0);
    setTarifProsedurBedah(rm.tarif_prosedur_bedah || 0);
    setTarifKonsultasi(rm.tarif_konsultasi || 0);
    setTarifTenagaAhli(rm.tarif_tenaga_ahli || 0);
    setTarifKeperawatan(rm.tarif_keperawatan || 0);
    setTarifPenunjang(rm.tarif_penunjang || 0);
    setTarifRadiologi(rm.tarif_radiologi || 0);
    setTarifLaboratorium(rm.tarif_laboratorium || 0);
    setTarifPelayananDarah(rm.tarif_pelayanan_darah || 0);
    setTarifRehabilitasi(rm.tarif_rehabilitasi || 0);
    setTarifKamar(rm.tarif_kamar || 0);
    setTarifRawatIntensif(rm.tarif_rawat_intensif || 0);
    setTarifObat(rm.tarif_obat || 0);
    setTarifObatKronis(rm.tarif_obat_kronis || 0);
    setTarifObatKemoterapi(rm.tarif_obat_kemoterapi || 0);
    setTarifAlkes(rm.tarif_alkes || 0);
    setTarifBMHP(rm.tarif_bmhp || 0);
    setTarifSewaAlat(rm.tarif_sewa_alat || 0);

    // Inpatient-specific fields
    setAdmissionDate(rm.admission_date || "");
    setDischargeDate(rm.discharge_date || "");
    setLengthOfStay(rm.length_of_stay || 0);
    setAccommodationTariffPerDay(rm.accommodation_tariff_per_day || 0);

    setDirty(false);
  }, []);

  useEffect(() => {
    if (rmDuplicate) {
      populateFromRM(rmDuplicate);
      // Increment version so workstation components remount with populated adapters.
      // All setX() calls inside populateFromRM and this setRmDataVersion are batched
      // into one render by React 18, ensuring the new key arrives with loaded state.
      setRmDataVersion((v) => v + 1);
    }
  }, [rmDuplicate, populateFromRM]);

  useEffect(() => {
    if (medicineItems.length === 0) return;

    const existingPharmacyOrders = orders.filter(
      (order) => order.order_type === "pharmacy",
    );
    if (existingPharmacyOrders.length > 0) return;

    const groupedFakeDates = Array.from(
      new Set(medicineItems.map((item) => item.fake_date).filter(Boolean)),
    ) as string[];

    const fallbackFakeDates =
      groupedFakeDates.length > 0
        ? groupedFakeDates
        : [new Date().toISOString().slice(0, 19)];

    setOrders((prev) => {
      if (prev.some((order) => order.order_type === "pharmacy")) return prev;

      const baseSequence = prev.length;
      const fallbackOrders = fallbackFakeDates.map((fakeDate, index) => ({
        ...createEmptyOrder("pharmacy", true, baseSequence + index + 1),
        order_number: `RX${fmtDateCode(fakeDate)}${index + 1}`,
        fake_date: fakeDate,
      }));

      return [...prev, ...fallbackOrders];
    });

    setMedicineItems((prev) => {
      if (groupedFakeDates.length > 0) return prev;
      const fallbackFakeDate = fallbackFakeDates[0];
      return prev.map((item) => ({
        ...item,
        fake_date: item.fake_date || fallbackFakeDate,
      }));
    });
  }, [medicineItems, orders]);

  // Populate inpatient data from visit if RM Duplicate fields are empty
  useEffect(() => {
    if (!visit) return;
    
    // Only populate if RM Duplicate doesn't have these values set
    if (visit.admission_time && !admissionDate && !rmDuplicate?.admission_date) {
      setAdmissionDate(visit.admission_time); // Use full datetime
    }
    if (visit.discharge_time && !dischargeDate && !rmDuplicate?.discharge_date) {
      setDischargeDate(visit.discharge_time);
    }
    
    // Set LengthOfStay from visit.inpatient_days if not manually set
    if (visit.inpatient_days && !lengthOfStay && !rmDuplicate?.length_of_stay) {
      setLengthOfStay(visit.inpatient_days);
    }
  }, [visit, rmDuplicate]);

  useEffect(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (w > 0 && h > 0) {
      const hm = h / 100;
      setBmi(Math.round((w / (hm * hm)) * 10) / 10);
    }
  }, [weight, height]);

  useEffect(() => {
    if (systolic > 0 || diastolic > 0)
      setBloodPressure(`${systolic}/${diastolic}`);
  }, [systolic, diastolic]);

  const markDirty = () => setDirty(true);

  const handleOpenAddCPPT = () => {
    setNewCppt(createEmptyDuplicateCPPT(cpptNotes.length + 1));
    setCpptDialogOpen(true);
  };

  const handleSaveAddCPPT = () => {
    setCpptNotes((prev) => [...prev, { ...newCppt, sequence: prev.length + 1 }]);
    setCpptDialogOpen(false);
    markDirty();
  };

  const handleCpptSetCreatedBy = (cpptId: number, name: string) => {
    setCpptNotes((prev) =>
      prev.map((note, idx) => {
        const mappedId = note.id ?? -(idx + 1);
        return mappedId === cpptId ? { ...note, created_by_name: name } : note;
      }),
    );
    markDirty();
  };

  const handleCpptSetApprovedBy = (cpptId: number, name: string) => {
    setCpptNotes((prev) =>
      prev.map((note, idx) => {
        const mappedId = note.id ?? -(idx + 1);
        return mappedId === cpptId ? { ...note, approved_by_name: name } : note;
      }),
    );
    markDirty();
  };

  const handleFluidBalanceSetCreatedBy = (id: number, name: string) => {
    setFluidBalances((prev) =>
      prev.map((item, idx) => {
        const mappedId = item.id ?? -(idx + 1);
        return mappedId === id ? { ...item, created_by_name: name } : item;
      }),
    );
    markDirty();
  };

  const handleFluidBalanceSetApprovedBy = (id: number, name: string) => {
    setFluidBalances((prev) =>
      prev.map((item, idx) => {
        const mappedId = item.id ?? -(idx + 1);
        return mappedId === id ? { ...item, approved_by_name: name } : item;
      }),
    );
    markDirty();
  };

  const handleNursingCareSetCreatedBy = (id: number, name: string) => {
    setNursingCares((prev) =>
      prev.map((item, idx) => {
        const mappedId = item.id ?? -(idx + 1);
        return mappedId === id ? { ...item, created_by_name: name } : item;
      }),
    );
    markDirty();
  };

  const handleNursingCareSetApprovedBy = (id: number, name: string) => {
    setNursingCares((prev) =>
      prev.map((item, idx) => {
        const mappedId = item.id ?? -(idx + 1);
        return mappedId === id ? { ...item, approved_by_name: name } : item;
      }),
    );
    markDirty();
  };

  const handleOpenAddFluidBalance = () => {
    setNewFluidBalance(createEmptyDuplicateFluidBalance(fluidBalances.length + 1));
    setFluidBalanceDialogOpen(true);
  };

  const handleSaveAddFluidBalance = () => {
    const totalIntake =
      (newFluidBalance.oral_drink || 0) +
      (newFluidBalance.oral_food || 0) +
      (newFluidBalance.oral_medicine || 0) +
      (newFluidBalance.iv_fluid || 0) +
      (newFluidBalance.iv_medicine || 0) +
      (newFluidBalance.blood_product || 0) +
      (newFluidBalance.enteral_feed || 0) +
      (newFluidBalance.other_intake || 0);
    const totalOutput =
      (newFluidBalance.urine_amount || 0) +
      (newFluidBalance.feces_amount || 0) +
      (newFluidBalance.vomit_amount || 0) +
      (newFluidBalance.drain_amount || 0) +
      (newFluidBalance.blood_loss || 0) +
      (newFluidBalance.iwl || 0) +
      (newFluidBalance.other_output || 0);
    setFluidBalances((prev) => [
      ...prev,
      {
        ...newFluidBalance,
        total_intake: totalIntake,
        total_output: totalOutput,
        balance: totalIntake - totalOutput,
        sequence: prev.length + 1,
      },
    ]);
    setFluidBalanceDialogOpen(false);
    markDirty();
  };

  const handleOpenAddNursingCare = () => {
    setNewNursingCare(createEmptyDuplicateNursingCare(nursingCares.length + 1));
    setDuplicateNursingMasterCode("");
    setNursingCareDialogOpen(true);
  };

  const handleSaveAddNursingCare = () => {
    setNursingCares((prev) => [
      ...prev,
      { ...newNursingCare, sequence: prev.length + 1 },
    ]);
    setNursingCareDialogOpen(false);
    markDirty();
  };

  const handleDuplicateApplyMasterSdki = (selectedCode: string) => {
    const selectedItem = parsedDuplicateNursingMasterItems.find(
      (item) => normalizeDuplicateSdkiCode(item.sdki.code) === normalizeDuplicateSdkiCode(selectedCode),
    );
    if (!selectedItem) return;
    setDuplicateNursingMasterCode(selectedCode);
    const mayorSubjektif = selectedItem.sdki.gejala_tanda?.mayor?.subjektif ?? [];
    const mayorObjektif = selectedItem.sdki.gejala_tanda?.mayor?.objektif ?? [];
    const minorSubjektif = selectedItem.sdki.gejala_tanda?.minor?.subjektif ?? [];
    const minorObjektif = selectedItem.sdki.gejala_tanda?.minor?.objektif ?? [];
    const signsSymptomsText = [
      buildDuplicateMultilineText("Mayor Subjektif", mayorSubjektif),
      buildDuplicateMultilineText("Mayor Objektif", mayorObjektif),
      buildDuplicateMultilineText("Minor Subjektif", minorSubjektif),
      buildDuplicateMultilineText("Minor Objektif", minorObjektif),
    ].filter(Boolean).join("\n\n");
    const etiologyText = [
      buildDuplicateMultilineText("Fisiologis", selectedItem.sdki.fisiologis ?? []),
      buildDuplicateMultilineText("Situasional", selectedItem.sdki.situasional ?? []),
    ].filter(Boolean).join("\n\n");
    const outcomeText = [
      buildDuplicateMultilineText("Luaran Utama", selectedItem.slki?.luaran_utama ?? []),
      buildDuplicateMultilineText("Luaran Tambahan", selectedItem.slki?.luaran_tambahan ?? []),
    ].filter(Boolean).join("\n\n");
    const interventionText = [
      buildDuplicateMultilineText("Intervensi Utama", selectedItem.siki?.intervensi_utama ?? []),
      buildDuplicateMultilineText("Intervensi Pendukung", selectedItem.siki?.intervensi_pendukung ?? []),
    ].filter(Boolean).join("\n\n");
    setNewNursingCare((prev) => ({
      ...prev,
      nursing_diagnosis_code: selectedItem.sdki.code,
      nursing_diagnosis: selectedItem.sdki.label,
      problem_etiology: etiologyText || prev.problem_etiology,
      signs_symptoms: signsSymptomsText || prev.signs_symptoms,
      nursing_outcome: outcomeText || prev.nursing_outcome,
      nursing_intervention: interventionText || prev.nursing_intervention,
    }));
  };

  // ══════════════════════════════════════════════
  // Section completion checks
  // ══════════════════════════════════════════════
  const sectionStatus = (
    id: SectionId,
  ): { filled: boolean; count?: number } => {
    switch (id) {
      case "anamnesis":
        return { filled: !!(chiefComplaint || historyOfPresentIllness) };
      case "physical-exam":
        return { filled: !!(systolic || heartRate || temperature) };
      case "diagnoses":
        return { filled: diagnoses.length > 0, count: diagnoses.length };
      case "procedures":
        return { filled: procedures.length > 0, count: procedures.length };
      case "lab-orders":
        return {
          filled: ordersByType("laboratory").length > 0,
          count: ordersByType("laboratory").length,
        };
      case "radiology-orders":
        return {
          filled: ordersByType("radiology").length > 0,
          count: ordersByType("radiology").length,
        };
      case "surgery-orders":
        return {
          filled: ordersByType("surgery").length > 0,
          count: ordersByType("surgery").length,
        };
      case "consultation-orders":
        return {
          filled: ordersByType("consultation").length > 0,
          count: ordersByType("consultation").length,
        };
      case "medicines":
        return {
          filled: pharmacyOrders.length > 0 || medicineItems.length > 0,
          count: pharmacyOrders.length,
        };
      case "assessment":
        return {
          filled: !!(
            clinicalAssessment ||
            treatmentPlan ||
            dietPlan ||
            activityPlan ||
            educationPlan ||
            monitoringPlan ||
            procedurePlan ||
            consultationPlan
          ),
        };
      case "disposition":
        return { filled: !!(dispositionType || rmDischargeStatus) };
      case "cppt":
        return { filled: cpptNotes.length > 0, count: cpptNotes.length };
      case "fluid-balance":
        return {
          filled: fluidBalances.length > 0,
          count: fluidBalances.length,
        };
      case "nursing-care":
        return { filled: nursingCares.length > 0, count: nursingCares.length };
      case "billing":
        return {
          filled: !!(
            rmDuplicate?.billing && rmDuplicate.billing.total_amount > 0
          ),
          count: rmDuplicate?.billing?.items?.length,
        };
      case "visit-data":
        return {
          filled: !!(admissionDate || dischargeDate),
        };
      case "triage":
        return { filled: !!(triageComplaint || triageBloodPressure || triageHeartRate) };
      default:
        return { filled: false };
    }
  };

  // ══════════════════════════════════════════════
  // CRUD helpers
  // ══════════════════════════════════════════════
  const addProcedure = () => {
    setProcedures([
      ...procedures,
      {
        icd9_code: "",
        name: "",
        multiplicity: 1,
        setting: "",
        sequence: procedures.length + 1,
      },
    ]);
    markDirty();
  };
  const removeProcedure = (i: number) => {
    setProcedures(procedures.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateProcedure = (i: number, updates: Partial<EKlaimRMProcedure>) => {
    setProcedures((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...updates } : p)),
    );
    markDirty();
  };

  const ordersByType = (type: string) =>
    orders.filter((o) => o.order_type === type);
  const labOrdersCount = ordersByType("laboratory").length;
  const radiologyOrdersCount = ordersByType("radiology").length;
  const surgeryOrders = ordersByType("surgery");
  const pharmacyOrders = ordersByType("pharmacy");

  const getTypeIndexByGlobalIndex = (
    list: EKlaimRMOrder[],
    orderType: EKlaimRMOrder["order_type"],
    globalIdx: number,
  ) => {
    let typeIdx = -1;
    for (let i = 0; i <= globalIdx && i < list.length; i += 1) {
      if (list[i].order_type === orderType) typeIdx += 1;
    }
    return Math.max(typeIdx, 0);
  };

  const getRuntimeOrderId = (order: EKlaimRMOrder, typeIdx: number) =>
    order.id ?? -(typeIdx + 1);

  const getRuntimeItemId = (runtimeOrderId: number, item: EKlaimRMOrderItem, itemIdx: number) =>
    item.id ?? -(Math.abs(runtimeOrderId) * 1000 + itemIdx + 1);

  const findGlobalOrderIndexByRuntimeId = (
    list: EKlaimRMOrder[],
    orderType: EKlaimRMOrder["order_type"],
    runtimeOrderId: number,
  ) => {
    let typeIdx = 0;
    for (let i = 0; i < list.length; i += 1) {
      const order = list[i];
      if (order.order_type !== orderType) continue;
      const currentRuntimeId = getRuntimeOrderId(order, typeIdx);
      if (currentRuntimeId === runtimeOrderId) return i;
      typeIdx += 1;
    }
    return -1;
  };

  const mapDuplicateOrderToProcedureOrder = (
    order: EKlaimRMOrder,
    runtimeOrderId: number,
    typeIdx: number,
  ): ProcedureOrder => {
    const registrationPatient = visit?.registration?.patient;
    const mappedItems: ProcedureOrderItem[] = (order.items || []).map((item, itemIdx) => {
      const runtimeItemId = getRuntimeItemId(runtimeOrderId, item, itemIdx);
      const parameterFromProcedure = item.procedure?.parameters || [];
      const parameterFromResults = (item.results || [])
        .filter((r) => Boolean(r.procedure_parameter))
        .map((r) => r.procedure_parameter!)
        .filter(
          (param, idx, arr) =>
            arr.findIndex((p) => p.id === param.id) === idx,
        );
      const resolvedParameters =
        parameterFromProcedure.length > 0
          ? parameterFromProcedure
          : parameterFromResults;

      return {
        id: runtimeItemId,
        procedure_order_id: runtimeOrderId,
        procedure_id: item.procedure_id,
        procedure: item.procedure
          ? {
              id: item.procedure.id,
              code: item.procedure.code || "",
              name: item.procedure.name,
              procedure_type:
                order.order_type === "laboratory"
                  ? "laboratory"
                  : order.order_type === "radiology"
                    ? "radiology"
                    : "medical",
              is_active: true,
              parameters: resolvedParameters.map((p) => ({
                id: p.id,
                procedure_id: item.procedure_id,
                code: p.code || "",
                name: p.name,
                input_type: p.input_type || "text",
                options: p.options,
                unit: p.unit,
                normal_min: p.normal_min,
                normal_max: p.normal_max,
                normal_text: p.normal_text,
                critical_min: p.critical_min,
                critical_max: p.critical_max,
                decimal_places: p.decimal_places,
                is_required: Boolean(p.is_required),
                sort_order: p.sort_order || 0,
                is_active: true,
              })),
            }
          : undefined,
        status: "in_progress",
        notes: item.notes,
        results: (item.results || []).map((r) => ({
          id: r.id,
          procedure_order_item_id: runtimeItemId,
          procedure_parameter_id: r.procedure_parameter_id,
          procedure_parameter: r.procedure_parameter
            ? {
                id: r.procedure_parameter.id,
                procedure_id: item.procedure_id,
                code: r.procedure_parameter.code || "",
                name: r.procedure_parameter.name,
                input_type: r.procedure_parameter.input_type || "text",
                options: r.procedure_parameter.options,
                unit: r.procedure_parameter.unit,
                normal_min: r.procedure_parameter.normal_min,
                normal_max: r.procedure_parameter.normal_max,
                normal_text: r.procedure_parameter.normal_text,
                critical_min: r.procedure_parameter.critical_min,
                critical_max: r.procedure_parameter.critical_max,
                decimal_places: r.procedure_parameter.decimal_places,
                is_required: Boolean(r.procedure_parameter.is_required),
                sort_order: r.procedure_parameter.sort_order || 0,
                is_active: true,
              }
            : undefined,
          value: r.value || "",
          numeric_value: r.numeric_value,
          is_normal: r.is_normal,
          is_low: r.is_low,
          is_high: r.is_high,
          is_critical: r.is_critical,
          notes: r.notes,
        })),
      };
    });

    const mappedOrderType: ProcedureOrder["order_type"] =
      order.order_type === "laboratory" ||
      order.order_type === "radiology" ||
      order.order_type === "consultation" ||
      order.order_type === "surgery"
        ? order.order_type
        : "consultation";

    const orderDateTime = order.fake_date
      ? (() => {
          const normalized = order.fake_date.replace(" ", "T");
          return normalized.length === 16 ? `${normalized}:00` : normalized;
        })()
      : new Date().toISOString();

    return {
      id: runtimeOrderId,
      order_number: order.order_number || `${order.order_type === "laboratory" ? "LAB" : order.order_type === "radiology" ? "RAD" : order.order_type === "surgery" ? "OPR" : "KON"}${fmtDateCode(order.fake_date)}${typeIdx + 1}`,
      order_type: mappedOrderType,
      source_visit_id: activeVisitId,
      source_room_id: 0,
      target_room_id: 0,
      registration_id: 0,
      ordered_by_id: 0,
      ordered_by: (order.order_type === "surgery" ? order.surgeon_name : order.consultant_name)
        ? {
            id: 0,
            nama_lengkap:
              order.order_type === "surgery"
                ? order.surgeon_name
                : order.consultant_name,
          }
        : undefined,
      priority: order.priority || "normal",
      clinical_notes: order.clinical_notes,
      diagnosis: order.diagnosis,
      notes: order.notes,
      status: "in_progress",
      result_summary: order.result_summary,
      conclusion: order.conclusion,
      suggestion: order.suggestion,
      is_critical: order.is_critical,
      critical_notes: order.critical_notes,
      items: mappedItems,
      created_at: orderDateTime,
      updated_at: orderDateTime,
      registration: registrationPatient
        ? {
            patient: {
              id: registrationPatient.id,
              no_rm: registrationPatient.no_rm || "",
              nama_lengkap: registrationPatient.nama_lengkap || "",
              jenis_kelamin: registrationPatient.jenis_kelamin,
              tanggal_lahir: registrationPatient.tanggal_lahir,
            },
          }
        : undefined,
    };
  };

  const createDuplicateProcedureAdapter = useCallback(
    (orderType: EKlaimRMOrder["order_type"]) => ({
      getAll: async () => {
        const typeOrders = orders.filter((o) => o.order_type === orderType);
        const mapped = typeOrders.map((order, typeIdx) =>
          mapDuplicateOrderToProcedureOrder(
            order,
            getRuntimeOrderId(order, typeIdx),
            typeIdx,
          ),
        );
        return { data: mapped };
      },
      start: async (runtimeOrderId: number) => {
        const list = orders;
        const globalIdx = findGlobalOrderIndexByRuntimeId(list, orderType, runtimeOrderId);
        if (globalIdx < 0) return { data: null };
        const typeIdx = getTypeIndexByGlobalIndex(list, orderType, globalIdx);
        return {
          data: mapDuplicateOrderToProcedureOrder(
            list[globalIdx],
            runtimeOrderId,
            typeIdx,
          ),
        };
      },
      saveResults: async (runtimeOrderId: number, payload: SubmitResultsInput) => {
        let updatedOrder: EKlaimRMOrder | null = null;
        let updatedTypeIdx = 0;
        setOrders((prev) => {
          const globalIdx = findGlobalOrderIndexByRuntimeId(
            prev,
            orderType,
            runtimeOrderId,
          );
          if (globalIdx < 0) return prev;

          updatedTypeIdx = getTypeIndexByGlobalIndex(prev, orderType, globalIdx);
          const next = [...prev];
          const current = next[globalIdx];
          const nextItems = (current.items || []).map((item, itemIdx) => {
            const runtimeItemId = getRuntimeItemId(runtimeOrderId, item, itemIdx);
            const itemPayload = payload.items.find((pi) => pi.item_id === runtimeItemId);
            if (!itemPayload) return item;
            const nextResults = (item.results || []).map((result) => {
              const resultPayload = itemPayload.results.find(
                (r) => r.parameter_id === result.procedure_parameter_id,
              );
              if (!resultPayload) return result;
              const numericFromValue = Number(resultPayload.value);
              return {
                ...result,
                value: resultPayload.value,
                numeric_value:
                  resultPayload.numeric_value ??
                  (Number.isNaN(numericFromValue) ? result.numeric_value : numericFromValue),
                notes: resultPayload.notes ?? result.notes,
              };
            });
            return {
              ...item,
              notes: itemPayload.notes ?? item.notes,
              results: nextResults,
            };
          });

          updatedOrder = {
            ...current,
            result_summary: payload.result_summary ?? current.result_summary,
            conclusion: payload.conclusion ?? current.conclusion,
            suggestion: payload.suggestion ?? current.suggestion,
            is_critical: payload.is_critical ?? current.is_critical,
            critical_notes: payload.critical_notes ?? current.critical_notes,
            items: nextItems,
          };
          next[globalIdx] = updatedOrder;
          return next;
        });
        markDirty();

        if (!updatedOrder) {
          return { data: null };
        }
        return {
          data: mapDuplicateOrderToProcedureOrder(
            updatedOrder,
            runtimeOrderId,
            updatedTypeIdx,
          ),
        };
      },
      complete: async (runtimeOrderId: number) => {
        const list = orders;
        const globalIdx = findGlobalOrderIndexByRuntimeId(list, orderType, runtimeOrderId);
        if (globalIdx < 0) return { data: null };
        const typeIdx = getTypeIndexByGlobalIndex(list, orderType, globalIdx);
        return {
          data: mapDuplicateOrderToProcedureOrder(
            list[globalIdx],
            runtimeOrderId,
            typeIdx,
          ),
        };
      },
    }),
    [orders, activeVisitId, visit],
  );

  const labWorkstationAdapter = createDuplicateProcedureAdapter("laboratory");
  const radiologyWorkstationAdapter = createDuplicateProcedureAdapter("radiology");
  const surgeryWorkstationAdapter = createDuplicateProcedureAdapter("surgery");
  const consultationWorkstationAdapter = createDuplicateProcedureAdapter("consultation");

  const getRuntimeMedicineItemId = (
    runtimeOrderId: number,
    item: EKlaimRMMedicineItem,
    itemIdx: number,
  ) => item.id ?? -(Math.abs(runtimeOrderId) * 1000 + itemIdx + 1);

  const mapDuplicatePharmacyOrderToMedicineOrder = (
    order: EKlaimRMOrder,
    runtimeOrderId: number,
    typeIdx: number,
  ): MedicineOrder => {
    const registrationPatient = visit?.registration?.patient;
    const linkedItems = medicineItems.filter((item) => {
      if (order.fake_date) {
        return item.fake_date === order.fake_date;
      }
      return pharmacyOrders.length === 1 ? !item.fake_date : false;
    });

    const orderDateTime = order.fake_date
      ? (() => {
          const normalized = order.fake_date.replace(" ", "T");
          return normalized.length === 16 ? `${normalized}:00` : normalized;
        })()
      : "";

    const mappedItems: MedicineOrderItem[] = linkedItems.map((item, itemIdx) => ({
      id: getRuntimeMedicineItemId(runtimeOrderId, item, itemIdx),
      medicine_order_id: runtimeOrderId,
      medicine_id: item.medicine_id || 0,
      medicine: item.medicine
        ? {
            id: item.medicine.id,
            name: item.medicine.name,
            generic_name: item.medicine_name || item.medicine.name,
            code: item.medicine.code,
            unit: item.medicine.unit,
            category: "generic",
            selling_price: Number(item.medicine.selling_price ?? item.unit_price ?? 0),
            unit_price: Number(item.unit_price ?? item.medicine.selling_price ?? 0),
          }
        : item.medicine_id
          ? {
              id: item.medicine_id,
              name: item.medicine_name,
              generic_name: item.medicine_name,
              code: "",
              unit: item.unit,
              category: "generic",
              selling_price: Number(item.unit_price || 0),
              unit_price: Number(item.unit_price || 0),
            }
          : undefined,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "",
      dosage: item.dosage || "",
      frequency: item.frequency || "",
      route: item.route || "oral",
      duration: item.duration || "",
      instructions: item.instructions || "",
      status: "ordered",
      dispensed_qty: 0,
      returned_qty: 0,
      return_notes: "",
      is_substituted: false,
      substituted_medicine: "",
      substitution_reason: "",
      unit_price: Number(item.unit_price || item.medicine?.selling_price || 0),
      price: Number(item.unit_price || item.medicine?.selling_price || 0),
      sub_total:
        Number(item.sub_total)
        || (Number(item.quantity) || 0) * Number(item.unit_price || item.medicine?.selling_price || 0),
      notes: item.notes || "",
      added_by_pharmacy: false,
      medicine_batch_id: undefined,
      medicine_batch: undefined,
      dispensed_at: undefined,
      returned_at: undefined,
    }));

    return {
      id: runtimeOrderId,
      created_at: orderDateTime,
      updated_at: orderDateTime,
      order_number: order.order_number || `RX${fmtDateCode(order.fake_date)}${typeIdx + 1}`,
      source_visit_id: activeVisitId,
      source_visit: {
        id: activeVisitId,
        visit_number: visit?.visit_number || "",
        registration: registrationPatient
          ? {
              id: visit?.registration?.id || 0,
              registration_number: visit?.registration?.registration_number || "",
              patient: {
                id: registrationPatient.id,
                nama_lengkap: registrationPatient.nama_lengkap || "",
                no_rm: registrationPatient.no_rm || "",
              },
            }
          : undefined,
      },
      pharmacy_visit_id: visit?.id,
      source_room_id: visit?.room_id || 0,
      pharmacy_room_id: 0,
      registration_id: visit?.registration?.id || 0,
      registration: registrationPatient
        ? {
            id: visit?.registration?.id || 0,
            registration_number: visit?.registration?.registration_number || "",
            patient: {
              id: registrationPatient.id,
              nama_lengkap: registrationPatient.nama_lengkap || "",
              no_rm: registrationPatient.no_rm || "",
            },
          }
        : undefined,
      prescriber_id: 0,
      prescriber: order.consultant_name
        ? {
            id: 0,
            nama_lengkap: order.consultant_name,
            tipe_karyawan: "dokter",
          }
        : undefined,
      prescription_type: "non_racikan",
      priority: order.priority || "normal",
      diagnosis: order.diagnosis || "",
      notes: order.notes || "",
      status: "pending",
      review_notes: "",
      items: mappedItems,
    };
  };

  const createDuplicatePharmacyAdapter = useCallback(() => ({
    getAll: async () => {
      const pharmacyOnly = orders.filter((order) => order.order_type === "pharmacy");
      return {
        data: pharmacyOnly.map((order, typeIdx) =>
          mapDuplicatePharmacyOrderToMedicineOrder(
            order,
            getRuntimeOrderId(order, typeIdx),
            typeIdx,
          ),
        ),
      };
    },
    create: async () => {
      const existingCount = orders.filter((order) => order.order_type === "pharmacy").length;
      const fakeDate = new Date().toISOString().slice(0, 19);
      const newOrder: EKlaimRMOrder = {
        ...createEmptyOrder("pharmacy", true, orders.length + 1),
        order_number: `RX${fmtDateCode(fakeDate)}${existingCount + 1}`,
        fake_date: fakeDate,
      };
      setOrders((prev) => [...prev, newOrder]);
      markDirty();
      return {
        data: mapDuplicatePharmacyOrderToMedicineOrder(
          newOrder,
          getRuntimeOrderId(newOrder, existingCount),
          existingCount,
        ),
      };
    },
    addItem: async (runtimeOrderId: number, data: {
      medicine_id: number;
      quantity: number;
      unit?: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      duration?: string;
      instructions?: string;
      notes?: string;
    }) => {
      const globalIdx = findGlobalOrderIndexByRuntimeId(orders, "pharmacy", runtimeOrderId);
      if (globalIdx < 0) throw new Error("Order resep tidak ditemukan");
      const targetOrder = orders[globalIdx];
      const medicineRes = await medicinesApi.getById(data.medicine_id);
      const medicine = medicineRes.data?.data || medicineRes.data;
      const linkedItems = medicineItems.filter((item) => item.fake_date === targetOrder.fake_date);
      const newItem: EKlaimRMMedicineItem = {
        medicine_id: medicine.id,
        medicine: {
          id: medicine.id,
          code: medicine.code || "",
          name: medicine.name,
          unit: medicine.unit || data.unit || "",
          selling_price: medicine.selling_price || 0,
        },
        medicine_name: medicine.name,
        dosage: data.dosage || medicine.strength || medicine.dosage || "",
        frequency: data.frequency || "",
        route: data.route || "oral",
        quantity: Number(data.quantity) || 1,
        unit: data.unit || medicine.unit || "",
        duration: data.duration || "",
        instructions: data.instructions || "",
        unit_price: medicine.selling_price || 0,
        sub_total: (Number(data.quantity) || 1) * (medicine.selling_price || 0),
        is_fake: true,
        fake_date: targetOrder.fake_date,
        notes: data.notes || "",
        sequence: linkedItems.length + 1,
      };

      setMedicineItems((prev) => [
        ...prev,
        newItem,
      ]);
      markDirty();
      return {
        data: {
          id: getRuntimeMedicineItemId(runtimeOrderId, newItem, linkedItems.length),
          medicine_order_id: runtimeOrderId,
          medicine_id: newItem.medicine_id || 0,
          medicine: {
            id: newItem.medicine?.id || newItem.medicine_id || 0,
            name: newItem.medicine?.name || newItem.medicine_name,
            generic_name: newItem.medicine_name,
            code: newItem.medicine?.code || "",
            unit: newItem.medicine?.unit || newItem.unit,
            category: "generic",
            selling_price: Number(newItem.medicine?.selling_price ?? newItem.unit_price ?? 0),
            unit_price: Number(newItem.unit_price || 0),
          },
          quantity: Number(newItem.quantity) || 0,
          unit: newItem.unit || "",
          dosage: newItem.dosage || "",
          frequency: newItem.frequency || "",
          route: newItem.route || "oral",
          duration: newItem.duration || "",
          instructions: newItem.instructions || "",
          status: "ordered",
          dispensed_qty: 0,
          returned_qty: 0,
          return_notes: "",
          is_substituted: false,
          substituted_medicine: "",
          substitution_reason: "",
          unit_price: Number(newItem.unit_price || 0),
          price: Number(newItem.unit_price || 0),
          sub_total: Number(newItem.sub_total || 0),
          notes: newItem.notes || "",
          added_by_pharmacy: false,
        } as MedicineOrderItem,
      };
    },
    updateItem: async (runtimeOrderId: number, itemId: number, data: {
      quantity?: number;
      unit?: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      duration?: string;
      instructions?: string;
      notes?: string;
    }) => {
      let updatedItemResult: MedicineOrderItem | null = null;
      setMedicineItems((prev) =>
        prev.map((item) => {
          const globalIdx = findGlobalOrderIndexByRuntimeId(orders, "pharmacy", runtimeOrderId);
          if (globalIdx < 0) return item;
          const order = orders[globalIdx];
          const linkedItems = prev.filter((candidate) => candidate.fake_date === order.fake_date);
          const candidateIdx = linkedItems.findIndex((candidate, idx) => {
            const runtimeItemId = getRuntimeMedicineItemId(runtimeOrderId, candidate, idx);
            return runtimeItemId === itemId;
          });
          if (candidateIdx < 0 || item.fake_date !== order.fake_date) return item;
          const updated = { ...item, ...data };
          const quantity = Number(updated.quantity) || 0;
          const unitPrice = Number(updated.unit_price) || 0;
          updated.sub_total = quantity * unitPrice;
          updatedItemResult = {
            id: getRuntimeMedicineItemId(runtimeOrderId, updated, candidateIdx),
            medicine_order_id: runtimeOrderId,
            medicine_id: updated.medicine_id || 0,
            medicine: updated.medicine
              ? {
                  id: updated.medicine.id,
                  name: updated.medicine.name,
                  generic_name: updated.medicine_name || updated.medicine.name,
                  code: updated.medicine.code,
                  unit: updated.medicine.unit,
                  category: "generic",
                  selling_price: Number(updated.medicine.selling_price ?? updated.unit_price ?? 0),
                  unit_price: Number(updated.unit_price || 0),
                }
              : undefined,
            quantity,
            unit: updated.unit || "",
            dosage: updated.dosage || "",
            frequency: updated.frequency || "",
            route: updated.route || "oral",
            duration: updated.duration || "",
            instructions: updated.instructions || "",
            status: "ordered",
            dispensed_qty: 0,
            returned_qty: 0,
            return_notes: "",
            is_substituted: false,
            substituted_medicine: "",
            substitution_reason: "",
            unit_price: unitPrice,
            price: unitPrice,
            sub_total: Number(updated.sub_total || 0),
            notes: updated.notes || "",
            added_by_pharmacy: false,
          } as MedicineOrderItem;
          return updated;
        }),
      );
      markDirty();
      if (!updatedItemResult) {
        throw new Error("Item obat tidak ditemukan");
      }
      return { data: updatedItemResult };
    },
    deleteItem: async (runtimeOrderId: number, itemId: number) => {
      setMedicineItems((prev) => {
        const globalIdx = findGlobalOrderIndexByRuntimeId(orders, "pharmacy", runtimeOrderId);
        if (globalIdx < 0) return prev;
        const order = orders[globalIdx];
        let linkedIdx = 0;
        return prev.filter((item) => {
          if (item.fake_date !== order.fake_date) return true;
          const runtimeItemId = getRuntimeMedicineItemId(runtimeOrderId, item, linkedIdx);
          linkedIdx += 1;
          return runtimeItemId !== itemId;
        });
      });
      markDirty();
      return { data: { message: "deleted" } };
    },
    cancel: async (runtimeOrderId: number) => {
      const globalIdx = findGlobalOrderIndexByRuntimeId(orders, "pharmacy", runtimeOrderId);
      if (globalIdx < 0) return { data: { message: "not-found" } };
      const targetOrder = orders[globalIdx];
      setOrders((prev) => prev.filter((_, idx) => idx !== globalIdx));
      setMedicineItems((prev) => prev.filter((item) => item.fake_date !== targetOrder.fake_date));
      markDirty();
      return { data: { message: "deleted" } };
    },
  }), [orders, medicineItems, visit, activeVisitId]);

  const pharmacyPrescriptionAdapter = createDuplicatePharmacyAdapter();

  const updateDuplicateOrderMetaByRuntimeId = (
    orderType: EKlaimRMOrder["order_type"],
    runtimeOrderId: number,
    updates: { fake_date?: string; doctor_name?: string },
  ) => {
    setOrders((prev) => {
      const globalIdx = findGlobalOrderIndexByRuntimeId(prev, orderType, runtimeOrderId);
      if (globalIdx < 0) return prev;
      const next = [...prev];
      const current = next[globalIdx];
      next[globalIdx] = {
        ...current,
        fake_date:
          updates.fake_date !== undefined ? updates.fake_date : current.fake_date,
        consultant_name:
          orderType !== "surgery" && updates.doctor_name !== undefined
            ? updates.doctor_name
            : current.consultant_name,
        surgeon_name:
          orderType === "surgery" && updates.doctor_name !== undefined
            ? updates.doctor_name
            : current.surgeon_name,
      };
      return next;
    });
    markDirty();
  };

  const createEmptyOrder = (
    orderType: EKlaimRMOrder["order_type"],
    isFake = false,
    sequenceBase = orders.length + 1,
  ): EKlaimRMOrder => ({
    order_type: orderType,
    order_number: "",
    priority: "normal",
    clinical_notes: "",
    diagnosis: "",
    notes: "",
    result_summary: "",
    conclusion: "",
    suggestion: "",
    is_critical: false,
    critical_notes: "",
    consultant_name: "",
    specialty: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    recommendation: "",
    consultation_fee: 0,
    surgeon_name: "",
    anesthesia_type: "",
    is_fake: isFake,
    fake_date: isFake ? new Date().toISOString().slice(0, 19) : undefined,
    items: [],
    sequence: sequenceBase,
  });

  // Reserved for future use
  // @ts-expect-error - Reserved for future feature
  const _updateOrderItem = (
    orderGlobalIdx: number,
    itemIdx: number,
    updates: Partial<EKlaimRMOrderItem>,
  ) => {
    setOrders((prev) =>
      prev.map((o, oi) =>
        oi === orderGlobalIdx
          ? {
              ...o,
              items: (o.items || []).map((item, ii) =>
                ii === itemIdx ? { ...item, ...updates } : item,
              ),
            }
          : o,
      ),
    );
    markDirty();
  };

  // ── Procedure Search ──
  const orderTypeToProc = (orderType: string): ProcedureType | undefined => {
    if (orderType === "laboratory") return "laboratory";
    if (orderType === "radiology") return "radiology";
    if (orderType === "consultation") return "consultation";
    if (orderType === "surgery") return "medical";
    return undefined;
  };

  const handleProcSearch = (term: string, orderType: string) => {
    setProcSearchTerm(term);
    if (!term || term.length < 2) {
      setProcSearchResults([]);
      return;
    }

    const procedureType = orderTypeToProc(orderType);
    if (!procedureType) {
      setProcSearchResults([]);
      return;
    }

    setSearchingProcs(true);
    proceduresApi
      .getAll({
        search: term,
        procedure_type: procedureType,
        is_active: true,
        is_surgical: orderType === "surgery" ? true : undefined,
      })
      .then((res) => {
        setProcSearchResults(res.data?.data || []);
      })
      .catch(() => {
        setProcSearchResults([]);
      })
      .finally(() => {
        setSearchingProcs(false);
      });
  };

  const handleQuickAddProcedureToType = async (
    orderType: EKlaimRMOrder["order_type"],
    procedure: Procedure,
  ) => {
    setLoadingParams(true);
    try {
      const paramRes = await procedureParametersApi.getAll(procedure.id);
      const params: ProcedureParameter[] = paramRes.data?.data || [];
      const results: EKlaimRMOrderResult[] = params
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((param, idx) => ({
          procedure_parameter_id: param.id,
          procedure_parameter: {
            id: param.id,
            name: param.name,
            code: param.code,
            input_type: param.input_type,
            unit: param.unit,
            options: param.options,
            normal_min: param.normal_min,
            normal_max: param.normal_max,
            normal_text: param.normal_text,
            critical_min: param.critical_min,
            critical_max: param.critical_max,
            decimal_places: param.decimal_places,
            is_required: param.is_required,
            sort_order: param.sort_order,
          },
          parameter_name: param.name,
          value: "",
          numeric_value: 0,
          is_normal: false,
          is_low: false,
          is_high: false,
          is_critical: false,
          notes: "",
          sequence: idx + 1,
        }));

        // Resolve target fake order using session-scoped fake_date key.
        // If quickAddFakeDate is null OR no matching order exists yet → generate new key.
        let resolvedFakeDate = quickAddFakeDate;
        if (
          resolvedFakeDate === null ||
          !orders.some(
            (o) =>
              o.order_type === orderType &&
              o.is_fake &&
              o.fake_date === resolvedFakeDate,
          )
        ) {
          resolvedFakeDate = new Date().toISOString().slice(0, 19);
        }
        const finalFakeDate = resolvedFakeDate;

        setOrders((prev) => {
          const next = [...prev];

          // Find existing fake order for this session (matched by fake_date)
          let globalIdx = -1;
          for (let i = 0; i < next.length; i++) {
            if (
              next[i].order_type === orderType &&
              next[i].is_fake &&
              next[i].fake_date === finalFakeDate
            ) {
              globalIdx = i;
              break;
            }
          }

          if (globalIdx < 0) {
            // Create a brand-new fake order with this session's fake_date key
            const created: EKlaimRMOrder = {
              ...createEmptyOrder(orderType, true, next.length + 1),
              fake_date: finalFakeDate,
            };
            next.push(created);
            globalIdx = next.length - 1;
          }

          const target = next[globalIdx];
          const newItem: EKlaimRMOrderItem = {
            procedure_id: procedure.id,
            procedure_name: procedure.name,
            procedure: {
              id: procedure.id,
              name: procedure.name,
              code: procedure.code,
              parameters: params
                .filter((p) => p.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((param) => ({
                  id: param.id,
                  name: param.name,
                  code: param.code,
                  input_type: param.input_type,
                  unit: param.unit,
                  options: param.options,
                  normal_min: param.normal_min,
                  normal_max: param.normal_max,
                  normal_text: param.normal_text,
                  critical_min: param.critical_min,
                  critical_max: param.critical_max,
                  decimal_places: param.decimal_places,
                  is_required: param.is_required,
                  sort_order: param.sort_order,
                })),
            },
            notes: "",
            results,
            sequence: (target.items || []).length + 1,
          };

          next[globalIdx] = {
            ...target,
            items: [...(target.items || []), newItem],
          };
          return next;
        });

        // Update session state — track which fake order & what's been added
        setQuickAddFakeDate(finalFakeDate);
        setQuickAddAddedNames((prev) => [...prev, procedure.name]);
        markDirty();
        setProcSearchTerm("");
        setProcSearchResults([]);
        // Dialog intentionally stays open so user can add more tindakan
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Gagal menambahkan tindakan ke order RM duplikat.",
        });
      } finally {
        setLoadingParams(false);
      }
    };

  const handleSaveAnamnesisSection = async (data: any) => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicateAnamnesis(eklaimId, {
        anamnesis_source: data.anamnesis_source || "autoanamnesis",
        functional_status: data.functional_status || "",
        chief_complaint: data.chief_complaint || "",
        history_of_present_illness: data.history_of_present_illness || "",
        past_medical_history: data.past_medical_history || "",
        family_history: data.family_history || "",
        social_history: data.social_history || "",
        allergies: data.allergies || "",
        current_medications: data.current_medications || "",
        review_of_systems: data.review_of_systems || "",
      });

      setAnamnesisSource(data.anamnesis_source || "autoanamnesis");
      setFunctionalStatus(data.functional_status || "");
      setChiefComplaint(data.chief_complaint || "");
      setHistoryOfPresentIllness(data.history_of_present_illness || "");
      setPastMedicalHistory(data.past_medical_history || "");
      setFamilyHistory(data.family_history || "");
      setSocialHistory(data.social_history || "");
      setAllergies(data.allergies || "");
      setCurrentMedications(data.current_medications || "");
      setReviewOfSystems(data.review_of_systems || "");
      setDirty(false);

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Anamnesis RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan anamnesis RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePhysicalExamSection = async (data: any) => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        ...buildAllScalarPayload(),
        // Override physical-exam section with new data
        general_condition: data.general_condition || "",
        consciousness: data.consciousness || "",
        blood_pressure: `${Number(data.blood_pressure_systolic) || 0}/${Number(data.blood_pressure_diastolic) || 0}`,
        systolic: Number(data.blood_pressure_systolic) || 0,
        diastolic: Number(data.blood_pressure_diastolic) || 0,
        heart_rate: String(data.heart_rate || ""),
        respiratory_rate: String(data.respiratory_rate || ""),
        temperature: String(data.temperature || ""),
        oxygen_saturation: String(data.oxygen_saturation || ""),
        weight: String(data.weight || ""),
        height: String(data.height || ""),
        bmi: Number(data.bmi) || 0,
        waist: String(data.waist || ""),
        head_circum: String(data.head_circum || ""),
        pain_method: String(data.pain_method || "nrs"),
        pain_scale: Number(data.pain_scale) || 0,
        pain_location: String(data.pain_location || ""),
        head: data.head || "",
        eyes: data.eyes || "",
        ears: data.ears || "",
        nose: data.nose || "",
        throat: data.throat || "",
        neck: data.neck || "",
        chest: data.chest || "",
        heart: data.heart || "",
        lungs: data.lungs || "",
        abdomen: data.abdomen || "",
        extremities: data.extremities || "",
        neurological: data.neurological || "",
        skin: data.skin || "",
        other_findings: data.other_findings || "",
        ecg_performed: !!data.ecg_performed,
        ecg_result: data.ecg_result || "",
        ecg_interpretation: data.ecg_interpretation || "",
        ecg_notes: data.ecg_notes || "",
      });

      setGeneralCondition(data.general_condition || "");
      setConsciousness(data.consciousness || "");
      setSystolic(Number(data.blood_pressure_systolic) || 0);
      setDiastolic(Number(data.blood_pressure_diastolic) || 0);
      setBloodPressure(`${Number(data.blood_pressure_systolic) || 0}/${Number(data.blood_pressure_diastolic) || 0}`);
      setHeartRate(String(data.heart_rate || ""));
      setRespiratoryRate(String(data.respiratory_rate || ""));
      setTemperature(String(data.temperature || ""));
      setOxygenSaturation(String(data.oxygen_saturation || ""));
      setWeight(String(data.weight || ""));
      setHeight(String(data.height || ""));
      setBmi(Number(data.bmi) || 0);
      setWaist(String(data.waist || ""));
      setHeadCircum(String(data.head_circum || ""));
      setPainMethod(String(data.pain_method || "nrs"));
      setPainScale(Number(data.pain_scale) || 0);
      setPainLocation(String(data.pain_location || ""));
      setHead(data.head || "");
      setEyes(data.eyes || "");
      setEars(data.ears || "");
      setNose(data.nose || "");
      setThroat(data.throat || "");
      setNeck(data.neck || "");
      setChest(data.chest || "");
      setHeartExam(data.heart || "");
      setLungs(data.lungs || "");
      setAbdomen(data.abdomen || "");
      setExtremities(data.extremities || "");
      setNeurological(data.neurological || "");
      setSkin(data.skin || "");
      setOtherFindings(data.other_findings || "");
      setEcgPerformed(!!data.ecg_performed);
      setEcgResult(data.ecg_result || "");
      setEcgInterpretation(data.ecg_interpretation || "");
      setEcgNotes(data.ecg_notes || "");

      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pemeriksaan fisik RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan pemeriksaan fisik RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDiagnosisSection = async (data: any) => {
    setSubmitting(true);
    try {
      const diagnosisItems = Array.isArray(data?.items) ? data.items : [];
      const mappedDiagnoses: EKlaimRMDiagnosis[] = diagnosisItems.map(
        (item: any, index: number) => ({
          icd10_code: item.icd10_code || "",
          icd10_name: item.icd10_name || "",
          type:
            item.diagnosis_type === "primary"
              ? "primary"
              : item.diagnosis_type === "secondary"
                ? "secondary"
                : "complication",
          sequence: index + 1,
        }),
      );

      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        ...buildAllScalarPayload(),
        diagnoses: mappedDiagnoses,
      });

      setDiagnoses(mappedDiagnoses);
      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Diagnosa RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan diagnosa RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAssessmentSection = async (data: any) => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        ...buildAllScalarPayload(),
        // Override assessment section with new data
        clinical_assessment: data.clinical_assessment || "",
        prognosis: data.prognosis || "",
        treatment_plan: data.treatment_plan || "",
        medication_plan: data.medication_plan || "",
        diet_plan: data.diet_plan || "",
        activity_plan: data.activity_plan || "",
        education_plan: data.education_plan || "",
        monitoring_plan: data.monitoring_plan || "",
        procedure_plan: data.procedure_plan || "",
        consultation_plan: data.consultation_plan || "",
      });

      setClinicalAssessment(data.clinical_assessment || "");
      setPrognosis(data.prognosis || "");
      setTreatmentPlan(data.treatment_plan || "");
      setMedicationPlan(data.medication_plan || "");
      setDietPlan(data.diet_plan || "");
      setActivityPlan(data.activity_plan || "");
      setEducationPlan(data.education_plan || "");
      setMonitoringPlan(data.monitoring_plan || "");
      setProcedurePlan(data.procedure_plan || "");
      setConsultationPlan(data.consultation_plan || "");

      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Assessment & plan RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description:
          err?.response?.data?.error ||
          "Gagal menyimpan assessment & plan RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDispositionSection = async (data: any) => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        ...buildAllScalarPayload(),
        // Override disposition section with new data
        disposition_type: data.disposition_type || "",
        disposition_note: data.disposition_note || "",
        rm_discharge_status: data.discharge_status || "",
        discharge_condition: data.discharge_condition || "",
        discharge_instruction: data.discharge_instruction || "",
        discharge_medication: data.discharge_medication || "",
        follow_up_instruction: data.follow_up_instruction || "",
        follow_up_date: data.follow_up_date || "",
        referral_facility: data.referral_facility || "",
        referral_reason: data.referral_reason || "",
        referral_diagnosis: data.referral_diagnosis || "",
        referral_therapy: data.referral_therapy || "",
        referral_notes: data.referral_notes || "",
        death_time: data.death_time || "",
        death_cause: data.death_cause || "",
      });

      setDispositionType(data.disposition_type || "");
      setDispositionNote(data.disposition_note || "");
      setRmDischargeStatus(data.discharge_status || "");
      setDischargeCondition(data.discharge_condition || "");
      setDischargeInstruction(data.discharge_instruction || "");
      setDischargeMedication(data.discharge_medication || "");
      setFollowUpInstruction(data.follow_up_instruction || "");
      setFollowUpDate(data.follow_up_date || "");
      setReferralFacility(data.referral_facility || "");
      setReferralReason(data.referral_reason || "");
      setReferralDiagnosis(data.referral_diagnosis || "");
      setReferralTherapy(data.referral_therapy || "");
      setReferralNotes(data.referral_notes || "");
      setDeathTime(data.death_time || "");
      setDeathCause(data.death_cause || "");

      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Disposition RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan disposition RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTriageSection = async (data: any) => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        ...buildAllScalarPayload(),
        // Override triage section with new data
        has_triage: true,
        triage_arrival_mode: data.arrival_mode || "",
        triage_complaint: data.triage_complaint || "",
        triage_level: data.triage_level || "",
        triage_airway: data.airway || "",
        triage_airway_note: data.airway_note || "",
        triage_breathing: data.breathing || "",
        triage_breathing_note: data.breathing_note || "",
        triage_circulation: data.circulation || "",
        triage_circulation_note: data.circulation_note || "",
        triage_blood_pressure: data.blood_pressure || "",
        triage_heart_rate: String(data.heart_rate || ""),
        triage_respiratory_rate: String(data.respiratory_rate || ""),
        triage_temperature: String(data.temperature || ""),
        triage_oxygen_saturation: String(data.oxygen_saturation || ""),
        triage_pain_scale: Number(data.pain_scale) || 0,
        triage_gcs_e: Number(data.gcs_e) || 4,
        triage_gcs_v: Number(data.gcs_v) || 5,
        triage_gcs_m: Number(data.gcs_m) || 6,
        triage_assessment: data.triage_assessment || "",
        triage_immediate_actions: data.immediate_actions || "",
      });

      setTriageArrivalMode(data.arrival_mode || "");
      setTriageComplaint(data.triage_complaint || "");
      setTriageLevel(data.triage_level || "");
      setTriageAirway(data.airway || "");
      setTriageAirwayNote(data.airway_note || "");
      setTriageBreathing(data.breathing || "");
      setTriageBreathingNote(data.breathing_note || "");
      setTriageCirculation(data.circulation || "");
      setTriageCirculationNote(data.circulation_note || "");
      setTriageBloodPressure(data.blood_pressure || "");
      setTriageHeartRate(String(data.heart_rate || ""));
      setTriageRespiratoryRate(String(data.respiratory_rate || ""));
      setTriageTemperature(String(data.temperature || ""));
      setTriageOxygenSat(String(data.oxygen_saturation || ""));
      setTriagePainScale(Number(data.pain_scale) || 0);
      setTriageGCSE(Number(data.gcs_e) || 4);
      setTriageGCSV(Number(data.gcs_v) || 5);
      setTriageGCSM(Number(data.gcs_m) || 6);
      setTriageAssessment(data.triage_assessment || "");
      setTriageImmediateAction(data.immediate_actions || "");

      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Triage RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan triage RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);

  // Calculate tarif mapping from billing items
  const calculateTarifMapping = () => {
    const billing = rmDuplicate?.billing;
    if (!billing || !billing.items || billing.items.length === 0) {
      return null;
    }

    const mapping = {
      prosedurNonBedah: 0,
      prosedurBedah: 0,
      konsultasi: 0,
      tenagaAhli: 0,
      keperawatan: 0,
      penunjang: 0,
      radiologi: 0,
      laboratorium: 0,
      pelayananDarah: 0,
      rehabilitasi: 0,
      kamar: 0,
      rawatIntensif: 0,
      obat: 0,
      obatKronis: 0,
      obatKemoterapi: 0,
      alkes: 0,
      bmhp: 0,
      sewaAlat: 0,
    };

    const details: Array<{
      item: string;
      type: string;
      amount: number;
      mappedTo: string;
    }> = [];

    for (const item of billing.items) {
      let mappedTo = "";
      
      switch (item.item_type) {
        case "procedure": {
          // Map based on description keywords (simplified version of backend logic)
          const descLower = item.description.toLowerCase();
          
          if (descLower.includes("laboratory") || descLower.includes("laboratorium") ||
              descLower.includes("lab -") || descLower.includes("darah") ||
              descLower.includes("hematologi") || descLower.includes("patologi")) {
            mapping.laboratorium += item.subtotal;
            mappedTo = "Laboratorium";
          } else if (descLower.includes("radiology") || descLower.includes("radiologi") ||
                     descLower.includes("rontgen") || descLower.includes("thorax") ||
                     descLower.includes("ct scan") || descLower.includes("mri") ||
                     descLower.includes("usg") || descLower.includes("imaging")) {
            mapping.radiologi += item.subtotal;
            mappedTo = "Radiologi";
          } else if (descLower.includes("consultation") || descLower.includes("konsultasi") ||
                     descLower.includes("visite")) {
            mapping.konsultasi += item.subtotal;
            mappedTo = "Konsultasi";
          } else if (descLower.includes("bedah") || descLower.includes("operasi") ||
                     descLower.includes("surgery")) {
            mapping.prosedurBedah += item.subtotal;
            mappedTo = "Prosedur Bedah";
          } else {
            // Default: Prosedur Non Bedah
            mapping.prosedurNonBedah += item.subtotal;
            mappedTo = "Prosedur Non Bedah";
          }
          break;
        }
        case "medicine":
          mapping.obat += item.subtotal;
          mappedTo = "Obat";
          break;
        case "administration":
          mapping.penunjang += item.subtotal;
          mappedTo = "Penunjang";
          break;
        case "accommodation":
          mapping.kamar += item.subtotal;
          mappedTo = "Kamar / Akomodasi";
          break;
      }

      if (mappedTo) {
        details.push({
          item: item.description,
          type: item.item_type,
          amount: item.subtotal,
          mappedTo,
        });
      }
    }

    const total = Object.values(mapping).reduce((sum, val) => sum + val, 0);

    return { mapping, details, total };
  };

  const handleSyncFromVisit = async () => {
    setSyncing(true);
    try {
      const res = await eklaimLocalApi.syncRMFromVisit(eklaimId);
      if (res.rm_duplicate) populateFromRM(res.rm_duplicate);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data RM berhasil disinkronkan dari kunjungan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal sync dari kunjungan.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromOriginal = async () => {
    setRestoreDialogOpen(true);
  };

  const confirmRestoreFromOriginal = async () => {
    setRestoreDialogOpen(false);
    await handleSyncFromVisit();
  };

  const handleRecalculateBilling = async () => {
    if (!rmDuplicate?.id) return;
    setSyncing(true);
    try {
      const res = await eklaimLocalApi.recalculateRMDuplicateBilling(
        eklaimId,
        rmDuplicate.id,
      );
      if (res.billing) {
        // Update the rmDuplicate in state with new billing data
        const updatedRM = { ...rmDuplicate, billing: res.billing };
        populateFromRM(updatedRM);
      }
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Billing berhasil dihitung ulang.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menghitung billing.",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Appends "Z" to a bare ISO datetime string that lacks timezone info.
  // Needed because internal state stores "2026-03-29T03:10:29" (no tz) for
  // display/grouping, but Go's time.Time JSON parser requires RFC3339.
  const toRFC3339 = (s: string | undefined): string | undefined => {
    if (!s) return s;
    if (/[Z+]/.test(s.slice(10))) return s; // already has tz info
    return s.length === 16 ? s + ":00Z" : s + "Z";
  };

  const normalizeOrdersForSave = (input: EKlaimRMOrder[]): EKlaimRMOrder[] =>
    input.map((order, orderIdx) => ({
      ...order,
      fake_date: toRFC3339(order.fake_date),
      scheduled_date: toRFC3339(order.scheduled_date as string | undefined),
      sequence: orderIdx + 1,
      items: (order.items || []).map((item, itemIdx) => ({
        ...item,
        sequence: itemIdx + 1,
        results: (item.results || []).map((result, resultIdx) => ({
          ...result,
          sequence: resultIdx + 1,
          value: result.value || "",
          numeric_value: Number(result.numeric_value || result.value || 0) || 0,
        })),
      })),
    }));

  const normalizeMedicineItemsForSave = (
    input: EKlaimRMMedicineItem[],
  ): EKlaimRMMedicineItem[] =>
    input.map((item, idx) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return {
        ...item,
        quantity,
        unit_price: unitPrice,
        sub_total: quantity * unitPrice,
        sequence: idx + 1,
        medicine_name: item.medicine_name || item.medicine?.name || "",
        fake_date: toRFC3339(item.fake_date),
      };
    });

  // Returns all current scalar state so that per-section saves don't accidentally zero out
  // unrelated fields when calling the full updateRMDuplicate endpoint.
  const buildAllScalarPayload = () => ({
    anamnesis_source: anamnesisSource,
    functional_status: functionalStatus,
    chief_complaint: chiefComplaint,
    history_of_present_illness: historyOfPresentIllness,
    past_medical_history: pastMedicalHistory,
    family_history: familyHistory,
    social_history: socialHistory,
    allergies,
    current_medications: currentMedications,
    review_of_systems: reviewOfSystems,
    general_condition: generalCondition,
    consciousness,
    blood_pressure: bloodPressure,
    systolic,
    diastolic,
    heart_rate: heartRate,
    respiratory_rate: respiratoryRate,
    temperature,
    oxygen_saturation: oxygenSaturation,
    weight,
    height,
    bmi,
    waist,
    head_circum: headCircum,
    pain_method: painMethod,
    pain_scale: painScale,
    pain_location: painLocation,
    head,
    eyes,
    ears,
    nose,
    throat,
    neck,
    chest,
    heart: heartExam,
    lungs,
    abdomen,
    extremities,
    neurological,
    skin,
    other_findings: otherFindings,
    ecg_performed: ecgPerformed,
    ecg_result: ecgResult,
    ecg_interpretation: ecgInterpretation,
    ecg_notes: ecgNotes,
    clinical_assessment: clinicalAssessment,
    prognosis,
    treatment_plan: treatmentPlan,
    medication_plan: medicationPlan,
    diet_plan: dietPlan,
    activity_plan: activityPlan,
    education_plan: educationPlan,
    monitoring_plan: monitoringPlan,
    procedure_plan: procedurePlan,
    consultation_plan: consultationPlan,
    disposition_type: dispositionType,
    disposition_note: dispositionNote,
    rm_discharge_status: rmDischargeStatus,
    discharge_condition: dischargeCondition,
    discharge_instruction: dischargeInstruction,
    discharge_medication: dischargeMedication,
    follow_up_instruction: followUpInstruction,
    follow_up_date: followUpDate,
    referral_facility: referralFacility,
    referral_reason: referralReason,
    referral_diagnosis: referralDiagnosis,
    referral_therapy: referralTherapy,
    referral_notes: referralNotes,
    death_time: deathTime,
    death_cause: deathCause,
    has_triage: !!rmDuplicate?.has_triage,
    triage_arrival_mode: triageArrivalMode,
    triage_complaint: triageComplaint,
    triage_level: triageLevel,
    triage_airway: triageAirway,
    triage_airway_note: triageAirwayNote,
    triage_breathing: triageBreathing,
    triage_breathing_note: triageBreathingNote,
    triage_circulation: triageCirculation,
    triage_circulation_note: triageCirculationNote,
    triage_blood_pressure: triageBloodPressure,
    triage_heart_rate: triageHeartRate,
    triage_respiratory_rate: triageRespiratoryRate,
    triage_temperature: triageTemperature,
    triage_oxygen_saturation: triageOxygenSat,
    triage_pain_scale: triagePainScale,
    triage_gcs_e: triageGCSE,
    triage_gcs_v: triageGCSV,
    triage_gcs_m: triageGCSM,
    triage_assessment: triageAssessment,
    triage_immediate_actions: triageImmediateAction,
    admission_date: admissionDate,
    discharge_date: dischargeDate,
    length_of_stay: lengthOfStay,
  });

  const handleSaveRMDuplicate = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        anamnesis_source: anamnesisSource,
        functional_status: functionalStatus,
        chief_complaint: chiefComplaint,
        history_of_present_illness: historyOfPresentIllness,
        past_medical_history: pastMedicalHistory,
        family_history: familyHistory,
        social_history: socialHistory,
        allergies,
        current_medications: currentMedications,
        review_of_systems: reviewOfSystems,
        general_condition: generalCondition,
        consciousness,
        blood_pressure: bloodPressure,
        systolic,
        diastolic,
        heart_rate: heartRate,
        respiratory_rate: respiratoryRate,
        temperature,
        oxygen_saturation: oxygenSaturation,
        weight,
        height,
        bmi,
        waist,
        head_circum: headCircum,
        pain_method: painMethod,
        pain_scale: painScale,
        pain_location: painLocation,
        head,
        eyes,
        ears,
        nose,
        throat,
        neck,
        chest,
        heart: heartExam,
        lungs,
        musculoskel: "",
        genitourinary: "",
        other_findings: otherFindings,
        ecg_performed: ecgPerformed,
        ecg_result: ecgResult,
        ecg_interpretation: ecgInterpretation,
        ecg_notes: ecgNotes,
        clinical_assessment: clinicalAssessment,
        prognosis,
        treatment_plan: treatmentPlan,
        medication_plan: medicationPlan,
        diet_plan: dietPlan,
        activity_plan: activityPlan,
        education_plan: educationPlan,
        monitoring_plan: monitoringPlan,
        procedure_plan: procedurePlan,
        consultation_plan: consultationPlan,
        disposition_type: dispositionType,
        disposition_note: dispositionNote,
        rm_discharge_status: rmDischargeStatus,
        discharge_condition: dischargeCondition,
        discharge_instruction: dischargeInstruction,
        discharge_medication: dischargeMedication,
        follow_up_instruction: followUpInstruction,
        follow_up_date: followUpDate,
        referral_facility: referralFacility,
        referral_reason: referralReason,
        referral_diagnosis: referralDiagnosis,
        referral_therapy: referralTherapy,
        referral_notes: referralNotes,
        death_time: deathTime,
        death_cause: deathCause,
        has_triage: !!rmDuplicate?.has_triage,
        triage_arrival_mode: triageArrivalMode,
        triage_complaint: triageComplaint,
        triage_level: triageLevel,
        triage_airway: triageAirway,
        triage_airway_note: triageAirwayNote,
        triage_breathing: triageBreathing,
        triage_breathing_note: triageBreathingNote,
        triage_circulation: triageCirculation,
        triage_circulation_note: triageCirculationNote,
        triage_blood_pressure: triageBloodPressure,
        triage_heart_rate: triageHeartRate,
        triage_respiratory_rate: triageRespiratoryRate,
        triage_temperature: triageTemperature,
        triage_oxygen_saturation: triageOxygenSat,
        triage_pain_scale: triagePainScale,
        triage_gcs_e: triageGCSE,
        triage_gcs_v: triageGCSV,
        triage_gcs_m: triageGCSM,
        triage_assessment: triageAssessment,
        triage_immediate_actions: triageImmediateAction,
        diagnoses,
        procedures,
        orders: normalizeOrdersForSave(orders),
        medicine_items: normalizeMedicineItemsForSave(medicineItems),
        cppt_notes: cpptNotes,
        fluid_balances: fluidBalances,
        nursing_cares: nursingCares,
        admission_date: admissionDate,
        discharge_date: dischargeDate,
        length_of_stay: lengthOfStay,
      });

      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Perubahan RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description:
          err?.response?.data?.error ||
          "Gagal menyimpan perubahan RM duplikat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════════

  // ══════════════════════════════════════════════
  // Empty state
  // ══════════════════════════════════════════════
  if (!rmDuplicate) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Activity className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Data RM duplikat belum tersedia. Muat ulang halaman.
        </p>
        <Button onClick={() => onSaved()} variant="outline" size="sm">
          Muat Ulang
        </Button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // Section content renderers
  // ══════════════════════════════════════════════
  const renderSectionContent = () => {
    switch (activeSection) {
      // ─── VISIT DATA ───
      case "visit-data":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Data Kunjungan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Informasi tanggal masuk dan keluar untuk kunjungan pasien (rawat jalan & rawat inap)
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal Masuk</Label>
                  <Input
                    type="datetime-local"
                    className="text-xs"
                    value={admissionDate.substring(0, 16)}
                    onChange={(e) => {
                      setAdmissionDate(e.target.value ? e.target.value + ":00" : "");
                      markDirty();
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tanggal & waktu masuk (mulai pelayanan)
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal Keluar</Label>
                  <Input
                    type="datetime-local"
                    className="text-xs"
                    value={dischargeDate.substring(0, 16)}
                    onChange={(e) => {
                      setDischargeDate(e.target.value ? e.target.value + ":00" : "");
                      markDirty();
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tanggal & waktu keluar (selesai pelayanan)
                  </p>
                </div>
              </div>
              
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Catatan:</strong> Data lama rawat dan tarif akomodasi/administrasi akan otomatis dihitung dari master ruangan sesuai kelas pasien.
                </p>
              </div>
            </div>
          </div>
        );

      // ─── ANAMNESIS ───
      case "anamnesis":
        return (
          <AnamnesisForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              anamnesis_source: anamnesisSource,
              functional_status: functionalStatus,
              chief_complaint: chiefComplaint,
              history_of_present_illness: historyOfPresentIllness,
              past_medical_history: pastMedicalHistory,
              family_history: familyHistory,
              social_history: socialHistory,
              allergies,
              current_medications: currentMedications,
              review_of_systems: reviewOfSystems,
            }}
            onSave={handleSaveAnamnesisSection}
          />
        );

      // ─── PHYSICAL EXAM ───
      case "physical-exam":
        return (
          <PhysicalExamForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              general_condition: generalCondition || originalPhysicalExam?.general_condition,
              consciousness: consciousness || originalPhysicalExam?.consciousness,
              systolic: systolic || originalPhysicalExam?.systolic || originalPhysicalExam?.blood_pressure_systolic,
              diastolic: diastolic || originalPhysicalExam?.diastolic || originalPhysicalExam?.blood_pressure_diastolic,
              blood_pressure: bloodPressure || originalPhysicalExam?.blood_pressure,
              heart_rate: heartRate || originalPhysicalExam?.heart_rate,
              respiratory_rate: respiratoryRate || originalPhysicalExam?.respiratory_rate,
              temperature: temperature || originalPhysicalExam?.temperature,
              oxygen_saturation: oxygenSaturation || originalPhysicalExam?.oxygen_saturation,
              weight: weight || originalPhysicalExam?.weight,
              height: height || originalPhysicalExam?.height,
              bmi: bmi || originalPhysicalExam?.bmi,
              pain_method:
                painMethod ||
                originalPhysicalExam?.pain_method ||
                visitPhysicalExam?.pain_method ||
                "nrs",
              pain_scale:
                painScale || originalPhysicalExam?.pain_scale || visitPhysicalExam?.pain_scale || 0,
              pain_location:
                painLocation ||
                originalPhysicalExam?.pain_location ||
                visitPhysicalExam?.pain_location ||
                "",
              waist: waist || originalPhysicalExam?.waist,
              head_circum: headCircum || originalPhysicalExam?.head_circum,
              head:
                head ||
                originalPhysicalExam?.head ||
                rmDuplicate?.head_neck ||
                originalPhysicalExam?.head_neck ||
                visitPhysicalExam?.head ||
                visitPhysicalExam?.head_neck,
              eyes: eyes || originalPhysicalExam?.eyes || visitPhysicalExam?.eyes,
              ears:
                ears ||
                originalPhysicalExam?.ears ||
                rmDuplicate?.ent ||
                originalPhysicalExam?.ent ||
                visitPhysicalExam?.ears ||
                visitPhysicalExam?.ent,
              nose:
                nose ||
                originalPhysicalExam?.nose ||
                rmDuplicate?.ent ||
                originalPhysicalExam?.ent ||
                visitPhysicalExam?.nose ||
                visitPhysicalExam?.ent,
              throat:
                throat ||
                originalPhysicalExam?.throat ||
                rmDuplicate?.ent ||
                originalPhysicalExam?.ent ||
                visitPhysicalExam?.throat ||
                visitPhysicalExam?.ent,
              neck:
                neck ||
                originalPhysicalExam?.neck ||
                rmDuplicate?.head_neck ||
                originalPhysicalExam?.head_neck ||
                visitPhysicalExam?.neck ||
                visitPhysicalExam?.head_neck,
              chest:
                chest ||
                originalPhysicalExam?.chest ||
                originalPhysicalExam?.thorax ||
                visitPhysicalExam?.chest ||
                visitPhysicalExam?.thorax,
              heart:
                heartExam ||
                originalPhysicalExam?.heart ||
                originalPhysicalExam?.cardiac ||
                visitPhysicalExam?.heart ||
                visitPhysicalExam?.cardiac,
              lungs:
                lungs ||
                originalPhysicalExam?.lungs ||
                originalPhysicalExam?.pulmonary ||
                visitPhysicalExam?.lungs ||
                visitPhysicalExam?.pulmonary,
              abdomen: abdomen || originalPhysicalExam?.abdomen || visitPhysicalExam?.abdomen,
              extremities: extremities || originalPhysicalExam?.extremities || visitPhysicalExam?.extremities,
              neurological: neurological || originalPhysicalExam?.neurological || visitPhysicalExam?.neurological,
              skin: skin || originalPhysicalExam?.skin || visitPhysicalExam?.skin,
              other_findings:
                otherFindings ||
                originalPhysicalExam?.other_findings ||
                visitPhysicalExam?.other_findings,
              ecg_performed: ecgPerformed || originalPhysicalExam?.ecg_performed,
              ecg_result: ecgResult || originalPhysicalExam?.ecg_result,
              ecg_interpretation: ecgInterpretation || originalPhysicalExam?.ecg_interpretation,
              ecg_notes: ecgNotes || originalPhysicalExam?.ecg_notes,
            }}
            onSave={handleSavePhysicalExamSection}
          />
        );

      // ─── DIAGNOSES ───
      case "diagnoses":
        return (
          <DiagnosisForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              clinical_impression: clinicalAssessment,
              differential_diagnosis: "",
              items: diagnoses.map((item) => ({
                id: item.id,
                icd10_code: item.icd10_code,
                icd10_name: item.icd10_name,
                diagnosis_type:
                  item.type === "primary"
                    ? "primary"
                    : item.type === "secondary"
                      ? "secondary"
                      : "differential",
                clinical_status: "active",
                verification_status: "confirmed",
              })),
            }}
            onSave={handleSaveDiagnosisSection}
          />
        );

      // ─── PROCEDURES ───
      case "procedures":
        return (
          <div className="space-y-3">
            {procedures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Belum ada prosedur.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {procedures.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground text-xs font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Prosedur (ICD-9-CM)
                          </Label>
                          <ICD9CMCombobox
                            value={p.icd9_code}
                            onChange={(code, display) =>
                              updateProcedure(i, {
                                icd9_code: code,
                                name: display,
                              })
                            }
                            placeholder="Cari prosedur ICD-9-CM..."
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 mt-5 shrink-0"
                          onClick={() => removeProcedure(i)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {p.name && (
                        <p className="text-xs text-muted-foreground pl-1">
                          {p.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ─── LAB ORDERS ───
      case "lab-orders":
        return (
          <div className="space-y-3">
            <LaboratoryWorkstation
              key={rmDataVersion}
              visitId={activeVisitId}
              rmDuplicateMode
              apiAdapter={labWorkstationAdapter as any}
              duplicateDoctorOptions={duplicateDoctorOptions}
              onUpdateDuplicateOrderMeta={(runtimeOrderId, updates) =>
                updateDuplicateOrderMetaByRuntimeId("laboratory", runtimeOrderId, updates)
              }
            />
          </div>
        );

      // ─── RADIOLOGY ORDERS ───
      case "radiology-orders":
        return (
          <div className="space-y-3">
            <RadiologyWorkstation
              key={rmDataVersion}
              visitId={activeVisitId}
              rmDuplicateMode
              apiAdapter={radiologyWorkstationAdapter as any}
              duplicateDoctorOptions={duplicateDoctorOptions}
              onUpdateDuplicateOrderMeta={(runtimeOrderId, updates) =>
                updateDuplicateOrderMetaByRuntimeId("radiology", runtimeOrderId, updates)
              }
            />
          </div>
        );

      // ─── SURGERY ORDERS ───
      case "surgery-orders":
        return (
          <div className="space-y-3">
            <SurgeryWorkstation
              key={rmDataVersion}
              visitId={activeVisitId}
              rmDuplicateMode
              apiAdapter={surgeryWorkstationAdapter as any}
              duplicateDoctorOptions={duplicateDoctorOptions}
              onUpdateDuplicateOrderMeta={(
                runtimeOrderId: number,
                updates: { fake_date?: string; doctor_name?: string },
              ) =>
                updateDuplicateOrderMetaByRuntimeId("surgery", runtimeOrderId, updates)
              }
            />
          </div>
        );

      // ─── CONSULTATION ORDERS ───
      case "consultation-orders":
        return (
          <div className="space-y-3">
            <ConsultationForm
              key={rmDataVersion}
              visitId={activeVisitId}
              rmDuplicateMode
              apiAdapter={consultationWorkstationAdapter as any}
              duplicateDoctorOptions={duplicateDoctorOptions}
              onUpdateDuplicateOrderMeta={(runtimeOrderId, updates) =>
                updateDuplicateOrderMetaByRuntimeId("consultation", runtimeOrderId, updates)
              }
            />
          </div>
        );

      // ─── MEDICINES ───
      case "medicines":
        return (
          <div className="space-y-3">
            <PharmacyEditPrescription
              key={rmDataVersion}
              visitId={activeVisitId}
              rmDuplicateMode
              apiAdapter={pharmacyPrescriptionAdapter as any}
              duplicateDoctorOptions={duplicateDoctorOptions}
              onUpdateDuplicateOrderMeta={(
                runtimeOrderId: number,
                updates: { fake_date?: string; doctor_name?: string },
              ) => updateDuplicateOrderMetaByRuntimeId("pharmacy", runtimeOrderId, updates)}
            />
          </div>
        );

      // ─── ASSESSMENT & PLAN ───
      case "assessment":
        return (
          <AssessmentPlanForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              clinical_assessment: clinicalAssessment,
              prognosis,
              treatment_plan: treatmentPlan,
              medication_plan: medicationPlan,
              diet_plan: dietPlan,
              activity_plan: activityPlan,
              education_plan: educationPlan,
              monitoring_plan: monitoringPlan,
              procedure_plan: procedurePlan,
              consultation_plan: consultationPlan,
            }}
            onSave={handleSaveAssessmentSection}
          />
        );

      // ─── TRIAGE UGD ───
      case "triage":
        return (
          <TriageForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              arrival_mode: triageArrivalMode,
              triage_complaint: triageComplaint,
              triage_level: triageLevel,
              airway: triageAirway,
              airway_note: triageAirwayNote,
              breathing: triageBreathing,
              breathing_note: triageBreathingNote,
              circulation: triageCirculation,
              circulation_note: triageCirculationNote,
              blood_pressure: triageBloodPressure,
              heart_rate: Number(triageHeartRate) || 0,
              respiratory_rate: Number(triageRespiratoryRate) || 0,
              temperature: Number(triageTemperature) || 0,
              oxygen_saturation: Number(triageOxygenSat) || 0,
              pain_scale: triagePainScale,
              pain_method: "nrs",
              pain_location: "",
              gcs_e: triageGCSE,
              gcs_v: triageGCSV,
              gcs_m: triageGCSM,
              triage_assessment: triageAssessment,
              immediate_actions: triageImmediateAction,
            }}
            onSave={handleSaveTriageSection}
          />
        );

      // ─── DISPOSITION ───
      case "disposition":
        return (
          <DispositionForm
            visitId={Number(visit?.id || rmDuplicate?.visit_id || 0)}
            useExternalData
            externalData={{
              disposition_type: dispositionType,
              disposition_note: dispositionNote,
              discharge_status: rmDischargeStatus,
              discharge_condition: dischargeCondition,
              discharge_instruction: dischargeInstruction,
              discharge_medication: dischargeMedication,
              follow_up_instruction: followUpInstruction,
              follow_up_date: followUpDate,
              referral_facility: referralFacility,
              referral_reason: referralReason,
              referral_diagnosis: referralDiagnosis,
              referral_therapy: referralTherapy,
              referral_notes: referralNotes,
              death_time: deathTime,
              death_cause: deathCause,
            }}
            onSave={handleSaveDispositionSection}
          />
        );

      // ─── CPPT ───
      case "cppt":
        return (
          <CPPTForm
            visitId={activeVisitId}
            readOnly
            useExternalData
            externalData={duplicateCpptData}
            staffOptions={duplicateDoctorOptions}
            onSetCreatedBy={handleCpptSetCreatedBy}
            onSetApprovedBy={handleCpptSetApprovedBy}
          />
        );

      // ─── FLUID BALANCE ───
      case "fluid-balance":
        return (
          <FluidBalanceForm
            visitId={activeVisitId}
            readOnly
            useExternalData
            externalData={duplicateFluidBalanceData}
            staffOptions={duplicateDoctorOptions}
            onSetCreatedBy={handleFluidBalanceSetCreatedBy}
            onSetApprovedBy={handleFluidBalanceSetApprovedBy}
          />
        );

      // ─── NURSING CARE ───
      case "nursing-care":
        return (
          <NursingCareForm
            visitId={activeVisitId}
            readOnly
            useExternalData
            externalData={duplicateNursingCareData}
            staffOptions={duplicateDoctorOptions}
            onSetCreatedBy={handleNursingCareSetCreatedBy}
            onSetApprovedBy={handleNursingCareSetApprovedBy}
          />
        );

      // ─── BILLING ───
      case "billing":
        const billing = rmDuplicate?.billing;
        return (
          <div className="space-y-4">
            {!billing || !billing.items || billing.items.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Billing belum dihitung. Simpan data terlebih dahulu untuk
                  menghitung billing.
                </p>
                {rmDuplicate?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecalculateBilling}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menghitung...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Hitung Ulang Billing
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-card">
                  {billing.items && billing.items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="px-3 w-10">No</TableHead>
                          <TableHead className="px-3">Deskripsi</TableHead>
                          <TableHead className="px-3 w-20">Jenis</TableHead>
                          <TableHead className="px-3 text-center w-20">
                            Qty
                          </TableHead>
                          <TableHead className="px-3 text-right w-32">
                            Harga
                          </TableHead>
                          <TableHead className="px-3 text-right w-32">
                            Subtotal
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billing.items.map((item, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="px-3 font-medium">
                              {i + 1}
                            </TableCell>
                            <TableCell className="px-3">
                              {item.description}
                            </TableCell>
                            <TableCell className="px-3">
                              <Badge
                                variant={
                                  item.item_type === "procedure"
                                    ? "default"
                                    : item.item_type === "administration"
                                    ? "outline"
                                    : item.item_type === "accommodation"
                                    ? "outline"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {item.item_type === "procedure"
                                  ? "Tindakan"
                                  : item.item_type === "medicine"
                                  ? "Obat"
                                  : item.item_type === "administration"
                                  ? "Administrasi"
                                  : item.item_type === "accommodation"
                                  ? "Akomodasi"
                                  : item.item_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 text-center font-mono">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="px-3 text-right font-mono">
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell className="px-3 text-right font-mono font-semibold">
                              {formatCurrency(item.subtotal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada item billing
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">
                        Total
                      </span>
                      <span className="text-base font-mono font-semibold text-blue-900">
                        {formatCurrency(billing.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-800">Diskon</span>
                      <span className="text-sm font-mono text-blue-800">
                        - {formatCurrency(billing.discount_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-800">Penyesuaian</span>
                      <span className="text-sm font-mono text-blue-800">
                        {billing.adjust_amount >= 0 ? "+" : ""}{" "}
                        {formatCurrency(billing.adjust_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <span className="text-base font-semibold text-emerald-900">
                      Grand Total
                    </span>
                    <span className="text-2xl font-mono font-bold text-emerald-900">
                      {formatCurrency(billing.final_amount)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    <strong>Catatan:</strong> Ini adalah billing duplikat untuk
                    keperluan E-Klaim saja, bukan billing asli pasien. Billing
                    asli tetap terpisah dan tidak terpengaruh oleh data ini.
                  </p>
                </div>


              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ══════════════════════════════════════════════
  // Main render
  // ══════════════════════════════════════════════
  const integratedSectionIds: SectionId[] = [
    "visit-data",
    "anamnesis",
    "physical-exam",
    "triage",
    "diagnoses",
    "procedures",
    "lab-orders",
    "radiology-orders",
    "surgery-orders",
    "consultation-orders",
    "medicines",
    "assessment",
    "disposition",
    "cppt",
    "fluid-balance",
    "nursing-care",
    "billing",
  ];
  const visibleSections = SECTIONS.filter((section) => {
    if (!integratedSectionIds.includes(section.id)) return false;
    if (section.id === "triage") return !!rmDuplicate?.has_triage;
    return true;
  });

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection) && visibleSections[0]) {
      setActiveSection(visibleSections[0].id);
    }
  }, [activeSection, visibleSections]);

  const activeSectionDef =
    visibleSections.find((s) => s.id === activeSection) || visibleSections[0];
  const sectionTabsTop = Math.max(stickyTopOffset || 64, 64);
  const sectionHeaderTop = sectionTabsTop + 42;

  const duplicateCpptData = useMemo<CPPT[]>(() => {
    return cpptNotes.map((item, index) => ({
      id: item.id ?? -(index + 1),
      created_at: item.record_date || new Date(0).toISOString(),
      updated_at: item.record_date || new Date(0).toISOString(),
      visit_id: activeVisitId,
      record_date: item.record_date,
      profession: item.profession,
      cppt_format: item.cppt_format || "soap",
      subjective: item.subjective || "",
      objective: item.objective || "",
      assessment: item.assessment || "",
      plan: item.plan || "",
      instruction: item.instruction || "",
      blood_pressure: item.blood_pressure || "",
      heart_rate: item.heart_rate || 0,
      respiratory_rate: item.respiratory_rate || 0,
      temperature: item.temperature || "",
      oxygen_saturation: item.oxygen_saturation || 0,
      pain_scale: item.pain_scale || 0,
      is_verified: !!(item.created_by_name && item.approved_by_name),
      created_by: item.created_by_name ? { id: 0, username: "", full_name: item.created_by_name } : undefined,
      verified_by: item.approved_by_name ? { id: 0, username: "", full_name: item.approved_by_name } : undefined,
    }));
  }, [activeVisitId, cpptNotes]);

  const duplicateFluidBalanceData = useMemo<FluidBalance[]>(() => {
    return fluidBalances.map((item, index) => ({
      id: item.id ?? -(index + 1),
      created_at: item.record_date || new Date(0).toISOString(),
      updated_at: item.record_date || new Date(0).toISOString(),
      visit_id: activeVisitId,
      record_date: item.record_date,
      shift_type: item.shift_type,
      oral_drink: item.oral_drink || 0,
      oral_food: item.oral_food || 0,
      oral_medicine: item.oral_medicine || 0,
      iv_fluid: item.iv_fluid || 0,
      iv_medicine: item.iv_medicine || 0,
      blood_product: item.blood_product || 0,
      enteral_feed: item.enteral_feed || 0,
      other_intake: item.other_intake || 0,
      urine_amount: item.urine_amount || 0,
      urine_catheter: false,
      feces_amount: item.feces_amount || 0,
      feces_freq: 0,
      vomit_amount: item.vomit_amount || 0,
      vomit_freq: 0,
      drain_amount: item.drain_amount || 0,
      blood_loss: item.blood_loss || 0,
      iwl: item.iwl || 0,
      other_output: item.other_output || 0,
      total_intake: item.total_intake || 0,
      total_output: item.total_output || 0,
      balance: item.balance || 0,
      notes: item.notes || "",
      is_verified: !!(item.created_by_name && item.approved_by_name),
      created_by: item.created_by_name
        ? { id: 0, username: "", full_name: item.created_by_name }
        : undefined,
      verified_by: item.approved_by_name
        ? { id: 0, username: "", full_name: item.approved_by_name }
        : undefined,
    }));
  }, [activeVisitId, fluidBalances]);

  const duplicateNursingCareData = useMemo<NursingCare[]>(() => {
    return nursingCares.map((item, index) => ({
      id: item.id ?? -(index + 1),
      created_at: item.record_date || new Date(0).toISOString(),
      updated_at: item.record_date || new Date(0).toISOString(),
      visit_id: activeVisitId,
      record_date: item.record_date,
      shift_type: item.shift_type || "",
      chief_complaint: item.chief_complaint || "",
      pain_assessment: item.pain_assessment || "",
      pain_scale: item.pain_scale || 0,
      consciousness_level: item.consciousness_level || "",
      functional_status: item.functional_status || "",
      fall_risk_assessment: item.fall_risk_assessment || "",
      fall_risk_score: item.fall_risk_score || 0,
      nutrition_assessment: item.nutrition_assessment || "",
      skin_assessment: item.skin_assessment || "",
      pressure_ulcer_risk: item.pressure_ulcer_risk || "",
      blood_pressure: item.blood_pressure || "",
      heart_rate: item.heart_rate || 0,
      respiratory_rate: item.respiratory_rate || 0,
      temperature: item.temperature || "",
      oxygen_saturation: item.oxygen_saturation || 0,
      nursing_diagnosis: item.nursing_diagnosis || "",
      nursing_diagnosis_code: item.nursing_diagnosis_code || "",
      problem_etiology: item.problem_etiology || "",
      signs_symptoms: item.signs_symptoms || "",
      nursing_outcome: item.nursing_outcome || "",
      nursing_outcome_code: item.nursing_outcome_code || "",
      outcome_indicators: item.outcome_indicators || "",
      outcome_target: item.outcome_target || "",
      nursing_intervention: item.nursing_intervention || "",
      nursing_intervention_code: item.nursing_intervention_code || "",
      observation_actions: item.observation_actions || "",
      therapeutic_actions: item.therapeutic_actions || "",
      education_actions: item.education_actions || "",
      collaboration_actions: item.collaboration_actions || "",
      implementation: item.implementation || "",
      implementation_time: item.implementation_time || "",
      patient_response: item.patient_response || "",
      evaluation_subjective: item.evaluation_subjective || "",
      evaluation_objective: item.evaluation_objective || "",
      evaluation_analysis: item.evaluation_analysis || "",
      evaluation_planning: item.evaluation_planning || "",
      problem_status: item.problem_status || "",
      notes: item.notes || "",
      is_verified: !!(item.created_by_name && item.approved_by_name),
      created_by: item.created_by_name
        ? { id: 0, username: "", full_name: item.created_by_name }
        : undefined,
      verified_by: item.approved_by_name
        ? { id: 0, username: "", full_name: item.approved_by_name }
        : undefined,
    }));
  }, [activeVisitId, nursingCares]);

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabsDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateTabsScrollState = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      updateTabsScrollState();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [updateTabsScrollState]);

  useEffect(() => { updateTabsScrollState(); }, [visibleSections, updateTabsScrollState]);

  const scrollTabsBy = (delta: number) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const scrollTabToCenter = useCallback((sectionId: string) => {
    requestAnimationFrame(() => {
      const el = tabsScrollRef.current;
      if (!el) return;
      const btn = el.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement;
      if (!btn) return;
      const target = btn.offsetLeft + btn.offsetWidth / 2 - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollTabToCenter(activeSection); }, [activeSection, scrollTabToCenter]);

  const handleTabsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    tabsDragState.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };
  const handleTabsMouseLeaveOrUp = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    tabsDragState.current.isDown = false;
    el.style.cursor = "";
    el.style.userSelect = "";
  };
  const handleTabsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tabsDragState.current.isDown) return;
    e.preventDefault();
    const el = tabsScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = x - tabsDragState.current.startX;
    el.scrollLeft = tabsDragState.current.scrollLeft - walk;
    updateTabsScrollState();
  };

  return (
    <div className="space-y-0">
      <div
        className="sticky z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 py-1 -mt-px"
        style={{ top: `${sectionTabsTop}px` }}
      >
        <div className="flex items-center gap-0.5 px-1">
          <button
            onClick={() => scrollTabsBy(-200)}
            className={cn(
              "h-8 w-6 flex items-center justify-center rounded shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              !canScrollLeft && "invisible pointer-events-none",
            )}
            aria-label="Geser kiri"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div
            ref={tabsScrollRef}
            className="flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab"
            onScroll={updateTabsScrollState}
            onMouseDown={handleTabsMouseDown}
            onMouseLeave={handleTabsMouseLeaveOrUp}
            onMouseUp={handleTabsMouseLeaveOrUp}
            onMouseMove={handleTabsMouseMove}
          >
            <div className="inline-flex items-center gap-1 min-w-max">
              {visibleSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const status = sectionStatus(section.id);
                return (
                  <button
                    key={section.id}
                    data-section-id={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "h-8 px-3 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{section.label}</span>
                    {status.count != null && status.count > 0 && (
                      <Badge variant="secondary" className="h-4 text-[10px] px-1">
                        {status.count}
                      </Badge>
                    )}
                    {status.count == null && status.filled && (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    )}
                    {dirty && isActive && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Perubahan belum disimpan"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => scrollTabsBy(200)}
            className={cn(
              "h-8 w-6 flex items-center justify-center rounded shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              !canScrollRight && "invisible pointer-events-none",
            )}
            aria-label="Geser kanan"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="min-h-[500px]">
        <div className="flex-1 min-w-0">
          {/* Section header */}
          <div
            className="sticky z-20 -mx-1 px-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
            style={{ top: `${sectionHeaderTop}px` }}
          >
            <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <activeSectionDef.icon className="h-5 w-5 text-foreground" />
              <h3 className="text-base font-semibold">{activeSectionDef.label}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {activeSection === "procedures" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Tambah prosedur ICD-9"
                  aria-label="Tambah prosedur ICD-9"
                  onClick={addProcedure}
                >
                  <Activity className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeSection === "cppt" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Tambah CPPT duplikat"
                  aria-label="Tambah CPPT duplikat"
                  onClick={handleOpenAddCPPT}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeSection === "fluid-balance" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Tambah balance cairan duplikat"
                  aria-label="Tambah balance cairan duplikat"
                  onClick={handleOpenAddFluidBalance}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeSection === "nursing-care" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Tambah asuhan keperawatan duplikat"
                  aria-label="Tambah asuhan keperawatan duplikat"
                  onClick={handleOpenAddNursingCare}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeSection === "lab-orders" && (
                <>
                  {labOrdersCount > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      title="Pilih order laboratorium"
                      aria-label="Pilih order laboratorium"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("rm-duplicate-open-lab-order-picker"),
                        );
                      }}
                    >
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded text-[14px] font-bold">
                        {labOrdersCount}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Tambah order + tindakan laboratorium"
                    aria-label="Tambah order + tindakan laboratorium"
                    onClick={() => {
                      setQuickAddOrderType("laboratory");
                      setProcSearchTerm("");
                      setProcSearchResults([]);
                    }}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {activeSection === "radiology-orders" && (
                <>
                  {radiologyOrdersCount > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      title="Pilih order radiologi"
                      aria-label="Pilih order radiologi"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("rm-duplicate-open-radiology-order-picker"),
                        );
                      }}
                    >
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded text-[14px] font-bold">
                        {radiologyOrdersCount}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Tambah order + tindakan radiologi"
                    aria-label="Tambah order + tindakan radiologi"
                    onClick={() => {
                      setQuickAddOrderType("radiology");
                      setProcSearchTerm("");
                      setProcSearchResults([]);
                    }}
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {activeSection === "surgery-orders" && (
                <>
                  {surgeryOrders.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      title="Pilih order operasi"
                      aria-label="Pilih order operasi"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("rm-duplicate-open-surgery-order-picker"),
                        );
                      }}
                    >
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded text-[14px] font-bold">
                        {surgeryOrders.length}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Tambah order + tindakan operasi"
                    aria-label="Tambah order + tindakan operasi"
                    onClick={() => {
                      setQuickAddOrderType("surgery");
                      setProcSearchTerm("");
                      setProcSearchResults([]);
                    }}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {activeSection === "consultation-orders" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Tambah order + tindakan konsultasi"
                  aria-label="Tambah order + tindakan konsultasi"
                  onClick={() => {
                    setQuickAddOrderType("consultation");
                    setProcSearchTerm("");
                    setProcSearchResults([]);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              )}
              {activeSection === "medicines" && (
                <>
                  {pharmacyOrders.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      title="Pilih resep"
                      aria-label="Pilih resep"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("rm-duplicate-open-pharmacy-order-picker"),
                        );
                      }}
                    >
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded text-[14px] font-bold">
                        {pharmacyOrders.length}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Tambah resep"
                    aria-label="Tambah resep"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("rm-duplicate-create-pharmacy-order"),
                      );
                    }}
                  >
                    <Pill className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {activeSection === "billing" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    title="Preview mapping ke tarif E-Klaim"
                    onClick={() => setShowMappingModal(true)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Preview Mapping
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Hitung ulang billing"
                    aria-label="Hitung ulang billing"
                    onClick={handleRecalculateBilling}
                    disabled={syncing || submitting}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}

              <div className="h-5 w-px bg-border mx-0.5" />

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Simpan RM Duplikat"
                aria-label="Simpan RM Duplikat"
                onClick={handleSaveRMDuplicate}
                disabled={submitting || syncing || !dirty}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Kembalikan dari RM Asli"
                aria-label="Kembalikan dari RM Asli"
                onClick={handleRestoreFromOriginal}
                disabled={syncing || submitting}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            </div>
          </div>

          {/* Section content */}
          {renderSectionContent()}
        </div>
      </div>

          <Dialog open={cpptDialogOpen} onOpenChange={setCpptDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah CPPT Duplikat</DialogTitle>
                <DialogDescription>
                  Data akan ditambahkan ke RM duplikat dan disimpan saat Anda menekan tombol simpan RM duplikat.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal & Waktu</Label>
                    <Input
                      type="datetime-local"
                      value={newCppt.record_date}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, record_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profesi</Label>
                    <Select
                      value={newCppt.profession}
                      onValueChange={(value) => setNewCppt((prev) => ({ ...prev, profession: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih profesi" />
                      </SelectTrigger>
                      <SelectContent>
                        {DUPLICATE_CPPT_PROFESSIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pembuat</Label>
                    <Select
                      value={newCppt.created_by_name || ""}
                      onValueChange={(val) => setNewCppt((prev) => ({ ...prev, created_by_name: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pembuat" />
                      </SelectTrigger>
                      <SelectContent>
                        {duplicateDoctorOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Approval</Label>
                    <Select
                      value={newCppt.approved_by_name || ""}
                      onValueChange={(val) => setNewCppt((prev) => ({ ...prev, approved_by_name: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih approval" />
                      </SelectTrigger>
                      <SelectContent>
                        {duplicateDoctorOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subjective</Label>
                    <Textarea
                      rows={3}
                      value={newCppt.subjective}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, subjective: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Objective</Label>
                    <Textarea
                      rows={3}
                      value={newCppt.objective}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, objective: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assessment</Label>
                    <Textarea
                      rows={3}
                      value={newCppt.assessment}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, assessment: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Textarea
                      rows={3}
                      value={newCppt.plan}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, plan: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instruksi</Label>
                  <Textarea
                    rows={2}
                    value={newCppt.instruction}
                    onChange={(e) => setNewCppt((prev) => ({ ...prev, instruction: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label>TD</Label>
                    <Input
                      placeholder="120/80"
                      value={newCppt.blood_pressure || ""}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, blood_pressure: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HR</Label>
                    <Input
                      type="number"
                      value={newCppt.heart_rate || 0}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, heart_rate: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RR</Label>
                    <Input
                      type="number"
                      value={newCppt.respiratory_rate || 0}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, respiratory_rate: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Suhu</Label>
                    <Input
                      value={newCppt.temperature || ""}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, temperature: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SpO2</Label>
                    <Input
                      type="number"
                      value={newCppt.oxygen_saturation || 0}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, oxygen_saturation: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nyeri</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={newCppt.pain_scale || 0}
                      onChange={(e) => setNewCppt((prev) => ({ ...prev, pain_scale: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    rows={2}
                    value={newCppt.notes}
                    onChange={(e) => setNewCppt((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCpptDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSaveAddCPPT}>Tambahkan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={fluidBalanceDialogOpen} onOpenChange={setFluidBalanceDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Balance Cairan Duplikat</DialogTitle>
                <DialogDescription>
                  Data akan ditambahkan ke RM duplikat dan dihitung otomatis saat disimpan.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input
                      type="date"
                      value={newFluidBalance.record_date}
                      onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, record_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select
                      value={newFluidBalance.shift_type}
                      onValueChange={(value) => setNewFluidBalance((prev) => ({ ...prev, shift_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {DUPLICATE_SHIFT_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <Label className="font-semibold flex items-center gap-2 mb-3">
                    <ArrowDownToLine className="h-4 w-4 text-muted-foreground" /> INTAKE (Masukan)
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Minum (ml)</Label><Input type="number" value={newFluidBalance.oral_drink || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, oral_drink: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Air Makanan (ml)</Label><Input type="number" value={newFluidBalance.oral_food || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, oral_food: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Obat Oral (ml)</Label><Input type="number" value={newFluidBalance.oral_medicine || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, oral_medicine: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Cairan Infus (ml)</Label><Input type="number" value={newFluidBalance.iv_fluid || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, iv_fluid: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Obat IV (ml)</Label><Input type="number" value={newFluidBalance.iv_medicine || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, iv_medicine: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Produk Darah (ml)</Label><Input type="number" value={newFluidBalance.blood_product || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, blood_product: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">NGT/OGT Feed (ml)</Label><Input type="number" value={newFluidBalance.enteral_feed || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, enteral_feed: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Intake Lain (ml)</Label><Input type="number" value={newFluidBalance.other_intake || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, other_intake: parseFloat(e.target.value) || 0 }))} /></div>
                  </div>
                  <div className="mt-2 text-right text-sm font-semibold text-green-700">
                    Total Intake: {(newFluidBalance.oral_drink||0)+(newFluidBalance.oral_food||0)+(newFluidBalance.oral_medicine||0)+(newFluidBalance.iv_fluid||0)+(newFluidBalance.iv_medicine||0)+(newFluidBalance.blood_product||0)+(newFluidBalance.enteral_feed||0)+(newFluidBalance.other_intake||0)} ml
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <Label className="font-semibold flex items-center gap-2 mb-3">
                    <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" /> OUTPUT (Keluaran)
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Urine (ml)</Label><Input type="number" value={newFluidBalance.urine_amount || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, urine_amount: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">BAB (ml)</Label><Input type="number" value={newFluidBalance.feces_amount || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, feces_amount: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Muntah (ml)</Label><Input type="number" value={newFluidBalance.vomit_amount || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, vomit_amount: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Drain (ml)</Label><Input type="number" value={newFluidBalance.drain_amount || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, drain_amount: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Perdarahan (ml)</Label><Input type="number" value={newFluidBalance.blood_loss || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, blood_loss: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">IWL (ml)</Label><Input type="number" value={newFluidBalance.iwl || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, iwl: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Output Lain (ml)</Label><Input type="number" value={newFluidBalance.other_output || ""} onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, other_output: parseFloat(e.target.value) || 0 }))} /></div>
                  </div>
                  <div className="mt-2 text-right text-sm font-semibold text-red-700">
                    Total Output: {(newFluidBalance.urine_amount||0)+(newFluidBalance.feces_amount||0)+(newFluidBalance.vomit_amount||0)+(newFluidBalance.drain_amount||0)+(newFluidBalance.blood_loss||0)+(newFluidBalance.iwl||0)+(newFluidBalance.other_output||0)} ml
                  </div>
                </div>
                {(() => {
                  const intake = (newFluidBalance.oral_drink||0)+(newFluidBalance.oral_food||0)+(newFluidBalance.oral_medicine||0)+(newFluidBalance.iv_fluid||0)+(newFluidBalance.iv_medicine||0)+(newFluidBalance.blood_product||0)+(newFluidBalance.enteral_feed||0)+(newFluidBalance.other_intake||0);
                  const output = (newFluidBalance.urine_amount||0)+(newFluidBalance.feces_amount||0)+(newFluidBalance.vomit_amount||0)+(newFluidBalance.drain_amount||0)+(newFluidBalance.blood_loss||0)+(newFluidBalance.iwl||0)+(newFluidBalance.other_output||0);
                  const bal = intake - output;
                  return (
                    <div className={`border rounded-lg p-4 text-center ${bal > 0 ? "bg-green-100" : bal < 0 ? "bg-red-100" : "bg-gray-100"}`}>
                      <p className="text-sm font-medium">BALANCE</p>
                      <p className={`text-2xl font-bold ${bal > 0 ? "text-green-700" : bal < 0 ? "text-red-700" : "text-gray-700"}`}>
                        {bal > 0 ? "+" : ""}{bal} ml
                      </p>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pembuat</Label>
                    <Select
                      value={newFluidBalance.created_by_name || ""}
                      onValueChange={(val) => setNewFluidBalance((prev) => ({ ...prev, created_by_name: val }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih pembuat" /></SelectTrigger>
                      <SelectContent>
                        {duplicateDoctorOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Approval</Label>
                    <Select
                      value={newFluidBalance.approved_by_name || ""}
                      onValueChange={(val) => setNewFluidBalance((prev) => ({ ...prev, approved_by_name: val }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih approval" /></SelectTrigger>
                      <SelectContent>
                        {duplicateDoctorOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    rows={2}
                    value={newFluidBalance.notes}
                    onChange={(e) => setNewFluidBalance((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFluidBalanceDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSaveAddFluidBalance}>Tambahkan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={nursingCareDialogOpen} onOpenChange={setNursingCareDialogOpen}>
            <DialogContent className="max-w-full w-full h-screen max-h-screen flex flex-col p-0 gap-0 rounded-none">
              <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5" />
                  Tambah Asuhan Keperawatan Duplikat
                </DialogTitle>
                <DialogDescription>
                  Data akan ditambahkan ke RM duplikat dan disimpan saat Anda menekan tombol simpan RM duplikat.
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pt-4 shrink-0">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Label>Pilih SDKI dari Master (Auto Isi)</Label>
                  <Select value={duplicateNursingMasterCode} onValueChange={handleDuplicateApplyMasterSdki}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih diagnosis SDKI untuk isi otomatis" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsedDuplicateNursingMasterItems.length === 0 ? (
                        <SelectItem value="__empty" disabled>Master data SDKI belum terbaca.</SelectItem>
                      ) : (
                        parsedDuplicateNursingMasterItems.map((item) => (
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
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tanggal & Waktu</Label>
                      <Input
                        type="datetime-local"
                        value={newNursingCare.record_date}
                        onChange={(e) => setNewNursingCare((prev) => ({ ...prev, record_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift</Label>
                      <Select
                        value={newNursingCare.shift_type}
                        onValueChange={(value) => setNewNursingCare((prev) => ({ ...prev, shift_type: value }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih shift" /></SelectTrigger>
                        <SelectContent>
                          {DUPLICATE_SHIFT_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status Masalah</Label>
                      <Select
                        value={newNursingCare.problem_status || "belum_teratasi"}
                        onValueChange={(value) => setNewNursingCare((prev) => ({ ...prev, problem_status: value }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih status masalah" /></SelectTrigger>
                        <SelectContent>
                          {DUPLICATE_PROBLEM_STATUS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* SDKI */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Diagnosis Keperawatan</Label>
                        <Textarea
                          value={newNursingCare.nursing_diagnosis}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, nursing_diagnosis: e.target.value }))}
                          placeholder="Contoh: Nyeri akut berhubungan dengan agen pencedera fisik"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kode SDKI</Label>
                        <Input
                          value={newNursingCare.nursing_diagnosis_code}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, nursing_diagnosis_code: e.target.value }))}
                          placeholder="D.0077"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Etiologi (Penyebab/Berhubungan dengan)</Label>
                        <Textarea
                          value={newNursingCare.problem_etiology}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, problem_etiology: e.target.value }))}
                          placeholder="Faktor yang berhubungan dengan masalah..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanda & Gejala (Ditandai dengan)</Label>
                        <Textarea
                          value={newNursingCare.signs_symptoms}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, signs_symptoms: e.target.value }))}
                          placeholder="Batasan karakteristik yang ditemukan..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                  {/* SLKI */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="col-span-3 space-y-2">
                        <Label>Luaran Keperawatan</Label>
                        <Textarea
                          value={newNursingCare.nursing_outcome}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, nursing_outcome: e.target.value }))}
                          placeholder="Contoh: Tingkat nyeri menurun"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Indikator Luaran</Label>
                        <Textarea
                          value={newNursingCare.outcome_indicators}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, outcome_indicators: e.target.value }))}
                          placeholder="Indikator yang diukur..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Pencapaian</Label>
                        <Select
                          value={newNursingCare.outcome_target || ""}
                          onValueChange={(value) => setNewNursingCare((prev) => ({ ...prev, outcome_target: value }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Pilih target" /></SelectTrigger>
                          <SelectContent>
                            {DUPLICATE_OUTCOME_TARGETS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  {/* SIKI */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="col-span-3 space-y-2">
                        <Label>Intervensi Keperawatan</Label>
                        <Textarea
                          value={newNursingCare.nursing_intervention}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, nursing_intervention: e.target.value }))}
                          placeholder="Intervensi utama dan pendukung sesuai SIKI"
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tindakan Observasi</Label>
                        <Textarea
                          value={newNursingCare.observation_actions}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, observation_actions: e.target.value }))}
                          placeholder="Ringkas tindakan observasi"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Terapeutik</Label>
                        <Textarea
                          value={newNursingCare.therapeutic_actions}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, therapeutic_actions: e.target.value }))}
                          placeholder="Ringkas tindakan terapeutik"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Edukasi</Label>
                        <Textarea
                          value={newNursingCare.education_actions}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, education_actions: e.target.value }))}
                          placeholder="Ringkas tindakan edukasi"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tindakan Kolaborasi</Label>
                        <Textarea
                          value={newNursingCare.collaboration_actions}
                          onChange={(e) => setNewNursingCare((prev) => ({ ...prev, collaboration_actions: e.target.value }))}
                          placeholder="Ringkas tindakan kolaborasi"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Pembuat / Approval */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pembuat</Label>
                      <Select
                        value={newNursingCare.created_by_name || ""}
                        onValueChange={(val) => setNewNursingCare((prev) => ({ ...prev, created_by_name: val }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih pembuat" /></SelectTrigger>
                        <SelectContent>
                          {duplicateDoctorOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Approval</Label>
                      <Select
                        value={newNursingCare.approved_by_name || ""}
                        onValueChange={(val) => setNewNursingCare((prev) => ({ ...prev, approved_by_name: val }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih approval" /></SelectTrigger>
                        <SelectContent>
                          {duplicateDoctorOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Catatan */}
                  <div className="space-y-2">
                    <Label>Catatan Tambahan</Label>
                    <Textarea
                      rows={2}
                      value={newNursingCare.notes}
                      onChange={(e) => setNewNursingCare((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Catatan ringkas asuhan keperawatan"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
                <Button variant="outline" onClick={() => setNursingCareDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSaveAddNursingCare}>Tambahkan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      <Dialog
        open={
          quickAddOrderType === "laboratory" ||
          quickAddOrderType === "radiology" ||
          quickAddOrderType === "consultation" ||
          quickAddOrderType === "surgery"
        }
        onOpenChange={(open) => {
          if (!open) closeQuickAddDialog();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {quickAddOrderType === "laboratory"
                ? "Tambah Order + Tindakan Laboratorium"
                : quickAddOrderType === "radiology"
                ? "Tambah Order + Tindakan Radiologi"
                : quickAddOrderType === "surgery"
                ? "Tambah Order + Tindakan Operasi"
                : "Tambah Order + Tindakan Konsultasi"}
            </DialogTitle>
            <DialogDescription>
              Pilih satu atau lebih tindakan. Setiap tindakan yang dipilih akan masuk ke order yang sama. Klik <strong>Order Baru</strong> untuk mulai order berbeda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(() => {
              const existingFakeOrders = quickAddOrderType
                ? orders.filter((o) => o.order_type === quickAddOrderType && o.is_fake)
                : [];
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Tambah ke:</span>
                  {existingFakeOrders.map((o, idx) => {
                    const label = o.order_number ? o.order_number : `Order Baru ${idx + 1}`;
                    const isActive = quickAddFakeDate !== null && o.fake_date === quickAddFakeDate;
                    return (
                      <button
                        key={o.fake_date || idx}
                        type="button"
                        onClick={() => {
                          setQuickAddFakeDate(o.fake_date || null);
                          setQuickAddAddedNames([]);
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-muted/80 border-border",
                        )}
                      >
                        {label} ({(o.items || []).length} tindakan)
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddFakeDate(null);
                      setQuickAddAddedNames([]);
                    }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      quickAddFakeDate === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted hover:bg-muted/80 border-border",
                    )}
                  >
                    + Order Baru
                  </button>
                </div>
              );
            })()}

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 text-sm"
                placeholder={
                  quickAddOrderType === "laboratory"
                    ? "Cari tindakan laboratorium..."
                    : quickAddOrderType === "radiology"
                    ? "Cari tindakan radiologi..."
                    : quickAddOrderType === "surgery"
                    ? "Cari tindakan operasi..."
                    : "Cari tindakan konsultasi..."
                }
                value={procSearchTerm}
                onChange={(e) =>
                  quickAddOrderType && handleProcSearch(e.target.value, quickAddOrderType)
                }
              />
            </div>

            {searchingProcs && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Mencari tindakan...
              </div>
            )}

            {!searchingProcs && procSearchTerm.length >= 2 && procSearchResults.length === 0 && (
              <p className="text-xs text-muted-foreground">Tindakan tidak ditemukan.</p>
            )}

            {!searchingProcs && procSearchResults.length > 0 && (
              <div className="max-h-52 overflow-y-auto border rounded divide-y bg-white">
                {procSearchResults.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    disabled={loadingParams}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50"
                    onClick={() =>
                      quickAddOrderType &&
                      handleQuickAddProcedureToType(quickAddOrderType, proc)
                    }
                  >
                    {loadingParams ? (
                      <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                    ) : null}
                    <p className="text-sm font-medium inline">{proc.name}</p>
                    <p className="text-xs text-muted-foreground">{proc.code || "-"}</p>
                  </button>
                ))}
              </div>
            )}

            {quickAddAddedNames.length > 0 && (
              <div className="border rounded p-2 bg-green-50 space-y-1">
                <p className="text-xs font-medium text-green-700">
                  Tindakan ditambahkan ({quickAddAddedNames.length}):
                </p>
                {quickAddAddedNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-green-800">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={closeQuickAddDialog}>
                Selesai
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kembalikan dari RM Asli?</DialogTitle>
            <DialogDescription>
              Perubahan edit pada RM Duplikat akan ditimpa oleh data RM Asli dari kunjungan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={syncing || submitting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRestoreFromOriginal}
              disabled={syncing || submitting}
            >
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Preview Modal */}
      <Dialog open={showMappingModal} onOpenChange={setShowMappingModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Mapping Billing ke Tarif E-Klaim</DialogTitle>
            <DialogDescription>
              Berikut adalah breakdown bagaimana billing duplikat akan di-mapping ke komponen tarif E-Klaim
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const mappingData = calculateTarifMapping();
            if (!mappingData) {
              return (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Belum ada data billing untuk dipetakan
                </p>
              );
            }

            const { mapping, details, total } = mappingData;

            return (
              <div className="space-y-6">
                {/* Detail Items */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Detail Mapping Per Item</h3>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="px-3">Item Billing</TableHead>
                          <TableHead className="px-3 w-32">Tipe</TableHead>
                          <TableHead className="px-3 text-right w-32">Jumlah</TableHead>
                          <TableHead className="px-3 w-40">Dipetakan ke</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.map((detail, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="px-3">{detail.item}</TableCell>
                            <TableCell className="px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {detail.type === "procedure"
                                  ? "Tindakan"
                                  : detail.type === "medicine"
                                  ? "Obat"
                                  : detail.type === "administration"
                                  ? "Administrasi"
                                  : detail.type === "accommodation"
                                  ? "Akomodasi"
                                  : detail.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 text-right font-mono">
                              {formatCurrency(detail.amount)}
                            </TableCell>
                            <TableCell className="px-3">
                              <Badge variant="secondary" className="text-[10px]">
                                {detail.mappedTo}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mapping Summary */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Ringkasan Tarif E-Klaim</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ["Prosedur Non Bedah", mapping.prosedurNonBedah],
                      ["Prosedur Bedah", mapping.prosedurBedah],
                      ["Konsultasi", mapping.konsultasi],
                      ["Tenaga Ahli", mapping.tenagaAhli],
                      ["Keperawatan", mapping.keperawatan],
                      ["Penunjang", mapping.penunjang],
                      ["Radiologi", mapping.radiologi],
                      ["Laboratorium", mapping.laboratorium],
                      ["Pelayanan Darah", mapping.pelayananDarah],
                      ["Rehabilitasi", mapping.rehabilitasi],
                      ["Kamar / Akomodasi", mapping.kamar],
                      ["Rawat Intensif", mapping.rawatIntensif],
                      ["Obat", mapping.obat],
                      ["Obat Kronis", mapping.obatKronis],
                      ["Obat Kemoterapi", mapping.obatKemoterapi],
                      ["Alkes", mapping.alkes],
                      ["BMHP", mapping.bmhp],
                      ["Sewa Alat", mapping.sewaAlat],
                    ].filter(([_, val]) => (val as number) > 0).map(([label, val]) => (
                      <div key={label as string} className="flex justify-between items-center py-2 px-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-mono font-semibold">{formatCurrency(val as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-base font-semibold text-emerald-900">Total Tarif RS</span>
                  <span className="text-xl font-mono font-bold text-emerald-900">
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Info:</strong> Preview ini menunjukkan mapping sederhana dari billing duplikat.
                    Ketika Anda klik "Sync dari Billing" di tab Data Klaim, backend akan melakukan mapping
                    yang lebih detail berdasarkan tipe order (laboratory/radiology/consultation/surgery) dan
                    referensi prosedur untuk hasil yang lebih akurat.
                  </p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
