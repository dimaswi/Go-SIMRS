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
  Users,
  HeartPulse,
  ArrowRightLeft,
  Skull,
  UtensilsCrossed,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission: string;
}

interface MedicalRecordTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isEmergency?: boolean;
  isPharmacy?: boolean;
  isRadiology?: boolean;
  isLaboratory?: boolean;
  isConsultation?: boolean; // Show simplified tabs for consultation visits
  isSurgery?: boolean; // Show surgery workstation tabs for surgery visits
  showProcedureTab?: boolean; // Show procedure tab for rawat_jalan, rawat_inap, gawat_darurat
  isInpatient?: boolean; // Show inpatient tabs (CPPT, Fluid Balance) for rawat_inap
}

export function MedicalRecordTabs({
  activeTab,
  onTabChange,
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

  // Tabs for pharmacy visits
  const pharmacyTabs: Tab[] = [
    {
      id: "prescription-edit",
      label: "Edit Resep",
      icon: <Pill />,
      permission: "pharmacy.edit",
    },
    {
      id: "prescription-review",
      label: "Telaah Resep",
      icon: <FileCheck />,
      permission: "pharmacy.review",
    },
    {
      id: "medicine-dispense",
      label: "Penyerahan Obat",
      icon: <Package />,
      permission: "pharmacy.dispense",
    },
    {
      id: "medicine-return",
      label: "Return Obat",
      icon: <RotateCcw />,
      permission: "pharmacy.return",
    },
    {
      id: "pharmacy-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "pharmacy.final",
    },
  ];

  // Tabs for radiology visits
  const radiologyTabs: Tab[] = [
    {
      id: "radiology-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
    },
    {
      id: "radiology-workstation",
      label: "Pengerjaan Radiologi",
      icon: <FileImage />,
      permission: "procedure_orders.perform",
    },
    {
      id: "radiology-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
    },
  ];

  // Tabs for laboratory visits
  const laboratoryTabs: Tab[] = [
    {
      id: "laboratory-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
    },
    {
      id: "laboratory-workstation",
      label: "Pengerjaan Laboratorium",
      icon: <TestTube />,
      permission: "procedure_orders.perform",
    },
    {
      id: "laboratory-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
    },
  ];

  // Tabs for surgery visits (workstation)
  const surgeryTabs: Tab[] = [
    {
      id: "surgery-edit",
      label: "Edit Order",
      icon: <ClipboardList />,
      permission: "procedure_orders.edit",
    },
    {
      id: "surgery-workstation",
      label: "Pengerjaan Operasi",
      icon: <Scissors />,
      permission: "procedure_orders.perform",
    },
    {
      id: "surgery-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
    },
  ];

  // Tabs for consultation visits - HANYA FORM KONSULTASI SAJA
  const consultationTabs: Tab[] = [
    {
      id: "consultation",
      label: "Konsultasi",
      icon: <Users />,
      permission: "medical_records.cppt",
    },
    {
      id: "consultation-final",
      label: "Final Kunjungan",
      icon: <CheckCircle />,
      permission: "procedure_orders.final",
    },
  ];

  // Tabs for clinical visits
  const clinicalTabs: Tab[] = [
    ...(isEmergency ? [{
      id: "triage",
      label: "Triase",
      icon: <AlertTriangle />,
      permission: "medical_records.triage",
    }] : []),
    {
      id: "anamnesis",
      label: "Anamnesis",
      icon: <FileText />,
      permission: "medical_records.anamnesis",
    },
    {
      id: "physical-exam",
      label: "Pemeriksaan Fisik",
      icon: <Stethoscope />,
      permission: "medical_records.physical_exam",
    },
    {
      id: "diagnosis",
      label: "Diagnosis",
      icon: <Activity />,
      permission: "medical_records.diagnosis",
    },
    {
      id: "assessment-plan",
      label: "Assessment & Plan",
      icon: <ClipboardList />,
      permission: "medical_records.assessment_plan",
    },
    // Procedure tab - show for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
    ...(showProcedureTab ? [{
      id: "procedure",
      label: "Tindakan",
      icon: <Scissors />,
      permission: "medical_records.procedure",
    }] : []),
    // CPPT tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "cppt",
      label: "CPPT",
      icon: <ClipboardCheck />,
      permission: "medical_records.cppt",
    }] : []),
    // Nursing Care tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "nursing-care",
      label: "Asuhan Keperawatan",
      icon: <HeartPulse />,
      permission: "medical_records.nursing_care",
    }] : []),
    // Fluid Balance tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "fluid-balance",
      label: "Balance Cairan",
      icon: <Droplets />,
      permission: "medical_records.fluid_balance",
    }] : []),
    // Bed Transfer tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "bed-transfer",
      label: "Mutasi Pasien",
      icon: <ArrowRightLeft />,
      permission: "medical_records.bed_transfer",
    }] : []),
    // Nutrition Order tab - show for rawat_inap only
    ...(isInpatient ? [{
      id: "nutrition-order",
      label: "Order Gizi",
      icon: <UtensilsCrossed />,
      permission: "medical_records.nutrition_order",
    }] : []),
    {
      id: "medicine-order",
      label: "Order Obat",
      icon: <Pill />,
      permission: "medical_records.medicine_order",
    },
    {
      id: "radiology-order",
      label: "Order Radiologi",
      icon: <FileImage />,
      permission: "medical_records.radiology_order",
    },
    {
      id: "laboratory-order",
      label: "Order Lab",
      icon: <TestTube />,
      permission: "medical_records.laboratory_order",
    },
    {
      id: "consultation-order",
      label: "Order Konsultasi",
      icon: <Users />,
      permission: "medical_records.consultation_order",
    },
    {
      id: "surgery-order",
      label: "Order Operasi",
      icon: <Scissors />,
      permission: "medical_records.surgery_order",
    },
    {
      id: "sick-letter",
      label: "Surat Sakit",
      icon: <FileText />,
      permission: "medical_records.sick_letter",
    },
    {
      id: "death-certificate",
      label: "Surat Kematian",
      icon: <Skull />,
      permission: "medical_records.death_certificate",
    },
    {
      id: "disposition",
      label: "Pasien Pulang",
      icon: <LogOut />,
      permission: "medical_records.disposition",
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

  return (
    <nav className="space-y-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors text-xs",
            activeTab === tab.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className={cn(
            "[&>svg]:h-3.5 [&>svg]:w-3.5",
            activeTab === tab.id ? "text-primary" : "text-muted-foreground/70"
          )}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
