import { useState, useEffect, useMemo } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { roomsApi, registrationApi, api } from "@/lib/api";
import { roomClinicalPackagesApi, type RoomClinicalPackage } from "@/lib/api/clinical-packages";
import { formatPatientName } from "@/lib/print-utils";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import { ClinicalPackageSelector } from "@/components/registration/clinical-package-selector";
import type { Patient, Room, RoomStaff, Registration } from "@/lib/api";
import { Loader2, UserPlus, User, FileText, CheckCircle2, AlertCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { OrderRoomSelection } from "@/components/registration/order-room-selection";
import { mapClinicalPackageToRegistrationSelections, mergeRoomMedicinesWithClinicalPackage, mergeRoomProceduresWithClinicalPackage } from "@/lib/clinical-package-utils";
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
  const [roomClinicalPackages, setRoomClinicalPackages] = useState<RoomClinicalPackage[]>([]);
  const [selectedClinicalPackageId, setSelectedClinicalPackageId] = useState<number | null>(null);
  const [selectedProcedures, setSelectedProcedures] = useState<{ procedure_id: number; target_room_id?: number; notes: string }[]>([]);
  const [orderRoomOptionsByProcedureId, setOrderRoomOptionsByProcedureId] = useState<Record<number, { value: string; label: string }[]>>({});
  const [pharmacyRoomOptionsByMedicineId, setPharmacyRoomOptionsByMedicineId] = useState<Record<number, { value: string; label: string }[]>>({});
  const [selectedMedicines, setSelectedMedicines] = useState<{
    medicine_id: number;
    pharmacy_room_id?: number;
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
  const [scheduledFollowUps, setScheduledFollowUps] = useState<Registration[]>([]);
  const doctorRequired = !["farmasi", "penunjang_medis"].includes(selectedServiceType);

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

  const formatScheduledDate = (date?: string) => {
    if (!date) return "-";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const isScheduledFollowUpActive = (registration: Registration) => {
    return registration.is_follow_up && ["scheduled", "no_show"].includes(registration.status);
  };

  const isBlockingActiveRegistration = (registration: Registration) => {
    if (isScheduledFollowUpActive(registration)) {
      return false;
    }

    return !["completed", "discharged", "cancelled", "no_show"].includes(registration.status);
  };

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
      setRoomClinicalPackages([]);
      setSelectedClinicalPackageId(null);
      setSelectedProcedures([]);
      setSelectedMedicines([]);
      setPharmacyRoomOptionsByMedicineId({});
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
    setScheduledFollowUps([]);
    try {
      const response = await registrationApi.getAll({
        patient_id: patient.id,
        limit: 20,
      });

      const registrations = (response.data.data || []) as Registration[];
      const activeFollowUps = registrations.filter(isScheduledFollowUpActive);
      const activeReg = registrations.find(isBlockingActiveRegistration);

      setScheduledFollowUps(activeFollowUps);

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
    setRoomClinicalPackages([]);
    setSelectedClinicalPackageId(null);
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
    setRoomClinicalPackages([]);
    setSelectedClinicalPackageId(null);
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

      // Load room procedures for direct order-capable rooms
      const selectedRoom = rooms.find(r => r.id === id);
      if (selectedRoom) {
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

      // Load room medicines for direct room-stock capable rooms
      if (selectedRoom) {
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

      try {
        const packagesRes = await roomClinicalPackagesApi.getByRoom(id, { is_active: true, package_active_only: true });
        setRoomClinicalPackages(packagesRes.data.data || []);
      } catch (error) {
        console.error("Failed to load clinical packages:", error);
        setRoomClinicalPackages([]);
      }
    }
  };

  const handleClinicalPackageChange = (packageId: number | null) => {
    setSelectedClinicalPackageId(packageId);

    if (!packageId) {
      setSelectedProcedures([]);
      setSelectedMedicines([]);
      return;
    }

    const pkg = roomClinicalPackages.find((assignment) => assignment.clinical_package_id === packageId)?.clinical_package;
    const selections = mapClinicalPackageToRegistrationSelections(pkg);
    setSelectedProcedures(selections.procedures);
    setSelectedMedicines(selections.medicines);
  };

  // Toggle procedure selection
  const toggleProcedure = (procedureId: number) => {
    setSelectedProcedures(prev => {
      const exists = prev.find(p => p.procedure_id === procedureId);
      if (exists) {
        return prev.filter(p => p.procedure_id !== procedureId);
      } else {
        return [...prev, { procedure_id: procedureId, target_room_id: undefined, notes: "" }];
      }
    });
  };

  const updateProcedureTargetRoom = (procedureId: number, targetRoomId: number | null) => {
    setSelectedProcedures((prev) =>
      prev.map((item) =>
        item.procedure_id === procedureId
          ? { ...item, target_room_id: targetRoomId ?? undefined }
          : item
      )
    );
  };

  // Add medicine to selection
  const addMedicine = (medicine: RoomMedicine) => {
    if (!medicine.medicine) return;
    const exists = selectedMedicines.find(m => m.medicine_id === medicine.medicine_id);
    if (!exists) {
      setSelectedMedicines(prev => [...prev, {
        medicine_id: medicine.medicine_id,
        pharmacy_room_id: undefined,
        quantity: 1,
        unit: medicine.medicine?.unit || "",
        dosage: medicine.medicine?.dosage || "",
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

  const updateMedicinePharmacyRoom = (medicineId: number, pharmacyRoomId: number | null) => {
    setSelectedMedicines((prev) =>
      prev.map((item) =>
        item.medicine_id === medicineId
          ? { ...item, pharmacy_room_id: pharmacyRoomId ?? undefined }
          : item
      )
    );
  };

  const selectedClinicalPackage = useMemo(
    () => roomClinicalPackages.find((assignment) => assignment.clinical_package_id === selectedClinicalPackageId)?.clinical_package,
    [roomClinicalPackages, selectedClinicalPackageId]
  );

  const effectiveRoomProcedures = useMemo(
    () => mergeRoomProceduresWithClinicalPackage(roomProcedures, selectedClinicalPackage),
    [roomProcedures, selectedClinicalPackage]
  );

  const effectiveRoomMedicines = useMemo(
    () => mergeRoomMedicinesWithClinicalPackage(roomMedicines, selectedClinicalPackage),
    [roomMedicines, selectedClinicalPackage]
  );

  const availableRoomProcedures = effectiveRoomProcedures.filter(
    (roomProcedure) =>
      roomProcedure.is_available &&
      roomProcedure.procedure
  );

  const availableRoomMedicines = effectiveRoomMedicines.filter(
    (roomMedicine) => roomMedicine.medicine && roomMedicine.quantity > 0
  );

  const orderableProcedureIds = useMemo(
    () => Array.from(new Set(selectedProcedures
      .filter((item) => {
        const procedureType = effectiveRoomProcedures.find((rp) => rp.procedure_id === item.procedure_id)?.procedure?.procedure_type;
        return procedureType === "consultation" || procedureType === "radiology" || procedureType === "laboratory";
      })
      .map((item) => item.procedure_id))),
    [selectedProcedures, effectiveRoomProcedures]
  );

  useEffect(() => {

    if (orderableProcedureIds.length === 0) {
      setOrderRoomOptionsByProcedureId({});
      return;
    }

    let active = true;

    Promise.all(
      orderableProcedureIds.map(async (procedureId) => {
        const res = await roomProceduresApi.getAvailableRooms(procedureId);
        const options = (res.data.data || [])
          .filter((rp) => rp.room)
          .map((rp) => ({
            value: String(rp.room_id),
            label: `${rp.room?.code || `RM-${rp.room_id}`} - ${rp.room?.name || "Tanpa nama"}`,
          }));
        return [procedureId, options] as const;
      })
    )
      .then((entries) => {
        if (!active) return;
        const next: Record<number, { value: string; label: string }[]> = {};
        for (const [procedureId, options] of entries) {
          next[procedureId] = options;
        }
        setOrderRoomOptionsByProcedureId(next);
      })
      .catch((error) => {
        console.error("Failed to load available order rooms:", error);
      });

    return () => {
      active = false;
    };
  }, [orderableProcedureIds]);

  const selectedMedicineIds = useMemo(
    () => Array.from(new Set(selectedMedicines.map((item) => item.medicine_id))),
    [selectedMedicines]
  );

  useEffect(() => {
    if (selectedMedicineIds.length === 0) {
      setPharmacyRoomOptionsByMedicineId({});
      return;
    }

    let active = true;

    Promise.all(
      selectedMedicineIds.map(async (medicineId) => {
        const res = await roomMedicinesApi.getByMedicine(medicineId);
        const medicineRooms = (res.data.data || []) as RoomMedicine[];
        const options = medicineRooms
          .filter((rm: RoomMedicine) => rm.room?.is_active && rm.room?.service_type === "farmasi")
          .map((rm: RoomMedicine) => ({
            value: String(rm.room_id),
            label: `${rm.room?.code || `RM-${rm.room_id}`} - ${rm.room?.name || "Tanpa nama"} (Stok: ${rm.quantity})`,
          }));
        return [medicineId, options] as const;
      })
    )
      .then((entries) => {
        if (!active) return;
        const next: Record<number, { value: string; label: string }[]> = {};
        for (const [medicineId, options] of entries) {
          next[medicineId] = options;
        }
        setPharmacyRoomOptionsByMedicineId(next);
      })
      .catch((error) => {
        console.error("Failed to load available pharmacy rooms:", error);
      });

    return () => {
      active = false;
    };
  }, [selectedMedicineIds]);

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

    if (doctorRequired && !doctorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Dokter harus dipilih untuk layanan ini",
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
        registration_type: selectedServiceType === "rawat_inap" ? "inpatient" : selectedServiceType === "gawat_darurat" ? "emergency" : "outpatient",
        destination_room_id: destinationRoomId,
        doctor_id: doctorId || undefined,
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

      // Final guard: only send procedures that are still visible/available for this room context.
      const allowedProcedureIds = new Set(
        availableRoomProcedures.map((roomProcedure) => roomProcedure.procedure_id)
      );
      const validProcedures = selectedProcedures.filter((item) => allowedProcedureIds.has(item.procedure_id));
      if (validProcedures.length !== selectedProcedures.length) {
        const procedureNameById = new Map(
          effectiveRoomProcedures.map((roomProcedure) => [
            roomProcedure.procedure_id,
            roomProcedure.procedure?.name || `ID ${roomProcedure.procedure_id}`,
          ])
        );
        const skippedNames = selectedProcedures
          .filter((item) => !allowedProcedureIds.has(item.procedure_id))
          .map((item) => procedureNameById.get(item.procedure_id) || `ID ${item.procedure_id}`);

        setSelectedProcedures(validProcedures);
        toast({
          variant: "destructive",
          title: "Sebagian tindakan tidak dapat dikirim",
          description: `Tindakan berikut tidak mendukung order langsung dari pendaftaran: ${skippedNames.join(", ")}`,
        });
      }

      const procedureById = new Map(
        effectiveRoomProcedures.map((roomProcedure) => [
          roomProcedure.procedure_id,
          roomProcedure.procedure,
        ])
      );
      const missingTargetRoomProcedures = validProcedures.filter((item) => {
        const procedureType = procedureById.get(item.procedure_id)?.procedure_type;
        const requiresTargetRoom =
          procedureType === "consultation" || procedureType === "radiology" || procedureType === "laboratory";
        return requiresTargetRoom && !item.target_room_id;
      });

      if (missingTargetRoomProcedures.length > 0) {
        const names = missingTargetRoomProcedures.map(
          (item) => procedureById.get(item.procedure_id)?.name || `ID ${item.procedure_id}`
        );
        toast({
          variant: "destructive",
          title: "Ruangan tindak lanjut belum dipilih",
          description: `Pilih ruangan tindak lanjut untuk: ${names.join(", ")}`,
        });
        setLoading(false);
        return;
      }

      if (validProcedures.length > 0) {
        registrationData.procedure_items = validProcedures;
      }

      const missingPharmacyRoomMedicines = selectedMedicines.filter((item) => !item.pharmacy_room_id);
      if (missingPharmacyRoomMedicines.length > 0) {
        const medicineNameById = new Map(
          effectiveRoomMedicines.map((roomMedicine) => [
            roomMedicine.medicine_id,
            roomMedicine.medicine?.name || `ID ${roomMedicine.medicine_id}`,
          ])
        );
        const names = missingPharmacyRoomMedicines.map(
          (item) => medicineNameById.get(item.medicine_id) || `ID ${item.medicine_id}`
        );
        toast({
          variant: "destructive",
          title: "Farmasi tujuan belum dipilih",
          description: `Pilih farmasi tujuan untuk: ${names.join(", ")}`,
        });
        setLoading(false);
        return;
      }

      // Add room medicine items when selected
      if (selectedMedicines.length > 0) {
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
        <SheetContent className="flex h-full w-[50%] flex-col overflow-hidden sm:max-w-[50%]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Pendaftaran Pasien
            </SheetTitle>
            <SheetDescription>
              Buat pendaftaran baru untuk pasien
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {scheduledFollowUps.length > 0 && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <AlertTitle className="text-amber-800">Pasien Memiliki Jadwal Kontrol Aktif</AlertTitle>
                  <AlertDescription className="space-y-2 text-amber-800">
                    <p>
                      Pendaftaran baru tetap diperbolehkan. Jadwal kontrol tidak dibatalkan dan tetap bisa di-reschedule dari monitoring.
                    </p>
                    <div className="space-y-1">
                      {scheduledFollowUps.slice(0, 3).map((registration) => (
                        <div key={registration.id || registration.ID} className="text-xs">
                          Jadwal {formatScheduledDate(registration.scheduled_date)}
                          {registration.destination_room?.name ? ` di ${registration.destination_room.name}` : ""}
                          {registration.doctor?.nama_lengkap ? `, DPJP ${registration.doctor.nama_lengkap}` : ""}
                        </div>
                      ))}
                      {scheduledFollowUps.length > 3 && (
                        <div className="text-xs">+{scheduledFollowUps.length - 3} jadwal kontrol aktif lainnya</div>
                      )}
                    </div>
                    {selectedServiceType === "gawat_darurat" && (
                      <p className="text-xs font-medium">Mode UGD tetap diperbolehkan walaupun pasien masih punya jadwal kontrol mendatang.</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

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
                  <Label className="text-sm">Dokter {doctorRequired ? "*" : "(Opsional)"}</Label>
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
                      placeholder={doctorRequired ? "Tidak ada dokter di ruangan ini" : "Dokter tidak wajib untuk layanan ini"}
                      className="bg-muted text-sm"
                    />
                  )}
                </div>
              )}

              {destinationRoomId && (
                <div className="col-span-2">
                  <ClinicalPackageSelector
                    assignments={roomClinicalPackages}
                    selectedPackageId={selectedClinicalPackageId}
                    onValueChange={handleClinicalPackageChange}
                    loading={loadingRoomItems}
                  />
                </div>
              )}

              {destinationRoomId && (loadingRoomItems || availableRoomProcedures.length > 0 || availableRoomMedicines.length > 0) && (
                <div className="col-span-2">
                  <OrderRoomSelection
                    loading={loadingRoomItems}
                    procedures={availableRoomProcedures}
                    selectedProcedures={selectedProcedures}
                    onToggleProcedure={toggleProcedure}
                    onUpdateProcedureTargetRoom={updateProcedureTargetRoom}
                    orderRoomOptionsByProcedureId={orderRoomOptionsByProcedureId}
                    medicines={availableRoomMedicines}
                    selectedMedicines={selectedMedicines}
                    onUpdateMedicinePharmacyRoom={updateMedicinePharmacyRoom}
                    pharmacyRoomOptionsByMedicineId={pharmacyRoomOptionsByMedicineId}
                    onAddMedicine={addMedicine}
                    onUpdateMedicineQuantity={updateMedicineQuantity}
                    onRemoveMedicine={removeMedicine}
                  />
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
            </div>
            </div>

            {/* Submit Button */}
            <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t bg-background/95 pt-4 pb-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
