import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { RadiologyWorkstation } from "@/components/medical-record/radiology-workstation";
import { LaboratoryWorkstation } from "@/components/medical-record/laboratory-workstation";
import { PharmacyReview } from "@/components/medical-record/pharmacy-review";
import { PharmacyDispense } from "@/components/medical-record/pharmacy-dispense";
import { PharmacyReturn } from "@/components/medical-record/pharmacy-return";
import { ProcedureForm } from "@/components/medical-record/procedure-form";
import { CPPTForm } from "@/components/medical-record/cppt-form";
import { FluidBalanceForm } from "@/components/medical-record/fluid-balance-form";

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
  const [showProcedureTab, setShowProcedureTab] = useState(false);
  const [isInpatient, setIsInpatient] = useState(false);

  // Refresh tab content when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTabRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    setPageTitle("Rekam Medis");
    if (id) {
      loadVisit();
    }
  }, [id]);

  const loadVisit = async () => {
    setLoading(true);
    try {
      const response = await visitsApi.getById(Number(id));
      const visitData = response.data;
      setVisit(visitData);

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

      // Show procedure tab for clinical visits (rawat_jalan, rawat_inap, gawat_darurat)
      const allowedServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
      const shouldShowProcedureTab = allowedServiceTypes.includes(visitData.room?.service_type);
      setShowProcedureTab(shouldShowProcedureTab);

      // Check if inpatient (rawat_inap)
      const inpatient = visitData.room?.service_type === "rawat_inap";
      setIsInpatient(inpatient);

      // Set default active tab based on visit type and permissions
      if (pharmacy) {
        // Pharmacy visit tabs
        if (hasPermission("pharmacy.review")) {
          setActiveTab("prescription-review");
        } else if (hasPermission("pharmacy.dispense")) {
          setActiveTab("medicine-dispense");
        } else if (hasPermission("pharmacy.return")) {
          setActiveTab("medicine-return");
        } else {
          setActiveTab("prescription-review");
        }
      } else if (radiology) {
        // Radiology visit tabs
        if (hasPermission("procedure_orders.perform")) {
          setActiveTab("radiology-workstation");
        }
      } else if (laboratory) {
        // Laboratory visit tabs
        if (hasPermission("procedure_orders.perform")) {
          setActiveTab("laboratory-workstation");
        }
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
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data kunjungan",
      });
      navigate("/visits");
    } finally {
      setLoading(false);
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

    switch (activeTab) {
      case "triage":
        if (!hasPermission("medical_records.triage")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Triase
              </p>
            </Card>
          );
        }
        return <TriageForm visitId={visit.id} onSave={handleSaveTriage} />;
      case "anamnesis":
        if (!hasPermission("medical_records.anamnesis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Anamnesis
              </p>
            </Card>
          );
        }
        return <AnamnesisForm visitId={visit.id} onSave={handleSaveAnamnesis} />;
      case "physical-exam":
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
          />
        );
      case "diagnosis":
        if (!hasPermission("medical_records.diagnosis")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Diagnosis
              </p>
            </Card>
          );
        }
        return <DiagnosisForm visitId={visit.id} onSave={handleSaveDiagnosis} />;
      case "assessment-plan":
        if (!hasPermission("medical_records.assessment_plan")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Assessment & Plan
              </p>
            </Card>
          );
        }
        return <AssessmentPlanForm visitId={visit.id} />;
      case "procedure":
        if (!hasPermission("medical_records.procedure")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Tindakan
              </p>
            </Card>
          );
        }
        return <ProcedureForm key={`procedure-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
      case "cppt":
        if (!hasPermission("medical_records.cppt")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk CPPT
              </p>
            </Card>
          );
        }
        return <CPPTForm key={`cppt-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
      case "fluid-balance":
        if (!hasPermission("medical_records.fluid_balance")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk Balance Cairan
              </p>
            </Card>
          );
        }
        return <FluidBalanceForm key={`fluid-balance-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
      case "medicine-order":
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
          />
        );
      case "radiology-order":
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
          />
        );
      case "laboratory-order":
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
          />
        );
      case "disposition":
        if (!hasPermission("medical_records.disposition")) {
          return (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Anda tidak memiliki akses untuk melihat Disposisi
              </p>
            </Card>
          );
        }
        return <DispositionForm visitId={visit.id} isEmergency={isEmergency} />;
      
      // Pharmacy tabs
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
        return <PharmacyReview key={`review-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
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
        return <PharmacyDispense key={`dispense-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
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
        return <PharmacyReturn key={`return-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
      
      // Radiology workstation tab
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
        return <RadiologyWorkstation key={`radiology-ws-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;
      
      // Laboratory workstation tab
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
        return <LaboratoryWorkstation key={`laboratory-ws-${visit.id}-${tabRefreshKey}`} visitId={visit.id} />;

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
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/visits")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Rekam Medis Pasien</h1>
          <p className="text-sm text-muted-foreground">
            Kunjungan #{visit.visit_number}
          </p>
        </div>
      </div>

      {/* Patient Info Header */}
      <PatientInfo visit={visit} />

      {/* Main Content Area with Tabs and Form */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Left Sidebar: Tabs Navigation */}
        <div>
          <Card className="border-none shadow-sm">
            <CardHeader className="border-b bg-muted/30 px-3 py-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Menu Rekam Medis</h3>
            </CardHeader>
            <CardContent className="p-2.5">
              <MedicalRecordTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isEmergency={isEmergency}
                isPharmacy={isPharmacy}
                isRadiology={isRadiology}
                isLaboratory={isLaboratory}
                showProcedureTab={showProcedureTab}
                isInpatient={isInpatient}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Active Tab Form */}
        <div>
          {renderActiveTabContent()}
        </div>
      </div>
    </div>
  );
}
