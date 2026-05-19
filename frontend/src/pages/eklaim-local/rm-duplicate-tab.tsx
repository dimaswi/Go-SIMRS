import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, X, ArrowLeft, Download, Loader2, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setCasemixContext } from "@/lib/api/client";
import { eklaimLocalApi } from "@/lib/api/eklaim-local";
import { medicalRecordsApi } from "@/lib/api/medical-records";
import {
  cpptApi,
  fallRiskApi,
  fluidBalanceApi,
  nursingCareApi,
  o2UsageApi,
  visitProceduresApi,
} from "@/lib/api";
import { emitMedicalRecordTabSaved } from "@/components/medical-record/tab-indicator";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { TriageForm } from "@/components/medical-record/triage-form";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { SurgeryWorkstation } from "../../components/medical-record/surgery-workstation";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { FallRiskForm } from "@/components/medical-record/fall-risk-form";
import { O2UsageForm } from "@/components/medical-record/o2-usage-form";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { BodyMarkerForm } from "@/components/medical-record/body-marker-form";
import { DischargePlanningForm } from "@/components/medical-record/discharge-planning-form";
import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { SurgeryOrderForm } from "@/components/medical-record/surgery-order-form";

const importableTabLabels: Record<string, string> = {
  triage: "Triase",
  anamnesis: "Anamnesis",
  "physical-exam": "Pemeriksaan Fisik",
  "body-marker": "Marker Tubuh",
  diagnosis: "Diagnosis",
  "assessment-plan": "Assessment & Plan",
  "prescription-edit": "Edit Farmasi",
  procedure: "Tindakan",
  cppt: "CPPT",
  "nursing-care": "Asuhan Keperawatan",
  "fall-risk": "Risiko Jatuh",
  "o2-usage": "Oksigen",
  "fluid-balance": "Balance Cairan",
  "discharge-planning": "Discharge Planning",
};

const normalizeDiagnosisImport = (diagnoses: any[]) => ({
  items: diagnoses.map((item) => ({
    icd10_code: item.icd10_code || "",
    icd10_name: item.icd10_name || "",
    diagnosis_type: item.diagnosis_type || (item.type === "primary" ? "primary" : "secondary"),
    clinical_status: item.clinical_status || "active",
    verification_status: item.verification_status || "confirmed",
    severity: item.severity || "",
    body_site: item.body_site || "",
    onset_date: item.onset_date || "",
    differential_diagnosis: item.differential_diagnosis || "",
    note: item.note || "",
  })),
});

const pickOriginalTabData = (originalRM: any, tabId: string) => {
  switch (tabId) {
    case "triage":
      return originalRM?.triage;
    case "anamnesis":
      return originalRM?.anamnesis;
    case "physical-exam":
      return originalRM?.physical_examination;
    case "body-marker":
      return Array.isArray(originalRM?.body_marker?.items) && originalRM.body_marker.items.length > 0 ? originalRM.body_marker : null;
    case "diagnosis":
      return Array.isArray(originalRM?.diagnoses) && originalRM.diagnoses.length > 0
        ? normalizeDiagnosisImport(originalRM.diagnoses)
        : null;
    case "assessment-plan":
      return originalRM?.assessment_plan;
    case "discharge-planning":
      return Array.isArray(originalRM?.discharge_planning?.items) && originalRM.discharge_planning.items.length > 0 ? originalRM.discharge_planning : null;
    case "procedure":
      return Array.isArray(originalRM?.visit_procedures) && originalRM.visit_procedures.length > 0 ? originalRM.visit_procedures : null;
    case "prescription-edit":
      return Array.isArray(originalRM?.medicine_orders) && originalRM.medicine_orders.length > 0 ? originalRM.medicine_orders : null;
    case "cppt":
      return Array.isArray(originalRM?.cppts) && originalRM.cppts.length > 0 ? originalRM.cppts : null;
    case "nursing-care":
      return Array.isArray(originalRM?.nursing_cares) && originalRM.nursing_cares.length > 0 ? originalRM.nursing_cares : null;
    case "fall-risk":
      return Array.isArray(originalRM?.fall_risks) && originalRM.fall_risks.length > 0 ? originalRM.fall_risks : null;
    case "o2-usage":
      return Array.isArray(originalRM?.o2_usages) && originalRM.o2_usages.length > 0 ? originalRM.o2_usages : null;
    case "fluid-balance":
      return Array.isArray(originalRM?.fluid_balances) && originalRM.fluid_balances.length > 0 ? originalRM.fluid_balances : null;
    default:
      return null;
  }
};

const toRecordDate = (value: any) => value || new Date().toISOString();
const cpptPayload = (item: any) => ({
  record_date: toRecordDate(item.record_date),
  profession: item.profession || "dokter",
  cppt_format: item.cppt_format || "soap",
  subjective: item.subjective || "",
  objective: item.objective || "",
  assessment: item.assessment || "",
  plan: item.plan || "",
  instruction: item.instruction || "",
  blood_pressure: item.blood_pressure || "",
  heart_rate: Number(item.heart_rate || 0),
  respiratory_rate: Number(item.respiratory_rate || 0),
  temperature: item.temperature || "",
  oxygen_saturation: Number(item.oxygen_saturation || 0),
  pain_scale: Number(item.pain_scale || 0),
});
const nursingPayload = (item: any) => ({
  record_date: toRecordDate(item.record_date),
  shift_type: item.shift_type || "",
  chief_complaint: item.chief_complaint || "",
  pain_assessment: item.pain_assessment || "",
  pain_scale: Number(item.pain_scale || 0),
  consciousness_level: item.consciousness_level || "",
  functional_status: item.functional_status || "",
  fall_risk_assessment: item.fall_risk_assessment || "",
  fall_risk_score: Number(item.fall_risk_score || 0),
  nutrition_assessment: item.nutrition_assessment || "",
  skin_assessment: item.skin_assessment || "",
  pressure_ulcer_risk: item.pressure_ulcer_risk || "",
  blood_pressure: item.blood_pressure || "",
  heart_rate: Number(item.heart_rate || 0),
  respiratory_rate: Number(item.respiratory_rate || 0),
  temperature: item.temperature || "",
  oxygen_saturation: Number(item.oxygen_saturation || 0),
  nursing_diagnosis: item.nursing_diagnosis || "",
  nursing_diagnosis_code: item.nursing_diagnosis_code || "",
  nursing_outcome: item.nursing_outcome || "",
  nursing_intervention: item.nursing_intervention || "",
  implementation: item.implementation || "",
  patient_response: item.patient_response || "",
  notes: item.notes || "",
});
const fluidPayload = (item: any) => ({
  record_date: toRecordDate(item.record_date),
  shift_type: item.shift_type || "pagi",
  oral_drink: Number(item.oral_drink || 0),
  oral_food: Number(item.oral_food || 0),
  oral_medicine: Number(item.oral_medicine || 0),
  iv_fluid: Number(item.iv_fluid || 0),
  iv_medicine: Number(item.iv_medicine || 0),
  blood_product: Number(item.blood_product || 0),
  enteral_feed: Number(item.enteral_feed || 0),
  other_intake: Number(item.other_intake || 0),
  other_intake_note: item.other_intake_note || "",
  urine_amount: Number(item.urine_amount || 0),
  urine_color: item.urine_color || "",
  urine_catheter: Boolean(item.urine_catheter),
  feces_amount: Number(item.feces_amount || 0),
  feces_freq: Number(item.feces_freq || 0),
  feces_type: item.feces_type || "",
  vomit_amount: Number(item.vomit_amount || 0),
  vomit_freq: Number(item.vomit_freq || 0),
  drain_amount: Number(item.drain_amount || 0),
  drain_type: item.drain_type || "",
  drain_color: item.drain_color || "",
  blood_loss: Number(item.blood_loss || 0),
  blood_loss_note: item.blood_loss_note || "",
  iwl: Number(item.iwl || 0),
  other_output: Number(item.other_output || 0),
  other_output_note: item.other_output_note || "",
  notes: item.notes || "",
});

interface RMDuplicateTabProps {
  eklaimId: number;
  visit?: any;
  onSaved: () => void;
  stickyTopOffset?: number;
}

export function RMDuplicateTab({
  eklaimId,
  visit,
  onSaved,
}: RMDuplicateTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("anamnesis");
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [pharmacySourceDialogOpen, setPharmacySourceDialogOpen] = useState(false);
  const [selectedOriginalPharmacyOrderId, setSelectedOriginalPharmacyOrderId] = useState<number | null>(null);
  const [pharmacyRefreshKey, setPharmacyRefreshKey] = useState(0);
  const [originalRMData, setOriginalRMData] = useState<any>({});
  const [frontendImportedData, setFrontendImportedData] = useState<Record<string, any>>({});

  const clearFrontendImportedTab = (tabId: string) => {
    setFrontendImportedData((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  useEffect(() => {
    // Set global casemix context so all medical record API calls
    // automatically append ?is_casemix=true & casemix_eklaim_id=eklaimId
    setCasemixContext(true, eklaimId);

    return () => {
      // Clear context on unmount
      setCasemixContext(false);
    };
  }, [eklaimId]);

  const triggerActiveTabSave = (): boolean => {
    if (!activeTab || !containerRef.current) return false;

    const activePane = containerRef.current.querySelector<HTMLElement>(`[data-mr-tab-pane="${activeTab}"]`);
    if (!activePane) return false;

    // Check for form submit
    const activeForm = activePane.querySelector<HTMLFormElement>("form");
    if (activeForm) {
      activeForm.requestSubmit();
      return true;
    }

    // Check for inline save button
    const INLINE_PRIMARY_ACTION_REGEX = /^(simpan|final|kirim|tambah|tambahkan|selesai|simpan (triage|anamnesis|pemeriksaan|diagnosa|assessment|disposisi|order|cppt|balance|asuhan))/i;
    const buttons = Array.from(activePane.querySelectorAll<HTMLButtonElement>("button"));
    const candidate = buttons.find((button) => {
      if (button.disabled) return false;
      const label = (button.textContent || "").trim().toLowerCase();
      return INLINE_PRIMARY_ACTION_REGEX.test(label);
    });

    if (candidate) {
      candidate.click();
      return true;
    }

    return false;
  };

  const handleSaveActiveTabFromFooter = () => {
    const importedData = frontendImportedData[activeTab];
    if (
      (Array.isArray(importedData) && importedData.length > 0) ||
      (["body-marker", "discharge-planning"].includes(activeTab) && Array.isArray(importedData?.items) && importedData.items.length > 0)
    ) {
      saveImportedOriginalTab(activeTab, importedData).catch((error: any) => {
        toast({
          title: "Gagal menyimpan data unduhan",
          description: error.response?.data?.error || "Data RM asli gagal disimpan ke RM duplicate.",
          variant: "destructive",
        });
      });
      return;
    }

    const saved = triggerActiveTabSave();
    if (!saved) {
      toast({
        title: "Simpan tidak tersedia",
        description: "Tab aktif tidak memiliki aksi simpan.",
        variant: "destructive",
      });
    }
  };

  const visitId = visit?.id || 0;
  const patientId = visit?.registration?.patient?.id || visit?.patient_id || 0;
  const activeTabLabel = importableTabLabels[activeTab] || activeTab;
  const canDownloadOriginalForActiveTab = Boolean(importableTabLabels[activeTab]);
  const canQuickAddPharmacy = activeTab === "prescription-edit" && visitId > 0;
  const originalPharmacyOrders = Array.isArray(originalRMData?.medicine_orders) ? originalRMData.medicine_orders : [];

  const handleSaveTriage = async (data: any) => {
    try {
      await medicalRecordsApi.saveTriage(visitId, data);
      clearFrontendImportedTab("triage");
      emitMedicalRecordTabSaved("triage", true);
      toast({ title: "Berhasil", description: "Data triase RM duplikat berhasil disimpan" });
      onSaved();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan triase RM duplikat" });
    }
  };

  const handleSaveAnamnesis = async (data: any) => {
    try {
      await medicalRecordsApi.saveAnamnesis(visitId, data);
      clearFrontendImportedTab("anamnesis");
      emitMedicalRecordTabSaved("anamnesis", true);
      toast({ title: "Berhasil", description: "Data anamnesis RM duplikat berhasil disimpan" });
      onSaved();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan anamnesis RM duplikat" });
    }
  };

  const handleSavePhysicalExam = async (data: any) => {
    try {
      await medicalRecordsApi.savePhysicalExam(visitId, data);
      clearFrontendImportedTab("physical-exam");
      emitMedicalRecordTabSaved("physical-exam", true);
      toast({ title: "Berhasil", description: "Data pemeriksaan fisik RM duplikat berhasil disimpan" });
      onSaved();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan pemeriksaan fisik RM duplikat" });
    }
  };

  const handleSaveDiagnosis = async (data: any) => {
    try {
      await medicalRecordsApi.saveDiagnosis(visitId, data);
      clearFrontendImportedTab("diagnosis");
      emitMedicalRecordTabSaved("diagnosis", true);
      toast({ title: "Berhasil", description: "Data diagnosis RM duplikat berhasil disimpan" });
      onSaved();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan diagnosis RM duplikat" });
    }
  };

  const handleSaveAssessmentPlan = async (data: any) => {
    try {
      await medicalRecordsApi.saveAssessmentPlan(visitId, data);
      clearFrontendImportedTab("assessment-plan");
      emitMedicalRecordTabSaved("assessment-plan", true);
      toast({ title: "Berhasil", description: "Data assessment & plan RM duplikat berhasil disimpan" });
      onSaved();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan assessment & plan RM duplikat" });
    }
  };

  const handleConfirmDownloadOriginal = async () => {
    if (!canDownloadOriginalForActiveTab) {
      toast({
        title: "Belum tersedia",
        description: `Unduh data RM asli untuk tab ${activeTabLabel} belum tersedia.`,
        variant: "destructive",
      });
      setDownloadConfirmOpen(false);
      return;
    }

    try {
      setDownloadingOriginal(true);
      setCasemixContext(false);

      if (activeTab === "prescription-edit") return;

      const response = await eklaimLocalApi.getDetail(eklaimId);
      const originalRM = response?.original_rm || {};
      setOriginalRMData(originalRM);
      const importedData = pickOriginalTabData(originalRM, activeTab);

      if (!importedData) {
        toast({
          title: "Data RM asli tidak ditemukan",
          description: `Tidak ada data ${activeTabLabel} pada rekam medis asli.`,
          variant: "destructive",
        });
        return;
      }

      setFrontendImportedData((prev) => ({
        ...prev,
        [activeTab]: Array.isArray(importedData) ? [...importedData] : { ...importedData, __imported_at: Date.now() },
      }));
      emitMedicalRecordTabSaved(activeTab, false);
      toast({
        title: "Data dimuat ke form",
        description: `Data ${activeTabLabel} dari RM asli sudah ditempel di layar. Tekan Simpan untuk menyimpan ke RM duplicate.`,
      });
    } catch (error: any) {
      toast({
        title: "Gagal mengunduh data RM asli",
        description: error.response?.data?.error || "Data RM asli gagal diambil.",
        variant: "destructive",
      });
    } finally {
      setCasemixContext(true, eklaimId);
      setDownloadingOriginal(false);
      setDownloadConfirmOpen(false);
    }
  };

  const handleDownloadOriginalClick = async () => {
    if (activeTab === "prescription-edit") {
      try {
        setDownloadingOriginal(true);
        setCasemixContext(false);
        const response = await eklaimLocalApi.getDetail(eklaimId);
        const sourceRM = response?.original_rm || {};
        setOriginalRMData(sourceRM);
        const sourceOrders = Array.isArray(sourceRM?.medicine_orders) ? sourceRM.medicine_orders : [];
        if (sourceOrders.length === 0) {
          toast({
            title: "Data farmasi asli kosong",
            description: "Belum ada order farmasi pada rekam medis asli untuk disalin.",
            variant: "destructive",
          });
          return;
        }
        setSelectedOriginalPharmacyOrderId(Number(sourceOrders[0]?.id || 0));
        setPharmacySourceDialogOpen(true);
        return;
      } catch (error: any) {
        toast({
          title: "Gagal mengambil data farmasi asli",
          description: error.response?.data?.error || "Data resep farmasi asli gagal dimuat.",
          variant: "destructive",
        });
      } finally {
        setCasemixContext(true, eklaimId);
        setDownloadingOriginal(false);
      }
      return;
    }
    setDownloadConfirmOpen(true);
  };

  const handleImportSinglePharmacyOrder = async () => {
    if (!selectedOriginalPharmacyOrderId || selectedOriginalPharmacyOrderId <= 0) {
      toast({ title: "Pilih resep dulu", description: "Pilih resep asli yang ingin diunduh.", variant: "destructive" });
      return;
    }
    try {
      setDownloadingOriginal(true);
      setCasemixContext(false);
      const syncRes = await eklaimLocalApi.syncPharmacyOrderFromVisit(eklaimId, selectedOriginalPharmacyOrderId);
      setPharmacyRefreshKey((prev) => prev + 1);
      emitMedicalRecordTabSaved("prescription-edit", true);
      toast({
        title: "Resep farmasi berhasil diunduh",
        description: syncRes?.message || "Resep farmasi asli berhasil ditambahkan ke mode casemix.",
      });
      setPharmacySourceDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Gagal mengunduh resep farmasi",
        description: error.response?.data?.error || "Resep farmasi asli gagal diambil.",
        variant: "destructive",
      });
    } finally {
      setCasemixContext(true, eklaimId);
      setDownloadingOriginal(false);
    }
  };

  const saveImportedOriginalTab = async (tabId: string, importedData: any) => {
    const list = Array.isArray(importedData) ? importedData : [];
    if (tabId === "body-marker") {
      const items = Array.isArray(importedData) ? importedData : importedData?.items;
      if (!Array.isArray(items) || items.length === 0) return false;
      await medicalRecordsApi.saveBodyMarkers(visitId, { items });
      clearFrontendImportedTab(tabId);
      emitMedicalRecordTabSaved(tabId, true);
      toast({ title: "Berhasil", description: `Data ${importableTabLabels[tabId]} berhasil disimpan ke RM duplicate.` });
      onSaved();
      return true;
    }
    if (tabId === "discharge-planning") {
      const items = Array.isArray(importedData) ? importedData : importedData?.items;
      if (!Array.isArray(items) || items.length === 0) return false;
      await medicalRecordsApi.saveDischargePlanning(visitId, { items });
      clearFrontendImportedTab(tabId);
      emitMedicalRecordTabSaved(tabId, true);
      toast({ title: "Berhasil", description: `Data ${importableTabLabels[tabId]} berhasil disimpan ke RM duplicate.` });
      onSaved();
      return true;
    }

    if (list.length === 0) return false;

    switch (tabId) {
      case "procedure": {
        const existing = await visitProceduresApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => visitProceduresApi.delete(visitId, item.id)));
        for (const item of list) {
          const created = await visitProceduresApi.create(visitId, {
            procedure_id: Number(item.procedure_id || item.procedure?.id || 0),
            notes: item.notes || "",
          });
          const createdId = created.data?.data?.id;
          if (createdId) {
            await visitProceduresApi.saveResults(visitId, createdId, {
              status: item.status || "completed",
              notes: item.notes || "",
              results: (item.results || []).map((result: any) => ({
                parameter_id: Number(result.parameter_id || result.parameter?.id || 0),
                value: result.value || "",
                num_value: Number(result.num_value || 0),
                is_abnormal: Boolean(result.is_abnormal),
                is_critical: Boolean(result.is_critical),
              })).filter((result: any) => result.parameter_id > 0),
            });
          }
        }
        break;
      }
      case "cppt": {
        const existing = await cpptApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => cpptApi.delete(visitId, item.id)));
        for (const item of list) await cpptApi.create(visitId, cpptPayload(item) as any);
        break;
      }
      case "nursing-care": {
        const existing = await nursingCareApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => nursingCareApi.delete(visitId, item.id)));
        for (const item of list) await nursingCareApi.create(visitId, nursingPayload(item) as any);
        break;
      }
      case "fluid-balance": {
        const existing = await fluidBalanceApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => fluidBalanceApi.delete(visitId, item.id)));
        for (const item of list) await fluidBalanceApi.create(visitId, fluidPayload(item) as any);
        break;
      }
      case "fall-risk": {
        const existing = await fallRiskApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => fallRiskApi.delete(visitId, item.id)));
        for (const item of list) {
          await fallRiskApi.create(visitId, {
            record_date: toRecordDate(item.record_date),
            scale_type: item.scale_type || "morse",
            items_json: item.items_json || "{}",
            total_score: Number(item.total_score || 0),
            risk_level: item.risk_level || "",
            risk_action: item.risk_action || "",
            notes: item.notes || "",
          });
        }
        break;
      }
      case "o2-usage": {
        const existing = await o2UsageApi.getAll(visitId);
        await Promise.all((existing.data?.data || []).map((item: any) => o2UsageApi.delete(visitId, item.id)));
        for (const item of list) {
          const created = await o2UsageApi.start(visitId, {
            tank_type: item.tank_type || "",
            flow_rate: Number(item.flow_rate || 0),
            delivery_method: item.delivery_method || "",
            started_at: item.started_at,
            base_price: Number(item.base_price || 0),
            notes: item.notes || "",
          });
          const createdId = created.data?.data?.id;
          if (createdId && item.stopped_at) {
            await o2UsageApi.stop(visitId, createdId, {
              stopped_at: item.stopped_at,
              base_price: Number(item.base_price || 0),
            });
          }
        }
        break;
      }
      default:
        return false;
    }

    clearFrontendImportedTab(tabId);
    emitMedicalRecordTabSaved(tabId, true);
    toast({ title: "Berhasil", description: `Data ${importableTabLabels[tabId]} berhasil disimpan ke RM duplicate.` });
    onSaved();
    return true;
  };

  // Derive flags exactly like visits/show.tsx
  const isEmergency = visit?.room?.service_type === "gawat_darurat";
  const isInpatient = visit?.room?.service_type === "rawat_inap";
  const isPharmacy = visit?.visit_type === "pharmacy";
  const isRadiology = visit?.visit_type === "radiology";
  const isLaboratory = visit?.visit_type === "lab";
  const isConsultation = visit?.visit_type === "consultation" && !!visit?.referral_from;
  const isSurgery = visit?.visit_type === "surgery";
  const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
  const showProcedureTab = allowedServiceTypes.includes(visit?.room?.service_type || "");
  const importedData = frontendImportedData[activeTab];
  const usesImportedData = Boolean(importedData);

  return (
    <>
    <div className="medical-record-workspace flex flex-1 min-h-0 flex-col" ref={containerRef}>
      <div className="mr-shell grid min-h-0 flex-1 gap-0 border xl:grid-cols-[minmax(240px,15%)_minmax(0,85%)] 2xl:grid-cols-[minmax(260px,15%)_minmax(0,85%)]">

        {/* LEFT SIDEBAR (Patient Info + Vertical Tabs) */}
        <aside className="mr-sidebar min-h-0 min-w-0 border-r">
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            {/* Patient Info Component identical to original RM */}
            <div className="min-h-[190px] shrink-0 basis-[30%] border-b">
              {visit && (
                <PatientInfo
                  visit={visit}
                  variant="compact"
                />
              )}
            </div>
            {/* Medical Record Tabs (Vertical layout) - same flags as visits/show.tsx */}
            <div className="min-h-0 flex-1 basis-[70%]">
              <MedicalRecordTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                layout="vertical"
                isEmergency={isEmergency}
                isInpatient={isInpatient}
                showProcedureTab={showProcedureTab}
                isLaboratory={isLaboratory}
                isRadiology={isRadiology}
                isSurgery={isSurgery}
                isPharmacy={isPharmacy}
                isConsultation={isConsultation}
                casemixMode
              />
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="mr-main flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">

          {/* Top Toolbar */}
          <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <Button onClick={() => window.history.back()} variant="ghost" size="sm" className="rounded-none">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-none"
                disabled={!canQuickAddPharmacy}
                title={canQuickAddPharmacy ? "Tambah obat duplikat" : "Tambah obat hanya tersedia di tab Edit Farmasi"}
                onClick={() => window.dispatchEvent(new CustomEvent("rm-duplicate-add-pharmacy-medicine"))}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-none"
                disabled={visitId <= 0 || downloadingOriginal || !canDownloadOriginalForActiveTab}
                title={canDownloadOriginalForActiveTab ? `Unduh data ${activeTabLabel} dari RM asli` : "Unduh RM asli belum tersedia untuk tab ini"}
                onClick={handleDownloadOriginalClick}
              >
                {downloadingOriginal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="mr-content relative flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6" data-mr-tab-pane={activeTab}>
            {activeTab === "triage" && <TriageForm visitId={visitId} onSave={handleSaveTriage} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "anamnesis" && <AnamnesisForm visitId={visitId} patientId={patientId} onSave={handleSaveAnamnesis} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "physical-exam" && <PhysicalExamForm visitId={visitId} onSave={handleSavePhysicalExam} externalData={importedData} useExternalData={usesImportedData} footerSaveOnly />}
            {activeTab === "body-marker" && <BodyMarkerForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} footerSaveOnly />}
            {activeTab === "diagnosis" && <DiagnosisForm visitId={visitId} onSave={handleSaveDiagnosis} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "procedure" && <ProcedureForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "assessment-plan" && <AssessmentPlanForm visitId={visitId} onSave={handleSaveAssessmentPlan} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "disposition" && <DispositionForm visitId={visitId} />}

            {activeTab === "laboratory-edit" && <LaboratoryWorkstation visitId={visitId} />}
            {activeTab === "radiology-edit" && <RadiologyWorkstation visitId={visitId} />}
            {activeTab === "surgery-edit" && <SurgeryWorkstation visitId={visitId} />}
            {activeTab === "consultation" && <ConsultationForm visitId={visitId} />}
            {activeTab === "prescription-edit" && (
              <PharmacyEditPrescription
                key={`rx-dup-${pharmacyRefreshKey}`}
                visitId={visitId}
                rmDuplicateMode
                duplicateDoctorOptions={visit?.doctor ? [{ id: Number(visit.doctor.id), name: visit.doctor.nama_lengkap || "-" }] : []}
                onCreateDuplicateOrder={async (payload) => {
                  const res = await eklaimLocalApi.createPharmacyOrder(eklaimId, payload);
                  return res.data;
                }}
              />
            )}

            {/* ORDER FORMS */}
            {activeTab === "medicine-order" && <MedicineOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} sourceServiceType={visit?.room?.service_type} />}
            {activeTab === "laboratory-order" && <LaboratoryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "radiology-order" && <RadiologyOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "consultation-order" && <ConsultationOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "surgery-order" && <SurgeryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}

            {activeTab === "cppt" && <CPPTForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "fluid-balance" && <FluidBalanceForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "nursing-care" && <NursingCareForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "fall-risk" && <FallRiskForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "o2-usage" && <O2UsageForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} />}
            {activeTab === "discharge-planning" && <DischargePlanningForm visitId={visitId} externalData={importedData} useExternalData={usesImportedData} footerSaveOnly />}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="mr-footer sticky bottom-0 z-20 shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-none bg-background"
                onClick={() => window.location.reload()}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Batal
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-none"
                onClick={handleSaveActiveTabFromFooter}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Simpan RM Duplikat
              </Button>
            </div>
          </div>

        </main>
      </div>
    </div>
    <Dialog open={pharmacySourceDialogOpen} onOpenChange={setPharmacySourceDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unduh Resep Farmasi Asli</DialogTitle>
          <DialogDescription>
            Pilih satu resep asli untuk ditambahkan sebagai resep duplikat.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {originalPharmacyOrders.map((order: any) => {
            const isSelected = Number(selectedOriginalPharmacyOrderId) === Number(order.id);
            const items = Array.isArray(order.items) ? order.items.filter((it: any) => it.status !== "cancelled") : [];
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOriginalPharmacyOrderId(Number(order.id))}
                className={`w-full rounded-none border px-3 py-2 text-left text-sm ${isSelected ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="font-medium">{order.order_number || `Resep #${order.id}`}</div>
                <div className="text-xs text-muted-foreground">
                  {(order.created_at ? new Date(order.created_at).toLocaleString("id-ID") : "-")} • {items.length} item
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPharmacySourceDialogOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={handleImportSinglePharmacyOrder} disabled={downloadingOriginal}>
            {downloadingOriginal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unduh Resep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={downloadConfirmOpen} onOpenChange={setDownloadConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unduh data {activeTabLabel} dari RM asli?</AlertDialogTitle>
          <AlertDialogDescription>
            Data pada form {activeTabLabel} yang sedang tampil akan diganti di layar saja. Data belum disimpan ke database sampai tombol Simpan di footer ditekan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={downloadingOriginal}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDownloadOriginal} disabled={downloadingOriginal}>
            {downloadingOriginal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unduh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
