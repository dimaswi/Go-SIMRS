import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Building2,
  Users,
  MapPin,
  Stethoscope,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileJson,
  Activity,
  Pill,
  FlaskConical,
  TestTube,
  FileText,
} from "lucide-react";
import { satuSehatApi, type SatuSehatReadinessResponse } from "@/lib/api/integrations";
import { api } from "@/lib/api";
import {
  PatientsTab,
  PractitionersTab,
  LocationsTab,
  KfaMappingTab,
  LoincMappingTab,
  EncountersTab,
} from "@/components/integrations";

// Interfaces
interface Patient {
  id: number;
  no_rm: string;
  nik: string;
  nama_lengkap: string;
  satusehat_id?: string;
}

interface Employee {
  id: number;
  nik: string;
  nama_lengkap: string;
  tipe_karyawan: string;
  satusehat_id?: string;
}

interface Room {
  id: number;
  code: string;
  name: string;
  room_type: string;
  satusehat_id?: string;
}

interface Diagnosis {
  id: number;
  visit_id: number;
  icd10_code: string;
  icd10_name: string;
  type: string;
  clinical_status?: string;
  verification_status?: string;
  satusehat_condition_id?: string;
  satusehat_sent_at?: string;
}

interface VisitDiagnosisInfo {
  diagnoses: Diagnosis[];
  total: number;
  has_primary: boolean;
  sent_count: number;
  ready_to_send: boolean;
}

interface Visit {
  id: number;
  visit_number: string;
  status: string;
  satusehat_encounter_id?: string;
  satusehat_sync_status?: string;
  registration?: {
    patient?: Patient;
  };
  room?: Room;
  doctor?: Employee;
  check_in_time?: string;
  diagnosisInfo?: VisitDiagnosisInfo;
}

interface SendResponse {
  type: 'location' | 'encounter' | 'patient' | 'practitioner' | 'condition';
  success: boolean;
  title: string;
  data: {
    message?: string;
    satusehat_id?: string;
    error?: string;
    status_code?: number;
    issue_details?: string[];
    satusehat_response?: Record<string, unknown>;
    response?: Record<string, unknown>;
    conditions_sent?: Array<{ diagnosis_id: number; icd10_code: string; condition_id: string; status: string }>;
    [key: string]: unknown;
  };
}

interface PreviewData {
  visit_number: string;
  patient_name: string;
  patient_ihs: string;
  doctor_name: string;
  doctor_ihs: string;
  room_name: string;
  room_id: string;
  diagnosis_count: number;
  flow_explanation?: string[];
  preview?: {
    step_1_encounter_arrived: Record<string, unknown>;
    step_2_conditions: Record<string, unknown>[];
    step_3_encounter_finished: Record<string, unknown>;
  };
  notes?: string[];
}

interface ResourceItem {
  id?: number;
  icd10_code?: string;
  icd10_name?: string;
  code?: string;
  name?: string;
  medicine_name?: string;
  quantity?: number;
  dispensed_qty?: number;
  unit?: string;
  dosage?: string;
  dispensed_by?: string;
  reviewed_by?: string;
  order_number?: string;
  type?: string;
  type_display?: string;
  data_exists?: boolean;
  can_send?: boolean;
  status?: string;
  sent?: boolean;
  value?: number | string;
  // AllergyIntolerance fields
  snomed_code?: string;
  snomed_display?: string;
  category?: string;
  criticality?: string;
  // Lab/Radiology fields
  procedure_type?: string;
  has_loinc_mapping?: boolean;
  loinc_code?: string;
  loinc_display?: string;
  has_specimen_mapping?: boolean;
  servicerequest_sent?: boolean;
  servicerequest_id?: string;
  specimen_sent?: boolean;
  specimen_id?: string;
  diagnosticreport_sent?: boolean;
  diagnosticreport_id?: string;
  can_send_servicerequest?: boolean;
  can_send_specimen?: boolean;
  can_send_diagnosticreport?: boolean;
  can_send_all?: boolean;
  // MedicationStatement fields
  source?: string;
  source_display?: string;
  description?: string;
  // CarePlan fields
  plan?: string;
  instruction?: string;
  profession?: string;
  record_date?: string;
  created_by?: string;
  follow_up_date?: string;
  disposition_type?: string;
  discharge_condition?: string;
}

interface Resource {
  resource: string;
  description: string;
  required?: boolean;
  category?: string;
  sent?: boolean;
  all_sent?: boolean;
  sent_count?: number;
  total?: number;
  available?: boolean;
  count?: number;
  prerequisites?: string[];
  note?: string;
  items?: string[] | ResourceItem[];
}

interface StatusData {
  summary: {
    visit_id?: number;
    visit_number: string;
    patient_name: string;
    status: string;
    completion_percentage: number;
    sent_required: number;
    required_resources: number;
    ready_to_send?: boolean;
  };
  prerequisites: {
    patient_ihs: boolean;
    practitioner_ihs: boolean;
    location_id: boolean;
  };
  resources: Resource[];
  next_steps?: string[];
}

export default function SatuSehatSenderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("encounters");

  // Response dialog
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<SendResponse | null>(null);

  // Preview dialog
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Status dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [activeStatusResource, setActiveStatusResource] = useState<string>("Overview");

  // Data states
  const [_readiness, setReadiness] = useState<SatuSehatReadinessResponse | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [readinessRes, patientsRes, employeesRes, roomsRes, visitsRes] = await Promise.all([
        satuSehatApi.getReadiness(),
        api.get<{ data: Patient[] }>('/patients', { params: { limit: 500 } }),
        api.get<{ data: Employee[] }>('/employees', { params: { limit: 200 } }),
        api.get<{ data: Room[] }>('/rooms', { params: { limit: 200, is_active: true } }),
        // Get recent visits - exclude supporting (lab, pharmacy, radiology)
        api.get<Visit[]>('/visits', { params: { limit: 50, exclude_supporting: 'true' } }),
      ]);

      setReadiness(readinessRes.data);
      setPatients(patientsRes.data.data || []);
      setEmployees(employeesRes.data.data || []);
      setRooms(roomsRes.data.data || []);

      // Load diagnosis info for visits
      const visitsWithDiagnosis = visitsRes.data || [];
      const diagnosisPromises = visitsWithDiagnosis.map(async (visit) => {
        try {
          const diagRes = await satuSehatApi.getVisitDiagnoses(visit.id);
          return { ...visit, diagnosisInfo: diagRes.data };
        } catch {
          return { ...visit, diagnosisInfo: { diagnoses: [], total: 0, has_primary: false, sent_count: 0, ready_to_send: false } };
        }
      });

      const visitsComplete = await Promise.all(diagnosisPromises);
      setVisits(visitsComplete);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle show response dialog
  const handleShowResponse = (response: SendResponse) => {
    setLastResponse(response);
    setResponseDialogOpen(true);
  };

  // Patient lookup
  const handleLookupPatient = async (patientId: number) => {
    setSending(`patient-${patientId}`);
    try {
      const response = await satuSehatApi.lookupPatientIHS(patientId);
      const responseData = response.data as unknown as Record<string, unknown>;

      setLastResponse({
        type: 'patient',
        success: true,
        title: `Pasien: ${responseData.nama_lokal || 'Unknown'}`,
        data: responseData,
      });
      setResponseDialogOpen(true);

      toast({
        variant: "success",
        title: "Berhasil!",
        description: `IHS Number: ${response.data.satusehat_id}`,
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };

      setLastResponse({
        type: 'patient',
        success: false,
        title: 'Gagal Lookup Pasien',
        data: err.response?.data as Record<string, unknown> || { error: 'Unknown error' },
      });
      setResponseDialogOpen(true);

      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal lookup IHS Number",
      });
    } finally {
      setSending(null);
    }
  };

  // Practitioner lookup
  const handleLookupPractitioner = async (employeeId: number) => {
    setSending(`employee-${employeeId}`);
    try {
      const response = await satuSehatApi.lookupPractitionerIHS(employeeId);
      const responseData = response.data as unknown as Record<string, unknown>;

      setLastResponse({
        type: 'practitioner',
        success: true,
        title: `Karyawan: ${responseData.nama_lokal || 'Unknown'}`,
        data: responseData,
      });
      setResponseDialogOpen(true);

      toast({
        variant: "success",
        title: "Berhasil!",
        description: `IHS Number: ${response.data.satusehat_id}`,
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };

      setLastResponse({
        type: 'practitioner',
        success: false,
        title: 'Gagal Lookup Karyawan',
        data: err.response?.data as Record<string, unknown> || { error: 'Unknown error' },
      });
      setResponseDialogOpen(true);

      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal lookup IHS Number",
      });
    } finally {
      setSending(null);
    }
  };

  // Send Location
  const handleSendLocation = async (roomId: number) => {
    setSending(`room-${roomId}`);
    try {
      const response = await satuSehatApi.sendLocation(roomId);
      const responseData = response.data as unknown as Record<string, unknown>;
      const isDuplicate = responseData.is_duplicate === true;

      setLastResponse({
        type: 'location',
        success: true,
        title: `Location: ${responseData.room_name || 'Unknown'}`,
        data: responseData,
      });
      setResponseDialogOpen(true);

      toast({
        variant: "success",
        title: isDuplicate ? "Data Sudah Ada!" : "Berhasil!",
        description: isDuplicate
          ? `Location sudah ada di SatuSehat, ID: ${responseData.satusehat_id || 'N/A'}`
          : `Location ID: ${responseData.satusehat_id || 'N/A'}`,
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; response?: unknown; is_duplicate?: boolean; satusehat_id?: string; message?: string } } };
      const errData = err.response?.data;

      if (errData?.is_duplicate || errData?.satusehat_id) {
        setLastResponse({
          type: 'location',
          success: true,
          title: 'Location (Duplicate)',
          data: errData as Record<string, unknown>,
        });
        setResponseDialogOpen(true);

        toast({
          variant: "success",
          title: "Data Sudah Ada!",
          description: errData?.message || `Location sudah ada di SatuSehat`,
        });
        loadData();
      } else {
        setLastResponse({
          type: 'location',
          success: false,
          title: 'Gagal Mengirim Location',
          data: errData as Record<string, unknown> || { error: 'Unknown error' },
        });
        setResponseDialogOpen(true);

        toast({
          variant: "destructive",
          title: "Gagal",
          description: errData?.error || "Gagal mengirim Location",
        });
      }
    } finally {
      setSending(null);
    }
  };

  // Send Encounter
  const handleSendEncounter = async (visitId: number) => {
    setSending(`visit-${visitId}`);
    try {
      const response = await satuSehatApi.sendEncounterWithDiagnosis(visitId);
      const responseData = response.data as unknown as Record<string, unknown>;

      setLastResponse({
        type: 'encounter',
        success: true,
        title: `Encounter: ${responseData.visit_number || visitId}`,
        data: responseData,
      });
      setResponseDialogOpen(true);

      const conditionsSent = response.data.conditions_sent || [];
      const conditionsMsg = conditionsSent.length > 0
        ? ` (${conditionsSent.length} diagnosis terkirim)`
        : '';

      toast({
        variant: "success",
        title: "Berhasil!",
        description: `Encounter ID: ${response.data.satusehat_encounter_id}${conditionsMsg}`,
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string; response?: string; conditions_sent?: unknown[] } } };
      const errData = err.response?.data;

      let satuSehatError: Record<string, unknown> | undefined = undefined;
      if (errData?.response) {
        try {
          satuSehatError = JSON.parse(errData.response as string);
        } catch {
          satuSehatError = { raw_response: errData.response };
        }
      }

      setLastResponse({
        type: 'encounter',
        success: false,
        title: 'Gagal Mengirim Encounter',
        data: {
          error: errData?.error || 'Unknown error',
          message: errData?.message,
          satusehat_response: satuSehatError,
          conditions_sent: errData?.conditions_sent as Array<{ diagnosis_id: number; icd10_code: string; condition_id: string; status: string }>,
          ...errData as Record<string, unknown>,
        },
      });
      setResponseDialogOpen(true);

      toast({
        variant: "destructive",
        title: "Gagal",
        description: errData?.error || "Gagal mengirim Encounter",
      });
    } finally {
      setSending(null);
    }
  };

  // Preview Encounter
  const handlePreviewEncounter = async (visitId: number) => {
    setLoadingPreview(true);
    setPreviewDialogOpen(true);
    try {
      const response = await satuSehatApi.previewEncounterFHIR(visitId);
      setPreviewData(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal memuat preview",
      });
      setPreviewDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  // View Status
  const handleViewStatus = async (visitId: number) => {
    setLoadingStatus(true);
    setStatusDialogOpen(true);
    setActiveStatusResource("Overview");
    try {
      const response = await satuSehatApi.getEncounterStatus(visitId);
      setStatusData(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal memuat status",
      });
      setStatusDialogOpen(false);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Status dialog handlers
  const handleSendVitalSigns = async (visitId: number) => {
    setSending(`vitalsigns-${visitId}`);
    try {
      const response = await satuSehatApi.sendVitalSigns(visitId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.total_sent} vital signs terkirim ke SatuSehat`,
      });
      handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim vital signs",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendProcedure = async (procedureId: number, visitId: number) => {
    if (sending) return;
    setSending(`procedure-${procedureId}`);
    try {
      const response = await satuSehatApi.sendProcedure(procedureId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || `Procedure ${response.data.procedure_name} terkirim`,
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim procedure",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendMedicationRequest = async (medicationItemId: number, visitId: number) => {
    if (sending) return;
    setSending(`medication-${medicationItemId}`);
    try {
      await satuSehatApi.sendMedicationRequest(medicationItemId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Resep terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim medication request",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendMedicationDispense = async (medicationItemId: number, visitId: number) => {
    if (sending) return;
    setSending(`dispense-${medicationItemId}`);
    try {
      await satuSehatApi.sendMedicationDispense(medicationItemId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pengeluaran obat terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim medication dispense",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendQuestionnaireResponse = async (medicineOrderId: number, visitId: number) => {
    if (sending) return;
    setSending(`questionnaire-${medicineOrderId}`);
    try {
      await satuSehatApi.sendQuestionnaireResponse(medicineOrderId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pengkajian resep terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim questionnaire response",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendMedicationAdministration = async (itemId: number, visitId: number) => {
    if (sending) return;
    setSending(`administration-${itemId}`);
    try {
      await satuSehatApi.sendMedicationAdministration(itemId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pemberian obat terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim medication administration",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendComposition = async (visitId: number) => {
    if (sending) return;
    setSending(`composition-${visitId}`);
    try {
      await satuSehatApi.sendComposition(visitId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Resume Medis (Composition) terkirim ke SatuSehat",
      });
      handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim composition",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendClinicalImpression = async (visitId: number, type: 'history' | 'rationale' | 'prognosis' | 'triage') => {
    if (sending) return;
    const typeDisplayMap = {
      'history': 'Riwayat Perjalanan Penyakit',
      'rationale': 'Rasional Klinis',
      'prognosis': 'Prognosis',
      'triage': 'Asesmen Triage',
    };
    setSending(`clinical-impression-${type}-${visitId}`);
    try {
      const response = await satuSehatApi.sendClinicalImpression(visitId, type);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `ClinicalImpression (${response.data.type_display || typeDisplayMap[type]}) terkirim ke SatuSehat`,
      });
      handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || `Gagal mengirim ClinicalImpression (${typeDisplayMap[type]})`,
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendAllergy = async (allergyId: number, visitId: number) => {
    if (sending) return;
    setSending(`allergy-${allergyId}`);
    try {
      const response = await satuSehatApi.sendAllergyIntolerance(allergyId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `Alergi "${response.data.snomed_display}" terkirim ke SatuSehat`,
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim AllergyIntolerance",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendAllAllergies = async (visitId: number) => {
    if (sending) return;
    setSending(`all-allergies-${visitId}`);
    try {
      const response = await satuSehatApi.sendVisitAllergies(visitId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.total_sent} alergi terkirim ke SatuSehat`,
      });
      handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim semua alergi",
      });
    } finally {
      setSending(null);
    }
  };

  // ========== MedicationStatement Handlers ==========
  const handleSendMedicationStatement = async (anamnesisId: number, visitId: number) => {
    if (sending) return;
    setSending(`medicationstatement-${anamnesisId}`);
    try {
      const response = await satuSehatApi.sendMedicationStatement(anamnesisId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "MedicationStatement terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim MedicationStatement",
      });
    } finally {
      setSending(null);
    }
  };

  // ========== CarePlan Handlers ==========
  const handleSendCarePlan = async (id: number, source: 'cppt' | 'disposition' | 'assessment', visitId: number) => {
    if (sending) return;
    setSending(`careplan-${source}-${id}`);
    try {
      let response;
      if (source === 'cppt') {
        response = await satuSehatApi.sendCarePlanFromCPPT(id);
      } else if (source === 'disposition') {
        response = await satuSehatApi.sendCarePlanFromDisposition(id);
      } else {
        response = await satuSehatApi.sendCarePlanFromAssessmentPlan(id);
      }
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "CarePlan terkirim ke SatuSehat",
      });
      // Refresh status
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim CarePlan",
      });
    } finally {
      setSending(null);
    }
  };

  // ========== Lab/Radiology Handlers ==========

  // Individual handlers (for future use if needed)
  const _handleSendServiceRequest = async (visitProcedureId: number, visitId: number) => {
    if (sending) return;
    setSending(`servicerequest-${visitProcedureId}`);
    try {
      const response = await satuSehatApi.sendServiceRequest(visitProcedureId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "ServiceRequest terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim ServiceRequest",
      });
    } finally {
      setSending(null);
    }
  };

  const _handleSendSpecimen = async (visitProcedureId: number, visitId: number) => {
    if (sending) return;
    setSending(`specimen-${visitProcedureId}`);
    try {
      const response = await satuSehatApi.sendSpecimen(visitProcedureId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Specimen terkirim ke SatuSehat",
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim Specimen",
      });
    } finally {
      setSending(null);
    }
  };

  const _handleSendDiagnosticReport = async (visitProcedureId: number, visitId: number) => {
    if (sending) return;
    setSending(`diagnosticreport-${visitProcedureId}`);
    try {
      const response = await satuSehatApi.sendDiagnosticReport(visitProcedureId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `DiagnosticReport terkirim (${response.data.observation_ids?.length || 0} Observation)`,
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim DiagnosticReport",
      });
    } finally {
      setSending(null);
    }
  };

  // Expose individual handlers for potential future use
  void _handleSendServiceRequest;
  void _handleSendSpecimen;
  void _handleSendDiagnosticReport;

  // Handler for Lab/Radiology resources from ProcedureOrder system
  const handleSendAllLabResources = async (orderItemId: number, visitId: number) => {
    if (sending) return;
    setSending(`lab-all-${orderItemId}`);
    try {
      // Use the new API for ProcedureOrderItem
      const response = await satuSehatApi.sendAllLabResourcesFromOrder(orderItemId);
      const results = response.data.results;
      const sentCount = [
        results.service_request_id,
        results.specimen_id,
        results.diagnostic_report_id
      ].filter(Boolean).length;
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${sentCount} resource Lab terkirim ke SatuSehat`,
      });
      if (visitId) handleViewStatus(visitId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim Lab resources",
      });
    } finally {
      setSending(null);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageContent className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Kirim Data ke SatuSehat"
        icon={Send}
        onBack={() => navigate(-1)}
        actions={
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <div className="rounded-lg border bg-card">

          <Tabs value={activeTab} onValueChange={setActiveTab} variant="inline">
            <TabsList className="px-4">
              <TabsTrigger value="patients">
                <Users className="h-4 w-4 mr-2" />
                Pasien
              </TabsTrigger>
              <TabsTrigger value="practitioners">
                <Stethoscope className="h-4 w-4 mr-2" />
                Karyawan
              </TabsTrigger>
              <TabsTrigger value="locations">
                <MapPin className="h-4 w-4 mr-2" />
                Lokasi
              </TabsTrigger>
              <TabsTrigger value="kfa">
                <Pill className="h-4 w-4 mr-2" />
                KFA Obat
              </TabsTrigger>
              <TabsTrigger value="loinc">
                <FlaskConical className="h-4 w-4 mr-2" />
                LOINC Lab/Rad
              </TabsTrigger>
              <TabsTrigger value="encounters">
                <Building2 className="h-4 w-4 mr-2" />
                Encounter
              </TabsTrigger>
            </TabsList>

            <div className="p-4">
              {/* Patients Tab */}
              <TabsContent value="patients" className="mt-0">
                <PatientsTab
                  patients={patients}
                  sending={sending}
                  onLookupPatient={handleLookupPatient}
                  onShowResponse={handleShowResponse}
                />
              </TabsContent>

              {/* Practitioners Tab */}
              <TabsContent value="practitioners" className="mt-0">
                <PractitionersTab
                  employees={employees}
                  sending={sending}
                  onLookupPractitioner={handleLookupPractitioner}
                  onShowResponse={handleShowResponse}
                />
              </TabsContent>

              {/* Locations Tab */}
              <TabsContent value="locations" className="mt-0">
                <LocationsTab
                  rooms={rooms}
                  sending={sending}
                  onSendLocation={handleSendLocation}
                  onShowResponse={handleShowResponse}
                />
              </TabsContent>

              {/* KFA Tab */}
              <TabsContent value="kfa" className="mt-0">
                <KfaMappingTab />
              </TabsContent>

              {/* LOINC Tab */}
              <TabsContent value="loinc" className="mt-0">
                <LoincMappingTab />
              </TabsContent>

              {/* Encounters Tab */}
              <TabsContent value="encounters" className="mt-0">
                <EncountersTab
                  visits={visits}
                  sending={sending}
                  onSendEncounter={handleSendEncounter}
                  onPreviewEncounter={handlePreviewEncounter}
                  onViewStatus={handleViewStatus}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </PageContent>

      {/* Response Detail Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${lastResponse?.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {lastResponse?.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="text-base font-medium">{lastResponse?.title || 'Response Detail'}</p>
                <p className={`text-sm font-medium ${lastResponse?.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {lastResponse?.success ? 'Berhasil' : 'Gagal'} - {lastResponse?.type?.toUpperCase()}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto">
            <div className="space-y-4 py-4 pr-4">
              {/* Success Info */}
              {lastResponse?.success && lastResponse?.data && (
                <div className="space-y-3">
                  {lastResponse.data.satusehat_id && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">SatuSehat ID</p>
                      <code className="block px-3 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm font-mono break-all text-green-700 dark:text-green-300">
                        {lastResponse.data.satusehat_id}
                      </code>
                    </div>
                  )}
                  {lastResponse.data.message && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Pesan</p>
                      <p className="text-sm">{lastResponse.data.message}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Info */}
              {!lastResponse?.success && lastResponse?.data && (
                <div className="space-y-3">
                  {lastResponse.data.error && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Error</p>
                      <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-700 dark:text-red-300">{String(lastResponse.data.error)}</p>
                      </div>
                    </div>
                  )}

                  {lastResponse.data.status_code && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Status Code</p>
                      <Badge variant="destructive" className="font-mono">{String(lastResponse.data.status_code)}</Badge>
                    </div>
                  )}

                  {lastResponse.data.issue_details && Array.isArray(lastResponse.data.issue_details) && lastResponse.data.issue_details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Issues</p>
                      <ul className="space-y-1.5">
                        {(lastResponse.data.issue_details as string[]).map((issue, idx) => (
                          <li key={idx} className="text-sm pl-3 border-l-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Raw Response */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Raw Response</p>
                <ScrollArea className="h-[180px] w-full rounded-md border bg-muted/30">
                  <pre className="p-3 text-xs whitespace-pre-wrap font-mono break-all">
                    {lastResponse?.data
                      ? JSON.stringify(lastResponse.data, null, 2)
                      : 'No data'}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Preview FHIR Data Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <FileJson className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base font-medium">Preview Data FHIR</p>
                <p className="text-sm font-normal text-muted-foreground">Data yang akan dikirim ke SatuSehat</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : previewData ? (
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-5 py-4 pr-4">
                {/* Visit Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">No. Visit</p>
                    <p className="font-mono text-sm">{previewData.visit_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pasien</p>
                    <p className="text-sm">{previewData.patient_name}</p>
                    <code className="text-xs text-muted-foreground">{previewData.patient_ihs}</code>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Dokter</p>
                    <p className="text-sm">{previewData.doctor_name}</p>
                    <code className="text-xs text-muted-foreground">{previewData.doctor_ihs}</code>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Ruangan</p>
                    <p className="text-sm">{previewData.room_name}</p>
                    <code className="text-xs text-muted-foreground">{previewData.room_id}</code>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">{previewData.diagnosis_count} Diagnosis akan dikirim</p>
                </div>

                {/* Flow Explanation */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Alur Pengiriman</p>
                  <div className="space-y-1">
                    {previewData.flow_explanation?.map((step: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1 */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                    <span className="text-sm font-medium">POST Encounter (arrived)</span>
                  </div>
                  <ScrollArea className="h-[160px] w-full rounded-md border bg-muted/30">
                    <pre className="p-3 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(previewData.preview?.step_1_encounter_arrived, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>

                {/* Step 2 */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                    <span className="text-sm font-medium">POST Condition (diagnoses)</span>
                  </div>
                  {previewData.preview?.step_2_conditions?.map((condition: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-xs text-muted-foreground">Condition #{idx + 1}</p>
                      <ScrollArea className="h-[160px] w-full rounded-md border bg-muted/30">
                        <pre className="p-3 text-xs font-mono overflow-x-auto">
                          {JSON.stringify(condition, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  ))}
                </div>

                {/* Step 3 */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                    <span className="text-sm font-medium">PUT Encounter (finished + diagnosis)</span>
                  </div>
                  <ScrollArea className="h-[180px] w-full rounded-md border bg-muted/30">
                    <pre className="p-3 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(previewData.preview?.step_3_encounter_finished, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>

                {/* Notes */}
                {previewData.notes && previewData.notes.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Catatan</p>
                    <ul className="space-y-1">
                      {previewData.notes?.map((note: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Status Monitoring Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-none w-screen h-[100dvh] m-0 p-0 !rounded-none overflow-hidden flex flex-col gap-0 !border-0 sm:!rounded-none">
          <DialogHeader className="flex-shrink-0 p-3 border-b bg-muted/20">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold">Status Pengiriman FHIR</p>
                  <p className="text-xs font-normal text-muted-foreground">Monitoring resource encounter untuk {statusData?.summary.visit_number}</p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingStatus ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : statusData ? (
            <div className="flex-1 overflow-hidden flex bg-background">
              {/* Sidebar Master */}
              <div className="w-[260px] border-r flex flex-col bg-muted/10 flex-shrink-0">
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => setActiveStatusResource("Overview")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${activeStatusResource === "Overview" ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                      <Activity className="h-4 w-4" />
                      <span className="font-medium">Ringkasan & Syarat</span>
                    </button>

                    <div className="pt-4 pb-1.5 px-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Resources FHIR</p>
                    </div>

                    {statusData.resources?.map((r: Resource, i: number) => {
                      const isActive = activeStatusResource === r.resource;
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveStatusResource(r.resource)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-muted-foreground'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.resource}</span>
                            {r.required && !isActive && <Badge variant="outline" className="text-[9px] h-4 px-1 py-0">Wajib</Badge>}
                          </div>
                          {r.sent || r.all_sent ? (
                            <CheckCircle className={`h-4 w-4 ${isActive ? 'text-primary-foreground/90' : 'text-green-500'}`} />
                          ) : r.available === false ? (
                            <AlertCircle className={`h-4 w-4 ${isActive ? 'text-primary-foreground/90' : 'text-red-400'}`} />
                          ) : (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'}`}>
                              {r.sent_count || 0}/{r.total || 0}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Detail Content */}
              <div className="flex-1 flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                  <div className="p-5 md:p-6">
                    {activeStatusResource === "Overview" ? (
                      <div className="space-y-6">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-md bg-card">
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Visit Number</p>
                            <p className="font-mono text-sm font-medium">{statusData.summary.visit_number}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Pasien</p>
                            <p className="text-sm font-medium">{statusData.summary.patient_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status SatuSehat</p>
                            <Badge
                              variant={
                                statusData.summary.status === 'Lengkap' ? 'default' :
                                  statusData.summary.status === 'Sebagian' ? 'secondary' :
                                    'outline'
                              }
                              className={`text-xs px-2 py-0.5 ${statusData.summary.status === 'Lengkap' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                statusData.summary.status === 'Sebagian' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                }`}
                            >
                              {statusData.summary.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Progress Pengiriman</h3>
                            <span className={`text-sm font-bold ${statusData.summary.completion_percentage === 100 ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {statusData.summary.completion_percentage}%
                            </span>
                          </div>
                          <Progress value={statusData.summary.completion_percentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {statusData.summary.sent_required} dari {statusData.summary.required_resources} resource wajib terkirim
                          </p>
                        </div>

                        {/* Prerequisites */}
                        <div className="space-y-3">
                          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Syarat Awal</h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className={`flex items-center gap-2.5 p-3 border rounded-md ${statusData.prerequisites.patient_ihs ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                              {statusData.prerequisites.patient_ihs ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-sm font-medium ${statusData.prerequisites.patient_ihs ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Patient IHS</span>
                            </div>
                            <div className={`flex items-center gap-2.5 p-3 border rounded-md ${statusData.prerequisites.practitioner_ihs ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                              {statusData.prerequisites.practitioner_ihs ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-sm font-medium ${statusData.prerequisites.practitioner_ihs ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Practitioner IHS</span>
                            </div>
                            <div className={`flex items-center gap-2.5 p-3 border rounded-md ${statusData.prerequisites.location_id ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                              {statusData.prerequisites.location_id ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-sm font-medium ${statusData.prerequisites.location_id ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Location ID</span>
                            </div>
                          </div>
                        </div>

                        {/* Next Steps */}
                        {statusData.next_steps && statusData.next_steps.length > 0 && (
                          <div className="space-y-3 pt-3 border-t">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Langkah Selanjutnya</h3>
                            <ul className="space-y-2">
                              {statusData.next_steps?.map((step: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2.5 p-2.5 bg-muted/20 rounded-md">
                                  {step.startsWith('✅') ? (
                                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <div className="h-4 w-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                    </div>
                                  )}
                                  <span className={`text-sm ${step.startsWith('✅') ? 'text-green-700 dark:text-green-400 font-medium' : ''}`}>{step.replace('✅ ', '')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {statusData.resources?.filter((r: Resource) => r.resource === activeStatusResource).map((resource: Resource, idx: number) => {
                          const isSent = resource.sent === true || resource.all_sent === true;
                          const isPartial = resource.all_sent === false && (resource.sent_count || 0) > 0;

                          return (
                            <div key={idx} className={`rounded-lg border p-4 space-y-3 shadow-sm ${isSent ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/5' : 'bg-card'}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{resource.resource}</span>
                                    {resource.required && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1">Wajib</Badge>
                                    )}
                                    {resource.category && (
                                      <span className="text-xs text-muted-foreground">- {resource.category}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">{resource.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Vital Signs Send Button */}
                                  {resource.resource === 'Observation' && resource.category === 'vital-signs' && (
                                    resource.available && !resource.sent && statusData.summary.visit_id ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSendVitalSigns(statusData.summary.visit_id!)}
                                        disabled={sending === `vitalsigns-${statusData.summary.visit_id}`}
                                      >
                                        {sending === `vitalsigns-${statusData.summary.visit_id}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        ) : (
                                          <Send className="h-3 w-3 mr-1" />
                                        )}
                                        Kirim ({resource.items?.length || 0})
                                      </Button>
                                    ) : !resource.available ? (
                                      <Badge variant="secondary" className="text-xs text-red-600 dark:text-red-400">Belum diisi</Badge>
                                    ) : null
                                  )}

                                  {/* AllergyIntolerance Send All Button */}
                                  {resource.resource === 'AllergyIntolerance' && (
                                    (resource.total || 0) > 0 && !resource.all_sent && statusData.summary.visit_id ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSendAllAllergies(statusData.summary.visit_id!)}
                                        disabled={sending === `all-allergies-${statusData.summary.visit_id}`}
                                      >
                                        {sending === `all-allergies-${statusData.summary.visit_id}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        ) : (
                                          <Send className="h-3 w-3 mr-1" />
                                        )}
                                        Kirim Semua ({(resource.total || 0) - (resource.sent_count || 0)})
                                      </Button>
                                    ) : (resource.total || 0) === 0 ? (
                                      <Badge variant="secondary" className="text-xs text-muted-foreground">Tidak ada alergi</Badge>
                                    ) : null
                                  )}

                                  {/* Status Indicator */}
                                  {resource.sent !== undefined ? (
                                    resource.sent ? (
                                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Terkirim
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="gap-1 text-red-600 dark:text-red-400">
                                        <XCircle className="h-3 w-3" />
                                        Belum
                                      </Badge>
                                    )
                                  ) : resource.all_sent !== undefined ? (
                                    resource.all_sent ? (
                                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Semua Terkirim
                                      </Badge>
                                    ) : (
                                      <Badge variant={isPartial ? 'default' : 'secondary'} className={isPartial ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                                        {resource.sent_count || 0} / {resource.total || 0}
                                      </Badge>
                                    )
                                  ) : resource.available !== undefined ? (
                                    resource.available ? (
                                      <Badge variant="outline">Tersedia ({resource.count})</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-red-600 dark:text-red-400">Belum Diisi</Badge>
                                    )
                                  ) : null}
                                </div>
                              </div>

                              {/* Prerequisites */}
                              {resource.prerequisites && resource.prerequisites.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Syarat: {resource.prerequisites.join(', ')}
                                </p>
                              )}

                              {/* Warning */}
                              {!resource.sent && !resource.all_sent && resource.available === false && (
                                <div className="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded">
                                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>Lengkapi data {resource.resource} di Rekam Medis terlebih dahulu.</span>
                                </div>
                              )}

                              {/* Items Detail */}
                              {resource.items && Array.isArray(resource.items) && resource.items.length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <p className="text-xs text-muted-foreground">Detail:</p>
                                  <div className="space-y-1 max-h-28 overflow-y-auto">
                                    {typeof resource.items[0] === 'string' ? (
                                      (resource.items as string[]).map((item: string, i: number) => (
                                        <div key={i} className="text-xs flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
                                          <span className="text-muted-foreground">{i + 1}.</span>
                                          {item}
                                        </div>
                                      ))
                                    ) : (
                                      (resource.items as ResourceItem[]).map((item: ResourceItem, i: number) => (
                                        <div key={i} className={`text-xs flex items-center justify-between px-2 py-1.5 rounded ${item.sent || item.diagnosticreport_sent ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
                                          <span className={item.sent || item.diagnosticreport_sent ? 'text-green-700 dark:text-green-400' : ''}>
                                            {item.icd10_code && `${item.icd10_code} - ${item.icd10_name}`}
                                            {item.code && !item.procedure_type && `${item.code} - ${item.name}`}
                                            {/* Lab/Radiology Item Display */}
                                            {resource.resource === 'Lab/Radiology' && item.code && (
                                              <span className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${item.procedure_type === 'laboratory' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                  {item.procedure_type === 'laboratory' ? <TestTube className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                                                  {item.procedure_type === 'laboratory' ? 'Lab' : 'Rad'}
                                                </span>
                                                {`${item.code} - ${item.name}`}
                                                {item.has_loinc_mapping && item.loinc_code && (
                                                  <span className="text-muted-foreground">({item.loinc_code})</span>
                                                )}
                                              </span>
                                            )}
                                            {resource.resource === 'MedicationRequest' && item.medicine_name && `${item.medicine_name} - ${item.quantity} ${item.unit} (${item.dosage})`}
                                            {resource.resource === 'MedicationDispense' && item.medicine_name && (
                                              <>
                                                {`${item.medicine_name} - ${item.dispensed_qty} ${item.unit} (${item.dosage})`}
                                                {item.dispensed_by && <span className="text-muted-foreground ml-1">oleh {item.dispensed_by}</span>}
                                              </>
                                            )}
                                            {resource.resource === 'QuestionnaireResponse' && item.order_number && (
                                              <>
                                                {`Order #${item.order_number || item.id}`}
                                                {item.reviewed_by && <span className="text-muted-foreground ml-1">oleh {item.reviewed_by}</span>}
                                              </>
                                            )}
                                            {resource.resource === 'MedicationAdministration' && item.medicine_name && (
                                              <>
                                                {`${item.medicine_name} - ${item.quantity} ${item.unit}`}
                                                {item.dosage && <span className="text-muted-foreground ml-1">({item.dosage})</span>}
                                              </>
                                            )}
                                            {resource.resource === 'ClinicalImpression' && item.type_display && (
                                              <>
                                                {item.type_display}
                                                {!item.data_exists && <span className="text-muted-foreground ml-1">(data belum diisi)</span>}
                                              </>
                                            )}
                                            {resource.resource === 'AllergyIntolerance' && item.snomed_code && (
                                              <>
                                                {`${item.snomed_code} - ${item.snomed_display}`}
                                                {item.category && <span className="text-muted-foreground ml-1">({item.category})</span>}
                                              </>
                                            )}
                                            {resource.resource === 'MedicationStatement' && item.description && (
                                              <>
                                                <span className="truncate max-w-[200px]">{item.description}</span>
                                                {item.source_display && <span className="text-muted-foreground ml-1">({item.source_display})</span>}
                                              </>
                                            )}
                                            {resource.resource === 'CarePlan' && (item.plan || item.instruction) && (
                                              <>
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${item.source === 'cppt'
                                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                  : item.source === 'assessment'
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                                  }`}>
                                                  {item.source === 'cppt' ? 'CPPT' : item.source === 'assessment' ? 'Plan' : 'RTL'}
                                                </span>
                                                <span className="truncate max-w-[180px]">{item.plan || item.instruction}</span>
                                                {item.profession && <span className="text-muted-foreground ml-1">({item.profession})</span>}
                                              </>
                                            )}
                                            {resource.resource === 'Composition' && item.name && `${item.name}`}
                                            {item.name && item.value !== undefined && `${item.name}: ${item.value} ${item.unit || ''}`}
                                            {item.status && !item.code && !item.medicine_name && !item.name && `Order #${item.id}`}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {/* Lab/Radiology - handle separately since it uses diagnosticreport_sent instead of sent */}
                                            {resource.resource === 'Lab/Radiology' && item.id && (
                                              <div className="flex items-center gap-1">
                                                {/* Status badges */}
                                                {item.diagnosticreport_sent ? (
                                                  <Badge className="text-[9px] h-5 px-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                                    Lengkap
                                                  </Badge>
                                                ) : (
                                                  <>
                                                    {/* Individual resource status */}
                                                    <div className="flex items-center gap-0.5">
                                                      <Badge
                                                        variant="outline"
                                                        className={`text-[8px] h-4 px-1 ${item.servicerequest_sent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                                                        title={item.servicerequest_sent ? `ServiceRequest: ${item.servicerequest_id}` : 'ServiceRequest belum dikirim'}
                                                      >
                                                        SR {item.servicerequest_sent ? '✓' : '○'}
                                                      </Badge>
                                                      {item.procedure_type === 'laboratory' && (
                                                        <Badge
                                                          variant="outline"
                                                          className={`text-[8px] h-4 px-1 ${item.specimen_sent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                                                          title={item.specimen_sent ? `Specimen: ${item.specimen_id}` : 'Specimen belum dikirim'}
                                                        >
                                                          SP {item.specimen_sent ? '✓' : '○'}
                                                        </Badge>
                                                      )}
                                                      <Badge
                                                        variant="outline"
                                                        className={`text-[8px] h-4 px-1 ${item.diagnosticreport_sent ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                                                        title={item.diagnosticreport_sent ? `DiagnosticReport: ${item.diagnosticreport_id}` : 'DiagnosticReport belum dikirim'}
                                                      >
                                                        DR {item.diagnosticreport_sent ? '✓' : '○'}
                                                      </Badge>
                                                    </div>
                                                    {/* Send All Button */}
                                                    {item.can_send_all ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-5 px-1.5 text-[10px]"
                                                        onClick={() => statusData.summary.visit_id && handleSendAllLabResources(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `lab-all-${item.id}`}
                                                      >
                                                        {sending === `lab-all-${item.id}` ? (
                                                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                        ) : (
                                                          <>
                                                            <Send className="h-2.5 w-2.5 mr-0.5" />
                                                            Kirim Semua
                                                          </>
                                                        )}
                                                      </Button>
                                                    ) : !item.has_loinc_mapping ? (
                                                      <Badge variant="outline" className="text-[8px] h-4 px-1 text-orange-600 dark:text-orange-400">
                                                        Perlu LOINC Mapping
                                                      </Badge>
                                                    ) : item.status !== 'completed' ? (
                                                      <Badge variant="outline" className="text-[8px] h-4 px-1 text-orange-600 dark:text-orange-400">
                                                        Status: {item.status}
                                                      </Badge>
                                                    ) : null}
                                                  </>
                                                )}
                                              </div>
                                            )}
                                            {/* Other resources using item.sent */}
                                            {resource.resource !== 'Lab/Radiology' && item.sent !== undefined && (
                                              item.sent ? (
                                                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                              ) : (
                                                <>
                                                  {resource.resource === 'Procedure' && item.id && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-6 px-2 text-xs"
                                                      onClick={() => statusData.summary.visit_id && handleSendProcedure(item.id!, statusData.summary.visit_id)}
                                                      disabled={sending === `procedure-${item.id}`}
                                                    >
                                                      {sending === `procedure-${item.id}` ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        'Kirim'
                                                      )}
                                                    </Button>
                                                  )}
                                                  {resource.resource === 'MedicationRequest' && item.id && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-6 px-2 text-xs"
                                                      onClick={() => statusData.summary.visit_id && handleSendMedicationRequest(item.id!, statusData.summary.visit_id)}
                                                      disabled={sending === `medication-${item.id}`}
                                                    >
                                                      {sending === `medication-${item.id}` ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        'Kirim'
                                                      )}
                                                    </Button>
                                                  )}
                                                  {resource.resource === 'MedicationDispense' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendMedicationDispense(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `dispense-${item.id}`}
                                                      >
                                                        {sending === `dispense-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Resep belum dikirim
                                                      </Badge>
                                                    )
                                                  )}
                                                  {resource.resource === 'QuestionnaireResponse' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendQuestionnaireResponse(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `questionnaire-${item.id}`}
                                                      >
                                                        {sending === `questionnaire-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Resep belum dikirim
                                                      </Badge>
                                                    )
                                                  )}
                                                  {resource.resource === 'MedicationAdministration' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendMedicationAdministration(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `administration-${item.id}`}
                                                      >
                                                        {sending === `administration-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Dispense belum dikirim
                                                      </Badge>
                                                    )
                                                  )}
                                                  {resource.resource === 'Composition' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendComposition(statusData.summary.visit_id)}
                                                        disabled={sending === `composition-${statusData.summary.visit_id}`}
                                                      >
                                                        {sending === `composition-${statusData.summary.visit_id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : !item.sent ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Encounter & Condition belum dikirim
                                                      </Badge>
                                                    ) : null
                                                  )}
                                                  {resource.resource === 'ClinicalImpression' && item.type && (
                                                    item.can_send && item.data_exists ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendClinicalImpression(statusData.summary.visit_id, item.type as 'history' | 'rationale' | 'prognosis' | 'triage')}
                                                        disabled={sending === `clinical-impression-${item.type}-${statusData.summary.visit_id}`}
                                                      >
                                                        {sending === `clinical-impression-${item.type}-${statusData.summary.visit_id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : !item.sent && !item.data_exists ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Data belum diisi
                                                      </Badge>
                                                    ) : !item.sent && item.data_exists ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Encounter belum dikirim
                                                      </Badge>
                                                    ) : null
                                                  )}
                                                  {resource.resource === 'AllergyIntolerance' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendAllergy(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `allergy-${item.id}`}
                                                      >
                                                        {sending === `allergy-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : !item.sent ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Encounter belum dikirim
                                                      </Badge>
                                                    ) : null
                                                  )}
                                                  {resource.resource === 'MedicationStatement' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendMedicationStatement(item.id!, statusData.summary.visit_id)}
                                                        disabled={sending === `medicationstatement-${item.id}`}
                                                      >
                                                        {sending === `medicationstatement-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : !item.sent ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Encounter belum dikirim
                                                      </Badge>
                                                    ) : null
                                                  )}
                                                  {resource.resource === 'CarePlan' && item.id && (
                                                    item.can_send ? (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => statusData.summary.visit_id && handleSendCarePlan(item.id!, item.source as 'cppt' | 'disposition' | 'assessment', statusData.summary.visit_id)}
                                                        disabled={sending === `careplan-${item.source}-${item.id}`}
                                                      >
                                                        {sending === `careplan-${item.source}-${item.id}` ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          'Kirim'
                                                        )}
                                                      </Button>
                                                    ) : !item.sent ? (
                                                      <Badge variant="outline" className="text-[9px] h-5 px-1 text-orange-600 dark:text-orange-400">
                                                        Encounter belum dikirim
                                                      </Badge>
                                                    ) : null
                                                  )}
                                                  {resource.resource !== 'Procedure' && resource.resource !== 'MedicationRequest' && resource.resource !== 'MedicationDispense' && resource.resource !== 'QuestionnaireResponse' && resource.resource !== 'MedicationAdministration' && resource.resource !== 'Composition' && resource.resource !== 'ClinicalImpression' && resource.resource !== 'AllergyIntolerance' && resource.resource !== 'MedicationStatement' && resource.resource !== 'CarePlan' && (
                                                    <XCircle className="h-3 w-3 text-red-400" />
                                                  )}
                                                </>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Note */}
                              {resource.note && (
                                <p className="text-xs text-muted-foreground flex items-start gap-1 pt-1">
                                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {resource.note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
