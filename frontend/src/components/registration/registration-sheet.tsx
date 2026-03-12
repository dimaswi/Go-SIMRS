import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { roomsApi, registrationApi, api } from "@/lib/api";
import { formatPatientName } from "@/lib/print-utils";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { Patient, Room, RoomStaff } from "@/lib/api";
import { Loader2, UserPlus, User, FileText, CheckCircle2, Plus, Minus, X, AlertCircle, ExternalLink } from "lucide-react";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { useNavigate } from "react-router-dom";

interface RegistrationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onSuccess?: () => void;
  onSEPCreated?: () => void;
}

export function RegistrationSheet({ open, onOpenChange, patient, onSuccess, onSEPCreated }: RegistrationSheetProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Registration data
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [destinationRoomId, setDestinationRoomId] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bpjs" | "insurance">("cash");
  const [bpjsNumber, setBpjsNumber] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [complaint, setComplaint] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent" | "emergency">("normal");

  // SEP BPJS
  const [sepSheetOpen, setSepSheetOpen] = useState(false);
  const [sepNumber, setSepNumber] = useState("");
  const [sepData, setSepData] = useState<any>(null);

  // Master data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStaff, setRoomStaff] = useState<RoomStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);

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

  // Active registration state
  const [hasActiveRegistration, setHasActiveRegistration] = useState(false);
  const [activeRegistration, setActiveRegistration] = useState<any>(null);

  // Check active registration and load rooms when sheet opens
  useEffect(() => {
    if (open && patient) {
      checkActiveRegistration();
      loadRooms();

      // Pre-fill BPJS number if available
      if (patient.no_bpjs) {
        setBpjsNumber(patient.no_bpjs);
        setPaymentMethod("bpjs");
      }
    }
  }, [open, patient]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setSelectedServiceType("");
      setDestinationRoomId(null);
      setDoctorId(null);
      setPaymentMethod(patient?.no_bpjs ? "bpjs" : "cash");
      setBpjsNumber(patient?.no_bpjs || "");
      setInsuranceName("");
      setInsuranceNumber("");
      setComplaint("");
      setPriority("normal");
      setSepNumber("");
      setSepData(null);
      setRoomStaff([]);
      setRoomProcedures([]);
      setRoomMedicines([]);
      setSelectedProcedures([]);
      setSelectedMedicines([]);
      setHasActiveRegistration(false);
      setActiveRegistration(null);
    }
  }, [open, patient]);

  // Auto-load SEP data when payment method is BPJS
  useEffect(() => {
    if (paymentMethod === "bpjs" && patient && bpjsNumber) {
      const checkLocalSEP = async () => {
        try {
          const res = await api.get(`/bpjs/vclaim/sep/list?no_kartu=${bpjsNumber}&limit=10`);
          const seps = res.data.data || [];
          // Filter hanya SEP yang aktif (bukan yang sudah dihapus)
          const activeSeps = seps.filter((s: any) => s.status !== "deleted");
          if (activeSeps.length > 0) {
            const latestSEP = activeSeps[0];
            setSepNumber(latestSEP.no_sep);
            setSepData({
              poli: { nama: latestSEP.nama_poli },
              dokter: { nama: latestSEP.nama_dpjp },
              diagnosa: { nama: latestSEP.nama_diagnosa },
            });
          }
        } catch (error) {
          console.log("No local SEP found");
        }
      };
      checkLocalSEP();
    }
  }, [paymentMethod, patient, bpjsNumber]);

  const checkActiveRegistration = async () => {
    setCheckingRegistration(true);
    setHasActiveRegistration(false);
    setActiveRegistration(null);
    try {
      const response = await registrationApi.getAll({
        patient_id: patient.id,
        limit: 10,
      });

      const registrations = response.data.data || [];
      const activeReg = registrations.find((reg: any) => {
        return reg.status !== "completed" &&
          reg.status !== "discharged" &&
          reg.status !== "cancelled";
      });

      if (activeReg) {
        setHasActiveRegistration(true);
        setActiveRegistration(activeReg);
        return;
      }
    } catch (error: any) {
      console.error("Error checking patient registrations:", error);
    } finally {
      setCheckingRegistration(false);
    }
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

  const handleServiceTypeChange = (value: string) => {
    setSelectedServiceType(value || "");
    setDestinationRoomId(null);
    setDoctorId(null);
    setRoomStaff([]);
    setRoomProcedures([]);
    setRoomMedicines([]);
    setSelectedProcedures([]);
    setSelectedMedicines([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedServiceType) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih tipe layanan",
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

    setLoading(true);
    try {
      // UGD dan Rawat Inap tidak perlu antrian ruangan
      const needsRoomQueue = selectedServiceType !== "gawat_darurat" && selectedServiceType !== "rawat_inap";

      // Prepare registration data
      const registrationData: any = {
        patient_id: patient.id,
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
            <p className="font-semibold">Pasien: {formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</p>
            <p>No. RM: {patient.no_rm}</p>
            <p>Ruangan: {roomName}</p>
            {roomQueueNumber && (
              <p className="text-lg font-bold">Nomor Antrian: {roomQueueNumber}</p>
            )}
            {sepNumber && (
              <p>No. SEP: {sepNumber}</p>
            )}
          </div>
        ),
        duration: 10000,
      });

      onOpenChange(false);
      onSuccess?.();
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

  // Filter rooms by service type
  const filteredRooms = selectedServiceType
    ? rooms.filter(room => room.service_type === selectedServiceType)
    : [];

  if (checkingRegistration) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%]">
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Memeriksa status pendaftaran...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Show active registration info if patient already registered
  if (hasActiveRegistration && activeRegistration) {
    const getStatusLabel = (status: string) => {
      switch (status) {
        case "waiting": return "Menunggu";
        case "in_progress": return "Sedang Berlangsung";
        case "registered": return "Terdaftar";
        case "in_queue": return "Dalam Antrian";
        default: return status;
      }
    };

    const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
      switch (status) {
        case "waiting": return "outline";
        case "in_progress": return "secondary";
        case "registered": return "default";
        case "in_queue": return "outline";
        default: return "outline";
      }
    };

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Pasien Sudah Terdaftar
            </SheetTitle>
            <SheetDescription>
              Pasien ini masih memiliki pendaftaran aktif yang belum diselesaikan
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Patient Info Card */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {patient.foto ? (
                    <img
                      src={`/${patient.foto}`}
                      alt={patient.nama_lengkap}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</h4>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-mono font-medium text-foreground">{patient.no_rm}</span>
                    {" • "}
                    {patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Registration Info */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-orange-700 dark:text-orange-400">
                  Pendaftaran Aktif
                </h4>
                <Badge variant={getStatusVariant(activeRegistration.status)}>
                  {getStatusLabel(activeRegistration.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">No. Registrasi</label>
                  <p className="font-mono font-medium">{activeRegistration.registration_number || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tanggal</label>
                  <p className="font-medium">
                    {(activeRegistration.CreatedAt || activeRegistration.created_at || activeRegistration.registration_date)
                      ? new Date(activeRegistration.CreatedAt || activeRegistration.created_at || activeRegistration.registration_date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ruangan Tujuan</label>
                  <p className="font-medium">{activeRegistration.destination_room?.name || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dokter</label>
                  <p className="font-medium">{activeRegistration.doctor?.nama_lengkap || activeRegistration.doctor?.name || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Metode Pembayaran</label>
                  <p className="font-medium uppercase">{activeRegistration.payment_method || "-"}</p>
                </div>
                {activeRegistration.sep_number && (
                  <div>
                    <label className="text-xs text-muted-foreground">No. SEP</label>
                    <p className="font-mono font-medium">{activeRegistration.sep_number}</p>
                  </div>
                )}
              </div>

              {activeRegistration.complaint && (
                <div>
                  <label className="text-xs text-muted-foreground">Keluhan</label>
                  <p className="text-sm">{activeRegistration.complaint}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/registrations/${activeRegistration.ID || activeRegistration.id}`);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Lihat Detail Pendaftaran
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Tutup
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Untuk membuat pendaftaran baru, selesaikan atau batalkan pendaftaran aktif terlebih dahulu.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Pendaftaran Pasien
            </SheetTitle>
            <SheetDescription>
              Buat pendaftaran baru untuk pasien
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {/* Patient Info Card */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {patient.foto ? (
                    <img
                      src={`/${patient.foto}`}
                      alt={patient.nama_lengkap}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-1">
                    <div>
                      <span className="block">No. RM:</span>
                      <span className="font-mono font-medium text-foreground">{patient.no_rm}</span>
                    </div>
                    <div>
                      <span className="block">NIK:</span>
                      <span className="font-medium text-foreground">{patient.nik || "-"}</span>
                    </div>
                    <div>
                      <span className="block">Tgl Lahir:</span>
                      <span className="font-medium text-foreground">{patient.tanggal_lahir || "-"}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline">{patient.status}</Badge>
              </div>
            </div>

            {/* Registration Form - Grid Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tipe Layanan */}
              <div className="space-y-2">
                <Label className="text-sm">Tipe Layanan *</Label>
                <Combobox
                  options={[
                    { value: "rawat_jalan", label: "Rawat Jalan" },
                    { value: "gawat_darurat", label: "UGD" },
                    { value: "rawat_inap", label: "Rawat Inap" },
                    { value: "penunjang_medis", label: "Penunjang Medis" },
                    { value: "farmasi", label: "Farmasi" },
                  ]}
                  value={selectedServiceType}
                  onValueChange={handleServiceTypeChange}
                  placeholder="Pilih tipe layanan"
                />
              </div>

              {/* Ruangan Tujuan */}
              <div className="space-y-2">
                <Label className="text-sm">Ruangan Tujuan *</Label>
                <Combobox
                  options={filteredRooms.map(room => ({
                    value: room.id.toString(),
                    label: `${room.code} - ${room.name}`,
                  }))}
                  value={destinationRoomId?.toString() || ""}
                  onValueChange={handleRoomChange}
                  placeholder={!selectedServiceType ? "Pilih tipe layanan dulu" : "Pilih ruangan"}
                  disabled={!selectedServiceType}
                  loading={loadingRooms}
                />
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-2">
                <Label className="text-sm">Metode Pembayaran *</Label>
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

              {/* Prioritas */}
              <div className="space-y-2">
                <Label className="text-sm">Prioritas</Label>
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

              {/* Dokter */}
              {destinationRoomId && (
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm">Dokter *</Label>
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
                      placeholder="Tidak ada dokter di ruangan ini"
                      className="bg-muted text-sm"
                    />
                  )}
                </div>
              )}

              {/* BPJS Fields */}
              {paymentMethod === "bpjs" && (
                <div className="col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Nomor BPJS *</Label>
                      <Input
                        value={bpjsNumber}
                        onChange={(e) => setBpjsNumber(e.target.value)}
                        placeholder={patient?.no_bpjs || "Nomor BPJS"}
                        className="text-sm"
                      />
                    </div>
                    {patient?.kelas_bpjs && (
                      <div className="space-y-2">
                        <Label className="text-sm">Kelas</Label>
                        <Input
                          value={patient.kelas_bpjs}
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

              {/* Insurance Fields */}
              {paymentMethod === "insurance" && (
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Nama Asuransi *</Label>
                    <Input
                      value={insuranceName}
                      onChange={(e) => setInsuranceName(e.target.value)}
                      placeholder="Nama asuransi"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Nomor Polis *</Label>
                    <Input
                      value={insuranceNumber}
                      onChange={(e) => setInsuranceNumber(e.target.value)}
                      placeholder="Nomor polis"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Keluhan */}
              <div className="col-span-2 space-y-2">
                <Label className="text-sm">Keluhan (Opsional)</Label>
                <Textarea
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="Keluhan pasien"
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Procedure Selection for Penunjang Medis */}
              {selectedServiceType === "penunjang_medis" && destinationRoomId && (
                <div className="col-span-2 space-y-3 border-t pt-4">
                  <Label className="text-sm font-medium">Pilih Tindakan *</Label>
                  {loadingRoomItems ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Memuat tindakan...</span>
                    </div>
                  ) : roomProcedures.length > 0 ? (
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
                            <span className="text-xs truncate">{rp.procedure?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Tidak ada tindakan tersedia di ruangan ini.
                    </p>
                  )}
                </div>
              )}

              {/* Medicine Selection for Farmasi */}
              {selectedServiceType === "farmasi" && destinationRoomId && (
                <div className="col-span-2 space-y-3 border-t pt-4">
                  <Label className="text-sm font-medium">Pilih Obat</Label>
                  {loadingRoomItems ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Memuat obat...</span>
                    </div>
                  ) : roomMedicines.length > 0 ? (
                    <div className="space-y-3">
                      {/* Medicine Search/Add */}
                      <Combobox
                        options={roomMedicines
                          .filter(rm => rm.medicine && rm.quantity > 0)
                          .map(rm => ({
                            value: rm.id.toString(),
                            label: `${rm.medicine?.name} (Stok: ${rm.quantity})`,
                          }))}
                        value=""
                        onValueChange={(value) => {
                          const rm = roomMedicines.find(m => m.id.toString() === value);
                          if (rm) addMedicine(rm);
                        }}
                        placeholder="Cari dan pilih obat..."
                      />

                      {/* Selected Medicines */}
                      {selectedMedicines.length > 0 && (
                        <div className="space-y-2">
                          {selectedMedicines.map((sm) => {
                            const med = roomMedicines.find(m => m.medicine_id === sm.medicine_id)?.medicine;
                            return med ? (
                              <div key={sm.medicine_id} className="flex items-center justify-between p-2 border rounded text-sm">
                                <span className="truncate flex-1">{med.name}</span>
                                <div className="flex items-center gap-2">
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
                                    className="w-14 h-6 text-center text-xs"
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
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Tidak ada obat tersedia di ruangan ini.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading || loadingRooms}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Simpan Pendaftaran
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* SEP Form Sheet */}
      <SEPFormSheet
        open={sepSheetOpen}
        onOpenChange={setSepSheetOpen}
        patient={{
          id: patient.id,
          no_rm: patient.no_rm,
          nama_lengkap: patient.nama_lengkap,
          nik: patient.nik,
          no_bpjs: bpjsNumber || patient.no_bpjs,
          tanggal_lahir: patient.tanggal_lahir,
          jenis_kelamin: patient.jenis_kelamin,
          no_telepon: patient.no_telepon,
          kelas_bpjs: patient.kelas_bpjs,
        }}
        registrationId={undefined}
        initialValues={{
          jenisPelayanan: selectedServiceType === "rawat_inap" ? "1" : "2",
        }}
        onSEPCreated={(noSEP, data) => {
          setSepNumber(noSEP);
          setSepData(data);
          onSEPCreated?.();
        }}
      />
    </>
  );
}
