import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";

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
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  BedDouble,
  User,
  Calendar,
  ChevronLeft,
  RefreshCw,
  Building2,
  Layers,
  ExternalLink,
  Copy,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function RoomMonitoring() {
  const { id: roomId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [units, setUnits] = useState<RoomUnit[]>([]);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number>(() => {
    const floorParam = searchParams.get("floor");
    return floorParam ? parseInt(floorParam) : 1;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(() => {
    const unitParam = searchParams.get("unit");
    return unitParam ? parseInt(unitParam) : null;
  });
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Update URL params when state changes
  const updateUrlParams = useCallback((floor: number, unitId: number | null, bedId: number | null) => {
    const params = new URLSearchParams();
    params.set("floor", floor.toString());
    if (unitId) params.set("unit", unitId.toString());
    if (bedId) params.set("bed", bedId.toString());
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

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
      setPageTitle(`Monitoring - ${roomData.name}`);

      // Auto select first unit with beds if not selected
      if (!selectedUnitId && roomData.units && roomData.units.length > 0) {
        const unitsOnFloor = (roomData.units || []).filter((u: RoomUnit) => u.floor === selectedFloor);
        if (unitsOnFloor.length > 0) {
          setSelectedUnitId(unitsOnFloor[0].id);
        }
      }

      // Open bed dialog from URL params (only on initial load)
      if (!initialLoadDone) {
        const bedParam = searchParams.get("bed");
        if (bedParam) {
          const bedId = parseInt(bedParam);
          // Find bed in units
          for (const unit of (roomData.units || [])) {
            const bed = (unit.beds || []).find((b: Bed) => b.id === bedId);
            if (bed) {
              setSelectedBed(bed);
              setPatientDialogOpen(true);
              break;
            }
          }
        }
        setInitialLoadDone(true);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data ruangan.",
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast, selectedFloor, selectedUnitId, searchParams, initialLoadDone]);

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 30000);
    return () => clearInterval(dataInterval);
  }, [loadData]);

  // Copy public URL to clipboard
  const copyPublicUrl = () => {
    const publicUrl = `${window.location.origin}/display/bed-monitoring/${roomId}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({
        variant: "success",
        title: "URL Disalin!",
        description: "URL publik berhasil disalin ke clipboard.",
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Gagal!",
        description: "Gagal menyalin URL ke clipboard.",
      });
    });
  };

  // Open public URL in new tab
  const openPublicUrl = () => {
    const publicUrl = `${window.location.origin}/display/bed-monitoring/${roomId}`;
    window.open(publicUrl, '_blank');
  };

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
    updateUrlParams(selectedFloor, selectedUnitId, bed.id);
  };

  // Handle dialog close
  const handleDialogClose = (open: boolean) => {
    setPatientDialogOpen(open);
    if (!open) {
      // Remove bed param from URL when closing
      updateUrlParams(selectedFloor, selectedUnitId, null);
    }
  };

  // Handle floor change
  const handleFloorChange = (floor: number) => {
    setSelectedFloor(floor);
    setSelectedUnitId(null);
    updateUrlParams(floor, null, null);
  };

  // Handle unit change
  const handleUnitChange = (unitId: number) => {
    setSelectedUnitId(unitId);
    updateUrlParams(selectedFloor, unitId, null);
  };

  // Get selected unit data
  const currentUnit = filteredUnits.find((u) => u.id === selectedUnitId);
  const bedsInUnit = currentUnit?.beds || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Ruangan tidak ditemukan</p>
        <Button variant="outline" asChild>
          <Link to="/bed-monitoring">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Kembali
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/bed-monitoring">
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base md:text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 md:h-5 md:w-5" />
              {room.name}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Monitoring Bed - {room.code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="outline" size="sm" onClick={copyPublicUrl} className="hidden sm:flex h-8 text-xs">
            <Copy className="h-3 w-3 mr-1" />
            Salin URL
          </Button>
          <Button variant="outline" size="sm" onClick={openPublicUrl} className="h-8 text-xs">
            <ExternalLink className="h-3 w-3 md:mr-1" />
            <span className="hidden md:inline">Display</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="h-8 text-xs">
            <RefreshCw className="h-3 w-3 md:mr-1" />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Column - Statistics & Navigation */}
        <div className="rounded-lg border flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-4 shrink-0 py-2 px-3">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BedDouble className="h-3.5 w-3.5" />
              Statistik Bed
            </h1>
          </div>
          <div className="p-3 overflow-y-auto flex-1">
            <div className="space-y-3">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/50 rounded-lg text-center">
                <div className="text-lg md:text-xl font-bold text-primary">{stats.total}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Total Bed</div>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-center">
                <div className="text-lg md:text-xl font-bold text-green-600">{stats.available}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Tersedia</div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <div className="text-lg md:text-xl font-bold text-blue-600">{stats.occupied}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Terisi</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-center">
                <div className="text-lg md:text-xl font-bold text-amber-600">{stats.reserved}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Dipesan</div>
              </div>
            </div>

            {/* Floor Navigation */}
            {availableFloors.length > 1 && (
              <div className="space-y-1.5 border-t pt-3">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  Pilih Lantai
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {availableFloors.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => handleFloorChange(floor)}
                      className={cn(
                        "p-1.5 rounded-lg border-2 text-center transition-all text-xs font-medium",
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
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs font-medium">Keterangan</Label>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span>Tersedia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span>Terisi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500"></div>
                  <span>Dipesan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-400"></div>
                  <span>Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-500"></div>
                  <span>Cleaning</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Right Column - Bed Selection */}
        <div className="rounded-lg border lg:col-span-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-4 shrink-0 py-2 px-3">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BedDouble className="h-3.5 w-3.5" />
              Daftar Bed - Lantai {selectedFloor}
            </h1>
          </div>
          <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Unit Selection */}
            <div className="space-y-2 mb-3 shrink-0">
              <Label className="text-xs font-semibold flex items-center gap-2">
                Pilih Unit/Kamar
              </Label>
              {filteredUnits.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                  {filteredUnits.map((unit) => {
                    const availableCount = unit.beds?.filter((b) => b.status === "available").length || 0;
                    const totalCount = unit.beds?.length || 0;
                    const isSelected = selectedUnitId === unit.id;

                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => handleUnitChange(unit.id)}
                        className={cn(
                          "p-1.5 rounded-lg border-2 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <div className="font-medium text-[10px] md:text-xs truncate">{unit.name}</div>
                        <div className={cn(
                          "text-[10px]",
                          availableCount > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {availableCount}/{totalCount}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 border rounded-lg text-center">
                  Tidak ada unit pada lantai ini
                </div>
              )}
            </div>

            {/* Bed Grid */}
            {currentUnit && (
              <div className="border rounded-lg p-3 bg-muted/30 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <Label className="text-xs font-semibold">{currentUnit.name}</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {bedsInUnit.filter(b => b.status === "available").length} / {bedsInUnit.length} tersedia
                  </Badge>
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="flex flex-wrap gap-1.5 overflow-y-auto flex-1 content-start">
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
                                "w-10 h-10 md:w-11 md:h-11 rounded-md flex flex-col items-center justify-center text-[10px] font-medium transition-all",
                                isAvailable && "bg-green-500 text-white hover:bg-green-600",
                                bed.status === "occupied" && "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer",
                                bed.status === "reserved" && "bg-amber-500 text-white",
                                bed.status === "maintenance" && "bg-gray-400 text-white cursor-not-allowed",
                                bed.status === "cleaning" && "bg-purple-500 text-white"
                              )}
                            >
                              <BedDouble className="h-3.5 w-3.5" />
                              <span className="text-[9px]">{bed.bed_number}</span>
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
                                <p className="text-xs text-muted-foreground">
                                  Klik untuk detail
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

      {/* Patient Detail Dialog */}
      <Dialog open={patientDialogOpen} onOpenChange={handleDialogClose}>
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
                  <div className="flex gap-2 pt-2 border-t">
                    {selectedBed.current_patient.visit_id && (
                      <Button asChild className="flex-1">
                        <Link to={`/visits/${selectedBed.current_patient.visit_id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Lihat Kunjungan
                        </Link>
                      </Button>
                    )}
                    {selectedBed.current_patient.patient_id && (
                      <Button asChild variant="outline">
                        <Link to={`/patient-search/${selectedBed.current_patient.patient_id}`}>
                          Profil Pasien
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleDialogClose(false)}>
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
                  <Button variant="outline" className="mt-4" onClick={() => handleDialogClose(false)}>
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
