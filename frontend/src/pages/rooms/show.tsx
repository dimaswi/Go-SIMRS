import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { roomsApi, masterDataApi, type Room, type RoomUnit, type Bed, type RoomStaff, type MasterData, type Schedule, type DoctorSchedule } from "@/lib/api";
import { roomProceduresApi } from "@/lib/api/procedures";
import type { RoomProcedure } from "@/lib/api/procedures";
import { roomInventoriesApi, type RoomInventory } from "@/lib/api/inventories";
import { roomMedicinesApi, type RoomMedicine } from "@/lib/api/medicines";
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
} from "lucide-react";
import { createUnitColumns } from "./components/kamar/unit-columns";
import { createBedColumns } from "./components/bed/bed-columns";
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
import { StaffAssignmentPanel } from "./components/staff/staff-assignment-panel";

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

  useEffect(() => {
    loadData();
  }, []);

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

  const unitColumns = createUnitColumns({
    onView: handleViewUnit,
    onEdit: handleEditUnit,
    onDelete: handleDeleteUnit,
    hasEditPermission: hasPermission('rooms.update'),
    hasDeletePermission: hasPermission('rooms.update'),
  });

  const bedColumns = createBedColumns({
    onEdit: handleEditBed,
    onDelete: handleDeleteBed,
    hasEditPermission: hasPermission('rooms.update'),
    hasDeletePermission: hasPermission('rooms.update'),
    getMasterDataName,
  });

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

  const totalBeds = room.total_beds || 0;
  const availableBeds = room.available_beds || 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center gap-4">
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate("/rooms")}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1">
                <CardTitle className="text-base font-semibold">
                  {room.name}
                </CardTitle>
                <CardDescription>
                  {room.code}
                </CardDescription>
              </div>
              <Badge variant={room.is_active ? "default" : "secondary"}>
                {room.is_active ? "Aktif" : "Tidak Aktif"}
              </Badge>
              {hasPermission("rooms.update") && (
                <Button onClick={() => navigate(`/rooms/${room.id}/edit`)} size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
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
                        {selectedUnit.code} • Lantai {selectedUnit.floor} • 
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
                <DataTable
                  columns={bedColumns}
                  data={selectedUnit.beds || []}
                  searchPlaceholder="Cari tempat tidur..."
                  pageSize={10}
                />
              </div>
            ) : (
              <Tabs defaultValue="detail" className="w-full">
                <TabsList className="h-auto p-0 bg-transparent border-b border-border rounded-none w-full justify-start gap-6 mb-6">
                  <TabsTrigger 
                    value="detail" 
                    className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                  >
                    Detail
                  </TabsTrigger>
                  {room.has_bed && (
                    <TabsTrigger 
                      value="units" 
                      className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                    >
                      Kamar
                    </TabsTrigger>
                  )}
                  {room.has_schedule && (
                    <TabsTrigger 
                      value="schedules" 
                      className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                    >
                      Jadwal
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="staff" 
                    className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                  >
                    Staff
                  </TabsTrigger>
                  <TabsTrigger 
                    value="procedures" 
                    className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                  >
                    Tindakan
                  </TabsTrigger>
                  <TabsTrigger 
                    value="inventories" 
                    className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                  >
                    Inventaris
                  </TabsTrigger>
                  <TabsTrigger 
                    value="medicines" 
                    className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                  >
                    Obat
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="detail" className="mt-0">
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

                <TabsContent value="units" className="mt-0">
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
                      <DataTable
                        columns={unitColumns}
                        data={units}
                        searchPlaceholder="Cari kamar..."
                        pageSize={10}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BedDouble className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Ruangan ini tidak memiliki fitur tempat tidur</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Schedules Tab */}
                <TabsContent value="schedules" className="mt-0">
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

                <TabsContent value="staff" className="mt-0">
                  <StaffAssignmentPanel
                    roomId={parseInt(id!)}
                    masterData={masterData}
                    staff={staff}
                    onRefresh={loadData}
                    hasPermission={hasPermission('rooms.update')}
                  />
                </TabsContent>

                <TabsContent value="procedures" className="mt-0">
                  <ProcedureAssignmentPanel
                    roomId={parseInt(id!)}
                    roomProcedures={roomProcedures}
                    onRefresh={loadData}
                    hasPermission={hasPermission('rooms.update')}
                  />
                </TabsContent>

                <TabsContent value="inventories" className="mt-0">
                  <InventoryAssignmentPanel
                    roomId={parseInt(id!)}
                    roomInventories={roomInventories}
                    onRefresh={loadData}
                    hasPermission={hasPermission('inventories.create')}
                  />
                </TabsContent>

                <TabsContent value="medicines" className="mt-0">
                  <MedicineAssignmentPanel
                    roomId={parseInt(id!)}
                    roomMedicines={roomMedicines}
                    onRefresh={loadData}
                    hasPermission={hasPermission('medicines.create')}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
}
