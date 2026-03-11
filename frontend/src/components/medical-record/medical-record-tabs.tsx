import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
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
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
    // Procedure tab - show for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
    ...(showProcedureTab ? [{
      id: "procedure",
      label: "Tindakan",
      icon: <Scissors />,
      permission: "medical_records.procedure",
      section: "care",
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
    // Nutrition Order tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "nutrition-order",
      label: "Order Gizi",
      icon: <UtensilsCrossed />,
      permission: "medical_records.nutrition_order",
      section: "order",
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
      id: "medicine-order",
      label: "Order Obat",
      icon: <Pill />,
      permission: "medical_records.medicine_order",
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
      id: "laboratory-order",
      label: "Order Lab",
      icon: <TestTube />,
      permission: "medical_records.laboratory_order",
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
  }, [tabs.length, updateScrollButtons]);

  useEffect(() => {
    const element = tabScrollRef.current;
    if (!element) {
      return;
    }

    const activeElement = element.querySelector<HTMLButtonElement>(`button[data-tab-id="${activeTab}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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

  return (
    <nav>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => handleScrollTabs("left")}
          disabled={!canScrollLeft}
          className={cn(
            "shrink-0 self-center rounded-md border p-1 transition-colors",
            canScrollLeft
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/40"
          )}
          aria-label="Geser tab ke kiri"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        <div
          ref={tabScrollRef}
          onWheel={handleWheelScrollTabs}
          className="flex-1 overflow-x-auto overscroll-contain"
        >
          <div className="flex min-w-max items-stretch gap-2 px-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const indicatorValue = indicators[tab.id];
              const indicatorStatus = getIndicatorStatus(indicatorValue);
              const savedState = savedStates[tab.id]; // true=saved, false=unsaved, undefined=untouched

              return (
              <button
                key={tab.id}
                type="button"
                data-tab-id={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex min-w-[108px] flex-col items-center justify-center gap-1 px-3 py-2 text-[11px] uppercase tracking-wide transition-colors",
                  getTabStatusClass(indicatorStatus, isActive)
                )}
              >
                <div className="relative [&>svg]:h-4 [&>svg]:w-4">
                  {tab.icon}
                  {savedState === false && (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                  {savedState === true && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500">
                      <Check className="h-2 w-2 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span>{tab.label}</span>
                  {indicatorValue && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                        indicatorStatus === "complete" && "bg-green-100 text-green-700",
                        indicatorStatus === "progress" && "bg-amber-100 text-amber-700",
                        indicatorStatus === "empty" && "bg-red-100 text-red-700",
                        indicatorStatus === "neutral" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {indicatorValue}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "absolute bottom-0 left-3 right-3 h-0.5 rounded-full transition-opacity",
                    isActive
                      ? indicatorStatus === "complete"
                        ? "bg-green-600 opacity-100"
                        : indicatorStatus === "progress"
                        ? "bg-amber-600 opacity-100"
                        : indicatorStatus === "empty"
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
            "shrink-0 self-center rounded-md border p-1 transition-colors",
            canScrollRight
              ? "text-foreground hover:bg-muted"
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
