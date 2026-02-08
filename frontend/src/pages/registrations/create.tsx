import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { patientsApi, roomsApi, registrationApi, api } from "@/lib/api";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { Patient, Room, RoomStaff } from "@/lib/api";
import { ArrowLeft, Loader2, UserPlus, User, Search, Plus, Minus, X, FileText, CheckCircle2 } from "lucide-react";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";

export default function RegistrationCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step: search or registration
  const [step, setStep] = useState<"search" | "registration">("search");
  const [existingPatient, setExistingPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [searchBirthDate, setSearchBirthDate] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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

  // SEP BPJS
  const [sepSheetOpen, setSepSheetOpen] = useState(false);
  const [sepNumber, setSepNumber] = useState("");
  const [sepData, setSepData] = useState<any>(null);

  // Master data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStaff, setRoomStaff] = useState<RoomStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

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

  useEffect(() => {
    setPageTitle("Pendaftaran Baru");
  }, []);

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

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const response = await roomsApi.getAll({ limit: 1000, is_active: "true" });
      const allRooms = response.data.data || [];
      const filteredRooms = allRooms.filter(
        (room: Room) =>
          room.room_type !== "depo_farmasi" &&
          room.room_type !== "gudang_farmasi" &&
          room.is_active === true
      );
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleUseExistingPatient = async (patientToUse?: Patient) => {
    const patient = patientToUse || existingPatient;
    if (!patient) return;

    // Set the patient if passed directly (for double-click)
    if (patientToUse) {
      setExistingPatient(patientToUse);
    }

    // Check if patient has active registrations
    setLoading(true);
    try {
      const response = await registrationApi.getAll({
        patient_id: patient.id,
        limit: 10,
      });

      const registrations = response.data.data || [];
      const hasActiveRegistration = registrations.some((reg: any) => {
        return reg.status !== "completed" &&
          reg.status !== "discharged" &&
          reg.status !== "cancelled";
      });

      if (hasActiveRegistration) {
        toast({
          variant: "destructive",
          title: "Tidak Dapat Mendaftar",
          description: "Pasien masih memiliki pendaftaran aktif yang belum diselesaikan.",
        });
        setLoading(false);
        return;
      }

      setStep("registration");
      loadRooms();
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

  const handleRoomChange = async (roomId: string) => {
    const id = Number(roomId);
    setDestinationRoomId(id);
    setDoctorId(null);
    setRoomStaff([]);
    setRoomProcedures([]);
    setRoomMedicines([]);
    setSelectedProcedures([]);
    setSelectedMedicines([]);

    if (id) {
      try {
        const response = await roomsApi.getStaff(id);
        const doctors = (response.data.data || []).filter(
          (staff: RoomStaff) =>
            staff.employee?.tipe_karyawan === "dokter" &&
            (!staff.end_date || new Date(staff.end_date) >= new Date())
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

  // Auto-load BPJS data when payment method is BPJS
  useEffect(() => {
    if (paymentMethod === "bpjs" && existingPatient) {
      if (existingPatient.no_bpjs) {
        setBpjsNumber(existingPatient.no_bpjs);
        
        // Cek SEP lokal berdasarkan no_kartu (hanya yang aktif)
        const checkLocalSEP = async () => {
          try {
            const res = await api.get(`/bpjs/vclaim/sep/list?no_kartu=${existingPatient.no_bpjs}&status=active&limit=1`);
            const seps = res.data.data || [];
            if (seps.length > 0) {
              const latestSEP = seps[0];
              setSepNumber(latestSEP.no_sep);
              setSepData({
                poli: { nama: latestSEP.nama_poli || "-" },
                dokter: { nama: latestSEP.nama_dpjp || "-" },
                diagnosa: { nama: latestSEP.nama_diagnosa || "-" },
              });
            }
          } catch (error) {
            console.log("No local SEP found");
          }
        };
        checkLocalSEP();
      }
    }
  }, [paymentMethod, existingPatient]);

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

    if (paymentMethod === "bpjs" && !bpjsNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nomor BPJS harus diisi",
      });
      return;
    }

    if (paymentMethod === "insurance" && (!insuranceName || !insuranceNumber)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nama dan nomor asuransi harus diisi",
      });
      return;
    }

    // Validasi SEP untuk BPJS (opsional, bisa diwajibkan dengan uncomment)
    // if (paymentMethod === "bpjs" && !sepNumber) {
    //   toast({
    //     variant: "destructive",
    //     title: "Error",
    //     description: "SEP harus dibuat untuk pasien BPJS",
    //   });
    //   return;
    // }

    setLoading(true);
    try {
      // UGD dan Rawat Inap tidak perlu antrian ruangan
      const needsRoomQueue = selectedServiceType !== "gawat_darurat" && selectedServiceType !== "rawat_inap";
      
      // Prepare registration data
      const registrationData: any = {
        patient_id: existingPatient.id,
        registration_type: selectedServiceType === "rawat_inap" ? "inpatient" : "outpatient",
        destination_room_id: destinationRoomId,
        doctor_id: doctorId,
        payment_method: paymentMethod,
        bpjs_number: paymentMethod === "bpjs" ? bpjsNumber : undefined,
        insurance_name: paymentMethod === "insurance" ? insuranceName : undefined,
        insurance_number: paymentMethod === "insurance" ? insuranceNumber : undefined,
        complaint: complaint || undefined,
        create_visit: true,
        create_room_queue: needsRoomQueue,
        queue_priority: priority,
        // SEP data for BPJS
        sep_number: paymentMethod === "bpjs" && sepNumber ? sepNumber : undefined,
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
      const regData = registration as any;
      let visit = null;

      if (regData.visits && Array.isArray(regData.visits) && regData.visits.length > 0) {
        visit = regData.visits[0];
      } else if (regData.visit) {
        visit = regData.visit;
      }

      let roomQueueNumber = "";
      if (needsRoomQueue && visit?.room_queue?.queue_number) {
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
            {roomQueueNumber && (
              <p className="text-lg font-bold">Nomor Antrian Ruangan: {roomQueueNumber}</p>
            )}
            {sepNumber && (
              <p>No. SEP: {sepNumber}</p>
            )}
          </div>
        ),
        duration: 10000,
      });

      navigate("/registrations");
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => step === "registration" ? setStep("search") : navigate("/registrations")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pendaftaran Pasien
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "search"
              ? "Cari pasien berdasarkan Nama, NIK, No. RM, atau No. BPJS"
              : "Lengkapi data pendaftaran"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6 w-full">
          {step === "search" && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="space-y-2">
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
              <div className="border rounded-lg overflow-hidden">
                {searchLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="overflow-auto max-h-[400px]">
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
                            onDoubleClick={() => handleUseExistingPatient(patient)}
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
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button onClick={() => navigate("/patients/create")} variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Pasien Baru
                </Button>
                {existingPatient && (
                  <Button onClick={() => handleUseExistingPatient()} disabled={loading}>
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

              {/* Registration Form - 3 columns */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="service_type" className="text-sm">Tipe Layanan *</Label>
                    <Combobox
                      options={[
                        { value: "rawat_jalan", label: "Rawat Jalan" },
                        { value: "gawat_darurat", label: "UGD" },
                        { value: "rawat_inap", label: "Rawat Inap" },
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
                      options={!selectedServiceType ? [] : (rooms || [])
                        .filter(room => room.service_type === selectedServiceType)
                        .map(room => ({
                          value: room.id.toString(),
                          label: `${room.code} - ${room.name}`,
                        }))}
                      value={destinationRoomId?.toString() || ""}
                      onValueChange={handleRoomChange}
                      placeholder={!selectedServiceType ? "Pilih tipe layanan dulu" : "Pilih ruangan"}
                      disabled={!selectedServiceType}
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
                    <div className="col-span-2 space-y-2">
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
                    <div className="col-span-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
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

                      {/* SEP Section */}
                      <div className="border rounded-lg p-3 bg-blue-50/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">SEP (Surat Eligibilitas Peserta)</span>
                          </div>
                          {sepNumber ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {sepNumber}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Belum Ada
                            </Badge>
                          )}
                        </div>
                        
                        {sepNumber && sepData ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p>Poli: {sepData.poli?.nama || "-"}</p>
                            <p>Dokter: {sepData.dokter?.nama || "-"}</p>
                            <p>Diagnosa: {sepData.diagnosa?.nama || "-"}</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            SEP wajib dibuat untuk pasien BPJS
                          </p>
                        )}
                        
                        <Button
                          type="button"
                          variant={sepNumber ? "outline" : "default"}
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => setSepSheetOpen(true)}
                          disabled={!bpjsNumber}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {sepNumber ? "Lihat / Edit SEP" : "Buat SEP"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "insurance" && (
                    <div className="col-span-3 grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="insurance_name" className="text-sm">Nama Asuransi *</Label>
                        <Input
                          id="insurance_name"
                          value={insuranceName}
                          onChange={(e) => setInsuranceName(e.target.value)}
                          placeholder="Nama asuransi"
                          className="text-sm"
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
                <Button type="submit" disabled={loading || loadingRooms} size="sm">
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
      </div>

      {/* SEP Form Sheet */}
      {existingPatient && (
        <SEPFormSheet
          open={sepSheetOpen}
          onOpenChange={setSepSheetOpen}
          patient={{
            id: existingPatient.id,
            no_rm: existingPatient.no_rm,
            nama_lengkap: existingPatient.nama_lengkap,
            nik: existingPatient.nik,
            no_bpjs: bpjsNumber || existingPatient.no_bpjs,
            tanggal_lahir: existingPatient.tanggal_lahir,
            jenis_kelamin: existingPatient.jenis_kelamin,
            no_telepon: existingPatient.no_telepon,
            kelas_bpjs: existingPatient.kelas_bpjs,
          }}
          registrationId={undefined} // Will be set after registration is created
          initialValues={{
            jenisPelayanan: selectedServiceType === "rawat_inap" ? "1" : "2",
          }}
          onSEPCreated={(noSEP, data) => {
            setSepNumber(noSEP);
            setSepData(data);
          }}
        />
      )}
    </div>
  );
}
