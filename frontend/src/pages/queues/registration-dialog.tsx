import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePickerDropdown } from "@/components/ui/date-picker-dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { PatientSearchCombobox } from "@/components/ui/patient-search-combobox";
import { masterDataApi, regionsApi, patientsApi, roomsApi, registrationApi } from "@/lib/api";
import type { PatientRequest, MasterData, Province, Regency, District, Village, Patient, Room, RoomStaff } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, User, MapPin, Phone, Shield } from "lucide-react";

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueId: number;
  queueNumber: string;
  onSuccess: () => void;
}

const initialFormData: PatientRequest = {
  nama_lengkap: "",
  jenis_kelamin: "L",
  jenis_jaminan: "Umum",
  kewarganegaraan: "WNI",
};

export function RegistrationDialog({
  open,
  onOpenChange,
  queueId,
  queueNumber,
  onSuccess,
}: RegistrationDialogProps) {
  const { toast } = useToast();

  // Step 1: Search RM or new patient
  const [step, setStep] = useState<"search" | "form" | "registration">("search");
  const [existingPatient, setExistingPatient] = useState<Patient | null>(null);

  // Form data
  const [formData, setFormData] = useState<PatientRequest>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [sameAddress, setSameAddress] = useState(false);

  // Registration data
  const [destinationRoomId, setDestinationRoomId] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bpjs" | "insurance">("cash");
  const [bpjsNumber, setBpjsNumber] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [complaint, setComplaint] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent" | "emergency">("normal");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");

  // Master data state
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStaff, setRoomStaff] = useState<RoomStaff[]>([]);

  // Region data state
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regenciesKTP, setRegenciesKTP] = useState<Regency[]>([]);
  const [districtsKTP, setDistrictsKTP] = useState<District[]>([]);
  const [villagesKTP, setVillagesKTP] = useState<Village[]>([]);
  const [regenciesDomisili, setRegenciesDomisili] = useState<Regency[]>([]);
  const [districtsDomisili, setDistrictsDomisili] = useState<District[]>([]);
  const [villagesDomisili, setVillagesDomisili] = useState<Village[]>([]);

  useEffect(() => {
    if (open) {
      setStep("search");
      setExistingPatient(null);
      setFormData(initialFormData);
      setSameAddress(false);
      setDestinationRoomId(null);
      setDoctorId(null);
      setPaymentMethod("cash");
      setBpjsNumber("");
      setInsuranceName("");
      setInsuranceNumber("");
      setComplaint("");
      setPriority("normal");
      setSelectedServiceType("");
      setRoomStaff([]);
    }
  }, [open]);

  const loadReferenceData = async () => {
    setLoadingMaster(true);
    try {
      const [masterDataRes, provincesRes, roomsRes] = await Promise.all([
        masterDataApi.getMultiple([
          "gender",
          "religion",
          "marital_status",
          "education_level",
          "occupation",
          "relationship",
          "blood_type",
          "rhesus_type",
          "insurance_type",
          "insurance_company",
          "bpjs_class",
        ]),
        regionsApi.getProvinces(),
        roomsApi.getAll({ limit: 1000, is_active: "true" }),
      ]);

      setMasterData(masterDataRes.data.data || {});
      setProvinces(provincesRes.data.data || []);
      // Show all active rooms excluding depo and gudang
      const allRooms = roomsRes.data.data || [];
      
      const filteredRooms = allRooms.filter(
        (room: Room) => {
          const notExcluded = room.room_type !== "depo_farmasi" && 
                              room.room_type !== "gudang_farmasi";
          const isActive = room.is_active === true;
          
          return notExcluded && isActive;
        }
      );
      
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load reference data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data referensi",
      });
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleNewPatient = () => {
    setStep("form");
    loadReferenceData();
  };

  const handleRoomChange = async (roomId: string) => {
    const id = Number(roomId);
    setDestinationRoomId(id);
    setDoctorId(null);
    setRoomStaff([]);
    
    // Load doctors/staff from selected room
    if (id) {
      try {
        const response = await roomsApi.getStaff(id);
        console.log("Room staff response:", response.data.data);
        
        // Filter only doctors (employee type = dokter)
        const doctors = (response.data.data || []).filter(
          (staff: RoomStaff) => {
            console.log("Staff:", staff.employee?.nama_lengkap, "Type:", staff.employee?.tipe_karyawan);
            return staff.employee?.tipe_karyawan === "dokter" &&
              (!staff.end_date || new Date(staff.end_date) >= new Date());
          }
        );
        console.log("Filtered doctors:", doctors);
        setRoomStaff(doctors);
      } catch (error) {
        console.error("Failed to load room staff:", error);
      }
    }
  };

  const handleUseExistingPatient = async () => {
    if (!existingPatient) return;
    setStep("registration");
    loadReferenceData();
  };

  // Auto-load BPJS data when payment method is BPJS and patient has BPJS number
  useEffect(() => {
    if (paymentMethod === "bpjs" && existingPatient) {
      if (existingPatient.no_bpjs) {
        setBpjsNumber(existingPatient.no_bpjs);
      }
    }
  }, [paymentMethod, existingPatient]);

  // Convert master data to combobox options
  const toOptions = (data: MasterData[] | undefined) => {
    if (!data) return [];
    return data.map((item) => ({
      value: item.name,
      label: item.name,
    }));
  };

  // Convert regions to combobox options
  const toRegionOptions = (data: { id: string; name: string }[] | undefined) => {
    if (!data) return [];
    return data.map((item) => ({
      value: item.name,
      label: item.name,
    }));
  };

  // Handle province change for KTP
  const handleProvinceKTPChange = async (value: string) => {
    setFormData({ ...formData, provinsi_ktp: value, kota_ktp: "", kecamatan_ktp: "", kelurahan_ktp: "" });
    setDistrictsKTP([]);
    setVillagesKTP([]);
    const province = provinces.find((p) => p.name === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  // Handle regency change for KTP
  const handleRegencyKTPChange = async (value: string) => {
    setFormData({ ...formData, kota_ktp: value, kecamatan_ktp: "", kelurahan_ktp: "" });
    setVillagesKTP([]);
    const regency = regenciesKTP.find((r) => r.name === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  // Handle district change for KTP
  const handleDistrictKTPChange = async (value: string) => {
    setFormData({ ...formData, kecamatan_ktp: value, kelurahan_ktp: "" });
    const district = districtsKTP.find((d) => d.name === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

  // Handle province change for Domisili
  const handleProvinceDomisiliChange = async (value: string) => {
    setFormData({ ...formData, provinsi_domisili: value, kota_domisili: "", kecamatan_domisili: "", kelurahan_domisili: "" });
    setDistrictsDomisili([]);
    setVillagesDomisili([]);
    const province = provinces.find((p) => p.name === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  // Handle regency change for Domisili
  const handleRegencyDomisiliChange = async (value: string) => {
    setFormData({ ...formData, kota_domisili: value, kecamatan_domisili: "", kelurahan_domisili: "" });
    setVillagesDomisili([]);
    const regency = regenciesDomisili.find((r) => r.name === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  // Handle district change for Domisili
  const handleDistrictDomisiliChange = async (value: string) => {
    setFormData({ ...formData, kecamatan_domisili: value, kelurahan_domisili: "" });
    const district = districtsDomisili.find((d) => d.name === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

  // Handle same address checkbox
  const handleSameAddressChange = (checked: boolean) => {
    setSameAddress(checked);
    if (checked) {
      setFormData({
        ...formData,
        alamat_domisili: formData.alamat_ktp,
        rt_domisili: formData.rt_ktp,
        rw_domisili: formData.rw_ktp,
        kode_pos_domisili: formData.kode_pos_ktp,
        provinsi_domisili: formData.provinsi_ktp,
        kota_domisili: formData.kota_ktp,
        kecamatan_domisili: formData.kecamatan_ktp,
        kelurahan_domisili: formData.kelurahan_ktp,
      });
      // Load regions for domisili based on KTP
      if (formData.provinsi_ktp) handleProvinceDomisiliChange(formData.provinsi_ktp);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      // Create patient
      const patientResponse = await patientsApi.create(formData);
      console.log("Patient created response:", patientResponse);
      
      // patientsApi.create returns response.data which has structure { message, data }
      const newPatient = patientResponse.data;

      if (!newPatient) {
        throw new Error("Data pasien tidak ditemukan dalam response");
      }

      setExistingPatient(newPatient);
      setStep("registration");
      loadReferenceData();
      
      toast({
        title: "Berhasil",
        description: `Pasien baru ${newPatient.nama_lengkap} berhasil dibuat`,
      });
    } catch (error: any) {
      console.error("Error creating patient:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || error.message || "Gagal menyimpan data pasien",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!existingPatient) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pasien tidak ditemukan",
      });
      return;
    }

    if (!destinationRoomId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan tujuan",
      });
      return;
    }

    // Validate BPJS
    if (paymentMethod === "bpjs" && !bpjsNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nomor BPJS harus diisi",
      });
      return;
    }

    // Validate Insurance
    if (paymentMethod === "insurance" && (!insuranceName || !insuranceNumber)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nama dan nomor asuransi harus diisi",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await registrationApi.create({
        queue_id: queueId,
        patient_id: existingPatient.id,
        registration_type: "outpatient",
        destination_room_id: destinationRoomId,
        doctor_id: doctorId || undefined,
        payment_method: paymentMethod,
        bpjs_number: paymentMethod === "bpjs" ? bpjsNumber : undefined,
        insurance_name: paymentMethod === "insurance" ? insuranceName : undefined,
        insurance_number: paymentMethod === "insurance" ? insuranceNumber : undefined,
        complaint: complaint || undefined,
        create_visit: true,
        create_room_queue: true,
        queue_priority: priority,
      });

      const registration = response.data.data;
      console.log("Registration full response:", response.data);
      console.log("Registration data:", registration);
      
      // Try to get visit from multiple possible sources
      // Use type assertion to handle dynamic response structure
      const regData = registration as any;
      let visit = null;
      
      if (regData.visits && Array.isArray(regData.visits) && regData.visits.length > 0) {
        visit = regData.visits[0];
      } else if (regData.visit) {
        visit = regData.visit;
      }
      
      console.log("Visit:", visit);
      
      // Get room queue number
      let roomQueueNumber = "-";
      if (visit?.room_queue?.queue_number) {
        roomQueueNumber = visit.room_queue.queue_number;
      }
      
      const roomName = registration.destination_room?.name || "";
      
      console.log("Room queue number:", roomQueueNumber);
      console.log("Room name:", roomName);

      toast({
        title: "Pendaftaran Berhasil!",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">Pasien: {existingPatient.nama_lengkap}</p>
            <p>No. RM: {existingPatient.no_rm}</p>
            <p>Ruangan: {roomName}</p>
            <p className="text-lg font-bold">Nomor Antrian Ruangan: {roomQueueNumber}</p>
          </div>
        ),
        duration: 10000,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat pendaftaran",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pendaftaran Pasien - Antrean {queueNumber}</DialogTitle>
          <DialogDescription>
            {step === "search" 
              ? "Cari nomor rekam medis pasien atau daftarkan pasien baru"
              : step === "registration"
              ? "Lengkapi data pendaftaran"
              : "Lengkapi data pasien baru"}
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cari Pasien</Label>
                <PatientSearchCombobox
                  value={existingPatient}
                  onValueChange={setExistingPatient}
                  placeholder="Cari berdasarkan Nama, NIK, atau No. RM..."
                />
                <p className="text-xs text-muted-foreground">
                  Ketik minimal 2 karakter untuk mencari pasien berdasarkan nama, NIK, atau nomor rekam medis
                </p>
              </div>

              {existingPatient && (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Data Pasien Ditemukan</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nama:</span>
                      <p className="font-medium">{existingPatient.nama_lengkap}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">No. RM:</span>
                      <p className="font-medium">{existingPatient.no_rm}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIK:</span>
                      <p className="font-medium">{existingPatient.nik || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tanggal Lahir:</span>
                      <p className="font-medium">{existingPatient.tanggal_lahir || "-"}</p>
                    </div>
                  </div>
                  <Button onClick={handleUseExistingPatient} className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Gunakan Data Pasien Ini
                  </Button>
                </div>
              )}

              <Separator />

              <Button onClick={handleNewPatient} variant="outline" className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Pasien Baru
              </Button>
            </div>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {loadingMaster && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!loadingMaster && (
              <>
                {/* Identitas */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Identitas</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nama_lengkap">Nama Lengkap *</Label>
                      <Input
                        id="nama_lengkap"
                        value={formData.nama_lengkap}
                        onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nik">NIK</Label>
                      <Input
                        id="nik"
                        value={formData.nik || ""}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jenis_kelamin">Jenis Kelamin *</Label>
                      <Combobox
                        options={toOptions(masterData.gender)}
                        value={formData.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                        onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value === "Laki-laki" ? "L" : "P" })}
                        placeholder="Pilih jenis kelamin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tanggal_lahir">Tanggal Lahir</Label>
                      <DatePickerDropdown
                        value={formData.tanggal_lahir}
                        onChange={(value) => setFormData({ ...formData, tanggal_lahir: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agama">Agama</Label>
                      <Combobox
                        options={toOptions(masterData.religion)}
                        value={formData.agama || ""}
                        onValueChange={(value) => setFormData({ ...formData, agama: value })}
                        placeholder="Pilih agama"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status_perkawinan">Status Kawin</Label>
                      <Combobox
                        options={toOptions(masterData.marital_status)}
                        value={formData.status_perkawinan || ""}
                        onValueChange={(value) => setFormData({ ...formData, status_perkawinan: value })}
                        placeholder="Pilih status kawin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pendidikan_terakhir">Pendidikan</Label>
                      <Combobox
                        options={toOptions(masterData.education_level)}
                        value={formData.pendidikan_terakhir || ""}
                        onValueChange={(value) => setFormData({ ...formData, pendidikan_terakhir: value })}
                        placeholder="Pilih pendidikan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pekerjaan">Pekerjaan</Label>
                      <Combobox
                        options={toOptions(masterData.occupation)}
                        value={formData.pekerjaan || ""}
                        onValueChange={(value) => setFormData({ ...formData, pekerjaan: value })}
                        placeholder="Pilih pekerjaan"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Alamat KTP */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Alamat KTP</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="alamat_ktp">Alamat</Label>
                      <Textarea
                        id="alamat_ktp"
                        value={formData.alamat_ktp || ""}
                        onChange={(e) => setFormData({ ...formData, alamat_ktp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provinsi</Label>
                      <Combobox
                        options={toRegionOptions(provinces)}
                        value={formData.provinsi_ktp || ""}
                        onValueChange={handleProvinceKTPChange}
                        placeholder="Pilih provinsi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kota/Kabupaten</Label>
                      <Combobox
                        options={toRegionOptions(regenciesKTP)}
                        value={formData.kota_ktp || ""}
                        onValueChange={handleRegencyKTPChange}
                        placeholder="Pilih kota/kabupaten"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kecamatan</Label>
                      <Combobox
                        options={toRegionOptions(districtsKTP)}
                        value={formData.kecamatan_ktp || ""}
                        onValueChange={handleDistrictKTPChange}
                        placeholder="Pilih kecamatan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kelurahan</Label>
                      <Combobox
                        options={toRegionOptions(villagesKTP)}
                        value={formData.kelurahan_ktp || ""}
                        onValueChange={(value) => setFormData({ ...formData, kelurahan_ktp: value })}
                        placeholder="Pilih kelurahan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rt_ktp">RT</Label>
                      <Input
                        id="rt_ktp"
                        value={formData.rt_ktp || ""}
                        onChange={(e) => setFormData({ ...formData, rt_ktp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rw_ktp">RW</Label>
                      <Input
                        id="rw_ktp"
                        value={formData.rw_ktp || ""}
                        onChange={(e) => setFormData({ ...formData, rw_ktp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kode_pos_ktp">Kode Pos</Label>
                      <Input
                        id="kode_pos_ktp"
                        value={formData.kode_pos_ktp || ""}
                        onChange={(e) => setFormData({ ...formData, kode_pos_ktp: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Alamat Domisili */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Alamat Domisili</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="same-address"
                        checked={sameAddress}
                        onCheckedChange={handleSameAddressChange}
                      />
                      <Label htmlFor="same-address" className="cursor-pointer">
                        Sama dengan KTP
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="alamat_domisili">Alamat</Label>
                      <Textarea
                        id="alamat_domisili"
                        value={formData.alamat_domisili || ""}
                        onChange={(e) => setFormData({ ...formData, alamat_domisili: e.target.value })}
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provinsi</Label>
                      <Combobox
                        options={toRegionOptions(provinces)}
                        value={formData.provinsi_domisili || ""}
                        onValueChange={handleProvinceDomisiliChange}
                        placeholder="Pilih provinsi"
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kota/Kabupaten</Label>
                      <Combobox
                        options={toRegionOptions(regenciesDomisili)}
                        value={formData.kota_domisili || ""}
                        onValueChange={handleRegencyDomisiliChange}
                        placeholder="Pilih kota/kabupaten"
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kecamatan</Label>
                      <Combobox
                        options={toRegionOptions(districtsDomisili)}
                        value={formData.kecamatan_domisili || ""}
                        onValueChange={handleDistrictDomisiliChange}
                        placeholder="Pilih kecamatan"
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kelurahan</Label>
                      <Combobox
                        options={toRegionOptions(villagesDomisili)}
                        value={formData.kelurahan_domisili || ""}
                        onValueChange={(value) => setFormData({ ...formData, kelurahan_domisili: value })}
                        placeholder="Pilih kelurahan"
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rt_domisili">RT</Label>
                      <Input
                        id="rt_domisili"
                        value={formData.rt_domisili || ""}
                        onChange={(e) => setFormData({ ...formData, rt_domisili: e.target.value })}
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rw_domisili">RW</Label>
                      <Input
                        id="rw_domisili"
                        value={formData.rw_domisili || ""}
                        onChange={(e) => setFormData({ ...formData, rw_domisili: e.target.value })}
                        disabled={sameAddress}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kode_pos_domisili">Kode Pos</Label>
                      <Input
                        id="kode_pos_domisili"
                        value={formData.kode_pos_domisili || ""}
                        onChange={(e) => setFormData({ ...formData, kode_pos_domisili: e.target.value })}
                        disabled={sameAddress}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Kontak */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Kontak</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="no_hp">No. HP</Label>
                      <Input
                        id="no_hp"
                        value={formData.no_hp || ""}
                        onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Jaminan */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Jaminan</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="jenis_jaminan">Jenis Jaminan *</Label>
                      <Combobox
                        options={toOptions(masterData.insurance_type)}
                        value={formData.jenis_jaminan || "Umum"}
                        onValueChange={(value) => setFormData({ ...formData, jenis_jaminan: value as any })}
                        placeholder="Pilih jenis jaminan"
                      />
                    </div>
                    {formData.jenis_jaminan === "BPJS" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="no_bpjs">No. BPJS</Label>
                          <Input
                            id="no_bpjs"
                            value={formData.no_bpjs || ""}
                            onChange={(e) => setFormData({ ...formData, no_bpjs: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="kelas_bpjs">Kelas BPJS</Label>
                          <Combobox
                            options={toOptions(masterData.bpjs_class)}
                            value={formData.kelas_bpjs || ""}
                            onValueChange={(value) => setFormData({ ...formData, kelas_bpjs: value })}
                            placeholder="Pilih kelas BPJS"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep("search")}>
                    Kembali
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Lanjut ke Pendaftaran
                  </Button>
                </div>
              </>
            )}
          </form>
        )}

        {step === "registration" && existingPatient && (
          <form onSubmit={handleRegistration} className="space-y-6">
            {/* Patient Info Summary */}
            <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Pasien</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nama:</span>
                  <p className="font-medium">{existingPatient.nama_lengkap}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">No. RM:</span>
                  <p className="font-medium">{existingPatient.no_rm}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">NIK:</span>
                  <p className="font-medium">{existingPatient.nik || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tanggal Lahir:</span>
                  <p className="font-medium">{existingPatient.tanggal_lahir || "-"}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Registration Form */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Data Pendaftaran</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="service_type">Tipe Layanan *</Label>
                  <Combobox
                    options={[
                      { value: "rawat_jalan", label: "Rawat Jalan" },
                      { value: "gawat_darurat", label: "UGD (Gawat Darurat)" },
                      { value: "penunjang_medis", label: "Penunjang Medis" },
                      { value: "farmasi", label: "Farmasi" },
                      { value: "rawat_inap", label: "Rawat Inap" },
                    ]}
                    value={selectedServiceType}
                    onValueChange={(value) => {
                      setSelectedServiceType(value || "");
                      // Reset room selection when service type changes
                      setDestinationRoomId(null);
                      setDoctorId(null);
                      setRoomStaff([]);
                    }}
                    placeholder="Pilih tipe layanan"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="destination_room">Ruangan Tujuan *</Label>
                  <Combobox
                    options={!selectedServiceType || selectedServiceType === "all" ? [] : (rooms || [])
                      .filter(room => room.service_type === selectedServiceType)
                      .map(room => ({
                        value: room.id.toString(),
                        label: `${room.code} - ${room.name}`,
                      }))}
                    value={destinationRoomId?.toString() || ""}
                    onValueChange={handleRoomChange}
                    placeholder={!selectedServiceType || selectedServiceType === "all" ? "Pilih tipe layanan terlebih dahulu" : "Pilih ruangan tujuan"}
                    disabled={!selectedServiceType || selectedServiceType === "all"}
                  />
                </div>

                {destinationRoomId && (
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="doctor">Dokter (Opsional)</Label>
                    {roomStaff.length > 0 ? (
                      <Combobox
                        options={roomStaff.map(staff => ({
                          value: staff.employee_id.toString(),
                          label: staff.employee?.nama_lengkap || "Unknown",
                        }))}
                        value={doctorId?.toString() || ""}
                        onValueChange={(value) => setDoctorId(value ? Number(value) : null)}
                        placeholder="Pilih dokter (opsional)"
                      />
                    ) : (
                      <Input
                        disabled
                        placeholder="Tidak ada dokter di ruangan ini"
                        className="bg-muted"
                      />
                    )}
                  </div>
                )}

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="payment_method">Metode Pembayaran *</Label>
                  <Combobox
                    options={[
                      { value: "cash", label: "Tunai" },
                      { value: "bpjs", label: "BPJS" },
                      { value: "insurance", label: "Asuransi" },
                    ]}
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as any)}
                    placeholder="Pilih metode pembayaran"
                  />
                </div>

                {paymentMethod === "bpjs" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="bpjs_number">Nomor BPJS *</Label>
                      <Input
                        id="bpjs_number"
                        value={bpjsNumber}
                        onChange={(e) => setBpjsNumber(e.target.value)}
                        placeholder={existingPatient?.no_bpjs ? "Terisi dari data pasien" : "Masukkan nomor BPJS"}
                      />
                      {existingPatient?.no_bpjs && (
                        <p className="text-xs text-muted-foreground">
                          Nomor BPJS dari data pasien: {existingPatient.no_bpjs}
                        </p>
                      )}
                    </div>
                    {existingPatient?.kelas_bpjs && (
                      <div className="space-y-2">
                        <Label htmlFor="bpjs_class">Kelas BPJS</Label>
                        <Input
                          id="bpjs_class"
                          value={existingPatient.kelas_bpjs}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    )}
                  </>
                )}

                {paymentMethod === "insurance" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="insurance_name">Nama Asuransi *</Label>
                      <Combobox
                        options={toOptions(masterData.insurance_company)}
                        value={insuranceName}
                        onValueChange={(value) => setInsuranceName(value)}
                        placeholder="Pilih perusahaan asuransi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance_number">Nomor Asuransi *</Label>
                      <Input
                        id="insurance_number"
                        value={insuranceNumber}
                        onChange={(e) => setInsuranceNumber(e.target.value)}
                        placeholder="Nomor polis/kartu asuransi"
                      />
                    </div>
                  </>
                )}

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="priority">Prioritas</Label>
                  <Combobox
                    options={[
                      { value: "normal", label: "Normal" },
                      { value: "urgent", label: "Mendesak" },
                      { value: "emergency", label: "Darurat" },
                    ]}
                    value={priority}
                    onValueChange={(value) => setPriority(value as any)}
                    placeholder="Pilih prioritas"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="complaint">Keluhan</Label>
                  <Textarea
                    id="complaint"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Keluhan pasien (opsional)"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep("search")}>
                Kembali
              </Button>
              <Button type="submit" disabled={loading || loadingMaster}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Simpan Pendaftaran
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
