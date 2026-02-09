import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { createVisitColumns } from "./columns";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCcw,
  Check,
  ChevronsUpDown,
  Tv,
  SlidersHorizontal,
  ExternalLink,
  Volume2,
  ScreenShare,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { roomQueuesApi, roomsApi, visitsApi } from "@/lib/api";
import type { Room } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Visit {
  id: number;
  visit_number: string;
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  complaint?: string;
  registration?: {
    id: number;
    registration_number: string;
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin: string;
      tanggal_lahir?: string;
    };
  };
  room?: {
    id: number;
    code: string;
    name: string;
    service_type?: string;
  };
  doctor?: {
    id: number;
    nama_lengkap: string;
  };
  room_queue?: {
    id: number;
    queue_number: string;
    status: string;
    priority: string;
  };
}

export default function VisitsIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();

  // Load saved filters from localStorage
  const getSavedFilter = (key: string, defaultValue: string) => {
    try {
      const saved = localStorage.getItem(`visits_filter_${key}`);
      return saved !== null ? saved : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [visits, setVisits] = useState<Visit[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>(() =>
    getSavedFilter("room", "")
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(() =>
    getSavedFilter("status", "active")
  );
  const [selectedDate, setSelectedDate] = useState<string>(""); // Empty = show all data
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [recallingId, setRecallingId] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [displayPanelOpen, setDisplayPanelOpen] = useState(false);
  const [cancelConfirmVisit, setCancelConfirmVisit] = useState<Visit | null>(null);

  // Check if user is admin
  const adminRoles = ["admin", "super admin", "system administrator", "sistem admin"];
  const isAdmin = adminRoles.includes(user?.role?.name?.toLowerCase() || "");

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("visits_filter_room", selectedRoom);
      localStorage.setItem("visits_filter_status", selectedStatus);
    } catch (error) {
      console.error("Failed to save filters:", error);
    }
  }, [selectedRoom, selectedStatus]);

  useEffect(() => {
    setPageTitle("Kunjungan");
    loadRooms();
  }, [isAdmin]);

  useEffect(() => {
    // Load visits on mount and when filters change
    loadVisits();
    // Auto refresh every 10 seconds
    const interval = setInterval(loadVisits, 10000);
    return () => clearInterval(interval);
  }, [selectedRoom, selectedStatus, selectedDate]);

  const loadRooms = async () => {
    try {
      // Admin can see all rooms, regular users only see assigned rooms
      const response = isAdmin
        ? await roomsApi.getAll({ limit: 1000 }) // Request all rooms for admin
        : await roomsApi.getMyAssignedRooms();

      // Filter: hanya yang aktif dan bukan depo farmasi atau gudang
      const allRooms = response.data.data || [];

      const filteredRooms = allRooms.filter((room: Room) => {
        const isActive = room.is_active === true;
        const notDepo = room.room_type !== "depo_farmasi";
        const notGudang = room.room_type !== "gudang_farmasi";
        return isActive && notDepo && notGudang;
      });

      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};

      // Only add date filter if date is selected
      if (selectedDate) {
        params.start_date = selectedDate;
        params.end_date = selectedDate;
      }

      // Only add room_id filter if a room is selected
      if (selectedRoom) {
        params.room_id = selectedRoom;
      }

      // Handle status filter
      if (selectedStatus === "active") {
        // Active means: waiting, in_queue, in_progress (not completed)
        params.status = "waiting,in_queue,in_progress";
      } else if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }

      const response = await visitsApi.getAll(params);
      const data = response.data || [];

      // Sort by check_in_time descending (newest first)
      const sortedData = data.sort((a: Visit, b: Visit) => {
        const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
        const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
      });

      setVisits(sortedData);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memuat data kunjungan",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedStatus, selectedDate, toast]);

  const handleCallQueue = async (visit: Visit) => {
    if (!visit.room_queue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Kunjungan ini tidak memiliki nomor antrian",
      });
      return;
    }

    setCallingId(visit.id);
    try {
      await roomQueuesApi.callQueue(visit.room_queue.id);

      toast({
        title: "Antrian Dipanggil",
        description: `Nomor antrian ${visit.room_queue.queue_number} - ${visit.registration?.patient?.nama_lengkap}`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memanggil antrian",
      });
    } finally {
      setCallingId(null);
    }
  };

  const handleRecallQueue = async (visit: Visit) => {
    if (!visit.room_queue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Kunjungan ini tidak memiliki nomor antrian",
      });
      return;
    }

    setRecallingId(visit.id);
    try {
      await roomQueuesApi.callQueue(visit.room_queue.id);

      toast({
        title: "Antrian Dipanggil Ulang",
        description: `Nomor antrian ${visit.room_queue.queue_number} - ${visit.registration?.patient?.nama_lengkap}`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil ulang antrian",
      });
    } finally {
      setRecallingId(null);
    }
  };

  const handleAcceptPatient = async (visit: Visit) => {
    setAcceptingId(visit.id);
    try {
      await visitsApi.acceptVisit(visit.id);

      toast({
        title: "Pasien Diterima",
        description: `${visit.registration?.patient?.nama_lengkap} telah diterima untuk pemeriksaan`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menerima pasien",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleViewDetail = (id: number) => {
    navigate(`/visits/${id}`);
  };

  const handleCancelVisit = async (visit: Visit) => {
    setCancelConfirmVisit(visit);
  };

  const handleConfirmCancelVisit = async () => {
    const visit = cancelConfirmVisit;
    if (!visit) return;
    setCancelConfirmVisit(null);

    setCancellingId(visit.id);
    try {
      await visitsApi.cancelVisit(visit.id);

      toast({
        title: "Kunjungan Dibatalkan",
        description: `Kunjungan ${visit.registration?.patient?.nama_lengkap} berhasil dibatalkan`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan kunjungan",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const columns = createVisitColumns({
    onCallQueue: handleCallQueue,
    onRecallQueue: handleRecallQueue,
    onAcceptPatient: handleAcceptPatient,
    onCancelVisit: handleCancelVisit,
    onViewDetail: handleViewDetail,
    callingId,
    recallingId,
    acceptingId,
    cancellingId,
    hasCallPermission: hasPermission("room_queues.call"),
    hasAcceptPermission: hasPermission("visits.update"),
    hasViewPermission: hasPermission("medical_records.view"),
    hasCancelPermission: hasPermission("visits.delete"),
  });

  if (loading && visits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Kunjungan Pasien
            {selectedRoom &&
              rooms.find((r) => r.id.toString() === selectedRoom) && (
                <>
                  {" - "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-base font-semibold text-primary hover:underline"
                    onClick={() =>
                      navigate(`/rooms/show/${selectedRoom}`)
                    }
                  >
                    {
                      rooms.find(
                        (r) => r.id.toString() === selectedRoom
                      )?.name
                    }
                  </Button>
                </>
              )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola kunjungan pasien -{" "}
            {selectedDate
              ? format(new Date(selectedDate), "EEEE, dd MMMM yyyy", {
                  locale: idLocale,
                })
              : "Semua Data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRoom && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                window.open(
                  `/room-queue/display/${selectedRoom}`,
                  "_blank"
                )
              }
            >
              <Tv className="h-4 w-4 mr-2" />
              Display Ruangan
            </Button>
          )}
          <Button
            variant={displayPanelOpen ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setDisplayPanelOpen(!displayPanelOpen)}
          >
            <ScreenShare className="h-4 w-4 mr-2" />
            Display Per Ruangan
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
      <div className="flex items-center gap-2 flex-wrap pt-4">
        {/* Date Filter */}
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-9 w-40"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate("")}
          className="h-9 px-3"
        >
          Semua Data
        </Button>

        <div className="h-6 border-r"></div>

        {/* Room Filter */}
        <Popover
          open={roomPopoverOpen}
          onOpenChange={setRoomPopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "h-9 w-[250px] justify-between",
                !selectedRoom && "text-muted-foreground"
              )}
            >
              {selectedRoom
                ? `${
                    rooms.find(
                      (r) => r.id.toString() === selectedRoom
                    )?.code
                  } - ${
                    rooms.find(
                      (r) => r.id.toString() === selectedRoom
                    )?.name
                  }`
                : "Semua Ruangan"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Cari ruangan..." />
              <CommandList>
                <CommandEmpty>Ruangan tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="Semua Ruangan"
                    onSelect={() => {
                      setSelectedRoom("");
                      setRoomPopoverOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !selectedRoom ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Semua Ruangan
                  </CommandItem>
                  {rooms.map((room) => (
                    <CommandItem
                      key={room.id}
                      value={`${room.code} ${room.name}`}
                      onSelect={() => {
                        setSelectedRoom(room.id.toString());
                        setRoomPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRoom === room.id.toString()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {room.code} - {room.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Select
          value={selectedStatus}
          onValueChange={setSelectedStatus}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              Aktif (Belum Selesai)
            </SelectItem>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="waiting">Menunggu</SelectItem>
            <SelectItem value="in_queue">Dalam Antrian</SelectItem>
            <SelectItem value="in_progress">
              Sedang Dilayani
            </SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {selectedRoom && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={loadVisits}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      </CollapsibleContent>
      </Collapsible>

      {/* Display Per Ruangan Panel */}
      {displayPanelOpen && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm">Display Per Ruangan</h3>
              <p className="text-xs text-muted-foreground">
                Buka display antrean per ruangan dengan suara pengumuman
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/queue-display", "_blank")}
            >
              <Tv className="h-3 w-3 mr-1" />
              Pengaturan Display
              <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {rooms.length === 0 ? (
              <span className="text-xs text-muted-foreground">Tidak ada ruangan</span>
            ) : (
              rooms.map((room) => (
                <Button
                  key={room.id}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => window.open(`/room-queue/display/${room.id}`, "_blank")}
                >
                  <Volume2 className="h-3 w-3 mr-1.5" />
                  {room.queue_code || room.code} - {room.name}
                  <ExternalLink className="h-2.5 w-2.5 ml-1.5 text-muted-foreground" />
                </Button>
              ))
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={visits}
        searchPlaceholder="Cari nomor RM, nama pasien, nomor kunjungan..."
        pageSize={10}
        tableId="visits"
      />

      {/* Cancel Visit Confirmation Dialog */}
      <AlertDialog open={!!cancelConfirmVisit} onOpenChange={(open) => !open && setCancelConfirmVisit(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Kunjungan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs">
                <p>Apakah Anda yakin ingin membatalkan kunjungan ini?</p>
                {cancelConfirmVisit && (
                  <dl className="border rounded-md px-3 py-2 space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Pasien</dt>
                      <dd className="font-medium">{cancelConfirmVisit.registration?.patient?.nama_lengkap}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. RM</dt>
                      <dd className="font-mono">{cancelConfirmVisit.registration?.patient?.no_rm}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ruangan</dt>
                      <dd>{cancelConfirmVisit.room?.name}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancelVisit}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
