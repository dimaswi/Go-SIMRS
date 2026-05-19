import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bpjsApi, roomsApi, masterDataApi, type Room, type RoomUnit, type Bed, type RoomStaff, type MasterData, type Schedule, type DoctorSchedule } from "@/lib/api";
import type { AplicareBedItem, AplicareRefKelasItem } from "@/lib/api/bpjs";
import { roomProceduresApi } from "@/lib/api/procedures";
import type { RoomProcedure } from "@/lib/api/procedures";
import { roomInventoriesApi, type RoomInventory } from "@/lib/api/inventories";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
import { roomClinicalPackagesApi, type RoomClinicalPackage } from "@/lib/api/clinical-packages";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  BedDouble,
  Plus,
  DoorOpen,
  ChevronLeft,
  Layers,
  User,
  Calendar,
  Clock,
  Trash2,
  Monitor,
  Eye,
  Search,
} from "lucide-react";
import { UnitFormDialog } from "./components/kamar/unit-form-dialog";
import { BedFormDialog } from "./components/bed/bed-form-dialog";
import { StaffFormDialog } from "./components/staff/staff-form-dialog";
import { ScheduleFormDialog } from "./components/jadwal/schedule-form-dialog";
import { DoctorScheduleFormDialog } from "./components/jadwal/doctor-schedule-form-dialog";
import { RoomProcedureFormDialog } from "./components/tindakan/room-procedure-form-dialog";
import { ProcedureAssignmentPanel } from "./components/tindakan/procedure-assignment-panel";
import { RoomInventoryFormDialog } from "./components/inventory/room-inventory-form-dialog";
import { InventoryAssignmentPanel } from "./components/inventory/inventory-assignment-panel";
import { RoomMedicineFormDialog } from "./components/medicine/room-medicine-form-dialog";
import { MedicineAssignmentPanel } from "./components/medicine/medicine-assignment-panel";
import { ClinicalPackageAssignmentPanel } from "./components/clinical-package-assignment-panel";
import { StaffAssignmentPanel } from "./components/staff/staff-assignment-panel";
import { RoomTariffPanel } from "./components/tariff/room-tariff-panel";

function mapRoomClassToAplicare(roomClass?: string) {
  switch ((roomClass || "").toLowerCase()) {
    case "vvip":
      return "VVP";
    case "vip":
      return "VIP";
    case "kelas_1":
      return "KLS1";
    case "kelas_2":
      return "KLS2";
    case "kelas_3":
      return "KLS3";
    case "icu":
      return "ICU";
    case "iccu":
      return "ICCU";
    case "isolasi":
      return "ISO";
    default:
      return "";
  }
}

export default function RoomShow() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [units, setUnits] = useState<RoomUnit[]>([]);
  const [staff, setStaff] = useState<RoomStaff[]>([]);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [registeringAplicare, setRegisteringAplicare] = useState(false);
  const [aplicareMapping, setAplicareMapping] = useState<AplicareBedItem | null>(null);
  const [aplicareDialogOpen, setAplicareDialogOpen] = useState(false);
  const [aplicareDeleteDialogOpen, setAplicareDeleteDialogOpen] = useState(false);
  const [aplicareRefKelas, setAplicareRefKelas] = useState<AplicareRefKelasItem[]>([]);
  const [aplicareRefKelasLoading, setAplicareRefKelasLoading] = useState(false);
  const [useGenderAvailability, setUseGenderAvailability] = useState(false);
  const [aplicareForm, setAplicareForm] = useState({
    kodekelas: "",
    koderuang: "",
    namaruang: "",
    kapasitas: "0",
    tersedia: "0",
    tersediapria: "0",
    tersediawanita: "0",
    tersediapriawanita: "0",
  });

  // Selected unit for bed management
  const [selectedUnit, setSelectedUnit] = useState<RoomUnit | null>(null);

  // Dialog states
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<RoomUnit | null>(null);
  const [deleteUnitDialogOpen, setDeleteUnitDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<number | null>(null);

  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [deleteBedDialogOpen, setDeleteBedDialogOpen] = useState(false);
  const [bedToDelete, setBedToDelete] = useState<number | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [bedSearch, setBedSearch] = useState("");

  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [deleteStaffDialogOpen, setDeleteStaffDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<number | null>(null);

  // Schedule states
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteScheduleDialogOpen, setDeleteScheduleDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [doctorScheduleDialogOpen, setDoctorScheduleDialogOpen] = useState(false);

  const [editingDoctorSchedule, setEditingDoctorSchedule] = useState<DoctorSchedule | null>(null);
  const [deleteDoctorScheduleDialogOpen, setDeleteDoctorScheduleDialogOpen] = useState(false);
  const [doctorScheduleToDelete, setDoctorScheduleToDelete] = useState<number | null>(null);

  // Room Procedures states
  const [roomProcedures, setRoomProcedures] = useState<RoomProcedure[]>([]);
  const [roomProcedureDialogOpen, setRoomProcedureDialogOpen] = useState(false);
  const [deleteRoomProcedureDialogOpen, setDeleteRoomProcedureDialogOpen] = useState(false);
  const [roomProcedureToDelete, setRoomProcedureToDelete] = useState<number | null>(null);

  // Room Inventories states
  const [roomInventories, setRoomInventories] = useState<RoomInventory[]>([]);
  const [roomInventoryDialogOpen, setRoomInventoryDialogOpen] = useState(false);
  const [deleteRoomInventoryDialogOpen, setDeleteRoomInventoryDialogOpen] = useState(false);
  const [roomInventoryToDelete, setRoomInventoryToDelete] = useState<number | null>(null);

  // Room Medicines states
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  const [roomClinicalPackages, setRoomClinicalPackages] = useState<RoomClinicalPackage[]>([]);
  const [roomMedicineDialogOpen, setRoomMedicineDialogOpen] = useState(false);
  const [deleteRoomMedicineDialogOpen, setDeleteRoomMedicineDialogOpen] = useState(false);
  const [roomMedicineToDelete, setRoomMedicineToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    try {
      const [roomRes, masterDataRes] = await Promise.all([
        roomsApi.getById(parseInt(id)),
        masterDataApi.getMultiple(['service_type', 'room_type', 'room_class', 'bed_type', 'bed_status', 'room_staff_role'])
      ]);

      const roomData = roomRes.data.data;
      setRoom(roomData);
      setUnits(roomData.units || []);

      // Load staff separately
      const staffRes = await roomsApi.getStaff(parseInt(id));
      setStaff(staffRes.data.data || []);

      // Load schedules if room has schedule
      if (roomData.has_schedule) {
        const [schedulesRes, doctorSchedulesRes] = await Promise.all([
          roomsApi.getSchedules(parseInt(id)),
          roomsApi.getDoctorSchedules(parseInt(id)),
        ]);
        setSchedules(schedulesRes.data.data || []);
        setDoctorSchedules(doctorSchedulesRes.data.data || []);
      }

      // Load room procedures
      try {
        const proceduresRes = await roomProceduresApi.getByRoom(parseInt(id));
        setRoomProcedures(proceduresRes.data.data || []);
      } catch {
        setRoomProcedures([]);
      }

      // Load room inventories
      try {
        const inventoriesRes = await roomInventoriesApi.getByRoom(parseInt(id));
        setRoomInventories(inventoriesRes.data.data || []);
      } catch {
        setRoomInventories([]);
      }

      // Load room medicines
      try {
        const medicinesRes = await roomMedicinesApi.getByRoom(parseInt(id));
        setRoomMedicines(medicinesRes.data.data || []);
      } catch {
        setRoomMedicines([]);
      }

      try {
        const packagesRes = await roomClinicalPackagesApi.getByRoom(parseInt(id));
        setRoomClinicalPackages(packagesRes.data.data || []);
      } catch {
        setRoomClinicalPackages([]);
      }

      setMasterData(masterDataRes.data.data || {});
      setPageTitle(roomData.name);

      // If we have a selected unit, refresh its data
      if (selectedUnit) {
        const updatedUnit = (roomData.units || []).find((u: RoomUnit) => u.id === selectedUnit.id);
        if (updatedUnit) {
          setSelectedUnit(updatedUnit);
        } else {
          setSelectedUnit(null);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data ruangan.",
      });
      navigate("/rooms");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast, selectedUnit?.id]);

  const loadAplicareMapping = useCallback(async () => {
    if (!id || !room?.code) return;

    try {
      const response = await bpjsApi.aplicareReadBed(1, 500);
      const items = response.data.data || [];
      const mappedRoom = items.find((item) => item.koderuang === room.code) || null;
      setAplicareMapping(mappedRoom);
    } catch {
      setAplicareMapping(null);
    }
  }, [id, room?.code]);

  const loadAplicareRefKelas = useCallback(async () => {
    try {
      setAplicareRefKelasLoading(true);
      const response = await bpjsApi.aplicareGetRefKelas();
      setAplicareRefKelas(response.data.data || []);
    } catch {
      setAplicareRefKelas([]);
      toast({
        variant: "destructive",
        title: "Gagal memuat referensi kelas Aplicare",
        description: "Daftar kelas BPJS dari Aplicare tidak berhasil diambil.",
      });
    } finally {
      setAplicareRefKelasLoading(false);
    }
  }, [toast]);

  const initializeAplicareForm = useCallback(() => {
    if (!room) return;

    const tersediapria = String(aplicareMapping?.tersediapria ?? 0);
    const tersediawanita = String(aplicareMapping?.tersediawanita ?? 0);
    const tersediapriawanita = String(aplicareMapping?.tersediapriawanita ?? 0);

    setUseGenderAvailability(
      (aplicareMapping?.tersediapria ?? 0) > 0 ||
      (aplicareMapping?.tersediawanita ?? 0) > 0
    );

    setAplicareForm({
      kodekelas: aplicareMapping?.kodekelas || room.kode_kelas_bpjs || mapRoomClassToAplicare(room.room_class),
      koderuang: aplicareMapping?.koderuang || room.code || "",
      namaruang: aplicareMapping?.namaruang || room.name || "",
      kapasitas: String(aplicareMapping?.kapasitas ?? room.total_beds ?? 0),
      tersedia: String(aplicareMapping?.tersedia ?? room.available_beds ?? 0),
      tersediapria: tersediapria,
      tersediawanita: tersediawanita,
      tersediapriawanita: tersediapriawanita,
    });
  }, [aplicareMapping, room]);

  const handleGenderAvailabilityChange = (checked: boolean) => {
    setUseGenderAvailability(checked);
    if (!checked) {
      setAplicareForm((current) => ({
        ...current,
        tersediapria: "0",
        tersediawanita: "0",
        tersediapriawanita: "0",
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (room?.code) {
      loadAplicareMapping();
    }
  }, [loadAplicareMapping, room?.code]);

  useEffect(() => {
    if (aplicareDialogOpen && room) {
      initializeAplicareForm();
      if (!aplicareMapping && aplicareRefKelas.length === 0) {
        loadAplicareRefKelas();
      }
    }
  }, [aplicareDialogOpen, aplicareMapping, aplicareRefKelas.length, initializeAplicareForm, loadAplicareRefKelas, room]);

  // Reload when selectedUnit changes (to refresh bed data)
  useEffect(() => {
    if (selectedUnit && id) {
      // Reload room data to get fresh unit/bed data
      loadData();
    }
  }, []);

  // Helper to get master data name
  const getMasterDataName = (category: string, code: string): string => {
    const items = masterData[category] || [];
    const item = items.find(i => i.code === code);
    return item?.name || code;
  };

  const filteredUnits = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    if (!query) return units;

    return units.filter((unit) => {
      const searchable = [
        unit.name,
        unit.code,
        `lantai ${unit.floor}`,
        unit.is_active ? 'aktif' : 'tidak aktif',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [unitSearch, units]);

  const filteredBeds = useMemo(() => {
    const query = bedSearch.trim().toLowerCase();
    const beds = selectedUnit?.beds || [];
    if (!query) return beds;

    return beds.filter((bed) => {
      const searchable = [
        bed.bed_number,
        bed.bed_type ? getMasterDataName('bed_type', bed.bed_type) : '',
        getMasterDataName('bed_status', bed.status),
        bed.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [bedSearch, selectedUnit, masterData]);

  // Unit handlers
  const handleAddUnit = () => {
    setEditingUnit(null);
    setUnitDialogOpen(true);
  };

  const handleEditUnit = (unit: RoomUnit) => {
    setEditingUnit(unit);
    setUnitDialogOpen(true);
  };

  const handleViewUnit = (unit: RoomUnit) => {
    setSelectedUnit(unit);
  };

  const handleDeleteUnit = (unitId: number) => {
    setUnitToDelete(unitId);
    setDeleteUnitDialogOpen(true);
  };

  const confirmDeleteUnit = async () => {
    if (!id || !unitToDelete) return;

    try {
      await roomsApi.deleteUnit(parseInt(id), unitToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Kamar berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus kamar.",
      });
    } finally {
      setDeleteUnitDialogOpen(false);
      setUnitToDelete(null);
    }
  };

  // Bed handlers
  const handleAddBed = () => {
    setEditingBed(null);
    setBedDialogOpen(true);
  };

  const handleEditBed = (bed: Bed) => {
    setEditingBed(bed);
    setBedDialogOpen(true);
  };

  const handleDeleteBed = (bedId: number) => {
    setBedToDelete(bedId);
    setDeleteBedDialogOpen(true);
  };

  const confirmDeleteBed = async () => {
    if (!id || !selectedUnit || !bedToDelete) return;

    try {
      await roomsApi.deleteBed(parseInt(id), selectedUnit.id, bedToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tempat tidur berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus tempat tidur.",
      });
    } finally {
      setDeleteBedDialogOpen(false);
      setBedToDelete(null);
    }
  };

  // Staff handlers - handleDeleteStaff is kept but handled in panel now
  const confirmDeleteStaff = async () => {
    if (!id || !staffToDelete) return;

    try {
      await roomsApi.removeStaff(parseInt(id), staffToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Staff berhasil dihapus dari ruangan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus staff.",
      });
    } finally {
      setDeleteStaffDialogOpen(false);
      setStaffToDelete(null);
    }
  };

  // Schedule handlers
  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setScheduleDialogOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setScheduleDialogOpen(true);
  };

  const handleDeleteSchedule = (scheduleId: number) => {
    setScheduleToDelete(scheduleId);
    setDeleteScheduleDialogOpen(true);
  };

  const confirmDeleteSchedule = async () => {
    if (!id || !scheduleToDelete) return;

    try {
      await roomsApi.deleteSchedule(parseInt(id), scheduleToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Jadwal berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus jadwal.",
      });
    } finally {
      setDeleteScheduleDialogOpen(false);
      setScheduleToDelete(null);
    }
  };

  // Doctor Schedule handlers
  const handleAddDoctorSchedule = () => {
    setEditingDoctorSchedule(null);
    setDoctorScheduleDialogOpen(true);
  };

  const handleEditDoctorSchedule = (schedule: DoctorSchedule) => {
    setEditingDoctorSchedule(schedule);
    setDoctorScheduleDialogOpen(true);
  };

  const handleDeleteDoctorSchedule = (scheduleId: number) => {
    setDoctorScheduleToDelete(scheduleId);
    setDeleteDoctorScheduleDialogOpen(true);
  };

  const confirmDeleteDoctorSchedule = async () => {
    if (!id || !doctorScheduleToDelete) return;

    try {
      await roomsApi.deleteDoctorSchedule(parseInt(id), doctorScheduleToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Jadwal dokter berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus jadwal dokter.",
      });
    } finally {
      setDeleteDoctorScheduleDialogOpen(false);
      setDoctorScheduleToDelete(null);
    }
  };

  const confirmDeleteRoomProcedure = async () => {
    if (!id || !roomProcedureToDelete) return;

    try {
      await roomProceduresApi.delete(parseInt(id), roomProcedureToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil dihapus dari ruangan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus tindakan.",
      });
    } finally {
      setDeleteRoomProcedureDialogOpen(false);
      setRoomProcedureToDelete(null);
    }
  };

  // Room Inventory handlers - handled in panel now, keep confirm for delete dialog
  const confirmDeleteRoomInventory = async () => {
    if (!id || !roomInventoryToDelete) return;

    try {
      await roomInventoriesApi.remove(parseInt(id), roomInventoryToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Inventaris berhasil dihapus dari ruangan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus inventaris.",
      });
    } finally {
      setDeleteRoomInventoryDialogOpen(false);
      setRoomInventoryToDelete(null);
    }
  };

  // Room Medicine handlers - handled in panel now, keep confirm for delete dialog
  const confirmDeleteRoomMedicine = async () => {
    if (!id || !roomMedicineToDelete) return;

    try {
      await roomMedicinesApi.remove(parseInt(id), roomMedicineToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Obat berhasil dihapus dari ruangan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus obat.",
      });
    } finally {
      setDeleteRoomMedicineDialogOpen(false);
      setRoomMedicineToDelete(null);
    }
  };

  const getBedStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'available':
        return 'default';
      case 'occupied':
        return 'destructive';
      case 'reserved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return null;
  }

  const handleRegisterAplicare = async () => {
    if (!room) return;
    try {
      setRegisteringAplicare(true);
      const response = await bpjsApi.aplicareCreateRoom({
        room_id: room.id,
        ...aplicareForm,
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Ruangan berhasil didaftarkan ke Aplicare.",
      });
      setAplicareDialogOpen(false);
      await loadAplicareMapping();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mendaftarkan ruangan",
        description: error.response?.data?.error || "Ruangan gagal didaftarkan ke Aplicare.",
      });
    } finally {
      setRegisteringAplicare(false);
    }
  };

  const handleDeleteAplicare = async () => {
    if (!aplicareMapping) return;

    try {
      setRegisteringAplicare(true);
      const response = await bpjsApi.aplicareDeleteRoom(aplicareMapping.kodekelas, aplicareMapping.koderuang);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Ruangan berhasil dihapus dari Aplicare.",
      });
      setAplicareMapping(null);
      setAplicareDeleteDialogOpen(false);
      setAplicareDialogOpen(false);
      await loadAplicareMapping();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus ruangan dari Aplicare",
        description: error.response?.data?.error || "Ruangan gagal dihapus dari Aplicare.",
      });
    } finally {
      setRegisteringAplicare(false);
    }
  };

  const totalBeds = room.total_beds || 0;
  const availableBeds = room.available_beds || 0;
  const aplicareKodeKelas = room.kode_kelas_bpjs || mapRoomClassToAplicare(room.room_class);
  const aplicareSummary = aplicareMapping
    ? {
        kodeRuang: aplicareMapping.koderuang || room.code,
        namaRuang: aplicareMapping.namaruang || room.name,
        kodeKelas: aplicareMapping.kodekelas || aplicareKodeKelas,
        ketersediaan: `${aplicareMapping.tersedia || 0} / ${aplicareMapping.kapasitas || 0}`,
      }
    : {
        kodeRuang: aplicareForm.koderuang || room.code,
        namaRuang: aplicareForm.namaruang || room.name,
        kodeKelas: aplicareForm.kodekelas || aplicareKodeKelas,
        ketersediaan: `${aplicareForm.tersedia || 0} / ${aplicareForm.kapasitas || 0}`,
      };
  const aplicareValidations = [
    {
      label: "Ruangan memiliki bed",
      passed: room.has_bed,
      value: room.has_bed ? "Siap" : "Ruangan belum mendukung bed",
    },
    {
      label: "Kode ruangan tersedia",
      passed: Boolean(room.code),
      value: room.code || "-",
    },
    {
      label: "Nama ruangan tersedia",
      passed: Boolean(room.name),
      value: room.name || "-",
    },
    {
      label: "Kode kelas BPJS tersedia",
      passed: Boolean(aplicareForm.kodekelas || aplicareKodeKelas),
      value: aplicareForm.kodekelas || aplicareKodeKelas || "Belum ada mapping kelas",
    },
    {
      label: "Kapasitas bed siap dikirim",
      passed: Number(aplicareForm.kapasitas) > 0,
      value: `${aplicareForm.kapasitas || 0} total bed`,
    },
  ];
  const canSubmitAplicare = aplicareValidations.every((item) => item.passed);

  return (
    <PageShell>
      <PageHeader
        title={room.name}
        description={room.code}
        icon={DoorOpen}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.history.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {room.has_bed && (
              <Button
                onClick={() => navigate(`/bed-monitoring/${room.id}`)}
                size="sm"
                variant="outline"
              >
                <Monitor className="mr-2 h-4 w-4" />
                Monitoring
              </Button>
            )}
            {hasPermission("integrations.manage") && room.has_bed && (
              <Button
                onClick={() => setAplicareDialogOpen(true)}
                size="sm"
                variant="outline"
                disabled={registeringAplicare}
              >
                {registeringAplicare ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BedDouble className="mr-2 h-4 w-4" />
                )}
                {aplicareMapping ? "Detail Aplicare" : "Tambah ke Aplicare"}
              </Button>
            )}
            {hasPermission("rooms.update") && (
              <Button onClick={() => navigate(`/rooms/${room.id}/edit`)} size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      >
      </PageHeader>
      <PageContent className="min-w-0 overflow-x-hidden">
        <div className="min-w-0 overflow-hidden border border-border/70 bg-background">
          <div className="min-w-0 p-3 sm:p-4">
            {/* Show beds for selected unit OR show main tabs */}
            {selectedUnit ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUnit(null)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Kembali
                    </Button>
                    <div>
                      <h3 className="text-sm font-semibold">{selectedUnit.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedUnit.code} â€¢ Lantai {selectedUnit.floor} â€¢
                        Kapasitas {selectedUnit.capacity} bed
                      </p>
                    </div>
                  </div>
                  {hasPermission('rooms.update') && (selectedUnit.beds?.length || 0) < selectedUnit.capacity && (
                    <Button onClick={handleAddBed} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Bed
                    </Button>
                  )}
                </div>
                {hasPermission('rooms.update') && (selectedUnit.beds?.length || 0) >= selectedUnit.capacity && (
                  <div className="flex justify-end">
                    <p className="text-sm text-muted-foreground">
                      Kapasitas kamar sudah penuh ({selectedUnit.beds?.length || 0}/{selectedUnit.capacity})
                    </p>
                  </div>
                )}
                <div className="min-w-0 overflow-hidden border border-border/70">
                  {(selectedUnit.beds || []).length > 0 ? (
                    <>
                      <div className="border-b border-border/70 px-3 py-3">
                        <div className="relative max-w-sm">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={bedSearch}
                            onChange={(event) => setBedSearch(event.target.value)}
                            placeholder="Cari bed, tipe, status, atau catatan..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="max-h-[26rem] overflow-y-auto pb-3">
                      <table className="w-full table-fixed text-sm">
                        <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                          <tr>
                            <th className="w-[18%] px-3 py-2.5 font-medium">Bed</th>
                            <th className="w-[20%] px-3 py-2.5 font-medium">Tipe</th>
                            <th className="w-[18%] px-3 py-2.5 font-medium">Status</th>
                            <th className="w-[30%] px-3 py-2.5 font-medium">Catatan</th>
                            <th className="w-[14%] px-3 py-2.5 text-right font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredBeds.map((bed) => (
                            <tr key={bed.id} className="bg-background align-top">
                              <td className="px-3 py-3 font-medium break-words">{bed.bed_number}</td>
                              <td className="px-3 py-3 text-muted-foreground break-words">
                                {bed.bed_type ? getMasterDataName('bed_type', bed.bed_type) : '-'}
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant={getBedStatusBadgeVariant(bed.status)}>
                                  {getMasterDataName('bed_status', bed.status)}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-muted-foreground break-words">{bed.notes || '-'}</td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-1">
                                  {hasPermission('rooms.update') && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditBed(bed)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {hasPermission('rooms.update') && bed.status !== 'occupied' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBed(bed.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Belum ada tempat tidur pada kamar ini.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Tabs defaultValue="detail" variant="inline" className="min-w-0 w-full overflow-hidden">
                <TabsList className="mb-4 h-auto flex-wrap gap-1 border-b border-border/70">
                  <TabsTrigger value="detail" className="px-2.5 py-1.5 text-xs">
                    Detail
                  </TabsTrigger>
                  {room.has_bed && (
                    <TabsTrigger value="units" className="px-2.5 py-1.5 text-xs">
                      Kamar
                    </TabsTrigger>
                  )}
                  {room.has_schedule && (
                    <TabsTrigger value="schedules" className="px-2.5 py-1.5 text-xs">
                      Jadwal
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="staff" className="px-2.5 py-1.5 text-xs">
                    Staff
                  </TabsTrigger>
                  <TabsTrigger value="procedures" className="px-2.5 py-1.5 text-xs">
                    Tindakan
                  </TabsTrigger>
                  <TabsTrigger value="clinical-packages" className="px-2.5 py-1.5 text-xs">
                    Paket
                  </TabsTrigger>
                  <TabsTrigger value="inventories" className="px-2.5 py-1.5 text-xs">
                    Inventaris
                  </TabsTrigger>
                  <TabsTrigger value="medicines" className="px-2.5 py-1.5 text-xs">
                    Obat
                  </TabsTrigger>
                  <TabsTrigger value="tariffs" className="px-2.5 py-1.5 text-xs">
                    Tarif
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="detail" className="mt-0 min-w-0 overflow-hidden">
                  {/* Room Info */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Jenis Layanan</p>
                      <Badge variant="secondary">{getMasterDataName('service_type', room.service_type)}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipe Ruangan</p>
                      <p className="text-sm font-medium">{getMasterDataName('room_type', room.room_type)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kelas Ruangan</p>
                      {room.room_class ? (
                        <Badge variant="outline">{getMasterDataName('room_class', room.room_class)}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                    {/* Registration Fee - untuk semua ruangan */}
                    <div>
                      <p className="text-xs text-muted-foreground">Tarif Pendaftaran</p>
                      <p className="text-sm font-medium">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0,
                        }).format(room.registration_fee || 0)}
                      </p>
                    </div>
                    {room.service_type === 'rawat_inap' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Layers className="h-3 w-3" /> Jumlah Lantai
                          </p>
                          <p className="text-sm font-medium">{room.total_floors} lantai</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tarif per Hari</p>
                          <p className="text-sm font-medium">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(room.tariff_per_day)}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Penanggung Jawab
                      </p>
                      <p className="text-sm font-medium">
                        {room.pic_employee?.nama_lengkap || <span className="text-muted-foreground">Belum ditentukan</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fitur Ruangan</p>
                      <div className="flex items-center gap-2 mt-1">
                        {room.has_bed && (
                          <Badge variant="outline" className="text-xs">
                            <BedDouble className="h-3 w-3 mr-1" />
                            Ada Bed
                          </Badge>
                        )}
                        {room.has_schedule && (
                          <Badge variant="outline" className="text-xs">
                            Jadwal
                          </Badge>
                        )}
                        {!room.has_bed && !room.has_schedule && (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                    {room.has_bed && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <DoorOpen className="h-3 w-3" /> Jumlah Kamar
                          </p>
                          <p className="text-sm font-medium">{units.length} kamar</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <BedDouble className="h-3 w-3" /> Ketersediaan Bed
                          </p>
                          <p className="text-sm font-medium">
                            <span className="text-green-600">{availableBeds} tersedia</span>
                            {" / "}
                            <span>{totalBeds} total</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {room.facilities && (
                    <>
                      <hr className="border-border/50 my-6" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fasilitas</p>
                        <p className="text-sm">{room.facilities}</p>
                      </div>
                    </>
                  )}

                  {room.description && (
                    <>
                      <hr className="border-border/50 my-6" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Deskripsi</p>
                        <p className="text-sm">{room.description}</p>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="units" className="mt-0 min-w-0 overflow-hidden">
                  <div className="space-y-4">
                    {hasPermission('rooms.update') && room.has_bed && (
                      <div className="flex justify-end">
                        <Button onClick={handleAddUnit} size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Tambah Kamar
                        </Button>
                      </div>
                    )}
                    {room.has_bed ? (
                      <div className="min-w-0 overflow-hidden border border-border/70">
                        {units.length > 0 ? (
                          <>
                            <div className="border-b border-border/70 px-3 py-3">
                              <div className="relative max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  value={unitSearch}
                                  onChange={(event) => setUnitSearch(event.target.value)}
                                  placeholder="Cari kamar, kode, lantai, atau status..."
                                  className="pl-9"
                                />
                              </div>
                            </div>
                          <div className="max-h-[26rem] overflow-y-auto pb-3">
                            <table className="w-full table-fixed text-sm">
                              <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                                <tr>
                                  <th className="w-[34%] px-3 py-2.5 font-medium">Kamar</th>
                                  <th className="w-[14%] px-3 py-2.5 font-medium">Lantai</th>
                                  <th className="w-[18%] px-3 py-2.5 font-medium">Bed</th>
                                  <th className="w-[20%] px-3 py-2.5 font-medium">Status</th>
                                  <th className="w-[14%] px-3 py-2.5 text-right font-medium">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {filteredUnits.map((unit) => {
                                  const beds = unit.beds || [];
                                  const available = beds.filter((bed) => bed.status === 'available').length;

                                  return (
                                    <tr key={unit.id} className="bg-background align-top">
                                      <td className="px-3 py-3">
                                        <div className="font-medium break-words">{unit.name}</div>
                                        <div className="text-xs text-muted-foreground break-words">{unit.code}</div>
                                      </td>
                                      <td className="px-3 py-3 text-muted-foreground">Lantai {unit.floor}</td>
                                      <td className="px-3 py-3">
                                        <div className="font-medium">{beds.length}/{unit.capacity}</div>
                                        <div className="text-xs text-muted-foreground">{available} tersedia</div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                                          {unit.is_active ? 'Aktif' : 'Tidak Aktif'}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="flex justify-end gap-1">
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewUnit(unit)}>
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          {hasPermission('rooms.update') && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUnit(unit)}>
                                              <Pencil className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {hasPermission('rooms.update') && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUnit(unit.id)}>
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          </>
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            Belum ada kamar untuk ruangan ini.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BedDouble className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Ruangan ini tidak memiliki fitur tempat tidur</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Schedules Tab */}
                <TabsContent value="schedules" className="mt-0 min-w-0 overflow-hidden">
                  <div className="space-y-6">
                    {/* Room Schedule (Jadwal Poli) */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Jadwal Operasional
                          </h4>
                          <p className="text-xs text-muted-foreground">Jadwal buka ruangan per hari</p>
                        </div>
                        {hasPermission('rooms.update') && (
                          <Button onClick={handleAddSchedule} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Jadwal
                          </Button>
                        )}
                      </div>

                      {schedules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((dayName, idx) => {
                            const dayIdx = idx === 6 ? 0 : idx + 1; // Convert to 0=Sunday format
                            const daySchedules = schedules.filter(s => s.day_of_week === dayIdx);
                            return (
                              <div key={dayName} className="border rounded-lg p-3">
                                <div className="font-medium text-sm mb-2">{dayName}</div>
                                {daySchedules.length > 0 ? (
                                  <div className="space-y-2">
                                    {daySchedules.map(schedule => (
                                      <div key={schedule.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                                        <span>{schedule.start_time} - {schedule.end_time}</span>
                                        <div className="flex items-center gap-1">
                                          {schedule.max_patients > 0 && (
                                            <Badge variant="outline" className="text-xs">Max {schedule.max_patients}</Badge>
                                          )}
                                          {hasPermission('rooms.update') && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleEditSchedule(schedule)}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive"
                                                onClick={() => handleDeleteSchedule(schedule.id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Tutup</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Belum ada jadwal operasional</p>
                        </div>
                      )}
                    </div>

                    <hr className="border-border/50" />

                    {/* Doctor Schedule (Jadwal Dokter) */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Jadwal Dokter
                          </h4>
                          <p className="text-xs text-muted-foreground">Jadwal praktik dokter di ruangan ini</p>
                        </div>
                        {hasPermission('rooms.update') && (
                          <Button onClick={handleAddDoctorSchedule} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Jadwal Dokter
                          </Button>
                        )}
                      </div>

                      {doctorSchedules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((dayName, idx) => {
                            const dayIdx = idx === 6 ? 0 : idx + 1;
                            const daySchedules = doctorSchedules.filter(s => s.day_of_week === dayIdx);
                            return (
                              <div key={dayName} className="border rounded-lg p-3">
                                <div className="font-medium text-sm mb-2">{dayName}</div>
                                {daySchedules.length > 0 ? (
                                  <div className="space-y-2">
                                    {daySchedules.map(schedule => (
                                      <div key={schedule.id} className="text-sm bg-muted/50 rounded px-2 py-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">{schedule.employee?.nama_lengkap || 'Unknown'}</span>
                                          {hasPermission('rooms.update') && (
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleEditDoctorSchedule(schedule)}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive"
                                                onClick={() => handleDeleteDoctorSchedule(schedule.id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Clock className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs">{schedule.start_time} - {schedule.end_time}</span>
                                          {schedule.max_patients > 0 && (
                                            <Badge variant="outline" className="text-xs">Max {schedule.max_patients}</Badge>
                                          )}
                                        </div>
                                        {schedule.consult_fee > 0 && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Tarif: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(schedule.consult_fee)}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Tidak ada jadwal</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground border rounded-lg">
                          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Belum ada jadwal dokter</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="staff" className="mt-0 min-w-0 overflow-hidden">
                  <StaffAssignmentPanel
                    roomId={parseInt(id!)}
                    masterData={masterData}
                    staff={staff}
                    onRefresh={loadData}
                    hasPermission={hasPermission('rooms.update')}
                  />
                </TabsContent>

                <TabsContent value="procedures" className="mt-0 min-w-0 overflow-hidden">
                  <ProcedureAssignmentPanel
                    roomId={parseInt(id!)}
                    roomProcedures={roomProcedures}
                    onRefresh={loadData}
                    hasPermission={hasPermission('rooms.update')}
                  />
                </TabsContent>

                <TabsContent value="clinical-packages" className="mt-0 min-w-0 overflow-hidden">
                  <ClinicalPackageAssignmentPanel
                    roomId={parseInt(id!)}
                    assignments={roomClinicalPackages}
                    onRefresh={loadData}
                    hasPermission={hasPermission('rooms.update')}
                  />
                </TabsContent>

                <TabsContent value="inventories" className="mt-0 min-w-0 overflow-hidden">
                  <InventoryAssignmentPanel
                    roomId={parseInt(id!)}
                    roomInventories={roomInventories}
                    onRefresh={loadData}
                    hasPermission={hasPermission('inventories.create')}
                  />
                </TabsContent>

                <TabsContent value="medicines" className="mt-0 min-w-0 overflow-hidden">
                  <MedicineAssignmentPanel
                    roomId={parseInt(id!)}
                    roomMedicines={roomMedicines}
                    onRefresh={loadData}
                    hasPermission={hasPermission('medicines.create')}
                  />
                </TabsContent>

                {/* Room Tariffs Tab (for all room types) */}
                <TabsContent value="tariffs" className="mt-0 min-w-0 overflow-hidden">
                  <RoomTariffPanel
                    roomId={parseInt(id!)}
                    hasPermission={hasPermission}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Dialogs */}
          <UnitFormDialog
            open={unitDialogOpen}
            onOpenChange={setUnitDialogOpen}
            roomId={parseInt(id!)}
            totalFloors={room.total_floors}
            unit={editingUnit}
            onSuccess={loadData}
          />

          {selectedUnit && (
            <BedFormDialog
              open={bedDialogOpen}
              onOpenChange={setBedDialogOpen}
              roomId={parseInt(id!)}
              unitId={selectedUnit.id}
              bed={editingBed}
              masterData={masterData}
              onSuccess={loadData}
            />
          )}

          <StaffFormDialog
            open={staffDialogOpen}
            onOpenChange={setStaffDialogOpen}
            roomId={parseInt(id!)}
            masterData={masterData}
            onSuccess={loadData}
          />

          <ConfirmDialog
            open={deleteUnitDialogOpen}
            onOpenChange={setDeleteUnitDialogOpen}
            onConfirm={confirmDeleteUnit}
            title="Hapus Kamar"
            description="Apakah Anda yakin ingin menghapus kamar ini? Pastikan tidak ada tempat tidur di kamar ini."
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          <ConfirmDialog
            open={deleteBedDialogOpen}
            onOpenChange={setDeleteBedDialogOpen}
            onConfirm={confirmDeleteBed}
            title="Hapus Tempat Tidur"
            description="Apakah Anda yakin ingin menghapus tempat tidur ini?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          <ConfirmDialog
            open={deleteStaffDialogOpen}
            onOpenChange={setDeleteStaffDialogOpen}
            onConfirm={confirmDeleteStaff}
            title="Hapus Staff"
            description="Apakah Anda yakin ingin menghapus staff ini dari ruangan?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          {/* Schedule Dialogs */}
          <ScheduleFormDialog
            open={scheduleDialogOpen}
            onOpenChange={setScheduleDialogOpen}
            roomId={parseInt(id!)}
            schedule={editingSchedule}
            onSuccess={loadData}
          />

          <DoctorScheduleFormDialog
            open={doctorScheduleDialogOpen}
            onOpenChange={setDoctorScheduleDialogOpen}
            roomId={parseInt(id!)}
            schedule={editingDoctorSchedule}
            onSuccess={loadData}
          />

          <RoomProcedureFormDialog
            open={roomProcedureDialogOpen}
            onOpenChange={setRoomProcedureDialogOpen}
            roomId={parseInt(id!)}
            roomProcedure={null}
            onSuccess={loadData}
          />

          <ConfirmDialog
            open={deleteScheduleDialogOpen}
            onOpenChange={setDeleteScheduleDialogOpen}
            onConfirm={confirmDeleteSchedule}
            title="Hapus Jadwal"
            description="Apakah Anda yakin ingin menghapus jadwal ini?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          <ConfirmDialog
            open={deleteDoctorScheduleDialogOpen}
            onOpenChange={setDeleteDoctorScheduleDialogOpen}
            onConfirm={confirmDeleteDoctorSchedule}
            title="Hapus Jadwal Dokter"
            description="Apakah Anda yakin ingin menghapus jadwal dokter ini?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          <ConfirmDialog
            open={deleteRoomProcedureDialogOpen}
            onOpenChange={setDeleteRoomProcedureDialogOpen}
            onConfirm={confirmDeleteRoomProcedure}
            title="Hapus Tindakan"
            description="Apakah Anda yakin ingin menghapus tindakan ini dari ruangan?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          {/* Room Inventory Dialogs */}
          <RoomInventoryFormDialog
            open={roomInventoryDialogOpen}
            onOpenChange={setRoomInventoryDialogOpen}
            roomId={parseInt(id!)}
            roomInventory={null}
            onSuccess={loadData}
          />

          <ConfirmDialog
            open={deleteRoomInventoryDialogOpen}
            onOpenChange={setDeleteRoomInventoryDialogOpen}
            onConfirm={confirmDeleteRoomInventory}
            title="Hapus Inventaris"
            description="Apakah Anda yakin ingin menghapus inventaris ini dari ruangan?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          {/* Room Medicine Dialogs */}
          <RoomMedicineFormDialog
            open={roomMedicineDialogOpen}
            onOpenChange={setRoomMedicineDialogOpen}
            roomId={parseInt(id!)}
            roomMedicine={null}
            onSuccess={loadData}
          />

          <ConfirmDialog
            open={deleteRoomMedicineDialogOpen}
            onOpenChange={setDeleteRoomMedicineDialogOpen}
            onConfirm={confirmDeleteRoomMedicine}
            title="Hapus Obat"
            description="Apakah Anda yakin ingin menghapus obat ini dari ruangan?"
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />

          <Dialog open={aplicareDialogOpen} onOpenChange={setAplicareDialogOpen}>
            <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[720px]">
              <DialogHeader>
                <DialogTitle>
                  {aplicareMapping ? "Detail Mapping Aplicare" : "Validasi Pendaftaran ke Aplicare"}
                </DialogTitle>
                <DialogDescription>
                  {aplicareMapping
                    ? "Detail mapping ruangan yang sudah terdaftar di BPJS Aplicare."
                    : "Periksa data ruangan sebelum didaftarkan ke BPJS Aplicare."}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[calc(85vh-10rem)] space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kode Ruangan</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{aplicareSummary.kodeRuang || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nama Ruangan</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{aplicareSummary.namaRuang || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kode Kelas BPJS</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{aplicareSummary.kodeKelas || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ketersediaan Bed</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{aplicareSummary.ketersediaan}</div>
                  </div>
                </div>

                {!aplicareMapping ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/70 bg-background p-4">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-foreground">Form Request Aplicare</div>
                        <div className="text-xs text-muted-foreground">Sesuaikan payload yang akan dikirim ke BPJS sebelum ruangan didaftarkan.</div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Kode Kelas</div>
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                              <Select
                                value={aplicareForm.kodekelas}
                                onValueChange={(value) => setAplicareForm((current) => ({ ...current, kodekelas: value }))}
                                disabled={aplicareRefKelasLoading || aplicareRefKelas.length === 0}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={aplicareRefKelasLoading ? "Memuat kelas Aplicare..." : "Pilih kelas Aplicare"}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {aplicareRefKelas.map((item) => (
                                    <SelectItem key={item.kodekelas} value={item.kodekelas}>
                                      {item.kodekelas} - {item.namakelas}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                          </div>
                          {!aplicareRefKelasLoading && aplicareRefKelas.length === 0 ? (
                            <div className="text-[11px] text-amber-600">Referensi kelas Aplicare belum tersedia.</div>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Kode Ruang</div>
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                            <Input
                              value={aplicareForm.koderuang}
                              onChange={(event) => setAplicareForm((current) => ({ ...current, koderuang: event.target.value.toUpperCase() }))}
                              placeholder="Kode ruangan di Aplicare"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">Nama Ruang</div>
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                            <Input
                              value={aplicareForm.namaruang}
                              onChange={(event) => setAplicareForm((current) => ({ ...current, namaruang: event.target.value }))}
                              placeholder="Nama ruangan yang dikirim ke Aplicare"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Kapasitas</div>
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                            <Input
                              type="number"
                              min="0"
                              value={aplicareForm.kapasitas}
                              onChange={(event) => setAplicareForm((current) => ({ ...current, kapasitas: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Tersedia</div>
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                            <Input
                              type="number"
                              min="0"
                              value={aplicareForm.tersedia}
                              onChange={(event) => setAplicareForm((current) => ({ ...current, tersedia: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-3 sm:col-span-2">
                          <div className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                            <Checkbox
                              id="aplicare-gender-availability"
                              checked={useGenderAvailability}
                              onCheckedChange={(checked) => handleGenderAvailabilityChange(checked === true)}
                            />
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-foreground">Pisahkan ketersediaan pria dan wanita</div>
                              <div className="text-[11px] text-muted-foreground">
                                Jika dicentang, tampilkan input ketersediaan pria dan wanita. Jika tidak, keduanya dikirim default `0`.
                              </div>
                            </div>
                          </div>
                        </div>
                        {useGenderAvailability ? (
                          <>
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">Tersedia Pria</div>
                              <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={aplicareForm.tersediapria}
                                  onChange={(event) => setAplicareForm((current) => ({ ...current, tersediapria: event.target.value, tersediapriawanita: "0" }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">Tersedia Wanita</div>
                              <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={aplicareForm.tersediawanita}
                                  onChange={(event) => setAplicareForm((current) => ({ ...current, tersediawanita: event.target.value, tersediapriawanita: "0" }))}
                                />
                              </div>
                            </div>
                          </>
                        ) : null}
                        <div className="hidden">
                          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                            <Input
                              type="number"
                              min="0"
                              value={aplicareForm.tersediapriawanita}
                              onChange={(event) => setAplicareForm((current) => ({ ...current, tersediapriawanita: event.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background p-4">
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-foreground">Checklist Validasi</div>
                        <div className="text-xs text-muted-foreground">Ruangan hanya bisa didaftarkan jika seluruh syarat minimum sudah terpenuhi.</div>
                      </div>

                      <div className="space-y-3">
                        {aplicareValidations.map((item) => (
                          <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background px-4 py-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">{item.label}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{item.value}</div>
                            </div>
                            <Badge variant={item.passed ? "default" : "secondary"} className={item.passed ? "bg-green-600 hover:bg-green-600" : ""}>
                              {item.passed ? "Valid" : "Perlu dicek"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/70 bg-background p-4">
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-foreground">Detail Mapping Aplicare</div>
                      <div className="text-xs text-muted-foreground">Informasi ruangan yang saat ini sudah terdaftar di BPJS Aplicare.</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kode Ruang Aplicare</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{aplicareMapping.koderuang}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nama Ruang Aplicare</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{aplicareMapping.namaruang}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kelas Aplicare</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{aplicareMapping.namakelas || aplicareMapping.kodekelas}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kapasitas / Tersedia</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{aplicareMapping.tersedia} / {aplicareMapping.kapasitas}</div>
                    </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {aplicareMapping ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setAplicareDeleteDialogOpen(true)}
                      disabled={registeringAplicare}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus dari Aplicare
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setAplicareDialogOpen(false)}>
                      Tutup
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={() => setAplicareDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="button" onClick={handleRegisterAplicare} disabled={!canSubmitAplicare || registeringAplicare}>
                      {registeringAplicare ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BedDouble className="mr-2 h-4 w-4" />}
                      Daftarkan ke Aplicare
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={aplicareDeleteDialogOpen}
            onOpenChange={setAplicareDeleteDialogOpen}
            onConfirm={handleDeleteAplicare}
            title="Hapus Ruangan dari Aplicare"
            description={`Ruangan ${room.name} akan dihapus dari BPJS Aplicare.`}
            confirmText="Hapus"
            cancelText="Batal"
            variant="destructive"
          />
        </div>
      </PageContent>
    </PageShell>
  );
}



