import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { setCasemixContext, restoreCasemixContext } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { Activity, CheckCircle2, History, Loader2, Save, X, XCircle, Printer } from "lucide-react";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { visitsApi, medicalRecordsApi, cpptApi, fluidBalanceApi, nursingCareApi, fallRiskApi, o2UsageApi, bhpUsageApi, medicineOrdersApi, procedureOrdersApi, patientAllergyApi } from "@/lib/api";
import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { BersalinForm } from "@/components/medical-record/bersalin-form";
import { TriageForm } from "@/components/medical-record/triage-form";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { BodyMarkerForm } from "@/components/medical-record/body-marker-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { MedicineTimesheetForm } from "@/components/medical-record/medicine-timesheet-form";
import { InformedConsentContainer } from "@/components/medical-record/informed-consent-container";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { PharmacyReview } from "@/components/medical-record/pharmacy-review";
import { PharmacyDispense } from "@/components/medical-record/pharmacy-dispense";
import { PharmacyReturn } from "@/components/medical-record/pharmacy-return";
import { PharmacyApotekOnline } from "@/components/medical-record/pharmacy-apotek-online";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { FallRiskForm } from "@/components/medical-record/fall-risk-form";
import { O2UsageForm } from "@/components/medical-record/o2-usage-form";
import { BHPUsageForm } from "@/components/medical-record/bhp-usage-form";
import { DischargePlanningForm } from "@/components/medical-record/discharge-planning-form";
import { BedTransferForm } from "@/components/medical-record/bed-transfer-form";
import { UnitTransferForm } from "@/components/medical-record/unit-transfer-form";
import { NutritionOrderForm } from "@/components/medical-record/nutrition-order-form";
import { FinalVisit, type FinalVisitType, useFinalVisitController } from "@/components/medical-record/final-visit";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { SurgeryOrderForm } from "@/components/medical-record/surgery-order-form";
import { SurgeryWorkstation } from "@/components/medical-record/surgery-workstation";
import { ProcedureEditOrder } from "@/components/medical-record/procedure-edit-order";
import { SuratForm } from "@/components/medical-record/surat-form";
import { DocumentPreviewTab } from "@/components/medical-record/document-preview-tab";
import { VisitHistoryDrawer } from "@/components/medical-record/visit-history-drawer";
import { CopyFromHistoryDrawer } from "@/components/medical-record/copy-from-history-drawer";
import { VisitMedicineSummary } from "@/components/medical-record/visit-medicine-summary";
import { MedicalRecordPrintSelect } from "@/components/medical-record/print-select";
import { ObservationReportDrawer } from "@/components/medical-record/observation-report-drawer";
import { MEDICAL_RECORD_TAB_INDICATOR_EVENT, MEDICAL_RECORD_TAB_SAVED_EVENT, emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "@/components/medical-record/tab-indicator";
import type { MedicalRecordSummary } from "@/lib/api/medical-records";



const ORDER_TAB_IDS = new Set([
  "medicine-order",
  "radiology-order",
  "laboratory-order",
  "consultation-order",
  "surgery-order",
  "nutrition-order",
]);

const FINAL_TAB_IDS = new Set([
  "pharmacy-final",
  "radiology-final",
  "laboratory-final",
  "surgery-final",
  "consultation-final",
]);

const EDIT_TAB_IDS = new Set([
  "prescription-edit",
  "radiology-edit",
  "laboratory-edit",
  "surgery-edit",
]);

const ADMIN_TAB_IDS = new Set(["surat", "disposition", "medicine-timesheet", "discharge-planning"]);
const INLINE_PRIMARY_ACTION_REGEX = /(simpan|save|perbarui|update|kirim|send|selesaikan|submit)/i;
const FOOTER_ACTION_EVENT = "medical-record-footer-action";
const PHARMACY_REVIEW_REQUEST_EVENT = "pharmacy-review-request";
const PHARMACY_OPEN_FINAL_REVIEW_EVENT = "pharmacy-open-final-review";
const PHARMACY_LOCKABLE_TAB_IDS = [
  "prescription-edit",
  "medicine-dispense",
  "medicine-return",
  "apotek-online",
];

const shouldUseFooterActionForTab = (tabId: string) =>
  !ADMIN_TAB_IDS.has(tabId) && !EDIT_TAB_IDS.has(tabId);

const getDefaultPharmacyTabId = (hasPermission: (permission: string) => boolean) => {
  if (hasPermission("pharmacy.edit")) return "prescription-edit";
  if (hasPermission("pharmacy.dispense")) return "medicine-dispense";
  if (hasPermission("pharmacy.return")) return "medicine-return";
  if (hasPermission("pharmacy.final")) return "pharmacy-final";
  return "prescription-edit";
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
  const [isFemale, setIsFemale] = useState(false);
  const [isPatientDischarged, setIsPatientDischarged] = useState(false);
  const [lockedPharmacyTabIds, setLockedPharmacyTabIds] = useState<string[]>([]);
  const [pharmacyTabLockReason, setPharmacyTabLockReason] = useState<string>("");
  const [tabIndicators, setTabIndicators] = useState<Record<string, string>>({});
  const [tabSavedStates, setTabSavedStates] = useState<Record<string, boolean>>({});
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [copyHistoryDrawerOpen, setCopyHistoryDrawerOpen] = useState(false);
  const [observationDrawerOpen, setObservationDrawerOpen] = useState(false);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const [medicalRecordSummary, setMedicalRecordSummary] = useState<MedicalRecordSummary | null>(null);
  const { setOverride } = useBreadcrumb();
  const tabScrollPositionsRef = useRef<Record<string, number>>({});
  const tabContentContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollStorageKey = `mr-tab-scroll:${id || ""}`;
  const isOrderTab = ORDER_TAB_IDS.has(activeTab);
  const isFinalTab = FINAL_TAB_IDS.has(activeTab);
  const isEditTab = EDIT_TAB_IDS.has(activeTab);
  const isAdministrativeTab = ADMIN_TAB_IDS.has(activeTab);
  const isFooterActionHiddenTab = !shouldUseFooterActionForTab(activeTab);

  // Casemix context
  const [isCasemixMode, setIsCasemixMode] = useState(false);
  const [casemixEklaimId, setCasemixEklaimId] = useState<number | null>(null);

  useEffect(() => {
    const ctx = restoreCasemixContext();
    if (ctx.isCasemix && ctx.eklaimId) {
      setIsCasemixMode(true);
      setCasemixEklaimId(ctx.eklaimId);
    }
    return () => {
      // Clear casemix context when leaving this page
      if (restoreCasemixContext().isCasemix) {
        setCasemixContext(false);
      }
    };
  }, []);

  const getScrollTargets = (): HTMLElement[] => {
    const targets: (HTMLElement | null | undefined)[] = [
      document.getElementById("app-main-scroll-container") as HTMLElement | null,
      document.scrollingElement as HTMLElement | null,
      document.documentElement,
      document.body,
    ];

    const uniqueTargets: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    for (const target of targets) {
      if (!target || seen.has(target)) continue;
      seen.add(target);
      uniqueTargets.push(target);
    }
    return uniqueTargets;
  };

  const getCurrentScrollTop = () => {
    const tops = getScrollTargets().map((target) => target.scrollTop || 0);
    return tops.length ? Math.max(...tops) : 0;
  };

  const setScrollTopAllTargets = (top: number) => {
    for (const target of getScrollTargets()) {
      target.scrollTop = top;
    }
    window.scrollTo({ top, behavior: "auto" });
  };

  const restoreTabScroll = (tabId: string) => {
    const savedTop = tabScrollPositionsRef.current[tabId] ?? 0;
    requestAnimationFrame(() => {
      setScrollTopAllTargets(savedTop);
    });
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === activeTab) return;

    if (activeTab) {
      tabScrollPositionsRef.current[activeTab] = getCurrentScrollTop();
      try {
        sessionStorage.setItem(scrollStorageKey, JSON.stringify(tabScrollPositionsRef.current));
      } catch {
        // Ignore storage errors
      }
    }

    setMountedTabs((previous) => {
      if (previous.has(nextTab)) return previous;
      const next = new Set(previous);
      next.add(nextTab);
      return next;
    });
    setActiveTab(nextTab);
  };

  const refreshPharmacyTabLock = async (visitId: number) => {
    try {
      const ordersRes = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const activeOrders = (ordersRes.data || []).filter((order) => order.status !== "cancelled");
      const hasProgressedOrder = activeOrders.some(
        (order) =>
          order.reviewed_at ||
          ["reviewed", "preparing", "partial", "ready", "delivered", "returned"].includes(
            order.status,
          ),
      );

      if (hasProgressedOrder) {
        setLockedPharmacyTabIds([]);
        setPharmacyTabLockReason("");
        return false;
      }

      let hasCompletedReview = false;
      let hasPendingInitialReview = false;

      for (const order of activeOrders) {
        let reviewData: any = null;
        try {
          const reviewRes = await medicineOrdersApi.getReview(order.id);
          reviewData = reviewRes.data;
        } catch {
          reviewData = null;
        }

        if (reviewData?.final_review_completed || reviewData?.initial_review_completed) {
          hasCompletedReview = true;
        }

        if (order.status === "pending" && !reviewData?.initial_review_completed) {
          hasPendingInitialReview = true;
        }
      }

      if (hasCompletedReview) {
        hasPendingInitialReview = false;
      }

      if (hasPendingInitialReview) {
        setLockedPharmacyTabIds(PHARMACY_LOCKABLE_TAB_IDS);
        setPharmacyTabLockReason("Tab dikunci sampai Telaah Awal selesai.");
        setActiveTab((prev) =>
          PHARMACY_LOCKABLE_TAB_IDS.includes(prev) ? getDefaultPharmacyTabId(hasPermission) : prev,
        );
      } else {
        setLockedPharmacyTabIds([]);
        setPharmacyTabLockReason("");
      }
      return hasPendingInitialReview;
    } catch {
      // keep current lock state on error
      return null;
    }
  };

  const triggerActiveTabSave = (): boolean => {
    if (!activeTab) return false;
    if (isPharmacy && lockedPharmacyTabIds.includes(activeTab)) {
      window.dispatchEvent(
        new CustomEvent(PHARMACY_REVIEW_REQUEST_EVENT, {
          detail: { mode: "initial" },
        }),
      );
      return true;
    }

    const footerActionEvent = new CustomEvent<{
      tabId: string;
      action: "save" | "final";
      handled: boolean;
    }>(FOOTER_ACTION_EVENT, {
      detail: {
        tabId: activeTab,
        action: isFinalTab ? "final" : "save",
        handled: false,
      },
    });
    window.dispatchEvent(footerActionEvent);
    if (footerActionEvent.detail.handled) {
      return true;
    }

    const activePane = document.querySelector<HTMLElement>(`[data-mr-tab-pane="${activeTab}"]`);
    if (!activePane) return false;

    const activeForm = activePane.querySelector<HTMLFormElement>("form");
    if (activeForm) {
      activeForm.requestSubmit();
      return true;
    }

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

  // Update breadcrumb with patient name when available
  useEffect(() => {
    if (patientName) {
      setOverride({
        extraSegments: [{ label: patientName }],
      });
    }
    return () => setOverride(null);
  }, [patientName, setOverride]);

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
      setMedicalRecordSummary(null);

      try {
        const savedRaw = sessionStorage.getItem(scrollStorageKey);
        tabScrollPositionsRef.current = savedRaw ? JSON.parse(savedRaw) : {};
      } catch {
        tabScrollPositionsRef.current = {};
      }

      // Load the visit data (this will set the correct default tab)
      loadVisit();
    }
  }, [id]);

  useLayoutEffect(() => {
    if (!activeTab) return;
    restoreTabScroll(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!activeTab) return;
    setMountedTabs((previous) => {
      if (previous.has(activeTab)) return previous;
      const next = new Set(previous);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;

      event.preventDefault();
      const saved = triggerActiveTabSave();

      if (!saved) {
        toast({
          title: "Simpan tidak tersedia",
          description: "Tab aktif tidak memiliki aksi simpan.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, toast]);

  useEffect(() => {
    if (!activeTab) return;
    const targets = getScrollTargets();

    const onScroll = () => {
      tabScrollPositionsRef.current[activeTab] = getCurrentScrollTop();
      try {
        sessionStorage.setItem(scrollStorageKey, JSON.stringify(tabScrollPositionsRef.current));
      } catch {
        // Ignore storage errors
      }
    };

    for (const target of targets) {
      target.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      for (const target of targets) {
        target.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [activeTab, scrollStorageKey]);

  useEffect(() => {
    if (!id || !isPharmacy) {
      setLockedPharmacyTabIds([]);
      setPharmacyTabLockReason("");
      return;
    }
    void refreshPharmacyTabLock(Number(id));
  }, [id, isPharmacy]);

  useEffect(() => {
    if (!id || !isPharmacy) return;
    const handleRefresh = () => {
      void refreshPharmacyTabLock(Number(id));
    };
    window.addEventListener("refresh-final-visit", handleRefresh);
    return () => {
      window.removeEventListener("refresh-final-visit", handleRefresh);
    };
  }, [id, isPharmacy]);

  useEffect(() => {
    if (!isPharmacy) return;
    const handleOpenFinalReview = (event: Event) => {
      const customEvent = event as CustomEvent<{ token?: string }>;
      window.dispatchEvent(
        new CustomEvent(PHARMACY_REVIEW_REQUEST_EVENT, {
          detail: { mode: "final", token: customEvent.detail?.token },
        }),
      );
    };

    window.addEventListener(PHARMACY_OPEN_FINAL_REVIEW_EVENT, handleOpenFinalReview);
    return () => {
      window.removeEventListener(PHARMACY_OPEN_FINAL_REVIEW_EVENT, handleOpenFinalReview);
    };
  }, [isPharmacy]);

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
      if (pharmacy) {
        await refreshPharmacyTabLock(visitData.id);
      } else {
        setLockedPharmacyTabIds([]);
        setPharmacyTabLockReason("");
      }

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

      // Check if patient is female
      const isFemalePatient = visitData.registration?.patient?.jenis_kelamin === "Perempuan" ||
        visitData.registration?.patient?.jenis_kelamin === "P";
      setIsFemale(isFemalePatient);

      // Check if patient is discharged (disposition saved)
      const discharged = visitData.registration?.status === "completed" ||
        visitData.registration?.status === "discharged" ||
        visitData.status === "completed";
      setIsPatientDischarged(discharged);

      // Pre-load tab indicators for all medical record sections
      preloadTabIndicators(
        Number(id),
        visitData.registration?.patient?.id || visitData.registration?.patient_id,
      );

      // Set default active tab based on visit type and permissions (only on first load)
      if (!activeTab) {
        if (pharmacy) {
          setActiveTab(getDefaultPharmacyTabId(hasPermission));
        } else if (radiology) {
          // Radiology visit tabs - default to workstation when no procedure order exists
          const radiologyOrderCount = await procedureOrdersApi.getAll({
            target_visit_id: visitData.id,
            order_type: "radiology",
          })
            .then((res) => (res.data || []).length)
            .catch(() => 0);

          if (radiologyOrderCount === 0 && hasPermission("procedure_orders.perform")) {
            setActiveTab("radiology-workstation");
          } else if (hasPermission("procedure_orders.edit")) {
            setActiveTab("radiology-edit");
          } else if (hasPermission("procedure_orders.perform")) {
            setActiveTab("radiology-workstation");
          } else {
            setActiveTab("radiology-edit"); // fallback
          }
        } else if (laboratory) {
          // Laboratory visit tabs - default to workstation when no procedure order exists
          const laboratoryOrderCount = await procedureOrdersApi.getAll({
            target_visit_id: visitData.id,
            order_type: "laboratory",
          })
            .then((res) => (res.data || []).length)
            .catch(() => 0);

          if (laboratoryOrderCount === 0 && hasPermission("procedure_orders.perform")) {
            setActiveTab("laboratory-workstation");
          } else if (hasPermission("procedure_orders.edit")) {
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
  const preloadTabIndicators = async (visitId: number, preloadPatientId?: number) => {
    try {
      const res = await medicalRecordsApi.get(visitId);
      const summary = res.data;
      setMedicalRecordSummary(summary);

      // Triage: count filled fields out of 22
      if (summary.triage) {
        const t = summary.triage;
        const triageTextFields = [t.arrival_mode, t.triage_complaint, t.triage_level, t.airway, t.airway_note, t.breathing, t.breathing_note, t.circulation, t.circulation_note, t.blood_pressure, t.triage_assessment, t.immediate_actions, t.pain_method, t.pain_location];
        const filledText = triageTextFields.filter(v => v && String(v).trim() !== "").length;
        const filledNumeric = [
          t.heart_rate, t.respiratory_rate, t.temperature, t.oxygen_saturation, t.pain_scale
        ].filter(v => Number(v) > 0).length;
        const filledGCS = [
          t.gcs_e,
          t.gcs_v,
          t.gcs_m,
        ].filter(v => Number(v) > 0).length;
        const filledTriage = filledText + filledNumeric + filledGCS;
        emitMedicalRecordTabIndicator("triage", `${filledTriage}/22`);
        emitMedicalRecordTabSaved("triage", !!t.id && filledTriage > 0);
      } else {
        emitMedicalRecordTabIndicator("triage", "0/22");
      }

      // Anamnesis: keep this formula consistent with `anamnesis-form.tsx`
      // 8 text/select fields + 1 allergy bucket = total 9.
      if (summary.anamnesis) {
        const a = summary.anamnesis;
        const anamnesisSource = a.anamnesis_source || "autoanamnesis";
        const textFields = [
          anamnesisSource,
          a.functional_status,
          a.chief_complaint,
          a.history_of_present_illness,
          a.past_medical_history,
          a.family_history,
          a.social_history,
          a.current_medications,
        ];
        const filledText = textFields.filter(v => v && v.trim() !== "").length;


        let hasStructuredAllergy = false;
        if (preloadPatientId) {
          try {
            const allergyRes = await patientAllergyApi.getByPatient(preloadPatientId);
            hasStructuredAllergy = (allergyRes.data?.data?.length || 0) > 0;
          } catch {
            hasStructuredAllergy = false;
          }
        }

        const isAllergyFilled = (a.allergies && a.allergies.trim() !== "") || hasStructuredAllergy;
        const filled = filledText + (isAllergyFilled ? 1 : 0);
        emitMedicalRecordTabIndicator("anamnesis", `${filled}/9`);
        emitMedicalRecordTabSaved("anamnesis", !!a.id && filled > 0);
      } else {
        emitMedicalRecordTabIndicator("anamnesis", "0/9");
      }

      // Physical Exam: body sections (13) + core fields (13) = total 26.
      // Keep this formula aligned with `physical-exam-form.tsx` so indicator is correct
      // even before user opens the tab.
      if (summary.physical_exam) {
        const p = summary.physical_exam;
        const pExtras = p as unknown as { pain_scale?: unknown; pain_location?: unknown; pain_method?: unknown };
        const bodySectionIds = ["head", "eyes", "ears", "nose", "throat", "neck", "chest", "heart", "lungs", "abdomen", "extremities", "skin", "neurological"];
        const hasText = (v: unknown) => typeof v === "string" && v.trim() !== "";
        const hasPositiveNumber = (v: unknown) => {
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) && n > 0;
        };
        const filledBody = bodySectionIds.filter(id => {
          const val = p[id as keyof typeof p];
          return hasText(val);
        }).length;
        const isNoPain = pExtras.pain_location === "Tidak ada nyeri";
        const filledVitals = [
          hasText(p.general_condition) ? 1 : 0,
          hasText(p.consciousness) ? 1 : 0,
          hasPositiveNumber(p.blood_pressure_systolic ?? p.systolic) ? 1 : 0,
          hasPositiveNumber(p.blood_pressure_diastolic ?? p.diastolic) ? 1 : 0,
          hasPositiveNumber(p.heart_rate) ? 1 : 0,
          hasPositiveNumber(p.respiratory_rate) ? 1 : 0,
          hasPositiveNumber(p.temperature) ? 1 : 0,
          hasPositiveNumber(p.oxygen_saturation) ? 1 : 0,
          hasText(p.upper_arm_circum) ? 1 : 0,
          hasText(p.head_circum) ? 1 : 0,
          hasText(p.waist) ? 1 : 0,
        ].reduce((a, b) => a + b, 0) + (isNoPain ? 3 : (
          (hasText(pExtras.pain_method) ? 1 : 0) +
          (hasPositiveNumber(pExtras.pain_scale) ? 1 : 0) +
          (hasText(pExtras.pain_location) ? 1 : 0)
        ));
        const totalFilled = filledBody + filledVitals;
        emitMedicalRecordTabIndicator("physical-exam", `${totalFilled}/27`);
        emitMedicalRecordTabSaved("physical-exam", !!p.id && totalFilled > 0);
      } else {
        emitMedicalRecordTabIndicator("physical-exam", "0/27");
      }

      // Diagnosis: count items + item-level differential diagnoses + legacy global differential diagnosis
      if (summary.diagnosis) {
        const d = summary.diagnosis;
        const itemDifferentials = d.items?.filter((item: any) => item?.differential_diagnosis?.trim()).length || 0;
        const legacyDifferential = d.differential_diagnosis?.trim() ? 1 : 0;
        const count = (d.items?.length || 0) + itemDifferentials + legacyDifferential;
        emitMedicalRecordTabIndicator("diagnosis", `${count}`);
        emitMedicalRecordTabSaved("diagnosis", count > 0);
      } else {
        emitMedicalRecordTabIndicator("diagnosis", "0");
      }

      // Assessment Plan: count filled fields out of 11 (including informed consent)
      if (summary.assessment_plan) {
        const ap = summary.assessment_plan;
        const apFields = [ap.clinical_assessment, ap.treatment_plan, ap.prognosis, ap.medication_plan, ap.diet_plan, ap.activity_plan, ap.education_plan, ap.procedure_plan, ap.consultation_plan, ap.monitoring_plan, (ap as any).informed_consent];
        const filledAP = apFields.filter(v => v && v.trim() !== "").length;
        emitMedicalRecordTabIndicator("assessment-plan", `${filledAP}/11`);
        emitMedicalRecordTabSaved("assessment-plan", !!ap.id && filledAP > 0);
      } else {
        emitMedicalRecordTabIndicator("assessment-plan", "0/11");
      }

      // Body Marker: preload marker count so badge appears without opening the tab.
      const summaryBodyMarkerItems = Array.isArray(summary.body_marker?.items)
        ? summary.body_marker.items
        : [];

      if (summaryBodyMarkerItems.length > 0) {
        const summaryMarkerCount = summaryBodyMarkerItems.reduce(
          (acc: number, item: any) => acc + (Array.isArray(item?.markers) ? item.markers.length : 0),
          0,
        );
        const bodyMarkerIndicator = `${summaryMarkerCount}`;
        emitMedicalRecordTabIndicator("body-marker", bodyMarkerIndicator);
        emitMedicalRecordTabSaved("body-marker", summaryBodyMarkerItems.length > 0);
        setTabIndicators((prev) => ({
          ...prev,
          ["body-marker"]: bodyMarkerIndicator,
        }));
      } else {
        try {
          const markerRes = await medicalRecordsApi.getBodyMarkers(visitId);
          const markerItems = Array.isArray(markerRes.data?.items) ? markerRes.data.items : [];
          const markerCount = markerItems.reduce(
            (acc: number, item: any) => acc + (Array.isArray(item?.markers) ? item.markers.length : 0),
            0,
          );
          const bodyMarkerIndicator = `${markerCount}`;
          emitMedicalRecordTabIndicator("body-marker", bodyMarkerIndicator);
          emitMedicalRecordTabSaved("body-marker", markerItems.length > 0);
          setTabIndicators((prev) => ({
            ...prev,
            ["body-marker"]: bodyMarkerIndicator,
          }));
        } catch {
          emitMedicalRecordTabIndicator("body-marker", "0");
          emitMedicalRecordTabSaved("body-marker", false);
          setTabIndicators((prev) => ({
            ...prev,
            ["body-marker"]: "0",
          }));
        }
      }

      // Discharge Planning: preload indicator so badge is visible before tab is opened.
      // The form tab can still re-emit this value when it mounts.
      try {
        const dischargeRes = await medicalRecordsApi.getDischargePlanning(visitId);
        const dischargeItems = Array.isArray(dischargeRes.data?.items) ? dischargeRes.data.items : [];
        const totalDischargeItems = dischargeItems.length > 0 ? dischargeItems.length : 15;
        const checkedDischargeItems = dischargeItems.filter((item: any) => item?.checked).length;
        const dischargeIndicator = `${checkedDischargeItems}/${totalDischargeItems}`;
        emitMedicalRecordTabIndicator("discharge-planning", dischargeIndicator);
        emitMedicalRecordTabSaved("discharge-planning", checkedDischargeItems > 0);
        setTabIndicators((prev) => ({
          ...prev,
          ["discharge-planning"]: dischargeIndicator,
        }));
      } catch {
        const dischargeIndicator = "0/15";
        emitMedicalRecordTabIndicator("discharge-planning", dischargeIndicator);
        emitMedicalRecordTabSaved("discharge-planning", false);
        setTabIndicators((prev) => ({
          ...prev,
          ["discharge-planning"]: dischargeIndicator,
        }));
      }
    } catch {
      // Ignore — indicators will be set when forms mount
    }

    // CPPT, Nursing Care, Fluid Balance — separate API calls (not in summary)
    const listIndicators = [
      { key: "cppt", fetch: () => cpptApi.getAll(visitId) },
      { key: "nursing-care", fetch: () => nursingCareApi.getAll(visitId) },
      { key: "fall-risk", fetch: () => fallRiskApi.getAll(visitId) },
      { key: "o2-usage", fetch: () => o2UsageApi.getAll(visitId) },
      { key: "bhp-usage", fetch: () => bhpUsageApi.getAll(visitId) },
      { key: "fluid-balance", fetch: () => fluidBalanceApi.getAll(visitId) },
    ];
    await Promise.allSettled(
      listIndicators.map(async ({ key, fetch }) => {
        try {
          const r = await fetch();
          const count = r.data?.data?.length ?? 0;
          emitMedicalRecordTabIndicator(key, `${count}`);
          setTabIndicators((prev) => ({
            ...prev,
            [key]: `${count}`,
          }));
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
        key: "medicine-timesheet",
        fetch: async () => {
          const today = new Date().toISOString().slice(0, 10);
          const r = await medicineOrdersApi.getTimesheet(visitId, today);
          return Array.isArray(r.data?.items) ? r.data.items.length : 0;
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

  const headerFinalVisitType: FinalVisitType | null = isPharmacy
    ? "pharmacy"
    : isRadiology
      ? "radiology"
      : isLaboratory
        ? "laboratory"
        : isConsultation
          ? "consultation"
          : isSurgery
            ? "surgery"
            : null;
  const canAccessHeaderFinalAction =
    (isPharmacy && hasPermission("pharmacy.final")) ||
    ((isRadiology || isLaboratory || isConsultation || isSurgery) &&
      hasPermission("procedure_orders.final"));

  const finalVisitController = useFinalVisitController({
    visitId: id ? Number(id) : 0,
    type: headerFinalVisitType,
    onVisitUpdate: handleVisitUpdate,
    enabled: Boolean(id && headerFinalVisitType),
  });

  const showHeaderFinalAction =
    Boolean(headerFinalVisitType) &&
    canAccessHeaderFinalAction &&
    !finalVisitController.loading;

  const handleSaveActiveTabFromFooter = () => {
    const saved = triggerActiveTabSave();
    if (!saved) {
      toast({
        title: "Simpan tidak tersedia",
        description: "Tab aktif tidak memiliki aksi simpan.",
        variant: "destructive",
      });
    }
  };

  const handleCancelActiveTabFromFooter = () => {
    const footerActionEvent = new CustomEvent<{
      tabId: string;
      action: "save" | "final" | "cancel";
      handled: boolean;
    }>(FOOTER_ACTION_EVENT, {
      detail: {
        tabId: activeTab,
        action: "cancel",
        handled: false,
      },
    });
    window.dispatchEvent(footerActionEvent);

    if (footerActionEvent.detail.handled) {
      return;
    }

    window.location.reload();
  };

  useEffect(() => {
    const root = tabContentContainerRef.current;
    if (!root) return;

    const syncInlineActionButtons = () => {
      const panes = Array.from(root.querySelectorAll<HTMLElement>("[data-mr-tab-pane]"));
      for (const pane of panes) {
        const tabId = pane.dataset.mrTabPane || "";
        const hideInlineActionButtons = shouldUseFooterActionForTab(tabId);
        const buttons = Array.from(pane.querySelectorAll<HTMLButtonElement>("button"));

        for (const button of buttons) {
          const label = (button.textContent || "").trim().toLowerCase();
          const isPrimaryAction = INLINE_PRIMARY_ACTION_REGEX.test(label);
          const hiddenByFooter = button.getAttribute("data-hidden-by-footer") === "true";

          if (hideInlineActionButtons && isPrimaryAction) {
            if (!hiddenByFooter) {
              button.style.display = "none";
              button.setAttribute("aria-hidden", "true");
              button.setAttribute("data-hidden-by-footer", "true");
            }
            continue;
          }

          if (hiddenByFooter) {
            button.style.removeProperty("display");
            button.removeAttribute("aria-hidden");
            button.removeAttribute("data-hidden-by-footer");
          }
        }
      }
    };

    syncInlineActionButtons();

    const observer = new MutationObserver(() => {
      syncInlineActionButtons();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [activeTab, mountedTabs]);

  useEffect(() => {
    const handleIndicatorUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId: string; value: string }>;
      const detail = customEvent.detail;
      if (!detail?.tabId) {
        return;
      }

      setTabIndicators((prev) => {
        if (prev[detail.tabId] === detail.value) return prev;
        return {
          ...prev,
          [detail.tabId]: detail.value,
        };
      });
    };

    const handleSavedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId: string; saved: boolean }>;
      const detail = customEvent.detail;
      if (!detail?.tabId) return;
      setTabSavedStates((prev) => {
        if (prev[detail.tabId] === detail.saved) return prev;
        return { ...prev, [detail.tabId]: detail.saved };
      });
    };

    const handleTabsSavedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabIds: string[]; saved: boolean }>;
      const detail = customEvent.detail;
      if (!detail?.tabIds || !Array.isArray(detail.tabIds)) return;
      setTabSavedStates((prev) => {
        let hasChanges = false;
        const next = { ...prev };
        detail.tabIds.forEach(id => {
          if (next[id] !== detail.saved) {
            next[id] = detail.saved;
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
    };

    window.addEventListener(MEDICAL_RECORD_TAB_INDICATOR_EVENT, handleIndicatorUpdate as EventListener);
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handleSavedUpdate as EventListener);
    window.addEventListener("medical-record-tabs-saved", handleTabsSavedUpdate as EventListener);

    return () => {
      window.removeEventListener(MEDICAL_RECORD_TAB_INDICATOR_EVENT, handleIndicatorUpdate as EventListener);
      window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handleSavedUpdate as EventListener);
      window.removeEventListener("medical-record-tabs-saved", handleTabsSavedUpdate as EventListener);
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
      const triageTextFields = [data.arrival_mode, data.triage_complaint, data.triage_level, data.airway, data.airway_note, data.breathing, data.breathing_note, data.circulation, data.circulation_note, data.blood_pressure, data.triage_assessment, data.immediate_actions, data.pain_method, data.pain_location];
      const filledText = triageTextFields.filter((v: any) => v && String(v).trim() !== "").length;
      const filledNumeric = [
        data.heart_rate, data.respiratory_rate, data.temperature, data.oxygen_saturation, data.pain_scale
      ].filter((v: any) => Number(v) > 0).length;
      const filledGCS = [
        data.gcs_e,
        data.gcs_v,
        data.gcs_m,
      ].filter((v: any) => Number(v) > 0).length;
      emitMedicalRecordTabIndicator("triage", `${filledText + filledNumeric + filledGCS}/22`);
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
    const isBHPEnabledVisit = !visitIsPharmacy && !visitIsConsultation && !visitIsSurgery;
    const hasBHPPermission = hasPermission("medical_records.procedure") || hasPermission("procedure_orders.perform");
    const allowsInpatientOrEmergencyCare = isInpatient || isEmergency;

    // Helper: Render message for wrong visit type
    const renderWrongVisitTypeMessage = (expectedType: string) => (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Tab ini tidak tersedia untuk jenis kunjungan ini.
          Tab ini hanya untuk kunjungan {expectedType}.
        </p>
      </Card>
    );
    const renderPharmacyLockMessage = () => (
      <Card className="mx-auto max-w-2xl border-dashed p-8">
        <div className="space-y-3 text-center">
          <p className="text-base font-semibold">Telaah Awal Harus Diselesaikan</p>
          <p className="text-sm text-muted-foreground">
            Tab farmasi lain masih dikunci. Silakan selesaikan Telaah Awal terlebih dahulu.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              className="rounded-none"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent(PHARMACY_REVIEW_REQUEST_EVENT, {
                    detail: { mode: "initial" },
                  }),
                );
              }}
            >
              Buka Telaah Awal
            </Button>
          </div>
        </div>
      </Card>
    );

    if (visitIsPharmacy && tab !== "prescription-review" && lockedPharmacyTabIds.includes(tab)) {
      return renderPharmacyLockMessage();
    }

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

      case "bersalin":
      case "bersalin-asesmen":
      case "bersalin-skrining":
      case "bersalin-medis":
      case "bersalin-observasi":
      case "bersalin-partograf":
      case "bersalin-catatan":
      case "bersalin-bayi":
        return <BersalinForm visitId={visit.id} patientId={patientId || undefined} onSave={handleVisitUpdate} isPatientDischarged={isPatientDischarged} initialTab={activeTab.replace('bersalin-', '') === 'bersalin' ? 'asesmen' : activeTab.replace('bersalin-', '')} />;
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
      case "body-marker":
        // Body marker only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.physical_exam")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Marker Bagian Tubuh
              </p>
            </Card>
          );
        }
        return (
          <BodyMarkerForm
            visitId={visit.id}
            readOnly={isPatientDischarged}
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
      case "bhp-usage":
        if (!isBHPEnabledVisit) {
          return renderWrongVisitTypeMessage("Rawat Jalan / Rawat Inap / UGD / Laboratorium / Radiologi");
        }
        if (!hasBHPPermission) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Penggunaan BHP
              </p>
            </Card>
          );
        }
        return <BHPUsageForm key={`bhp-usage-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "cppt":
        // CPPT for all visit types
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
        // Nursing care for all visit types
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
      case "fall-risk":
        if (!allowsInpatientOrEmergencyCare) {
          return renderWrongVisitTypeMessage("Rawat Inap / UGD");
        }
        if (!hasPermission("medical_records.fall_risk")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Risiko Jatuh
              </p>
            </Card>
          );
        }
        return <FallRiskForm key={`fall-risk-${visit.id}`} visitId={visit.id} />;
      case "o2-usage":
        if (!allowsInpatientOrEmergencyCare) {
          return renderWrongVisitTypeMessage("Rawat Inap / UGD");
        }
        return <O2UsageForm key={`o2-usage-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "fluid-balance":
        // Fluid balance for all visit types
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
      case "discharge-planning":
        // Discharge planning only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.disposition")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Discharge Planning
              </p>
            </Card>
          );
        }
        return (
          <DischargePlanningForm
            key={`discharge-planning-${visit.id}`}
            visitId={visit.id}
            readOnly={isPatientDischarged}
          />
        );
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
            sourceServiceType={visit.room?.service_type}
            readOnly={isPatientDischarged}
          />
        );
      case "medicine-timesheet":
        // Medicine timesheet only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.medicine_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Timesheet Obat
              </p>
            </Card>
          );
        }
        return (
          <MedicineTimesheetForm
            visitId={visit.id}
            readOnly={isPatientDischarged}
          />
        );
      case "informed-consent":
        // Informed Consent only for clinical visits
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.procedure")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Persetujuan Tindakan
              </p>
            </Card>
          );
        }
        return (
          <InformedConsentContainer
            key={`informed-consent-${visit.id}`}
            visitId={visit.id}
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

      case "document-preview":
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Preview Dokumen
              </p>
            </Card>
          );
        }
        return <DocumentPreviewTab key={`doc-preview-${visit.id}`} visitId={visit.id} readOnly={isPatientDischarged} />;

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
      case "apotek-online":
        if (!hasPermission("pharmacy.dispense")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Apotek Online
              </p>
            </Card>
          );
        }
        return <PharmacyApotekOnline key={`apotek-online-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />;

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
    <div className="medical-record-workspace flex h-full min-h-0 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4">
      <div className="mr-shell grid min-h-0 flex-1 gap-0 border xl:grid-cols-[minmax(240px,15%)_minmax(0,85%)] 2xl:grid-cols-[minmax(260px,15%)_minmax(0,85%)]">
        <aside className="mr-sidebar min-h-0 min-w-0 border-r">
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="min-h-[190px] shrink-0 basis-[30%] border-b">
              <PatientInfo
                visit={visit}
                variant="compact"
                onCopyHistoryOpen={() => setCopyHistoryDrawerOpen(true)}
                onVisitRefresh={() => loadVisit(true)}
              />
            </div>
            <div className="min-h-0 flex-1 basis-[70%]">
              <MedicalRecordTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
                disabledTabIds={isPharmacy ? lockedPharmacyTabIds : []}
                disabledTabReason={pharmacyTabLockReason}
                layout="vertical"
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
                isFemale={isFemale}
              />
            </div>
          </div>
        </aside>

        <main className="mr-main flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
          <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4">
            <div className="flex items-center justify-end gap-2">
              {isCasemixMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none text-xs"
                  onClick={() => {
                    setCasemixContext(false);
                    navigate(`/eklaim/data-klaim/${casemixEklaimId}`);
                  }}
                >
                  Kembali ke E-Klaim
                </Button>
              )}
              <TooltipProvider delayDuration={200}>
                {showHeaderFinalAction && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-none"
                        onClick={() => {
                          if (finalVisitController.isFinal) {
                            void finalVisitController.handleCancelFinal();
                            return;
                          }
                          void finalVisitController.handleFinalize();
                        }}
                        disabled={finalVisitController.submitting || finalVisitController.loading}
                        title={finalVisitController.isFinal ? "Batal Final" : "Final Kunjungan"}
                        aria-label={finalVisitController.isFinal ? "Batal Final" : "Final Kunjungan"}
                      >
                        {finalVisitController.submitting || finalVisitController.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : finalVisitController.isFinal ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {finalVisitController.isFinal ? "Batal Final" : "Final Kunjungan"}
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => setObservationDrawerOpen(true)}
                      title="Observasi"
                      aria-label="Observasi"
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Observasi</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => setCopyHistoryDrawerOpen(true)}
                      disabled={!patientId}
                      title="Riwayat"
                      aria-label="Riwayat"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Riwayat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <MedicalRecordPrintSelect
                        visitId={visit.id}
                        isInpatient={isInpatient}
                        isEmergency={isEmergency}
                        iconOnly
                        triggerClassName="h-8 w-8 rounded-none"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Cetak</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {!!medicalRecordSummary?.visit_medicine_items?.length && (
            <div className="shrink-0 border-b p-3 sm:p-4">
              <VisitMedicineSummary items={medicalRecordSummary?.visit_medicine_items} />
            </div>
          )}

          <div ref={tabContentContainerRef} className="mr-content min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {Array.from(mountedTabs).map(tab => (
              <div
                key={tab}
                data-mr-tab-pane={tab}
                className={tab === activeTab ? "mr-pane" : "hidden"}
              >
                {renderTabContent(tab)}
              </div>
            ))}
            {isPharmacy && visit && !mountedTabs.has("prescription-review") && (
              <div className="hidden">
                <PharmacyReview key={`review-modal-controller-${visit.id}`} visitId={visit.id} readOnly={visit.status === "completed"} />
              </div>
            )}
          </div>

          {!isEditTab && (
            <div className="mr-footer sticky bottom-0 z-20 shrink-0 border-t bg-background px-3 py-2 sm:px-4">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none"
                  onClick={handleCancelActiveTabFromFooter}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Batal
                </Button>
                {!isFooterActionHiddenTab && !isAdministrativeTab && (
                  <Button
                    size="sm"
                    className="h-8 rounded-none"
                    onClick={handleSaveActiveTabFromFooter}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {isFinalTab ? "Final" : isOrderTab ? "Kirim" : "Simpan"}
                  </Button>
                )}
                {activeTab === "informed-consent" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-none"
                    onClick={() => {
                      const footerActionEvent = new CustomEvent<{
                        tabId: string;
                        action: "print";
                        handled: boolean;
                      }>(FOOTER_ACTION_EVENT, {
                        detail: {
                          tabId: activeTab,
                          action: "print",
                          handled: false,
                        },
                      });
                      window.dispatchEvent(footerActionEvent);
                    }}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Cetak
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
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

      <ObservationReportDrawer
        open={observationDrawerOpen}
        onOpenChange={setObservationDrawerOpen}
        visitId={visit.id}
        patientId={patientId || undefined}
        patientName={patientName}
        visitStartAt={visit?.start_time || visit?.check_in_time || visit?.created_at}
        summary={medicalRecordSummary}
      />

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
