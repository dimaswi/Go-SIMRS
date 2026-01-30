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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { masterDataApi, regionsApi, patientsApi, roomsApi, registrationApi } from "@/lib/api";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { PatientRequest, MasterData, Province, Regency, District, Village, Patient, Room, RoomStaff } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, User, MapPin, Search, Plus, Minus, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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

  // Room procedures and medicines for supporting services
  const [roomProcedures, setRoomProcedures] = useState<RoomProcedure[]>([]);
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  const [selectedProcedures, setSelectedProcedures] = useState<{ procedure_id: number; notes: string }[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<{ 
    medicine_id: number; 
    quantity: number; 
    unit: string;
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    instructions: string;
    notes: string;
  }[]>([]);
  const [loadingRoomItems, setLoadingRoomItems] = useState(false);

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
      setSearchQuery("");
      setSearchAddress("");
      setSearchBirthDate("");
      setSearchResults([]);
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
      setRoomProcedures([]);
      setRoomMedicines([]);
      setSelectedProcedures([]);
      setSelectedMedicines([]);
    }
  }, [open]);

  const [searchAddress, setSearchAddress] = useState("");
  const [searchBirthDate, setSearchBirthDate] = useState("");

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Masukkan minimal 2 karakter untuk mencari",
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await patientsApi.search(
        searchQuery, 
        50,
        searchAddress || undefined,
        searchBirthDate || undefined
      );
      const data = response.data?.data || response.data || [];
      setSearchResults(Array.isArray(data) ? data : []);
      
      if (Array.isArray(data) && data.length === 0) {
        toast({
          title: "Tidak Ada Hasil",
          description: "Tidak ada pasien yang ditemukan dengan kata kunci tersebut",
        });
      }
    } catch (error) {
      console.error("Failed to search patients:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mencari pasien",
      });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setExistingPatient(patient);
  };

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
    setRoomProcedures([]);
    setRoomMedicines([]);
    setSelectedProcedures([]);
    setSelectedMedicines([]);
    
    // Load doctors/staff from selected room
    if (id) {
      try {
        const response = await roomsApi.getStaff(id);
        
        // Filter only doctors (employee type = dokter)
        const doctors = (response.data.data || []).filter(
          (staff: RoomStaff) => {
            return staff.employee?.tipe_karyawan === "dokter" &&
              (!staff.end_date || new Date(staff.end_date) >= new Date());
          }
        );
        setRoomStaff(doctors);
      } catch (error) {
        console.error("Failed to load room staff:", error);
      }

      // Load room procedures for penunjang_medis (lab/radiologi)
      const selectedRoom = rooms.find(r => r.id === id);
      if (selectedRoom && selectedRoom.service_type === "penunjang_medis") {
        setLoadingRoomItems(true);
        try {
          const proceduresRes = await roomProceduresApi.getByRoom(id);
          setRoomProcedures(proceduresRes.data.data || []);
        } catch (error) {
          console.error("Failed to load room procedures:", error);
          setRoomProcedures([]);
        } finally {
          setLoadingRoomItems(false);
        }
      }

      // Load room medicines for farmasi
      if (selectedRoom && selectedRoom.service_type === "farmasi") {
        setLoadingRoomItems(true);
        try {
          const medicinesRes = await roomMedicinesApi.getByRoom(id, { limit: 1000 });
          setRoomMedicines(medicinesRes.data.data || []);
        } catch (error) {
          console.error("Failed to load room medicines:", error);
          setRoomMedicines([]);
        } finally {
          setLoadingRoomItems(false);
        }
      }
    }
  };

  // Toggle procedure selection
  const toggleProcedure = (procedureId: number) => {
    setSelectedProcedures(prev => {
      const exists = prev.find(p => p.procedure_id === procedureId);
      if (exists) {
        return prev.filter(p => p.procedure_id !== procedureId);
      } else {
        return [...prev, { procedure_id: procedureId, notes: "" }];
      }
    });
  };

  // Add medicine to selection
  const addMedicine = (medicine: RoomMedicine) => {
    if (!medicine.medicine) return;
    const exists = selectedMedicines.find(m => m.medicine_id === medicine.medicine_id);
    if (!exists) {
      setSelectedMedicines(prev => [...prev, {
        medicine_id: medicine.medicine_id,
        quantity: 1,
        unit: medicine.medicine?.unit || "",
        dosage: "",
        frequency: "",
        route: "",
        duration: "",
        instructions: "",
        notes: ""
      }]);
    }
  };

  // Remove medicine from selection
  const removeMedicine = (medicineId: number) => {
    setSelectedMedicines(prev => prev.filter(m => m.medicine_id !== medicineId));
  };

  // Update medicine quantity
  const updateMedicineQuantity = (medicineId: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedMedicines(prev => prev.map(m => 
      m.medicine_id === medicineId ? { ...m, quantity } : m
    ));
  };

  const handleUseExistingPatient = async () => {
    if (!existingPatient) return;
    
    // Check if patient has unpaid registrations
    setLoading(true);
    try {
      const response = await registrationApi.getAll({
        patient_id: existingPatient.id,
        limit: 10,
      });
      
      const registrations = response.data.data || [];
      
      // Check if there's any registration that's not completed or cancelled
      const hasUnpaidRegistration = registrations.some((reg: any) => {
        // A registration is considered "unpaid" if it's not completed/discharged and doesn't have paid billing
        return reg.status !== "completed" && 
               reg.status !== "discharged" && 
               reg.status !== "cancelled";
      });
      
      if (hasUnpaidRegistration) {
        toast({
          variant: "destructive",
          title: "Tidak Dapat Mendaftar",
          description: "Pasien masih memiliki pendaftaran aktif yang belum diselesaikan. Silakan selesaikan billing pendaftaran sebelumnya terlebih dahulu.",
        });
        setLoading(false);
        return;
      }
      
      setStep("registration");
      loadReferenceData();
    } catch (error: any) {
      console.error("Error checking patient registrations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memeriksa status pendaftaran pasien",
      });
    } finally {
      setLoading(false);
    }
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

    // Validate Doctor - REQUIRED for SatuSehat
    if (!doctorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Dokter harus dipilih (wajib untuk SatuSehat)",
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
      // Prepare registration data
      const registrationData: any = {
        queue_id: queueId,
        patient_id: existingPatient.id,
        registration_type: "outpatient",
        destination_room_id: destinationRoomId,
        doctor_id: doctorId,
        payment_method: paymentMethod,
        bpjs_number: paymentMethod === "bpjs" ? bpjsNumber : undefined,
        insurance_name: paymentMethod === "insurance" ? insuranceName : undefined,
        insurance_number: paymentMethod === "insurance" ? insuranceNumber : undefined,
        complaint: complaint || undefined,
        create_visit: true,
        create_room_queue: true,
        queue_priority: priority,
      };

      // Add procedure items for penunjang_medis (lab/radiologi)
      if (selectedServiceType === "penunjang_medis" && selectedProcedures.length > 0) {
        registrationData.procedure_items = selectedProcedures;
      }

      // Add medicine items for farmasi
      if (selectedServiceType === "farmasi" && selectedMedicines.length > 0) {
        registrationData.medicine_items = selectedMedicines;
      }

      const response = await registrationApi.create(registrationData);

      const registration = response.data.data;
      
      // Try to get visit from multiple possible sources
      // Use type assertion to handle dynamic response structure
      const regData = registration as any;
      let visit = null;
      
      if (regData.visits && Array.isArray(regData.visits) && regData.visits.length > 0) {
        visit = regData.visits[0];
      } else if (regData.visit) {
        visit = regData.visit;
      }
      
      
      // Get room queue number
      let roomQueueNumber = "-";
      if (visit?.room_queue?.queue_number) {
        roomQueueNumber = visit.room_queue.queue_number;
      }
      
      const roomName = registration.destination_room?.name || "";
      
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
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] flex flex-col p-6 m-0 rounded-none">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Pendaftaran Pasien - Antrean {queueNumber}</DialogTitle>
          <DialogDescription>
            {step === "search" 
              ? "Cari nomor rekam medis pasien atau daftarkan pasien baru"
              : step === "registration"
              ? "Lengkapi data pendaftaran"
              : "Lengkapi data pasien baru"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">{/* Scrollable content */}

        {step === "search" && (
          <div className="space-y-4 flex flex-col h-full">
            {/* Search Bar */}
            <div className="space-y-2 flex-shrink-0">
              <Label>Cari Pasien</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Cari Nama, NIK, No. RM, BPJS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Filter Alamat..."
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="flex-1"
                />
                <Input
                  type="date"
                  placeholder="Tanggal Lahir..."
                  value={searchBirthDate}
                  onChange={(e) => setSearchBirthDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="w-[180px]"
                />
                {(searchAddress || searchBirthDate) && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSearchAddress("");
                      setSearchBirthDate("");
                    }}
                  >
                    Reset
                  </Button>
                )}
                <Button onClick={handleSearch} disabled={searchLoading}>
                  {searchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Cari</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ketik minimal 2 karakter pada pencarian, gunakan filter alamat dan tanggal lahir untuk hasil lebih spesifik
              </p>
            </div>

            {/* Table Results */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              {searchLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="overflow-auto max-h-[calc(100vh-300px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Pilih</TableHead>
                        <TableHead>No. RM</TableHead>
                        <TableHead>Nama Lengkap</TableHead>
                        <TableHead>NIK</TableHead>
                        <TableHead>No. BPJS</TableHead>
                        <TableHead>Jenis Kelamin</TableHead>
                        <TableHead>Tanggal Lahir</TableHead>
                        <TableHead>Alamat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className={existingPatient?.id === patient.id ? "bg-primary/10" : "cursor-pointer hover:bg-muted/50"}
                          onClick={() => handleSelectPatient(patient)}
                        >
                          <TableCell className="text-center">
                            <input
                              type="radio"
                              name="patient-select"
                              checked={existingPatient?.id === patient.id}
                              onChange={() => handleSelectPatient(patient)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{patient.no_rm}</TableCell>
                          <TableCell className="font-medium">{patient.nama_lengkap}</TableCell>
                          <TableCell>{patient.nik || "-"}</TableCell>
                          <TableCell>{patient.no_bpjs || "-"}</TableCell>
                          <TableCell>{patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</TableCell>
                          <TableCell>{patient.tanggal_lahir || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {patient.alamat_domisili || patient.alamat_ktp || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <User className="h-12 w-12 mb-2" />
                  <p>Gunakan pencarian untuk menemukan pasien</p>
                  <p className="text-sm">atau klik tombol "Pasien Baru" di bawah</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 flex-shrink-0 pt-2 border-t">
              <Button onClick={handleNewPatient} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Pasien Baru
              </Button>
              {existingPatient && (
                <Button onClick={handleUseExistingPatient} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Gunakan Pasien: {existingPatient.nama_lengkap}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {loadingMaster && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!loadingMaster && (
              <Tabs defaultValue="identitas" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="identitas">Identitas</TabsTrigger>
                  <TabsTrigger value="alamat">Alamat</TabsTrigger>
                  <TabsTrigger value="kontak">Kontak</TabsTrigger>
                  <TabsTrigger value="jaminan">Jaminan</TabsTrigger>
                </TabsList>

                {/* Tab Identitas */}
                <TabsContent value="identitas" className="space-y-4 mt-4">
                  <div className="grid grid-cols-4 gap-4">
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
                </TabsContent>

                {/* Tab Alamat */}
                <TabsContent value="alamat" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Alamat KTP */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2 pb-2 border-b">
                        <MapPin className="h-4 w-4" />
                        Alamat KTP
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="alamat_ktp" className="text-xs">Alamat</Label>
                          <Textarea
                            id="alamat_ktp"
                            value={formData.alamat_ktp || ""}
                            onChange={(e) => setFormData({ ...formData, alamat_ktp: e.target.value })}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Provinsi</Label>
                        <Combobox
                          options={toRegionOptions(provinces)}
                          value={formData.provinsi_ktp || ""}
                          onValueChange={handleProvinceKTPChange}
                          placeholder="Pilih provinsi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kota/Kabupaten</Label>
                        <Combobox
                          options={toRegionOptions(regenciesKTP)}
                          value={formData.kota_ktp || ""}
                          onValueChange={handleRegencyKTPChange}
                          placeholder="Pilih kota"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kecamatan</Label>
                        <Combobox
                          options={toRegionOptions(districtsKTP)}
                          value={formData.kecamatan_ktp || ""}
                          onValueChange={handleDistrictKTPChange}
                          placeholder="Pilih kecamatan"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kelurahan</Label>
                        <Combobox
                          options={toRegionOptions(villagesKTP)}
                          value={formData.kelurahan_ktp || ""}
                          onValueChange={(value) => setFormData({ ...formData, kelurahan_ktp: value })}
                          placeholder="Pilih kelurahan"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rt_ktp" className="text-xs">RT</Label>
                        <Input
                          id="rt_ktp"
                          value={formData.rt_ktp || ""}
                          onChange={(e) => setFormData({ ...formData, rt_ktp: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rw_ktp" className="text-xs">RW</Label>
                        <Input
                          id="rw_ktp"
                          value={formData.rw_ktp || ""}
                          onChange={(e) => setFormData({ ...formData, rw_ktp: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>{/* End grid KTP */}
                  </div>{/* End Alamat KTP */}

                    {/* Alamat Domisili */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Alamat Domisili
                        </h4>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="same-address"
                            checked={sameAddress}
                            onCheckedChange={handleSameAddressChange}
                          />
                          <Label htmlFor="same-address" className="cursor-pointer text-xs">
                            Sama dengan KTP
                          </Label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="alamat_domisili" className="text-xs">Alamat</Label>
                          <Textarea
                            id="alamat_domisili"
                            value={formData.alamat_domisili || ""}
                            onChange={(e) => setFormData({ ...formData, alamat_domisili: e.target.value })}
                            disabled={sameAddress}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Provinsi</Label>
                        <Combobox
                          options={toRegionOptions(provinces)}
                          value={formData.provinsi_domisili || ""}
                          onValueChange={handleProvinceDomisiliChange}
                          placeholder="Pilih provinsi"
                          disabled={sameAddress}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kota/Kabupaten</Label>
                        <Combobox
                          options={toRegionOptions(regenciesDomisili)}
                          value={formData.kota_domisili || ""}
                          onValueChange={handleRegencyDomisiliChange}
                          placeholder="Pilih kota"
                          disabled={sameAddress}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kecamatan</Label>
                        <Combobox
                          options={toRegionOptions(districtsDomisili)}
                          value={formData.kecamatan_domisili || ""}
                          onValueChange={handleDistrictDomisiliChange}
                          placeholder="Pilih kecamatan"
                          disabled={sameAddress}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Kelurahan</Label>
                        <Combobox
                          options={toRegionOptions(villagesDomisili)}
                          value={formData.kelurahan_domisili || ""}
                          onValueChange={(value) => setFormData({ ...formData, kelurahan_domisili: value })}
                          placeholder="Pilih kelurahan"
                          disabled={sameAddress}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rt_domisili" className="text-xs">RT</Label>
                        <Input
                          id="rt_domisili"
                          value={formData.rt_domisili || ""}
                          onChange={(e) => setFormData({ ...formData, rt_domisili: e.target.value })}
                          disabled={sameAddress}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rw_domisili" className="text-xs">RW</Label>
                        <Input
                          id="rw_domisili"
                          value={formData.rw_domisili || ""}
                          onChange={(e) => setFormData({ ...formData, rw_domisili: e.target.value })}
                          disabled={sameAddress}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>{/* End Alamat Domisili */}
                  </div>{/* End grid 2 kolom alamat */}
                </TabsContent>

                {/* Tab Kontak */}
                <TabsContent value="kontak" className="space-y-4 mt-4">
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
                </TabsContent>

                {/* Tab Jaminan */}
                <TabsContent value="jaminan" className="space-y-4 mt-4">
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
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
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
          </form>
        )}

        {step === "registration" && existingPatient && (
          <form onSubmit={handleRegistration} className="space-y-4">
            {/* Patient Info Summary */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Nama:</span>
                  <p className="font-medium text-sm">{existingPatient.nama_lengkap}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">No. RM:</span>
                  <p className="font-medium text-sm">{existingPatient.no_rm}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">NIK:</span>
                  <p className="font-medium text-sm">{existingPatient.nik || "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tgl Lahir:</span>
                  <p className="font-medium text-sm">{existingPatient.tanggal_lahir || "-"}</p>
                </div>
              </div>
            </div>

            {/* Registration Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_type" className="text-sm">Tipe Layanan *</Label>
                  <Combobox
                    options={[
                      { value: "rawat_jalan", label: "Rawat Jalan" },
                      { value: "penunjang_medis", label: "Penunjang Medis" },
                      { value: "farmasi", label: "Farmasi" },
                    ]}
                    value={selectedServiceType}
                    onValueChange={(value) => {
                      setSelectedServiceType(value || "");
                      setDestinationRoomId(null);
                      setDoctorId(null);
                      setRoomStaff([]);
                      setRoomProcedures([]);
                      setRoomMedicines([]);
                      setSelectedProcedures([]);
                      setSelectedMedicines([]);
                    }}
                    placeholder="Pilih tipe layanan"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination_room" className="text-sm">Ruangan Tujuan *</Label>
                  <Combobox
                    options={!selectedServiceType || selectedServiceType === "all" ? [] : (rooms || [])
                      .filter(room => room.service_type === selectedServiceType)
                      .map(room => ({
                        value: room.id.toString(),
                        label: `${room.code} - ${room.name}`,
                      }))}
                    value={destinationRoomId?.toString() || ""}
                    onValueChange={handleRoomChange}
                    placeholder={!selectedServiceType ? "Pilih tipe layanan dulu" : "Pilih ruangan"}
                    disabled={!selectedServiceType || selectedServiceType === "all"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method" className="text-sm">Metode Pembayaran *</Label>
                  <Combobox
                    options={[
                      { value: "cash", label: "Tunai" },
                      { value: "bpjs", label: "BPJS" },
                      { value: "insurance", label: "Asuransi" },
                    ]}
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as any)}
                    placeholder="Pilih metode"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm">Prioritas</Label>
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

                {destinationRoomId && (
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="doctor" className="text-sm">Dokter *</Label>
                    {roomStaff.length > 0 ? (
                      <Combobox
                        options={roomStaff.map(staff => ({
                          value: staff.employee_id.toString(),
                          label: staff.employee?.nama_lengkap || "Unknown",
                        }))}
                        value={doctorId?.toString() || ""}
                        onValueChange={(value) => setDoctorId(value ? Number(value) : null)}
                        placeholder="Pilih dokter"
                      />
                    ) : (
                      <Input
                        disabled
                        placeholder="Tidak ada dokter"
                        className="bg-muted text-sm"
                      />
                    )}
                  </div>
                )}

                {paymentMethod === "bpjs" && (
                  <div className="col-span-3 grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="bpjs_number" className="text-sm">Nomor BPJS *</Label>
                      <Input
                        id="bpjs_number"
                        value={bpjsNumber}
                        onChange={(e) => setBpjsNumber(e.target.value)}
                        placeholder={existingPatient?.no_bpjs || "Nomor BPJS"}
                        className="text-sm"
                      />
                    </div>
                    {existingPatient?.kelas_bpjs && (
                      <div className="space-y-2">
                        <Label htmlFor="bpjs_class" className="text-sm">Kelas</Label>
                        <Input
                          id="bpjs_class"
                          value={existingPatient.kelas_bpjs}
                          disabled
                          className="bg-muted text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "insurance" && (
                  <div className="col-span-3 grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="insurance_name" className="text-sm">Nama Asuransi *</Label>
                      <Combobox
                        options={toOptions(masterData.insurance_company)}
                        value={insuranceName}
                        onValueChange={(value) => setInsuranceName(value)}
                        placeholder="Pilih asuransi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance_number" className="text-sm">Nomor Polis *</Label>
                      <Input
                        id="insurance_number"
                        value={insuranceNumber}
                        onChange={(e) => setInsuranceNumber(e.target.value)}
                        placeholder="Nomor polis"
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="col-span-3 space-y-2">
                  <Label htmlFor="complaint" className="text-sm">Keluhan (Opsional)</Label>
                  <Textarea
                    id="complaint"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Keluhan pasien"
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Procedure Selection for Penunjang Medis (Lab/Radiologi) */}
                {selectedServiceType === "penunjang_medis" && destinationRoomId && (
                  <div className="col-span-3 space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Pilih Tindakan *</Label>
                    {loadingRoomItems ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Memuat tindakan...</span>
                      </div>
                    ) : roomProcedures.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {roomProcedures.filter(rp => rp.is_available && rp.procedure).map((rp) => {
                            const isSelected = selectedProcedures.some(p => p.procedure_id === rp.procedure_id);
                            return (
                              <div
                                key={rp.id}
                                className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-primary/10 border-primary"
                                    : "hover:bg-muted"
                                }`}
                                onClick={() => toggleProcedure(rp.procedure_id)}
                              >
                                <div className={`h-4 w-4 rounded-sm border flex items-center justify-center ${
                                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                                }`}>
                                  {isSelected && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{rp.procedure?.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{rp.procedure?.code}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedProcedures.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground">Terpilih:</span>
                            {selectedProcedures.map(sp => {
                              const proc = roomProcedures.find(rp => rp.procedure_id === sp.procedure_id)?.procedure;
                              return proc ? (
                                <Badge key={sp.procedure_id} variant="secondary" className="text-xs">
                                  {proc.name}
                                  <X 
                                    className="ml-1 h-3 w-3 cursor-pointer" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleProcedure(sp.procedure_id);
                                    }}
                                  />
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        Tidak ada tindakan yang tersedia di ruangan ini. Silakan hubungi administrator untuk menambahkan tindakan.
                      </p>
                    )}
                  </div>
                )}

                {/* Medicine Selection for Farmasi */}
                {selectedServiceType === "farmasi" && destinationRoomId && (
                  <div className="col-span-3 space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Pilih Obat *</Label>
                    {loadingRoomItems ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Memuat obat...</span>
                      </div>
                    ) : roomMedicines.length > 0 ? (
                      <div className="space-y-3">
                        {/* Available Medicines */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Obat Tersedia</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border rounded-lg p-3">
                            {roomMedicines.filter(rm => rm.medicine && rm.quantity > 0).map((rm) => (
                              <div
                                key={rm.id}
                                className={`flex items-center justify-between gap-2 p-2 border rounded cursor-pointer transition-colors ${
                                  selectedMedicines.some(m => m.medicine_id === rm.medicine_id)
                                    ? "bg-green-50 border-green-300"
                                    : "hover:bg-muted"
                                }`}
                                onClick={() => addMedicine(rm)}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{rm.medicine?.name}</p>
                                  <p className="text-xs text-muted-foreground">Stok: {rm.quantity} {rm.medicine?.unit}</p>
                                </div>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Selected Medicines */}
                        {selectedMedicines.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Obat Dipilih ({selectedMedicines.length})</Label>
                            <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                              {selectedMedicines.map((sm) => {
                                const med = roomMedicines.find(rm => rm.medicine_id === sm.medicine_id)?.medicine;
                                return med ? (
                                  <div key={sm.medicine_id} className="flex items-center gap-3 p-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{med.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => updateMedicineQuantity(sm.medicine_id, sm.quantity - 1)}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        value={sm.quantity}
                                        onChange={(e) => updateMedicineQuantity(sm.medicine_id, parseInt(e.target.value) || 1)}
                                        className="w-14 h-6 text-center text-sm"
                                        min={1}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => updateMedicineQuantity(sm.medicine_id, sm.quantity + 1)}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                      <span className="text-xs text-muted-foreground w-12">{med.unit}</span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => removeMedicine(sm.medicine_id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        Tidak ada obat yang tersedia di ruangan ini. Silakan hubungi administrator untuk menambahkan stok obat.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setStep("search")} size="sm">
                Kembali
              </Button>
              <Button type="submit" disabled={loading || loadingMaster} size="sm">
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
        </div>{/* End scrollable content */}
      </DialogContent>
    </Dialog>
  );
}
