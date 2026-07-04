import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Home,
  Ambulance,
  Hospital,
  FileText,
  ExternalLink,
  ArrowRight,
  XCircle,
  Trash2,
  PenTool,
  Printer,
} from "lucide-react";
import { useMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi, type Disposition } from "@/lib/api/medical-records";
import { roomsApi, schedulesApi, type Room } from "@/lib/api/rooms";
import { admissionRequestApi } from "@/lib/api/admission-request";
import { vclaimApi, type SEPLocal, type VClaimSPRIResponse, type SuratKontrolResponse } from "@/lib/api/vclaim";
import { visitsApi } from "@/lib/api/visits";
import { registrationApi } from "@/lib/api/queue";
import { useToast } from "@/hooks/use-toast";
import { printApi } from "@/lib/api/print";
import { SignOnBehalfDialog } from "@/components/signature/sign-on-behalf-dialog";
import { cn } from "@/lib/utils";
import {
  DischargeDrawer,
  AdmissionDrawer,
  ReferralDrawer,
  DeathDrawer,
  OutpatientTransferDrawer,
  type DispositionFormData,
} from "./disposition-drawers";

interface DispositionFormProps {
  visitId: number;
  initialData?: Disposition;
  onSave?: (data: Disposition) => void;
  isEmergency?: boolean;
  readOnly?: boolean;
  externalData?: Partial<Disposition>;
  useExternalData?: boolean;
}

// Icon mapping for disposition types
const dispositionIcons: Record<string, React.ReactNode> = {
  pulang: <Home className="h-5 w-5" />,
  rawat_inap: <Hospital className="h-5 w-5" />,
  rawat_jalan: <ArrowRight className="h-5 w-5" />,
  rujuk: <Ambulance className="h-5 w-5" />,
  meninggal: <FileText className="h-5 w-5" />,
  aps: <ExternalLink className="h-5 w-5" />,
};

// Description mapping for disposition options
const dispositionDescriptions: Record<string, string> = {
  pulang: "Pasien pulang dalam keadaan baik",
  rawat_inap: "Pasien memerlukan rawat inap",
  rawat_jalan: "Pasien tidak gawat darurat, rujuk ke poli",
  rujuk: "Pasien dirujuk ke fasilitas lain",
  meninggal: "Pasien meninggal dunia",
  aps: "Pasien pulang atas permintaan sendiri",
};

interface PendingOrdersInfo {
  has_pending_orders: boolean;
  pending_medicine_orders: number;
  pending_procedure_orders: number;
  pending_pharmacy_visits: number;
  can_discharge: boolean;
  is_inpatient: boolean;
  visit_type: string;
  registration_type: string;
}

// Type for available doctor from schedule
interface AvailableDoctor {
  employee_id: number;
  employee_name: string;
  start_time: string;
  end_time: string;
  max_patients: number;
  consult_fee: number;
}

export function DispositionForm({
  visitId,
  initialData,
  onSave,
  isEmergency: _isEmergency = false,
  readOnly = false,
  externalData,
  useExternalData = false,
}: DispositionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pendingOrdersInfo, setPendingOrdersInfo] = useState<PendingOrdersInfo | null>(null);
  
  // Rooms for follow-up (poli)
  const [poliRooms, setPoliRooms] = useState<Room[]>([]);
  
  // Available doctors based on selected room and date
  const [availableDoctors, setAvailableDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  
  // Outpatient transfer doctors (for UGD → Rawat Jalan)
  const [outpatientDoctors, setOutpatientDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingOutpatientDoctors, setLoadingOutpatientDoctors] = useState(false);
  
  // Follow-up registration data for QR code
  const [followUpRegData, setFollowUpRegData] = useState<{
    id: number;
    registration_number: string;
    scheduled_date?: string;
    room_name?: string;
    doctor_name?: string;
    queue_number?: string;
    patient_name?: string;
  } | null>(null);
  
  // ===== BPJS Control State =====
  const [activeSEP, setActiveSEP] = useState<SEPLocal | null>(null);
  const [_loadingSEP, setLoadingSEP] = useState(false);
  const [spriResult, setSpriResult] = useState<(VClaimSPRIResponse & { id?: number }) | null>(null);
  const [suratKontrolResult, setSuratKontrolResult] = useState<(SuratKontrolResponse & { id?: number }) | null>(null);
  const [signDoc, setSignDoc] = useState<{ id: number; type: string; title: string } | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  
  const [patientNoBpjs, setPatientNoBpjs] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<number | null>(null);
  const [patientData, setPatientData] = useState<{
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  } | null>(null);

  // Drawer states
  const [dischargeDrawerOpen, setDischargeDrawerOpen] = useState(false);
  const [admissionDrawerOpen, setAdmissionDrawerOpen] = useState(false);
  const [referralDrawerOpen, setReferralDrawerOpen] = useState(false);
  const [deathDrawerOpen, setDeathDrawerOpen] = useState(false);
  const [outpatientTransferDrawerOpen, setOutpatientTransferDrawerOpen] = useState(false);

  // Loaded disposition data from API
  const [loadedDispositionData, setLoadedDispositionData] = useState<Disposition | null>(null);

  // Check if form is disabled (already saved) - check both initialData and loaded data
  const isDisabled = useExternalData
    ? false
    : !!(initialData?.disposition_type || loadedDispositionData?.disposition_type);

  // Control and SPRI type selection
  const [kontrolType, setKontrolType] = useState<"none" | "simrs" | "bpjs">("none");
  const [spriType, setSpriType] = useState<"simrs" | "bpjs">("simrs");
  
  // Fetch disposition options from master data
  const { data: dispositionData } = useMasterData('disposition_type');
  const { data: dischargeConditionData } = useMasterData('discharge_condition');
  
  // Inpatient class options for preferred class
  const { data: inpatientClassData } = useMasterData('inpatient_class');
  
  const dispositionOptions = dispositionData
    .filter(item => !(item.code === 'rawat_inap' && pendingOrdersInfo?.is_inpatient))
    .filter(item => !['dod', 'doa'].includes(item.code))
    .filter(item => item.code !== 'rawat_jalan' || _isEmergency) // rawat_jalan only for UGD
    .map(item => ({
      value: item.code,
      label: item.name,
      description: dispositionDescriptions[item.code] || item.description || '',
      icon: dispositionIcons[item.code] || <FileText className="h-5 w-5" />,
    }));
  
  const dischargeConditionOptions = dischargeConditionData.map(item => ({
    value: item.code,
    label: item.name,
  }));
  
  const inpatientClassOptions = inpatientClassData.map(item => ({
    value: item.code,
    label: item.name,
  }));

  const [formData, setFormData] = useState<DispositionFormData>({
    disposition_type: initialData?.disposition_type || "",
    disposition_note: initialData?.disposition_note || "",
    discharge_status: initialData?.discharge_status || "",
    discharge_condition: initialData?.discharge_condition || "",
    referral_facility: initialData?.referral_facility || "",
    referral_address: initialData?.referral_address || "",
    referral_phone: initialData?.referral_phone || "",
    referral_specialist: initialData?.referral_specialist || "",
    referral_reason: initialData?.referral_reason || "",
    referral_urgency: initialData?.referral_urgency || "",
    referral_diagnosis: initialData?.referral_diagnosis || "",
    referral_therapy: initialData?.referral_therapy || "",
    referral_lab_result: initialData?.referral_lab_result || "",
    referral_notes: initialData?.referral_notes || "",
    referral_mode: "manual",
    referral_no_rujukan: "",
    referral_no_sep: "",
    referral_tgl_rujukan: "",
    referral_tgl_rencana_kunjungan: "",
    referral_ppk_code: "",
    referral_jns_pelayanan: "2",
    referral_tipe_rujukan: "0",
    referral_poli_code: "",
    referral_diag_code: "",
    referral_khusus_id: "",
    referral_khusus_diagnosa_codes: "",
    referral_khusus_procedure_codes: "",
    admission_type: initialData?.admission_type || "",
    admission_reason: initialData?.admission_reason || "",
    admission_priority: "normal",
    preferred_class: "",
    special_notes: "",
    death_time: initialData?.death_time || "",
    death_cause: initialData?.death_cause || "",
    follow_up_date: initialData?.follow_up_date || "",
    follow_up_instruction: initialData?.follow_up_instruction || "",
    follow_up_room_id: initialData?.follow_up_room_id,
    follow_up_doctor_id: undefined,
    discharge_medication: initialData?.discharge_medication || "",
    discharge_instruction: initialData?.discharge_instruction || "",
    outpatient_room_id: (initialData as any)?.outpatient_room_id,
    outpatient_doctor_id: undefined,
    transfer_reason: (initialData as any)?.transfer_reason || "",
  });

  // Load available doctors when room and date change
  const loadAvailableDoctors = async (roomId: number, date: string) => {
    if (!roomId || !date) {
      setAvailableDoctors([]);
      return;
    }
    
    setLoadingDoctors(true);
    try {
      const response = await schedulesApi.getAvailableDoctorsByDate(roomId, date);
      setAvailableDoctors(response.data.data || []);
      setRoomClosed(response.data.room_closed || false);
      
      if (formData.follow_up_doctor_id) {
        const isAvailable = (response.data.data || []).some(
          d => d.employee_id === formData.follow_up_doctor_id
        );
        if (!isAvailable) {
          setFormData(prev => ({ ...prev, follow_up_doctor_id: undefined }));
        }
      }
    } catch (err) {
      console.error("Failed to load available doctors:", err);
      setAvailableDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Load rooms for poli
  const loadRooms = async () => {
    try {
      const roomsResponse = await roomsApi.getAll({ limit: 1000, is_active: 'true' });
      const allRooms = roomsResponse.data.data || [];
      
      const filteredPoliRooms = allRooms.filter(r => 
        (r.room_type?.toLowerCase().includes('poli') || r.service_type === 'rawat_jalan') && r.is_active
      );
      
      setPoliRooms(filteredPoliRooms);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  // Load existing data
  useEffect(() => {
    if (useExternalData) {
      const d = externalData || {};
      setFormData((prev) => ({
        ...prev,
        disposition_type: d.disposition_type || "",
        disposition_note: d.disposition_note || "",
        discharge_status: d.discharge_status || "",
        discharge_condition: d.discharge_condition || "",
        referral_facility: d.referral_facility || "",
        referral_address: d.referral_address || "",
        referral_phone: d.referral_phone || "",
        referral_specialist: d.referral_specialist || "",
        referral_reason: d.referral_reason || "",
        referral_urgency: d.referral_urgency || "",
        referral_diagnosis: d.referral_diagnosis || "",
        referral_therapy: d.referral_therapy || "",
        referral_lab_result: d.referral_lab_result || "",
        referral_notes: d.referral_notes || "",
        referral_mode: (d as any).referral_mode || "manual",
        referral_no_rujukan: (d as any).referral_no_rujukan || "",
        referral_no_sep: (d as any).referral_no_sep || "",
        referral_tgl_rujukan: (d as any).referral_tgl_rujukan || "",
        referral_tgl_rencana_kunjungan: (d as any).referral_tgl_rencana_kunjungan || "",
        referral_ppk_code: (d as any).referral_ppk_code || "",
        referral_jns_pelayanan: (d as any).referral_jns_pelayanan || "2",
        referral_tipe_rujukan: (d as any).referral_tipe_rujukan || "0",
        referral_poli_code: (d as any).referral_poli_code || "",
        referral_diag_code: (d as any).referral_diag_code || "",
        referral_khusus_id: (d as any).referral_khusus_id || "",
        referral_khusus_diagnosa_codes: (d as any).referral_khusus_diagnosa_codes || "",
        referral_khusus_procedure_codes: (d as any).referral_khusus_procedure_codes || "",
        admission_type: d.admission_type || "",
        admission_reason: d.admission_reason || "",
        death_time: d.death_time || "",
        death_cause: d.death_cause || "",
        follow_up_date: d.follow_up_date ? d.follow_up_date.split("T")[0] : "",
        follow_up_instruction: d.follow_up_instruction || "",
        follow_up_room_id: d.follow_up_room_id,
        discharge_medication: d.discharge_medication || "",
        discharge_instruction: d.discharge_instruction || "",
        outpatient_room_id: d.outpatient_room_id,
        transfer_reason: d.transfer_reason || "",
      }));
      setLoading(false);
      return;
    }

    const loadData = async () => {
      if (!visitId) return;
      setLoading(true);
      try {
        const response = await medicalRecordsApi.getDisposition(visitId);
        if (response.data) {
          // Store loaded disposition data for isDisabled check
          setLoadedDispositionData(response.data);
          
          setFormData({
            disposition_type: response.data.disposition_type || "",
            disposition_note: response.data.disposition_note || "",
            discharge_status: response.data.discharge_status || "",
            discharge_condition: response.data.discharge_condition || "",
            referral_facility: response.data.referral_facility || "",
            referral_address: response.data.referral_address || "",
            referral_phone: response.data.referral_phone || "",
            referral_specialist: response.data.referral_specialist || "",
            referral_reason: response.data.referral_reason || "",
            referral_urgency: response.data.referral_urgency || "",
            referral_diagnosis: response.data.referral_diagnosis || "",
            referral_therapy: response.data.referral_therapy || "",
            referral_lab_result: response.data.referral_lab_result || "",
            referral_notes: response.data.referral_notes || "",
            referral_mode: (response.data as any).referral_mode || "manual",
            referral_no_rujukan: (response.data as any).referral_no_rujukan || "",
            referral_no_sep: (response.data as any).referral_no_sep || "",
            referral_tgl_rujukan: (response.data as any).referral_tgl_rujukan || "",
            referral_tgl_rencana_kunjungan: (response.data as any).referral_tgl_rencana_kunjungan || "",
            referral_ppk_code: (response.data as any).referral_ppk_code || "",
            referral_jns_pelayanan: (response.data as any).referral_jns_pelayanan || "2",
            referral_tipe_rujukan: (response.data as any).referral_tipe_rujukan || "0",
            referral_poli_code: (response.data as any).referral_poli_code || "",
            referral_diag_code: (response.data as any).referral_diag_code || "",
            referral_khusus_id: (response.data as any).referral_khusus_id || "",
            referral_khusus_diagnosa_codes: (response.data as any).referral_khusus_diagnosa_codes || "",
            referral_khusus_procedure_codes: (response.data as any).referral_khusus_procedure_codes || "",
            admission_type: response.data.admission_type || "",
            admission_reason: response.data.admission_reason || "",
            admission_priority: "normal",
            preferred_class: "",
            special_notes: "",
            death_time: response.data.death_time || "",
            death_cause: response.data.death_cause || "",
            follow_up_date: response.data.follow_up_date ? response.data.follow_up_date.split('T')[0] : "",
            follow_up_instruction: response.data.follow_up_instruction || "",
            follow_up_room_id: response.data.follow_up_room_id,
            follow_up_doctor_id: undefined,
            discharge_medication: response.data.discharge_medication || "",
            discharge_instruction: response.data.discharge_instruction || "",
            outpatient_room_id: response.data.outpatient_room_id,
            outpatient_doctor_id: undefined,
            transfer_reason: response.data.transfer_reason || "",
          });
          
          if (response.data.disposition_type === "pulang" && response.data.follow_up_date) {
            setKontrolType("simrs");
          } else if (response.data.disposition_type === "aps") {
            setKontrolType("none");
          }
          
          // Load SPRI data if exists (for rawat_inap disposition)
          if (response.data.disposition_type === "rawat_inap") {
            try {
              const spriResponse = await vclaimApi.getSPRIByVisit(visitId);
              if (spriResponse.data?.data) {
                const spriData = spriResponse.data.data;
                setSpriResult({
                  id: spriData.id,
                  noSPRI: spriData.no_spri,
                  tglRencanaKontrol: spriData.tgl_rencana_kontrol,
                  namaDokter: spriData.nama_dokter,
                  noKartu: spriData.no_kartu,
                  nama: spriData.nama,
                  kelamin: spriData.kelamin,
                  tglLahir: spriData.tgl_lahir,
                  namaDiagnosa: spriData.nama_diagnosa,
                });
              }
            } catch (err) {
              console.log("No SPRI found for this visit:", err);
            }
          }
          
          // Load Surat Kontrol data if exists (for pulang disposition)
          if (response.data.disposition_type === "pulang") {
            try {
              const skResponse = await vclaimApi.getSuratKontrolByVisit(visitId);
              if (skResponse.data?.data) {
                const skData = skResponse.data.data;
                setSuratKontrolResult({
                  id: skData.id,
                  noSuratKontrol: skData.no_surat_kontrol,
                  tglRencanaKontrol: skData.tgl_rencana_kontrol,
                  namaDokter: skData.nama_dokter,
                  noKartu: skData.no_kartu,
                  nama: skData.nama,
                  kelamin: skData.kelamin,
                  tglLahir: skData.tgl_lahir,
                  namaDiagnosa: skData.nama_diagnosa,
                });
              }
            } catch (err) {
              console.log("No Surat Kontrol found for this visit:", err);
            }
          }
        }
        
        // Check pending orders
        try {
          const pendingResponse = await medicalRecordsApi.checkPendingOrders(visitId);
          setPendingOrdersInfo(pendingResponse.data);
        } catch (err) {
          console.error("Failed to check pending orders:", err);
        }
      } catch (err) {
        console.error("Failed to load disposition:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    loadRooms();
  }, [visitId, useExternalData, externalData]);

  // Load available doctors when room and date change (for both SIMRS and BPJS sync)
  useEffect(() => {
    const shouldLoadDoctors = formData.follow_up_room_id && formData.follow_up_date && 
      (kontrolType === "simrs" || (kontrolType === "bpjs" && !!suratKontrolResult));
    
    if (shouldLoadDoctors) {
      loadAvailableDoctors(formData.follow_up_room_id!, formData.follow_up_date);
    }
  }, [formData.follow_up_room_id, formData.follow_up_date, kontrolType, suratKontrolResult]);

  // Load available doctors for outpatient transfer (today's date)
  useEffect(() => {
    const outpatientRoomId = (formData as any).outpatient_room_id;
    if (!outpatientRoomId) return;
    
    const loadOutpatientDoctors = async () => {
      setLoadingOutpatientDoctors(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        //const schedResponse = await schedulesApi.getAvailableDoctors(outpatientRoomId, today);
        const schedResponse = await schedulesApi.getAvailableDoctorsByDate(outpatientRoomId, today);
        const doctors = schedResponse.data?.data || [];
        setOutpatientDoctors(doctors);
      } catch (err) {
        console.error("Failed to load outpatient doctors:", err);
        setOutpatientDoctors([]);
      } finally {
        setLoadingOutpatientDoctors(false);
      }
    };
    loadOutpatientDoctors();
  }, [(formData as any).outpatient_room_id]);

  // Load active SEP and patient data
  const loadBPJSData = async () => {
    if (!visitId) return;
    
    setLoadingSEP(true);
    try {
      // First get visit to get registration_id
      const visitResponse = await visitsApi.getById(visitId);
      const visitData = visitResponse.data;
      
      // Get registration to get patient data
      if (visitData?.registration_id) {
        setRegistrationId(visitData.registration_id);
        try {
          const regResponse = await registrationApi.getById(visitData.registration_id);
          const registration = regResponse.data?.data;
          
          if (registration?.patient) {
            const patient = registration.patient as Record<string, unknown>;
            // Get bpjs_number from registration first, then fallback to patient data
            const bpjsNumber = registration.bpjs_number ||
              (patient.no_bpjs as string) ||
              (patient.bpjs_number as string);

            setPatientData({
              id: (patient.id as number) || (patient.ID as number) || 0,
              no_rm: (patient.no_rm as string) || (patient.medical_record_number as string) || "",
              nama_lengkap: (patient.nama_lengkap as string) || (patient.name as string) || "",
              nik: patient.nik as string,
              no_bpjs: bpjsNumber,
              tanggal_lahir: (patient.tanggal_lahir as string) || (patient.date_of_birth as string),
              jenis_kelamin: (patient.jenis_kelamin as string) || (patient.gender as string),
            });

            if (bpjsNumber) {
              setPatientNoBpjs(bpjsNumber);
            }
          }
          
          // Get active SEP - first try by visit (for kontrol visits), then by registration
          try {
            // Try getting SEP by current visit first (for kontrol visits that have their own SEP)
            const sepByVisitResponse = await vclaimApi.getSEPByVisit(visitId);
            if (sepByVisitResponse.data?.data) {
              setActiveSEP(sepByVisitResponse.data.data);
            } else {
              // Fallback to SEP by registration (for initial visits)
              const sepResponse = await vclaimApi.getSEPByRegistration(visitData.registration_id);
              if (sepResponse.data?.data) {
                setActiveSEP(sepResponse.data.data);
              }
            }
          } catch (sepErr) {
            // If visit SEP not found, try registration SEP as fallback
            try {
              const sepResponse = await vclaimApi.getSEPByRegistration(visitData.registration_id);
              if (sepResponse.data?.data) {
                setActiveSEP(sepResponse.data.data);
              }
            } catch (regSepErr) {
              console.log("No SEP found for visit or registration");
            }
          }
        } catch (regErr) {
          console.error("Failed to load registration:", regErr);
        }
      }
      
      // Check for existing SPRI
      try {
        const spriRes = await vclaimApi.getSPRIByVisit(visitId);
        if (spriRes.data?.data) {
          const spriData = spriRes.data.data;
          setSpriResult({
            noSPRI: spriData.no_spri,
            tglRencanaKontrol: spriData.tgl_rencana_kontrol,
            namaDokter: spriData.nama_dokter,
            noKartu: spriData.no_kartu,
            nama: spriData.nama,
            kelamin: spriData.kelamin,
            tglLahir: spriData.tgl_lahir,
            namaDiagnosa: spriData.nama_diagnosa,
          });
        }
      } catch (spriErr) {
        console.log("No SPRI found for this visit");
      }
      
      // Check for existing Surat Kontrol
      try {
        const skRes = await vclaimApi.getSuratKontrolByVisit(visitId);
        if (skRes.data?.data) {
          const skLocal = skRes.data.data;
          setSuratKontrolResult({
            noSuratKontrol: skLocal.no_surat_kontrol,
            tglRencanaKontrol: skLocal.tgl_rencana_kontrol,
            namaDokter: skLocal.nama_dokter,
            noKartu: skLocal.no_kartu,
            nama: skLocal.nama,
            kelamin: skLocal.kelamin,
            tglLahir: skLocal.tgl_lahir,
            namaDiagnosa: skLocal.nama_diagnosa,
          });
          // Sync follow_up_date from loaded Surat Kontrol
          if (skLocal.tgl_rencana_kontrol) {
            setFormData(prev => ({ ...prev, follow_up_date: skLocal.tgl_rencana_kontrol }));
          }
          // Set kontrolType to bpjs since we have an active Surat Kontrol
          setKontrolType("bpjs");
        }
      } catch (skErr) {
        console.log("No Surat Kontrol found for this visit");
      }
    } catch (err) {
      console.log("No active SEP found for this visit");
    } finally {
      setLoadingSEP(false);
    }
  };

  useEffect(() => {
    if (useExternalData) return;
    loadBPJSData();
  }, [visitId, useExternalData]);

  // Handle cancel disposition
  const handleCancelDisposition = async () => {
    setCanceling(true);
    try {
      const canceledItems: string[] = [];
      const failedItems: string[] = [];

      // 1. Cancel Surat Kontrol BPJS (if exists)
      if (suratKontrolResult?.noSuratKontrol) {
        try {
          await vclaimApi.deleteSuratKontrol(suratKontrolResult.noSuratKontrol);
          canceledItems.push(`Surat Kontrol BPJS: ${suratKontrolResult.noSuratKontrol}`);
          setSuratKontrolResult(null);
        } catch (err) {
          console.error("Failed to delete Surat Kontrol:", err);
          failedItems.push(`Surat Kontrol BPJS: ${suratKontrolResult.noSuratKontrol}`);
        }
      }

      // 2. Cancel SPRI (API delete sama dengan Surat Kontrol)
      // Always try to cancel SPRI for this visit, regardless of disposition type
      try {
        console.log("Attempting to cancel SPRI for visit:", visitId);
        // First, delete from BPJS if we have the SPRI number
        if (spriResult?.noSPRI) {
          try {
            console.log("Deleting SPRI from BPJS:", spriResult.noSPRI);
            await vclaimApi.deleteSuratKontrol(spriResult.noSPRI);
            canceledItems.push(`SPRI BPJS: ${spriResult.noSPRI}`);
          } catch (bpjsErr) {
            console.error("Failed to delete SPRI from BPJS:", bpjsErr);
            failedItems.push(`SPRI BPJS: ${spriResult.noSPRI}`);
          }
        }
        // Then update local status
        await vclaimApi.cancelSPRILocal(visitId);
        setSpriResult(null);
      } catch (err: unknown) {
        // 404 means no active SPRI found, which is fine
        const error = err as { response?: { status?: number } };
        if (error.response?.status !== 404) {
          console.error("Failed to cancel SPRI:", err);
        } else {
          console.log("No active SPRI to cancel");
        }
      }

      // 3. Cancel Admission Request (if pending)
      const isRawatInap = formData.disposition_type === "rawat_inap" || 
                          loadedDispositionData?.disposition_type === "rawat_inap";
      if (isRawatInap) {
        try {
          // Find pending admission request for this visit
          const admissionResponse = await admissionRequestApi.getAll({ 
            source_visit_id: visitId,
            status: "pending",
            limit: 1 
          } as { source_visit_id?: number; status?: string; limit?: number });
          const admissions = admissionResponse.data?.data || [];
          
          if (admissions.length > 0) {
            const pendingAdmission = admissions[0];
            await admissionRequestApi.cancel(pendingAdmission.id);
            canceledItems.push(`Permintaan Rawat Inap: ${pendingAdmission.request_number}`);
          }
        } catch (err) {
          console.error("Failed to cancel admission request:", err);
          failedItems.push("Permintaan Rawat Inap");
        }
      }

      // 4. Cancel follow-up registration (if exists)
      const hasFollowUpReg = loadedDispositionData?.follow_up_registration_id || initialData?.follow_up_registration_id;
      if (hasFollowUpReg) {
        try {
          // Call API to cancel the follow-up registration
          await medicalRecordsApi.cancelFollowUpRegistration(visitId);
          canceledItems.push("Jadwal Kontrol SIMRS");
        } catch (err) {
          console.error("Failed to cancel follow-up registration:", err);
          failedItems.push("Jadwal Kontrol SIMRS");
        }
      }

      // 5. Reset disposition in database
      try {
        await medicalRecordsApi.cancelDisposition(visitId);
        canceledItems.push("Data Disposisi");
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        // Idempotent behavior: if disposition already gone, consider as already cancelled
        if (error.response?.status === 404) {
          canceledItems.push("Data Disposisi (sudah dibatalkan)");
        } else {
          console.error("Failed to reset disposition:", err);
          failedItems.push("Data Disposisi");
        }
      }

      // Show result
      if (failedItems.length === 0) {
        toast({
          title: "Pembatalan Berhasil",
          description: `Berhasil membatalkan: ${canceledItems.join(", ")}`,
        });
        // Trigger data refresh
        setLoadedDispositionData(null);
        onSave?.({} as any);
      } else {
        toast({
          title: "Pembatalan Sebagian Berhasil",
          description: `Berhasil: ${canceledItems.join(", ")}. Gagal: ${failedItems.join(", ")}`,
          variant: "destructive",
        });
      }

      setShowCancelDialog(false);
    } catch (err) {
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat membatalkan disposisi",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleChange = (field: string, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Wrapper to also update follow_up_date when Surat Kontrol is created
  const handleSuratKontrolCreated = (skData: SuratKontrolResponse | null) => {
    setSuratKontrolResult(skData);
    if (skData?.tglRencanaKontrol) {
      setFormData(prev => ({ ...prev, follow_up_date: skData.tglRencanaKontrol }));
    }
  };

  const handleDispositionSelect = (type: string) => {
    setFormData(prev => ({ ...prev, disposition_type: type }));

    // Reset control types when opening new drawer
    if (["pulang", "aps"].includes(type)) {
      // Default to "none" for discharge
      setKontrolType("none");

    if (type === "aps") {
      setSuratKontrolResult(null);
      setFormData((prev) => ({
        ...prev,
        follow_up_date: "",
        follow_up_instruction: "",
        follow_up_room_id: undefined,
        follow_up_doctor_id: undefined,
      }));
    }
    } else if (type === "rawat_inap") {
      // Default to "simrs" for admission, but allow user to select BPJS if available
      setSpriType(patientNoBpjs && activeSEP ? "simrs" : "simrs");
    }

    // Open appropriate drawer
    switch (type) {
      case "pulang":
      case "aps":
        setDischargeDrawerOpen(true);
        break;
      case "rawat_inap":
        setAdmissionDrawerOpen(true);
        break;
      case "rawat_jalan":
        setOutpatientTransferDrawerOpen(true);
        break;
      case "rujuk":
        setReferralDrawerOpen(true);
        break;
      case "meninggal":
        setDeathDrawerOpen(true);
        break;
    }
  };

  const handleSubmit = async () => {
    if (useExternalData) {
      onSave?.(formData as any);
      setDischargeDrawerOpen(false);
      setAdmissionDrawerOpen(false);
      setReferralDrawerOpen(false);
      setDeathDrawerOpen(false);
      setOutpatientTransferDrawerOpen(false);
      return;
    }

    // Block all discharge options when pending orders exist
    if (pendingOrdersInfo?.has_pending_orders) {
      toast({
        title: "Tidak dapat memproses",
        description: "Masih ada order yang belum selesai. Selesaikan semua order terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate follow-up fields (only if using internal follow-up, not BPJS)
    const usingBPJSSuratKontrol = kontrolType === "bpjs" && !!suratKontrolResult;
    const usingBPJSSPRI = spriType === "bpjs" && !!spriResult;

    if (formData.disposition_type === "pulang" && kontrolType === "simrs") {
      if (!formData.follow_up_date || !formData.follow_up_room_id || !formData.follow_up_doctor_id) {
        toast({
          title: "Data tidak lengkap",
          description: "Untuk jadwal kontrol SIMRS, silakan pilih tanggal, poli, dan dokter.",
          variant: "destructive",
        });
        return;
      }

      if (roomClosed) {
        toast({
          title: "Poli tutup",
          description: "Poli tutup pada tanggal yang dipilih. Silakan pilih tanggal lain.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate BPJS Surat Kontrol
    if (formData.disposition_type === "pulang" && kontrolType === "bpjs" && !suratKontrolResult) {
      toast({
        title: "Data tidak lengkap",
        description: "Silakan buat Surat Kontrol BPJS terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    // Validate BPJS Surat Kontrol MUST have SIMRS sync (wajib)
    if (formData.disposition_type === "pulang" && kontrolType === "bpjs" && suratKontrolResult) {
      if (!formData.follow_up_room_id || !formData.follow_up_doctor_id) {
        toast({
          title: "Sinkronisasi SIMRS Wajib",
          description: "Surat Kontrol BPJS harus terhubung dengan jadwal kontrol SIMRS. Silakan pilih poli dan dokter SIMRS.",
          variant: "destructive",
        });
        return;
      }
      
      if (roomClosed) {
        toast({
          title: "Poli tutup",
          description: "Poli SIMRS tutup pada tanggal kontrol BPJS. Silakan pilih poli lain.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate BPJS SPRI
    if (formData.disposition_type === "rawat_inap" && spriType === "bpjs" && !spriResult) {
      toast({
        title: "Data tidak lengkap",
        description: "Silakan buat SPRI BPJS terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }


    // Validate outpatient transfer fields
    if (formData.disposition_type === "rawat_jalan") {
      if (!(formData as any).outpatient_room_id || !(formData as any).outpatient_doctor_id) {
        toast({
          title: "Data tidak lengkap",
          description: "Pilih poli dan dokter untuk rawat jalan.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate BPJS referral must be created before saving rujuk disposition
    if (formData.disposition_type === "rujuk") {
      const bpjsMode = formData.referral_mode && formData.referral_mode !== "manual";
      if (bpjsMode && !formData.referral_no_rujukan) {
        toast({
          title: "Rujukan BPJS belum dibuat",
          description: "Silakan buat rujukan BPJS terlebih dahulu di drawer rujuk.",
          variant: "destructive",
        });
        return;
      }

      if (formData.referral_mode === "bpjs_khusus" && !formData.referral_khusus_id) {
        toast({
          title: "Rujukan Khusus belum dibuat",
          description: "Silakan buat rujukan khusus BPJS terlebih dahulu.",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      // For rawat_inap SIMRS (without BPJS SPRI), create admission request
      if (formData.disposition_type === "rawat_inap" && spriType === "simrs") {
        const admissionResponse = await admissionRequestApi.create({
          source_visit_id: visitId,
          admission_type: formData.admission_type || "elektif",
          admission_reason: formData.admission_reason,
          priority: formData.admission_priority,
          preferred_class: formData.preferred_class,
          special_notes: formData.special_notes,
          suggested_bed_id: (formData as any).suggested_bed_id,
        });

        // Buat SPRI lokal (tanpa BPJS) agar masuk ke Monitoring SPRI
        // Nanti bisa di-edit dan dikirim ke BPJS dari monitoring
        try {
          await vclaimApi.createLocalSPRI({
            no_kartu: patientNoBpjs || activeSEP?.no_kartu || "",
            nama: patientData?.nama_lengkap || "",
            kelamin: patientData?.jenis_kelamin || "",
            tgl_lahir: patientData?.tanggal_lahir || "",
            kode_dokter: "",
            poli_kontrol: "",
            tgl_rencana_kontrol: new Date().toISOString().split("T")[0],
            nama_diagnosa: formData.admission_reason || "",
            visit_id: visitId,
            registration_id: registrationId || activeSEP?.registration_id || 0,
            sep_id: activeSEP?.id || 0,
          });
        } catch (localSpriErr) {
          console.warn("Gagal membuat SPRI lokal (non-blocking):", localSpriErr);
        }
        
        const payload = {
          ...formData,
          create_admission: false,
          create_follow_up: false,
        };
        
        await medicalRecordsApi.saveDisposition(visitId, payload);
        
        toast({
          title: "Berhasil",
          description: `Permintaan rawat inap berhasil dibuat (${admissionResponse.data.data.request_number}). Menunggu proses dari bagian pendaftaran.`,
        });
        
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
        
        // Close drawer
        setAdmissionDrawerOpen(false);
        setLoadedDispositionData(payload as any);
        onSave?.(payload as any);
        
        return;
      }
      
      // For rawat_inap with BPJS SPRI - also need to create admission request
      if (formData.disposition_type === "rawat_inap" && spriType === "bpjs" && usingBPJSSPRI) {
        // Create admission request first
        const admissionResponse = await admissionRequestApi.create({
          source_visit_id: visitId,
          admission_type: formData.admission_type || "elektif",
          admission_reason: formData.admission_reason,
          priority: formData.admission_priority,
          preferred_class: formData.preferred_class,
          special_notes: formData.special_notes ? `${formData.special_notes}\nSPRI: ${spriResult.noSPRI}` : `SPRI: ${spriResult.noSPRI}`,
          suggested_bed_id: (formData as any).suggested_bed_id,
        });
        
        const payload = {
          ...formData,
          create_admission: false,
          create_follow_up: false,
          bpjs_spri: {
            no_spri: spriResult.noSPRI,
            tgl_rencana_kontrol: spriResult.tglRencanaKontrol,
          },
        };
        
        await medicalRecordsApi.saveDisposition(visitId, payload);
        
        toast({
          title: "Berhasil",
          description: `Permintaan rawat inap berhasil dibuat (${admissionResponse.data.data.request_number}). SPRI: ${spriResult.noSPRI}`,
        });
        
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
        
        setAdmissionDrawerOpen(false);
        setLoadedDispositionData(payload as any);
        onSave?.(payload as any);
        
        return;
      }
      
      // For rawat_jalan (UGD → Rawat Jalan transfer)
      if (formData.disposition_type === "rawat_jalan" && (formData as any).outpatient_room_id) {
        const payload = {
          ...formData,
          outpatient_room_id: (formData as any).outpatient_room_id,
          outpatient_doctor_id: (formData as any).outpatient_doctor_id,
          transfer_reason: (formData as any).transfer_reason || "",
          create_admission: false,
          create_follow_up: false,
        };

        await medicalRecordsApi.saveDisposition(visitId, payload);

        toast({
          title: "Berhasil",
          description: "Pasien berhasil dirujuk ke rawat jalan. Antrian poli telah dibuat.",
        });

        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));

        setOutpatientTransferDrawerOpen(false);
        setLoadedDispositionData(payload as any);
        onSave?.(payload as any);

        return;
      }

      // For other disposition types
      // Create follow-up for SIMRS or BPJS with SIMRS sync
      const shouldCreateFollowUp = formData.disposition_type === "pulang" &&
        (kontrolType === "simrs" || (kontrolType === "bpjs" && usingBPJSSuratKontrol)) &&
        !!formData.follow_up_date &&
        !!formData.follow_up_room_id &&
        !!formData.follow_up_doctor_id;
        
      const payload = {
        ...formData,
        create_admission: false,
        create_follow_up: shouldCreateFollowUp,
        bpjs_surat_kontrol: usingBPJSSuratKontrol ? {
          no_surat_kontrol: suratKontrolResult.noSuratKontrol,
          tanggal_kontrol: suratKontrolResult.tglRencanaKontrol,
          dokter_tujuan: suratKontrolResult.namaDokter,
        } : undefined,
      };
      
      const response = await medicalRecordsApi.saveDisposition(visitId, payload);
      
      let successMessage = "Disposisi berhasil disimpan";
      
      // Handle success message and QR data for both BPJS and SIMRS
      if (response.data.follow_up_registration_id) {
        if (usingBPJSSuratKontrol) {
          successMessage += `. Surat Kontrol BPJS: ${suratKontrolResult.noSuratKontrol}. Jadwal kontrol SIMRS telah dibuat.`;
        } else {
          successMessage += ". Jadwal kontrol telah dibuat dengan nomor antrian.";
        }
        
        try {
          const regResponse = await registrationApi.getById(response.data.follow_up_registration_id);
          if (regResponse.data.data) {
            const reg = regResponse.data.data;
            setFollowUpRegData({
              id: reg.id || reg.ID || response.data.follow_up_registration_id,
              registration_number: reg.registration_number,
              scheduled_date: formData.follow_up_date || suratKontrolResult?.tglRencanaKontrol,
              room_name: reg.destination_room?.name || poliRooms.find(r => r.id === formData.follow_up_room_id)?.name,
              doctor_name: reg.doctor?.nama_lengkap || reg.doctor?.name || availableDoctors.find(d => d.employee_id === formData.follow_up_doctor_id)?.employee_name,
              queue_number: reg.visit?.room_queue?.queue_number,
              patient_name: reg.patient?.nama_lengkap || reg.patient?.name,
            });
          }
        } catch (err) {
          console.error("Failed to load follow-up registration for QR:", err);
        }
      }
      
      toast({
        title: "Berhasil",
        description: successMessage,
      });
      
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      
      // Close all drawers
      setDischargeDrawerOpen(false);
      setReferralDrawerOpen(false);
      setDeathDrawerOpen(false);
      setOutpatientTransferDrawerOpen(false);
      
      setLoadedDispositionData(response.data);
      onSave?.(response.data);
      
    } catch (err) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Gagal menyimpan disposisi";
      toast({
        title: "Gagal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pengaturan Disposisi
            </div>

            <div className="p-4">
              {/* Pending Orders Warning */}
              {!useExternalData && pendingOrdersInfo?.has_pending_orders && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Perhatian: Ada Order yang Belum Selesai</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {pendingOrdersInfo.pending_medicine_orders > 0 && (
                        <li>{pendingOrdersInfo.pending_medicine_orders} order obat belum diserahkan</li>
                      )}
                      {pendingOrdersInfo.pending_procedure_orders > 0 && (
                        <li>{pendingOrdersInfo.pending_procedure_orders} order tindakan belum selesai</li>
                      )}
                      {pendingOrdersInfo.pending_pharmacy_visits > 0 && (
                        <li>{pendingOrdersInfo.pending_pharmacy_visits} kunjungan farmasi belum selesai</li>
                      )}
                    </ul>
                    <p className="mt-2 text-sm">
                      Pasien tidak dapat dipulangkan sampai semua order diselesaikan atau dibatalkan.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Alert when form is already saved */}
              {!useExternalData && isDisabled && (
                <Alert className="mb-4 bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700">Pasien Sudah Dipulangkan</AlertTitle>
                  <AlertDescription className="text-green-600">
                    <div className="mt-2 p-3 bg-white rounded-lg border space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Status Disposisi</span>
                          <p className="font-medium">{dispositionOptions.find(o => o.value === formData.disposition_type)?.label || formData.disposition_type || "-"}</p>
                        </div>
                        {formData.discharge_condition && (
                          <div>
                            <span className="text-xs text-muted-foreground">Kondisi Pulang</span>
                            <p className="font-medium">{formData.discharge_condition}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Surat Kontrol BPJS */}
                      {suratKontrolResult && (
                        <div className="pt-2 border-t flex justify-between items-center">
                          <div>
                            <span className="text-xs text-muted-foreground">Surat Kontrol BPJS</span>
                            <p className="font-medium">{suratKontrolResult.noSuratKontrol}</p>
                            <p className="text-xs text-muted-foreground">
                              Tanggal Kontrol: {suratKontrolResult.tglRencanaKontrol}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {suratKontrolResult.id && (
                              <>
                                <Button size="sm" variant="outline" className="h-8 text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100" onClick={() => {
                                  setSignDoc({ id: suratKontrolResult.id!, type: "surat_kontrol", title: suratKontrolResult.noSuratKontrol });
                                  setShowSignDialog(true);
                                }} title="Tanda Tangan">
                                  <PenTool className="h-3.5 w-3.5 mr-1" />
                                  TTD
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100" onClick={() => printApi.suratKontrol(suratKontrolResult.id!)} title="Cetak Surat Kontrol">
                                  <Printer className="h-3.5 w-3.5 mr-1" />
                                  Cetak
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* SPRI */}
                      {spriResult && (
                        <div className="pt-2 border-t flex justify-between items-center">
                          <div>
                            <span className="text-xs text-muted-foreground">SPRI (Surat Perintah Rawat Inap)</span>
                            <p className="font-medium">{spriResult.noSPRI}</p>
                            <p className="text-xs text-muted-foreground">
                              Tanggal Rencana: {spriResult.tglRencanaKontrol}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {spriResult.id && (
                              <>
                                <Button size="sm" variant="outline" className="h-8 text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100" onClick={() => {
                                  setSignDoc({ id: spriResult.id!, type: "spri", title: spriResult.noSPRI });
                                  setShowSignDialog(true);
                                }} title="Tanda Tangan">
                                  <PenTool className="h-3.5 w-3.5 mr-1" />
                                  TTD
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100" onClick={() => printApi.spri(spriResult.id!)} title="Cetak SPRI">
                                  <Printer className="h-3.5 w-3.5 mr-1" />
                                  Cetak
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Jadwal Kontrol SIMRS */}
                      {(loadedDispositionData?.follow_up_registration_id || initialData?.follow_up_registration_id) && (
                        <div className="pt-2 border-t flex justify-between items-center">
                          <div>
                            <span className="text-xs text-muted-foreground">Jadwal Kontrol SIMRS</span>
                            <p className="font-medium text-green-700">✓ Sudah dibuat</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-8 text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100" onClick={() => {
                              const regId = loadedDispositionData?.follow_up_registration_id || initialData?.follow_up_registration_id;
                              if (regId) {
                                setSignDoc({ id: regId, type: "surat_kontrol", title: "Kontrol SIMRS" });
                                setShowSignDialog(true);
                              }
                            }} title="Tanda Tangan">
                              <PenTool className="h-3.5 w-3.5 mr-1" />
                              TTD
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100" onClick={() => {
                              const regId = loadedDispositionData?.follow_up_registration_id || initialData?.follow_up_registration_id;
                              if (regId) printApi.suratKontrolSimrs(regId);
                            }} title="Cetak Kontrol SIMRS">
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Cetak
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Catatan Disposisi */}
                      {formData.disposition_note && (
                        <div className="pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Catatan</span>
                          <p className="text-sm">{formData.disposition_note}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Cancel Button - ALWAYS show, not dependent on readOnly */}
                    {!useExternalData && (
                      <div className="mt-4 pt-3 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCancelDialog(true)}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Batalkan Disposisi
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Membatalkan disposisi akan menghapus Surat Kontrol, SPRI, jadwal kontrol, dan mengaktifkan kembali kunjungan ini.
                      </p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Disposition Type Selection */}
              {!isDisabled && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Pilih Status Pemulangan</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {dispositionOptions.map((option) => {
                      const isBlockedByPending = pendingOrdersInfo?.has_pending_orders;
                      
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleDispositionSelect(option.value)}
                          disabled={isDisabled || isBlockedByPending || readOnly}
                          className={cn(
                            "p-4 rounded-lg border-2 text-left transition-all flex flex-col gap-2 group",
                            formData.disposition_type === option.value
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : isDisabled || isBlockedByPending
                              ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                              : "border-muted hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "flex items-center justify-between",
                            formData.disposition_type === option.value ? "text-primary" : "text-muted-foreground"
                          )}>
                            <div className="flex items-center gap-2">
                              {option.icon}
                              <span className="font-semibold text-sm">{option.label}</span>
                            </div>
                            <ArrowRight className={cn(
                              "h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity",
                              formData.disposition_type === option.value && "opacity-100"
                            )} />
                          </div>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discharge Drawer (Pulang / APS) */}
      <DischargeDrawer
        open={dischargeDrawerOpen}
        onOpenChange={setDischargeDrawerOpen}
        formData={formData}
        onFormChange={handleChange}
        onSubmit={handleSubmit}
        saving={saving}
        isDisabled={isDisabled || readOnly}
        isInpatient={pendingOrdersInfo?.is_inpatient || false}
        poliRooms={poliRooms}
        availableDoctors={availableDoctors}
        loadingDoctors={loadingDoctors}
        roomClosed={roomClosed}
        followUpRegData={followUpRegData}
        patientNoBpjs={patientNoBpjs}
        activeSEP={activeSEP}
        patientData={patientData}
        visitId={visitId}
        suratKontrolResult={suratKontrolResult}
        setSuratKontrolResult={handleSuratKontrolCreated}
        dischargeConditionOptions={dischargeConditionOptions}
        kontrolType={kontrolType}
        setKontrolType={setKontrolType}
      />

      {/* Admission Drawer (Rawat Inap) */}
      <AdmissionDrawer
        open={admissionDrawerOpen}
        onOpenChange={setAdmissionDrawerOpen}
        formData={formData}
        onFormChange={handleChange}
        onSubmit={handleSubmit}
        saving={saving}
        isDisabled={isDisabled || readOnly}
        patientNoBpjs={patientNoBpjs}
        activeSEP={activeSEP}
        patientData={patientData}
        visitId={visitId}
        spriResult={spriResult}
        setSpriResult={setSpriResult}
        inpatientClassOptions={inpatientClassOptions}
        spriType={spriType}
        setSpriType={setSpriType}
      />

      {/* Referral Drawer (Rujuk) */}
      <ReferralDrawer
        open={referralDrawerOpen}
        onOpenChange={setReferralDrawerOpen}
        formData={formData}
        onFormChange={handleChange}
        onSubmit={handleSubmit}
        saving={saving}
        isDisabled={isDisabled || readOnly}
        visitId={visitId}
        registrationId={registrationId || undefined}
        activeSEP={activeSEP}
        patientData={patientData}
      />

      {/* Death Drawer (Meninggal) */}
      <DeathDrawer
        open={deathDrawerOpen}
        onOpenChange={setDeathDrawerOpen}
        formData={formData}
        onFormChange={handleChange}
        onSubmit={handleSubmit}
        saving={saving}
        isDisabled={isDisabled || readOnly}
      />

      {/* Outpatient Transfer Drawer (UGD → Rawat Jalan) */}
      <OutpatientTransferDrawer
        open={outpatientTransferDrawerOpen}
        onOpenChange={setOutpatientTransferDrawerOpen}
        formData={formData}
        onFormChange={handleChange}
        onSubmit={handleSubmit}
        saving={saving}
        isDisabled={isDisabled || readOnly}
        poliRooms={poliRooms}
        availableDoctors={outpatientDoctors}
        loadingDoctors={loadingOutpatientDoctors}
      />

      {/* Cancel Disposition Dialog */}
      {!useExternalData && (
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Batalkan Disposisi
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan disposisi pasien ini?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan</AlertTitle>
              <AlertDescription>
                Tindakan ini akan:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {suratKontrolResult && (
                    <li>Menghapus Surat Kontrol BPJS: <strong>{suratKontrolResult.noSuratKontrol}</strong></li>
                  )}
                  {spriResult && (
                    <li>Membatalkan SPRI: <strong>{spriResult.noSPRI}</strong> (catatan lokal)</li>
                  )}
                  {(loadedDispositionData?.follow_up_registration_id || initialData?.follow_up_registration_id) && (
                    <li>Menghapus jadwal kontrol SIMRS</li>
                  )}
                  {(loadedDispositionData?.disposition_type || formData.disposition_type) === "rawat_inap" && (
                    <li>Membatalkan permintaan rawat inap (jika masih pending)</li>
                  )}
                  {(loadedDispositionData?.disposition_type || formData.disposition_type) === "rawat_jalan" && (
                    <li>Membatalkan kunjungan rawat jalan dan antrian poli</li>
                  )}
                  <li>Mengaktifkan kembali kunjungan pasien</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <p className="text-sm text-muted-foreground">
              <strong>Catatan:</strong> SPRI yang sudah terbit di BPJS tidak dapat dihapus melalui VClaim. 
              Hanya status lokal yang akan diubah menjadi "cancelled".
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={canceling}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelDisposition}
              disabled={canceling}
              className="gap-2"
            >
              {canceling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membatalkan...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Ya, Batalkan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Tanda Tangan Modal */}
      {signDoc && (
        <SignOnBehalfDialog
          open={showSignDialog}
          onOpenChange={(isOpen) => {
            setShowSignDialog(isOpen);
          }}
          documentType={signDoc.type}
          documentId={signDoc.id}
          documentTitle={signDoc.title}
          signerHint={`Tanda Tangan ${signDoc.title}`}
          requiredSignatures={2}
          slotLabels={{ left: "Pasien / Keluarga", right: "Mengetahui DPJP" }}
          fixedRoles={{ left: "pasien", right: "dpjp" }}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
