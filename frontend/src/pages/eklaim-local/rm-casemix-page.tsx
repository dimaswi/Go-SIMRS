/**
 * rm-casemix-page.tsx
 * Halaman Rekam Medis Casemix — identik 100% dengan visits/show.tsx.
 * Di-render langsung dari router tanpa wrapper eklaim-detail.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, History, Activity, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setCasemixContext } from "@/lib/api/client";
import { eklaimLocalApi } from "@/lib/api/eklaim-local";

import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { TriageForm } from "@/components/medical-record/triage-form";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { BodyMarkerForm } from "@/components/medical-record/body-marker-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { MedicineTimesheetForm } from "@/components/medical-record/medicine-timesheet-form";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { PharmacyEditPrescription } from "@/components/medical-record/pharmacy-edit-prescription";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { FallRiskForm } from "@/components/medical-record/fall-risk-form";
import { O2UsageForm } from "@/components/medical-record/o2-usage-form";
import { DischargePlanningForm } from "@/components/medical-record/discharge-planning-form";
import { BedTransferForm } from "@/components/medical-record/bed-transfer-form";
import { NutritionOrderForm } from "@/components/medical-record/nutrition-order-form";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { SurgeryOrderForm } from "@/components/medical-record/surgery-order-form";
import { SurgeryWorkstation } from "@/components/medical-record/surgery-workstation";
import { MedicalRecordPrintSelect } from "@/components/medical-record/print-select";
import { VisitHistoryDrawer } from "@/components/medical-record/visit-history-drawer";
import { ObservationReportDrawer } from "@/components/medical-record/observation-report-drawer";

export default function RMCasemixPage() {
  // Route: /eklaim/data-klaim/:id/rekam-medis
  // :id = eklaimLocalId
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const eklaimId = Number(id);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [visit, setVisit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("anamnesis");

  // Drawer states
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [observationDrawerOpen, setObservationDrawerOpen] = useState(false);

  // Activate casemix context immediately
  useEffect(() => {
    setCasemixContext(true, eklaimId);
    return () => setCasemixContext(false);
  }, [eklaimId]);

  // Load eklaim detail to get the linked visit object
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Temporarily disable casemix context so this meta-request is not intercepted
        setCasemixContext(false);
        const res = await eklaimLocalApi.getDetail(eklaimId);
        const eklaimData = res.data || res; // Fallback in case api interceptor unwraps it
        
        // Backend preloads Visit, but Visit.Registration.Patient might be empty in the EklaimLocal context.
        // Or if visit_id is 0, visit is null. We polyfill it from eklaimData.patient so PatientInfo component renders correctly.
        let eklaimVisit = eklaimData.visit;
        
        const fallbackPatient = eklaimData.patient || eklaimData.sep?.patient || { 
          id: eklaimData.patient_id || 0,
          nama_lengkap: eklaimData.nama_pasien || "Pasien Tidak Diketahui",
          no_rm: eklaimData.no_rm || "-",
          bpjs_number: eklaimData.no_kartu || "-"
        };
        
        if (!eklaimVisit) {
          // If there is no visit, construct a synthetic visit object
          eklaimVisit = {
            id: eklaimData.visit_id || 0,
            visit_number: "-",
            visit_type: eklaimData.jenis_rawat === "1" ? "inpatient" : "outpatient",
            status: "completed",
            registration: {
              registration_number: eklaimData.sep?.no_sep || eklaimData.no_sep || "-",
              payment_method: "bpjs",
              patient: fallbackPatient
            }
          };
        } else if (eklaimVisit) {
          if (!eklaimVisit.registration?.patient) {
            eklaimVisit.registration = {
              ...(eklaimVisit.registration || {}),
              patient: fallbackPatient
            };
          }
        }
        
        setVisit(eklaimVisit);
        // Re-enable casemix context for clinical API calls
        setCasemixContext(true, eklaimId);
      } catch {
        toast({ title: "Gagal memuat data kunjungan", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eklaimId, toast]);

  const [dataSourceModalOpen, setDataSourceModalOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<"casemix" | "asli">("casemix");

  const handleApplyDataSource = async () => {
    if (selectedDataSource === "casemix") {
      setDataSourceModalOpen(false);
      return;
    }
    
    if (!window.confirm("Anda yakin ingin menarik ulang data dari Rekam Medis Asli?\n\nPERINGATAN: Semua perubahan pada draft Casemix saat ini akan TERTEMPA oleh data asli!")) {
      return;
    }
    
    try {
      setSyncing(true);
      await eklaimLocalApi.syncRMFromVisit(eklaimId);
      toast({ title: "Berhasil", description: "Data RM Asli berhasil ditarik dan disalin ke draft Casemix." });
      window.location.reload();
    } catch {
      toast({ title: "Gagal", description: "Gagal menarik data RM asli", variant: "destructive" });
    } finally {
      setSyncing(false);
      setDataSourceModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const visitId = visit?.id || 0;
  const patientId = visit?.registration?.patient?.id || 0;

  // Flags — identical logic to visits/show.tsx
  const isEmergency = visit?.room?.service_type === "gawat_darurat";
  const isInpatient = visit?.room?.service_type === "rawat_inap";
  const isPharmacy = visit?.visit_type === "pharmacy";
  const isRadiology = visit?.visit_type === "radiology";
  const isLaboratory = visit?.visit_type === "lab";
  const isConsultation = visit?.visit_type === "consultation" && !!visit?.referral_from;
  const isSurgery = visit?.visit_type === "surgery";
  const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
  const showProcedureTab = allowedServiceTypes.includes(visit?.room?.service_type || "");

  const renderContent = () => {
    switch (activeTab) {
      case "triage": return <TriageForm visitId={visitId} />;
      case "anamnesis": return <AnamnesisForm visitId={visitId} />;
      case "physical-exam": return <PhysicalExamForm visitId={visitId} />;
      case "body-marker": return <BodyMarkerForm visitId={visitId} />;
      case "diagnosis": return <DiagnosisForm visitId={visitId} />;
      case "procedure": return <ProcedureForm visitId={visitId} />;
      case "assessment-plan": return <AssessmentPlanForm visitId={visitId} />;
      case "disposition": return <DispositionForm visitId={visitId} />;
      case "discharge-planning": return <DischargePlanningForm visitId={visitId} />;
      case "bed-transfer": return <BedTransferForm visitId={visitId} currentRoomId={visit?.room_id} />;
      case "cppt": return <CPPTForm visitId={visitId} />;
      case "fluid-balance": return <FluidBalanceForm visitId={visitId} />;
      case "nursing-care": return <NursingCareForm visitId={visitId} />;
      case "fall-risk": return <FallRiskForm visitId={visitId} />;
      case "o2-usage": return <O2UsageForm visitId={visitId} />;
      case "medicine-order": return <MedicineOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} sourceServiceType={visit?.room?.service_type} />;
      case "medicine-timesheet": return <MedicineTimesheetForm visitId={visitId} />;
      case "radiology-order": return <RadiologyOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />;
      case "laboratory-order": return <LaboratoryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />;
      case "consultation-order": return <ConsultationOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />;
      case "surgery-order": return <SurgeryOrderForm visitId={visitId} registrationId={visit?.registration_id} sourceRoomId={visit?.room_id} />;
      case "nutrition-order": return <NutritionOrderForm visitId={visitId} />;
      case "laboratory-edit": return <LaboratoryWorkstation visitId={visitId} />;
      case "radiology-edit": return <RadiologyWorkstation visitId={visitId} />;
      case "surgery-edit": return <SurgeryWorkstation visitId={visitId} />;
      case "consultation": return <ConsultationForm visitId={visitId} />;
      case "prescription-edit": return <PharmacyEditPrescription visitId={visitId} />;
      default: return null;
    }
  };

  return (
    <>
      <div className="medical-record-workspace flex h-full min-h-0 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-4">
        <div className="mr-shell grid min-h-0 flex-1 gap-0 border xl:grid-cols-[minmax(240px,15%)_minmax(0,85%)] 2xl:grid-cols-[minmax(260px,15%)_minmax(0,85%)]">

          {/* LEFT SIDEBAR */}
          <aside className="mr-sidebar min-h-0 min-w-0 border-r">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
              <div className="min-h-[190px] shrink-0 basis-[30%] border-b">
                {visit && (
                  <PatientInfo
                    visit={visit}
                    variant="compact"
                    onVisitRefresh={() => window.location.reload()}
                  />
                )}
              </div>
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

          {/* MAIN CONTENT */}
          <main className="mr-main flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">

            {/* Toolbar */}
            <div className="mr-toolbar sticky top-0 z-20 shrink-0 border-b bg-background px-3 py-2 sm:px-4">
              <div className="flex items-center justify-end gap-2">
                <Badge variant="outline" className="rounded-none border-orange-300 bg-orange-50 text-orange-700 text-[11px] font-semibold px-2">
                  MODE CASEMIX
                </Badge>

                <TooltipProvider delayDuration={200}>
                  {/* Back to E-Klaim */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-none"
                        onClick={() => navigate(`/eklaim/data-klaim/${eklaimId}`)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kembali ke E-Klaim</TooltipContent>
                  </Tooltip>

                  {/* Riwayat Kunjungan */}
                  {patientId > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-none"
                          onClick={() => setHistoryDrawerOpen(true)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Riwayat Kunjungan</TooltipContent>
                    </Tooltip>
                  )}

                  {/* Observasi (hanya rawat inap) */}
                  {isInpatient && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-none"
                          onClick={() => setObservationDrawerOpen(true)}
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Laporan Observasi</TooltipContent>
                    </Tooltip>
                  )}

                  {/* Switcher Sumber Data RM */}
                  <Dialog open={dataSourceModalOpen} onOpenChange={setDataSourceModalOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-none"
                            disabled={syncing}
                          >
                            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4 text-orange-600" />}
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Pengaturan Sumber Data RM</TooltipContent>
                    </Tooltip>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Pengaturan Sumber Data RM</DialogTitle>
                        <DialogDescription>
                          Pilih sumber data yang akan ditampilkan pada halaman ini. Penyimpanan data akan otomatis masuk ke Rekam Medis Casemix (tidak mengganti rekam medis asli).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <RadioGroup value={selectedDataSource} onValueChange={(val: any) => setSelectedDataSource(val)}>
                          <div className="flex items-center space-x-2 border rounded-md p-4 bg-muted/20">
                            <RadioGroupItem value="casemix" id="r1" />
                            <Label htmlFor="r1" className="flex flex-col gap-1 cursor-pointer">
                              <span className="font-semibold">Rekam Medis Casemix (Draft)</span>
                              <span className="font-normal text-muted-foreground text-xs">
                                Data yang Anda ubah atau simpan pada halaman E-Klaim.
                              </span>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 border rounded-md p-4">
                            <RadioGroupItem value="asli" id="r2" />
                            <Label htmlFor="r2" className="flex flex-col gap-1 cursor-pointer">
                              <span className="font-semibold">Rekam Medis Asli</span>
                              <span className="font-normal text-muted-foreground text-xs">
                                Tarik ulang data asli dari pelayanan. Aksi ini akan menimpa draft Casemix saat ini.
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDataSourceModalOpen(false)}>Batal</Button>
                        <Button onClick={handleApplyDataSource} disabled={syncing}>
                          {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Terapkan
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Print */}
                  {visitId > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <MedicalRecordPrintSelect
                            visitId={visitId}
                            isInpatient={isInpatient}
                            isEmergency={isEmergency}
                            iconOnly
                            triggerClassName="h-8 w-8 rounded-none"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Cetak Dokumen</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>

            {/* Form Content */}
            <div className="mr-content relative flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6" data-mr-tab-pane={activeTab}>
              {renderContent()}
            </div>

          </main>
        </div>
      </div>

      {/* Drawers */}
      {patientId > 0 && (
        <VisitHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          patientId={patientId}
          currentVisitId={visitId}
          onVisitSelect={(selectedVisitId) => {
            navigate(`/visits/${selectedVisitId}`);
          }}
        />
      )}

      {isInpatient && (
        <ObservationReportDrawer
          open={observationDrawerOpen}
          onOpenChange={setObservationDrawerOpen}
          visitId={visitId}
        />
      )}
    </>
  );
}
