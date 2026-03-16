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
  FileCheck,
  Package,
  RotateCcw,
  FileImage,
  TestTube,
  Scissors,
  ClipboardCheck,
  Droplets,
  CheckCircle,
  Check,
  Users,
  HeartPulse,
  ArrowRightLeft,
  UtensilsCrossed,
  Repeat,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission: string;
  section: string;
}

interface MedicalRecordTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
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
}

type TabIndicatorStatus = "empty" | "progress" | "complete" | "neutral";

export function MedicalRecordTabs({
  activeTab,
  onTabChange,
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
      id: "prescription-review",
      label: "Telaah Resep",
      icon: <FileCheck />,
      permission: "pharmacy.review",
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
      id: "pharmacy-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "pharmacy.final",
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
      id: "radiology-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
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
      id: "laboratory-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
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
    {
      id: "surgery-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
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
    {
      id: "consultation-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
      section: "consultation",
    },
  ];

  // Tabs for clinical visits
  const clinicalTabs: Tab[] = [
    ...(isEmergency ? [{
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
    // Procedure tab - show for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
    ...(showProcedureTab ? [{
      id: "procedure",
      label: "Tindakan",
      icon: <Scissors />,
      permission: "medical_records.procedure",
      section: "care",
    }] : []),
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
    // CPPT tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "cppt",
      label: "CPPT",
      icon: <ClipboardCheck />,
      permission: "medical_records.cppt",
      section: "care",
    }] : []),
    // Nursing Care tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "nursing-care",
      label: "Asuhan Keperawatan",
      icon: <HeartPulse />,
      permission: "medical_records.nursing_care",
      section: "care",
    }] : []),
    // Fluid Balance tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "fluid-balance",
      label: "Balance Cairan",
      icon: <Droplets />,
      permission: "medical_records.fluid_balance",
      section: "care",
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
      id: "disposition",
      label: "Pasien Pulang",
      icon: <LogOut />,
      permission: "medical_records.disposition",
      section: "administrative",
    },
  ];

  const allTabs = isPharmacy
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
    const mode = isPharmacy
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
  }, [isConsultation, isEmergency, isInpatient, isLaboratory, isPharmacy, isRadiology, isSurgery, showProcedureTab]);

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

  const getTabStatusClass = (status: TabIndicatorStatus, isActive: boolean) => {
    if (isActive) {
      if (status === "complete") return "text-green-600";
      if (status === "progress") return "text-amber-600";
      if (status === "empty") return "text-red-600";
      return "text-primary";
    }

    if (status === "complete") return "text-green-600";
    if (status === "progress") return "text-amber-600";
    if (status === "empty") return "text-red-600";
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
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }
        );
      });
    });
  };

  return (
    <nav className="medical-record-tabs">
      <div className="flex h-10 items-center gap-1 rounded-md border bg-background p-1 shadow-sm">
        <button
          type="button"
          onClick={() => handleScrollTabs("left")}
          disabled={!canScrollLeft}
          className={cn(
            "shrink-0 self-center rounded-md p-1 transition-colors",
            canScrollLeft
              ? "text-foreground hover:bg-accent"
              : "text-muted-foreground/40"
          )}
          aria-label="Geser tab ke kiri"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        <div
          ref={tabScrollRef}
          onWheel={handleWheelScrollTabs}
          onDragOver={handleContainerDragOver}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragOverTabId(null);
          }}
          className="flex-1 overflow-x-auto overscroll-contain"
        >
          <div className="flex min-w-max items-center gap-1 px-0.5">
            {orderedTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const indicatorValue = indicators[tab.id];
              const indicatorStatus = getIndicatorStatus(indicatorValue);
              const isOrderTab = ["medicine-order", "radiology-order", "laboratory-order", "consultation-order", "surgery-order"].includes(tab.id);
              const effectiveStatus = isOrderTab ? "neutral" : indicatorStatus;
              const savedState = savedStates[tab.id]; // true=saved, false=unsaved, undefined=untouched

              return (
              <button
                key={tab.id}
                type="button"
                data-tab-id={tab.id}
                draggable
                onDragStart={(event) => {
                  setDraggingTabId(tab.id);
                  setDragOverTabId(null);
                  setDragOverPosition("before");
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggingTabId(null);
                  setDragOverTabId(null);
                  setDragOverPosition("before");
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (draggingTabId && draggingTabId !== tab.id) {
                    setDragOverTabId(tab.id);
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    const isAfter = event.clientX > rect.left + rect.width / 2;
                    setDragOverPosition(isAfter ? "after" : "before");
                  }
                }}
                onDragLeave={() => {
                  if (dragOverTabId === tab.id) {
                    setDragOverTabId(null);
                  }
                }}
                onDrop={() => handleDropOnTab(tab.id, dragOverPosition)}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "group relative inline-flex h-9 sm:h-8 min-w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 sm:px-2.5 text-[13px] sm:text-xs font-medium transition-[color,background-color,opacity,transform,box-shadow] duration-200",
                  isActive
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  draggingTabId === tab.id && "z-20 scale-105 -translate-y-0.5 bg-background text-foreground shadow-lg ring-2 ring-orange-500/60 opacity-45",
                  dragOverTabId === tab.id && draggingTabId !== tab.id && "ring-2 ring-orange-500/80 bg-orange-100/60",
                  dragOverTabId === tab.id && draggingTabId !== tab.id && dragOverPosition === "before" && "translate-x-1",
                  dragOverTabId === tab.id && draggingTabId !== tab.id && dragOverPosition === "after" && "-translate-x-1",
                  getTabStatusClass(effectiveStatus, isActive)
                )}
                title="Klik untuk buka tab"
              >
                {dragOverTabId === tab.id && draggingTabId !== tab.id && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-y-0.5 w-1 rounded-full bg-orange-600 animate-pulse shadow-[0_0_0_1px_rgba(255,255,255,0.55),0_0_12px_rgba(234,88,12,0.95)]",
                      dragOverPosition === "before" ? "left-0" : "right-0"
                    )}
                  />
                )}
                <div className="relative [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {tab.icon}
                  {savedState === false && (
                    <span className="absolute -right-1.5 -top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                  {savedState === true && (
                    <span className="absolute -right-1.5 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500">
                      <Check className="h-1.5 w-1.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap leading-none">
                  <span>{tab.label}</span>
                  {indicatorValue && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                        isOrderTab
                          ? Number(indicatorValue) > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-600 text-slate-100"
                          : indicatorStatus === "complete"
                          ? "bg-green-100 text-green-700"
                          : indicatorStatus === "progress"
                          ? "bg-amber-100 text-amber-700"
                          : indicatorStatus === "empty"
                          ? "bg-red-100 text-red-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {indicatorValue}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-opacity",
                    isActive
                      ? effectiveStatus === "complete"
                        ? "bg-green-600 opacity-100"
                        : effectiveStatus === "progress"
                        ? "bg-amber-600 opacity-100"
                        : effectiveStatus === "empty"
                        ? "bg-red-600 opacity-100"
                        : "bg-primary opacity-100"
                      : "opacity-0"
                  )}
                />
              </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleScrollTabs("right")}
          disabled={!canScrollRight}
          className={cn(
            "shrink-0 self-center rounded-md p-1 transition-colors",
            canScrollRight
              ? "text-foreground hover:bg-accent"
              : "text-muted-foreground/40"
          )}
          aria-label="Geser tab ke kanan"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </nav>
  );
}
