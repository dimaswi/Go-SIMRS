import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, LogOut, Loader2, AlertTriangle, Building, Bed, Calendar, CheckCircle2, Check, UserRound } from "lucide-react";
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
}

// Description mapping for disposition options
const dispositionDescriptions: Record<string, string> = {
  pulang: "Pasien pulang dalam keadaan baik",
  rawat_inap: "Pasien memerlukan rawat inap",
  rujuk: "Pasien dirujuk ke fasilitas lain",
  meninggal: "Pasien meninggal dunia",
  aps: "Pasien pulang paksa",
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

export function DispositionForm({ visitId, initialData, onSave, isEmergency: _isEmergency = false }: DispositionFormProps) {
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
  
  // Fetch disposition options from master data
  const { data: dispositionData } = useMasterData('disposition_type');
  const { data: dischargeConditionData } = useMasterData('discharge_condition');
  
  const dispositionOptions = dispositionData.map(item => ({
    value: item.code,
    label: item.name,
    description: dispositionDescriptions[item.code] || item.description || '',
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
    admission_doctor_id: undefined as number | undefined, // DPJP for rawat inap
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
      const roomsResponse = await roomsApi.getAll();
      const allRooms = roomsResponse.data.data || [];
      
      // Filter inpatient rooms (has_bed = true)
      setInpatientRooms(allRooms.filter(r => r.has_bed && r.is_active));
      
      // Filter poli rooms (room_type includes 'poli')
      setPoliRooms(allRooms.filter(r => r.room_type?.includes('poli') || r.service_type === 'rawat_jalan'));
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
      
      // Filter only doctors (tipe_karyawan = 'dokter')
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
        }
        
        // Check pending orders
        const pendingResponse = await medicalRecordsApi.checkPendingOrders(visitId);
        setPendingOrdersInfo(pendingResponse.data);
        
        // Load rooms
        await loadRooms();
      } catch {
        // No existing data, use defaults
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
        // Fetch room details with units and beds
        const roomResponse = await roomsApi.getById(formData.admission_room_id);
        const roomData = roomResponse.data.data;
        setRoomUnits(roomData.units || []);
        
        // Collect all beds for reference
        const allBeds: BedType[] = [];
        roomData.units?.forEach(unit => {
          unit.beds?.forEach(bed => {
            allBeds.push({ ...bed, room_unit: unit });
          });
        });
        setAvailableBeds(allBeds);
        
        // Auto-select first unit if exists
        if (roomData.units && roomData.units.length > 0) {
          setSelectedUnitId(roomData.units[0].id);
        }
        
        // Load doctors assigned to this room
        await loadDoctorsByRoom(formData.admission_room_id);
      } catch (err) {
        console.error("Failed to load beds:", err);
      } finally {
        setLoadingBeds(false);
      }
    };
    
    loadBeds();
  }, [formData.admission_room_id]);

  const handleChange = (field: string, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate for pulang disposition
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
      // Auto create admission if rawat_inap with room selected
      // Auto create follow-up if pulang with date and poli selected
      const payload = {
        ...formData,
        create_admission: formData.disposition_type === "rawat_inap" && !!formData.admission_room_id,
        create_follow_up: formData.disposition_type === "pulang" && !!formData.follow_up_date && !!formData.follow_up_room_id,
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

  const showReferralFields = formData.disposition_type === "rujuk";
  const showAdmissionFields = formData.disposition_type === "rawat_inap";
  const showDeathFields = ["meninggal", "dod"].includes(formData.disposition_type);
  // Kontrol hanya muncul untuk pasien pulang dari rawat inap
  const showFollowUpFields = formData.disposition_type === "pulang" && pendingOrdersInfo?.is_inpatient === true;
  const showDischargeInstructions = formData.disposition_type === "pulang";
  
  // Kondisi keluar hanya muncul jika bukan rawat inap DAN tidak ada jadwal kontrol
  const hasFollowUpSchedule = formData.follow_up_date && formData.follow_up_room_id;
  const showDischargeCondition = formData.disposition_type && 
    formData.disposition_type !== "rawat_inap" && 
    !hasFollowUpSchedule;
  
  // Get beds for selected unit
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
      <CardHeader className="border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <LogOut className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Disposisi / Pemulangan</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Pending Orders Warning */}
        {pendingOrdersInfo?.has_pending_orders && (
          <Alert variant="destructive" className="mb-6">
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
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">Disposisi Sudah Disimpan</AlertTitle>
            <AlertDescription className="text-blue-600">
              Form disposisi tidak dapat diubah karena sudah disimpan sebelumnya.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Disposition Type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Status Pemulangan <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dispositionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange("disposition_type", option.value)}
                  disabled={isDisabled || (option.value === "pulang" && pendingOrdersInfo?.has_pending_orders)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    formData.disposition_type === option.value
                      ? "border-primary bg-primary/10"
                      : isDisabled
                      ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                      : option.value === "pulang" && pendingOrdersInfo?.has_pending_orders
                      ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Kondisi Keluar - hanya muncul jika bukan rawat inap dan tidak ada kontrol */}
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

          {/* Discharge Instructions - only for pulang */}
          {showDischargeInstructions && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary">Instruksi Pemulangan</h3>
              <div className="space-y-2">
                <Label htmlFor="discharge_instruction" className="text-sm">
                  Instruksi Pemulangan
                </Label>
                <Textarea
                  id="discharge_instruction"
                  placeholder="Instruksi yang harus diikuti pasien setelah pulang (diet, aktivitas, minum obat, dll)..."
                  value={formData.discharge_instruction}
                  onChange={(e) => handleChange("discharge_instruction", e.target.value)}
                  className="min-h-[120px] resize-none"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discharge_medication" className="text-sm">
                  Obat Pulang
                </Label>
                <Textarea
                  id="discharge_medication"
                  placeholder="Daftar obat yang dibawa pulang..."
                  value={formData.discharge_medication}
                  onChange={(e) => handleChange("discharge_medication", e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isDisabled}
                />
              </div>
            </div>
          )}

          {/* Follow Up / Kontrol - for pulang */}
          {showFollowUpFields && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Jadwal Kontrol (Opsional)
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">
                Isi tanggal dan poli untuk membuat jadwal kontrol otomatis. Pasien tidak perlu registrasi ulang.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="follow_up_date" className="text-sm">Tanggal Kontrol</Label>
                  <Input
                    id="follow_up_date"
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => handleChange("follow_up_date", e.target.value)}
                    className="h-11"
                    min={new Date().toISOString().split('T')[0]}
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow_up_room_id" className="text-sm">Poli Tujuan Kontrol</Label>
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
                  <Label htmlFor="follow_up_instruction" className="text-sm">Instruksi Tindak Lanjut</Label>
                  <Textarea
                    id="follow_up_instruction"
                    placeholder="Rencana pemeriksaan/tindakan lanjutan yang diperlukan..."
                    value={formData.follow_up_instruction}
                    onChange={(e) => handleChange("follow_up_instruction", e.target.value)}
                    className="min-h-[80px] resize-none"
                    disabled={isDisabled}
                  />
                </div>
              </div>
              {formData.follow_up_date && formData.follow_up_room_id && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    Jadwal kontrol akan otomatis dibuat untuk tanggal {formData.follow_up_date} di{' '}
                    {poliRooms.find(r => r.id === formData.follow_up_room_id)?.name || 'poli yang dipilih'}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Admission - for rawat_inap */}
          {showAdmissionFields && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                <Building className="h-4 w-4" />
                Informasi Rawat Inap
              </h3>
              
              {/* Tipe Rawat Inap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="admission_type" className="text-sm">Tipe Rawat Inap</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "elektif", label: "Elektif" },
                      { value: "emergency", label: "Emergency" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleChange("admission_type", opt.value)}
                        disabled={isDisabled}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                          formData.admission_type === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : isDisabled
                            ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admission_room_id" className="text-sm">Pilih Ruangan</Label>
                  <Combobox
                    options={inpatientRooms.map(r => ({ 
                      value: r.id.toString(), 
                      label: `${r.name} (${r.room_class || 'Umum'})`
                    }))}
                    value={formData.admission_room_id?.toString() || ""}
                    onValueChange={(value) => {
                      handleChange("admission_room_id", value ? parseInt(value) : undefined);
                      handleChange("admission_bed_id", undefined);
                      handleChange("admission_doctor_id", undefined);
                      setSelectedUnitId(null);
                    }}
                    placeholder="Pilih ruangan..."
                    searchPlaceholder="Cari ruangan..."
                    emptyText="Ruangan tidak ditemukan"
                    disabled={isDisabled}
                  />
                </div>
              </div>
              
              {/* DPJP - Dokter Penanggung Jawab Pasien */}
              <div className="space-y-2">
                <Label htmlFor="admission_doctor_id" className="text-sm flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  DPJP (Dokter Penanggung Jawab Pasien) <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  options={doctors.map(d => ({ 
                    value: d.id.toString(), 
                    label: d.nama_lengkap
                  }))}
                  value={formData.admission_doctor_id?.toString() || ""}
                  onValueChange={(value) => handleChange("admission_doctor_id", value ? parseInt(value) : undefined)}
                  placeholder={loadingDoctors ? "Memuat dokter..." : (doctors.length === 0 ? "Pilih ruangan terlebih dahulu" : "Pilih dokter...")}
                  searchPlaceholder="Cari dokter..."
                  emptyText={doctors.length === 0 ? "Tidak ada dokter di ruangan ini" : "Dokter tidak ditemukan"}
                  disabled={isDisabled || loadingDoctors || doctors.length === 0}
                />
              </div>
              
              {/* Cinema-style Bed Selector */}
              {formData.admission_room_id && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Bed className="h-4 w-4" />
                      Pilih Tempat Tidur
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
                      {/* Unit/Kamar Tabs */}
                      <div className="flex flex-wrap gap-2">
                        {roomUnits.map(unit => (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => setSelectedUnitId(unit.id)}
                            disabled={isDisabled}
                            className={cn(
                              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                              selectedUnitId === unit.id
                                ? "bg-primary text-primary-foreground"
                                : isDisabled
                                ? "bg-muted opacity-50 cursor-not-allowed"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {unit.name}
                            <span className="ml-1 text-xs opacity-70">
                              ({unit.beds?.filter(b => b.status === 'available').length || 0}/{unit.beds?.length || 0})
                            </span>
                          </button>
                        ))}
                      </div>
                      
                      {/* Bed Grid - Cinema Style */}
                      {selectedUnit && (
                        <div className="bg-background rounded-lg p-4 border">
                          <div className="text-center text-xs text-muted-foreground mb-4 pb-2 border-b">
                            {selectedUnit.name} - Lantai {selectedUnit.floor || 1}
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {bedsInUnit.map(bed => {
                              const isAvailable = bed.status === 'available';
                              const isSelected = formData.admission_bed_id === bed.id;
                              
                              return (
                                <button
                                  key={bed.id}
                                  type="button"
                                  onClick={() => {
                                    if (isAvailable && !isDisabled) {
                                      handleChange("admission_bed_id", isSelected ? undefined : bed.id);
                                    }
                                  }}
                                  disabled={!isAvailable || isDisabled}
                                  className={cn(
                                    "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all",
                                    isSelected
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                                      : isAvailable && !isDisabled
                                      ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                                      : "bg-red-400 text-white cursor-not-allowed opacity-70"
                                  )}
                                  title={isAvailable ? `Bed ${bed.bed_number} - Tersedia` : `Bed ${bed.bed_number} - Terisi`}
                                >
                                  <Bed className="h-4 w-4 mb-0.5" />
                                  <span>{bed.bed_number}</span>
                                  {isSelected && <Check className="h-3 w-3 mt-0.5" />}
                                </button>
                              );
                            })}
                          </div>
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
              
              {/* Alasan Rawat Inap */}
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
              
              {/* Confirmation */}
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

          {/* Referral - only for rujuk */}
          {showReferralFields && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary">Informasi Rujukan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="referral_facility" className="text-sm">
                    Fasilitas Tujuan Rujukan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="referral_facility"
                    placeholder="Nama rumah sakit/fasilitas kesehatan tujuan"
                    value={formData.referral_facility}
                    onChange={(e) => handleChange("referral_facility", e.target.value)}
                    className="h-11"
                    required={showReferralFields}
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referral_urgency" className="text-sm">
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
                  <Label htmlFor="referral_reason" className="text-sm">
                    Alasan Rujukan <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="referral_reason"
                    placeholder="Alasan pasien dirujuk ke fasilitas lain..."
                    value={formData.referral_reason}
                    onChange={(e) => handleChange("referral_reason", e.target.value)}
                    className="min-h-[80px] resize-none"
                    required={showReferralFields}
                    disabled={isDisabled}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Death - for meninggal or dod */}
          {showDeathFields && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary">Informasi Kematian</h3>
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
                    className="h-11"
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            {!isDisabled && (
              <Button type="submit" className="gap-2" disabled={!formData.disposition_type || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Disposisi
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
