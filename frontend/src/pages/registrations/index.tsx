import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createRegistrationColumns } from "./columns";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { QueueTicketPrint } from "@/components/queue-ticket-print";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Plus,
  UserRound,
  RefreshCcw,
  Check,
  ChevronsUpDown,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { format, addDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useReactToPrint } from "react-to-print";

interface Room {
  id: number;
  code: string;
  name: string;
}

// Format tanggal ke string yyyy-MM-dd (dari browser timezone lokal)
const getTodayString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function RegistrationIndex() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(""); // Empty = show all data
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<Registration | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit: 1000, // Get all records
      };
      
      // Only add date filter if date is selected
      if (selectedDate) {
        params.date = selectedDate;
      }
      
      if (selectedRoom !== "all")
        params.destination_room_id = parseInt(selectedRoom);
      if (selectedStatus !== "all") params.status = selectedStatus;

      const response = await registrationApi.getAll(params);

      // Sort by registration_date descending (newest first)
      const sortedData = (response.data.data || []).sort(
        (a: Registration, b: Registration) => {
          const dateA = a.registration_date
            ? new Date(a.registration_date).getTime()
            : 0;
          const dateB = b.registration_date
            ? new Date(b.registration_date).getTime()
            : 0;
          return dateB - dateA;
        }
      );

      setRegistrations(sortedData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pendaftaran.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedStatus, selectedDate, toast]);

  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get("/rooms", {
        params: { limit: 100 },
      });
      // Filter: rawat jalan, gawat darurat (UGD), penunjang medis, dan farmasi (BUKAN rawat inap dan depo)
      const filteredRooms = (response.data.data || []).filter(
        (room: Room & { service_type?: string; room_type?: string }) =>
          room.service_type &&
          [
            "rawat_jalan",
            "gawat_darurat",
            "penunjang_medis",
            "farmasi",
          ].includes(room.service_type) &&
          room.room_type !== "depo_farmasi" // Exclude depo farmasi
      );
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data ruangan",
      });
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Pendaftaran");
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await registrationApi.cancel(cancelId);
      toast({
        title: "Pendaftaran Dibatalkan",
        description: "Pendaftaran berhasil dibatalkan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan pendaftaran.",
      });
    } finally {
      setCancelId(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/registrations/show/${id}`);
  };

  const handlePrintQueue = (registration: Registration) => {
    if (!registration.visit?.room_queue) {
      toast({
        title: "Error",
        description: "Nomor antrian tidak tersedia",
        variant: "destructive",
      });
      return;
    }
    setPrintData(registration);
    // Trigger print after state is set
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const columns = createRegistrationColumns({
    onView: handleView,
    onPrint: handlePrintQueue,
    onCancel: setCancelId,
    hasViewPermission: hasPermission("registrations.view"),
    hasDeletePermission: hasPermission("registrations.delete"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      Pendaftaran Pasien
                    </CardTitle>
                    <CardDescription>
                      Kelola pendaftaran pasien -{" "}
                      {selectedDate
                        ? format(new Date(selectedDate), "EEEE, dd MMMM yyyy", {
                            locale: idLocale,
                          })
                        : "Semua Data"}
                    </CardDescription>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-4 pb-2 pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm font-medium">
                        Filter Tanggal:
                      </label>
                    </div>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-48"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate("")}
                    >
                      Semua Data
                    </Button>
                    <div className="flex flex-1 gap-2">
                      <Popover
                        open={roomPopoverOpen}
                        onOpenChange={setRoomPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-[220px] justify-between",
                              selectedRoom === "all" && "text-muted-foreground"
                            )}
                          >
                            {selectedRoom === "all"
                              ? "Semua Poli"
                              : `${
                                  rooms.find(
                                    (r) => r.id.toString() === selectedRoom
                                  )?.code
                                } - ${
                                  rooms.find(
                                    (r) => r.id.toString() === selectedRoom
                                  )?.name
                                }`}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Cari ruangan..." />
                            <CommandList>
                              <CommandEmpty>
                                Ruangan tidak ditemukan.
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setSelectedRoom("all");
                                    setRoomPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedRoom === "all"
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  Semua Poli
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
                      <Select
                        value={selectedStatus}
                        onValueChange={setSelectedStatus}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="registered">Terdaftar</SelectItem>
                          <SelectItem value="in_queue">
                            Dalam Antrean
                          </SelectItem>
                          <SelectItem value="in_progress">
                            Sedang Diproses
                          </SelectItem>
                          <SelectItem value="completed">Selesai</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={loadData}>
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    {hasPermission("registrations.create") && (
                      <Button
                        onClick={() => navigate("/registrations/create")}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Pendaftaran
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={registrations}
              searchPlaceholder="Cari no. registrasi atau nama pasien..."
              pageSize={10}
              tableId="registrations"
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        onConfirm={handleCancel}
        title="Batalkan Pendaftaran?"
        description="Apakah Anda yakin ingin membatalkan pendaftaran ini?"
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />

      {/* Hidden Print Component */}
      {printData?.visit?.room_queue && (
        <QueueTicketPrint
          ref={printRef}
          queueNumber={printData.visit.room_queue.queue_number}
          patientName={
            printData.patient?.nama_lengkap || printData.patient?.name || ""
          }
          noRM={
            printData.patient?.no_rm ||
            printData.patient?.medical_record_number ||
            ""
          }
          roomName={printData.destination_room?.name || ""}
          roomCode={printData.destination_room?.code || ""}
          priority={printData.visit.room_queue.priority}
          date={format(new Date(), "dd/MM/yyyy")}
          time={format(new Date(), "HH:mm")}
        />
      )}
    </div>
  );
}
