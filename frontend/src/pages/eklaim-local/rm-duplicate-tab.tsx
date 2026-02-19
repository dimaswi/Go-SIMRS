import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
} from "@/lib/api/eklaim-local";
import { proceduresApi, procedureParametersApi } from "@/lib/api/procedures";
import type {
  Procedure,
  ProcedureParameter,
  ProcedureType,
} from "@/lib/api/procedures";
import { medicinesApi } from "@/lib/api/medicines";
import type { Medicine } from "@/lib/api/medicines";
import { employeesApi } from "@/lib/api/employees";
import type { Employee } from "@/lib/api/employees";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Plus,
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
  Trash2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Calendar,
  AlertTriangle,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ICD10Combobox } from "@/components/ui/icd10-combobox";
import { ICD9CMCombobox } from "@/components/ui/icd9cm-combobox";
import { Combobox } from "@/components/ui/combobox";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { cn } from "@/lib/utils";

interface RMDuplicateTabProps {
  eklaimId: number;
  rmDuplicate: EKlaimRMDuplicate | null | undefined;
  visit?: any;
  onSaved: () => void;
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
  { id: "billing", label: "Billing Duplikat", icon: DollarSign },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function RMDuplicateTab({
  eklaimId,
  rmDuplicate,
  visit,
  onSaved,
}: RMDuplicateTabProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("anamnesis");
  const [showMappingModal, setShowMappingModal] = useState(false);

  // ── Anamnesis ──
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

  // ── Body Systems (legacy) ──
  const [headNeck, setHeadNeck] = useState("");
  const [eyes, setEyes] = useState("");
  const [ent, setEnt] = useState("");
  const [thorax, setThorax] = useState("");
  const [cardiac, setCardiac] = useState("");
  const [pulmonary, setPulmonary] = useState("");
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
  const [musculoskel, setMusculoskel] = useState("");
  const [genitourinary, setGenitourinary] = useState("");
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

  // ── Triage master data ──
  const { getOptions: getTriageOptions } = useMultipleMasterData([
    'arrival_mode', 'triage_level', 'airway_status', 'breathing_status', 'circulation_status',
  ]);
  const triageLevelColors: Record<string, string> = {
    "0": "bg-black",
    "1": "bg-red-500",
    "2": "bg-orange-500",
    "3": "bg-yellow-500",
    "4": "bg-green-500",
    "5": "bg-blue-500",
  };

  const [diagnoses, setDiagnoses] = useState<EKlaimRMDiagnosis[]>([]);

  // ── Procedures ──
  const [procedures, setProcedures] = useState<EKlaimRMProcedure[]>([]);

  // ── Orders ──
  const [orders, setOrders] = useState<EKlaimRMOrder[]>([]);

  // ── Medicine Items ──
  const [medicineItems, setMedicineItems] = useState<EKlaimRMMedicineItem[]>(
    [],
  );

  // ── CPPT Notes ──
  const [cpptNotes, setCpptNotes] = useState<EKlaimRMCPPT[]>([]);

  // ── Fluid Balances ──
  const [fluidBalances, setFluidBalances] = useState<EKlaimRMFluidBalance[]>(
    [],
  );

  // ── Tarif ──
  const [tarifProsedurNonBedah, setTarifProsedurNonBedah] = useState(0);
  const [tarifProsedurBedah, setTarifProsedurBedah] = useState(0);
  const [tarifKonsultasi, setTarifKonsultasi] = useState(0);
  const [tarifTenagaAhli, setTarifTenagaAhli] = useState(0);
  const [tarifKeperawatan, setTarifKeperawatan] = useState(0);
  const [tarifPenunjang, setTarifPenunjang] = useState(0);
  const [tarifRadiologi, setTarifRadiologi] = useState(0);
  const [tarifLaboratorium, setTarifLaboratorium] = useState(0);
  const [tarifPelayananDarah, setTarifPelayananDarah] = useState(0);
  const [tarifRehabilitasi, setTarifRehabilitasi] = useState(0);
  const [tarifKamar, setTarifKamar] = useState(0);
  const [tarifRawatIntensif, setTarifRawatIntensif] = useState(0);
  const [tarifObat, setTarifObat] = useState(0);
  const [tarifObatKronis, setTarifObatKronis] = useState(0);
  const [tarifObatKemoterapi, setTarifObatKemoterapi] = useState(0);
  const [tarifAlkes, setTarifAlkes] = useState(0);
  const [tarifBMHP, setTarifBMHP] = useState(0);
  const [tarifSewaAlat, setTarifSewaAlat] = useState(0);

  // ── Inpatient-specific fields ──
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [lengthOfStay, setLengthOfStay] = useState(0);
  const [accommodationTariffPerDay, setAccommodationTariffPerDay] = useState(0);

  // ── Procedure Search ──
  const [addingItemToOrder, setAddingItemToOrder] = useState<number | null>(
    null,
  );
  const [procSearchTerm, setProcSearchTerm] = useState("");
  const [procSearchResults, setProcSearchResults] = useState<Procedure[]>([]);
  const [searchingProcs, setSearchingProcs] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const procSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Medicine Search ──
  const [medSearchTerm, setMedSearchTerm] = useState("");
  const [medSearchResults, setMedSearchResults] = useState<Medicine[]>([]);
  const [searchingMeds, setSearchingMeds] = useState(false);
  const medSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Employee Search (for staff_name in CPPT & Fluid Balance) ──
  const [empSearchKey, setEmpSearchKey] = useState<string | null>(null); // e.g. 'cppt-0' or 'fb-2'
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const [empSearchResults, setEmpSearchResults] = useState<Employee[]>([]);
  const [searchingEmps, setSearchingEmps] = useState(false);
  const empSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmpSearch = (term: string) => {
    setEmpSearchTerm(term);
    if (empSearchTimeout.current) clearTimeout(empSearchTimeout.current);
    if (!term || term.length < 2) {
      setEmpSearchResults([]);
      return;
    }
    empSearchTimeout.current = setTimeout(async () => {
      setSearchingEmps(true);
      try {
        const res = await employeesApi.getAll({
          search: term,
          is_active: "true",
          limit: 10,
        });
        setEmpSearchResults(res.data?.data || res.data || []);
      } catch {
        setEmpSearchResults([]);
      } finally {
        setSearchingEmps(false);
      }
    }, 300);
  };

  const selectEmployee = (emp: Employee) => {
    if (!empSearchKey) return;
    const [type, idxStr] = empSearchKey.split("-");
    const idx = parseInt(idxStr);
    if (type === "cppt") {
      updateCPPT(idx, "staff_name", emp.nama_lengkap);
    } else if (type === "fb") {
      updateFluidBalance(idx, "staff_name", emp.nama_lengkap);
    }
    setEmpSearchKey(null);
    setEmpSearchTerm("");
    setEmpSearchResults([]);
  };

  // ── Expanded order items (for collapsible parameter rows) ──
  const [expandedOrderItems, setExpandedOrderItems] = useState<
    Record<string, boolean>
  >({});
  const toggleOrderItem = (globalIdx: number, itemIdx: number) => {
    const key = `${globalIdx}-${itemIdx}`;
    setExpandedOrderItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Expanded CPPT / Fluid Balance / Medicine rows ──
  const [expandedCPPT, setExpandedCPPT] = useState<Record<number, boolean>>({});
  const toggleCPPT = (idx: number) =>
    setExpandedCPPT((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const [expandedFB, setExpandedFB] = useState<Record<number, boolean>>({});
  const toggleFB = (idx: number) =>
    setExpandedFB((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const [expandedMed, setExpandedMed] = useState<Record<number, boolean>>({});
  const toggleMed = (idx: number) =>
    setExpandedMed((prev) => ({ ...prev, [idx]: !prev[idx] }));

  // ══════════════════════════════════════════════
  // Data population
  // ══════════════════════════════════════════════
  const populateFromRM = useCallback((rm: EKlaimRMDuplicate) => {
    setChiefComplaint(rm.chief_complaint || "");
    setHistoryOfPresentIllness(rm.history_of_present_illness || "");
    setPastMedicalHistory(rm.past_medical_history || "");
    setFamilyHistory(rm.family_history || "");
    setSocialHistory(rm.social_history || "");
    setAllergies(rm.allergies || "");
    setCurrentMedications(rm.current_medications || "");
    setReviewOfSystems(rm.review_of_systems || "");
    setGeneralCondition(rm.general_condition || "");
    setConsciousness(rm.consciousness || "");
    setBloodPressure(rm.blood_pressure || "");
    setSystolic(rm.systolic || 0);
    setDiastolic(rm.diastolic || 0);
    setHeartRate(rm.heart_rate || "");
    setRespiratoryRate(rm.respiratory_rate || "");
    setTemperature(rm.temperature || "");
    setOxygenSaturation(rm.oxygen_saturation || "");
    setWeight(rm.weight || "");
    setHeight(rm.height || "");
    setBmi(rm.bmi || 0);
    setWaist(rm.waist || "");
    setHeadCircum(rm.head_circum || "");
    setHeadNeck(rm.head_neck || "");
    setEyes(rm.eyes || "");
    setEnt(rm.ent || "");
    setThorax(rm.thorax || "");
    setCardiac(rm.cardiac || "");
    setPulmonary(rm.pulmonary || "");
    setAbdomen(rm.abdomen || "");
    setExtremities(rm.extremities || "");
    setNeurological(rm.neurological || "");
    setSkin(rm.skin || "");
    setHead(rm.head || "");
    setEars(rm.ears || "");
    setNose(rm.nose || "");
    setThroat(rm.throat || "");
    setNeck(rm.neck || "");
    setChest(rm.chest || "");
    setHeartExam(rm.heart || "");
    setLungs(rm.lungs || "");
    setMusculoskel(rm.musculoskel || "");
    setGenitourinary(rm.genitourinary || "");
    setOtherFindings(rm.other_findings || "");
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
    setMedicineItems(rm.medicine_items || []);
    setCpptNotes(rm.cppt_notes || []);
    setFluidBalances(rm.fluid_balances || []);
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
    if (rmDuplicate) populateFromRM(rmDuplicate);
  }, [rmDuplicate, populateFromRM]);

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
          filled: medicineItems.length > 0,
          count: medicineItems.length,
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
  const addDiagnosis = () => {
    setDiagnoses([
      ...diagnoses,
      {
        icd10_code: "",
        icd10_name: "",
        type: "secondary",
        sequence: diagnoses.length + 1,
      },
    ]);
    markDirty();
  };
  const removeDiagnosis = (i: number) => {
    setDiagnoses(diagnoses.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateDiagnosis = (i: number, updates: Partial<EKlaimRMDiagnosis>) => {
    setDiagnoses((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, ...updates } : d)),
    );
    markDirty();
  };

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
  const labOrders = ordersByType("laboratory");
  const radiologyOrders = ordersByType("radiology");
  const surgeryOrders = ordersByType("surgery");
  const consultationOrders = ordersByType("consultation");

  const updateOrder = (
    orderId: number | undefined,
    orderIndex: number,
    updates: Partial<EKlaimRMOrder>,
  ) => {
    setOrders((prev) => {
      const idx = orderId
        ? prev.findIndex((o) => o.id === orderId)
        : orderIndex;
      if (idx === -1) return prev;
      return prev.map((o, i) => (i === idx ? { ...o, ...updates } : o));
    });
    markDirty();
  };

  const removeOrder = (orderType: string, typeIndex: number) => {
    const typeOrders = orders.filter((o) => o.order_type === orderType);
    const target = typeOrders[typeIndex];
    if (!target) return;
    const globalIdx = orders.indexOf(target);
    setOrders((prev) => prev.filter((_, i) => i !== globalIdx));
    markDirty();
  };

  const addOrder = (orderType: string, isFake = false) => {
    const newOrder: EKlaimRMOrder = {
      order_type: orderType as EKlaimRMOrder["order_type"],
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
      sequence: orders.length + 1,
    };
    setOrders((prev) => [...prev, newOrder]);
    markDirty();
  };

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

  const updateOrderItemResult = (
    orderGlobalIdx: number,
    itemIdx: number,
    resultIdx: number,
    updates: Partial<EKlaimRMOrderResult>,
  ) => {
    setOrders((prev) =>
      prev.map((o, oi) =>
        oi === orderGlobalIdx
          ? {
              ...o,
              items: (o.items || []).map((item, ii) =>
                ii === itemIdx
                  ? {
                      ...item,
                      results: (item.results || []).map((r, ri) =>
                        ri === resultIdx ? { ...r, ...updates } : r,
                      ),
                    }
                  : item,
              ),
            }
          : o,
      ),
    );
    markDirty();
  };

  const removeOrderItem = (globalOrderIdx: number, itemIdx: number) => {
    setOrders((prev) =>
      prev.map((o, i) =>
        i === globalOrderIdx
          ? { ...o, items: (o.items || []).filter((_, ii) => ii !== itemIdx) }
          : o,
      ),
    );
    markDirty();
  };

  // ── Procedure Search ──
  const orderTypeToProc = (orderType: string): ProcedureType | undefined => {
    if (orderType === "laboratory") return "laboratory";
    if (orderType === "radiology") return "radiology";
    return "medical";
  };

  const handleProcSearch = (term: string, orderType: string) => {
    setProcSearchTerm(term);
    if (procSearchTimeout.current) clearTimeout(procSearchTimeout.current);
    if (!term || term.length < 2) {
      setProcSearchResults([]);
      return;
    }
    procSearchTimeout.current = setTimeout(async () => {
      setSearchingProcs(true);
      try {
        const procType = orderTypeToProc(orderType);
        const res = await proceduresApi.getAll({
          search: term,
          procedure_type: procType,
          is_active: true,
          ...(orderType === "surgery" ? { is_surgical: true } : {}),
        });
        setProcSearchResults(res.data?.data || []);
      } catch {
        setProcSearchResults([]);
      } finally {
        setSearchingProcs(false);
      }
    }, 300);
  };

  const handleSelectProcedure = async (
    globalOrderIdx: number,
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
      const newItem: EKlaimRMOrderItem = {
        procedure_id: procedure.id,
        procedure_name: procedure.name,
        procedure: {
          id: procedure.id,
          name: procedure.name,
          code: procedure.code,
        },
        notes: "",
        results,
        sequence: (orders[globalOrderIdx]?.items?.length || 0) + 1,
      };
      setOrders((prev) =>
        prev.map((o, i) =>
          i === globalOrderIdx
            ? { ...o, items: [...(o.items || []), newItem] }
            : o,
        ),
      );
      markDirty();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat parameter tindakan.",
      });
    } finally {
      setLoadingParams(false);
      setAddingItemToOrder(null);
      setProcSearchTerm("");
      setProcSearchResults([]);
    }
  };

  // ── Medicine Search ──
  const handleMedSearch = (term: string) => {
    setMedSearchTerm(term);
    if (medSearchTimeout.current) clearTimeout(medSearchTimeout.current);
    if (!term || term.length < 2) {
      setMedSearchResults([]);
      return;
    }
    medSearchTimeout.current = setTimeout(async () => {
      setSearchingMeds(true);
      try {
        const res = await medicinesApi.getAll({
          search: term,
          is_active: true,
        });
        setMedSearchResults(res.data?.data || res.data || []);
      } catch {
        setMedSearchResults([]);
      } finally {
        setSearchingMeds(false);
      }
    }, 300);
  };

  const handleSelectMedicine = (medicine: Medicine) => {
    const newItem: EKlaimRMMedicineItem = {
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      dosage: medicine.dosage || "",
      frequency: "",
      route: "oral",
      quantity: 1,
      unit: medicine.unit || "tablet",
      duration: "",
      instructions: "",
      unit_price: medicine.selling_price || 0,
      sub_total: medicine.selling_price || 0,
      is_fake: true,
      notes: "",
      sequence: medicineItems.length + 1,
    };
    setMedicineItems((prev) => [...prev, newItem]);
    markDirty();
    setMedSearchTerm("");
    setMedSearchResults([]);
  };

  // ── Medicine CRUD ──
  const removeMedicineItem = (i: number) => {
    setMedicineItems(medicineItems.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateMedicineItem = (
    i: number,
    field: keyof EKlaimRMMedicineItem,
    value: any,
  ) => {
    setMedicineItems((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    );
    markDirty();
  };

  // ── CPPT CRUD ──
  const addCPPT = (isFake = false) => {
    setCpptNotes([
      ...cpptNotes,
      {
        record_date: "",
        profession: "dokter",
        staff_name: "",
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        instruction: "",
        is_fake: isFake,
        notes: "",
        sequence: cpptNotes.length + 1,
      },
    ]);
    markDirty();
  };
  const removeCPPT = (i: number) => {
    setCpptNotes(cpptNotes.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateCPPT = (i: number, field: keyof EKlaimRMCPPT, value: any) => {
    setCpptNotes((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    );
    markDirty();
  };

  // ── Fluid Balance CRUD ──
  const addFluidBalance = (isFake = false) => {
    setFluidBalances([
      ...fluidBalances,
      {
        record_date: "",
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
        is_fake: isFake,
        notes: "",
        sequence: fluidBalances.length + 1,
      },
    ]);
    markDirty();
  };
  const removeFluidBalance = (i: number) => {
    setFluidBalances(fluidBalances.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateFluidBalance = (
    i: number,
    field: keyof EKlaimRMFluidBalance,
    value: any,
  ) => {
    setFluidBalances((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)),
    );
    markDirty();
  };

  // ── Save ──
  const handleSave = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
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
        head_neck: headNeck,
        eyes,
        ent,
        thorax,
        cardiac,
        pulmonary,
        abdomen,
        extremities,
        neurological,
        skin,
        head,
        ears,
        nose,
        throat,
        neck,
        chest,
        heart: heartExam,
        lungs,
        musculoskel,
        genitourinary,
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
        diagnoses,
        procedures,
        orders: orders.map((o) => {
          let fakeDate: string | undefined = undefined;
          if (o.fake_date) {
            const d = new Date(o.fake_date);
            fakeDate = isNaN(d.getTime()) ? undefined : d.toISOString();
          }
          let scheduledDate: string | undefined = undefined;
          if (o.scheduled_date) {
            const d = new Date(o.scheduled_date as string);
            scheduledDate = isNaN(d.getTime()) ? undefined : d.toISOString();
          }
          return { ...o, fake_date: fakeDate, scheduled_date: scheduledDate };
        }),
        medicine_items: medicineItems,
        cppt_notes: cpptNotes,
        fluid_balances: fluidBalances,
        tarif_prosedur_non_bedah: tarifProsedurNonBedah,
        tarif_prosedur_bedah: tarifProsedurBedah,
        tarif_konsultasi: tarifKonsultasi,
        tarif_tenaga_ahli: tarifTenagaAhli,
        tarif_keperawatan: tarifKeperawatan,
        tarif_penunjang: tarifPenunjang,
        tarif_radiologi: tarifRadiologi,
        tarif_laboratorium: tarifLaboratorium,
        tarif_pelayanan_darah: tarifPelayananDarah,
        tarif_rehabilitasi: tarifRehabilitasi,
        tarif_kamar: tarifKamar,
        tarif_rawat_intensif: tarifRawatIntensif,
        tarif_obat: tarifObat,
        tarif_obat_kronis: tarifObatKronis,
        tarif_obat_kemoterapi: tarifObatKemoterapi,
        tarif_alkes: tarifAlkes,
        tarif_bmhp: tarifBMHP,
        tarif_sewa_alat: tarifSewaAlat,

        // Inpatient-specific fields
        admission_date: admissionDate,
        discharge_date: dischargeDate,
        length_of_stay: lengthOfStay,
        accommodation_tariff_per_day: accommodationTariffPerDay,

        // Triage UGD
        has_triage: !!(rmDuplicate?.has_triage),
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
      });
      setDirty(false);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data RM duplikat berhasil disimpan.",
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: err?.response?.data?.error || "Gagal menyimpan data RM.",
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

  // ══════════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════════

  const renderParamInput = (
    result: EKlaimRMOrderResult,
    onChange: (updates: Partial<EKlaimRMOrderResult>) => void,
  ) => {
    const param = result.procedure_parameter;
    const inputType = param?.input_type || "text";
    switch (inputType) {
      case "number":
        return (
          <Input
            type="number"
            className="h-8 text-xs"
            value={result.value}
            step={
              param?.decimal_places ? Math.pow(10, -param.decimal_places) : 1
            }
            onChange={(e) => {
              const val = e.target.value;
              const numVal = parseFloat(val) || 0;
              const updates: Partial<EKlaimRMOrderResult> = {
                value: val,
                numeric_value: numVal,
              };
              // Reset all flags first
              updates.is_low = false;
              updates.is_high = false;
              updates.is_normal = false;
              updates.is_critical = false;
              if (!val || val.trim() === "") {
                // Empty value — no status
                onChange(updates);
                return;
              }
              const hasNormalRange =
                param?.normal_min != null &&
                param?.normal_max != null &&
                (param.normal_min !== 0 || param.normal_max !== 0);
              if (hasNormalRange) {
                updates.is_low = numVal < param!.normal_min!;
                updates.is_high = numVal > param!.normal_max!;
                updates.is_normal =
                  numVal >= param!.normal_min! && numVal <= param!.normal_max!;
              }
              const hasCriticalMin =
                param?.critical_min != null && param.critical_min !== 0;
              const hasCriticalMax =
                param?.critical_max != null && param.critical_max !== 0;
              if (hasCriticalMin && numVal < param!.critical_min!)
                updates.is_critical = true;
              else if (hasCriticalMax && numVal > param!.critical_max!)
                updates.is_critical = true;
              onChange(updates);
            }}
            placeholder="Nilai"
          />
        );
      case "textarea":
        return (
          <Textarea
            className="text-xs min-h-[56px]"
            value={result.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Isi hasil..."
            rows={2}
          />
        );
      case "select": {
        const options = (param?.options || "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
        return (
          <Select
            value={result.value}
            onValueChange={(v) => onChange({ value: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={
                result.value === "true" ||
                result.value === "1" ||
                result.value === "ya" ||
                result.value === "positif"
              }
              onCheckedChange={(checked) =>
                onChange({ value: checked ? "positif" : "negatif" })
              }
            />
            <span className="text-xs text-muted-foreground">
              {result.value || "-"}
            </span>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            className="h-8 text-xs"
            value={result.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        );
      case "datetime":
        return (
          <Input
            type="datetime-local"
            className="h-8 text-xs"
            value={result.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        );
      default:
        return (
          <Input
            className="h-8 text-xs"
            value={result.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Nilai"
          />
        );
    }
  };

  const renderProcedureSearch = (globalOrderIdx: number, orderType: string) => {
    const hasItems = (orders[globalOrderIdx]?.items || []).length > 0;
    return (
      <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
        {!hasItems && (
          <p className="text-xs text-muted-foreground">
            Pilih tindakan — parameter akan otomatis dimuat dari master tindakan
          </p>
        )}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            className="h-8 text-xs flex-1"
            placeholder="Cari tindakan / prosedur..."
            value={addingItemToOrder === globalOrderIdx ? procSearchTerm : ""}
            onChange={(e) => {
              setAddingItemToOrder(globalOrderIdx);
              handleProcSearch(e.target.value, orderType);
            }}
            autoFocus={addingItemToOrder === globalOrderIdx}
          />
          {hasItems && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                setAddingItemToOrder(null);
                setProcSearchTerm("");
                setProcSearchResults([]);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {addingItemToOrder === globalOrderIdx && loadingParams && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Memuat parameter...
          </div>
        )}
        {addingItemToOrder === globalOrderIdx && searchingProcs && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Mencari...
          </div>
        )}
        {addingItemToOrder === globalOrderIdx &&
          !searchingProcs &&
          procSearchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded bg-white divide-y">
              {procSearchResults.map((proc) => (
                <button
                  key={proc.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectProcedure(globalOrderIdx, proc)}
                  disabled={loadingParams}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{proc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {proc.code}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {proc.procedure_type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        {addingItemToOrder === globalOrderIdx &&
          !searchingProcs &&
          procSearchTerm.length >= 2 &&
          procSearchResults.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Tidak ada tindakan ditemukan.
            </p>
          )}
      </div>
    );
  };

  const renderOrderItems = (
    order: EKlaimRMOrder,
    globalIdx: number,
  ): React.ReactNode[] => {
    if (!order.items || order.items.length === 0) return [];
    const rows: React.ReactNode[] = [];
    order.items.forEach((item, itemIdx) => {
      const key = `${globalIdx}-${itemIdx}`;
      const isExpanded = expandedOrderItems[key] ?? false;
      const paramCount = (item.results || []).length;
      const filledCount = (item.results || []).filter(
        (r) => r.value && r.value.trim() !== "",
      ).length;
      // Item summary row
      rows.push(
        <TableRow
          key={`item-${key}`}
          className="cursor-pointer hover:bg-muted/50 text-xs"
          onClick={() => toggleOrderItem(globalIdx, itemIdx)}
        >
          <TableCell className="px-3" />
          <TableCell className="px-3 font-medium w-10">{itemIdx + 1}</TableCell>
          <TableCell className="px-3">
            <div className="flex items-center gap-1.5">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium">
                {item.procedure_name || `Tindakan #${itemIdx + 1}`}
              </span>
            </div>
          </TableCell>
          <TableCell className="px-3 text-center text-muted-foreground">
            {paramCount > 0 ? `${filledCount}/${paramCount}` : "-"}
          </TableCell>
          <TableCell className="px-3 text-center">
            {paramCount > 0 && filledCount === paramCount ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
            ) : paramCount > 0 && filledCount > 0 ? (
              <span className="text-[10px] text-amber-600 font-medium">
                Partial
              </span>
            ) : null}
          </TableCell>
          <TableCell className="px-3 text-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                removeOrderItem(globalIdx, itemIdx);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </TableCell>
        </TableRow>,
      );
      // Expanded parameter rows
      if (isExpanded && paramCount > 0) {
        // Parameter sub-header
        rows.push(
          <TableRow key={`paramhdr-${key}`} className="text-[11px] bg-muted/30">
            <TableCell className="px-3" />
            <TableCell className="px-3" />
            <TableCell className="px-3 font-medium text-muted-foreground">
              Parameter
            </TableCell>
            <TableCell className="px-3 font-medium text-muted-foreground text-center">
              Nilai
            </TableCell>
            <TableCell className="px-3 font-medium text-muted-foreground text-center">
              Nilai Normal
            </TableCell>
            <TableCell className="px-3 font-medium text-muted-foreground text-center">
              Status
            </TableCell>
          </TableRow>,
        );
        (item.results || []).forEach((result, resIdx) => {
          const param = result.procedure_parameter;
          const unit = param?.unit || "";
          const normalRange =
            param?.normal_text ||
            (param?.normal_min != null && param?.normal_max != null
              ? `${param.normal_min} - ${param.normal_max}`
              : "");
          const isWide = (param?.input_type || "text") === "textarea";
          if (isWide) {
            rows.push(
              <TableRow key={`param-${key}-${resIdx}`} className="text-xs">
                <TableCell className="px-3" />
                <TableCell className="px-3" />
                <TableCell colSpan={4} className="px-3 py-1.5 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground font-medium">
                      {result.parameter_name}
                    </span>
                    {param?.is_required && (
                      <span className="text-red-500 text-[10px]">*</span>
                    )}
                  </div>
                  {renderParamInput(result, (updates) =>
                    updateOrderItemResult(globalIdx, itemIdx, resIdx, updates),
                  )}
                </TableCell>
              </TableRow>,
            );
          } else {
            rows.push(
              <TableRow key={`param-${key}-${resIdx}`} className="text-xs">
                <TableCell className="px-3" />
                <TableCell className="px-3" />
                <TableCell
                  className="px-3 py-1.5 text-muted-foreground truncate"
                  title={result.parameter_name}
                >
                  {result.parameter_name}
                  {unit ? ` (${unit})` : ""}
                  {param?.is_required && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-1.5">
                  {renderParamInput(result, (updates) =>
                    updateOrderItemResult(globalIdx, itemIdx, resIdx, updates),
                  )}
                </TableCell>
                <TableCell className="px-3 py-1.5 text-muted-foreground text-center text-[11px]">
                  {normalRange}
                </TableCell>
                <TableCell className="px-3 py-1.5 text-center">
                  {result.value && result.value.trim() !== "" && (
                    <>
                      {result.is_low && (
                        <span className="text-blue-600 text-[10px] font-medium">
                          ↓ Rendah
                        </span>
                      )}
                      {result.is_high && (
                        <span className="text-red-600 text-[10px] font-medium">
                          ↑ Tinggi
                        </span>
                      )}
                      {result.is_critical && (
                        <span className="text-red-700 text-[10px] font-bold">
                          Kritis
                        </span>
                      )}
                      {result.is_normal &&
                        !result.is_low &&
                        !result.is_high &&
                        !result.is_critical && (
                          <span className="text-green-600 text-[10px]">
                            Normal
                          </span>
                        )}
                    </>
                  )}
                </TableCell>
              </TableRow>,
            );
          }
        });
      }
    });
    return rows;
  };

  // ── Generic order section renderer ──
  const renderOrderSection = (
    orderType: string,
    typeOrders: EKlaimRMOrder[],
    _accentBorder: string,
    _accentBg: string,
    _accentText: string,
    emptyText: string,
    extraFields?: (order: EKlaimRMOrder, globalIdx: number) => React.ReactNode,
  ) => (
    <div className="space-y-3">
      {typeOrders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="px-3 w-[60px]">Order</TableHead>
              <TableHead className="px-3 w-10">No</TableHead>
              <TableHead className="px-3">Nama Tindakan</TableHead>
              <TableHead className="px-3 w-[120px] text-center">
                Parameter
              </TableHead>
              <TableHead className="px-3 w-[120px] text-center">
                Status
              </TableHead>
              <TableHead className="px-3 w-[60px] text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typeOrders.map((order, typeIdx) => {
              const globalIdx = orders.indexOf(order);
              const itemRows = renderOrderItems(order, globalIdx);
              return (
                <Fragment key={typeIdx}>
                  {/* Order header row */}
                  <TableRow className="bg-muted/20 text-xs border-t-2">
                    <TableCell
                      className="px-3 font-semibold"
                      rowSpan={extraFields ? 2 : 1}
                    >
                      #{typeIdx + 1}
                    </TableCell>
                    <TableCell colSpan={4} className="px-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          {order.order_number || `Order #${typeIdx + 1}`}
                        </span>
                        {order.is_fake && (
                          <>
                            <Label className="text-xs text-muted-foreground">
                              Tanggal:
                            </Label>
                            <Input
                              type="datetime-local"
                              className="h-7 text-xs w-52"
                              value={(order.fake_date || "").slice(0, 16)}
                              onChange={(e) =>
                                updateOrder(order.id, globalIdx, {
                                  fake_date: e.target.value,
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 text-center">
                      {order.is_fake && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeOrder(orderType, typeIdx)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* Extra fields row (surgery/consultation metadata) */}
                  {extraFields && (
                    <TableRow className="text-xs">
                      <TableCell colSpan={5} className="px-3 py-2">
                        {extraFields(order, globalIdx)}
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Item rows (flat, no nesting) */}
                  {itemRows}
                  {/* Add procedure row */}
                  <TableRow className="text-xs">
                    <TableCell className="px-3" />
                    <TableCell colSpan={5} className="px-3 py-2">
                      {addingItemToOrder === globalIdx ||
                      (order.items || []).length === 0 ? (
                        renderProcedureSearch(globalIdx, orderType)
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:bg-muted/50"
                          onClick={() => {
                            setAddingItemToOrder(globalIdx);
                            setProcSearchTerm("");
                            setProcSearchResults([]);
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Tambah Tindakan
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );

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

  const isEmpty =
    !rmDuplicate.chief_complaint &&
    !rmDuplicate.history_of_present_illness &&
    !rmDuplicate.clinical_assessment &&
    diagnoses.length === 0 &&
    procedures.length === 0;

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Keluhan Utama</Label>
              <Textarea
                value={chiefComplaint}
                onChange={(e) => {
                  setChiefComplaint(e.target.value);
                  markDirty();
                }}
                placeholder="Keluhan utama pasien..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Riwayat Penyakit Sekarang</Label>
              <Textarea
                value={historyOfPresentIllness}
                onChange={(e) => {
                  setHistoryOfPresentIllness(e.target.value);
                  markDirty();
                }}
                placeholder="Riwayat penyakit sekarang..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Riwayat Penyakit Dahulu</Label>
              <Textarea
                value={pastMedicalHistory}
                onChange={(e) => {
                  setPastMedicalHistory(e.target.value);
                  markDirty();
                }}
                placeholder="Riwayat penyakit dahulu..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Riwayat Keluarga</Label>
              <Textarea
                value={familyHistory}
                onChange={(e) => {
                  setFamilyHistory(e.target.value);
                  markDirty();
                }}
                placeholder="Riwayat penyakit keluarga..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Riwayat Sosial</Label>
              <Textarea
                value={socialHistory}
                onChange={(e) => {
                  setSocialHistory(e.target.value);
                  markDirty();
                }}
                placeholder="Riwayat sosial pasien (merokok, alkohol, dll)..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Alergi</Label>
              <Textarea
                value={allergies}
                onChange={(e) => {
                  setAllergies(e.target.value);
                  markDirty();
                }}
                placeholder="Alergi obat/makanan/lainnya..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Obat yang Sedang Dikonsumsi</Label>
              <Textarea
                value={currentMedications}
                onChange={(e) => {
                  setCurrentMedications(e.target.value);
                  markDirty();
                }}
                placeholder="Daftar obat yang sedang dikonsumsi..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Review of Systems (ROS)</Label>
              <Textarea
                value={reviewOfSystems}
                onChange={(e) => {
                  setReviewOfSystems(e.target.value);
                  markDirty();
                }}
                placeholder="Review of Systems..."
                rows={2}
              />
            </div>
          </div>
        );

      // ─── PHYSICAL EXAM ───
      case "physical-exam":
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Tanda Vital
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sistolik (mmHg)</Label>
                  <Input
                    type="number"
                    value={systolic || ""}
                    onChange={(e) => {
                      setSystolic(Number(e.target.value));
                      markDirty();
                    }}
                    placeholder="120"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Diastolik (mmHg)</Label>
                  <Input
                    type="number"
                    value={diastolic || ""}
                    onChange={(e) => {
                      setDiastolic(Number(e.target.value));
                      markDirty();
                    }}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nadi (x/mnt)</Label>
                  <Input
                    value={heartRate}
                    onChange={(e) => {
                      setHeartRate(e.target.value);
                      markDirty();
                    }}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">RR (x/mnt)</Label>
                  <Input
                    value={respiratoryRate}
                    onChange={(e) => {
                      setRespiratoryRate(e.target.value);
                      markDirty();
                    }}
                    placeholder="20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Suhu (°C)</Label>
                  <Input
                    value={temperature}
                    onChange={(e) => {
                      setTemperature(e.target.value);
                      markDirty();
                    }}
                    placeholder="36.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SpO2 (%)</Label>
                  <Input
                    value={oxygenSaturation}
                    onChange={(e) => {
                      setOxygenSaturation(e.target.value);
                      markDirty();
                    }}
                    placeholder="98"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">BB (kg)</Label>
                  <Input
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value);
                      markDirty();
                    }}
                    placeholder="60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">TB (cm)</Label>
                  <Input
                    value={height}
                    onChange={(e) => {
                      setHeight(e.target.value);
                      markDirty();
                    }}
                    placeholder="165"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lingkar Pinggang (cm)</Label>
                  <Input
                    value={waist}
                    onChange={(e) => {
                      setWaist(e.target.value);
                      markDirty();
                    }}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lingkar Kepala (cm)</Label>
                  <Input
                    value={headCircum}
                    onChange={(e) => {
                      setHeadCircum(e.target.value);
                      markDirty();
                    }}
                    placeholder="Pediatrik"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-6 p-2 rounded bg-muted/30 text-xs">
                <span>
                  TD:{" "}
                  <span className="font-mono font-semibold">
                    {bloodPressure || "-"}
                  </span>{" "}
                  mmHg
                </span>
                <span>
                  BMI:{" "}
                  <span className="font-mono font-semibold">{bmi || "-"}</span>
                </span>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Keadaan Umum
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Keadaan Umum</Label>
                  <Input
                    value={generalCondition}
                    onChange={(e) => {
                      setGeneralCondition(e.target.value);
                      markDirty();
                    }}
                    placeholder="Baik / Sedang / Buruk"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kesadaran</Label>
                  <Select
                    value={consciousness}
                    onValueChange={(v) => {
                      setConsciousness(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kesadaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Compos Mentis">
                        Compos Mentis
                      </SelectItem>
                      <SelectItem value="Apatis">Apatis</SelectItem>
                      <SelectItem value="Delirium">Delirium</SelectItem>
                      <SelectItem value="Somnolen">Somnolen</SelectItem>
                      <SelectItem value="Stupor">Stupor</SelectItem>
                      <SelectItem value="Semi Coma">Semi Coma</SelectItem>
                      <SelectItem value="Coma">Coma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Pemeriksaan Sistem Organ
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kepala</Label>
                  <Textarea
                    value={head}
                    onChange={(e) => {
                      setHead(e.target.value);
                      markDirty();
                    }}
                    placeholder="Normosefali, rambut hitam, distribusi merata"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mata</Label>
                  <Textarea
                    value={eyes}
                    onChange={(e) => {
                      setEyes(e.target.value);
                      markDirty();
                    }}
                    placeholder="Konjungtiva anemis -/-, Sklera ikterik -/-"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telinga</Label>
                  <Textarea
                    value={ears}
                    onChange={(e) => {
                      setEars(e.target.value);
                      markDirty();
                    }}
                    placeholder="Dalam batas normal"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hidung</Label>
                  <Textarea
                    value={nose}
                    onChange={(e) => {
                      setNose(e.target.value);
                      markDirty();
                    }}
                    placeholder="Napas cuping hidung (-), sekret (-)"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tenggorokan</Label>
                  <Textarea
                    value={throat}
                    onChange={(e) => {
                      setThroat(e.target.value);
                      markDirty();
                    }}
                    placeholder="Faring hiperemis (-), tonsil T1/T1"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Leher</Label>
                  <Textarea
                    value={neck}
                    onChange={(e) => {
                      setNeck(e.target.value);
                      markDirty();
                    }}
                    placeholder="JVP tidak meningkat, KGB tidak teraba"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dada</Label>
                  <Textarea
                    value={chest}
                    onChange={(e) => {
                      setChest(e.target.value);
                      markDirty();
                    }}
                    placeholder="Simetris, gerak napas simetris"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jantung</Label>
                  <Textarea
                    value={heartExam}
                    onChange={(e) => {
                      setHeartExam(e.target.value);
                      markDirty();
                    }}
                    placeholder="BJ I/II reguler, murmur (-), gallop (-)"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paru</Label>
                  <Textarea
                    value={lungs}
                    onChange={(e) => {
                      setLungs(e.target.value);
                      markDirty();
                    }}
                    placeholder="Vesikuler +/+, ronkhi -/-, wheezing -/-"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Abdomen</Label>
                  <Textarea
                    value={abdomen}
                    onChange={(e) => {
                      setAbdomen(e.target.value);
                      markDirty();
                    }}
                    placeholder="Supel, BU (+) normal, nyeri tekan (-)"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ekstremitas</Label>
                  <Textarea
                    value={extremities}
                    onChange={(e) => {
                      setExtremities(e.target.value);
                      markDirty();
                    }}
                    placeholder="Akral hangat, edema -/-, CRT < 2 detik"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Neurologis</Label>
                  <Textarea
                    value={neurological}
                    onChange={(e) => {
                      setNeurological(e.target.value);
                      markDirty();
                    }}
                    placeholder="Refleks fisiologis +/+, refleks patologis -/-"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Muskuloskeletal</Label>
                  <Textarea
                    value={musculoskel}
                    onChange={(e) => {
                      setMusculoskel(e.target.value);
                      markDirty();
                    }}
                    placeholder="ROM dalam batas normal, deformitas (-)"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Genitourinari</Label>
                  <Textarea
                    value={genitourinary}
                    onChange={(e) => {
                      setGenitourinary(e.target.value);
                      markDirty();
                    }}
                    placeholder="Dalam batas normal"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kulit</Label>
                  <Textarea
                    value={skin}
                    onChange={(e) => {
                      setSkin(e.target.value);
                      markDirty();
                    }}
                    placeholder="Warna sawo matang, turgor baik, lesi (-)"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temuan Lain</Label>
                  <Textarea
                    value={otherFindings}
                    onChange={(e) => {
                      setOtherFindings(e.target.value);
                      markDirty();
                    }}
                    placeholder="Temuan pemeriksaan fisik lainnya..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Pemeriksaan Penunjang - EKG
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 md:col-span-2">
                  <Switch
                    checked={ecgPerformed}
                    onCheckedChange={(v) => {
                      setEcgPerformed(v);
                      markDirty();
                    }}
                  />
                  <Label className="text-xs">EKG Dilakukan</Label>
                </div>
                {ecgPerformed && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Interpretasi</Label>
                      <Select
                        value={ecgInterpretation}
                        onValueChange={(v) => {
                          setEcgInterpretation(v);
                          markDirty();
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih interpretasi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Abnormal">Abnormal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hasil EKG</Label>
                      <Textarea
                        value={ecgResult}
                        onChange={(e) => {
                          setEcgResult(e.target.value);
                          markDirty();
                        }}
                        placeholder="Deskripsi hasil EKG..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Catatan EKG</Label>
                      <Textarea
                        value={ecgNotes}
                        onChange={(e) => {
                          setEcgNotes(e.target.value);
                          markDirty();
                        }}
                        placeholder="Catatan detail EKG..."
                        rows={2}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Legacy Fields (Kepala & Leher, THT, Thorax, dll)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Field gabungan lama. Isi jika diperlukan untuk kompatibilitas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kepala & Leher</Label>
                  <Textarea
                    value={headNeck}
                    onChange={(e) => {
                      setHeadNeck(e.target.value);
                      markDirty();
                    }}
                    placeholder="Dalam batas normal"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">THT</Label>
                  <Textarea
                    value={ent}
                    onChange={(e) => {
                      setEnt(e.target.value);
                      markDirty();
                    }}
                    placeholder="Dalam batas normal"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Thorax</Label>
                  <Textarea
                    value={thorax}
                    onChange={(e) => {
                      setThorax(e.target.value);
                      markDirty();
                    }}
                    placeholder="Simetris, gerak napas simetris"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jantung (legacy)</Label>
                  <Textarea
                    value={cardiac}
                    onChange={(e) => {
                      setCardiac(e.target.value);
                      markDirty();
                    }}
                    placeholder="BJ I/II reguler"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paru (legacy)</Label>
                  <Textarea
                    value={pulmonary}
                    onChange={(e) => {
                      setPulmonary(e.target.value);
                      markDirty();
                    }}
                    placeholder="Vesikuler +/+"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      // ─── DIAGNOSES ───
      case "diagnoses":
        return (
          <div className="space-y-3">
            {diagnoses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">
                  Belum ada diagnosa. Klik tombol di atas untuk menambahkan.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {diagnoses.map((d, i) => (
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
                            Diagnosa (ICD-10)
                          </Label>
                          <ICD10Combobox
                            value={d.icd10_code}
                            onChange={(code, display) =>
                              updateDiagnosis(i, {
                                icd10_code: code,
                                icd10_name: display,
                              })
                            }
                            placeholder="Cari diagnosa ICD-10..."
                          />
                        </div>
                        <div className="w-[160px]">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Tipe
                          </Label>
                          <Select
                            value={d.type}
                            onValueChange={(v) =>
                              updateDiagnosis(i, {
                                type: v as EKlaimRMDiagnosis["type"],
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primer</SelectItem>
                              <SelectItem value="secondary">
                                Sekunder
                              </SelectItem>
                              <SelectItem value="complication">
                                Komplikasi
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 mt-5 shrink-0"
                          onClick={() => removeDiagnosis(i)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {d.icd10_name && (
                        <p className="text-xs text-muted-foreground pl-1">
                          {d.icd10_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        return renderOrderSection(
          "laboratory",
          labOrders,
          "border-border",
          "",
          "",
          "Belum ada order laboratorium.",
        );

      // ─── RADIOLOGY ORDERS ───
      case "radiology-orders":
        return renderOrderSection(
          "radiology",
          radiologyOrders,
          "border-border",
          "",
          "",
          "Belum ada order radiologi.",
        );

      // ─── SURGERY ORDERS ───
      case "surgery-orders":
        return renderOrderSection(
          "surgery",
          surgeryOrders,
          "border-border",
          "",
          "",
          "Belum ada catatan operasi.",
          (order, globalIdx) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b">
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Input
                  className="h-8 text-xs"
                  value={order.surgeon_name}
                  onChange={(e) =>
                    updateOrder(order.id, globalIdx, {
                      surgeon_name: e.target.value,
                    })
                  }
                  placeholder="dr. ..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jenis Anestesi</Label>
                <Select
                  value={order.anesthesia_type}
                  onValueChange={(v) =>
                    updateOrder(order.id, globalIdx, { anesthesia_type: v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Anesthesia</SelectItem>
                    <SelectItem value="regional">
                      Regional Anesthesia
                    </SelectItem>
                    <SelectItem value="spinal">Spinal Anesthesia</SelectItem>
                    <SelectItem value="local">Local Anesthesia</SelectItem>
                    <SelectItem value="sedation">Sedasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Jadwal</Label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={(order.scheduled_date || "").slice(0, 16)}
                  onChange={(e) =>
                    updateOrder(order.id, globalIdx, {
                      scheduled_date: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          ),
        );

      // ─── CONSULTATION ORDERS ───
      case "consultation-orders":
        return renderOrderSection(
          "consultation",
          consultationOrders,
          "border-border",
          "",
          "",
          "Belum ada konsultasi.",
          (order, globalIdx) => (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b">
              <div className="space-y-1">
                <Label className="text-xs">Nama Konsultan</Label>
                <Input
                  className="h-8 text-xs"
                  value={order.consultant_name}
                  onChange={(e) =>
                    updateOrder(order.id, globalIdx, {
                      consultant_name: e.target.value,
                    })
                  }
                  placeholder="dr. Spesialis..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Spesialisasi</Label>
                <Input
                  className="h-8 text-xs"
                  value={order.specialty}
                  onChange={(e) =>
                    updateOrder(order.id, globalIdx, {
                      specialty: e.target.value,
                    })
                  }
                  placeholder="Sp. Penyakit Dalam"
                />
              </div>
            </div>
          ),
        );

      // ─── MEDICINES ───
      case "medicines":
        return (
          <div className="space-y-3">
            <div className="relative max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 pr-10"
                  placeholder="Cari obat untuk ditambahkan..."
                  value={medSearchTerm}
                  onChange={(e) => handleMedSearch(e.target.value)}
                />
                {medSearchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => {
                      setMedSearchTerm("");
                      setMedSearchResults([]);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {(searchingMeds || medSearchResults.length > 0) && (
                <div className="absolute z-50 w-full mt-1 border rounded-md bg-background shadow-lg">
                  {searchingMeds && (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Mencari obat...</span>
                    </div>
                  )}
                  {!searchingMeds && medSearchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto">
                      {medSearchResults.map((med) => (
                        <button
                          key={med.id}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => handleSelectMedicine(med)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {med.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {med.dosage}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-nowrap">
                              {formatCurrency(med.selling_price || 0)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!searchingMeds &&
                    medSearchTerm.length >= 2 &&
                    medSearchResults.length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                        Tidak ditemukan obat dengan kata kunci "{medSearchTerm}"
                      </div>
                    )}
                </div>
              )}
            </div>
            {medicineItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Belum ada data obat.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="px-3 w-10">No</TableHead>
                    <TableHead className="px-3">Nama Obat</TableHead>
                    <TableHead className="px-3">Dosis</TableHead>
                    <TableHead className="px-3">Frekuensi</TableHead>
                    <TableHead className="px-3 text-center">Jumlah</TableHead>
                    <TableHead className="px-3 text-right">Subtotal</TableHead>
                    <TableHead className="px-3 w-12 text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicineItems.map((med, i) => {
                    const isOpen = expandedMed[i] ?? false;
                    return (
                      <Fragment key={i}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 text-xs"
                          onClick={() => toggleMed(i)}
                        >
                          <TableCell className="px-3 font-medium">
                            {i + 1}
                          </TableCell>
                          <TableCell className="px-3">
                            <div className="flex items-center gap-1.5">
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium">
                                {med.medicine_name || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">
                            {med.dosage || "-"}
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">
                            {med.frequency || "-"}
                          </TableCell>
                          <TableCell className="px-3 text-center font-mono">
                            {med.quantity} {med.unit}
                          </TableCell>
                          <TableCell className="px-3 text-right font-mono font-semibold">
                            {formatCurrency(med.sub_total || 0)}
                          </TableCell>
                          <TableCell className="px-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMedicineItem(i);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell className="px-3" />
                            <TableCell colSpan={6} className="px-3 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Nama Obat</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.medicine_name}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "medicine_name",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Nama obat..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Dosis</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.dosage}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "dosage",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="500mg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Frekuensi</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.frequency}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "frequency",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="3x1"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Rute</Label>
                                  <Select
                                    value={med.route}
                                    onValueChange={(v) =>
                                      updateMedicineItem(i, "route", v)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="oral">Oral</SelectItem>
                                      <SelectItem value="iv">IV</SelectItem>
                                      <SelectItem value="im">IM</SelectItem>
                                      <SelectItem value="sc">SC</SelectItem>
                                      <SelectItem value="topical">
                                        Topikal
                                      </SelectItem>
                                      <SelectItem value="inhaler">
                                        Inhaler
                                      </SelectItem>
                                      <SelectItem value="rectal">
                                        Rektal
                                      </SelectItem>
                                      <SelectItem value="sublingual">
                                        Sublingual
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Jumlah</Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    value={med.quantity}
                                    onChange={(e) => {
                                      const q = Number(e.target.value);
                                      updateMedicineItem(i, "quantity", q);
                                      updateMedicineItem(
                                        i,
                                        "sub_total",
                                        q * med.unit_price,
                                      );
                                    }}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Satuan</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.unit}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "unit",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="tablet"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Durasi</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.duration}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "duration",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="7 hari"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Harga Satuan
                                  </Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    value={med.unit_price}
                                    onChange={(e) => {
                                      const p = Number(e.target.value);
                                      updateMedicineItem(i, "unit_price", p);
                                      updateMedicineItem(
                                        i,
                                        "sub_total",
                                        med.quantity * p,
                                      );
                                    }}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label className="text-xs">Instruksi</Label>
                                  <Input
                                    className="h-8 text-xs"
                                    value={med.instructions}
                                    onChange={(e) =>
                                      updateMedicineItem(
                                        i,
                                        "instructions",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Setelah makan, dll..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Subtotal</Label>
                                  <Input
                                    className="h-8 text-xs bg-muted font-mono font-semibold"
                                    value={formatCurrency(med.sub_total || 0)}
                                    readOnly
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        );

      // ─── ASSESSMENT & PLAN ───
      case "assessment":
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Penilaian & Prognosis
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Penilaian Klinis</Label>
                  <Textarea
                    value={clinicalAssessment}
                    onChange={(e) => {
                      setClinicalAssessment(e.target.value);
                      markDirty();
                    }}
                    placeholder="Penilaian klinis terhadap kondisi pasien..."
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prognosis</Label>
                  <Select
                    value={prognosis}
                    onValueChange={(v) => {
                      setPrognosis(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih prognosis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bonam">Bonam (Baik)</SelectItem>
                      <SelectItem value="Dubia ad Bonam">
                        Dubia ad Bonam
                      </SelectItem>
                      <SelectItem value="Dubia ad Malam">
                        Dubia ad Malam
                      </SelectItem>
                      <SelectItem value="Malam">Malam (Buruk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Rencana (Plan)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rencana Terapi</Label>
                  <Textarea
                    value={treatmentPlan}
                    onChange={(e) => {
                      setTreatmentPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Rencana terapi dan tindakan..."
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Obat</Label>
                  <Textarea
                    value={medicationPlan}
                    onChange={(e) => {
                      setMedicationPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Rencana pemberian obat..."
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Diet</Label>
                  <Textarea
                    value={dietPlan}
                    onChange={(e) => {
                      setDietPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Diet biasa / lunak / cair / rendah garam..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Aktivitas</Label>
                  <Textarea
                    value={activityPlan}
                    onChange={(e) => {
                      setActivityPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Bedrest / mobilisasi bertahap..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Edukasi</Label>
                  <Textarea
                    value={educationPlan}
                    onChange={(e) => {
                      setEducationPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Edukasi pasien & keluarga..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Monitoring</Label>
                  <Textarea
                    value={monitoringPlan}
                    onChange={(e) => {
                      setMonitoringPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Monitoring TTV / lab / klinis..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Tindakan / Prosedur</Label>
                  <Textarea
                    value={procedurePlan}
                    onChange={(e) => {
                      setProcedurePlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Rencana tindakan / operasi..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rencana Konsultasi</Label>
                  <Textarea
                    value={consultationPlan}
                    onChange={(e) => {
                      setConsultationPlan(e.target.value);
                      markDirty();
                    }}
                    placeholder="Konsul ke spesialis / departemen lain..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      // ─── TRIAGE UGD ───
      case "triage":
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Informasi Kedatangan
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Cara Datang</Label>
                  <Combobox
                    options={getTriageOptions('arrival_mode')}
                    value={triageArrivalMode}
                    onValueChange={(v) => { setTriageArrivalMode(v); markDirty(); }}
                    placeholder="Pilih moda kedatangan"
                    searchPlaceholder="Cari moda kedatangan..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Keluhan Triage</Label>
                  <Input
                    value={triageComplaint}
                    onChange={(e) => { setTriageComplaint(e.target.value); markDirty(); }}
                    placeholder="Keluhan utama triage..."
                  />
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <Label>Level Triage</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {getTriageOptions('triage_level').map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => { setTriageLevel(level.value); markDirty(); }}
                      className={`p-3 rounded-lg border-2 text-white font-medium text-sm transition-all ${
                        triageLevel === level.value
                          ? `${triageLevelColors[level.value] || "bg-gray-500"} border-white scale-105`
                          : `${triageLevelColors[level.value] || "bg-gray-500"} opacity-60 border-transparent hover:opacity-80`
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
                {triageLevel && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dipilih: <span className="font-medium">{getTriageOptions('triage_level').find(l => l.value === triageLevel)?.label || triageLevel}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Penilaian ABC
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Airway</Label>
                  <Combobox
                    options={getTriageOptions('airway_status')}
                    value={triageAirway}
                    onValueChange={(v) => { setTriageAirway(v); markDirty(); }}
                    placeholder="Pilih status airway"
                    searchPlaceholder="Cari..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Catatan Airway</Label>
                  <Input
                    value={triageAirwayNote}
                    onChange={(e) => { setTriageAirwayNote(e.target.value); markDirty(); }}
                    placeholder="Catatan airway..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Breathing</Label>
                  <Combobox
                    options={getTriageOptions('breathing_status')}
                    value={triageBreathing}
                    onValueChange={(v) => { setTriageBreathing(v); markDirty(); }}
                    placeholder="Pilih status breathing"
                    searchPlaceholder="Cari..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Catatan Breathing</Label>
                  <Input
                    value={triageBreathingNote}
                    onChange={(e) => { setTriageBreathingNote(e.target.value); markDirty(); }}
                    placeholder="Catatan breathing..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Circulation</Label>
                  <Combobox
                    options={getTriageOptions('circulation_status')}
                    value={triageCirculation}
                    onValueChange={(v) => { setTriageCirculation(v); markDirty(); }}
                    placeholder="Pilih status circulation"
                    searchPlaceholder="Cari..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Catatan Circulation</Label>
                  <Input
                    value={triageCirculationNote}
                    onChange={(e) => { setTriageCirculationNote(e.target.value); markDirty(); }}
                    placeholder="Catatan circulation..."
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Tanda Vital
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Tekanan Darah</Label>
                  <Input
                    value={triageBloodPressure}
                    onChange={(e) => { setTriageBloodPressure(e.target.value); markDirty(); }}
                    placeholder="120/80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nadi (x/mnt)</Label>
                  <Input
                    value={triageHeartRate}
                    onChange={(e) => { setTriageHeartRate(e.target.value); markDirty(); }}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>RR (x/mnt)</Label>
                  <Input
                    value={triageRespiratoryRate}
                    onChange={(e) => { setTriageRespiratoryRate(e.target.value); markDirty(); }}
                    placeholder="20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Suhu (°C)</Label>
                  <Input
                    value={triageTemperature}
                    onChange={(e) => { setTriageTemperature(e.target.value); markDirty(); }}
                    placeholder="36.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SpO2 (%)</Label>
                  <Input
                    value={triageOxygenSat}
                    onChange={(e) => { setTriageOxygenSat(e.target.value); markDirty(); }}
                    placeholder="98"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Skala Nyeri (0-10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={triagePainScale}
                    onChange={(e) => { setTriagePainScale(parseInt(e.target.value) || 0); markDirty(); }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                GCS
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>GCS Eye (E)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={triageGCSE}
                    onChange={(e) => { setTriageGCSE(parseInt(e.target.value) || 4); markDirty(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GCS Verbal (V)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={triageGCSV}
                    onChange={(e) => { setTriageGCSV(parseInt(e.target.value) || 5); markDirty(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GCS Motor (M)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={triageGCSM}
                    onChange={(e) => { setTriageGCSM(parseInt(e.target.value) || 6); markDirty(); }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total GCS: {triageGCSE + triageGCSV + triageGCSM}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Assesment & Tindakan
              </h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Penilaian Triage</Label>
                  <Textarea
                    value={triageAssessment}
                    onChange={(e) => { setTriageAssessment(e.target.value); markDirty(); }}
                    placeholder="Penilaian klinis triage..."
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tindakan Segera</Label>
                  <Textarea
                    value={triageImmediateAction}
                    onChange={(e) => { setTriageImmediateAction(e.target.value); markDirty(); }}
                    placeholder="Tindakan yang sudah dilakukan..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      // ─── DISPOSITION ───
      case "disposition":
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Status Disposisi
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipe Disposisi</Label>
                  <Select
                    value={dispositionType}
                    onValueChange={(v) => {
                      setDispositionType(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih disposisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pulang">Dipulangkan</SelectItem>
                      <SelectItem value="rujuk">Dirujuk / Transfer</SelectItem>
                      <SelectItem value="rawat_inap">Rawat Inap</SelectItem>
                      <SelectItem value="aps">Pulang Paksa (APS)</SelectItem>
                      <SelectItem value="meninggal">Meninggal</SelectItem>
                      <SelectItem value="dod">
                        Pulang Atas Permintaan Sendiri (DOD)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status Pulang</Label>
                  <Select
                    value={rmDischargeStatus}
                    onValueChange={(v) => {
                      setRmDischargeStatus(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sembuh">Sembuh</SelectItem>
                      <SelectItem value="membaik">Membaik</SelectItem>
                      <SelectItem value="belum_sembuh">Belum Sembuh</SelectItem>
                      <SelectItem value="meninggal">Meninggal</SelectItem>
                      <SelectItem value="pulang_paksa">Pulang Paksa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kondisi Saat Pulang</Label>
                  <Textarea
                    value={dischargeCondition}
                    onChange={(e) => {
                      setDischargeCondition(e.target.value);
                      markDirty();
                    }}
                    placeholder="Kondisi pasien saat dipulangkan..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan Disposisi</Label>
                  <Textarea
                    value={dispositionNote}
                    onChange={(e) => {
                      setDispositionNote(e.target.value);
                      markDirty();
                    }}
                    placeholder="Catatan tambahan disposisi..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Instruksi Pulang & Follow-up
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Instruksi Pulang</Label>
                  <Textarea
                    value={dischargeInstruction}
                    onChange={(e) => {
                      setDischargeInstruction(e.target.value);
                      markDirty();
                    }}
                    placeholder="Instruksi untuk pasien setelah pulang..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instruksi Follow-up</Label>
                  <Textarea
                    value={followUpInstruction}
                    onChange={(e) => {
                      setFollowUpInstruction(e.target.value);
                      markDirty();
                    }}
                    placeholder="Jadwal kontrol / rencana tindak lanjut..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal Follow-up</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => {
                      setFollowUpDate(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Obat Pulang</Label>
                  <Textarea
                    value={dischargeMedication}
                    onChange={(e) => {
                      setDischargeMedication(e.target.value);
                      markDirty();
                    }}
                    placeholder="Daftar obat yang dibawa pulang..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
            {dispositionType === "rujuk" && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Informasi Rujukan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Fasilitas Rujukan</Label>
                      <Input
                        value={referralFacility}
                        onChange={(e) => {
                          setReferralFacility(e.target.value);
                          markDirty();
                        }}
                        placeholder="Nama RS / faskes tujuan"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Alasan Rujukan</Label>
                      <Input
                        value={referralReason}
                        onChange={(e) => {
                          setReferralReason(e.target.value);
                          markDirty();
                        }}
                        placeholder="Alasan dirujuk"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Diagnosis Rujukan</Label>
                      <Textarea
                        value={referralDiagnosis}
                        onChange={(e) => {
                          setReferralDiagnosis(e.target.value);
                          markDirty();
                        }}
                        placeholder="Diagnosis saat dirujuk..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Terapi yang Sudah Diberikan</Label>
                      <Textarea
                        value={referralTherapy}
                        onChange={(e) => {
                          setReferralTherapy(e.target.value);
                          markDirty();
                        }}
                        placeholder="Terapi di faskes pengirim..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Catatan Rujukan</Label>
                      <Textarea
                        value={referralNotes}
                        onChange={(e) => {
                          setReferralNotes(e.target.value);
                          markDirty();
                        }}
                        placeholder="Catatan tambahan untuk faskes tujuan..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {(dispositionType === "meninggal" || dispositionType === "dod") && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Informasi Kematian
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Waktu Meninggal</Label>
                      <Input
                        type="datetime-local"
                        value={deathTime}
                        onChange={(e) => {
                          setDeathTime(e.target.value);
                          markDirty();
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Penyebab Kematian</Label>
                      <Textarea
                        value={deathCause}
                        onChange={(e) => {
                          setDeathCause(e.target.value);
                          markDirty();
                        }}
                        placeholder="Penyebab kematian..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      // ─── CPPT ───
      case "cppt":
        return (
          <div className="space-y-3">
            {cpptNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Belum ada catatan CPPT.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="px-3 w-10">No</TableHead>
                    <TableHead className="px-3">Tanggal</TableHead>
                    <TableHead className="px-3">Profesi</TableHead>
                    <TableHead className="px-3">Petugas</TableHead>
                    <TableHead className="px-3">Ringkasan</TableHead>
                    <TableHead className="px-3 w-12 text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpptNotes.map((cppt, i) => {
                    const isOpen = expandedCPPT[i] ?? false;
                    const summary = [
                      cppt.subjective,
                      cppt.objective,
                      cppt.assessment,
                      cppt.plan,
                    ]
                      .filter(Boolean)
                      .join(" | ");
                    return (
                      <Fragment key={i}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 text-xs"
                          onClick={() => toggleCPPT(i)}
                        >
                          <TableCell className="px-3 font-medium">
                            {i + 1}
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">
                            {cppt.record_date
                              ? new Date(cppt.record_date).toLocaleString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 capitalize">
                            {cppt.profession || "-"}
                          </TableCell>
                          <TableCell className="px-3">
                            {cppt.staff_name || "-"}
                          </TableCell>
                          <TableCell className="px-3">
                            <div className="flex items-center gap-1.5">
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-muted-foreground truncate max-w-[400px]">
                                {summary || "Belum diisi"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCPPT(i);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell className="px-3" />
                            <TableCell colSpan={5} className="px-3 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Tanggal</Label>
                                  <Input
                                    type="datetime-local"
                                    className="h-8 text-xs"
                                    value={cppt.record_date}
                                    onChange={(e) =>
                                      updateCPPT(
                                        i,
                                        "record_date",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Profesi</Label>
                                  <Select
                                    value={cppt.profession}
                                    onValueChange={(v) =>
                                      updateCPPT(i, "profession", v)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="dokter">
                                        Dokter
                                      </SelectItem>
                                      <SelectItem value="perawat">
                                        Perawat
                                      </SelectItem>
                                      <SelectItem value="farmasi">
                                        Farmasi
                                      </SelectItem>
                                      <SelectItem value="gizi">Gizi</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1 md:col-span-2 relative">
                                  <Label className="text-xs">
                                    Nama Petugas
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      className="h-8 text-xs flex-1"
                                      value={cppt.staff_name}
                                      onChange={(e) =>
                                        updateCPPT(
                                          i,
                                          "staff_name",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Nama petugas..."
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 shrink-0"
                                      onClick={() => {
                                        setEmpSearchKey(
                                          empSearchKey === `cppt-${i}`
                                            ? null
                                            : `cppt-${i}`,
                                        );
                                        setEmpSearchTerm("");
                                        setEmpSearchResults([]);
                                      }}
                                    >
                                      <Search className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  {empSearchKey === `cppt-${i}` && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg p-2 space-y-1">
                                      <Input
                                        className="h-7 text-xs"
                                        autoFocus
                                        placeholder="Cari karyawan..."
                                        value={empSearchTerm}
                                        onChange={(e) =>
                                          handleEmpSearch(e.target.value)
                                        }
                                      />
                                      {searchingEmps && (
                                        <p className="text-xs text-muted-foreground py-1 px-2">
                                          Mencari...
                                        </p>
                                      )}
                                      {empSearchResults.length > 0 && (
                                        <div className="max-h-40 overflow-y-auto">
                                          {empSearchResults.map((emp) => (
                                            <button
                                              key={emp.id}
                                              type="button"
                                              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex justify-between"
                                              onClick={() =>
                                                selectEmployee(emp)
                                              }
                                            >
                                              <span className="font-medium">
                                                {emp.nama_lengkap}
                                              </span>
                                              <span className="text-muted-foreground">
                                                {emp.jabatan ||
                                                  emp.tipe_karyawan}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      {empSearchTerm.length >= 2 &&
                                        !searchingEmps &&
                                        empSearchResults.length === 0 && (
                                          <p className="text-xs text-muted-foreground py-1 px-2">
                                            Tidak ditemukan
                                          </p>
                                        )}
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Subjective</Label>
                                  <Textarea
                                    className="text-xs"
                                    value={cppt.subjective}
                                    onChange={(e) =>
                                      updateCPPT(
                                        i,
                                        "subjective",
                                        e.target.value,
                                      )
                                    }
                                    rows={2}
                                    placeholder="Keluhan pasien..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Objective</Label>
                                  <Textarea
                                    className="text-xs"
                                    value={cppt.objective}
                                    onChange={(e) =>
                                      updateCPPT(i, "objective", e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Temuan pemeriksaan..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Assessment</Label>
                                  <Textarea
                                    className="text-xs"
                                    value={cppt.assessment}
                                    onChange={(e) =>
                                      updateCPPT(
                                        i,
                                        "assessment",
                                        e.target.value,
                                      )
                                    }
                                    rows={2}
                                    placeholder="Penilaian..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Plan</Label>
                                  <Textarea
                                    className="text-xs"
                                    value={cppt.plan}
                                    onChange={(e) =>
                                      updateCPPT(i, "plan", e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Rencana..."
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label className="text-xs">Instruksi</Label>
                                  <Textarea
                                    className="text-xs"
                                    value={cppt.instruction}
                                    onChange={(e) =>
                                      updateCPPT(
                                        i,
                                        "instruction",
                                        e.target.value,
                                      )
                                    }
                                    rows={2}
                                    placeholder="Instruksi keperawatan..."
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        );

      // ─── FLUID BALANCE ───
      case "fluid-balance":
        return (
          <div className="space-y-3">
            {fluidBalances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Belum ada data balance cairan.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="px-3 w-10">No</TableHead>
                    <TableHead className="px-3">Tanggal</TableHead>
                    <TableHead className="px-3">Shift</TableHead>
                    <TableHead className="px-3">Petugas</TableHead>
                    <TableHead className="px-3 text-center">Intake</TableHead>
                    <TableHead className="px-3 text-center">Output</TableHead>
                    <TableHead className="px-3 text-center">Balance</TableHead>
                    <TableHead className="px-3 w-12 text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluidBalances.map((fb, i) => {
                    const isOpen = expandedFB[i] ?? false;
                    const intake =
                      (fb.oral_drink || 0) +
                      (fb.oral_food || 0) +
                      (fb.oral_medicine || 0) +
                      (fb.iv_fluid || 0) +
                      (fb.iv_medicine || 0) +
                      (fb.blood_product || 0) +
                      (fb.enteral_feed || 0) +
                      (fb.other_intake || 0);
                    const output =
                      (fb.urine_amount || 0) +
                      (fb.feces_amount || 0) +
                      (fb.vomit_amount || 0) +
                      (fb.drain_amount || 0) +
                      (fb.blood_loss || 0) +
                      (fb.iwl || 0) +
                      (fb.other_output || 0);
                    const balance = intake - output;
                    return (
                      <Fragment key={i}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 text-xs"
                          onClick={() => toggleFB(i)}
                        >
                          <TableCell className="px-3 font-medium">
                            {i + 1}
                          </TableCell>
                          <TableCell className="px-3 text-muted-foreground">
                            {fb.record_date
                              ? new Date(fb.record_date).toLocaleString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 capitalize">
                            {fb.shift_type || "-"}
                          </TableCell>
                          <TableCell className="px-3">
                            {fb.staff_name || "-"}
                          </TableCell>
                          <TableCell className="px-3 text-center font-mono font-semibold text-green-700">
                            {intake} ml
                          </TableCell>
                          <TableCell className="px-3 text-center font-mono font-semibold text-red-700">
                            {output} ml
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-3 text-center font-mono font-semibold",
                              balance >= 0 ? "text-green-700" : "text-red-700",
                            )}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {balance > 0 ? "+" : ""}
                              {balance} ml
                            </div>
                          </TableCell>
                          <TableCell className="px-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFluidBalance(i);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell className="px-3" />
                            <TableCell colSpan={7} className="px-3 py-3">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Tanggal</Label>
                                    <Input
                                      type="datetime-local"
                                      className="h-8 text-xs"
                                      value={fb.record_date}
                                      onChange={(e) =>
                                        updateFluidBalance(
                                          i,
                                          "record_date",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Shift</Label>
                                    <Select
                                      value={fb.shift_type}
                                      onValueChange={(v) =>
                                        updateFluidBalance(i, "shift_type", v)
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pagi">
                                          Pagi
                                        </SelectItem>
                                        <SelectItem value="siang">
                                          Siang
                                        </SelectItem>
                                        <SelectItem value="malam">
                                          Malam
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1 relative">
                                    <Label className="text-xs">
                                      Nama Petugas
                                    </Label>
                                    <div className="flex gap-2">
                                      <Input
                                        className="h-8 text-xs flex-1"
                                        value={fb.staff_name}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "staff_name",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Nama petugas..."
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        onClick={() => {
                                          setEmpSearchKey(
                                            empSearchKey === `fb-${i}`
                                              ? null
                                              : `fb-${i}`,
                                          );
                                          setEmpSearchTerm("");
                                          setEmpSearchResults([]);
                                        }}
                                      >
                                        <Search className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    {empSearchKey === `fb-${i}` && (
                                      <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg p-2 space-y-1">
                                        <Input
                                          className="h-7 text-xs"
                                          autoFocus
                                          placeholder="Cari karyawan..."
                                          value={empSearchTerm}
                                          onChange={(e) =>
                                            handleEmpSearch(e.target.value)
                                          }
                                        />
                                        {searchingEmps && (
                                          <p className="text-xs text-muted-foreground py-1 px-2">
                                            Mencari...
                                          </p>
                                        )}
                                        {empSearchResults.length > 0 && (
                                          <div className="max-h-40 overflow-y-auto">
                                            {empSearchResults.map((emp) => (
                                              <button
                                                key={emp.id}
                                                type="button"
                                                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex justify-between"
                                                onClick={() =>
                                                  selectEmployee(emp)
                                                }
                                              >
                                                <span className="font-medium">
                                                  {emp.nama_lengkap}
                                                </span>
                                                <span className="text-muted-foreground">
                                                  {emp.jabatan ||
                                                    emp.tipe_karyawan}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {empSearchTerm.length >= 2 &&
                                          !searchingEmps &&
                                          empSearchResults.length === 0 && (
                                            <p className="text-xs text-muted-foreground py-1 px-2">
                                              Tidak ditemukan
                                            </p>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h5 className="text-xs font-semibold mb-2">
                                    Intake (ml)
                                  </h5>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Minum
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.oral_drink || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "oral_drink",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Makan
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.oral_food || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "oral_food",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Obat Oral
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.oral_medicine || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "oral_medicine",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Infus
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.iv_fluid || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "iv_fluid",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Obat IV
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.iv_medicine || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "iv_medicine",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Darah
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.blood_product || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "blood_product",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Enteral
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.enteral_feed || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "enteral_feed",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Lain-lain
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.other_intake || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "other_intake",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <h5 className="text-xs font-semibold mb-2">
                                    Output (ml)
                                  </h5>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Urine
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.urine_amount || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "urine_amount",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Feses
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.feces_amount || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "feces_amount",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Muntah
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.vomit_amount || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "vomit_amount",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Drain
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.drain_amount || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "drain_amount",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Perdarahan
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.blood_loss || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "blood_loss",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">IWL</Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.iwl || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "iwl",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">
                                        Lain-lain
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        value={fb.other_output || ""}
                                        onChange={(e) =>
                                          updateFluidBalance(
                                            i,
                                            "other_output",
                                            Number(e.target.value),
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
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

                {/* Preview Mapping Button */}
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMappingModal(true)}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Preview Mapping ke Tarif E-Klaim
                  </Button>
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
  const activeSectionDef = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="space-y-3">
      {/* Sync bar */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {isEmpty ? "RM Duplikat masih kosong" : "Sinkronisasi Data"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEmpty
              ? "Tarik data dari kunjungan untuk mengisi RM Duplikat."
              : "Tarik ulang data dari kunjungan. Data yang sudah diedit akan ditimpa."}
          </p>
        </div>
        <Button
          variant={isEmpty ? "default" : "outline"}
          size="sm"
          onClick={handleSyncFromVisit}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync dari Kunjungan
        </Button>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Sidebar navigation */}
        <div className="w-52 shrink-0 space-y-0.5 border-r pr-3">
          {SECTIONS.filter((section) => {
            // Only show triage if has_triage flag is set
            if (section.id === "triage") {
              return !!(rmDuplicate?.has_triage);
            }
            return true;
          }).map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const status = sectionStatus(section.id);
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 truncate text-xs">{section.label}</span>
                {status.count != null && status.count > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center text-[10px] px-1"
                  >
                    {status.count}
                  </Badge>
                )}
                {status.count == null && status.filled && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                )}
                {isActive && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Section header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <activeSectionDef.icon className="h-5 w-5 text-foreground" />
              <h3 className="text-base font-semibold">
                {activeSectionDef.label}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {activeSection === "diagnoses" && (
                <Button variant="outline" size="sm" onClick={addDiagnosis}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                </Button>
              )}
              {activeSection === "procedures" && (
                <Button variant="outline" size="sm" onClick={addProcedure}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                </Button>
              )}
              {activeSection === "lab-orders" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOrder("laboratory", true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Order
                </Button>
              )}
              {activeSection === "radiology-orders" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOrder("radiology", true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Order
                </Button>
              )}
              {activeSection === "surgery-orders" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOrder("surgery", true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Order
                </Button>
              )}
              {activeSection === "consultation-orders" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOrder("consultation", true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Order
                </Button>
              )}
              {activeSection === "cppt" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCPPT(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                </Button>
              )}
              {activeSection === "fluid-balance" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addFluidBalance(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                </Button>
              )}
              {activeSection === "billing" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateBilling}
                  disabled={syncing}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Hitung Ulang
                </Button>
              )}
            </div>
          </div>

          {/* Section content */}
          {renderSectionContent()}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          {dirty
            ? "Ada perubahan yang belum disimpan"
            : "Semua perubahan tersimpan"}
        </p>
        <Button onClick={handleSave} disabled={!dirty || submitting} size="lg">
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Simpan
        </Button>
      </div>

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
