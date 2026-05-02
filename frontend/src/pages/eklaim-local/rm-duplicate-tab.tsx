import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { eklaimLocalApi } from "@/lib/api/eklaim-local";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { setCasemixContext } from "@/lib/api/client";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { TriageForm } from "@/components/medical-record/triage-form";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { SurgeryWorkstation } from "../../components/medical-record/surgery-workstation";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { FallRiskForm } from "@/components/medical-record/fall-risk-form";
import { O2UsageForm } from "@/components/medical-record/o2-usage-form";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { SurgeryOrderForm } from "@/components/medical-record/surgery-order-form";
import { ArrowLeft } from "lucide-react";

interface RMDuplicateTabProps {
  eklaimId: number;
  visit?: any;
  onSaved: () => void;
  stickyTopOffset?: number;
}

export function RMDuplicateTab({
  eklaimId,
  visit,
  onSaved,
}: RMDuplicateTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("anamnesis");
  const [syncing, setSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set global casemix context so all medical record API calls
    // automatically append ?is_casemix=true & casemix_eklaim_id=eklaimId
    setCasemixContext(true, eklaimId);

    return () => {
      // Clear context on unmount
      setCasemixContext(false);
    };
  }, [eklaimId]);

  const handleSyncFromOriginal = async () => {
    if (!visit?.sep_id) {
      toast({ title: "Gagal", description: "SEP ID tidak ditemukan", variant: "destructive" });
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin menarik data dari RM Asli? Data casemix saat ini akan diganti seluruhnya.")) {
      return;
    }
    try {
      setSyncing(true);
      await eklaimLocalApi.duplicateRM(visit.sep_id);
      toast({ title: "Berhasil", description: "Data berhasil ditarik dari RM Asli." });
      onSaved(); // trigger reload
      window.location.reload(); // Refresh to reflect new data
    } catch (error: any) {
      toast({ title: "Gagal", description: "Gagal menarik data dari RM Asli", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const triggerActiveTabSave = (): boolean => {
    if (!activeTab || !containerRef.current) return false;

    const activePane = containerRef.current.querySelector<HTMLElement>(`[data-mr-tab-pane="${activeTab}"]`);
    if (!activePane) return false;

    // Check for form submit
    const activeForm = activePane.querySelector<HTMLFormElement>("form");
    if (activeForm) {
      activeForm.requestSubmit();
      return true;
    }

    // Check for inline save button
    const INLINE_PRIMARY_ACTION_REGEX = /^(simpan|final|kirim|tambah|tambahkan|selesai|simpan (triage|anamnesis|pemeriksaan|diagnosa|assessment|disposisi|order|cppt|balance|asuhan))/i;
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

  const visitId = visit?.id || 0;

  // Derive flags exactly like visits/show.tsx
  const isEmergency = visit?.room?.service_type === "gawat_darurat";
  const isInpatient = visit?.room?.service_type === "rawat_inap";
  const isPharmacy = visit?.visit_type === "pharmacy";
  const isRadiology = visit?.visit_type === "radiology";
  const isLaboratory = visit?.visit_type === "lab";
  const isConsultation = visit?.visit_type === "consultation" && !!visit?.referral_from;
  const isSurgery = visit?.visit_type === "surgery";
  const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
  const showProcedureTab = allowedServiceTypes.includes(visit?.room?.service_type || "");

  return (
    <div className="medical-record-workspace flex flex-1 min-h-0 flex-col" ref={containerRef}>
      <div className="mr-shell grid min-h-0 flex-1 gap-0 border xl:grid-cols-[minmax(240px,15%)_minmax(0,85%)] 2xl:grid-cols-[minmax(260px,15%)_minmax(0,85%)]">

        {/* LEFT SIDEBAR (Patient Info + Vertical Tabs) */}
        <aside className="mr-sidebar min-h-0 min-w-0 border-r">
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            {/* Patient Info Component identical to original RM */}
            <div className="min-h-[190px] shrink-0 basis-[30%] border-b">
              {visit && (
                <PatientInfo
                  visit={visit}
                  variant="compact"
                />
              )}
            </div>
            {/* Medical Record Tabs (Vertical layout) - same flags as visits/show.tsx */}
            <div className="min-h-0 flex-1 basis-[70%]">
              <MedicalRecordTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                layout="vertical"
                isEmergency={isEmergency}
                isInpatient={isInpatient}
                showProcedureTab={showProcedureTab}
                isLaboratory={isLaboratory}
                isRadiology={isRadiology}
                isSurgery={isSurgery}
                isPharmacy={isPharmacy}
                isConsultation={isConsultation}
              />
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="mr-main flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">

          {/* Top Toolbar */}
          <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <Button onClick={() => window.history.back()} variant="ghost" size="sm" className="rounded-none">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </Button>
              <Button onClick={handleSyncFromOriginal} disabled={syncing || !visit?.sep_id} variant="outline" size="sm" className="rounded-none">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="mr-content relative flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6" data-mr-tab-pane={activeTab}>
            {activeTab === "triage" && <TriageForm visitId={visitId} />}
            {activeTab === "anamnesis" && <AnamnesisForm visitId={visitId} />}
            {activeTab === "physical-exam" && <PhysicalExamForm visitId={visitId} />}
            {activeTab === "diagnosis" && <DiagnosisForm visitId={visitId} />}
            {activeTab === "procedure" && <ProcedureForm visitId={visitId} />}
            {activeTab === "assessment-plan" && <AssessmentPlanForm visitId={visitId} />}
            {activeTab === "disposition" && <DispositionForm visitId={visitId} />}

            {activeTab === "laboratory-edit" && <LaboratoryWorkstation visitId={visitId} />}
            {activeTab === "radiology-edit" && <RadiologyWorkstation visitId={visitId} />}
            {activeTab === "surgery-edit" && <SurgeryWorkstation visitId={visitId} />}
            {activeTab === "consultation" && <ConsultationForm visitId={visitId} />}
            {activeTab === "prescription-edit" && <PharmacyEditPrescription visitId={visitId} />}

            {/* ORDER FORMS */}
            {activeTab === "medicine-order" && <MedicineOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} sourceServiceType={visit?.room?.service_type} />}
            {activeTab === "laboratory-order" && <LaboratoryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "radiology-order" && <RadiologyOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "consultation-order" && <ConsultationOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}
            {activeTab === "surgery-order" && <SurgeryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />}

            {activeTab === "cppt" && <CPPTForm visitId={visitId} />}
            {activeTab === "fluid-balance" && <FluidBalanceForm visitId={visitId} />}
            {activeTab === "nursing-care" && <NursingCareForm visitId={visitId} />}
            {activeTab === "fall-risk" && <FallRiskForm visitId={visitId} />}
            {activeTab === "o2-usage" && <O2UsageForm visitId={visitId} />}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="mr-footer sticky bottom-0 z-20 shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-none w-24 sm:w-28"
                onClick={() => window.location.reload()}
              >
                Batal
              </Button>
              <Button
                className="rounded-none w-24 sm:w-28"
                onClick={handleSaveActiveTabFromFooter}
              >
                Simpan
              </Button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
