import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { Loader2 } from "lucide-react";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { visitsApi, medicalRecordsApi, cpptApi, fluidBalanceApi, nursingCareApi, medicineOrdersApi, procedureOrdersApi } from "@/lib/api";
import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { TriageForm } from "@/components/medical-record/triage-form";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { PharmacyReview } from "@/components/medical-record/pharmacy-review";
import { PharmacyDispense } from "@/components/medical-record/pharmacy-dispense";
import { PharmacyReturn } from "@/components/medical-record/pharmacy-return";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { BedTransferForm } from "@/components/medical-record/bed-transfer-form";
import { UnitTransferForm } from "@/components/medical-record/unit-transfer-form";
import { NutritionOrderForm } from "@/components/medical-record/nutrition-order-form";
import { FinalVisit } from "@/components/medical-record/final-visit";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { SurgeryOrderForm } from "@/components/medical-record/surgery-order-form";
import { SurgeryWorkstation } from "@/components/medical-record/surgery-workstation";
import { ProcedureEditOrder } from "@/components/medical-record/procedure-edit-order";
import { SuratForm } from "@/components/medical-record/surat-form";
import { VisitHistoryDrawer } from "@/components/medical-record/visit-history-drawer";
import { CopyFromHistoryDrawer } from "@/components/medical-record/copy-from-history-drawer";
import { MEDICAL_RECORD_TAB_INDICATOR_EVENT, MEDICAL_RECORD_TAB_SAVED_EVENT, emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "@/components/medical-record/tab-indicator";

const isMeaningfulAllergySummary = (value?: string) => {
  const normalized = (value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  return !/^(none|no known allergies|nkda|nka|nihil|\-|tidak ada|tidak ada alergi)$/.test(normalized);
};

export default function VisitShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set());
  const [isEmergency, setIsEmergency] = useState(false);
  const [isPharmacy, setIsPharmacy] = useState(false);
  const [isRadiology, setIsRadiology] = useState(false);
  const [isLaboratory, setIsLaboratory] = useState(false);
  const [isConsultation, setIsConsultation] = useState(false);
  const [isSurgery, setIsSurgery] = useState(false);
  const [showProcedureTab, setShowProcedureTab] = useState(false);
  const [isInpatient, setIsInpatient] = useState(false);
  const [isPatientDischarged, setIsPatientDischarged] = useState(false);
  const [tabIndicators, setTabIndicators] = useState<Record<string, string>>({});
  const [tabSavedStates, setTabSavedStates] = useState<Record<string, boolean>>({});
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [copyHistoryDrawerOpen, setCopyHistoryDrawerOpen] = useState(false);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const { setOverride } = useBreadcrumb();

  // Track visited tabs so they stay mounted (preserve unsaved form state)
  useEffect(() => {
    if (activeTab) {
      setMountedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  
  // Update breadcrumb with patient name when available
  useEffect(() => {
    if (patientName) {
      setOverride({
        extraSegments: [{ label: patientName }],
      });
    }
    return () => setOverride(null);
  }, [patientName, setOverride]);

  // Reset states and load visit when ID changes (navigating to different visit)
  // This ensures the correct default tab is shown for each visit type
  useEffect(() => {
    setPageTitle("Rekam Medis");
    
    if (id) {
      // Reset all states when navigating to a different visit
      setActiveTab("");
      setIsEmergency(false);
      setIsPharmacy(false);
      setIsRadiology(false);
      setIsLaboratory(false);
      setIsConsultation(false);
      setIsSurgery(false);
      setShowProcedureTab(false);
      setIsInpatient(false);
      setIsPatientDischarged(false);
      setTabIndicators({});
      setTabSavedStates({});
      setMountedTabs(new Set());
      
      // Load the visit data (this will set the correct default tab)
      loadVisit();
    }
  }, [id]);

  const loadVisit = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await visitsApi.getById(Number(id));
      const visitData = response.data;
      setVisit(visitData);

      // Extract patient ID from visit data
      if (visitData.registration?.patient?.id) {
        setPatientId(visitData.registration.patient.id);
        setPatientName(visitData.registration.patient.nama_lengkap || "");
      } else if (visitData.registration?.patient_id) {
        setPatientId(visitData.registration.patient_id);
      }

      // Check if emergency (UGD)
      const emergency = visitData.room?.service_type === "gawat_darurat";
      setIsEmergency(emergency);

      // Check if pharmacy visit
      const pharmacy = visitData.visit_type === "pharmacy";
      setIsPharmacy(pharmacy);

      // Check if radiology visit
      const radiology = visitData.visit_type === "radiology";
      setIsRadiology(radiology);

      // Check if laboratory visit
      const laboratory = visitData.visit_type === "lab";
      setIsLaboratory(laboratory);

      // Check if consultation visit (ORDER konsultasi, bukan pendaftaran biasa)
      // Visit order konsultasi memiliki referral_from (rujukan dari visit lain)
      const consultation = visitData.visit_type === "consultation" && !!visitData.referral_from;
      setIsConsultation(consultation);

      // Check if surgery visit
      const surgery = visitData.visit_type === "surgery";
      setIsSurgery(surgery);

      console.log("Current visit data:", {
        id: visitData.id,
        visit_type: visitData.visit_type,
        referral_from: visitData.referral_from,
        isConsultationOrder: consultation,
        service_type: visitData.room?.service_type,
        admission_time: visitData.admission_time,
        discharge_time: visitData.discharge_time
      });

      // Show procedure tab for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
      const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
      const shouldShowProcedureTab = allowedServiceTypes.includes(visitData.room?.service_type);
      setShowProcedureTab(shouldShowProcedureTab);

      // Check if inpatient (rawat_inap)
      const inpatient = visitData.room?.service_type === "rawat_inap";
      setIsInpatient(inpatient);

      // Check if patient is discharged (disposition saved)
      const discharged = visitData.registration?.status === "completed" || 
                        visitData.registration?.status === "discharged" ||
                        visitData.status === "completed";
      setIsPatientDischarged(discharged);

      // Pre-load tab indicators for all medical record sections
      preloadTabIndicators(Number(id));

      // Set default active tab based on visit type and permissions (only on first load)
      if (!activeTab) {
        if (pharmacy) {
          // Pharmacy visit tabs - mulai dari edit resep
          if (hasPermission("pharmacy.edit")) {
            setActiveTab("prescription-edit");
          } else if (hasPermission("pharmacy.dispense")) {
            setActiveTab("medicine-dispense");
          } else if (hasPermission("pharmacy.review")) {
            setActiveTab("prescription-review");
          } else if (hasPermission("pharmacy.return")) {
            setActiveTab("medicine-return");
          } else {
            setActiveTab("prescription-edit");
          }
        } else if (radiology) {
          // Radiology visit tabs - mulai dari edit order
          if (hasPermission("procedure_orders.edit")) {
            setActiveTab("radiology-edit");
          } else if (hasPermission("procedure_orders.perform")) {
            setActiveTab("radiology-workstation");
          } else {
            setActiveTab("radiology-edit"); // fallback
          }
        } else if (laboratory) {
          // Laboratory visit tabs - mulai dari edit order
          if (hasPermission("procedure_orders.edit")) {
            setActiveTab("laboratory-edit");
          } else if (hasPermission("procedure_orders.perform")) {
            setActiveTab("laboratory-workstation");
          } else {
            setActiveTab("laboratory-edit"); // fallback
          }
        } else if (surgery) {
          // Surgery visit tabs - mulai dari edit order
          if (hasPermission("procedure_orders.edit")) {
            setActiveTab("surgery-edit");
          } else if (hasPermission("procedure_orders.perform")) {
            setActiveTab("surgery-workstation");
          } else {
            setActiveTab("surgery-edit");
          }
        } else if (consultation) {
          // Consultation visit tabs - langsung ke form konsultasi
          setActiveTab("consultation");
        } else {
          // Clinical visit tabs
          if (emergency && hasPermission("medical_records.triage")) {
            setActiveTab("triage");
          } else if (hasPermission("medical_records.anamnesis")) {
            setActiveTab("anamnesis");
          } else if (hasPermission("medical_records.physical_exam")) {
            setActiveTab("physical-exam");
          } else if (hasPermission("medical_records.diagnosis")) {
            setActiveTab("diagnosis");
          } else if (hasPermission("medical_records.assessment_plan")) {
            setActiveTab("assessment-plan");
          } else if (hasPermission("medical_records.disposition")) {
            setActiveTab("disposition");
          } else {
            setActiveTab("anamnesis"); // fallback
          }
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data kunjungan",
      });
      navigate("/visits");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Pre-load tab indicators from API so they appear immediately without opening each tab
  const preloadTabIndicators = async (visitId: number) => {
    try {
      const res = await medicalRecordsApi.get(visitId);
      const summary = res.data;

      // Triage: count filled fields out of 20
      if (summary.triage) {
        const t = summary.triage;
        const triageTextFields = [t.arrival_mode, t.triage_complaint, t.triage_level, t.airway, t.airway_note, t.breathing, t.breathing_note, t.circulation, t.circulation_note, t.blood_pressure, t.triage_assessment, t.immediate_actions];
        const filledText = triageTextFields.filter(v => v && String(v).trim() !== "").length;
        const filledNumeric = [
          t.heart_rate, t.respiratory_rate, t.temperature, t.oxygen_saturation, t.pain_scale
        ].filter(v => v !== undefined && v !== null && v !== 0).length;
        const filledGCS = [
          t.gcs_e !== undefined && t.gcs_e !== null ? 1 : 0,
          t.gcs_v !== undefined && t.gcs_v !== null ? 1 : 0,
          t.gcs_m !== undefined && t.gcs_m !== null ? 1 : 0,
        ].reduce((a, b) => a + b, 0);
        const filledTriage = filledText + filledNumeric + filledGCS;
        emitMedicalRecordTabIndicator("triage", `${filledTriage}/20`);
        emitMedicalRecordTabSaved("triage", !!t.id && filledTriage > 0);
      } else {
        emitMedicalRecordTabIndicator("triage", "0/20");
      }

      // Anamnesis: count filled fields out of 7
      // Note: allergies are counted from structured patient allergies by the form itself,
      // but preload can only check the legacy text field. The form will update the count on mount.
      if (summary.anamnesis) {
        const a = summary.anamnesis;
        const textFields = [a.chief_complaint, a.history_of_present_illness, a.past_medical_history, a.family_history, a.social_history, a.current_medications];
        const filledText = textFields.filter(v => v && v.trim() !== "").length;
        const hasLegacyAllergy = isMeaningfulAllergySummary(a.allergies);
        const filled = filledText + (hasLegacyAllergy ? 1 : 0);
        emitMedicalRecordTabIndicator("anamnesis", `${filled}/7`);
        emitMedicalRecordTabSaved("anamnesis", !!a.id && filled > 0);
      } else {
        emitMedicalRecordTabIndicator("anamnesis", "0/7");
      }

      // Physical Exam: body sections (13) + core fields (11) = total 24
      if (summary.physical_exam) {
        const p = summary.physical_exam;
        const bodySectionIds = ["head", "eyes", "ears", "nose", "throat", "neck", "chest", "heart", "lungs", "abdomen", "extremities", "skin", "neurological"];
        const filledBody = bodySectionIds.filter(id => {
          const val = p[id as keyof typeof p];
          return val && typeof val === "string" && val.trim() !== "";
        }).length;
        const filledVitals = [
          p.general_condition ? 1 : 0,
          p.consciousness ? 1 : 0,
          (p.blood_pressure_systolic || p.systolic) ? 1 : 0,
          (p.blood_pressure_diastolic || p.diastolic) ? 1 : 0,
          p.heart_rate ? 1 : 0,
          p.respiratory_rate ? 1 : 0,
          p.temperature ? 1 : 0,
          p.oxygen_saturation ? 1 : 0,
          p.upper_arm_circum ? 1 : 0,
          p.head_circum ? 1 : 0,
          p.waist ? 1 : 0,
        ].reduce((a, b) => a + b, 0);
        const totalFilled = filledBody + filledVitals;
        emitMedicalRecordTabIndicator("physical-exam", `${totalFilled}/24`);
        emitMedicalRecordTabSaved("physical-exam", !!p.id && totalFilled > 0);
      } else {
        emitMedicalRecordTabIndicator("physical-exam", "0/24");
      }

      // Diagnosis: count items + clinical_impression + differential_diagnosis
      if (summary.diagnosis) {
        const d = summary.diagnosis;
        const count = (d.items?.length || 0) + (d.clinical_impression?.trim() ? 1 : 0) + (d.differential_diagnosis?.trim() ? 1 : 0);
        emitMedicalRecordTabIndicator("diagnosis", `${count}`);
        emitMedicalRecordTabSaved("diagnosis", count > 0);
      } else {
        emitMedicalRecordTabIndicator("diagnosis", "0");
      }

      // Assessment Plan: count filled fields out of 10
      if (summary.assessment_plan) {
        const ap = summary.assessment_plan;
        const apFields = [ap.clinical_assessment, ap.treatment_plan, ap.prognosis, ap.medication_plan, ap.diet_plan, ap.activity_plan, ap.education_plan, ap.procedure_plan, ap.consultation_plan, ap.monitoring_plan];
        const filledAP = apFields.filter(v => v && v.trim() !== "").length;
        emitMedicalRecordTabIndicator("assessment-plan", `${filledAP}/10`);
        emitMedicalRecordTabSaved("assessment-plan", !!ap.id && filledAP > 0);
      } else {
        emitMedicalRecordTabIndicator("assessment-plan", "0/10");
      }
    } catch {
      // Ignore — indicators will be set when forms mount
    }

    // CPPT, Nursing Care, Fluid Balance — separate API calls (not in summary)
    const listIndicators = [
      { key: "cppt", fetch: () => cpptApi.getAll(visitId) },
      { key: "nursing-care", fetch: () => nursingCareApi.getAll(visitId) },
      { key: "fluid-balance", fetch: () => fluidBalanceApi.getAll(visitId) },
    ];
    await Promise.allSettled(
      listIndicators.map(async ({ key, fetch }) => {
        try {
          const r = await fetch();
          const count = r.data?.data?.length ?? 0;
          emitMedicalRecordTabIndicator(key, `${count}`);
        } catch {
          // ignore
        }
      })
    );

    // Order tabs counts: medicine/radiology/lab/consultation/surgery
    const orderIndicators = [
      {
        key: "medicine-order",
        fetch: async () => {
          const r = await medicineOrdersApi.getAll({ source_visit_id: visitId });
          const orders = Array.isArray(r.data) ? r.data : [];
          return orders.filter((order: any) => order?.status !== "cancelled").length;
        },
      },
      {
        key: "radiology-order",
        fetch: async () => {
          const r = await procedureOrdersApi.getBySourceVisit(visitId, "radiology");
          const orders = Array.isArray(r.data) ? r.data : [];
          return orders.filter((order: any) => order?.status !== "cancelled").length;
        },
      },
      {
        key: "laboratory-order",
        fetch: async () => {
          const r = await procedureOrdersApi.getBySourceVisit(visitId, "laboratory");
          const orders = Array.isArray(r.data) ? r.data : [];
          return orders.filter((order: any) => order?.status !== "cancelled").length;
        },
      },
      {
        key: "consultation-order",
        fetch: async () => {
          const r = await procedureOrdersApi.getBySourceVisit(visitId, "consultation");
          const orders = Array.isArray(r.data) ? r.data : [];
          return orders.filter((order: any) => order?.status !== "cancelled").length;
        },
      },
      {
        key: "surgery-order",
        fetch: async () => {
          const r = await procedureOrdersApi.getBySourceVisit(visitId, "surgery");
          const orders = Array.isArray(r.data) ? r.data : [];
          return orders.filter((order: any) => order?.status !== "cancelled").length;
        },
      },
    ];

    await Promise.allSettled(
      orderIndicators.map(async ({ key, fetch }) => {
        try {
          const count = await fetch();
          const indicatorValue = `${count}`;
          emitMedicalRecordTabIndicator(key, indicatorValue);
          setTabIndicators((prev) => ({
            ...prev,
            [key]: indicatorValue,
          }));
        } catch {
          // ignore
        }
      })
    );
  };

  // Callback to refresh visit data after status-changing operations
  const handleVisitUpdate = () => {
    loadVisit(true); // Silent reload to update visit data without showing loading state
  };

  useEffect(() => {
    const handleIndicatorUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId: string; value: string }>;
      const detail = customEvent.detail;
      if (!detail?.tabId) {
        return;
      }

      setTabIndicators((prev) => ({
        ...prev,
        [detail.tabId]: detail.value,
      }));
    };

    const handleSavedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId: string; saved: boolean }>;
      const detail = customEvent.detail;
      if (!detail?.tabId) return;
      setTabSavedStates((prev) => ({ ...prev, [detail.tabId]: detail.saved }));
    };

    window.addEventListener(MEDICAL_RECORD_TAB_INDICATOR_EVENT, handleIndicatorUpdate as EventListener);
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handleSavedUpdate as EventListener);

    return () => {
      window.removeEventListener(MEDICAL_RECORD_TAB_INDICATOR_EVENT, handleIndicatorUpdate as EventListener);
      window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handleSavedUpdate as EventListener);
    };
  }, []);

  // Handle visit selection from history sidebar
  const handleVisitSelect = (visitId: number) => {
    if (visitId !== Number(id)) {
      navigate(`/visits/${visitId}`);
    }
  };

  const handleSaveTriage = async (data: any) => {
    try {
      await medicalRecordsApi.saveTriage(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data triase berhasil disimpan",
      });
      emitMedicalRecordTabSaved("triage", true);
      // Update triage field count indicator
      const triageTextFields = [data.arrival_mode, data.triage_complaint, data.triage_level, data.airway, data.airway_note, data.breathing, data.breathing_note, data.circulation, data.circulation_note, data.blood_pressure, data.triage_assessment, data.immediate_actions];
      const filledText = triageTextFields.filter((v: any) => v && String(v).trim() !== "").length;
      const filledNumeric = [
        data.heart_rate, data.respiratory_rate, data.temperature, data.oxygen_saturation, data.pain_scale
      ].filter((v: any) => v !== undefined && v !== null && v !== 0).length;
      const filledGCS = [
        data.gcs_e !== undefined && data.gcs_e !== null ? 1 : 0,
        data.gcs_v !== undefined && data.gcs_v !== null ? 1 : 0,
        data.gcs_m !== undefined && data.gcs_m !== null ? 1 : 0,
      ].reduce((a: number, b: number) => a + b, 0);
      emitMedicalRecordTabIndicator("triage", `${filledText + filledNumeric + filledGCS}/20`);
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data triase",
      });
    }
  };

  const handleSaveAnamnesis = async (data: any) => {
    try {
      await medicalRecordsApi.saveAnamnesis(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data anamnesis berhasil disimpan",
      });
      emitMedicalRecordTabSaved("anamnesis", true);
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data anamnesis",
      });
    }
  };

  const handleSavePhysicalExam = async (data: any) => {
    try {
      await medicalRecordsApi.savePhysicalExam(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data pemeriksaan fisik berhasil disimpan",
      });
      emitMedicalRecordTabSaved("physical-exam", true);
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data pemeriksaan fisik",
      });
    }
  };

  const handleSaveDiagnosis = async (data: any) => {
    try {
      await medicalRecordsApi.saveDiagnosis(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data diagnosis berhasil disimpan",
      });
      emitMedicalRecordTabSaved("diagnosis", true);
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data diagnosis",
      });
    }
  };

  const renderTabContent = (tab: string) => {
    if (!visit) return null;

    // Derive support visit types directly from visit data to avoid stale state
    const visitIsRadiology = visit.visit_type === "radiology";
    const visitIsLaboratory = visit.visit_type === "lab";
    const visitIsPharmacy = visit.visit_type === "pharmacy";
    const visitIsConsultation = visit.visit_type === "consultation" && !!visit.referral_from;
    const visitIsSurgery = visit.visit_type === "surgery";

    // Helper: Check if current visit is a support visit (pharmacy, radiology, lab, consultation order, surgery)
    const isSupportVisit = visitIsPharmacy || visitIsRadiology || visitIsLaboratory || visitIsConsultation || visitIsSurgery;
    
    // Helper: Render message for wrong visit type
    const renderWrongVisitTypeMessage = (expectedType: string) => (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Tab ini tidak tersedia untuk jenis kunjungan ini. 
          Tab ini hanya untuk kunjungan {expectedType}.
        </p>
      </Card>
    );

    switch (tab) {
      case "triage":
        // Triage only for emergency visits
        if (!isEmergency) {
          return renderWrongVisitTypeMessage("Gawat Darurat (UGD)");
        }
        if (!hasPermission("medical_records.triage")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Triase
              </p>
            </Card>
          );
        }
        return <TriageForm visitId={visit.id} onSave={handleSaveTriage} isPatientDischarged={isPatientDischarged} />;
      case "anamnesis":
        // Anamnesis only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.anamnesis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Anamnesis
              </p>
            </Card>
          );
        }
        return <AnamnesisForm visitId={visit.id} patientId={patientId || undefined} onSave={handleSaveAnamnesis} isPatientDischarged={isPatientDischarged} />;
      case "physical-exam":
        // Physical exam only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.physical_exam")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Pemeriksaan Fisik
              </p>
            </Card>
          );
        }
        return (
          <PhysicalExamForm
            visitId={visit.id}
            onSave={handleSavePhysicalExam}
            isEmergency={isEmergency}
            isPatientDischarged={isPatientDischarged}
          />
        );
      case "diagnosis":
        // Diagnosis only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.diagnosis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Diagnosis
              </p>
            </Card>
          );
        }
        return <DiagnosisForm visitId={visit.id} onSave={handleSaveDiagnosis} isPatientDischarged={isPatientDischarged} />;
      case "assessment-plan":
        // Assessment plan only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.assessment_plan")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Assessment & Plan
              </p>
            </Card>
          );
        }
        return <AssessmentPlanForm visitId={visit.id} isPatientDischarged={isPatientDischarged} />;
      case "procedure":
        // Procedure only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.procedure")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Tindakan
              </p>
            </Card>
          );
        }
        return <ProcedureForm key={`procedure-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "cppt":
        // CPPT only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk CPPT
              </p>
            </Card>
          );
        }
        return <CPPTForm key={`cppt-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "nursing-care":
        // Nursing care only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.nursing_care")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Asuhan Keperawatan
              </p>
            </Card>
          );
        }
        return <NursingCareForm key={`nursing-care-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "fluid-balance":
        // Fluid balance only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.fluid_balance")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Balance Cairan
              </p>
            </Card>
          );
        }
        return <FluidBalanceForm key={`fluid-balance-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "bed-transfer":
        // Bed transfer only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.bed_transfer")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Mutasi Pasien
              </p>
            </Card>
          );
        }
        return (
          <BedTransferForm
            key={`bed-transfer-${visit.id}`}
            visitId={visit.id}
            currentRoomId={visit.room_id}
            currentBedId={visit.bed_id}
            readOnly={isPatientDischarged}
            onTransferComplete={() => loadVisit(true)}
          />
        );
      case "unit-transfer":
        // Unit transfer only for outpatient/emergency visits
        if (isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Jalan / UGD");
        }
        if (!hasPermission("medical_records.bed_transfer")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Mutasi Unit
              </p>
            </Card>
          );
        }
        return (
          <UnitTransferForm
            key={`unit-transfer-${visit.id}`}
            visitId={visit.id}
            currentRoomId={visit.room_id}
            //currentDoctorId={visit.doctor_id}
            serviceType={visit.room?.service_type || "rawat_jalan"}
            readOnly={isPatientDischarged}
            onTransferComplete={() => loadVisit(true)}
          />
        );
      case "nutrition-order":
        // Nutrition order only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.nutrition_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Gizi
              </p>
            </Card>
          );
        }
        return (
          <NutritionOrderForm
            key={`nutrition-order-${visit.id}`}
            visitId={visit.id}
            readOnly={isPatientDischarged}
          />
        );
      case "medicine-order":
        // Medicine order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.medicine_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Obat
              </p>
            </Card>
          );
        }
        return (
          <MedicineOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "radiology-order":
        // Radiology order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.radiology_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Radiologi
              </p>
            </Card>
          );
        }
        return (
          <RadiologyOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "laboratory-order":
        // Laboratory order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.laboratory_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Laboratorium
              </p>
            </Card>
          );
        }
        return (
          <LaboratoryOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "consultation-order":
        // Consultation order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.consultation_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Konsultasi
              </p>
            </Card>
          );
        }
        return (
          <ConsultationOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      
      case "surgery-order":
        // Surgery order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.surgery_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Operasi
              </p>
            </Card>
          );
        }
        return (
          <SurgeryOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );

      // Surgery edit order tab - ONLY for surgery visits
      case "surgery-edit":
        if (!hasPermission("procedure_orders.edit")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Edit Order Operasi
              </p>
            </Card>
          );
        }
        return <ProcedureEditOrder key={`surgery-edit-${visit.id}`} visitId={visit.id} orderType="surgery" readOnly={visit.status === "completed"} />;

      // Surgery workstation tab - ONLY for surgery visits
      case "surgery-workstation":
        if (!hasPermission("procedure_orders.perform")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Pengerjaan Operasi
              </p>
            </Card>
          );
        }
        return <SurgeryWorkstation key={`surgery-ws-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;

      case "surgery-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Operasi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`surgery-final-${visit.id}`} visitId={visit.id} type="surgery" onVisitUpdate={handleVisitUpdate} />;

      // Consultation tab - form jawaban konsultasi (ONLY for consultation order visits)
      case "consultation":
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Form Konsultasi
              </p>
            </Card>
          );
        }
        return <ConsultationForm key={`consultation-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;

      case "consultation-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Konsultasi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`consultation-final-${visit.id}`} visitId={visit.id} type="consultation" onVisitUpdate={handleVisitUpdate} />;

      case "surat":
        // Surat only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.sick_letter")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Surat
              </p>
            </Card>
          );
        }
        return <SuratForm key={`surat-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;

      case "disposition":
        // Disposition only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.disposition")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Disposisi
              </p>
            </Card>
          );
        }
        return <DispositionForm visitId={visit.id} isEmergency={isEmergency} readOnly={isPatientDischarged} onSave={handleVisitUpdate} />;
      
      // Pharmacy tabs - ONLY for pharmacy visits
      case "prescription-edit":
        if (!hasPermission("pharmacy.edit")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Edit Resep
              </p>
            </Card>
          );
        }
        return <PharmacyEditPrescription key={`edit-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      case "prescription-review":
        if (!hasPermission("pharmacy.review")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Telaah Resep
              </p>
            </Card>
          );
        }
        return <PharmacyReview key={`review-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      case "medicine-dispense":
        if (!hasPermission("pharmacy.dispense")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Penyerahan Obat
              </p>
            </Card>
          );
        }
        return <PharmacyDispense key={`dispense-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      case "medicine-return":
        if (!hasPermission("pharmacy.return")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Return Obat
              </p>
            </Card>
          );
        }
        return <PharmacyReturn key={`return-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      
      case "pharmacy-final":
        if (!hasPermission("pharmacy.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Farmasi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`pharmacy-final-${visit.id}`} visitId={visit.id} type="pharmacy" onVisitUpdate={handleVisitUpdate} />;
      
      // Radiology edit order tab - ONLY for radiology visits
      case "radiology-edit":
        if (!hasPermission("procedure_orders.edit")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Edit Order Radiologi
              </p>
            </Card>
          );
        }
        return <ProcedureEditOrder key={`radiology-edit-${visit.id}`} visitId={visit.id} orderType="radiology" readOnly={visit.status === "completed"} />;

      // Radiology workstation tab - ONLY for radiology visits
      case "radiology-workstation":
        if (!hasPermission("procedure_orders.perform")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Pengerjaan Radiologi
              </p>
            </Card>
          );
        }
        return <RadiologyWorkstation key={`radiology-ws-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      
      case "radiology-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Radiologi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`radiology-final-${visit.id}`} visitId={visit.id} type="radiology" onVisitUpdate={handleVisitUpdate} />;
      
      // Laboratory edit order tab - ONLY for laboratory visits
      case "laboratory-edit":
        if (!hasPermission("procedure_orders.edit")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Edit Order Laboratorium
              </p>
            </Card>
          );
        }
        return <ProcedureEditOrder key={`laboratory-edit-${visit.id}`} visitId={visit.id} orderType="laboratory" readOnly={visit.status === "completed"} />;

      // Laboratory workstation tab - ONLY for laboratory visits
      case "laboratory-workstation":
        if (!hasPermission("procedure_orders.perform")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Pengerjaan Laboratorium
              </p>
            </Card>
          );
        }
        return <LaboratoryWorkstation key={`laboratory-ws-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;

      case "laboratory-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Laboratorium
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`laboratory-final-${visit.id}`} visitId={visit.id} type="laboratory" onVisitUpdate={handleVisitUpdate} />;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return null;
  }

  return (
    <div>
      {/* Patient Info + Tabs Header - Sticky */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="px-6 pt-4 pb-2">
        <PatientInfo visit={visit} onCopyHistoryOpen={() => setCopyHistoryDrawerOpen(true)} />
        </div>

        <div className="px-6 pb-2">
          <MedicalRecordTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            indicators={tabIndicators}
            savedStates={tabSavedStates}
            isEmergency={isEmergency}
            isPharmacy={isPharmacy}
            isRadiology={isRadiology}
            isLaboratory={isLaboratory}
            isConsultation={isConsultation}
            isSurgery={isSurgery}
            showProcedureTab={showProcedureTab}
            isInpatient={isInpatient}
          />
        </div>
      </div>

      {/* Main Content Area with Tabs and Form */}
      <div className="px-6 pb-6 pt-2">
        <div className="min-w-0">
          {Array.from(mountedTabs).map(tab => (
            <div key={tab} className={tab === activeTab ? undefined : "hidden"}>
              {renderTabContent(tab)}
            </div>
          ))}
        </div>
      </div>

      {/* Visit History Drawer */}
      {patientId && (
        <VisitHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          patientId={patientId}
          currentVisitId={Number(id)}
          currentVisitType={visit?.visit_type}
          currentServiceType={visit?.room?.service_type}
          patientName={patientName}
          onVisitSelect={handleVisitSelect}
        />
      )}

      {/* Copy from History Drawer */}
      {patientId && (
        <CopyFromHistoryDrawer
          open={copyHistoryDrawerOpen}
          onOpenChange={setCopyHistoryDrawerOpen}
          patientId={patientId}
          currentVisitId={Number(id)}
          patientName={patientName}
        />
      )}
    </div>
  );
}
