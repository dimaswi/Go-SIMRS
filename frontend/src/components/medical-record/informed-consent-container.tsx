import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InformedConsentList } from "./informed-consent-list";
import { InformedConsentForm } from "./informed-consent-form";
import { useToast } from "@/hooks/use-toast";
import { printApi } from "@/lib/api/print";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface InformedConsentContainerProps {
  visitId: number;
  readOnly?: boolean;
}

export function InformedConsentContainer({ visitId, readOnly }: InformedConsentContainerProps) {
  const [view, setView] = useState<"list" | "form">("list");
  const [activeConsentId, setActiveConsentId] = useState<number | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    const handleFooterAction = (e: Event) => {
      const event = e as CustomEvent<{ tabId: string; action: string; handled: boolean }>;
      if (event.detail.tabId === "informed-consent") {
        if (event.detail.action === "cancel") {
          if (view === "form") {
            setView("list");
            event.detail.handled = true;
          }
        } else if (event.detail.action === "save") {
          if (view === "form") {
            event.detail.handled = true;
            const form = document.getElementById("informed-consent-form");
            if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
          }
        } else if (event.detail.action === "print") {
          if (view === "form" && activeConsentId) {
            event.detail.handled = true;
            handlePrint(activeConsentId);
          }
        } else if (view === "list") {
          event.detail.handled = true;
          toast({
            title: "Perhatian",
            description: "Silakan klik Edit atau Buat Baru untuk menyimpan data persetujuan tindakan.",
          });
        }
      }
    };
    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction);

    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction);
    };
  }, [view, toast, activeConsentId]);

  const handleCreateNew = () => {
    setActiveConsentId(undefined);
    setView("form");
  };

  const handleEdit = (id: number) => {
    setActiveConsentId(id);
    setView("form");
  };

  const handleSign = (id: number) => {
    setActiveConsentId(id);
    setView("form");
  };

  const handlePrint = async (id: number) => {
    try {
      await printApi.informedConsentReceipt(visitId, id);
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mencetak dokumen",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      {view === "list" && (
        <style>{`
          .mr-footer {
            display: none !important;
          }
        `}</style>
      )}
      {view === "list" ? (
        <InformedConsentList
          visitId={visitId}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onSign={handleSign}
          onPrint={handlePrint}
          readOnly={readOnly}
        />
      ) : (
        <div>
          <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setView("list")}
                className="h-7 rounded-none px-2.5 text-xs gap-1.5 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali
              </Button>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 truncate">
                {activeConsentId ? "Edit Persetujuan Tindakan" : "Buat Persetujuan Tindakan"}
              </span>
            </div>
          </div>
          <InformedConsentForm
            visitId={visitId}
            consentId={activeConsentId}
            readOnly={readOnly}
            onSaved={(newId) => {
              if (!activeConsentId && newId) {
                setActiveConsentId(newId);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
