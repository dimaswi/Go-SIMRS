import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { masterDataApi, regionsApi, patientsApi, roomsApi, registrationApi, api } from "@/lib/api";
import { roomClinicalPackagesApi, type RoomClinicalPackage } from "@/lib/api/clinical-packages";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { PatientRequest, MasterData, Province, Regency, Patient, Room, RoomStaff, Registration } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, User, Search, FileText, CheckCircle2, AlertTriangle, ArrowLeft, X } from "lucide-react";
import { formatPatientName } from "@/lib/print-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { ClinicalPackageSelector } from "@/components/registration/clinical-package-selector";
import { OrderRoomSelection } from "@/components/registration/order-room-selection";
import { PatientCreateFormFields } from "@/components/patient/patient-create-form-fields";
import { mapClinicalPackageToRegistrationSelections, mergeRoomMedicinesWithClinicalPackage, mergeRoomProceduresWithClinicalPackage } from "@/lib/clinical-package-utils";
import { parseKioskNotes } from "@/lib/api/queue";

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
    <section className={`space-y-4 ${className || ""}`.trim()}>
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                {eyebrow}
              </div>
            )}
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</h2>
          </div>
          {actions}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
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

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueId: number;
  queueNumber: string;
  queueNotes?: string;
  queueType?: "general" | "bpjs" | "emergency";
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
  queueNotes,
  queueType,
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

  // SEP BPJS
  const [sepSheetOpen, setSepSheetOpen] = useState(false);
  const [sepNumber, setSepNumber] = useState("");
  const [sepData, setSepData] = useState<any>(null);

  // Master data state
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStaff, setRoomStaff] = useState<RoomStaff[]>([]);

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
  const [hasSearched, setHasSearched] = useState(false);
  const kioskPrefillAppliedRef = useRef(false);
  const kioskDoctorAppliedRef = useRef(false);
  const parsedKiosk = useMemo(() => parseKioskNotes(queueNotes), [queueNotes]);
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

  // Region data state
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);

  useEffect(() => {
    if (open) {
      const prefillNik = parsedKiosk.nik || "";

      kioskPrefillAppliedRef.current = false;
      kioskDoctorAppliedRef.current = false;
      setHasSearched(false);
      setStep("search");
      setExistingPatient(null);
      setSearchQuery(prefillNik);
      setSearchAddress("");
      setSearchBirthDate("");
      setSearchResults([]);
      setFormData({
        ...initialFormData,
        nik: prefillNik || undefined,
        jenis_jaminan: queueType === "bpjs" ? "BPJS" : "Umum",
      });
      setSameAddress(false);
      setDestinationRoomId(null);
      setDoctorId(null);
      setPaymentMethod(queueType === "bpjs" ? "bpjs" : "cash");
      setBpjsNumber("");
      setInsuranceName("");
      setInsuranceNumber("");
      setComplaint("");
      setPriority("normal");
      setSelectedServiceType("");
      setRoomStaff([]);
      setRoomProcedures([]);
      setRoomMedicines([]);
      setRoomClinicalPackages([]);
      setSelectedClinicalPackageId(null);
      setSelectedProcedures([]);
      setSelectedMedicines([]);
      setPharmacyRoomOptionsByMedicineId({});
      setScheduledFollowUps([]);
      // Reset SEP state
      setSepSheetOpen(false);
      setSepNumber("");
      setSepData(null);

      if (prefillNik) {
        setSearchLoading(true);
        patientsApi
          .search(prefillNik, 10)
          .then((response) => {
            const raw = response.data?.data || response.data || [];
            const data = Array.isArray(raw) ? raw : [];
            setSearchResults(data);
            if (data.length === 1) {
              setExistingPatient(data[0]);
            } else if (data.length === 0) {
              setStep("form");
              loadReferenceData();
            }
          })
          .catch(() => {
            setSearchResults([]);
          })
          .finally(() => {
            setSearchLoading(false);
            setHasSearched(true);
          });
      }
    }
  }, [open, parsedKiosk.nik, queueType]);

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
        {
          address: searchAddress || undefined,
          birthDate: searchBirthDate || undefined
        }
      );
      const data = response.data?.data || response.data || [];
      setSearchResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
      
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
      const [masterDataRes, provincesRes, allRegenciesRes, roomsRes] = await Promise.all([
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
        regionsApi.getAllRegencies(),
        roomsApi.getAll({ limit: 1000, is_active: "true" }),
      ]);

      setMasterData(masterDataRes.data.data || {});
      setProvinces(provincesRes.data.data || []);
      setRegencies(allRegenciesRes.data.data || []);
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
    setRoomClinicalPackages([]);
    setSelectedClinicalPackageId(null);
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
            label: rp.room?.name || "Tanpa nama",
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
            label: `${rm.room?.name || "Tanpa nama"} (Stok: ${rm.quantity})`,
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

  const handleUseExistingPatient = async (patientOverride?: Patient) => {
    const targetPatient = patientOverride || existingPatient;
    if (!targetPatient) return;
    if (patientOverride) {
      setExistingPatient(patientOverride);
    }
    
    // Check if patient has active registrations
    setLoading(true);
    try {
      const response = await registrationApi.getAll({
        patient_id: targetPatient.id,
        limit: 20,
      });
      
      const registrations = (response.data.data || []) as Registration[];
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

  // Auto-preselect room & doctor from Kiosk queueNotes when entering registration step
  useEffect(() => {
    if (!open || step !== "registration" || kioskPrefillAppliedRef.current || rooms.length === 0) {
      return;
    }

    kioskPrefillAppliedRef.current = true;
    if (parsedKiosk.ruangan) {
      const targetRoom = parsedKiosk.ruangan.trim().toLowerCase();
      const matchedRoom = rooms.find(
        (room) => room.name.trim().toLowerCase() === targetRoom
      );
      if (matchedRoom) {
        setSelectedServiceType(matchedRoom.service_type);
        handleRoomChange(matchedRoom.id.toString());
        return;
      }
    }

    if (parsedKiosk.layanan) {
      const serviceLower = parsedKiosk.layanan.toLowerCase();
      if (serviceLower.includes("poli") || serviceLower.includes("rawat jalan")) {
        setSelectedServiceType("rawat_jalan");
      } else if (
        serviceLower.includes("lab") ||
        serviceLower.includes("radiologi") ||
        serviceLower.includes("penunjang")
      ) {
        setSelectedServiceType("penunjang_medis");
      }
    }
  }, [open, step, rooms, parsedKiosk]);

  useEffect(() => {
    if (
      !open ||
      step !== "registration" ||
      kioskDoctorAppliedRef.current ||
      roomStaff.length === 0 ||
      !parsedKiosk.dokterName
    ) {
      return;
    }

    const targetDoc = parsedKiosk.dokterName.trim().toLowerCase();
    const matchedStaff = roomStaff.find((staff) => {
      const fullName = (staff.employee?.nama_lengkap || "").trim().toLowerCase();
      return (
        fullName === targetDoc ||
        (fullName.length > 0 && (fullName.includes(targetDoc) || targetDoc.includes(fullName)))
      );
    });

    if (matchedStaff) {
      kioskDoctorAppliedRef.current = true;
      setDoctorId(matchedStaff.employee_id);
    }
  }, [open, step, roomStaff, parsedKiosk]);

  // Auto-load BPJS data when payment method is BPJS and patient has BPJS number
  useEffect(() => {
    if (paymentMethod === "bpjs" && existingPatient) {
      if (existingPatient.no_bpjs) {
        setBpjsNumber(existingPatient.no_bpjs);
        
        // Cek SEP lokal berdasarkan no_kartu
        const checkLocalSEP = async () => {
          try {
            const res = await api.get(`/bpjs/vclaim/sep/list?no_kartu=${existingPatient.no_bpjs}&limit=10`);
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

    if (doctorRequired && !doctorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Dokter harus dipilih untuk layanan ini",
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
      const registrationTypeMap: Record<string, string> = {
        rawat_jalan: "outpatient",
        gawat_darurat: "emergency",
        rawat_inap: "inpatient",
        penunjang_medis: "supporting",
        farmasi: "pharmacy",
      };

      const registrationType = registrationTypeMap[selectedServiceType] || "outpatient";
      const shouldCreateRoomQueue =
        selectedServiceType !== "gawat_darurat" && selectedServiceType !== "rawat_inap";

      // Prepare registration data
      const registrationData: any = {
        queue_id: queueId,
        patient_id: existingPatient.id,
        registration_type: registrationType,
        destination_room_id: destinationRoomId,
        doctor_id: doctorId || undefined,
        payment_method: paymentMethod,
        bpjs_number: paymentMethod === "bpjs" ? bpjsNumber : undefined,
        sep_number: paymentMethod === "bpjs" && sepNumber ? sepNumber : undefined,
        insurance_name: paymentMethod === "insurance" ? insuranceName : undefined,
        insurance_number: paymentMethod === "insurance" ? insuranceNumber : undefined,
        complaint: complaint || undefined,
        create_visit: true,
        create_room_queue: shouldCreateRoomQueue,
        queue_priority: priority,
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
          <div className="flex flex-col gap-1 text-sm mt-1">
            <div><span className="font-medium">Pasien:</span> {formatPatientName(existingPatient.nama_lengkap, existingPatient.jenis_kelamin, existingPatient.status_perkawinan, existingPatient.tanggal_lahir)} ({existingPatient.no_rm})</div>
            <div><span className="font-medium">Ruangan:</span> {roomName}</div>
            {roomQueueNumber && (
              <div><span className="font-medium">Antrian:</span> <span className="font-bold">{roomQueueNumber}</span></div>
            )}
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
      <DialogContent
        hideClose
        className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] flex flex-col p-0 m-0 gap-0 border-0 rounded-none sm:rounded-none bg-white dark:bg-neutral-950"
      >
        {/* Top Admin Header Bar */}
        <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {step !== "search" && (
                <button
                  type="button"
                  onClick={() => setStep("search")}
                  className="h-8 w-8 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center shrink-0 transition-colors"
                  title="Kembali ke Pencarian"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm shrink-0">
                <UserPlus className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
                    Pendaftaran Pasien
                  </DialogTitle>
                  <Badge variant="outline" className="rounded-none font-mono text-[11px]">
                    Antrean {queueNumber}
                  </Badge>
                  {queueType === "bpjs" && (
                    <Badge variant="secondary" className="rounded-none font-mono text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                      BPJS
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-neutral-500 font-mono mt-0.5 truncate">
                  {step === "search"
                    ? "Cari pasien berdasarkan Nama, NIK, No. RM, atau daftarkan sebagai pasien baru."
                    : step === "form"
                    ? "Lengkapi data master pasien baru sebelum melanjutkan ke tujuan kunjungan."
                    : "Susun tujuan layanan, ruangan, dokter, penjamin, dan order pendukung."}
                </DialogDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Step Breadcrumb Pills */}
              <div className="hidden md:flex items-center border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[11px] font-mono">
                <span
                  className={`px-2.5 py-1 uppercase tracking-wider ${
                    step === "search"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  1. Cari Pasien
                </span>
                <span
                  className={`px-2.5 py-1 border-l border-neutral-200 dark:border-neutral-800 uppercase tracking-wider ${
                    step === "form"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  2. Pasien Baru
                </span>
                <span
                  className={`px-2.5 py-1 border-l border-neutral-200 dark:border-neutral-800 uppercase tracking-wider ${
                    step === "registration"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  3. Pendaftaran
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-none"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {queueNotes && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40 px-5 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span className="inline-flex items-center border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Data Kiosk
              </span>
              {parsedKiosk.layanan || parsedKiosk.ruangan || parsedKiosk.nik || parsedKiosk.dokter || parsedKiosk.status || parsedKiosk.pasien ? (
                <>
                  {parsedKiosk.layanan && (
                    <span className="text-muted-foreground">
                      Layanan: <strong className="font-semibold text-foreground">{parsedKiosk.layanan}</strong>
                    </span>
                  )}
                  {parsedKiosk.ruangan && (
                    <span className="text-muted-foreground">
                      Ruangan: <strong className="font-semibold text-foreground">{parsedKiosk.ruangan}</strong>
                    </span>
                  )}
                  {parsedKiosk.dokter && (
                    <span className="text-muted-foreground">
                      Dokter: <strong className="font-semibold text-foreground">{parsedKiosk.dokter}</strong>
                    </span>
                  )}
                  {parsedKiosk.nik && (
                    <span className="text-muted-foreground">
                      NIK: <strong className="font-mono font-semibold text-foreground">{parsedKiosk.nik}</strong>
                    </span>
                  )}
                  {parsedKiosk.pasien && (
                    <span className="text-muted-foreground">
                      Pasien: <strong className="font-semibold text-foreground">{parsedKiosk.pasien}</strong>
                    </span>
                  )}
                  {parsedKiosk.status && (
                    <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-800 font-mono text-[10px]">
                      {parsedKiosk.status}
                    </Badge>
                  )}
                </>
              ) : (
                <span className="font-medium text-foreground">{queueNotes}</span>
              )}
            </div>
          )}
        </div>

        {/* Main Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-50/40 dark:bg-neutral-950 p-4 sm:p-5">
          <div className="w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-5">
            {step === "search" && (
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* Left Column: Quick Search + Selected Patient Review */}
                <div className="space-y-6">
                  <FlatPanel
                    title="Pencarian Cepat"
                    eyebrow="Intake"
                    actions={
                      <Badge variant="outline" className="rounded-none font-mono">
                        {searchResults.length} hasil
                      </Badge>
                    }
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="queue-search-query">Identitas Pasien</Label>
                        <Input
                          id="queue-search-query"
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
                          <Label htmlFor="queue-search-address">Filter Alamat</Label>
                          <Input
                            id="queue-search-address"
                            placeholder="Kecamatan, desa, jalan"
                            value={searchAddress}
                            onChange={(e) => setSearchAddress(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSearch();
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="queue-search-dob">Tanggal Lahir</Label>
                          <Input
                            id="queue-search-dob"
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
                        <Button onClick={handleSearch} disabled={searchLoading} className="min-w-[130px] rounded-none">
                          {searchLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          Cari Pasien
                        </Button>
                        {(searchAddress || searchBirthDate || searchResults.length > 0 || existingPatient) && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none"
                            onClick={() => {
                              setSearchAddress("");
                              setSearchBirthDate("");
                              setSearchResults([]);
                              setExistingPatient(null);
                              setHasSearched(false);
                            }}
                          >
                            Reset
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
                            {formatPatientName(
                              existingPatient.nama_lengkap,
                              existingPatient.jenis_kelamin,
                              existingPatient.status_perkawinan,
                              existingPatient.tanggal_lahir
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="font-mono font-semibold text-foreground">RM {existingPatient.no_rm}</span>
                            <span>{existingPatient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</span>
                            <span>{existingPatient.tanggal_lahir || "Tanggal lahir belum ada"}</span>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 border-y border-neutral-200 dark:border-neutral-800 py-3">
                          <SummaryItem label="NIK" value={existingPatient.nik || "-"} mono />
                          <SummaryItem label="No. BPJS" value={existingPatient.no_bpjs || "-"} mono />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {existingPatient.alamat_domisili || existingPatient.alamat_ktp || "Alamat belum terisi"}
                        </div>
                      </div>
                    ) : hasSearched && searchResults.length === 0 ? (
                      <div className="space-y-1.5 border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                        <p className="font-semibold">
                          {parsedKiosk.nik
                            ? `NIK ${parsedKiosk.nik} belum terdaftar di Rekam Medis.`
                            : "Data pasien tidak ditemukan dengan kata kunci tersebut."}
                        </p>
                        <p className="text-amber-800">
                          Klik tombol <strong>Pasien Baru</strong> di kanan bawah untuk membuat rekam medis baru.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <p>Pilih satu pasien dari tabel hasil pencarian di sebelah kanan.</p>
                        <p className="text-xs">Double click pada baris pasien juga bisa langsung masuk ke tahap pendaftaran.</p>
                      </div>
                    )}
                  </FlatPanel>
                </div>

                {/* Right Column: Search Results Table */}
                <FlatPanel
                  title="Hasil Pencarian"
                  eyebrow="Registry"
                  actions={
                    <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Click untuk pilih</span>
                      <span>•</span>
                      <span>Double click untuk lanjut</span>
                    </div>
                  }
                >
                  {searchLoading ? (
                    <div className="flex h-80 items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="overflow-auto rounded-md border border-border shadow-sm max-h-[calc(100vh-300px)]">
                      <Table
                        containerClassName="border-none rounded-none shadow-none"
                        className="border-collapse [&_th]:border-r-0 [&_td]:border-r-0 [&_tr+tr_td]:border-t-0 [&_tr]:border-b [&_tr:last-child]:border-b-0"
                      >
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[52px] text-center">Pilih</TableHead>
                            <TableHead className="whitespace-nowrap">No. RM</TableHead>
                            <TableHead className="whitespace-nowrap">Nama Lengkap</TableHead>
                            <TableHead className="whitespace-nowrap">NIK</TableHead>
                            <TableHead className="whitespace-nowrap">No. BPJS</TableHead>
                            <TableHead className="whitespace-nowrap">Jenis Kelamin</TableHead>
                            <TableHead className="whitespace-nowrap">Tanggal Lahir</TableHead>
                            <TableHead className="whitespace-nowrap">Alamat</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((patient) => (
                            <TableRow
                              key={patient.id}
                              className={existingPatient?.id === patient.id ? "bg-muted/60" : "cursor-pointer hover:bg-muted/40"}
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
                              <TableCell className="font-medium">
                                {formatPatientName(
                                  patient.nama_lengkap,
                                  patient.jenis_kelamin,
                                  patient.status_perkawinan,
                                  patient.tanggal_lahir
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{patient.nik || "-"}</TableCell>
                              <TableCell className="font-mono text-xs">{patient.no_bpjs || "-"}</TableCell>
                              <TableCell>{patient.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</TableCell>
                              <TableCell className="text-xs">{patient.tanggal_lahir || "-"}</TableCell>
                              <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                                {patient.alamat_domisili || patient.alamat_ktp || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 px-6 text-center text-muted-foreground">
                      <User className="h-10 w-10 text-neutral-400" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {hasSearched ? "Tidak ada data pasien yang cocok" : "Belum ada hasil pencarian"}
                        </p>
                        <p className="max-w-md text-xs">
                          {hasSearched
                            ? parsedKiosk.nik
                              ? `NIK ${parsedKiosk.nik} dari Kiosk tidak ditemukan di database pasien. Coba cari dengan nama atau gunakan tombol Pasien Baru di kanan bawah.`
                              : "Coba ubah kata kunci, filter alamat, atau gunakan tombol Pasien Baru di kanan bawah."
                            : "Masukkan Nama, NIK, No. RM, atau No. BPJS di panel Pencarian Cepat untuk menemukan data pasien."}
                        </p>
                      </div>
                    </div>
                  )}
                </FlatPanel>
              </div>
            )}

        {step === "form" && (
          <form id="queue-new-patient-form" onSubmit={handleSubmit} className="space-y-5">
            <FlatPanel
              title="Registrasi Master Pasien Baru"
              eyebrow="Pasien Baru"
              actions={
                parsedKiosk.nik ? (
                  <Badge variant="outline" className="rounded-none font-mono text-[11px]">
                    Pre-fill NIK: {parsedKiosk.nik}
                  </Badge>
                ) : undefined
              }
            >
              {loadingMaster && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!loadingMaster && (
                <PatientCreateFormFields
                  formData={formData}
                  setFormData={setFormData}
                  masterData={masterData}
                  provinces={provinces}
                  regencies={regencies}
                  sameAddress={sameAddress}
                  setSameAddress={setSameAddress}
                />
              )}
            </FlatPanel>
          </form>
        )}

        {step === "registration" && existingPatient && (
          <form id="queue-registration-form" onSubmit={handleRegistration} className="space-y-6">
            {scheduledFollowUps.length > 0 && (
              <Alert className="rounded-none border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-800">Jadwal kontrol masih aktif</AlertTitle>
                <AlertDescription className="space-y-2 text-sm text-amber-800">
                  <p>Pendaftaran baru tetap bisa dibuat. Jadwal kontrol berikut tidak dibatalkan:</p>
                  <div className="space-y-1">
                    {scheduledFollowUps.map((registration) => (
                      <div key={registration.id} className="border border-amber-200 bg-white px-3 py-2">
                        <p className="font-mono font-medium">
                          {registration.registration_number || "Tanpa nomor pendaftaran"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tanggal: {formatScheduledDate(registration.scheduled_date)} • Status: {registration.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <FlatPanel title="Ringkasan Pasien" eyebrow="Patient Snapshot">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 p-3.5">
                <SummaryItem
                  label="Nama"
                  value={formatPatientName(
                    existingPatient.nama_lengkap,
                    existingPatient.jenis_kelamin,
                    existingPatient.status_perkawinan,
                    existingPatient.tanggal_lahir
                  )}
                />
                <SummaryItem label="No. RM" value={existingPatient.no_rm} mono />
                <SummaryItem label="NIK" value={existingPatient.nik || "-"} mono />
                <SummaryItem label="Tgl Lahir" value={existingPatient.tanggal_lahir || "-"} />
              </div>
            </FlatPanel>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              {/* Left Column: Visit Setup, Orders, Narrative */}
              <div className="space-y-6">
                <FlatPanel title="Tujuan Kunjungan" eyebrow="Core Setup">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                        options={!selectedServiceType || selectedServiceType === "all" ? [] : (rooms || [])
                          .filter(room => room.service_type === selectedServiceType)
                          .map(room => ({
                            value: room.id.toString(),
                            label: room.name,
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
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="doctor" className="text-sm">Dokter {doctorRequired ? "*" : "(Opsional)"}</Label>
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
                            placeholder={doctorRequired ? "Tidak ada dokter" : "Dokter tidak wajib untuk layanan ini"}
                            className="bg-muted text-sm"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </FlatPanel>

                {destinationRoomId && (
                  <FlatPanel title="Paket & Order Ruangan" eyebrow="Direct Order">
                    <ClinicalPackageSelector
                      assignments={roomClinicalPackages}
                      selectedPackageId={selectedClinicalPackageId}
                      onValueChange={handleClinicalPackageChange}
                      loading={loadingRoomItems}
                    />

                    {(loadingRoomItems || availableRoomProcedures.length > 0 || availableRoomMedicines.length > 0) && (
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
                    )}
                  </FlatPanel>
                )}

                <FlatPanel title="Catatan Klinis" eyebrow="Narrative">
                  <div className="space-y-2">
                    <Label htmlFor="complaint" className="text-sm">Keluhan Utama (Opsional)</Label>
                    <Textarea
                      id="complaint"
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="Tuliskan keluhan utama pasien atau catatan untuk poli/ruangan..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </FlatPanel>
              </div>

              {/* Right Column: Billing & Access */}
              <div className="space-y-6">
                <FlatPanel title="Penjamin & Akses Layanan" eyebrow="Billing">
                  <div className="grid gap-3 sm:grid-cols-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 p-3">
                    <SummaryItem
                      label="Metode"
                      value={paymentMethod === "cash" ? "Tunai" : paymentMethod === "bpjs" ? "BPJS" : "Asuransi"}
                    />
                    <SummaryItem
                      label="Prioritas"
                      value={priority === "normal" ? "Normal" : priority === "urgent" ? "Mendesak" : "Darurat"}
                    />
                  </div>

                  {paymentMethod === "cash" && (
                    <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 p-3 text-xs text-muted-foreground">
                      Pasien umum/tunai tidak memerlukan penerbitan SEP atau verifikasi polis asuransi.
                    </div>
                  )}

                  {paymentMethod === "bpjs" && (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="bpjs_number" className="text-sm">Nomor BPJS *</Label>
                          <Input
                            id="bpjs_number"
                            value={bpjsNumber}
                            onChange={(e) => setBpjsNumber(e.target.value)}
                            placeholder={existingPatient?.no_bpjs || "Nomor BPJS"}
                            className="text-sm font-mono"
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

                      <div className="border border-blue-200 bg-blue-50/50 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">SEP (Surat Eligibilitas Peserta)</span>
                          </div>
                          {sepNumber ? (
                            <Badge variant="secondary" className="rounded-none bg-green-100 text-green-800 font-mono">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {sepNumber}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-none text-orange-600 border-orange-300">
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
                          className="mt-3 w-full rounded-none"
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
                    <div className="grid gap-3">
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
                          className="text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}
                </FlatPanel>
              </div>
            </div>
          </form>
        )}
          </div>
        </div>

        {/* Sticky Admin Footer Bar */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-muted-foreground flex flex-wrap items-center gap-2">
            <span>Antrean {queueNumber}</span>
            <span>•</span>
            <span>
              {step === "search"
                ? existingPatient
                  ? `Terpilih: ${existingPatient.nama_lengkap} (${existingPatient.no_rm})`
                  : "Menunggu pemilihan pasien"
                : step === "form"
                ? "Input Master Pasien Baru"
                : existingPatient
                ? `${existingPatient.nama_lengkap} (${existingPatient.no_rm})`
                : "Pendaftaran Kunjungan"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>

            {step === "search" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={handleNewPatient}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Pasien Baru
                </Button>
                {existingPatient && (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-none"
                    onClick={() => handleUseExistingPatient()}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Lanjut: {existingPatient.nama_lengkap}
                  </Button>
                )}
              </>
            )}

            {step === "form" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => setStep("search")}
                >
                  Kembali
                </Button>
                <Button
                  type="submit"
                  form="queue-new-patient-form"
                  size="sm"
                  className="rounded-none"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Lanjut ke Pendaftaran
                </Button>
              </>
            )}

            {step === "registration" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => setStep("search")}
                >
                  Kembali
                </Button>
                <Button
                  type="submit"
                  form="queue-registration-form"
                  size="sm"
                  className="rounded-none"
                  disabled={loading || loadingMaster}
                >
                  {loading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Simpan Pendaftaran
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>

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
          initialValues={{
            jenisPelayanan: selectedServiceType === "rawat_inap" ? "1" : "2",
          }}
          onSEPCreated={(noSEP, data) => {
            setSepNumber(noSEP);
            setSepData(data);
          }}
        />
      )}
    </Dialog>
  );
}
