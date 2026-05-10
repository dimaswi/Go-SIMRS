import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { roomClinicalPackagesApi, type RoomClinicalPackage } from "@/lib/api/clinical-packages";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { Patient, Room, RoomStaff, Registration } from "@/lib/api";
import { ArrowLeft, Loader2, UserPlus, User, Search, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { ClinicalPackageSelector } from "@/components/registration/clinical-package-selector";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { OrderRoomSelection } from "@/components/registration/order-room-selection";
import { mapClinicalPackageToRegistrationSelections, mergeRoomMedicinesWithClinicalPackage, mergeRoomProceduresWithClinicalPackage } from "@/lib/clinical-package-utils";
import { formatPatientName } from "@/lib/print-utils";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

const normalizeRoomType = (value?: string) => (value || "").trim().toLowerCase();

function FlatPanel({
  title,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`border border-border/70 bg-background ${className || ""}`.trim()}>
      <div className="border-b border-border/70 bg-muted/30 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {eyebrow}
              </div>
            )}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          {actions}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 border-l border-border/70 pl-3 first:border-l-0 first:pl-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm font-medium text-foreground" : "text-sm font-medium text-foreground"}>
        {value}
      </div>
    </div>
  );
}

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
  const [scheduledFollowUps, setScheduledFollowUps] = useState<Registration[]>([]);
  const doctorRequired = !["farmasi", "penunjang_medis"].includes(selectedServiceType);
  const destinationRoom = rooms.find((room) => room.id === destinationRoomId);

  const isDirectLaboratoryRoom = ["laboratorium", "laboratorium_pk", "laboratorium_pa", "lab"].includes(normalizeRoomType(destinationRoom?.room_type));
  const isDirectRadiologyRoom = ["radiologi", "radiology"].includes(normalizeRoomType(destinationRoom?.room_type));
  const isDirectPharmacyRoom = destinationRoom?.service_type === "farmasi" || ["farmasi", "depo_farmasi", "gudang_farmasi", "apotek", "pharmacy"].includes(normalizeRoomType(destinationRoom?.room_type));

  const destinationRoomHandlesProcedureDirectly = (procedureType?: string) => {
    if (procedureType === "laboratory") return isDirectLaboratoryRoom;
    if (procedureType === "radiology") return isDirectRadiologyRoom;
    return false;
  };

  useEffect(() => {
    setPageTitle("Pendaftaran Baru");
  }, []);

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
        {
          address: searchAddress || undefined,
          birthDate: searchBirthDate || undefined
        }
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
        limit: 20,
      });

      const registrations = response.data.data || [];
      const activeFollowUps = registrations.filter(isScheduledFollowUpActive);
      const blockingRegistrations = registrations.filter(isBlockingActiveRegistration);

      setScheduledFollowUps(activeFollowUps);

      if (blockingRegistrations.length > 0) {
        const blocking = blockingRegistrations[0];
        toast({
          variant: "destructive",
          title: "Tidak Dapat Mendaftar",
          description: `Pasien masih memiliki pendaftaran aktif yang belum diselesaikan${blocking.registration_number ? ` (${blocking.registration_number})` : ""}.`,
        });
        setLoading(false);
        return;
      }

      if (activeFollowUps.length > 0) {
        toast({
          title: "Jadwal Kontrol Tetap Aktif",
          description: "Pasien memiliki jadwal kontrol aktif. Pendaftaran baru tetap diperbolehkan dan jadwal kontrol tidak akan dibatalkan.",
        });
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
        // SEP data for BPJS
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

      if ((isDirectLaboratoryRoom || isDirectRadiologyRoom) && validProcedures.length === 0) {
        toast({
          variant: "destructive",
          title: "Tindakan wajib diisi",
          description: isDirectLaboratoryRoom
            ? "Pilih minimal satu tindakan laboratorium untuk pendaftaran langsung."
            : "Pilih minimal satu tindakan radiologi untuk pendaftaran langsung.",
        });
        setLoading(false);
        return;
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
          (procedureType === "consultation" || procedureType === "radiology" || procedureType === "laboratory") &&
          !destinationRoomHandlesProcedureDirectly(procedureType);
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

      if (isDirectPharmacyRoom && selectedMedicines.length === 0) {
        toast({
          variant: "destructive",
          title: "Obat wajib diisi",
          description: "Pilih minimal satu obat untuk pendaftaran langsung farmasi.",
        });
        setLoading(false);
        return;
      }

      const missingPharmacyRoomMedicines = isDirectPharmacyRoom
        ? []
        : selectedMedicines.filter((item) => !item.pharmacy_room_id);
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
            <p className="font-semibold">Pasien: {formatPatientName(existingPatient.nama_lengkap, existingPatient.jenis_kelamin, existingPatient.status_perkawinan, existingPatient.tanggal_lahir)}</p>
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
    <PageShell>
      <PageHeader
        title="Pendaftaran Pasien"
        description={
          step === "search"
            ? "Cari pasien dengan kombinasi identitas, alamat, dan tanggal lahir agar pemilihan lebih cepat dan akurat."
            : "Susun tujuan layanan, penjamin, dan order pendukung dalam panel yang lebih terarah."
        }
        count={step === "search" ? searchResults.length : undefined}
        icon={UserPlus}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (step === "registration" ? setStep("search") : window.history.back())}
            >
              <ArrowLeft className="h-4 w-4" />
              {step === "registration" ? "Kembali ke Pencarian" : "Kembali"}
            </Button>
            <Button onClick={() => navigate("/patients/create")} size="sm">
              <UserPlus className="h-4 w-4" />
              Pasien Baru
            </Button>
          </div>
        }
      >
      </PageHeader>

      <PageContent className="flex-none pb-8">
        {step === "search" && (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <FlatPanel
                title="Pencarian Cepat"
                eyebrow="Intake"
                actions={<Badge variant="outline">{searchResults.length} hasil</Badge>}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="searchQuery">Identitas Pasien</Label>
                    <Input
                      id="searchQuery"
                      placeholder="Nama, NIK, No. RM, atau BPJS"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSearch();
                      }}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="searchAddress">Filter Alamat</Label>
                      <Input
                        id="searchAddress"
                        placeholder="Kecamatan, desa, jalan"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="searchBirthDate">Tanggal Lahir</Label>
                      <Input
                        id="searchBirthDate"
                        type="date"
                        value={searchBirthDate}
                        onChange={(e) => setSearchBirthDate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleSearch} disabled={searchLoading} className="min-w-[140px]">
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Cari Pasien
                    </Button>
                    {(searchAddress || searchBirthDate || searchResults.length > 0 || existingPatient) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchAddress("");
                          setSearchBirthDate("");
                          setSearchResults([]);
                          setExistingPatient(null);
                        }}
                      >
                        Reset Filter
                      </Button>
                    )}
                  </div>
                </div>
              </FlatPanel>

              <FlatPanel title="Pasien Terpilih" eyebrow="Review">
                {existingPatient ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        {formatPatientName(existingPatient.nama_lengkap, existingPatient.jenis_kelamin, existingPatient.status_perkawinan, existingPatient.tanggal_lahir)}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">RM {existingPatient.no_rm}</span>
                        <span>{existingPatient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</span>
                        <span>{existingPatient.tanggal_lahir || "Tanggal lahir belum ada"}</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SummaryItem label="NIK" value={existingPatient.nik || "-"} mono />
                      <SummaryItem label="BPJS" value={existingPatient.no_bpjs || "-"} mono />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {existingPatient.alamat_domisili || existingPatient.alamat_ktp || "Alamat belum terisi"}
                    </div>
                    <Button onClick={() => handleUseExistingPatient()} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Lanjutkan dengan Pasien Ini
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Pilih satu pasien dari tabel hasil pencarian.</p>
                    <p>Double click pada baris juga bisa langsung masuk ke tahap pendaftaran.</p>
                  </div>
                )}
              </FlatPanel>
            </div>

            <FlatPanel
              title="Hasil Pencarian"
              eyebrow="Registry"
              actions={
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Click untuk pilih</span>
                  <span>Double click untuk lanjut</span>
                </div>
              }
            >
              {searchLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[52px]">Pilih</TableHead>
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
                          className={existingPatient?.id === patient.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/40"}
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
                          <TableCell className="font-mono text-xs font-semibold">{patient.no_rm}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">
                                {formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{patient.nik || "-"}</TableCell>
                          <TableCell>{patient.no_bpjs || "-"}</TableCell>
                          <TableCell>{patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</TableCell>
                          <TableCell>{patient.tanggal_lahir || "-"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {patient.alamat_domisili || patient.alamat_ktp || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <User className="h-12 w-12" />
                  <p className="text-sm font-medium text-foreground">Belum ada hasil pasien</p>
                  <p className="max-w-md text-sm">
                    Jalankan pencarian untuk menampilkan daftar pasien yang relevan, lalu pilih satu untuk lanjut ke pendaftaran.
                  </p>
                </div>
              )}
            </FlatPanel>
          </div>
        )}

        {step === "registration" && existingPatient && (
          <form onSubmit={handleRegistration} className="space-y-4">
            {scheduledFollowUps.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-800">Pasien Memiliki Jadwal Kontrol Aktif</AlertTitle>
                <AlertDescription className="space-y-2 text-amber-800">
                  <p>Pendaftaran baru tetap diperbolehkan. Jadwal kontrol tidak dibatalkan dan masih bisa di-reschedule dari monitoring.</p>
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
                    <p className="text-xs font-medium">Mode UGD diizinkan walaupun pasien masih punya jadwal kontrol mendatang.</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <FlatPanel title="Ringkasan Pasien" eyebrow="Patient Snapshot">
              <div className="grid gap-3 lg:grid-cols-4">
                <SummaryItem
                  label="Nama"
                  value={formatPatientName(existingPatient.nama_lengkap, existingPatient.jenis_kelamin, existingPatient.status_perkawinan, existingPatient.tanggal_lahir)}
                />
                <SummaryItem label="No. RM" value={existingPatient.no_rm} mono />
                <SummaryItem label="NIK" value={existingPatient.nik || "-"} mono />
                <SummaryItem label="Tanggal Lahir" value={existingPatient.tanggal_lahir || "-"} />
              </div>
            </FlatPanel>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <div className="space-y-4">
                <FlatPanel title="Tujuan Kunjungan" eyebrow="Core Setup">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                          setRoomClinicalPackages([]);
                          setSelectedClinicalPackageId(null);
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
                          .filter((room) => room.service_type === selectedServiceType)
                          .map((room) => ({
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
                        onValueChange={(value) => setPaymentMethod(value as "cash" | "bpjs" | "insurance")}
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
                        onValueChange={(value) => setPriority(value as "normal" | "urgent" | "emergency")}
                        placeholder="Pilih prioritas"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="doctor" className="text-sm">Dokter {doctorRequired ? "*" : "(Opsional)"}</Label>
                      {destinationRoomId && roomStaff.length > 0 ? (
                        <Combobox
                          options={roomStaff.map((staff) => ({
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
                          placeholder={
                            !destinationRoomId
                              ? "Pilih ruangan tujuan dulu"
                              : doctorRequired
                                ? "Tidak ada dokter tersedia"
                                : "Dokter tidak wajib untuk layanan ini"
                          }
                          className="bg-muted text-sm"
                        />
                      )}
                    </div>
                  </div>
                </FlatPanel>

                {destinationRoomId && (
                  <FlatPanel title="Paket Klinis" eyebrow="Automation">
                    <ClinicalPackageSelector
                      assignments={roomClinicalPackages}
                      selectedPackageId={selectedClinicalPackageId}
                      onValueChange={handleClinicalPackageChange}
                      loading={loadingRoomItems}
                    />
                  </FlatPanel>
                )}

                {destinationRoomId && (loadingRoomItems || availableRoomProcedures.length > 0 || availableRoomMedicines.length > 0) && (
                  <FlatPanel title="Order Tindakan dan Obat" eyebrow="Supporting Services">
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
                  </FlatPanel>
                )}

                <FlatPanel title="Catatan Klinis" eyebrow="Narrative">
                  <div className="space-y-2">
                    <Label htmlFor="complaint" className="text-sm">Keluhan Utama</Label>
                    <Textarea
                      id="complaint"
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="Tuliskan keluhan utama, alasan datang, atau informasi penting untuk petugas."
                      rows={4}
                      className="text-sm"
                    />
                  </div>
                </FlatPanel>
              </div>

              <div className="space-y-4">
                <FlatPanel title="Penjamin dan Akses Layanan" eyebrow="Billing">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SummaryItem label="Metode" value={paymentMethod === "cash" ? "Tunai" : paymentMethod === "bpjs" ? "BPJS" : "Asuransi"} />
                      <SummaryItem label="Prioritas" value={priority} />
                    </div>

                    {paymentMethod === "bpjs" && (
                      <div className="space-y-3 border border-blue-200 bg-blue-50/50 p-3">
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
                          <div className="space-y-1 text-sm">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Kelas Peserta</div>
                            <div className="font-medium text-foreground">{existingPatient.kelas_bpjs}</div>
                          </div>
                        )}

                        <div className="border border-blue-200 bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                                <FileText className="h-4 w-4" />
                                SEP
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Buat atau review SEP sebelum pendaftaran disimpan untuk pasien BPJS.
                              </div>
                            </div>
                            {sepNumber ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                {sepNumber}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-orange-300 text-orange-600">
                                Belum Ada
                              </Badge>
                            )}
                          </div>

                          {sepNumber && sepData && (
                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                              <div>Poli: <span className="font-medium text-foreground">{sepData.poli?.nama || "-"}</span></div>
                              <div>Dokter: <span className="font-medium text-foreground">{sepData.dokter?.nama || "-"}</span></div>
                              <div>Diagnosa: <span className="font-medium text-foreground">{sepData.diagnosa?.nama || "-"}</span></div>
                            </div>
                          )}

                          <Button
                            type="button"
                            variant={sepNumber ? "outline" : "default"}
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => setSepSheetOpen(true)}
                            disabled={!bpjsNumber}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {sepNumber ? "Lihat atau Edit SEP" : "Buat SEP"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {paymentMethod === "insurance" && (
                      <div className="grid gap-3 sm:grid-cols-2">
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

                    {paymentMethod === "cash" && (
                      <div className="border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                        Pasien akan diproses sebagai penjamin umum. Anda masih bisa mengubah metode pembayaran setelah pendaftaran selesai.
                      </div>
                    )}
                  </div>
                </FlatPanel>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button type="button" variant="outline" onClick={() => setStep("search")} size="sm">
                Kembali
              </Button>
              <Button type="submit" disabled={loading || loadingRooms} size="sm">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Simpan Pendaftaran
              </Button>
            </div>
          </form>
        )}
      </PageContent>

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
    </PageShell>
  );
}
