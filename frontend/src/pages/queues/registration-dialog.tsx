import { useState, useEffect, useMemo } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { masterDataApi, regionsApi, patientsApi, roomsApi, registrationApi, api } from "@/lib/api";
import { roomClinicalPackagesApi, type RoomClinicalPackage } from "@/lib/api/clinical-packages";
import { roomProceduresApi, type RoomProcedure } from "@/lib/api/procedures";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import type { PatientRequest, MasterData, Province, Regency, District, Village, Patient, Room, RoomStaff, Registration } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, User, MapPin, Search, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
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
import { mapClinicalPackageToRegistrationSelections, mergeRoomMedicinesWithClinicalPackage, mergeRoomProceduresWithClinicalPackage } from "@/lib/clinical-package-utils";

const normalizeRoomType = (value?: string) => (value || "").trim().toLowerCase();

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
    }
  }, [open]);

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

  const handleUseExistingPatient = async () => {
    if (!existingPatient) return;
    
    // Check if patient has active registrations
    setLoading(true);
    try {
      const response = await registrationApi.getAll({
        patient_id: existingPatient.id,
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
      const shouldCreateRoomQueue = selectedServiceType !== "rawat_inap";

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
                  <p className="font-medium text-sm">{formatPatientName(existingPatient.nama_lengkap, existingPatient.jenis_kelamin, existingPatient.status_perkawinan, existingPatient.tanggal_lahir)}</p>
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

            {scheduledFollowUps.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Jadwal kontrol masih aktif</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 text-sm">
                    <p>Pendaftaran baru tetap bisa dibuat. Jadwal kontrol berikut tidak dibatalkan:</p>
                    <div className="space-y-1">
                      {scheduledFollowUps.map((registration) => (
                        <div key={registration.id} className="rounded border bg-background px-3 py-2">
                          <p className="font-medium">
                            {registration.registration_number || "Tanpa nomor pendaftaran"}
                          </p>
                          <p className="text-muted-foreground">
                            Tanggal: {formatScheduledDate(registration.scheduled_date)}
                          </p>
                          <p className="text-muted-foreground">
                            Status: {registration.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

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

                {destinationRoomId && (
                  <div className="col-span-3">
                    <ClinicalPackageSelector
                      assignments={roomClinicalPackages}
                      selectedPackageId={selectedClinicalPackageId}
                      onValueChange={handleClinicalPackageChange}
                      loading={loadingRoomItems}
                    />
                  </div>
                )}

                {destinationRoomId && (loadingRoomItems || availableRoomProcedures.length > 0 || availableRoomMedicines.length > 0) && (
                  <div className="col-span-3">
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
