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
import { bpjsApi, roomsApi, masterDataApi, type Room, type RoomUnit, type Bed, type RoomStaff, type MasterData, type DoctorSchedule } from "@/lib/api";
import type { AplicareBedItem, AplicareRefKelasItem, BPJSPoliMapping } from "@/lib/api/bpjs";
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
  Building2,
} from "lucide-react";
import { UnitFormDialog } from "./components/kamar/unit-form-dialog";
import { BedFormDialog } from "./components/bed/bed-form-dialog";
import { StaffFormDialog } from "./components/staff/staff-form-dialog";
import { DoctorScheduleFormDialog } from "./components/jadwal/doctor-schedule-form-dialog";
import { BpjsPoliMappingDialog } from "./components/jadwal/bpjs-poli-mapping-dialog";
import { PullHfisScheduleDialog } from "./components/jadwal/pull-hfis-schedule-dialog";
import { RoomProcedureFormDialog } from "./components/tindakan/room-procedure-form-dialog";
import { RoomClinicalPackageFormDialog } from "./components/clinical-package-form-dialog";
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
      return "KL1";
    case "kelas_2":
      return "KL2";
    case "kelas_3":
      return "KL3";
    case "icu":
      return "ICU";
    case "iccu":
      return "ICCU";
    case "isolasi":
      return "ISO";
    default:
      return "NON";
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
  const [aplicareMappings, setAplicareMappings] = useState<AplicareBedItem[]>([]);
  const [aplicareDialogOpen, setAplicareDialogOpen] = useState(false);
  const [aplicareDeleteDialogOpen, setAplicareDeleteDialogOpen] = useState(false);
  const [aplicareRefKelas, setAplicareRefKelas] = useState<AplicareRefKelasItem[]>([]);
  const [_aplicareRefKelasLoading, setAplicareRefKelasLoading] = useState(false);

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
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [poliMapping, setPoliMapping] = useState<BPJSPoliMapping | null>(null);
  const [poliMappingDialogOpen, setPoliMappingDialogOpen] = useState(false);
  const [pullHfisDialogOpen, setPullHfisDialogOpen] = useState(false);

  // Doctor Schedule states
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

  // Room Clinical Packages states
  const [roomClinicalPackageDialogOpen, setRoomClinicalPackageDialogOpen] = useState(false);
  const [deleteRoomClinicalPackageDialogOpen, setDeleteRoomClinicalPackageDialogOpen] = useState(false);
  const [roomClinicalPackageToDelete, setRoomClinicalPackageToDelete] = useState<number | null>(null);

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
        const doctorSchedulesRes = await roomsApi.getDoctorSchedules(parseInt(id));
        setDoctorSchedules(doctorSchedulesRes.data.data || []);

        try {
          const poliMapRes = await bpjsApi.getPoliMappings({ room_id: parseInt(id) });
          const poliMap = poliMapRes.data.data?.[0] || null;
          setPoliMapping(poliMap);
        } catch {
          setPoliMapping(null);
        }
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
    if (!id || !room) return;

    try {
      const response = await bpjsApi.aplicareReadBed(1, 500);
      const items = response.data.data || [];

      // Kumpulkan semua kode unit dari ruangan ini (max 10 karakter, sesuai truncation di backend)
      const unitCodes = new Set(
        (room.units || []).map((u) => {
          const code = u.code || `${room.code}-${u.id}`;
          // Konsisten dengan backend: ambil 10 karakter TERAKHIR
          return code.length > 10 ? code.slice(code.length - 10) : code;
        })
      );

      // Kumpulkan semua unit yang sudah terdaftar di Aplicare
      const mappedItems = items.filter((item) =>
        unitCodes.has(item.koderuang) ||
        item.koderuang === room.code
      );

      setAplicareMappings(mappedItems);
    } catch {
      setAplicareMappings([]);
    }
  }, [id, room]);

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
      if (aplicareMappings.length === 0 && aplicareRefKelas.length === 0) {
        loadAplicareRefKelas();
      }
    }
  }, [aplicareDialogOpen, aplicareMappings.length, aplicareRefKelas.length, loadAplicareRefKelas, room]);

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
    const result = !query
      ? [...units]
      : units.filter((unit) => {
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

    return result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }));
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

  const handleDeleteRoomClinicalPackage = async () => {
    if (!roomClinicalPackageToDelete) return;
    try {
      await roomClinicalPackagesApi.delete(parseInt(id as string), roomClinicalPackageToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Paket klinis berhasil dihapus dari ruangan.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal menghapus paket klinis dari ruangan.",
      });
    } finally {
      setDeleteRoomClinicalPackageDialogOpen(false);
      setRoomClinicalPackageToDelete(null);
    }
  };

  const unitStats = useMemo(() => {
    if (!room?.units) return [];
    return room.units.map(unit => {
      const totalBeds = unit.beds?.length || 0;
      const availableBeds = unit.beds?.filter(b => b.status === 'available').length || 0;

      return {
        unitCode: unit.code || "",
        unitName: unit.name || "",
        className: unit.class || "",
        aplicareKodeKelas: mapRoomClassToAplicare(unit.class),
        total: totalBeds,
        available: availableBeds,
      };
    });
  }, [room?.units]);

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

  // Daftarkan ke Aplicare — hanya mendaftarkan kamar yang BELUM terdaftar (sync_mode=false)
  const handleRegisterAplicare = async () => {
    if (!room) return;
    try {
      setRegisteringAplicare(true);
      const response = await bpjsApi.aplicareCreateRoom({
        room_id: room.id,
        sync_mode: false,
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

  // Sinkronisasi Kamar — mendaftarkan kamar baru + update yang sudah ada (sync_mode=true)
  const handleSyncAplicare = async () => {
    if (!room) return;
    try {
      setRegisteringAplicare(true);
      const response = await bpjsApi.aplicareCreateRoom({
        room_id: room.id,
        sync_mode: true,
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Kamar berhasil disinkronisasi ke Aplicare.",
      });
      setAplicareDialogOpen(false);
      await loadAplicareMapping();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal sinkronisasi",
        description: error.response?.data?.error || "Sinkronisasi kamar ke Aplicare gagal.",
      });
    } finally {
      setRegisteringAplicare(false);
    }
  };

  const handleDeleteAplicare = async () => {
    if (!room || aplicareMappings.length === 0) return;

    try {
      setRegisteringAplicare(true);
      const response = await bpjsApi.aplicareDeleteRoom(room.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Ruangan berhasil dihapus dari Aplicare.",
      });
      setAplicareMappings([]);
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
      label: "Memiliki kelas BPJS",
      passed: unitStats.length > 0,
      value: unitStats.length > 0 ? `${unitStats.length} unit/kelas kamar ditemukan` : "Kamar belum memiliki kelas",
    },
    {
      label: "Kapasitas bed siap dikirim",
      passed: unitStats.some(c => c.total > 0),
      value: `${totalBeds} total bed`,
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
                {aplicareMappings.length > 0 ? "Detail Aplicare" : "Tambah ke Aplicare"}
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
      <PageContent className="flex-none pb-8 min-w-0">
        <div className="min-w-0 border border-border/70 bg-background rounded-b-lg">
          <div className="min-w-0 p-3 sm:p-4">
            {/* Show beds for selected unit OR show main tabs */}
            {selectedUnit ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedUnit(null)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h3 className="text-sm font-semibold">{selectedUnit.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {selectedUnit.code}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          Lantai {selectedUnit.floor}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <BedDouble className="h-3 w-3" />
                          Kapasitas {selectedUnit.capacity} bed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(selectedUnit.beds?.length || 0) >= selectedUnit.capacity && (
                      <Badge variant="destructive" className="text-xs">
                        Penuh ({selectedUnit.beds?.length || 0}/{selectedUnit.capacity})
                      </Badge>
                    )}
                    {hasPermission('rooms.update') && (selectedUnit.beds?.length || 0) < selectedUnit.capacity && (
                      <Button onClick={handleAddBed} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Bed
                      </Button>
                    )}
                  </div>
                </div>
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
                      <div className="max-h-[40rem] overflow-y-auto pb-3">
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
              <Tabs defaultValue="detail" className="flex flex-col md:flex-row min-w-0 w-full gap-4 md:gap-6">
                <TabsList className="flex flex-row md:flex-col h-auto justify-start w-full md:w-48 shrink-0 overflow-x-auto bg-transparent p-0 space-y-0 md:space-y-1 space-x-1 md:space-x-0 sticky top-4 self-start">
                  <TabsTrigger value="detail" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Detail
                  </TabsTrigger>
                  {room.has_bed && (
                    <TabsTrigger value="units" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                      Kamar
                    </TabsTrigger>
                  )}
                  {room.has_schedule && (
                    <TabsTrigger value="schedules" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                      Jadwal
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="staff" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Staff
                  </TabsTrigger>
                  <TabsTrigger value="procedures" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Tindakan
                  </TabsTrigger>
                  <TabsTrigger value="clinical-packages" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Paket
                  </TabsTrigger>
                  <TabsTrigger value="inventories" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Inventaris
                  </TabsTrigger>
                  <TabsTrigger value="medicines" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Obat
                  </TabsTrigger>
                  <TabsTrigger value="tariffs" className="justify-start px-4 py-2 text-sm w-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">
                    Tarif
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-w-0">

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
                        <div className="flex justify-between">
                          <div className="max-w-sm">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={unitSearch}
                                onChange={(event) => setUnitSearch(event.target.value)}
                                placeholder="Cari kamar, kode, lantai, atau status..."
                                className="pl-9"
                              />
                            </div>
                          </div>
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
                              <div className="max-h-[42rem] overflow-y-auto pb-3">
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
                  <TabsContent value="schedules" className="mt-0 min-w-0 overflow-visible">
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 max-h-[calc(100vh-16rem)]">
                      {/* Room Schedule (Jadwal Poli) */}
                      {/* Doctor Schedule (Jadwal Dokter) */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Jadwal Dokter
                              </h4>
                              {poliMapping ? (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                                  Poli BPJS: {poliMapping.nama_poli_bpjs}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  Belum di-mapping BPJS
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">Jadwal praktik dokter di ruangan ini</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasPermission('rooms.update') && (
                              <>
                                <Button variant="outline" onClick={() => setPoliMappingDialogOpen(true)} size="sm">
                                  <Building2 className="mr-2 h-4 w-4" />
                                  {poliMapping ? 'Ubah Mapping Poli' : 'Mapping Poli BPJS'}
                                </Button>
                                {poliMapping && (
                                  <Button variant="outline" onClick={() => setPullHfisDialogOpen(true)} size="sm" className="bg-blue-50/50 text-blue-600 border-blue-200 hover:bg-blue-100/50 hover:text-blue-700">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Tarik Jadwal HFIS
                                  </Button>
                                )}
                                <Button onClick={handleAddDoctorSchedule} size="sm">
                                  <Plus className="mr-2 h-4 w-4" />
                                  Tambah Jadwal Dokter
                                </Button>
                              </>
                            )}
                          </div>
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
                          <div className="text-center py-24 text-muted-foreground border rounded-lg">
                            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Belum ada jadwal dokter</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="staff" className="mt-0 min-w-0 overflow-hidden">
                    <StaffAssignmentPanel
                      masterData={masterData}
                      staff={staff}
                      hasPermission={hasPermission('rooms.update')}
                      onAdd={() => setStaffDialogOpen(true)}
                      onDelete={(staffId) => {
                        setStaffToDelete(staffId);
                        setDeleteStaffDialogOpen(true);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="procedures" className="mt-0 min-w-0 overflow-hidden">
                    <ProcedureAssignmentPanel
                      roomId={parseInt(id!)}
                      roomProcedures={roomProcedures}
                      onRefresh={loadData}
                      hasPermission={hasPermission('rooms.update')}
                      onAdd={() => setRoomProcedureDialogOpen(true)}
                      onDelete={(rpId) => {
                        setRoomProcedureToDelete(rpId);
                        setDeleteRoomProcedureDialogOpen(true);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="clinical-packages" className="mt-0 min-w-0 overflow-hidden">
                    <ClinicalPackageAssignmentPanel
                      roomId={parseInt(id!)}
                      assignments={roomClinicalPackages}
                      onRefresh={loadData}
                      hasPermission={hasPermission('rooms.update')}
                      onAdd={() => setRoomClinicalPackageDialogOpen(true)}
                      onDelete={(cp) => {
                        setRoomClinicalPackageToDelete(cp.id);
                        setDeleteRoomClinicalPackageDialogOpen(true);
                      }}
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
                </div>
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
          <BpjsPoliMappingDialog
            open={poliMappingDialogOpen}
            onOpenChange={setPoliMappingDialogOpen}
            room={room}
            poliMapping={poliMapping}
            onSuccess={loadData}
          />

          <PullHfisScheduleDialog
            open={pullHfisDialogOpen}
            onOpenChange={setPullHfisDialogOpen}
            roomId={parseInt(id!)}
            poliMapping={poliMapping}
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

          <RoomClinicalPackageFormDialog
            open={roomClinicalPackageDialogOpen}
            onOpenChange={setRoomClinicalPackageDialogOpen}
            roomId={parseInt(id!)}
            assignedPackageIds={roomClinicalPackages.map((cp) => cp.clinical_package_id)}
            onSuccess={loadData}
          />

          <ConfirmDialog
            open={deleteRoomClinicalPackageDialogOpen}
            onOpenChange={setDeleteRoomClinicalPackageDialogOpen}
            title="Hapus Paket Klinis"
            description="Apakah Anda yakin ingin menghapus paket klinis ini dari ruangan? Tindakan ini tidak dapat dibatalkan."
            onConfirm={handleDeleteRoomClinicalPackage}
            confirmText="Hapus"
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
            <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[600px]">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <BedDouble className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base">
                      {aplicareMappings.length > 0 ? "Kelola Aplicare" : "Daftarkan ke Aplicare"}
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-xs">
                      {aplicareMappings.length > 0
                        ? "Ruangan sudah terdaftar. Klik Sinkronisasi untuk mendaftarkan kamar baru."
                        : "Periksa data sebelum mendaftarkan ruangan ke BPJS Aplicare."}
                    </DialogDescription>
                  </div>
                  {aplicareMappings.length > 0 && (
                    <Badge className="ml-auto shrink-0 bg-green-600 hover:bg-green-600 text-white">
                      Terdaftar ({aplicareMappings.length})
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="max-h-[calc(85vh-12rem)] space-y-4 overflow-y-auto">
                {/* Mapping info ringkas - hanya saat sudah terdaftar dan jika jumlah mapping tidak terlalu banyak */}
                {aplicareMappings.length > 0 && aplicareMappings.length <= 3 && (
                  <div className="flex flex-col gap-2">
                    {aplicareMappings.map((mapping, idx) => (
                      <div key={idx} className="flex flex-wrap gap-4 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Kode Ruang</span>
                          <div className="font-medium">{mapping.koderuang}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Nama</span>
                          <div className="font-medium">{mapping.namaruang}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Kelas</span>
                          <div className="font-medium">{mapping.namakelas || mapping.kodekelas}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Tersedia / Kap.</span>
                          <div className="font-medium">{mapping.tersedia} / {mapping.kapasitas}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Daftar kamar */}
                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <div className="border-b border-border/70 bg-muted/50 px-4 py-2.5">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Daftar Kamar ({unitStats.length})
                    </div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {[...unitStats]
                      .sort((a, b) => a.unitName.localeCompare(b.unitName, 'id', { sensitivity: 'base' }))
                      .map((stat, index) => {
                        const isRegistered = aplicareMappings.some(mapping =>
                          stat.unitCode === mapping.koderuang ||
                          (stat.unitCode.length > 10 ? stat.unitCode.slice(stat.unitCode.length - 10) : stat.unitCode) === mapping.koderuang
                        );
                        const isFull = stat.total > 0 && stat.available === 0;
                        return (
                          <div key={index} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{stat.unitName}</span>
                                {isRegistered && (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    ✓ Terdaftar
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{stat.unitCode}</div>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {stat.aplicareKodeKelas}
                            </Badge>
                            <div className="shrink-0 text-right">
                              <div className={`text-sm font-semibold ${isFull ? 'text-destructive' : 'text-foreground'}`}>
                                {stat.available}/{stat.total}
                              </div>
                              <div className="text-[10px] text-muted-foreground">tersedia</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Checklist validasi - hanya saat belum terdaftar */}
                {aplicareMappings.length === 0 && (
                  <div className="rounded-lg border border-border/70 overflow-hidden">
                    <div className="border-b border-border/70 bg-muted/50 px-4 py-2.5">
                      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Checklist Validasi
                      </div>
                    </div>
                    <div className="divide-y divide-border/60">
                      {aplicareValidations.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground truncate">{item.value}</div>
                          </div>
                          <Badge
                            variant={item.passed ? "default" : "secondary"}
                            className={`shrink-0 ${item.passed ? "bg-green-600 hover:bg-green-600" : ""}`}
                          >
                            {item.passed ? "✓ Valid" : "Perlu dicek"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {aplicareMappings.length > 0 ? (
                  <div className="flex w-full items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setAplicareDeleteDialogOpen(true)}
                      disabled={registeringAplicare}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Hapus
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAplicareDialogOpen(false)}>
                        Tutup
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSyncAplicare}
                        disabled={!canSubmitAplicare || registeringAplicare}
                      >
                        {registeringAplicare ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BedDouble className="mr-1.5 h-4 w-4" />}
                        Sinkronisasi Kamar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAplicareDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="button" size="sm" onClick={handleRegisterAplicare} disabled={!canSubmitAplicare || registeringAplicare}>
                      {registeringAplicare ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BedDouble className="mr-1.5 h-4 w-4" />}
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



