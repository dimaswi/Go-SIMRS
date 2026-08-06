import { useState, useEffect } from "react";
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
    <div>
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
        <div className="space-y-4">
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
