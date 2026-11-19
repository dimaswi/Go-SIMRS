import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X, ClipboardList, FileCheck2 } from "lucide-react";
import type { Registration } from "@/lib/api/queue";
import { cn } from "@/lib/utils";
import { GeneralConsentForm } from "./general-consent-form";
import { GeneralConsentInpatientForm } from "./general-consent-inpatient-form";

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

  const tabs = useMemo(() => {
    const type = registration.registration_type;
    const isActuallyInpatient =
      type === "inpatient" || registration.destination_room?.service_type === "rawat_inap";

    if (isActuallyInpatient) {
      return [
        {
          id: "general_outpatient",
          label: "Persetujuan Umum",
          code: "RM-02",
          icon: <ClipboardList className="w-4 h-4" />,
        },
        {
          id: "general_inpatient",
          label: "Persetujuan Rawat Inap",
          code: "RM-03",
          icon: <FileCheck2 className="w-4 h-4" />,
        },
      ];
    }
    if (type === "emergency" || registration.destination_room?.service_type === "gawat_darurat") {
      return [
        {
          id: "general_emergency",
          label: "Persetujuan Umum",
          code: "RM-02",
          icon: <ClipboardList className="w-4 h-4" />,
        },
      ];
    }
    return [
      {
        id: "general_outpatient",
        label: "Persetujuan Umum",
        code: "RM-02",
        icon: <ClipboardList className="w-4 h-4" />,
      },
    ];
  }, [registration.registration_type, registration.destination_room?.service_type]);

  useEffect(() => {
    if (open && tabs.length > 0 && (!activeTab || !tabs.some((t) => t.id === activeTab))) {
      setActiveTab(tabs[0].id);
    }
  }, [open, tabs, activeTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const patientName = registration.patient?.nama_lengkap || registration.patient?.name || "-";
  const patientNoRm = registration.patient?.no_rm || registration.patient?.medical_record_number || "-";
  const visitId = registration.visit?.id;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-neutral-950 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="flex flex-1 min-h-0 flex-col border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        {/* Top Unified Admin Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
              <FileCheck2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
                Manajemen Consent
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono text-neutral-500">
                <span className="font-sans font-semibold text-neutral-800 dark:text-neutral-200">
                  {patientName}
                </span>
                <span>•</span>
                <span>No. RM: {patientNoRm}</span>
                <span>•</span>
                <span>{registration.registration_number}</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-none border-neutral-200 dark:border-neutral-800 px-2.5 text-xs"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Tutup
          </Button>
        </div>

        {/* Workspace Container */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
          {/* Show document sidebar only when multiple consent documents apply (e.g. Rawat Inap) */}
          {tabs.length > 1 && (
            <aside className="shrink-0 w-full md:w-56 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 p-2">
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 hidden md:block">
                Daftar Dokumen
              </div>
              <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors border-l-2 shrink-0 md:shrink",
                        isActive
                          ? "border-neutral-900 dark:border-white bg-white dark:bg-neutral-950 font-semibold text-neutral-900 dark:text-white shadow-xs"
                          : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-white/70 dark:hover:bg-neutral-900 hover:text-neutral-900"
                      )}
                    >
                      <span className="shrink-0">{tab.icon}</span>
                      <div className="min-w-0">
                        <div className="truncate">{tab.label}</div>
                        <div className="font-mono text-[10px] text-neutral-400">{tab.code}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Main Form Area (Non-overlapping scroll + pinned footer handled inside each form) */}
          <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-neutral-950">
            {!visitId ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Data kunjungan untuk pendaftaran ini belum tersedia.
              </div>
            ) : activeTab === "general_outpatient" || activeTab === "general_emergency" ? (
              <GeneralConsentForm visitId={visitId} />
            ) : activeTab === "general_inpatient" ? (
              <GeneralConsentInpatientForm visitId={visitId} />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
