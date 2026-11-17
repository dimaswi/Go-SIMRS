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
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
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
  const [editingRoomProcedure, setEditingRoomProcedure] = useState<RoomProcedure | null>(null);
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

  const bedColumns = useMemo<ColumnDef<Bed>[]>(() => [
    {
      accessorKey: "bed_number",
      header: "Bed",
      cell: ({ row }) => <span className="font-medium text-xs">{row.original.bed_number}</span>,
    },
    {
      accessorKey: "bed_type",
      header: "Tipe",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.bed_type ? getMasterDataName('bed_type', row.original.bed_type) : '-'}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getBedStatusBadgeVariant(row.original.status)} className="h-5 text-[10px]">
          {getMasterDataName('bed_status', row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "notes",
      header: "Catatan",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.notes || '-'}</span>,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {hasPermission('rooms.update') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditBed(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {hasPermission('rooms.update') && row.original.status !== 'occupied' && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBed(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ], [hasPermission, masterData]);

  const unitColumns = useMemo<ColumnDef<RoomUnit>[]>(() => [
    {
      accessorKey: "name",
      header: "Kamar",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-xs">{row.original.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{row.original.code}</div>
        </div>
      ),
    },
    {
      accessorKey: "floor",
      header: "Lantai",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">Lantai {row.original.floor}</span>,
    },
    {
      id: "beds",
      header: "Bed",
      cell: ({ row }) => {
        const beds = row.original.beds || [];
        const available = beds.filter((bed) => bed.status === 'available').length;
        return (
          <div className="text-xs">
            <div className="font-medium">{beds.length}/{row.original.capacity}</div>
            <div className="text-[11px] text-muted-foreground">{available} tersedia</div>
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'} className="h-5 text-[10px]">
          {row.original.is_active ? 'Aktif' : 'Tidak Aktif'}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewUnit(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {hasPermission('rooms.update') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditUnit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {hasPermission('rooms.update') && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteUnit(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ], [hasPermission]);

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
        onBack={() => navigate("/rooms")}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {room.has_bed && (
              <Button
                onClick={() => navigate(`/bed-monitoring/${room.id}`)}
                size="sm"
                variant="outline"
                className="h-8 text-xs"
              >
                <Monitor className="mr-1.5 h-3.5 w-3.5" />
                Monitoring
              </Button>
            )}
            {hasPermission("integrations.manage") && room.has_bed && (
              <Button
                onClick={() => setAplicareDialogOpen(true)}
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={registeringAplicare}
              >
                {registeringAplicare ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BedDouble className="mr-1.5 h-3.5 w-3.5" />
                )}
                {aplicareMappings.length > 0 ? "Detail Aplicare" : "Tambah ke Aplicare"}
              </Button>
            )}
            {hasPermission("rooms.update") && (
              <Button onClick={() => navigate(`/rooms/${room.id}/edit`)} size="sm" className="h-8 text-xs">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        }
      />
      <PageContent noPadding className="flex-none min-w-0">
        <div className="min-w-0">
            {/* Show beds for selected unit OR show main tabs */}
            {selectedUnit ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedUnit(null)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{selectedUnit.name}</h3>
                        <Badge variant="outline" className="h-5 text-[10px] font-mono">{selectedUnit.code}</Badge>
                        <Badge variant="secondary" className="h-5 text-[10px]">Lantai {selectedUnit.floor}</Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">Kapasitas {selectedUnit.capacity} bed</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(selectedUnit.beds?.length || 0) >= selectedUnit.capacity && (
                      <Badge variant="destructive" className="h-5 text-[10px]">
                        Penuh ({selectedUnit.beds?.length || 0}/{selectedUnit.capacity})
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <DataTable
                    columns={bedColumns}
                    data={selectedUnit.beds || []}
                    searchPlaceholder="Cari bed, tipe, status, atau catatan..."
                    hideRowCount
                    toolbarRight={
                      hasPermission('rooms.update') && (selectedUnit.beds?.length || 0) < selectedUnit.capacity ? (
                        <Button onClick={handleAddBed} size="sm" className="h-8 text-xs">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Tambah Bed
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            ) : (
              <Tabs defaultValue="detail" className="flex flex-col min-w-0 w-full">
                <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2 overflow-x-auto">
                  <TabsList className="h-auto bg-transparent p-0 gap-1.5 rounded-none justify-start">
                    {(
                      [
                        { value: "detail", label: "Detail" },
                        ...(room.has_bed ? [{ value: "units", label: "Kamar", count: units.length }] : []),
                        ...(room.has_schedule ? [{ value: "schedules", label: "Jadwal", count: doctorSchedules.length }] : []),
                        { value: "staff", label: "Staff", count: staff.length },
                        { value: "procedures", label: "Tindakan", count: roomProcedures.length },
                        { value: "clinical-packages", label: "Paket", count: roomClinicalPackages.length },
                        { value: "inventories", label: "Inventaris", count: roomInventories.length },
                        { value: "medicines", label: "Obat", count: roomMedicines.length },
                        { value: "tariffs", label: "Tarif" },
                      ] as Array<{ value: string; label: string; count?: number }>
                    ).map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="h-8 gap-1.5 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 data-[state=active]:border-neutral-900 data-[state=active]:bg-neutral-900 data-[state=active]:text-white dark:data-[state=active]:border-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900 data-[state=active]:shadow-none transition-colors"
                      >
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center px-1 font-mono text-[10px] font-bold tabular-nums bg-neutral-100 text-neutral-700 [[data-state=active]_&]:bg-white/20 [[data-state=active]_&]:text-white">
                            {tab.count}
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="min-w-0">

                  <TabsContent value="detail" className="mt-0 min-w-0 overflow-hidden divide-y divide-border/70">
                    {/* Room Info */}
                    <div className="p-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Jenis Layanan</p>
                        <div className="mt-1">
                          <Badge variant="secondary" className="h-5 text-[10px]">{getMasterDataName('service_type', room.service_type)}</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tipe Ruangan</p>
                        <p className="mt-1 text-xs font-medium">{getMasterDataName('room_type', room.room_type)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kelas Ruangan</p>
                        <div className="mt-1">
                          {room.room_class ? (
                            <Badge variant="outline" className="h-5 text-[10px]">{getMasterDataName('room_class', room.room_class)}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                      {/* Registration Fee - untuk semua ruangan */}
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tarif Pendaftaran</p>
                        <p className="mt-1 text-xs font-medium">
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
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Layers className="h-3 w-3" /> Jumlah Lantai
                            </p>
                            <p className="mt-1 text-xs font-medium">{room.total_floors} lantai</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tarif per Hari</p>
                            <p className="mt-1 text-xs font-medium">
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
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> Penanggung Jawab
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {room.pic_employee?.nama_lengkap || <span className="text-muted-foreground">Belum ditentukan</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fitur Ruangan</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {room.has_bed && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              <BedDouble className="h-3 w-3 mr-1" />
                              Ada Bed
                            </Badge>
                          )}
                          {room.has_schedule && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              Jadwal
                            </Badge>
                          )}
                          {!room.has_bed && !room.has_schedule && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                      {room.has_bed && (
                        <>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <DoorOpen className="h-3 w-3" /> Jumlah Kamar
                            </p>
                            <p className="mt-1 text-xs font-medium">{units.length} kamar</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <BedDouble className="h-3 w-3" /> Ketersediaan Bed
                            </p>
                            <p className="mt-1 text-xs font-medium">
                              <span className="text-green-600">{availableBeds} tersedia</span>
                              {" / "}
                              <span>{totalBeds} total</span>
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {room.facilities && (
                      <div className="p-4 space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fasilitas</p>
                        <p className="text-xs leading-relaxed">{room.facilities}</p>
                      </div>
                    )}

                    {room.description && (
                      <div className="p-4 space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Deskripsi</p>
                        <p className="text-xs leading-relaxed">{room.description}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="units" className="mt-0 min-w-0 overflow-hidden">
                    {room.has_bed ? (
                      <DataTable
                        columns={unitColumns}
                        data={units}
                        searchPlaceholder="Cari kamar, kode, lantai, atau status..."
                        hideRowCount
                        toolbarRight={
                          hasPermission('rooms.update') ? (
                            <Button onClick={handleAddUnit} size="sm" className="h-8 text-xs">
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Tambah Kamar
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        <BedDouble className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>Ruangan ini tidak memiliki fitur tempat tidur</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Schedules Tab */}
                  <TabsContent value="schedules" className="mt-0 min-w-0 overflow-visible">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            Jadwal Dokter
                          </h4>
                          {poliMapping ? (
                            <Badge variant="outline" className="h-5 text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                              Poli BPJS: {poliMapping.nama_poli_bpjs}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                              Belum di-mapping BPJS
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasPermission('rooms.update') && (
                            <>
                              <Button variant="outline" onClick={() => setPoliMappingDialogOpen(true)} size="sm" className="h-8 text-xs">
                                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                                {poliMapping ? 'Ubah Mapping Poli' : 'Mapping Poli BPJS'}
                              </Button>
                              {poliMapping && (
                                <Button variant="outline" onClick={() => setPullHfisDialogOpen(true)} size="sm" className="h-8 text-xs">
                                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                                  Tarik Jadwal HFIS
                                </Button>
                              )}
                              <Button onClick={handleAddDoctorSchedule} size="sm" className="h-8 text-xs">
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Tambah Jadwal Dokter
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {doctorSchedules.length > 0 ? (
                        <div className="divide-y divide-border/60">
                          {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((dayName, idx) => {
                            const dayIdx = idx === 6 ? 0 : idx + 1;
                            const daySchedules = doctorSchedules.filter(s => s.day_of_week === dayIdx);
                            return (
                              <div key={dayName} className="grid grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)] gap-2 px-4 py-2.5 items-start">
                                <div className="text-xs font-semibold text-foreground pt-0.5">{dayName}</div>
                                {daySchedules.length > 0 ? (
                                  <div className="divide-y divide-border/40">
                                    {daySchedules.map(schedule => (
                                      <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0 text-xs">
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                          <span className="font-medium text-foreground">{schedule.employee?.nama_lengkap || 'Unknown'}</span>
                                          <span className="inline-flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
                                            <Clock className="h-3 w-3" />
                                            {schedule.start_time} - {schedule.end_time}
                                          </span>
                                          {schedule.max_patients > 0 && (
                                            <Badge variant="outline" className="h-5 text-[10px]">Max {schedule.max_patients}</Badge>
                                          )}
                                          {schedule.consult_fee > 0 && (
                                            <span className="text-[11px] text-muted-foreground">
                                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(schedule.consult_fee)}
                                            </span>
                                          )}
                                        </div>
                                        {hasPermission('rooms.update') && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => handleEditDoctorSchedule(schedule)}
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive"
                                              onClick={() => handleDeleteDoctorSchedule(schedule.id)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
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
                        <div className="text-center py-12 text-xs text-muted-foreground">
                          <User className="h-7 w-7 mx-auto mb-2 opacity-40" />
                          <p>Belum ada jadwal dokter</p>
                        </div>
                      )}
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
                      onAdd={() => {
                        setEditingRoomProcedure(null);
                        setRoomProcedureDialogOpen(true);
                      }}
                      onEdit={(rp) => {
                        setEditingRoomProcedure(rp);
                        setRoomProcedureDialogOpen(true);
                      }}
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

                  <TabsContent value="inventories" className="mt-0 min-w-0">
                    <InventoryAssignmentPanel
                      roomId={parseInt(id!)}
                      roomInventories={roomInventories}
                      onRefresh={loadData}
                      hasPermission={hasPermission('inventories.create')}
                      onAdd={() => setRoomInventoryDialogOpen(true)}
                      onDelete={(riId) => {
                        setRoomInventoryToDelete(riId);
                        setDeleteRoomInventoryDialogOpen(true);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="medicines" className="mt-0 min-w-0">
                    <MedicineAssignmentPanel
                      roomId={parseInt(id!)}
                      roomMedicines={roomMedicines}
                      onRefresh={loadData}
                      hasPermission={hasPermission('medicines.create')}
                      onAdd={() => setRoomMedicineDialogOpen(true)}
                      onDelete={(rmId) => {
                        setRoomMedicineToDelete(rmId);
                        setDeleteRoomMedicineDialogOpen(true);
                      }}
                    />
                  </TabsContent>

                  {/* Room Tariffs Tab (for all room types) */}
                  <TabsContent value="tariffs" className="mt-0 min-w-0">
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
            isUgd={room?.has_schedule === false || ['ugd', 'igd', 'gawat_darurat', 'rawat_inap'].includes(room?.service_type?.toLowerCase() || '')}
          />

          <RoomProcedureFormDialog
            open={roomProcedureDialogOpen}
            onOpenChange={setRoomProcedureDialogOpen}
            roomId={parseInt(id!)}
            roomProcedure={editingRoomProcedure}
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
      </PageContent>
    </PageShell>
  );
}



