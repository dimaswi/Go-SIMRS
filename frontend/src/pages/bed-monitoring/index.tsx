import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { PageShell, PageHeader, PageToolbar, PageContent } from "@/components/layout/page-shell";
import { roomsApi, masterDataApi, type Room, type RoomUnit, type Bed, type MasterData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  BedDouble,
  Building2,
  Search,
  Loader2,
  ExternalLink,
  RefreshCw,
  User,
  Calendar,
  Stethoscope,
  MapPin,
  Phone,
  Shield,
  IdCard,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface SelectedBedContext {
  bed: Bed;
  room: Room;
  unit: RoomUnit;
}

const BED_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    cardClass: string;
    badgeClass: string;
    dotClass: string;
    iconWrapClass: string;
  }
> = {
  available: {
    label: "Tersedia",
    cardClass:
      "border-emerald-300 bg-emerald-50/70 text-emerald-900 hover:border-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
    iconWrapClass: "bg-emerald-500 text-white",
  },
  occupied: {
    label: "Terisi",
    cardClass:
      "border-sky-300 bg-sky-50/80 text-sky-950 hover:border-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/60 dark:text-sky-200",
    dotClass: "bg-sky-600",
    iconWrapClass: "bg-sky-600 text-white",
  },
  reserved: {
    label: "Dipesan",
    cardClass:
      "border-amber-300 bg-amber-50/80 text-amber-950 hover:border-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200",
    dotClass: "bg-amber-500",
    iconWrapClass: "bg-amber-500 text-white",
  },
  cleaning: {
    label: "Cleaning",
    cardClass:
      "border-purple-300 bg-purple-50/70 text-purple-950 hover:border-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-100",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200",
    dotClass: "bg-purple-500",
    iconWrapClass: "bg-purple-500 text-white",
  },
  maintenance: {
    label: "Maintenance",
    cardClass:
      "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
    badgeClass: "bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300",
    dotClass: "bg-neutral-400",
    iconWrapClass: "bg-neutral-500 text-white",
  },
};

const getBedStatusMeta = (status: string) =>
  BED_STATUS_CONFIG[status] || {
    label: status || "-",
    cardClass: "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400",
    badgeClass: "bg-neutral-100 text-neutral-700 border-neutral-200",
    dotClass: "bg-neutral-400",
    iconWrapClass: "bg-neutral-700 text-white",
  };

export default function BedMonitoringIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [selectedContext, setSelectedContext] = useState<SelectedBedContext | null>(null);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [roomsRes, masterDataRes] = await Promise.all([
        roomsApi.getAll({ limit: 100 }),
        masterDataApi.getMultiple(["service_type", "room_type", "room_class", "bed_status", "bed_type"]),
      ]);

      const roomsWithBeds = (roomsRes.data.data || []).filter(
        (room: Room) =>
          room.has_bed &&
          room.is_active &&
          (room.service_type === "rawat_inap" || room.room_type === "rawat_inap")
      );

      // Load detail each room in parallel so units, beds, and current_patient are hydrated
      const detailedRooms = await Promise.all(
        roomsWithBeds.map(async (room: Room) => {
          try {
            const detailRes = await roomsApi.getById(room.id);
            return detailRes.data.data || room;
          } catch {
            return room;
          }
        })
      );

      setRooms(detailedRooms);
      setMasterData(masterDataRes.data.data || {});
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data monitoring bed.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Monitoring Bed");
    loadData();
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const getMasterDataName = (category: string, code?: string): string => {
    if (!code) return "-";
    const items = masterData[category] || [];
    const item = items.find((i) => i.code === code);
    return item?.name || code;
  };

  // Global stats across all rooms
  const overallStats = useMemo(() => {
    let total = 0;
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let other = 0;

    rooms.forEach((room) => {
      (room.units || []).forEach((unit) => {
        (unit.beds || []).forEach((bed) => {
          total++;
          if (bed.status === "available") available++;
          else if (bed.status === "occupied") occupied++;
          else if (bed.status === "reserved") reserved++;
          else other++;
        });
      });
    });

    return { total, available, occupied, reserved, other };
  }, [rooms]);

  // Filtered rooms/units/beds by search & filters
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rooms
      .filter((room) => roomFilter === "all" || String(room.id) === roomFilter)
      .map((room) => {
        const roomMatches =
          !q ||
          room.name.toLowerCase().includes(q) ||
          room.code.toLowerCase().includes(q);

        const units = (room.units || [])
          .filter((unit) => unit.is_active !== false)
          .map((unit) => {
            const unitMatches =
              unit.name.toLowerCase().includes(q) || unit.code.toLowerCase().includes(q);

            const beds = (unit.beds || []).filter((bed) => {
              if (statusFilter !== "all" && bed.status !== statusFilter) {
                return false;
              }
              if (!q) return true;
              if (roomMatches || unitMatches) return true;
              const patientName = bed.current_patient?.name?.toLowerCase() || "";
              const patientRm = bed.current_patient?.medical_record_number?.toLowerCase() || "";
              const bedNumber = bed.bed_number.toLowerCase();
              return (
                bedNumber.includes(q) ||
                patientName.includes(q) ||
                patientRm.includes(q)
              );
            });

            return { ...unit, beds };
          })
          .filter((unit) => unit.beds.length > 0);

        return { ...room, units };
      })
      .filter((room) => (room.units || []).length > 0);
  }, [rooms, roomFilter, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeBed = selectedContext?.bed || null;
  const activePatient = activeBed?.current_patient;

  return (
    <PageShell>
      <PageHeader
        icon={BedDouble}
        title="Monitoring Bed Rawat Inap"
        description="Tampilan status setiap bed rawat inap secara real-time — klik ikon bed untuk melihat informasi pasien"
        count={overallStats.total}
        badges={
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <Badge variant="outline" className="rounded-none border-emerald-300 bg-emerald-50 text-emerald-700">
              Tersedia: {overallStats.available}
            </Badge>
            <Badge variant="outline" className="rounded-none border-sky-300 bg-sky-50 text-sky-700">
              Terisi: {overallStats.occupied}
            </Badge>
            {overallStats.reserved > 0 && (
              <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-700">
                Dipesan: {overallStats.reserved}
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/display/bed-monitoring", "_blank")}
              className="h-8 rounded-none text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Display Publik
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-8 rounded-none text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      <PageToolbar className="justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
            <Input
              placeholder="Cari ruangan, nomor bed, nama pasien, No. RM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs rounded-none border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-none"
            />
          </div>

          {/* Room quick filter */}
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={roomFilter === "all" ? "default" : "outline"}
              className="h-7 rounded-none px-2.5 text-xs"
              onClick={() => setRoomFilter("all")}
            >
              Semua Ruangan
            </Button>
            {rooms.map((room) => (
              <Button
                key={room.id}
                type="button"
                size="sm"
                variant={roomFilter === String(room.id) ? "default" : "outline"}
                className="h-7 rounded-none px-2.5 text-xs"
                onClick={() => setRoomFilter(String(room.id))}
              >
                {room.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { key: "all", label: "Semua Status" },
            { key: "occupied", label: "Terisi", dot: "bg-sky-600" },
            { key: "available", label: "Tersedia", dot: "bg-emerald-500" },
            { key: "reserved", label: "Dipesan", dot: "bg-amber-500" },
            { key: "cleaning", label: "Cleaning", dot: "bg-purple-500" },
            { key: "maintenance", label: "Maintenance", dot: "bg-neutral-400" },
          ].map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={statusFilter === item.key ? "secondary" : "ghost"}
              className={cn(
                "h-7 rounded-none px-2 text-xs border",
                statusFilter === item.key
                  ? "border-neutral-400 dark:border-neutral-600 font-semibold"
                  : "border-transparent"
              )}
              onClick={() => setStatusFilter(item.key)}
            >
              {item.dot && <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", item.dot)} />}
              {item.label}
            </Button>
          ))}
        </div>
      </PageToolbar>

      <PageContent>
        {filteredRooms.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
            <BedDouble className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all" || roomFilter !== "all"
                ? "Tidak ada bed yang sesuai dengan filter pencarian"
                : "Tidak ada ruangan rawat inap dengan bed aktif yang tersedia"}
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="space-y-6">
              {filteredRooms.map((room) => {
                const totalBeds = room.total_beds || (room.units || []).reduce((acc, u) => acc + (u.beds?.length || 0), 0);
                const availableBeds =
                  room.available_beds ??
                  (room.units || []).reduce(
                    (acc, u) => acc + (u.beds?.filter((b) => b.status === "available").length || 0),
                    0
                  );
                const occupiedBeds =
                  (room.units || []).reduce(
                    (acc, u) => acc + (u.beds?.filter((b) => b.status === "occupied").length || 0),
                    0
                  );
                const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

                return (
                  <section
                    key={room.id}
                    className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                  >
                    {/* Room Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                          <Building2 className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
                              {room.name}
                            </h2>
                            <Badge variant="secondary" className="rounded-none text-[10px]">
                              {getMasterDataName("room_type", room.room_type)}
                            </Badge>
                            {room.room_class && (
                              <Badge variant="outline" className="rounded-none text-[10px]">
                                {getMasterDataName("room_class", room.room_class)}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-foreground">
                            <span>{totalBeds} Bed</span>
                            <span className="text-sky-600 dark:text-sky-400">Terisi: {occupiedBeds}</span>
                            <span className="text-emerald-600 dark:text-emerald-400">Tersedia: {availableBeds}</span>
                            <span>Okupansi: {occupancyPct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-none px-2.5 text-xs"
                          onClick={() => navigate(`/bed-monitoring/${room.id}`)}
                        >
                          Detail Ruangan
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-none px-2.5 text-xs"
                          onClick={() => window.open(`/display/bed-monitoring/${room.id}`, "_blank")}
                          title="Buka tampilan display publik"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Display
                        </Button>
                      </div>
                    </div>

                    {/* Room Units & Per-Bed Icon Cards */}
                    <div className="p-4 space-y-5">
                      {(room.units || []).map((unit) => {
                        const unitBeds = unit.beds || [];
                        const unitAvailable = unitBeds.filter((b) => b.status === "available").length;

                        return (
                          <div key={unit.id} className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-dashed border-neutral-200 dark:border-neutral-800 pb-1.5">
                              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                <Layers className="h-3.5 w-3.5 text-neutral-500" />
                                <span>{unit.name}</span>
                                <span className="text-[11px] font-mono font-normal text-muted-foreground">
                                  (Lt. {unit.floor})
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {unitAvailable}/{unitBeds.length} tersedia
                              </span>
                            </div>

                            {/* Grid of clickable Bed Logos */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
                              {unitBeds.map((bed) => {
                                const meta = getBedStatusMeta(bed.status);
                                const patient = bed.current_patient;

                                return (
                                  <Tooltip key={bed.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedContext({ bed, room, unit })}
                                        className={cn(
                                          "group relative flex flex-col items-center justify-between border p-2.5 text-center transition-all cursor-pointer shadow-none focus:outline-none focus:ring-2 focus:ring-primary/40",
                                          meta.cardClass
                                        )}
                                      >
                                        {/* Top status indicator */}
                                        <div className="flex w-full items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider">
                                          <span className="inline-flex items-center gap-1">
                                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                                            {meta.label}
                                          </span>
                                        </div>

                                        {/* Large Bed Logo */}
                                        <div
                                          className={cn(
                                            "my-2 flex h-11 w-14 items-center justify-center rounded-md transition-transform group-hover:scale-105 shadow-xs",
                                            meta.iconWrapClass
                                          )}
                                        >
                                          <BedDouble className="h-6 w-6" />
                                        </div>

                                        {/* Bed Number + Patient Name snippet */}
                                        <div className="w-full min-w-0 space-y-0.5">
                                          <div className="font-mono text-xs font-bold leading-none">
                                            {bed.bed_number}
                                          </div>
                                          <div className="truncate text-[10px] font-medium opacity-85">
                                            {patient ? patient.name : "Kosong"}
                                          </div>
                                        </div>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs space-y-1">
                                      <p className="font-semibold">
                                        {room.name} • {unit.name} • Bed {bed.bed_number}
                                      </p>
                                      <p className="text-xs">Status: {meta.label}</p>
                                      {patient ? (
                                        <div className="border-t pt-1 text-xs">
                                          <p className="font-medium">{patient.name}</p>
                                          <p className="text-muted-foreground">No. RM: {patient.medical_record_number}</p>
                                          <p className="text-sky-600 dark:text-sky-400">Klik untuk detail pasien</p>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">Klik untuk detail bed</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </PageContent>

      {/* Patient / Bed Detail Dialog */}
      <Dialog
        open={Boolean(selectedContext)}
        onOpenChange={(open) => {
          if (!open) setSelectedContext(null);
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BedDouble className="h-5 w-5" />
              <span>
                Bed {activeBed?.bed_number} — {selectedContext?.room.name}
              </span>
            </DialogTitle>
            {selectedContext && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span>{selectedContext.unit.name} (Lt. {selectedContext.unit.floor})</span>
                <span>•</span>
                <Badge
                  variant="outline"
                  className={cn("rounded-none text-[10px]", getBedStatusMeta(activeBed?.status || "").badgeClass)}
                >
                  {getBedStatusMeta(activeBed?.status || "").label}
                </Badge>
                {activeBed?.bed_type && (
                  <Badge variant="outline" className="rounded-none text-[10px]">
                    {getMasterDataName("bed_type", activeBed.bed_type)}
                  </Badge>
                )}
              </div>
            )}
          </DialogHeader>

          {activeBed && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pt-1">
              {activePatient ? (
                <>
                  {/* Header with patient identity */}
                  <div className="flex items-center gap-3.5 border border-sky-200 bg-sky-50/70 p-3.5 dark:border-sky-800 dark:bg-sky-950/40">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-sky-600 text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-neutral-900 dark:text-white">
                        {activePatient.name || "N/A"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">
                          No. RM: {activePatient.medical_record_number || "-"}
                        </span>
                        {activePatient.gender && (
                          <>
                            <span>•</span>
                            <span>{activePatient.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
                          </>
                        )}
                        {activePatient.age !== undefined && activePatient.age > 0 && (
                          <>
                            <span>•</span>
                            <span>{activePatient.age} tahun</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Demographics Grid */}
                  <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                    {activePatient.nik && (
                      <div className="border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <IdCard className="h-3 w-3" /> NIK
                        </p>
                        <p className="mt-0.5 font-mono font-medium">{activePatient.nik}</p>
                      </div>
                    )}
                    {activePatient.birth_date && (
                      <div className="border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" /> Tanggal Lahir
                        </p>
                        <p className="mt-0.5 font-medium">
                          {format(new Date(activePatient.birth_date), "dd MMMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                    )}
                    {activePatient.phone && (
                      <div className="border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3" /> No. Telepon
                        </p>
                        <p className="mt-0.5 font-mono font-medium">{activePatient.phone}</p>
                      </div>
                    )}
                    {activePatient.insurance_type && (
                      <div className="border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Shield className="h-3 w-3" /> Jaminan
                        </p>
                        <p className="mt-0.5 font-medium uppercase">{activePatient.insurance_type}</p>
                        {activePatient.insurance_number && (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {activePatient.insurance_number}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  {activePatient.address && (
                    <div className="border border-neutral-200 bg-neutral-50/60 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-0.5">
                        <MapPin className="h-3 w-3" /> Alamat
                      </p>
                      <p className="font-medium">{activePatient.address}</p>
                    </div>
                  )}

                  {/* Admission Info */}
                  {(activePatient.admission_date || activePatient.doctor_name || activePatient.diagnosis) && (
                    <div className="space-y-2.5 border-t pt-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Informasi Perawatan
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                        {activePatient.admission_date && (
                          <div className="border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" /> Tanggal Masuk
                            </p>
                            <p className="mt-0.5 font-medium">
                              {format(new Date(activePatient.admission_date), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                            </p>
                          </div>
                        )}
                        {activePatient.doctor_name && (
                          <div className="border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Stethoscope className="h-3 w-3" /> DPJP / Dokter
                            </p>
                            <p className="mt-0.5 font-medium">{activePatient.doctor_name}</p>
                          </div>
                        )}
                      </div>
                      {activePatient.diagnosis && (
                        <div className="border border-amber-200 bg-amber-50/50 p-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/30">
                          <p className="text-[11px] text-muted-foreground mb-0.5">Diagnosis</p>
                          <p className="font-medium">{activePatient.diagnosis}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {activePatient.visit_id > 0 && (
                      <Button asChild size="sm" className="flex-1 rounded-none text-xs">
                        <Link to={`/visits/${activePatient.visit_id}`}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Lihat Kunjungan
                        </Link>
                      </Button>
                    )}
                    {activePatient.patient_id && (
                      <Button asChild variant="outline" size="sm" className="rounded-none text-xs">
                        <Link to={`/patient-search/${activePatient.patient_id}`}>
                          Profil Pasien
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs"
                      onClick={() => setSelectedContext(null)}
                    >
                      Tutup
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                    <BedDouble className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {activeBed.status === "occupied"
                        ? "Bed terisi namun data kunjungan aktif tidak ditemukan"
                        : "Bed ini sedang kosong"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {getBedStatusMeta(activeBed.status).label}
                      {activeBed.notes ? ` • ${activeBed.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs"
                      onClick={() => navigate(`/bed-monitoring/${selectedContext?.room.id}`)}
                    >
                      Buka Detail Ruangan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs"
                      onClick={() => setSelectedContext(null)}
                    >
                      Tutup
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
