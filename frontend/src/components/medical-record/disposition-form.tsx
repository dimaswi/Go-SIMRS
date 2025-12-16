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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Save, 
  LogOut, 
  Loader2, 
  AlertTriangle, 
  Building, 
  Bed, 
  Calendar, 
  CheckCircle2, 
  Check, 
  UserRound,
  Home,
  Ambulance,
  Hospital,
  FileText,
  ClipboardList,
  ExternalLink
} from "lucide-react";
import { useMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi, type Disposition } from "@/lib/api/medical-records";
import { roomsApi, type Room, type Bed as BedType, type RoomUnit, type RoomStaff } from "@/lib/api/rooms";
import { type Employee } from "@/lib/api/employees";
import { useToast } from "@/hooks/use-toast";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

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

export function DispositionForm({ visitId, initialData, onSave, isEmergency: _isEmergency = false, readOnly = false }: DispositionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingOrdersInfo, setPendingOrdersInfo] = useState<PendingOrdersInfo | null>(null);
  
  // Rooms and beds for rawat inap
  const [inpatientRooms, setInpatientRooms] = useState<Room[]>([]);
  const [availableBeds, setAvailableBeds] = useState<BedType[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  
  // Rooms for follow-up (poli)
  const [poliRooms, setPoliRooms] = useState<Room[]>([]);
  
  // Doctors for DPJP (rawat inap)
  const [doctors, setDoctors] = useState<Employee[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  
  // Check if form is disabled (already saved)
  const isDisabled = !!initialData?.disposition_type;
  
  // Selected room units with beds for cinema-style selector
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  
  // Checkbox states for follow-up options
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  
  // Fetch disposition options from master data
  const { data: dispositionData } = useMasterData('disposition_type');
  const { data: dischargeConditionData } = useMasterData('discharge_condition');
  
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

  const [formData, setFormData] = useState({
    disposition_type: initialData?.disposition_type || "",
    disposition_note: initialData?.disposition_note || "",
    discharge_status: initialData?.discharge_status || "",
    discharge_condition: initialData?.discharge_condition || "",
    referral_facility: initialData?.referral_facility || "",
    referral_reason: initialData?.referral_reason || "",
    referral_urgency: initialData?.referral_urgency || "",
    admission_type: initialData?.admission_type || "",
    admission_ward: initialData?.admission_ward || "",
    admission_reason: initialData?.admission_reason || "",
    admission_room_id: initialData?.admission_room_id || undefined as number | undefined,
    admission_bed_id: initialData?.admission_bed_id || undefined as number | undefined,
    admission_doctor_id: undefined as number | undefined,
    death_time: initialData?.death_time || "",
    death_cause: initialData?.death_cause || "",
    follow_up_date: initialData?.follow_up_date || "",
    follow_up_instruction: initialData?.follow_up_instruction || "",
    follow_up_room_id: initialData?.follow_up_room_id || undefined as number | undefined,
    discharge_medication: initialData?.discharge_medication || "",
    discharge_instruction: initialData?.discharge_instruction || "",
  });

  // Load rooms for inpatient and poli
  const loadRooms = async () => {
    try {
      // Use high limit to get all rooms for dropdown selection
      const roomsResponse = await roomsApi.getAll({ limit: 1000, is_active: 'true' });
      const allRooms = roomsResponse.data.data || [];
      
      const filteredPoliRooms = allRooms.filter(r => 
        (r.room_type?.toLowerCase().includes('poli') || r.service_type === 'rawat_jalan') && r.is_active
      );
      
      setInpatientRooms(allRooms.filter(r => r.has_bed && r.is_active));
      setPoliRooms(filteredPoliRooms);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };
  
  // Load doctors assigned to selected inpatient room
  const loadDoctorsByRoom = async (roomId: number) => {
    setLoadingDoctors(true);
    setDoctors([]);
    try {
      const response = await roomsApi.getStaff(roomId);
      const roomStaff: RoomStaff[] = response.data.data || [];
      const doctorsInRoom = roomStaff
        .filter((staff) => staff.employee?.tipe_karyawan === 'dokter')
        .map((staff) => staff.employee!)
        .filter((emp): emp is Employee => !!emp);
      setDoctors(doctorsInRoom);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
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
            admission_ward: response.data.admission_ward || "",
            admission_reason: response.data.admission_reason || "",
            admission_room_id: response.data.admission_room_id,
            admission_bed_id: response.data.admission_bed_id,
            admission_doctor_id: undefined,
            death_time: response.data.death_time || "",
            death_cause: response.data.death_cause || "",
            follow_up_date: response.data.follow_up_date ? response.data.follow_up_date.split('T')[0] : "",
            follow_up_instruction: response.data.follow_up_instruction || "",
            follow_up_room_id: response.data.follow_up_room_id,
            discharge_medication: response.data.discharge_medication || "",
            discharge_instruction: response.data.discharge_instruction || "",
          });
          
          if (response.data.follow_up_date && response.data.follow_up_room_id) {
            setWantsFollowUp(true);
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

  // Load beds and doctors when room is selected
  useEffect(() => {
    const loadBeds = async () => {
      if (!formData.admission_room_id) {
        setRoomUnits([]);
        setAvailableBeds([]);
        setSelectedUnitId(null);
        setDoctors([]);
        return;
      }
      
      setLoadingBeds(true);
      try {
        const roomResponse = await roomsApi.getById(formData.admission_room_id);
        const roomData = roomResponse.data.data;
        console.log('Room data with beds:', roomData);
        setRoomUnits(roomData.units || []);
        
        const allBeds: BedType[] = [];
        roomData.units?.forEach(unit => {
          unit.beds?.forEach(bed => {
            if (bed.current_patient) {
              console.log(`Bed ${bed.bed_number} occupied by:`, bed.current_patient);
            }
            allBeds.push({ ...bed, room_unit: unit });
          });
        });
        setAvailableBeds(allBeds);
        
        if (roomData.units && roomData.units.length > 0) {
          setSelectedUnitId(roomData.units[0].id);
        }
        
        await loadDoctorsByRoom(formData.admission_room_id);
      } catch (err) {
        console.error("Failed to load beds:", err);
      } finally {
        setLoadingBeds(false);
      }
    };
    
    loadBeds();
  }, [formData.admission_room_id]);
  
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
    
    setSaving(true);
    try {
      const payload = {
        ...formData,
        create_admission: formData.disposition_type === "rawat_inap" && !!formData.admission_room_id,
        create_follow_up: ["pulang", "aps"].includes(formData.disposition_type) && wantsFollowUp && !!formData.follow_up_date && !!formData.follow_up_room_id,
      };
      
      const response = await medicalRecordsApi.saveDisposition(visitId, payload);
      
      let successMessage = "Disposisi berhasil disimpan";
      if (response.data.inpatient_visit_id) {
        successMessage += ". Kunjungan rawat inap telah dibuat.";
      }
      if (response.data.follow_up_registration_id) {
        successMessage += ". Jadwal kontrol telah dibuat.";
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
  
  const selectedUnit = roomUnits.find(u => u.id === selectedUnitId);
  const bedsInUnit = selectedUnit?.beds || [];

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
                                  onValueChange={(value) => handleChange("follow_up_room_id", value ? parseInt(value) : undefined)}
                                  placeholder="Pilih poli..."
                                  searchPlaceholder="Cari poli..."
                                  emptyText="Poli tidak ditemukan"
                                  disabled={isDisabled}
                                />
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
                            {formData.follow_up_date && formData.follow_up_room_id && (
                              <Alert className="bg-green-100 border-green-300">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                  Jadwal kontrol akan otomatis dibuat untuk tanggal <strong>{formData.follow_up_date}</strong> di{' '}
                                  <strong>{poliRooms.find(r => r.id === formData.follow_up_room_id)?.name || 'poli terpilih'}</strong>.
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

                    {/* RAWAT INAP Form */}
                    {showAdmissionFields && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                          <Label className="text-sm font-semibold">Informasi Rawat Inap</Label>
                        </div>
                        
                        {/* Admission Type Selection */}
                        <div className="space-y-2">
                          <Label className="text-sm">Tipe Rawat Inap</Label>
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

                        {/* Room Selection - Ticket Style */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Pilih Ruangan <span className="text-destructive">*</span>
                          </Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {inpatientRooms.map(room => {
                              const isSelected = formData.admission_room_id === room.id;
                              const availableBedCount = room.available_beds || 0;
                              const totalBedCount = room.total_beds || 0;
                              
                              return (
                                <button
                                  key={room.id}
                                  type="button"
                                  onClick={() => {
                                    handleChange("admission_room_id", room.id);
                                    handleChange("admission_bed_id", undefined);
                                    handleChange("admission_doctor_id", undefined);
                                    setSelectedUnitId(null);
                                  }}
                                  disabled={isDisabled || availableBedCount === 0}
                                  className={cn(
                                    "p-4 rounded-lg border-2 text-left transition-all relative",
                                    isSelected
                                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                      : availableBedCount === 0
                                      ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                      : isDisabled
                                      ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                      : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                  )}
                                >
                                  {isSelected && (
                                    <div className="absolute top-2 right-2">
                                      <CheckCircle2 className="h-5 w-5 text-primary" />
                                    </div>
                                  )}
                                  <div className="font-semibold text-sm mb-1">{room.name}</div>
                                  <div className="text-xs text-muted-foreground">{room.code}</div>
                                  <div className={cn(
                                    "text-xs font-medium mt-2 flex items-center gap-1",
                                    availableBedCount > 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    <Bed className="h-3 w-3" />
                                    {availableBedCount} / {totalBedCount} tersedia
                                  </div>
                                  {room.room_class && (
                                    <div className="text-xs text-muted-foreground mt-1 capitalize">
                                      {room.room_class.replace(/_/g, ' ')}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {inpatientRooms.length === 0 && (
                            <Alert variant="destructive">
                              <AlertDescription>Tidak ada ruangan rawat inap yang tersedia</AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        {/* Doctor Selection - Ticket Style */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            DPJP (Dokter Penanggung Jawab Pasien) <span className="text-destructive">*</span>
                          </Label>
                          {loadingDoctors ? (
                            <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              <span className="ml-2 text-sm text-muted-foreground">Memuat daftar dokter...</span>
                            </div>
                          ) : doctors.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {doctors.map(doctor => {
                                const isSelected = formData.admission_doctor_id === doctor.id;
                                
                                return (
                                  <button
                                    key={doctor.id}
                                    type="button"
                                    onClick={() => handleChange("admission_doctor_id", doctor.id)}
                                    disabled={isDisabled}
                                    className={cn(
                                      "p-4 rounded-lg border-2 text-left transition-all relative",
                                      isSelected
                                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                        : isDisabled
                                        ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                        : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                    )}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-2 right-2">
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <UserRound className="h-5 w-5 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm truncate">{doctor.nama_lengkap}</div>
                                        <div className="text-xs text-muted-foreground">{doctor.nip || 'Dokter'}</div>
                                      </div>
                                    </div>
                                    {doctor.spesialisasi && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {doctor.spesialisasi}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : formData.admission_room_id ? (
                            <Alert variant="destructive">
                              <AlertDescription>Tidak ada dokter yang ditugaskan di ruangan ini</AlertDescription>
                            </Alert>
                          ) : (
                            <Alert className="bg-blue-50 border-blue-200">
                              <AlertDescription className="text-blue-700">
                                Pilih ruangan terlebih dahulu untuk melihat daftar dokter
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        {/* Bed Selection - Cinema Style */}
                        {formData.admission_room_id && (
                          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <Bed className="h-4 w-4" />
                                Pilih Tempat Tidur <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-4 rounded bg-green-500"></div>
                                  <span>Tersedia</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-4 rounded bg-red-400"></div>
                                  <span>Terisi</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-4 rounded bg-primary ring-2 ring-primary ring-offset-2"></div>
                                  <span>Dipilih</span>
                                </div>
                              </div>
                            </div>
                            
                            {loadingBeds ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-sm text-muted-foreground">Memuat data bed...</span>
                              </div>
                            ) : roomUnits.length > 0 ? (
                              <div className="space-y-4">
                                {/* Unit/Kamar Tabs - Ticket Style */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {roomUnits.map(unit => {
                                    const availableCount = unit.beds?.filter(b => b.status === 'available').length || 0;
                                    const totalCount = unit.beds?.length || 0;
                                    const isSelected = selectedUnitId === unit.id;
                                    
                                    return (
                                      <button
                                        key={unit.id}
                                        type="button"
                                        onClick={() => setSelectedUnitId(unit.id)}
                                        disabled={isDisabled || availableCount === 0}
                                        className={cn(
                                          "p-3 rounded-lg border-2 text-left transition-all",
                                          isSelected
                                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                            : availableCount === 0
                                            ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                            : isDisabled
                                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                        )}
                                      >
                                        <div className="font-semibold text-sm mb-1">{unit.name}</div>
                                        <div className="text-xs text-muted-foreground">Lantai {unit.floor || 1}</div>
                                        <div className={cn(
                                          "text-xs font-medium mt-1.5",
                                          availableCount > 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                          {availableCount} / {totalCount} bed
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                
                                {/* Bed Grid */}
                                {selectedUnit && (
                                  <div className="bg-background rounded-lg p-4 border">
                                    <div className="text-center text-xs text-muted-foreground mb-4 pb-2 border-b">
                                      {selectedUnit.name} - Lantai {selectedUnit.floor || 1}
                                    </div>
                                    <TooltipProvider delayDuration={200}>
                                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                        {bedsInUnit.map(bed => {
                                          const isAvailable = bed.status === 'available';
                                          const isSelected = formData.admission_bed_id === bed.id;
                                          const canSelect = isAvailable && !isDisabled;
                                          
                                          return (
                                            <Tooltip key={bed.id}>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (canSelect) {
                                                      handleChange("admission_bed_id", isSelected ? undefined : bed.id);
                                                    }
                                                  }}
                                                  className={cn(
                                                    "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all",
                                                    isSelected
                                                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 cursor-pointer"
                                                      : canSelect
                                                      ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                                                      : "bg-red-400 text-white cursor-not-allowed"
                                                  )}
                                                >
                                                  <Bed className="h-4 w-4 mb-0.5" />
                                                  <span>{bed.bed_number}</span>
                                                  {isSelected && <Check className="h-3 w-3 mt-0.5" />}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-xs">
                                                <div className="space-y-1">
                                                  <p className="font-semibold">Bed {bed.bed_number}</p>
                                                  {isAvailable ? (
                                                    <p className="text-green-600 dark:text-green-400">✓ Tersedia</p>
                                                  ) : (
                                                    <>
                                                      <p className="text-red-600 dark:text-red-400">✗ Terisi</p>
                                                      {bed.current_patient && (
                                                        <div className="text-sm space-y-0.5 pt-1 border-t mt-1">
                                                          <p><span className="font-medium">Pasien:</span> {bed.current_patient.name || 'N/A'}</p>
                                                          <p><span className="font-medium">RM:</span> {bed.current_patient.medical_record_number || 'N/A'}</p>
                                                          {bed.current_patient.admission_date && (
                                                            <p><span className="font-medium">Masuk:</span> {new Date(bed.current_patient.admission_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                          )}
                                                        </div>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          );
                                        })}
                                      </div>
                                    </TooltipProvider>
                                    {bedsInUnit.length === 0 && (
                                      <p className="text-center text-sm text-muted-foreground py-4">
                                        Tidak ada bed di kamar ini
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Alert variant="destructive" className="py-2">
                                <AlertDescription>
                                  Tidak ada unit/kamar di ruangan ini
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label htmlFor="admission_reason" className="text-sm">Alasan Rawat Inap</Label>
                          <Textarea
                            id="admission_reason"
                            placeholder="Alasan pasien perlu dirawat inap..."
                            value={formData.admission_reason}
                            onChange={(e) => handleChange("admission_reason", e.target.value)}
                            className="min-h-[80px] resize-none"
                            disabled={isDisabled}
                          />
                        </div>
                        
                        {formData.admission_room_id && formData.admission_bed_id && formData.admission_doctor_id && (
                          <Alert className="bg-blue-50 border-blue-200">
                            <Building className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                              Kunjungan rawat inap akan dibuat di{' '}
                              <strong>{inpatientRooms.find(r => r.id === formData.admission_room_id)?.name}</strong>
                              {' '}- Bed <strong>{availableBeds.find(b => b.id === formData.admission_bed_id)?.bed_number}</strong>
                              {' '}dengan DPJP <strong>{doctors.find(d => d.id === formData.admission_doctor_id)?.nama_lengkap}</strong>.
                            </AlertDescription>
                          </Alert>
                        )}
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
