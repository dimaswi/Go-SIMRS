import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { visitsApi, medicalRecordsApi } from "@/lib/api";
import { PatientInfo } from "@/components/medical-record/patient-info";
import { MedicalRecordTabs } from "@/components/medical-record/medical-record-tabs";
import { TriageForm } from "@/components/medical-record/triage-form";
import { AnamnesisForm } from "@/components/medical-record/anamnesis-form";
import { PhysicalExamForm } from "@/components/medical-record/physical-exam-form";
import { DiagnosisForm } from "@/components/medical-record/diagnosis-form";
import { AssessmentPlanForm } from "@/components/medical-record/assessment-plan-form";
import { DispositionForm } from "@/components/medical-record/disposition-form";
import { MedicineOrderForm } from "@/components/medical-record/medicine-order-form";
import { RadiologyOrderForm } from "@/components/medical-record/radiology-order-form";
import { LaboratoryOrderForm } from "@/components/medical-record/laboratory-order-form";
import { ConsultationOrderForm } from "@/components/medical-record/consultation-order-form";
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { PharmacyReview } from "@/components/medical-record/pharmacy-review";
import { PharmacyDispense } from "@/components/medical-record/pharmacy-dispense";
import { PharmacyReturn } from "@/components/medical-record/pharmacy-return";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";
import { NursingCareForm } from "@/components/medical-record/nursing-care-form";
import { BedTransferForm } from "@/components/medical-record/bed-transfer-form";
import { FinalVisit } from "@/components/medical-record/final-visit";
import { ConsultationForm } from "@/components/medical-record/consultation-form";
import { VisitHistory } from "@/components/medical-record/visit-history";

export default function VisitShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isPharmacy, setIsPharmacy] = useState(false);
  const [isRadiology, setIsRadiology] = useState(false);
  const [isLaboratory, setIsLaboratory] = useState(false);
  const [isConsultation, setIsConsultation] = useState(false);
  const [showProcedureTab, setShowProcedureTab] = useState(false);
  const [isInpatient, setIsInpatient] = useState(false);
  const [isPatientDischarged, setIsPatientDischarged] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('medicalRecordTabsCollapsed');
    return saved ? JSON.parse(saved) : true;
  });
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('visitHistoryCollapsed');
    return saved ? JSON.parse(saved) : true;
  });
  const [patientId, setPatientId] = useState<number | null>(null);

  // Refresh tab content when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTabRefreshKey(prev => prev + 1);
  };
  
  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('medicalRecordTabsCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);
  
  useEffect(() => {
    localStorage.setItem('visitHistoryCollapsed', JSON.stringify(historySidebarCollapsed));
  }, [historySidebarCollapsed]);

  // Reset states and load visit when ID changes (navigating to different visit)
  // This ensures the correct default tab is shown for each visit type
  useEffect(() => {
    setPageTitle("Rekam Medis");
    
    if (id) {
      // Reset all states when navigating to a different visit
      setActiveTab("");
      setIsEmergency(false);
      setIsPharmacy(false);
      setIsRadiology(false);
      setIsLaboratory(false);
      setIsConsultation(false);
      setShowProcedureTab(false);
      setIsInpatient(false);
      setIsPatientDischarged(false);
      
      // Load the visit data (this will set the correct default tab)
      loadVisit();
    }
  }, [id]);

  const loadVisit = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await visitsApi.getById(Number(id));
      const visitData = response.data;
      setVisit(visitData);

      // Extract patient ID from visit data
      if (visitData.registration?.patient?.id) {
        setPatientId(visitData.registration.patient.id);
      } else if (visitData.registration?.patient_id) {
        setPatientId(visitData.registration.patient_id);
      }

      // Check if emergency (UGD)
      const emergency = visitData.room?.service_type === "gawat_darurat";
      setIsEmergency(emergency);

      // Check if pharmacy visit
      const pharmacy = visitData.visit_type === "pharmacy";
      setIsPharmacy(pharmacy);

      // Check if radiology visit
      const radiology = visitData.visit_type === "radiology";
      setIsRadiology(radiology);

      // Check if laboratory visit
      const laboratory = visitData.visit_type === "lab";
      setIsLaboratory(laboratory);

      // Check if consultation visit (ORDER konsultasi, bukan pendaftaran biasa)
      // Visit order konsultasi memiliki referral_from (rujukan dari visit lain)
      const consultation = visitData.visit_type === "consultation" && !!visitData.referral_from;
      setIsConsultation(consultation);
      
      console.log("Current visit data:", {
        id: visitData.id,
        visit_type: visitData.visit_type,
        referral_from: visitData.referral_from,
        isConsultationOrder: consultation,
        service_type: visitData.room?.service_type,
        admission_time: visitData.admission_time,
        discharge_time: visitData.discharge_time
      });

      // Show procedure tab for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
      const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
      const shouldShowProcedureTab = allowedServiceTypes.includes(visitData.room?.service_type);
      setShowProcedureTab(shouldShowProcedureTab);

      // Check if inpatient (rawat_inap)
      const inpatient = visitData.room?.service_type === "rawat_inap";
      setIsInpatient(inpatient);

      // Check if patient is discharged (disposition saved)
      const discharged = visitData.registration?.status === "completed" || 
                        visitData.registration?.status === "discharged" ||
                        visitData.status === "completed";
      setIsPatientDischarged(discharged);

      // Set default active tab based on visit type and permissions (only on first load)
      if (!activeTab) {
        if (pharmacy) {
          // Pharmacy visit tabs - langsung ke penyerahan obat
          if (hasPermission("pharmacy.dispense")) {
            setActiveTab("medicine-dispense");
          } else if (hasPermission("pharmacy.review")) {
            setActiveTab("prescription-review");
          } else if (hasPermission("pharmacy.return")) {
            setActiveTab("medicine-return");
          } else {
            setActiveTab("medicine-dispense");
          }
        } else if (radiology) {
          // Radiology visit tabs - langsung ke pengerjaan
          if (hasPermission("procedure_orders.perform")) {
            setActiveTab("radiology-workstation");
          } else {
            setActiveTab("radiology-workstation"); // fallback even without permission
          }
        } else if (laboratory) {
          // Laboratory visit tabs - langsung ke pengerjaan
          if (hasPermission("procedure_orders.perform")) {
            setActiveTab("laboratory-workstation");
          } else {
            setActiveTab("laboratory-workstation"); // fallback even without permission
          }
        } else if (consultation) {
          // Consultation visit tabs - langsung ke form konsultasi
          setActiveTab("consultation");
        } else {
          // Clinical visit tabs
          if (emergency && hasPermission("medical_records.triage")) {
            setActiveTab("triage");
          } else if (hasPermission("medical_records.anamnesis")) {
            setActiveTab("anamnesis");
          } else if (hasPermission("medical_records.physical_exam")) {
            setActiveTab("physical-exam");
          } else if (hasPermission("medical_records.diagnosis")) {
            setActiveTab("diagnosis");
          } else if (hasPermission("medical_records.assessment_plan")) {
            setActiveTab("assessment-plan");
          } else if (hasPermission("medical_records.disposition")) {
            setActiveTab("disposition");
          } else {
            setActiveTab("anamnesis"); // fallback
          }
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data kunjungan",
      });
      navigate("/visits");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Callback to refresh visit data after status-changing operations
  const handleVisitUpdate = () => {
    loadVisit(true); // Silent reload to update visit data without showing loading state
  };

  // Handle visit selection from history sidebar
  const handleVisitSelect = (visitId: number) => {
    if (visitId !== Number(id)) {
      navigate(`/visits/${visitId}`);
    }
  };

  const handleSaveTriage = async (data: any) => {
    try {
      await medicalRecordsApi.saveTriage(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data triase berhasil disimpan",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data triase",
      });
    }
  };

  const handleSaveAnamnesis = async (data: any) => {
    try {
      await medicalRecordsApi.saveAnamnesis(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data anamnesis berhasil disimpan",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data anamnesis",
      });
    }
  };

  const handleSavePhysicalExam = async (data: any) => {
    try {
      await medicalRecordsApi.savePhysicalExam(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data pemeriksaan fisik berhasil disimpan",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data pemeriksaan fisik",
      });
    }
  };

  const handleSaveDiagnosis = async (data: any) => {
    try {
      await medicalRecordsApi.saveDiagnosis(Number(id), data);
      toast({
        title: "Berhasil",
        description: "Data diagnosis berhasil disimpan",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan data diagnosis",
      });
    }
  };

  const renderActiveTabContent = () => {
    if (!visit) return null;

    // Derive support visit types directly from visit data to avoid stale state
    const visitIsRadiology = visit.visit_type === "radiology";
    const visitIsLaboratory = visit.visit_type === "lab";
    const visitIsPharmacy = visit.visit_type === "pharmacy";
    const visitIsConsultation = visit.visit_type === "consultation" && !!visit.referral_from;

    // Helper: Check if current visit is a support visit (pharmacy, radiology, lab, consultation order)
    const isSupportVisit = visitIsPharmacy || visitIsRadiology || visitIsLaboratory || visitIsConsultation;
    
    // Helper: Render message for wrong visit type
    const renderWrongVisitTypeMessage = (expectedType: string) => (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Tab ini tidak tersedia untuk jenis kunjungan ini. 
          Tab ini hanya untuk kunjungan {expectedType}.
        </p>
      </Card>
    );

    switch (activeTab) {
      case "triage":
        // Triage only for emergency visits
        if (!isEmergency) {
          return renderWrongVisitTypeMessage("Gawat Darurat (UGD)");
        }
        if (!hasPermission("medical_records.triage")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Triase
              </p>
            </Card>
          );
        }
        return <TriageForm visitId={visit.id} onSave={handleSaveTriage} readOnly={isPatientDischarged} />;
      case "anamnesis":
        // Anamnesis only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.anamnesis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Anamnesis
              </p>
            </Card>
          );
        }
        return <AnamnesisForm visitId={visit.id} onSave={handleSaveAnamnesis} readOnly={isPatientDischarged} />;
      case "physical-exam":
        // Physical exam only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.physical_exam")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Pemeriksaan Fisik
              </p>
            </Card>
          );
        }
        return (
          <PhysicalExamForm
            visitId={visit.id}
            onSave={handleSavePhysicalExam}
            isEmergency={isEmergency}
            readOnly={isPatientDischarged}
          />
        );
      case "diagnosis":
        // Diagnosis only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.diagnosis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Diagnosis
              </p>
            </Card>
          );
        }
        return <DiagnosisForm visitId={visit.id} onSave={handleSaveDiagnosis} readOnly={isPatientDischarged} />;
      case "assessment-plan":
        // Assessment plan only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.assessment_plan")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Assessment & Plan
              </p>
            </Card>
          );
        }
        return <AssessmentPlanForm visitId={visit.id} readOnly={isPatientDischarged} />;
      case "procedure":
        // Procedure only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.procedure")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Tindakan
              </p>
            </Card>
          );
        }
        return <ProcedureForm key={`procedure-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "cppt":
        // CPPT only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk CPPT
              </p>
            </Card>
          );
        }
        return <CPPTForm key={`cppt-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "nursing-care":
        // Nursing care only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.nursing_care")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Asuhan Keperawatan
              </p>
            </Card>
          );
        }
        return <NursingCareForm key={`nursing-care-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "fluid-balance":
        // Fluid balance only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.fluid_balance")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Balance Cairan
              </p>
            </Card>
          );
        }
        return <FluidBalanceForm key={`fluid-balance-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={isPatientDischarged} />;
      case "bed-transfer":
        // Bed transfer only for inpatient visits
        if (!isInpatient) {
          return renderWrongVisitTypeMessage("Rawat Inap");
        }
        if (!hasPermission("medical_records.bed_transfer")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Mutasi Pasien
              </p>
            </Card>
          );
        }
        return (
          <BedTransferForm
            key={`bed-transfer-${visit.id}-${tabRefreshKey}`}
            visitId={visit.id}
            currentRoomId={visit.room_id}
            currentBedId={visit.bed_id}
            readOnly={isPatientDischarged}
            onTransferComplete={() => loadVisit(true)}
          />
        );
      case "medicine-order":
        // Medicine order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.medicine_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Obat
              </p>
            </Card>
          );
        }
        return (
          <MedicineOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "radiology-order":
        // Radiology order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.radiology_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Radiologi
              </p>
            </Card>
          );
        }
        return (
          <RadiologyOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "laboratory-order":
        // Laboratory order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.laboratory_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Laboratorium
              </p>
            </Card>
          );
        }
        return (
          <LaboratoryOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      case "consultation-order":
        // Consultation order only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.consultation_order")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Order Konsultasi
              </p>
            </Card>
          );
        }
        return (
          <ConsultationOrderForm
            visitId={visit.id}
            registrationId={visit.registration_id}
            sourceRoomId={visit.room_id}
            readOnly={isPatientDischarged}
          />
        );
      
      // Consultation tab - form jawaban konsultasi (ONLY for consultation order visits)
      case "consultation":
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Form Konsultasi
              </p>
            </Card>
          );
        }
        return <ConsultationForm key={`consultation-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={isPatientDischarged} />;

      case "consultation-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Konsultasi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`consultation-final-${visit.id}-${tabRefreshKey}`} visitId={visit.id} type="consultation" onVisitUpdate={handleVisitUpdate} />;

      case "disposition":
        // Disposition only for clinical visits (not support visits)
        if (isSupportVisit) {
          return renderWrongVisitTypeMessage("klinis (Rawat Jalan/Rawat Inap/UGD)");
        }
        if (!hasPermission("medical_records.disposition")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Disposisi
              </p>
            </Card>
          );
        }
        return <DispositionForm visitId={visit.id} isEmergency={isEmergency} readOnly={isPatientDischarged} onSave={handleVisitUpdate} />;
      
      // Pharmacy tabs - ONLY for pharmacy visits
      case "prescription-review":
        if (!hasPermission("pharmacy.review")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Telaah Resep
              </p>
            </Card>
          );
        }
        return <PharmacyReview key={`review-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      case "medicine-dispense":
        if (!hasPermission("pharmacy.dispense")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Penyerahan Obat
              </p>
            </Card>
          );
        }
        return <PharmacyDispense key={`dispense-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      case "medicine-return":
        if (!hasPermission("pharmacy.return")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Return Obat
              </p>
            </Card>
          );
        }
        return <PharmacyReturn key={`return-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      
      case "pharmacy-final":
        if (!hasPermission("pharmacy.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Farmasi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`pharmacy-final-${visit.id}-${tabRefreshKey}`} visitId={visit.id} type="pharmacy" onVisitUpdate={handleVisitUpdate} />;
      
      // Radiology workstation tab - ONLY for radiology visits
      case "radiology-workstation":
        if (!hasPermission("procedure_orders.perform")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Pengerjaan Radiologi
              </p>
            </Card>
          );
        }
        return <RadiologyWorkstation key={`radiology-ws-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={visit.status === "completed"} />;
      
      case "radiology-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Radiologi
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`radiology-final-${visit.id}-${tabRefreshKey}`} visitId={visit.id} type="radiology" onVisitUpdate={handleVisitUpdate} />;
      
      // Laboratory workstation tab - ONLY for laboratory visits
      case "laboratory-workstation":
        if (!hasPermission("procedure_orders.perform")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Pengerjaan Laboratorium
              </p>
            </Card>
          );
        }
        return <LaboratoryWorkstation key={`laboratory-ws-${visit.id}-${tabRefreshKey}`} visitId={visit.id} readOnly={visit.status === "completed"} />;

      case "laboratory-final":
        if (!hasPermission("procedure_orders.final")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Final Kunjungan Laboratorium
              </p>
            </Card>
          );
        }
        return <FinalVisit key={`laboratory-final-${visit.id}-${tabRefreshKey}`} visitId={visit.id} type="laboratory" onVisitUpdate={handleVisitUpdate} />;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Patient Info Header - Sticky */}
      <div className="sticky top-0 z-50 bg-background px-6 pt-6 pb-3 flex-shrink-0">
        <PatientInfo visit={visit} />
      </div>

      {/* Main Content Area with Tabs and Form */}
      <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
          {/* Left Sidebar: Tabs Navigation & Visit History - Sticky */}
          <div className="self-start sticky top-[120px] z-30 space-y-4">
            {/* Medical Record Tabs */}
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => {
                const newState = !sidebarCollapsed;
                setSidebarCollapsed(newState);
                if (!newState) {
                  setHistorySidebarCollapsed(true);
                }
              }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Menu Rekam Medis</h3>
                  {sidebarCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {!sidebarCollapsed && (
                <CardContent className="p-2.5">
                  <MedicalRecordTabs
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    isEmergency={isEmergency}
                    isPharmacy={isPharmacy}
                    isRadiology={isRadiology}
                    isLaboratory={isLaboratory}
                    isConsultation={isConsultation}
                    showProcedureTab={showProcedureTab}
                    isInpatient={isInpatient}
                  />
                </CardContent>
              )}
            </Card>

            {/* Visit History Sidebar */}
            {patientId && (
              <Card className="border-none shadow-sm">
                <CardHeader className="border-b bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => {
                  const newState = !historySidebarCollapsed;
                  setHistorySidebarCollapsed(newState);
                  if (!newState) {
                    setSidebarCollapsed(true);
                  }
                }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase">Riwayat Kunjungan</h3>
                    {historySidebarCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {!historySidebarCollapsed && (
                  <CardContent className="p-2.5">
                    <VisitHistory
                      patientId={patientId}
                      currentVisitId={Number(id)}
                      currentVisitType={visit?.visit_type || "consultation"}
                      currentServiceType={visit?.room?.service_type}
                      isConsultationOrder={isConsultation}
                      onVisitSelect={handleVisitSelect}
                    />
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          {/* Right Content: Active Tab Form */}
          <div>
            {renderActiveTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
