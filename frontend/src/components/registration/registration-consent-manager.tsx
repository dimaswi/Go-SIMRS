import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, FileText, ClipboardList } from "lucide-react";
import type { Registration } from "@/lib/api/queue";
import { cn } from "@/lib/utils";
import { GeneralConsentForm } from "./general-consent-form";
import { GeneralConsentInpatientForm } from "./general-consent-inpatient-form";
import { InformedConsentForm } from "./informed-consent-form";

interface RegistrationConsentManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration;
}

export function RegistrationConsentManager({
  open,
  onOpenChange,
  registration,
}: RegistrationConsentManagerProps) {
  const [activeTab, setActiveTab] = useState<string>("");

  const getTabs = () => {
    const type = registration.registration_type;
    const isActuallyInpatient = type === "inpatient" || registration.destination_room?.service_type === "rawat_inap";

    if (isActuallyInpatient) {
      return [
        { id: "general_inpatient", label: "Persetujuan Rawat Inap", icon: <ClipboardList className="w-4 h-4" /> },
        { id: "informed_consent", label: "Persetujuan Tindakan", icon: <FileText className="w-4 h-4" /> },
      ];
    }
    if (type === "emergency" || registration.destination_room?.service_type === "gawat_darurat") {
      return [
        { id: "general_emergency", label: "General Consent", icon: <ClipboardList className="w-4 h-4" /> },
        { id: "informed_consent", label: "Persetujuan Tindakan", icon: <FileText className="w-4 h-4" /> },
      ];
    }
    // Default / Outpatient (Rawat Jalan)
    return [
      { id: "general_outpatient", label: "General Consent", icon: <ClipboardList className="w-4 h-4" /> },
      { id: "informed_consent", label: "Persetujuan Tindakan", icon: <FileText className="w-4 h-4" /> },
    ];
  };

  const tabs = getTabs();

  useEffect(() => {
    if (open && tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [open, tabs, activeTab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden animate-in fade-in duration-200">
      <div className="medical-record-workspace flex h-full min-h-0 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4">

        {/* Header Layout Similar to MR Compact PatientInfo */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold tracking-tight">Manajemen Consent</h2>
            <p className="text-sm text-muted-foreground">
              {registration.patient?.nama_lengkap || registration.patient?.name} &bull; No. RM: {registration.patient?.no_rm || registration.patient?.medical_record_number} &bull; {registration.registration_number}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-none">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="mr-shell flex flex-row min-h-0 flex-1 gap-0 border shadow-sm">
          {/* Sidebar */}
          <aside className="mr-sidebar w-[52px] md:w-[200px] lg:w-[220px] xl:w-[240px] shrink-0 min-h-0 border-r bg-background">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <nav className="flex flex-col space-y-1 p-1 md:p-2">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        title={tab.label}
                        className={cn(
                          "flex items-center justify-center md:justify-start gap-2 p-2 md:px-3 md:py-2 text-sm font-medium transition-colors rounded-md",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted hover:text-foreground text-muted-foreground"
                        )}
                      >
                        <span className="shrink-0">{tab.icon}</span>
                        <span className="hidden md:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="mr-main flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">

            {/* Toolbar Area */}
            <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{tabs.find(t => t.id === activeTab)?.label}</h3>
              </div>
            </div>

            {/* Content Area */}
            <div className="mr-content min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {activeTab === "general_outpatient" || activeTab === "general_emergency" ? (
                <GeneralConsentForm visitId={registration.visit!.id} />
              ) : activeTab === "general_inpatient" ? (
                <GeneralConsentInpatientForm visitId={registration.visit!.id} />
              ) : activeTab === "informed_consent" ? (
                <InformedConsentForm visitId={registration.visit!.id} />
              ) : null}
            </div>

            {/* Footer Area removed as the forms bring their own save buttons */}
          </main>
        </div>
      </div>
    </div>
  );
}
