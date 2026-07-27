import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/lib/store";
import { userPreferencesApi } from "@/lib/api";
import {
  FileText,
  Stethoscope,
  Activity,
  AlertTriangle,
  ClipboardList,
  LogOut,
  Pill,
  Package,
  RotateCcw,
  FileImage,
  TestTube,
  Scissors,
  ClipboardCheck,
  Droplets,
  Check,
  Users,
  HeartPulse,
  ArrowRightLeft,
  UtensilsCrossed,
  Repeat,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  MapPin,
  Cloud,
  Wind,
} from "lucide-react";

interface SubTab {
  id: string;
  label: string;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission: string;
  section: string;
  subTabs?: SubTab[];
}

interface MedicalRecordTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  disabledTabIds?: string[];
  disabledTabReason?: string;
  layout?: "horizontal" | "vertical";
  indicators?: Record<string, string>;
  savedStates?: Record<string, boolean>;
  isEmergency?: boolean;
  isPharmacy?: boolean;
  isRadiology?: boolean;
  isLaboratory?: boolean;
  isConsultation?: boolean; // Show simplified tabs for consultation visits
  isSurgery?: boolean; // Show surgery workstation tabs for surgery visits
  showProcedureTab?: boolean; // Show procedure tab for rawat_jalan, rawat_inap, gawat_darurat
  isInpatient?: boolean; // Show inpatient tabs (CPPT, Fluid Balance) for rawat_inap
  isFemale?: boolean; // Show bersalin and kandungan tabs for female patients
  casemixMode?: boolean; // E-Klaim RM duplicate mode has a fixed tab set.
}

type TabIndicatorStatus = "empty" | "progress" | "complete" | "neutral";

export function MedicalRecordTabs({
  activeTab,
  onTabChange,
  disabledTabIds = [],
  disabledTabReason,
  layout = "horizontal",
  indicators = {},
  savedStates = {},
  isEmergency = false,
  isPharmacy = false,
  isRadiology = false,
  isLaboratory = false,
  isConsultation = false,
  isSurgery = false,
  showProcedureTab = false,
  isInpatient = false,
  isFemale = false,
  casemixMode = false,
}: MedicalRecordTabsProps) {
  const { hasPermission } = usePermission();
  const user = useAuthStore((state) => state.user);
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before");
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    // Clear local expansion state when navigating. 
    // The active parent will stay open automatically because of hasActiveSubTab check.
    setExpandedTabs({});
  }, [activeTab]);

  const showsInpatientOrEmergencyCareTabs = isInpatient || isEmergency;
  const showTriageTab = isEmergency || casemixMode;

  // Tabs for pharmacy visits
  const pharmacyTabs: Tab[] = [
    {
      id: "prescription-edit",
      label: "Edit Resep",
      icon: <Pill />,
      permission: "pharmacy.edit",
      section: "pharmacy",
    },
    {
      id: "medicine-dispense",
      label: "Penyerahan Obat",
      icon: <Package />,
      permission: "pharmacy.dispense",
      section: "pharmacy",
    },
    {
      id: "medicine-return",
      label: "Return Obat",
      icon: <RotateCcw />,
      permission: "pharmacy.return",
      section: "pharmacy",
    },
    {
      id: "apotek-online",
      label: "Apotek Online",
      icon: <Cloud />,
      permission: "pharmacy.dispense", // Adjust permission if needed
      section: "pharmacy",
    },
  ];

  // Tabs for radiology visits
  const radiologyTabs: Tab[] = [
    {
      id: "radiology-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
      section: "radiology",
    },
    {
      id: "radiology-workstation",
      label: "Pengerjaan Radiologi",
      icon: <FileImage />,
      permission: "procedure_orders.perform",
      section: "radiology",
    },
    {
      id: "bhp-usage",
      label: "Penggunaan Film",
      icon: <Package />,
      permission: "procedure_orders.perform",
      section: "radiology",
    },
  ];

  // Tabs for laboratory visits
  const laboratoryTabs: Tab[] = [
    {
      id: "laboratory-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
      section: "laboratory",
    },
    {
      id: "laboratory-workstation",
      label: "Pengerjaan Laboratorium",
      icon: <TestTube />,
      permission: "procedure_orders.perform",
      section: "laboratory",
    },
    {
      id: "bhp-usage",
      label: "Penggunaan Film",
      icon: <Package />,
      permission: "procedure_orders.perform",
      section: "laboratory",
    },
  ];

  // Tabs for surgery visits (workstation)
  const surgeryTabs: Tab[] = [
    {
      id: "surgery-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
      section: "surgery",
    },
    {
      id: "surgery-workstation",
      label: "Pengerjaan Operasi",
      icon: <Scissors />,
      permission: "procedure_orders.perform",
      section: "surgery",
    },
  ];

  // Tabs for consultation visits - HANYA FORM KONSULTASI SAJA
  const consultationTabs: Tab[] = [
    {
      id: "consultation",
      label: "Konsultasi",
      icon: <Users />,
      permission: "medical_records.cppt",
      section: "consultation",
    },
  ];

  // Tabs for clinical visits
  const clinicalTabs: Tab[] = [
    ...(showTriageTab ? [{
      id: "triage",
      label: "Triase",
      icon: <AlertTriangle />,
      permission: "medical_records.triage",
      section: "assessment",
    }] : []),
    {
      id: "anamnesis",
      label: "Anamnesis",
      icon: <FileText />,
      permission: "medical_records.anamnesis",
      section: "assessment",
    },

    {
      id: "physical-exam",
      label: "Pemeriksaan Fisik",
      icon: <Stethoscope />,
      permission: "medical_records.physical_exam",
      section: "assessment",
    },
    ...(isInpatient && isFemale ? [
      {
        id: "bersalin",
        label: "Bersalin",
        icon: <Users />,
        permission: "medical_records.anamnesis",
        section: "assessment",
      } as Tab
    ] : []),
    {
      id: "body-marker",
      label: "Marker Tubuh",
      icon: <MapPin />,
      permission: "medical_records.physical_exam",
      section: "assessment",
    },
    {
      id: "diagnosis",
      label: "Diagnosis",
      icon: <Activity />,
      permission: "medical_records.diagnosis",
      section: "assessment",
    },
    {
      id: "assessment-plan",
      label: "Assessment & Plan",
      icon: <ClipboardList />,
      permission: "medical_records.assessment_plan",
      section: "assessment",
    },
    // Orders - urut: Obat → Tindakan → Lab → Radiologi → Konsultasi → Operasi
    {
      id: "medicine-order",
      label: "Order Obat",
      icon: <Pill />,
      permission: "medical_records.medicine_order",
      section: "order",
    },
    {
      id: "medicine-timesheet",
      label: "Timesheet Obat",
      icon: <Clock3 />,
      permission: "medical_records.medicine_order",
      section: "care",
    },
    // Procedure tab - show for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
    ...(showProcedureTab ? [{
      id: "procedure",
      label: "Tindakan",
      icon: <Scissors />,
      permission: "medical_records.procedure",
      section: "care",
    }] : []),
    {
      id: "bhp-usage",
      label: "Penggunaan Penunjang",
      icon: <Package />,
      permission: "medical_records.procedure",
      section: "care",
    },
    {
      id: "laboratory-order",
      label: "Order Lab",
      icon: <TestTube />,
      permission: "medical_records.laboratory_order",
      section: "order",
    },
    {
      id: "radiology-order",
      label: "Order Radiologi",
      icon: <FileImage />,
      permission: "medical_records.radiology_order",
      section: "order",
    },
    {
      id: "consultation-order",
      label: "Order Konsultasi",
      icon: <Users />,
      permission: "medical_records.consultation_order",
      section: "order",
    },
    {
      id: "surgery-order",
      label: "Order Operasi",
      icon: <Scissors />,
      permission: "medical_records.surgery_order",
      section: "order",
    },
    // Nutrition Order tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "nutrition-order",
      label: "Order Gizi",
      icon: <UtensilsCrossed />,
      permission: "medical_records.nutrition_order",
      section: "order",
    }] : []),
    // CPPT tab - show for all
    {
      id: "cppt",
      label: "CPPT",
      icon: <ClipboardCheck />,
      permission: "medical_records.cppt",
      section: "care",
    },
    // Nursing Care tab - show for all
    {
      id: "nursing-care",
      label: "Asuhan Keperawatan",
      icon: <HeartPulse />,
      permission: "medical_records.nursing_care",
      section: "care",
    },
    // Fall Risk tab - show for rawat_inap and UGD
    ...(showsInpatientOrEmergencyCareTabs ? [{
      id: "fall-risk",
      label: "Risiko Jatuh",
      icon: <AlertTriangle />,
      permission: "medical_records.fall_risk",
      section: "care",
    }] : []),
    // O2 Usage tab - show for rawat_inap and UGD
    ...(showsInpatientOrEmergencyCareTabs ? [{
      id: "o2-usage",
      label: "Oksigen",
      icon: <Wind />,
      permission: "medical_records.nursing_care",
      section: "care",
    }] : []),
    // Fluid Balance tab - show for all
    {
      id: "fluid-balance",
      label: "Balance Cairan",
      icon: <Droplets />,
      permission: "medical_records.fluid_balance",
      section: "care",
    },
    ...(isInpatient ? [{
      id: "discharge-planning",
      label: "Discharge Planning",
      icon: <ClipboardCheck />,
      permission: "medical_records.disposition",
      section: "administrative",
    }] : []),
    // Bed Transfer tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "bed-transfer",
      label: "Mutasi Pasien",
      icon: <ArrowRightLeft />,
      permission: "medical_records.bed_transfer",
      section: "care",
    }] : []),
    // Unit Transfer tab - show for rawat_jalan and gawat_darurat (non-inpatient)
    ...(!isInpatient ? [{
      id: "unit-transfer",
      label: "Mutasi Unit",
      icon: <Repeat />,
      permission: "medical_records.bed_transfer",
      section: "care",
    }] : []),
    {
      id: "surat",
      label: "Surat",
      icon: <FileText />,
      permission: "medical_records.sick_letter",
      section: "administrative",
    },
    {
      id: "document-preview",
      label: "Preview Dokumen",
      icon: <FileText />,
      permission: "medical_records.cppt",
      section: "administrative",
    },
    {
      id: "disposition",
      label: "Pasien Pulang",
      icon: <LogOut />,
      permission: "medical_records.disposition",
      section: "administrative",
    },
  ];

  const casemixClinicalTabs: Tab[] = [
    {
      id: "triage",
      label: "Triase",
      icon: <AlertTriangle />,
      permission: "medical_records.triage",
      section: "assessment",
    },
    {
      id: "anamnesis",
      label: "Anamnesis",
      icon: <FileText />,
      permission: "medical_records.anamnesis",
      section: "assessment",
    },
    {
      id: "physical-exam",
      label: "Pemeriksaan Fisik",
      icon: <Stethoscope />,
      permission: "medical_records.physical_exam",
      section: "assessment",
    },
    {
      id: "body-marker",
      label: "Marker Tubuh",
      icon: <MapPin />,
      permission: "medical_records.physical_exam",
      section: "assessment",
    },
    {
      id: "diagnosis",
      label: "Diagnosis",
      icon: <Activity />,
      permission: "medical_records.diagnosis",
      section: "assessment",
    },
    {
      id: "assessment-plan",
      label: "Assessment & Plan",
      icon: <ClipboardList />,
      permission: "medical_records.assessment_plan",
      section: "assessment",
    },
    {
      id: "procedure",
      label: "Tindakan",
      icon: <Scissors />,
      permission: "medical_records.procedure",
      section: "care",
    },
    {
      id: "laboratory-edit",
      label: "Edit Lab",
      icon: <ClipboardList />,
      permission: "medical_records.procedure",
      section: "laboratory",
    },
    {
      id: "radiology-edit",
      label: "Edit Radiologi",
      icon: <ClipboardList />,
      permission: "medical_records.procedure",
      section: "radiology",
    },
    {
      id: "prescription-edit",
      label: "Edit Farmasi",
      icon: <Pill />,
      permission: "pharmacy.edit",
      section: "pharmacy",
    },
    {
      id: "cppt",
      label: "CPPT",
      icon: <ClipboardCheck />,
      permission: "medical_records.cppt",
      section: "care",
    },
    {
      id: "nursing-care",
      label: "Asuhan Keperawatan",
      icon: <HeartPulse />,
      permission: "medical_records.nursing_care",
      section: "care",
    },
    {
      id: "fall-risk",
      label: "Risiko Jatuh",
      icon: <AlertTriangle />,
      permission: "medical_records.fall_risk",
      section: "care",
    },
    {
      id: "o2-usage",
      label: "Oksigen",
      icon: <Wind />,
      permission: "medical_records.nursing_care",
      section: "care",
    },
    {
      id: "fluid-balance",
      label: "Balance Cairan",
      icon: <Droplets />,
      permission: "medical_records.fluid_balance",
      section: "care",
    },
    {
      id: "discharge-planning",
      label: "Discharge Planning",
      icon: <ClipboardCheck />,
      permission: "medical_records.disposition",
      section: "administrative",
    },
    {
      id: "document-preview",
      label: "Preview Dokumen",
      icon: <FileText />,
      permission: "medical_records.cppt",
      section: "administrative",
    },
  ];

  const allTabs = casemixMode
    ? casemixClinicalTabs
    : isPharmacy
      ? pharmacyTabs
      : isRadiology
        ? radiologyTabs
        : isLaboratory
          ? laboratoryTabs
          : isConsultation
            ? consultationTabs
            : isSurgery
              ? surgeryTabs
              : clinicalTabs;

  // Filter tabs based on permissions
  const tabs = allTabs.filter(tab => hasPermission(tab.permission));
  const tabIdsKey = useMemo(() => tabs.map((tab) => tab.id).join("|"), [tabs]);
  const tabIds = useMemo(() => (tabIdsKey ? tabIdsKey.split("|") : []), [tabIdsKey]);

  const tabOrderStorageMode = useMemo(() => {
    const mode = casemixMode
      ? "casemix"
      : isPharmacy
        ? "pharmacy"
        : isRadiology
          ? "radiology"
          : isLaboratory
            ? "laboratory"
            : isConsultation
              ? "consultation"
              : isSurgery
                ? "surgery"
                : `clinical-${isEmergency ? "emergency" : "regular"}-${isInpatient ? "inpatient" : "noninpatient"}-${showProcedureTab ? "procedure" : "noprocedure"}`;

    return mode;
  }, [casemixMode, isConsultation, isEmergency, isInpatient, isLaboratory, isPharmacy, isRadiology, isSurgery, showProcedureTab]);

  const userScopedTabOrderKey = useMemo(() => {
    const userKey = user?.id ? `u${user.id}` : user?.username ? `name:${user.username}` : "guest";
    return `mr-tabs-order:${userKey}:${tabOrderStorageMode}`;
  }, [tabOrderStorageMode, user?.id, user?.username]);

  const legacyTabOrderKey = useMemo(() => `mr-tabs-order:${tabOrderStorageMode}`, [tabOrderStorageMode]);

  const orderTabIds = useCallback((sourceTabs: Tab[], preferredOrder: string[]) => {
    if (!sourceTabs.length) return [] as Tab[];
    if (!preferredOrder.length) return sourceTabs;

    const tabById = new Map(sourceTabs.map((tab) => [tab.id, tab]));
    const ordered = preferredOrder
      .map((id) => tabById.get(id))
      .filter((tab): tab is Tab => Boolean(tab));
    const missing = sourceTabs.filter((tab) => !preferredOrder.includes(tab.id));

    return [...ordered, ...missing];
  }, []);

  const normalizeOrder = useCallback((candidateOrder: string[], validIds: string[]) => {
    if (!validIds.length) return [] as string[];

    return [
      ...candidateOrder.filter((id) => validIds.includes(id)),
      ...validIds.filter((id) => !candidateOrder.includes(id)),
    ];
  }, []);

  useEffect(() => {
    if (tabIds.length === 0) {
      setTabOrder([]);
      return;
    }

    let cancelled = false;

    const readLocalOrder = (): string[] => {
      try {
        const savedRaw = localStorage.getItem(userScopedTabOrderKey) ?? localStorage.getItem(legacyTabOrderKey);
        const savedOrder = savedRaw ? (JSON.parse(savedRaw) as string[]) : [];
        const normalized = normalizeOrder(savedOrder, tabIds);

        if (!localStorage.getItem(userScopedTabOrderKey) && savedOrder.length > 0) {
          localStorage.setItem(userScopedTabOrderKey, JSON.stringify(normalized));
        }

        return normalized;
      } catch {
        return [...tabIds];
      }
    };

    const syncOrder = async () => {
      const localOrder = readLocalOrder();
      if (!cancelled) {
        setTabOrder(localOrder);
      }

      try {
        const response = await userPreferencesApi.getMedicalRecordTabs(tabOrderStorageMode);
        const serverOrder = Array.isArray(response.data?.tab_order) ? response.data.tab_order : [];
        const normalizedServerOrder = normalizeOrder(serverOrder, tabIds);

        if (cancelled) return;

        if (serverOrder.length > 0) {
          setTabOrder(normalizedServerOrder);
          localStorage.setItem(userScopedTabOrderKey, JSON.stringify(normalizedServerOrder));
          return;
        }

        // Seed backend from existing local preference when server has no value yet.
        const localIsCustom = localOrder.some((id, index) => id !== tabIds[index]);
        if (localIsCustom) {
          await userPreferencesApi.saveMedicalRecordTabs(tabOrderStorageMode, localOrder);
        }
      } catch {
        // Keep local fallback if backend is unavailable.
      }
    };

    void syncOrder();

    return () => {
      cancelled = true;
    };
  }, [legacyTabOrderKey, normalizeOrder, tabIds, tabOrderStorageMode, userScopedTabOrderKey]);

  const orderedTabs = useMemo(() => orderTabIds(tabs, tabOrder), [orderTabIds, tabs, tabOrder]);
  const groupedTabs = useMemo(() => {
    const groups = new Map<string, Tab[]>();
    orderedTabs.forEach((tab) => {
      const existing = groups.get(tab.section) || [];
      existing.push(tab);
      groups.set(tab.section, existing);
    });
    return Array.from(groups.entries());
  }, [orderedTabs]);

  const getIndicatorStatus = (value?: string): TabIndicatorStatus => {
    if (!value) {
      return "neutral";
    }

    const compact = value.replace(/\s+/g, "");
    if (compact.includes("/")) {
      const [left, right] = compact.split("/");
      const filled = Number(left);
      const total = Number(right);

      if (!Number.isFinite(filled) || !Number.isFinite(total) || total <= 0) {
        return "neutral";
      }

      if (filled <= 0) {
        return "empty";
      }

      if (filled >= total) {
        return "complete";
      }

      return "progress";
    }

    const numeric = Number(compact);
    if (!Number.isFinite(numeric)) {
      return "neutral";
    }

    if (numeric <= 0) {
      return "empty";
    }

    return "progress";
  };

  const getTabStatusClass = (status: TabIndicatorStatus, isActive: boolean, hasFractionIndicator: boolean) => {
    if (!hasFractionIndicator) {
      return isActive ? "text-primary" : "text-muted-foreground hover:text-foreground";
    }

    if (isActive) {
      if (status === "complete") return "text-green-600";
      if (status === "progress") return "text-amber-600";
      return "text-primary";
    }

    if (status === "complete") return "text-green-600";
    if (status === "progress") return "text-amber-600";
    return "text-muted-foreground hover:text-foreground";
  };

  const updateScrollButtons = useCallback(() => {
    const element = tabScrollRef.current;
    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(element.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();

    const element = tabScrollRef.current;
    if (!element) {
      return;
    }

    const handleResize = () => updateScrollButtons();
    element.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", handleResize);

    return () => {
      element.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", handleResize);
    };
  }, [orderedTabs.length, updateScrollButtons]);

  useEffect(() => {
    const element = tabScrollRef.current;
    if (!element) {
      return;
    }

    const activeElement = element.querySelector<HTMLButtonElement>(`button[data-tab-id="${activeTab}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  const handleScrollTabs = (direction: "left" | "right") => {
    const element = tabScrollRef.current;
    if (!element) {
      return;
    }

    const amount = Math.max(220, Math.round(element.clientWidth * 0.45));
    element.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleWheelScrollTabs = (event: React.WheelEvent<HTMLDivElement>) => {
    const element = tabScrollRef.current;
    if (!element) {
      return;
    }

    const hasHorizontalOverflow = element.scrollWidth > element.clientWidth;
    if (!hasHorizontalOverflow) {
      return;
    }

    // Convert vertical wheel gesture to horizontal tab scrolling.
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    element.scrollBy({ left: delta, behavior: "auto" });
  };

  const handleContainerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingTabId) return;
    const element = tabScrollRef.current;
    if (!element) return;

    event.preventDefault();

    // Auto-scroll horizontally when dragging near left/right edges.
    const rect = element.getBoundingClientRect();
    const edge = 48;
    const speed = 18;

    if (event.clientX < rect.left + edge) {
      element.scrollBy({ left: -speed, behavior: "auto" });
    } else if (event.clientX > rect.right - edge) {
      element.scrollBy({ left: speed, behavior: "auto" });
    }
  };

  const persistTabOrder = useCallback((nextOrder: string[]) => {
    try {
      localStorage.setItem(userScopedTabOrderKey, JSON.stringify(nextOrder));
    } catch {
      // Ignore persistence errors (private mode/full storage)
    }

    void userPreferencesApi.saveMedicalRecordTabs(tabOrderStorageMode, nextOrder).catch(() => {
      // Keep local preference even if backend save fails.
    });
  }, [tabOrderStorageMode, userScopedTabOrderKey]);

  const handleDropOnTab = (targetTabId: string, position: "before" | "after") => {
    if (!draggingTabId || draggingTabId === targetTabId) return;

    const container = tabScrollRef.current;
    const previousPositions = new Map<string, DOMRect>();
    if (container) {
      container.querySelectorAll<HTMLButtonElement>("button[data-tab-id]").forEach((el) => {
        const id = el.dataset.tabId;
        if (id) previousPositions.set(id, el.getBoundingClientRect());
      });
    }

    const currentOrder = orderedTabs.map((tab) => tab.id);
    const fromIndex = currentOrder.indexOf(draggingTabId);
    const toIndex = currentOrder.indexOf(targetTabId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);

    // Insert before/after target, adjusted for removed source index.
    const targetIndexAfterRemoval = nextOrder.indexOf(targetTabId);
    const insertIndex = position === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
    nextOrder.splice(insertIndex, 0, moved);

    setTabOrder(nextOrder);
    persistTabOrder(nextOrder);
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDragOverPosition("before");

    // Animate tab chips to their new positions (FLIP) for a Chrome-like drag reorder feel.
    requestAnimationFrame(() => {
      const nextContainer = tabScrollRef.current;
      if (!nextContainer) return;

      nextContainer.querySelectorAll<HTMLButtonElement>("button[data-tab-id]").forEach((el) => {
        const id = el.dataset.tabId;
        if (!id) return;

        const previous = previousPositions.get(id);
        if (!previous) return;

        const next = el.getBoundingClientRect();
        const dx = previous.left - next.left;
        const dy = previous.top - next.top;

        if (dx !== 0 || dy !== 0) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = "transform 0s";

          requestAnimationFrame(() => {
            el.style.transform = "";
            el.style.transition = "transform 250ms cubic-bezier(0.2, 0, 0, 1)";
          });
        }
      });
    });
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
    setDraggingTabId(tabId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);

    // Use a transparent drag image to avoid the default browser "ghost" image.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 1, 1);
    event.dataTransfer.setDragImage(canvas, 0, 0);
  };

  const handleDragOverTab = (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
    if (!draggingTabId || draggingTabId === tabId) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = layout === "horizontal" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    const position = (layout === "horizontal" ? event.clientX : event.clientY) > midpoint ? "after" : "before";

    if (tabId !== dragOverTabId || position !== dragOverPosition) {
      setDragOverTabId(tabId);
      setDragOverPosition(position);
    }
  };

  const handleDragEnd = () => {
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDragOverPosition("before");
  };

  const renderTab = (tab: Tab) => {
    const isActive = activeTab === tab.id;
    const isDisabled = disabledTabIds.includes(tab.id);
    const indicatorValue = indicators[tab.id];
    const indicatorStatus = getIndicatorStatus(indicatorValue);
    const hasFractionIndicator = Boolean(indicatorValue?.replace(/\s+/g, "").includes("/"));
    const isSaved = savedStates[tab.id];
    const isDraggingThis = draggingTabId === tab.id;
    const isDragOverThis = dragOverTabId === tab.id;

    const indicatorClass = (() => {
      if (!hasFractionIndicator) {
        return isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
      }

      if (indicatorStatus === "complete") {
        return "bg-green-100 text-green-700";
      }

      if (indicatorStatus === "progress") {
        return "bg-amber-100 text-amber-700";
      }

      return isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
    })();

    const tabStatusIcon = (() => {
      if (hasFractionIndicator) {
        if (indicatorStatus === "complete") {
          return <Check className="h-4 w-4" />;
        }
        if (indicatorStatus === "progress") {
          return <Clock3 className="h-4 w-4" />;
        }
      }
      return isSaved ? <Check className="h-4 w-4" /> : tab.icon;
    })();

    const iconClass = (() => {
      if (hasFractionIndicator) {
        if (indicatorStatus === "complete") {
          return "bg-green-100 text-green-700";
        }
        if (indicatorStatus === "progress") {
          return "bg-amber-100 text-amber-700";
        }
      }
      return isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground";
    })();

    const tabContent = (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md [&>svg]:h-4 [&>svg]:w-4",
              iconClass,
            )}
          >
            {tabStatusIcon}
          </div>
          <span className="truncate text-left text-[13px] leading-tight" title={tab.label}>{tab.label}</span>
        </div>
        {indicatorValue && !tab.subTabs && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              indicatorClass,
            )}
          >
            {indicatorValue}
          </span>
        )}
        {tab.subTabs && tab.subTabs.length > 0 && (
          <div className="ml-auto flex items-center justify-center shrink-0">
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", (expandedTabs[tab.id] || activeTab === tab.id || (tab.subTabs && tab.subTabs.some(st => activeTab === st.id))) ? "rotate-180" : "")} />
          </div>
        )}
      </>
    );

    const hasActiveSubTab = tab.subTabs && tab.subTabs.some(st => activeTab === st.id);
    const isExpanded = expandedTabs[tab.id] || activeTab === tab.id || hasActiveSubTab;

    return (
      <div
        key={tab.id}
        className={cn(
          "mr-tab-item relative",
          isDraggingThis && "opacity-40",
          isDragOverThis && dragOverPosition === "before" && (layout === "horizontal" ? "border-l-2 border-primary" : "border-t-2 border-primary"),
          isDragOverThis && dragOverPosition === "after" && (layout === "horizontal" ? "border-r-2 border-primary" : "border-b-2 border-primary"),
        )}
      >
        <button
          data-tab-id={tab.id}
          onClick={() => {
            if (!isDisabled) {
              if (tab.subTabs && tab.subTabs.length > 0) {
                // Just toggle expansion locally without triggering a route change/API call
                setExpandedTabs(prev => ({ ...prev, [tab.id]: !isExpanded }));
              } else {
                onTabChange(tab.id);
              }
            }
          }}
          title={isDisabled ? (disabledTabReason || "Tab dikunci sampai telaah awal selesai") : tab.label}
          aria-disabled={isDisabled}
          disabled={isDisabled}
          draggable
          onDragStart={(e) => handleDragStart(e, tab.id)}
          onDragOver={(e) => handleDragOverTab(e, tab.id)}
          onDragEnd={handleDragEnd}
          onDrop={(e) => {
            e.preventDefault();
            const droppedTabId = e.dataTransfer.getData("text/plain");
            if (droppedTabId) {
              handleDropOnTab(tab.id, dragOverPosition);
            }
          }}
          className={cn(
            "mr-tab-chip flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            isDisabled && "cursor-not-allowed opacity-60",
            (isActive || isExpanded)
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {tabContent}
        </button>

        {tab.subTabs && isExpanded && layout === "vertical" && (
          <div className="mt-1 flex flex-col gap-1 relative before:absolute before:left-[19px] before:top-0 before:bottom-3 before:w-px before:bg-border">
            {tab.subTabs.map(subTab => {
              const isSubActive = activeTab === subTab.id;
              const isSubSaved = savedStates[subTab.id];
              
              return (
                <button
                  key={subTab.id}
                  onClick={() => onTabChange(subTab.id)}
                  className={cn(
                    "mr-tab-chip flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors relative",
                    isSubActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center shrink-0 z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-border mr-1"></div>
                    </div>
                    <span className="truncate text-left text-[13px] leading-tight">{subTab.label}</span>
                  </div>
                  {isSubSaved && (
                    <span className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const sectionLabels: Record<string, string> = {
    assessment: "Asesmen",
    bersalin: "Bersalin",
    order: "Order",
    care: "Perawatan & Tindakan",
    administrative: "Administratif",
    pharmacy: "Farmasi",
    radiology: "Radiologi",
    laboratory: "Laboratorium",
    surgery: "Operasi",
    consultation: "Konsultasi",
  };

  if (layout === "vertical") {
    return (
      <div className="mr-tabs mr-tabs-vertical flex h-full flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-1.5 pb-3">
          <div className="space-y-2.5">
            {groupedTabs.map(([section, sectionTabs]) => (
              <div key={section}>
                <h3 className="mr-tab-section-title mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sectionLabels[section] || section}
                </h3>
                <div className="space-y-1">
                  {sectionTabs.map(renderTab)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className="mr-tabs mr-tabs-horizontal relative rounded-xl bg-background shadow-sm ring-1 ring-border">
      {canScrollLeft && (
        <div className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-background via-background/80 to-transparent pr-6">
          <button
            onClick={() => handleScrollTabs("left")}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-all hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      )}
      <div
        ref={tabScrollRef}
        className="flex items-center gap-2 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={handleWheelScrollTabs}
        onDragOver={handleContainerDragOver}
      >
        {orderedTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const indicatorValue = indicators[tab.id];
          const isSaved = savedStates[tab.id];
          const indicatorStatus = getIndicatorStatus(indicatorValue);
          const hasFractionIndicator = Boolean(indicatorValue?.replace(/\s+/g, "").includes("/"));
          const isDraggingThis = draggingTabId === tab.id;
          const isDragOverThis = dragOverTabId === tab.id;

          const horizontalStatusIcon = (() => {
            if (hasFractionIndicator) {
              if (indicatorStatus === "complete") {
                return <Check className="h-6 w-6" />;
              }
              if (indicatorStatus === "progress") {
                return <Clock3 className="h-6 w-6" />;
              }
            }
            return isSaved ? <Check className="h-6 w-6" /> : tab.icon;
          })();

          return (
            <div
              key={tab.id}
              className={cn(
                "mr-tab-item relative shrink-0",
                isDraggingThis && "opacity-40",
                isDragOverThis && dragOverPosition === "before" && "border-l-2 border-primary",
                isDragOverThis && dragOverPosition === "after" && "border-r-2 border-primary",
              )}
            >
              <button
                data-tab-id={tab.id}
                onClick={() => {
                  if (!disabledTabIds.includes(tab.id)) {
                    onTabChange(tab.id);
                  }
                }}
                title={disabledTabIds.includes(tab.id) ? (disabledTabReason || "Tab dikunci sampai telaah awal selesai") : tab.label}
                aria-disabled={disabledTabIds.includes(tab.id)}
                disabled={disabledTabIds.includes(tab.id)}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOverTab(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedTabId = e.dataTransfer.getData("text/plain");
                  if (droppedTabId) {
                    handleDropOnTab(tab.id, dragOverPosition);
                  }
                }}
                className={cn(
                  "mr-tab-chip mr-tab-chip-horizontal flex flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors",
                  "w-28 h-24", // Fixed size for horizontal tabs
                  disabledTabIds.includes(tab.id) && "cursor-not-allowed opacity-60",
                  getTabStatusClass(indicatorStatus, isActive, hasFractionIndicator),
                  isActive && "bg-primary/10",
                )}
              >
                <div className="relative">
                  {horizontalStatusIcon}
                  {indicatorValue && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-current px-1 text-[10px] font-bold text-background">
                      {indicatorValue}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium leading-tight">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      {canScrollRight && (
        <div className="absolute right-0 top-0 z-10 flex h-full items-center bg-gradient-to-l from-background via-background/80 to-transparent pl-6">
          <button
            onClick={() => handleScrollTabs("right")}
            className="mr-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-all hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
