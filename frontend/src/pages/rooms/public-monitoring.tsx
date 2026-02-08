import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { roomsApi, type Room, type RoomUnit, type Bed, masterDataApi, type MasterData } from "@/lib/api";
import { settingsApi } from "@/lib/api";
import {
  BedDouble,
  User,
  Calendar,
  RefreshCw,
  Building2,
  Layers,
  Maximize2,
  Minimize2,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function PublicRoomMonitoring() {
  const { id: roomId } = useParams<{ id: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [units, setUnits] = useState<RoomUnit[]>([]);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto refresh every 30 seconds
  const loadData = useCallback(async () => {
    if (!roomId) return;

    try {
      const [roomRes, masterDataRes] = await Promise.all([
        roomsApi.getById(parseInt(roomId)),
        masterDataApi.getMultiple(["bed_status", "bed_type", "room_class"]),
      ]);

      const roomData = roomRes.data.data;
      setRoom(roomData);
      setUnits(roomData.units || []);
      setMasterData(masterDataRes.data.data || {});

      // Auto select first unit with beds if not selected
      if (!selectedUnitId && roomData.units && roomData.units.length > 0) {
        const unitsOnFloor = (roomData.units || []).filter((u: RoomUnit) => u.floor === selectedFloor);
        if (unitsOnFloor.length > 0) {
          setSelectedUnitId(unitsOnFloor[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load room data:", error);
    } finally {
      setLoading(false);
    }
  }, [roomId, selectedFloor, selectedUnitId]);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) {
          setHospitalName(settings.app_name);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 30000);
    return () => clearInterval(dataInterval);
  }, [loadData]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Helper to get master data name
  const getMasterDataName = (category: string, code: string): string => {
    const items = masterData[category] || [];
    const item = items.find((i) => i.code === code);
    return item?.name || code;
  };

  // Get available floors
  const availableFloors = room ? Array.from({ length: room.total_floors }, (_, i) => i + 1) : [1];

  // Filter units by selected floor
  const filteredUnits = units.filter((unit) => unit.floor === selectedFloor);

  // Calculate bed statistics
  const getBedStats = () => {
    let total = 0;
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let maintenance = 0;

    units.forEach((unit) => {
      (unit.beds || []).forEach((bed) => {
        total++;
        switch (bed.status) {
          case "available":
            available++;
            break;
          case "occupied":
            occupied++;
            break;
          case "reserved":
            reserved++;
            break;
          case "maintenance":
          case "cleaning":
            maintenance++;
            break;
        }
      });
    });

    return { total, available, occupied, reserved, maintenance };
  };

  const stats = getBedStats();

  // Handle bed click
  const handleBedClick = (bed: Bed) => {
    setSelectedBed(bed);
    setPatientDialogOpen(true);
  };

  // Get selected unit data
  const currentUnit = filteredUnits.find((u) => u.id === selectedUnitId);
  const bedsInUnit = currentUnit?.beds || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ruangan tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">{hospitalName}</h1>
              <p className="text-sm opacity-90">
                {room.name} - Monitoring Bed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Clock */}
            <div className="text-right">
              <div className="text-2xl font-mono font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {format(currentTime, "HH:mm:ss")}
              </div>
              <div className="text-sm opacity-90">
                {format(currentTime, "EEEE, dd MMMM yyyy", { locale: idLocale })}
              </div>
            </div>
            {/* Fullscreen Toggle */}
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>
            {/* Refresh Button */}
            <Button
              variant="secondary"
              size="icon"
              onClick={loadData}
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Left Column - Statistics & Navigation */}
          <div className="rounded-lg border">
            <div className="flex items-center gap-4 p-4">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <BedDouble className="h-4 w-4" />
                Statistik Bed
              </h1>
            </div>
            <div className="rounded-lg border p-6 space-y-4 mx-4 mb-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total Bed</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.available}</div>
                  <div className="text-xs text-muted-foreground">Tersedia</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.occupied}</div>
                  <div className="text-xs text-muted-foreground">Terisi</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{stats.reserved}</div>
                  <div className="text-xs text-muted-foreground">Dipesan</div>
                </div>
              </div>

              {/* Floor Navigation */}
              {availableFloors.length > 1 && (
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Pilih Lantai
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableFloors.map((floor) => (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => {
                          setSelectedFloor(floor);
                          setSelectedUnitId(null);
                        }}
                        className={cn(
                          "p-2 rounded-lg border-2 text-center transition-all text-sm font-medium",
                          selectedFloor === floor
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        Lt. {floor}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium">Keterangan</Label>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span>Tersedia</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span>Terisi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span>Dipesan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-400"></div>
                    <span>Maintenance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-purple-500"></div>
                    <span>Cleaning</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Bed Selection */}
          <div className="rounded-lg border lg:col-span-3">
            <div className="flex items-center gap-4 p-4">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <BedDouble className="h-4 w-4" />
                Daftar Bed - Lantai {selectedFloor}
              </h1>
            </div>
            <div className="rounded-lg border p-6 mx-4 mb-4">
              {/* Unit Selection */}
              <div className="space-y-3 mb-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  Pilih Unit/Kamar
                </Label>
                {filteredUnits.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {filteredUnits.map((unit) => {
                      const availableCount = unit.beds?.filter((b) => b.status === "available").length || 0;
                      const totalCount = unit.beds?.length || 0;
                      const isSelected = selectedUnitId === unit.id;

                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setSelectedUnitId(unit.id)}
                          className={cn(
                            "p-2 rounded-lg border-2 text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <div className="font-medium text-xs">{unit.name}</div>
                          <div className={cn(
                            "text-xs",
                            availableCount > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {availableCount}/{totalCount}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                    Tidak ada unit pada lantai ini
                  </div>
                )}
              </div>

              {/* Bed Grid */}
              {currentUnit && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">{currentUnit.name}</Label>
                    <Badge variant="outline" className="text-xs">
                      {bedsInUnit.filter(b => b.status === "available").length} / {bedsInUnit.length} tersedia
                    </Badge>
                  </div>
                  <TooltipProvider delayDuration={200}>
                    <div className="flex flex-wrap gap-2">
                      {bedsInUnit.map((bed) => {
                        const isAvailable = bed.status === "available";
                        const isOccupied = bed.status === "occupied";
                        const hasPatient = isOccupied && bed.current_patient;

                        return (
                          <Tooltip key={bed.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleBedClick(bed)}
                                className={cn(
                                  "w-14 h-14 rounded-md flex flex-col items-center justify-center text-xs font-medium transition-all",
                                  isAvailable && "bg-green-500 text-white hover:bg-green-600",
                                  bed.status === "occupied" && "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer",
                                  bed.status === "reserved" && "bg-amber-500 text-white",
                                  bed.status === "maintenance" && "bg-gray-400 text-white cursor-not-allowed",
                                  bed.status === "cleaning" && "bg-purple-500 text-white"
                                )}
                              >
                                <BedDouble className="h-5 w-5" />
                                <span className="text-xs">{bed.bed_number}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-semibold">Bed {bed.bed_number}</p>
                              <p className="text-xs capitalize">{getMasterDataName("bed_status", bed.status)}</p>
                              {hasPatient && (
                                <div className="mt-1 pt-1 border-t">
                                  <p className="text-xs flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                  {bed.current_patient?.name || "N/A"}
                                  </p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Detail Dialog */}
      <Dialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detail Pasien - Bed {selectedBed?.bed_number}
            </DialogTitle>
          </DialogHeader>
          {selectedBed && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Patient Info */}
              {selectedBed.current_patient ? (
                <>
                  {/* Header with patient name */}
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-7 w-7 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        {selectedBed.current_patient.name || "N/A"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>No. RM: {selectedBed.current_patient.medical_record_number || "N/A"}</span>
                        {selectedBed.current_patient.gender && (
                          <>
                            <span>•</span>
                            <span>{selectedBed.current_patient.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
                          </>
                        )}
                        {selectedBed.current_patient.age !== undefined && selectedBed.current_patient.age > 0 && (
                          <>
                            <span>•</span>
                            <span>{selectedBed.current_patient.age} tahun</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Patient Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedBed.current_patient.nik && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">NIK</p>
                        <p className="font-medium">{selectedBed.current_patient.nik}</p>
                      </div>
                    )}
                    {selectedBed.current_patient.birth_date && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Tanggal Lahir</p>
                        <p className="font-medium">
                          {format(new Date(selectedBed.current_patient.birth_date), "dd MMMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                    )}
                    {selectedBed.current_patient.phone && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">No. Telepon</p>
                        <p className="font-medium">{selectedBed.current_patient.phone}</p>
                      </div>
                    )}
                    {selectedBed.current_patient.insurance_type && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Jaminan</p>
                        <p className="font-medium">{selectedBed.current_patient.insurance_type}</p>
                        {selectedBed.current_patient.insurance_number && (
                          <p className="text-xs text-muted-foreground">{selectedBed.current_patient.insurance_number}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  {selectedBed.current_patient.address && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Alamat</p>
                      <p className="font-medium">{selectedBed.current_patient.address}</p>
                    </div>
                  )}

                  {/* Admission Info */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">Informasi Rawat Inap</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedBed.current_patient.admission_date && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Tanggal Masuk
                          </p>
                          <p className="font-medium">
                            {format(new Date(selectedBed.current_patient.admission_date), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                          </p>
                        </div>
                      )}
                      {selectedBed.current_patient.doctor_name && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-muted-foreground">DPJP</p>
                          <p className="font-medium">{selectedBed.current_patient.doctor_name}</p>
                        </div>
                      )}
                    </div>
                    {selectedBed.current_patient.diagnosis && (
                      <div className="p-3 bg-amber-50 rounded-lg text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Diagnosis</p>
                        <p className="font-medium">{selectedBed.current_patient.diagnosis}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t">
                    <Button className="w-full" onClick={() => setPatientDialogOpen(false)}>
                      Tutup
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <BedDouble className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Bed ini sedang kosong</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Status: {getMasterDataName("bed_status", selectedBed.status)}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setPatientDialogOpen(false)}>
                    Tutup
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
