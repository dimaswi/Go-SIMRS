import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  LogOut, 
  Loader2, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Home,
  Ambulance,
  Hospital,
  FileText,
  ClipboardList,
  ExternalLink,
  Send,
  QrCode
} from "lucide-react";
import { useMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi, type Disposition } from "@/lib/api/medical-records";
import { roomsApi, schedulesApi, type Room } from "@/lib/api/rooms";
import { admissionRequestApi } from "@/lib/api/admission-request";
import { useToast } from "@/hooks/use-toast";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { CheckInQRCode } from "@/components/qrcode/checkin-qrcode";

interface DispositionFormProps {
  visitId: number;
  initialData?: Disposition;
  onSave?: (data: Disposition) => void;
  isEmergency?: boolean;
  readOnly?: boolean;
}

// Icon mapping for disposition types
const dispositionIcons: Record<string, React.ReactNode> = {
  pulang: <Home className="h-5 w-5" />,
  rawat_inap: <Hospital className="h-5 w-5" />,
  rujuk: <Ambulance className="h-5 w-5" />,
  meninggal: <FileText className="h-5 w-5" />,
  aps: <ExternalLink className="h-5 w-5" />,
  dod: <FileText className="h-5 w-5" />,
};

// Description mapping for disposition options
const dispositionDescriptions: Record<string, string> = {
  pulang: "Pasien pulang dalam keadaan baik",
  rawat_inap: "Pasien memerlukan rawat inap",
  rujuk: "Pasien dirujuk ke fasilitas lain",
  meninggal: "Pasien meninggal dunia",
  aps: "Pasien pulang atas permintaan sendiri",
  dod: "Meninggal saat tiba di IGD",
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

export function DispositionForm({ visitId, initialData, onSave, isEmergency: _isEmergency = false, readOnly = false }: DispositionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingOrdersInfo, setPendingOrdersInfo] = useState<PendingOrdersInfo | null>(null);
  
  // Rooms for follow-up (poli)
  const [poliRooms, setPoliRooms] = useState<Room[]>([]);
  
  // Available doctors based on selected room and date
  const [availableDoctors, setAvailableDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  
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
  
  // Check if form is disabled (already saved)
  const isDisabled = !!initialData?.disposition_type;
  
  // Checkbox states for follow-up options
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  
  // Fetch disposition options from master data
  const { data: dispositionData } = useMasterData('disposition_type');
  const { data: dischargeConditionData } = useMasterData('discharge_condition');
  
  // Inpatient class options for preferred class
  const { data: inpatientClassData } = useMasterData('inpatient_class');
  
  const dispositionOptions = dispositionData
    // Filter out "rawat_inap" option if patient is already inpatient
    .filter(item => !(item.code === 'rawat_inap' && pendingOrdersInfo?.is_inpatient))
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

  const [formData, setFormData] = useState({
    disposition_type: initialData?.disposition_type || "",
    disposition_note: initialData?.disposition_note || "",
    discharge_status: initialData?.discharge_status || "",
    discharge_condition: initialData?.discharge_condition || "",
    referral_facility: initialData?.referral_facility || "",
    referral_reason: initialData?.referral_reason || "",
    referral_urgency: initialData?.referral_urgency || "",
    // Admission request fields (simplified - no room/bed/doctor selection)
    admission_type: initialData?.admission_type || "",
    admission_reason: initialData?.admission_reason || "",
    admission_priority: "normal" as string,
    preferred_class: "" as string,
    special_notes: "" as string,
    death_time: initialData?.death_time || "",
    death_cause: initialData?.death_cause || "",
    follow_up_date: initialData?.follow_up_date || "",
    follow_up_instruction: initialData?.follow_up_instruction || "",
    follow_up_room_id: initialData?.follow_up_room_id || undefined as number | undefined,
    follow_up_doctor_id: undefined as number | undefined, // Doctor for follow-up
    discharge_medication: initialData?.discharge_medication || "",
    discharge_instruction: initialData?.discharge_instruction || "",
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
      
      // Reset doctor selection if current doctor is not available
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

  // Load rooms for poli (follow-up only)
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
    const loadData = async () => {
      if (!visitId) return;
      setLoading(true);
      try {
        const response = await medicalRecordsApi.getDisposition(visitId);
        if (response.data) {
          setFormData({
            disposition_type: response.data.disposition_type || "",
            disposition_note: response.data.disposition_note || "",
            discharge_status: response.data.discharge_status || "",
            discharge_condition: response.data.discharge_condition || "",
            referral_facility: response.data.referral_facility || "",
            referral_reason: response.data.referral_reason || "",
            referral_urgency: response.data.referral_urgency || "",
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
            follow_up_doctor_id: undefined, // Will be loaded from available doctors
            discharge_medication: response.data.discharge_medication || "",
            discharge_instruction: response.data.discharge_instruction || "",
          });
          
          if (response.data.follow_up_date && response.data.follow_up_room_id) {
            setWantsFollowUp(true);
          }
          
          // Load follow-up registration data for QR code if available
          if (response.data.follow_up_registration_id) {
            try {
              const { registrationApi } = await import("@/lib/api/queue");
              const regResponse = await registrationApi.getById(response.data.follow_up_registration_id);
              if (regResponse.data.data) {
                const reg = regResponse.data.data;
                setFollowUpRegData({
                  id: reg.id || reg.ID || response.data.follow_up_registration_id,
                  registration_number: reg.registration_number,
                  scheduled_date: response.data.follow_up_date,
                  room_name: response.data.follow_up_room?.name || reg.destination_room?.name,
                  doctor_name: reg.doctor?.nama_lengkap || reg.doctor?.name,
                  queue_number: reg.visit?.room_queue?.queue_number,
                  patient_name: reg.patient?.nama_lengkap || reg.patient?.name,
                });
              }
            } catch (err) {
              console.error("Failed to load follow-up registration:", err);
            }
          }
        }
        
        const pendingResponse = await medicalRecordsApi.checkPendingOrders(visitId);
        setPendingOrdersInfo(pendingResponse.data);
        await loadRooms();
      } catch {
        await loadRooms();
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [visitId]);
  
  // Load available doctors when room and date change
  useEffect(() => {
    if (formData.follow_up_room_id && formData.follow_up_date && wantsFollowUp) {
      loadAvailableDoctors(formData.follow_up_room_id, formData.follow_up_date);
    } else {
      setAvailableDoctors([]);
      setRoomClosed(false);
    }
  }, [formData.follow_up_room_id, formData.follow_up_date, wantsFollowUp]);
  
  // Reset follow-up when disposition type changes
  useEffect(() => {
    if (!["pulang", "aps"].includes(formData.disposition_type)) {
      setWantsFollowUp(false);
    }
  }, [formData.disposition_type]);

  const handleChange = (field: string, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.disposition_type === "pulang" && pendingOrdersInfo?.has_pending_orders) {
      toast({
        title: "Tidak dapat memulangkan",
        description: "Masih ada order yang belum selesai. Selesaikan semua order terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate follow-up fields including doctor
    if (["pulang", "aps"].includes(formData.disposition_type) && wantsFollowUp) {
      if (!formData.follow_up_date || !formData.follow_up_room_id || !formData.follow_up_doctor_id) {
        toast({
          title: "Data tidak lengkap",
          description: "Untuk jadwal kontrol, silakan pilih tanggal, poli, dan dokter.",
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
    
    setSaving(true);
    try {
      // For rawat_inap, create admission request instead of direct admission
      if (formData.disposition_type === "rawat_inap") {
        // Create admission request
        const admissionResponse = await admissionRequestApi.create({
          source_visit_id: visitId,
          admission_type: formData.admission_type,
          admission_reason: formData.admission_reason,
          priority: formData.admission_priority,
          preferred_class: formData.preferred_class,
          special_notes: formData.special_notes,
        });
        
        // Also save disposition (without creating visit)
        const payload = {
          ...formData,
          create_admission: false, // Don't create visit directly
          create_follow_up: false,
        };
        
        await medicalRecordsApi.saveDisposition(visitId, payload);
        
        toast({
          title: "Berhasil",
          description: `Permintaan rawat inap berhasil dibuat (${admissionResponse.data.data.request_number}). Menunggu proses dari bagian pendaftaran.`,
        });
        onSave?.(payload as any);
        return;
      }
      
      // For other disposition types, use existing logic
      const shouldCreateFollowUp = ["pulang", "aps"].includes(formData.disposition_type) && 
        wantsFollowUp && 
        !!formData.follow_up_date && 
        !!formData.follow_up_room_id && 
        !!formData.follow_up_doctor_id;
        
      const payload = {
        ...formData,
        create_admission: false,
        create_follow_up: shouldCreateFollowUp,
      };
      
      const response = await medicalRecordsApi.saveDisposition(visitId, payload);
      
      let successMessage = "Disposisi berhasil disimpan";
      if (response.data.follow_up_registration_id) {
        successMessage += ". Jadwal kontrol telah dibuat dengan nomor antrian yang sudah dipesan.";
        
        // Set follow-up registration data for QR code display
        try {
          const { registrationApi } = await import("@/lib/api/queue");
          const regResponse = await registrationApi.getById(response.data.follow_up_registration_id);
          if (regResponse.data.data) {
            const reg = regResponse.data.data;
            setFollowUpRegData({
              id: reg.id || reg.ID || response.data.follow_up_registration_id,
              registration_number: reg.registration_number,
              scheduled_date: formData.follow_up_date,
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

  // Show conditions
  const showDischargeForm = ["pulang", "aps"].includes(formData.disposition_type);
  const showAdmissionFields = formData.disposition_type === "rawat_inap";
  const showDeathFields = ["meninggal", "dod"].includes(formData.disposition_type);
  const showFollowUpFields = showDischargeForm && wantsFollowUp;
  const showDischargeCondition = showDischargeForm && !wantsFollowUp;

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Pasien Pulang / Disposisi
        </CardTitle>
        <CardDescription>
          Keputusan akhir terkait pemulangan, rawat inap, rujukan, atau tindakan lanjutan
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
            {/* Pending Orders Warning */}
            {pendingOrdersInfo?.has_pending_orders && (
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
            {isDisabled && (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700">Pasien Sudah Dipulangkan</AlertTitle>
                <AlertDescription className="text-green-600">
                  Data disposisi tidak dapat diubah karena sudah disimpan sebelumnya.
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset disabled={readOnly}>
                {/* Step 1: Select Disposition Type */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                    <Label className="text-sm font-semibold">Pilih Status Pemulangan</Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {dispositionOptions.map((option) => {
                      const isBlockedPulang = option.value === "pulang" && pendingOrdersInfo?.has_pending_orders;
                      
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleChange("disposition_type", option.value)}
                          disabled={isDisabled || isBlockedPulang}
                          className={cn(
                            "p-4 rounded-lg border-2 text-left transition-all flex flex-col gap-2",
                            formData.disposition_type === option.value
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : isDisabled || isBlockedPulang
                              ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                              : "border-muted hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "flex items-center gap-2",
                            formData.disposition_type === option.value ? "text-primary" : "text-muted-foreground"
                          )}>
                            {option.icon}
                            <span className="font-semibold text-sm">{option.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Form based on selection */}
                {formData.disposition_type && (
                  <>
                    <Separator className="my-6" />
                    
                    {/* PULANG / APS Form */}
                    {showDischargeForm && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                          <Label className="text-sm font-semibold">Rencana Tindak Lanjut</Label>
                        </div>
                        
                        {/* Checkbox Options - Only for Inpatient */}
                        {pendingOrdersInfo?.is_inpatient ? (
                          <label 
                            htmlFor="wants_follow_up"
                            className={cn(
                              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                              wantsFollowUp 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-primary/50",
                              isDisabled && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <Checkbox 
                              id="wants_follow_up"
                              checked={wantsFollowUp} 
                              onCheckedChange={(checked) => {
                                setWantsFollowUp(checked === true);
                              }}
                              disabled={isDisabled}
                              className="mt-0.5"
                            />
                            <div className="space-y-1">
                              <span className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Jadwalkan Kontrol
                              </span>
                              <p className="text-xs text-muted-foreground">
                                Buat jadwal kunjungan ulang untuk pasien
                              </p>
                            </div>
                          </label>
                        ) : (
                          <Alert className="bg-blue-50 border-blue-200">
                            <AlertTriangle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                              Tidak ada opsi tindak lanjut. Untuk rujukan, silakan pilih "Rujuk" di langkah 1.
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* Follow Up Form */}
                        {showFollowUpFields && (
                          <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                              <Calendar className="h-4 w-4" />
                              <span className="font-semibold text-sm">Jadwal Kontrol</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="follow_up_date" className="text-sm">Tanggal Kontrol <span className="text-destructive">*</span></Label>
                                <Input
                                  id="follow_up_date"
                                  type="date"
                                  value={formData.follow_up_date}
                                  onChange={(e) => handleChange("follow_up_date", e.target.value)}
                                  className="h-10 bg-background"
                                  min={new Date().toISOString().split('T')[0]}
                                  disabled={isDisabled}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="follow_up_room_id" className="text-sm">Poli Tujuan <span className="text-destructive">*</span></Label>
                                <Combobox
                                  options={poliRooms.map(r => ({ value: r.id.toString(), label: r.name }))}
                                  value={formData.follow_up_room_id?.toString() || ""}
                                  onValueChange={(value) => {
                                    handleChange("follow_up_room_id", value ? parseInt(value) : undefined);
                                    // Reset doctor when room changes
                                    handleChange("follow_up_doctor_id", undefined);
                                  }}
                                  placeholder="Pilih poli..."
                                  searchPlaceholder="Cari poli..."
                                  emptyText="Poli tidak ditemukan"
                                  disabled={isDisabled}
                                />
                              </div>
                              
                              {/* Doctor Selection - based on schedule */}
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="follow_up_doctor_id" className="text-sm">Dokter <span className="text-destructive">*</span></Label>
                                {loadingDoctors ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Memuat jadwal dokter...</span>
                                  </div>
                                ) : roomClosed ? (
                                  <Alert variant="destructive" className="bg-red-50">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                      Poli tutup pada tanggal ini. Silakan pilih tanggal lain.
                                    </AlertDescription>
                                  </Alert>
                                ) : availableDoctors.length === 0 && formData.follow_up_room_id && formData.follow_up_date ? (
                                  <Alert className="bg-amber-50 border-amber-200">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-700">
                                      Tidak ada dokter yang praktik pada tanggal ini. Silakan pilih tanggal lain atau hubungi administrasi.
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {availableDoctors.map((doctor) => (
                                      <button
                                        key={doctor.employee_id}
                                        type="button"
                                        onClick={() => handleChange("follow_up_doctor_id", doctor.employee_id)}
                                        disabled={isDisabled}
                                        className={cn(
                                          "p-3 rounded-lg border-2 text-left transition-all",
                                          formData.follow_up_doctor_id === doctor.employee_id
                                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                            : isDisabled
                                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                        )}
                                      >
                                        <div className="font-medium text-sm">{doctor.employee_name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Jam praktik: {doctor.start_time} - {doctor.end_time}
                                        </div>
                                        {doctor.max_patients > 0 && (
                                          <div className="text-xs text-muted-foreground">
                                            Maks. {doctor.max_patients} pasien
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {!formData.follow_up_room_id || !formData.follow_up_date ? (
                                  <p className="text-xs text-muted-foreground">
                                    Pilih poli dan tanggal terlebih dahulu untuk melihat dokter yang tersedia.
                                  </p>
                                ) : null}
                              </div>
                              
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="follow_up_instruction" className="text-sm">Instruksi Kontrol</Label>
                                <Textarea
                                  id="follow_up_instruction"
                                  placeholder="Rencana pemeriksaan/tindakan saat kontrol..."
                                  value={formData.follow_up_instruction}
                                  onChange={(e) => handleChange("follow_up_instruction", e.target.value)}
                                  className="min-h-[80px] resize-none bg-background"
                                  disabled={isDisabled}
                                />
                              </div>
                            </div>
                            {formData.follow_up_date && formData.follow_up_room_id && formData.follow_up_doctor_id && !roomClosed && (
                              <Alert className="bg-green-100 border-green-300">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                  Jadwal kontrol akan dibuat untuk tanggal <strong>{formData.follow_up_date}</strong> di{' '}
                                  <strong>{poliRooms.find(r => r.id === formData.follow_up_room_id)?.name || 'poli terpilih'}</strong> dengan{' '}
                                  <strong>{availableDoctors.find(d => d.employee_id === formData.follow_up_doctor_id)?.employee_name || 'dokter terpilih'}</strong>.
                                  Nomor antrian akan langsung diberikan saat ini.
                                </AlertDescription>
                              </Alert>
                            )}
                            
                            {/* Show QR Code if follow-up registration already created */}
                            {followUpRegData && (
                              <Alert className="bg-blue-50 border-blue-300">
                                <QrCode className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-700">Jadwal Kontrol Terdaftar</AlertTitle>
                                <AlertDescription className="text-blue-700">
                                  <div className="flex items-start gap-4 mt-2">
                                    {/* Info */}
                                    <div className="space-y-1 flex-1">
                                      <p>No. Registrasi: <strong>{followUpRegData.registration_number}</strong></p>
                                      {followUpRegData.scheduled_date && (
                                        <p>Tanggal: <strong>{new Date(followUpRegData.scheduled_date).toLocaleDateString("id-ID", {
                                          weekday: "long",
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                        })}</strong></p>
                                      )}
                                      {followUpRegData.room_name && <p>Poli: <strong>{followUpRegData.room_name}</strong></p>}
                                      {followUpRegData.doctor_name && <p>Dokter: <strong>{followUpRegData.doctor_name}</strong></p>}
                                    </div>
                                    {/* QR Code - clickable */}
                                    <div className="flex-shrink-0">
                                      <CheckInQRCode
                                        registrationId={followUpRegData.id}
                                        registrationNumber={followUpRegData.registration_number}
                                        patientName={followUpRegData.patient_name || "Pasien"}
                                        scheduledDate={followUpRegData.scheduled_date}
                                        roomName={followUpRegData.room_name}
                                        doctorName={followUpRegData.doctor_name}
                                        queueNumber={followUpRegData.queue_number}
                                      />
                                      <p className="text-xs text-blue-500 mt-1 text-center">Klik untuk cetak</p>
                                    </div>
                                  </div>
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )}
                        
                        {/* Discharge Condition (only if no follow-up) */}
                        {showDischargeCondition && (
                          <div className="space-y-2">
                            <Label htmlFor="discharge_condition" className="text-sm font-semibold">
                              Kondisi Keluar
                            </Label>
                            <Combobox
                              options={dischargeConditionOptions}
                              value={formData.discharge_condition}
                              onValueChange={(value) => handleChange("discharge_condition", value)}
                              placeholder="Pilih kondisi keluar..."
                              searchPlaceholder="Cari kondisi..."
                              emptyText="Kondisi tidak ditemukan"
                              disabled={isDisabled}
                            />
                          </div>
                        )}
                        
                        <Separator />
                        
                        {/* Discharge Instructions */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            <Label className="text-sm font-semibold">Instruksi Pemulangan</Label>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="discharge_instruction" className="text-sm">
                              Instruksi untuk Pasien
                            </Label>
                            <Textarea
                              id="discharge_instruction"
                              placeholder="Instruksi yang harus diikuti pasien setelah pulang (diet, aktivitas, minum obat, dll)..."
                              value={formData.discharge_instruction}
                              onChange={(e) => handleChange("discharge_instruction", e.target.value)}
                              className="min-h-[100px] resize-none"
                              disabled={isDisabled}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="discharge_medication" className="text-sm">
                              Obat Pulang
                            </Label>
                            <Textarea
                              id="discharge_medication"
                              placeholder="Daftar obat yang dibawa pulang beserta aturan pakai..."
                              value={formData.discharge_medication}
                              onChange={(e) => handleChange("discharge_medication", e.target.value)}
                              className="min-h-[80px] resize-none"
                              disabled={isDisabled}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RAWAT INAP Form - Request Admission */}
                    {showAdmissionFields && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                          <Label className="text-sm font-semibold">Permintaan Rawat Inap</Label>
                        </div>
                        
                        <Alert className="bg-blue-50 border-blue-200">
                          <Send className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            Permintaan rawat inap akan dikirim ke bagian <strong>Pendaftaran/Admisi</strong> untuk pemilihan kamar, bed, dan DPJP.
                          </AlertDescription>
                        </Alert>
                        
                        {/* Admission Type Selection */}
                        <div className="space-y-2">
                          <Label className="text-sm">Tipe Rawat Inap <span className="text-destructive">*</span></Label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: "elektif", label: "Elektif", desc: "Rawat inap terencana" },
                              { value: "emergency", label: "Emergency", desc: "Rawat inap darurat" },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleChange("admission_type", opt.value)}
                                disabled={isDisabled}
                                className={cn(
                                  "p-4 rounded-lg border-2 text-left transition-all",
                                  formData.admission_type === opt.value
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                    : isDisabled
                                    ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                    : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                )}
                              >
                                <div className="font-semibold text-sm">{opt.label}</div>
                                <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Priority Selection */}
                        <div className="space-y-2">
                          <Label className="text-sm">Prioritas <span className="text-destructive">*</span></Label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { value: "normal", label: "Normal", desc: "Prioritas standar", color: "text-green-600" },
                              { value: "urgent", label: "Urgent", desc: "Perlu segera", color: "text-orange-600" },
                              { value: "emergency", label: "Emergency", desc: "Sangat mendesak", color: "text-red-600" },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleChange("admission_priority", opt.value)}
                                disabled={isDisabled}
                                className={cn(
                                  "p-4 rounded-lg border-2 text-left transition-all",
                                  formData.admission_priority === opt.value
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                    : isDisabled
                                    ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                    : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                )}
                              >
                                <div className={cn("font-semibold text-sm", opt.color)}>{opt.label}</div>
                                <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Preferred Class */}
                        <div className="space-y-2">
                          <Label htmlFor="preferred_class" className="text-sm">Kelas Kamar yang Diinginkan</Label>
                          <Combobox
                            options={inpatientClassOptions}
                            value={formData.preferred_class || ""}
                            onValueChange={(value) => handleChange("preferred_class", value)}
                            placeholder="Pilih kelas kamar..."
                            searchPlaceholder="Cari kelas..."
                            emptyText="Tidak ada kelas"
                            disabled={isDisabled}
                          />
                          <p className="text-xs text-muted-foreground">
                            Opsional. Bagian admisi akan menyesuaikan dengan ketersediaan kamar.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="admission_reason" className="text-sm">
                            Alasan/Indikasi Rawat Inap <span className="text-destructive">*</span>
                          </Label>
                          <Textarea
                            id="admission_reason"
                            placeholder="Jelaskan alasan klinis pasien perlu dirawat inap..."
                            value={formData.admission_reason}
                            onChange={(e) => handleChange("admission_reason", e.target.value)}
                            className="min-h-[100px] resize-none"
                            disabled={isDisabled}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="special_notes" className="text-sm">Catatan Khusus</Label>
                          <Textarea
                            id="special_notes"
                            placeholder="Catatan khusus untuk bagian admisi (misal: perlu ruang isolasi, pasien bariatrik, dll)..."
                            value={formData.special_notes || ""}
                            onChange={(e) => handleChange("special_notes", e.target.value)}
                            className="min-h-[80px] resize-none"
                            disabled={isDisabled}
                          />
                        </div>
                      </div>
                    )}

                    {/* RUJUK Form (standalone) */}
                    {formData.disposition_type === "rujuk" && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                          <Label className="text-sm font-semibold">Informasi Rujukan</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="referral_facility_main" className="text-sm">
                              Fasilitas Tujuan Rujukan <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="referral_facility_main"
                              placeholder="Nama rumah sakit/fasilitas kesehatan tujuan"
                              value={formData.referral_facility}
                              onChange={(e) => handleChange("referral_facility", e.target.value)}
                              className="h-10"
                              required
                              disabled={isDisabled}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="referral_urgency_main" className="text-sm">
                              Urgensi Rujukan
                            </Label>
                            <Combobox
                              options={[
                                { value: "cito", label: "CITO" },
                                { value: "urgent", label: "Urgent" },
                                { value: "normal", label: "Normal" },
                              ]}
                              value={formData.referral_urgency}
                              onValueChange={(value) => handleChange("referral_urgency", value)}
                              placeholder="Pilih urgensi..."
                              searchPlaceholder="Cari..."
                              emptyText="Tidak ditemukan"
                              disabled={isDisabled}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="referral_reason_main" className="text-sm">
                              Alasan Rujukan <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                              id="referral_reason_main"
                              placeholder="Alasan pasien dirujuk ke fasilitas lain..."
                              value={formData.referral_reason}
                              onChange={(e) => handleChange("referral_reason", e.target.value)}
                              className="min-h-[80px] resize-none"
                              required
                              disabled={isDisabled}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MENINGGAL / DOD Form */}
                    {showDeathFields && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                          <Label className="text-sm font-semibold">Informasi Kematian</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="death_time" className="text-sm">
                              Waktu Kematian
                            </Label>
                            <Input
                              id="death_time"
                              type="datetime-local"
                              value={formData.death_time}
                              onChange={(e) => handleChange("death_time", e.target.value)}
                              className="h-10"
                              disabled={isDisabled}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="death_cause" className="text-sm">
                              Penyebab Kematian
                            </Label>
                            <Textarea
                              id="death_cause"
                              placeholder="Penyebab kematian pasien..."
                              value={formData.death_cause}
                              onChange={(e) => handleChange("death_cause", e.target.value)}
                              className="min-h-[80px] resize-none"
                              disabled={isDisabled}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Submit Button */}
                {!isDisabled && formData.disposition_type && (
                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="submit" size="lg" className="gap-2" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Simpan & Pulangkan Pasien
                    </Button>
                  </div>
                )}
              </fieldset>
            </form>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
