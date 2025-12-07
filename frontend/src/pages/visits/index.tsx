import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { createVisitColumns } from "./columns";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { 
  Loader2,
  Users,
  Activity,
  RefreshCcw,
  Check,
  ChevronsUpDown,
  Tv
} from "lucide-react";
import { roomQueuesApi, roomsApi, visitsApi } from "@/lib/api";
import type { Room } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  const [visits, setVisits] = useState<Visit[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [recallingId, setRecallingId] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);

  useEffect(() => {
    setPageTitle("Kunjungan");
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadVisits();
      // Auto refresh every 10 seconds
      const interval = setInterval(loadVisits, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedRoom, selectedStatus]);

  const loadRooms = async () => {
    try {
      const response = await roomsApi.getAll({ limit: 100 });
      // Filter: rawat jalan, gawat darurat (UGD), penunjang medis, farmasi, dan rawat inap yang aktif (BUKAN depo)
      const filteredRooms = (response.data.data || []).filter(
        (room: Room) => 
          room.is_active && 
          room.service_type &&
          ['rawat_jalan', 'gawat_darurat', 'penunjang_medis', 'farmasi', 'rawat_inap'].includes(room.service_type) &&
          room.room_type !== 'depo_farmasi' // Exclude depo farmasi
      );
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const loadVisits = useCallback(async () => {
    if (!selectedRoom) return;

    setLoading(true);
    try {
      const params: any = {
        room_id: selectedRoom,
        date: new Date().toISOString().split('T')[0],
      };

      if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }

      const response = await visitsApi.getAll(params);
      setVisits(response.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data kunjungan",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedStatus, toast]);

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
        description: error.response?.data?.error || "Gagal memanggil ulang antrian",
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

  const columns = createVisitColumns({
    onCallQueue: handleCallQueue,
    onRecallQueue: handleRecallQueue,
    onAcceptPatient: handleAcceptPatient,
    onViewDetail: handleViewDetail,
    callingId,
    recallingId,
    acceptingId,
    hasCallPermission: hasPermission("room_queues.call"),
    hasAcceptPermission: hasPermission("visits.update"),
    hasViewPermission: hasPermission("medical_records.view"),
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
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  Kunjungan Pasien
                  {selectedRoom && rooms.find(r => r.id.toString() === selectedRoom) && (
                    <>
                      {" - "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-base font-semibold text-primary hover:underline"
                        onClick={() => navigate(`/rooms/show/${selectedRoom}`)}
                      >
                        {rooms.find(r => r.id.toString() === selectedRoom)?.name}
                      </Button>
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Kelola kunjungan pasien dan panggil antrian ruangan
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedRoom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/room-queue/display/${selectedRoom}`, '_blank')}
                >
                  <Tv className="h-4 w-4 mr-2" />
                  Display Antrian
                </Button>
              )}
              <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-[250px] justify-between",
                      !selectedRoom && "text-muted-foreground"
                    )}
                  >
                    {selectedRoom
                      ? `${rooms.find((r) => r.id.toString() === selectedRoom)?.code} - ${rooms.find((r) => r.id.toString() === selectedRoom)?.name}`
                      : "Pilih Ruangan *"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cari ruangan..." />
                    <CommandList>
                      <CommandEmpty>Ruangan tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
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
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="waiting">Menunggu</SelectItem>
                  <SelectItem value="in_queue">Dalam Antrian</SelectItem>
                  <SelectItem value="in_progress">Sedang Dilayani</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
              {selectedRoom && (
                <Button variant="outline" size="icon" onClick={loadVisits}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!selectedRoom ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Pilih Ruangan</p>
              <p className="text-sm">Pilih ruangan untuk melihat daftar kunjungan pasien</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={visits}
              searchPlaceholder="Cari nomor RM, nama pasien, nomor kunjungan..."
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
