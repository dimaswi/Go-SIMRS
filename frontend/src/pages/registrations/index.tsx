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
import { DataTable } from "@/components/ui/data-table";
import { createRegistrationColumns } from "./columns";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { printApi } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Plus,
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
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Room {
  id: number;
  code: string;
  name: string;
}

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
  const [cancelMjknId, setCancelMjknId] = useState<number | null>(null);
  const [printingType, setPrintingType] = useState<{ regId: number; type: 'queue' | 'label' } | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [mjknQueueMap, setMjknQueueMap] = useState<Map<number, BPJSQueue>>(new Map());
  const [activatingCheckin, setActivatingCheckin] = useState<number | null>(null);

  const loadMjknQueues = useCallback(async () => {
    try {
      // Load both booking and checkin MJKN queues to mark them in the table
      const [bookingRes, checkinRes] = await Promise.all([
        bpjsApi.getQueues({ status: "booking" }),
        bpjsApi.getQueues({ status: "checkin" }),
      ]);
      const allQueues = [
        ...(bookingRes.data.data || []),
        ...(checkinRes.data.data || []),
      ];
      const map = new Map<number, BPJSQueue>();
      for (const q of allQueues) {
        if (q.registration_id) {
          map.set(q.registration_id, q);
        }
      }
      setMjknQueueMap(map);
    } catch (error) {
      console.error("Failed to load MJKN queues:", error);
    }
  }, []);

  const handleActivateCheckin = async (queueId: number) => {
    setActivatingCheckin(queueId);
    try {
      await bpjsApi.activateQueueCheckin(queueId);
      toast({
        title: "Berhasil!",
        description: "Check-in MJKN berhasil diaktifkan",
      });
      loadMjknQueues();
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Gagal mengaktifkan check-in";
      toast({
        variant: "destructive",
        title: "Error!",
        description: errorMessage,
      });
    } finally {
      setActivatingCheckin(null);
    }
  };

  const handleCancelMjkn = async () => {
    if (!cancelMjknId) return;
    try {
      await bpjsApi.cancelQueue(cancelMjknId);
      toast({
        title: "Antrian MJKN Dibatalkan",
        description: "Antrian MJKN berhasil dibatalkan.",
      });
      loadMjknQueues();
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan antrian MJKN.",
      });
    } finally {
      setCancelMjknId(null);
    }
  };

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
    loadMjknQueues();
  }, [loadRooms, loadMjknQueues]);

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

  const handlePrintQueueTicket = async (registration: Registration) => {
    if (!registration.visit?.room_queue) {
      toast({
        title: "Error",
        description: "Nomor antrian tidak tersedia",
        variant: "destructive",
      });
      return;
    }

    const regId = registration.ID || registration.id || 0;
    setPrintingType({ regId, type: 'queue' });
    try {
      const url = await printApi.queueTicket(registration.visit.room_queue.id);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak tiket antrian",
        variant: "destructive",
      });
    } finally {
      setPrintingType(null);
    }
  };

  const handlePrintPatientLabel = async (registration: Registration) => {
    if (!registration.patient?.id) {
      toast({
        title: "Error",
        description: "Data pasien tidak tersedia",
        variant: "destructive",
      });
      return;
    }

    const regId = registration.ID || registration.id || 0;
    setPrintingType({ regId, type: 'label' });
    try {
      const url = await printApi.patientLabel(registration.patient.id, 4);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak label pasien",
        variant: "destructive",
      });
    } finally {
      setPrintingType(null);
    }
  };

  const columns = createRegistrationColumns({
    onView: handleView,
    onPrintQueueTicket: handlePrintQueueTicket,
    onPrintPatientLabel: handlePrintPatientLabel,
    onCancel: setCancelId,
    onCancelMjkn: setCancelMjknId,
    onActivateMjkn: handleActivateCheckin,
    hasViewPermission: hasPermission("registrations.view"),
    hasDeletePermission: hasPermission("registrations.delete"),
    printingType,
    mjknQueueMap,
    activatingCheckin,
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
                          <SelectItem value="scheduled">Terjadwal (MJKN)</SelectItem>
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

      {/* Confirm dialog for regular registration cancellation */}
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

      {/* Confirm dialog for MJKN queue cancellation */}
      <ConfirmDialog
        open={cancelMjknId !== null}
        onOpenChange={(open) => !open && setCancelMjknId(null)}
        onConfirm={handleCancelMjkn}
        title="Batalkan Antrian MJKN?"
        description="Apakah Anda yakin ingin membatalkan antrian Mobile JKN ini? Pendaftaran dan kunjungan terkait juga akan dibatalkan."
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />
    </div>
  );
}
