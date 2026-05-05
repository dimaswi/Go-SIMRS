import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registrationApi, type ScheduledRegistration } from "@/lib/api/queue";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CheckInKontrolDrawer } from "@/components/registration/checkin-kontrol-drawer";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCcw,
  CalendarClock,
  CheckCircle2,
  XCircle,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatPatientName } from "@/lib/print-utils";

// Helper to get today's date string
const getTodayString = (): string => {
  const now = new Date();
  return format(now, "yyyy-MM-dd");
};

export default function ScheduledRegistrationsPage() {
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<ScheduledRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("scheduled");
  const [rooms, setRooms] = useState<Room[]>([]);

  // Dialogs
  const [checkInDrawerOpen, setCheckInDrawerOpen] = useState(false);
  const [checkInId, setCheckInId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [rescheduleData, setRescheduleData] = useState<{
    id: number;
    currentDate: string;
    currentRoom: number;
    patientName: string;
  } | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_room_id: "",
    reason: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Load rooms for filter
  useEffect(() => {
    const loadRooms = async () => {
      try {
        // Use high limit to get all rooms for dropdown selection
        const response = await roomsApi.getAll({ limit: 1000, is_active: 'true' });
        const poliRooms = (response.data.data || []).filter(
          r => r.service_type === "rawat_jalan" && r.is_active
        );
        setRooms(poliRooms);
      } catch {
        console.error("Failed to load rooms");
      }
    };
    loadRooms();
  }, []);

  // Load scheduled registrations
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {};

      if (selectedDate) {
        params.date = selectedDate;
      }
      if (selectedRoom !== "all") {
        params.room_id = parseInt(selectedRoom);
      }
      if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }
      if (selectedStatus === "all" || selectedStatus === "no_show") {
        params.include_past = true;
      }

      const response = await registrationApi.getScheduled(params);
      setRegistrations(response.data.data || []);
    } catch (error) {
      console.error("Failed to load scheduled registrations:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data jadwal kontrol",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedRoom, selectedStatus, toast]);

  useEffect(() => {
    setPageTitle("Jadwal Kontrol");
    loadData();
  }, [loadData]);

  // Open check-in drawer
  const openCheckInDrawer = (registrationId: number) => {
    setCheckInId(registrationId);
    setCheckInDrawerOpen(true);
  };

  // Handle check-in success (called from drawer)
  const handleCheckInSuccess = () => {
    setCheckInId(null);
    setCheckInDrawerOpen(false);
    loadData();
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!cancelId) return;
    setActionLoading(true);
    try {
      const response = await registrationApi.cancelScheduled(cancelId);
      toast({
        title: "Berhasil",
        description: response.data.message || "Jadwal kontrol dibatalkan",
      });
      setCancelId(null);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal membatalkan jadwal",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!rescheduleData) return;
    if (!rescheduleForm.new_date) {
      toast({
        title: "Error",
        description: "Tanggal baru harus diisi",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const payload: { new_date: string; new_room_id?: number; reason?: string } = {
        new_date: rescheduleForm.new_date,
      };
      if (rescheduleForm.new_room_id) {
        payload.new_room_id = parseInt(rescheduleForm.new_room_id);
      }
      if (rescheduleForm.reason) {
        payload.reason = rescheduleForm.reason;
      }

      const response = await registrationApi.reschedule(rescheduleData.id, payload);
      toast({
        title: "Berhasil",
        description: response.data.message || "Jadwal kontrol berhasil diubah",
      });
      setRescheduleData(null);
      setRescheduleForm({ new_date: "", new_room_id: "", reason: "" });
      loadData();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengubah jadwal",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (reg: ScheduledRegistration) => {
    if (reg.checked_in_at) {
      return <Badge className="bg-green-500">Sudah Check-in</Badge>;
    }
    if (reg.status === "no_show") {
      return <Badge variant="destructive">Tidak Datang</Badge>;
    }
    if (reg.status === "cancelled") {
      return <Badge variant="secondary">Dibatalkan</Badge>;
    }

    const scheduledDate = reg.scheduled_date ? parseISO(reg.scheduled_date) : null;
    if (scheduledDate) {
      if (isToday(scheduledDate)) {
        return <Badge className="bg-blue-500">Hari Ini</Badge>;
      }
      if (isBefore(scheduledDate, startOfDay(new Date()))) {
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Lewat Jadwal</Badge>;
      }
    }
    return <Badge variant="outline">Terjadwal</Badge>;
  };

  // Format date display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd MMM yyyy", { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  // Table columns
  const columns: ColumnDef<ScheduledRegistration>[] = [
    {
      accessorKey: "scheduled_date",
      header: "Tanggal",
      cell: ({ row }) => (
        <div className="font-medium">
          {formatDate(row.original.scheduled_date)}
        </div>
      ),
    },
    {
      id: "queue_number",
      header: "No. Antrian",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.visit?.room_queue?.queue_number || "-"}
        </Badge>
      ),
    },
    {
      id: "patient",
      header: "Pasien",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {formatPatientName(row.original.patient?.nama_lengkap, row.original.patient?.jenis_kelamin, undefined, row.original.patient?.tanggal_lahir) || "-"}
          </div>
          <div className="text-sm text-muted-foreground">
            {row.original.patient?.no_rm || "-"}
          </div>
        </div>
      ),
      filterFn: (row, _, filterValue) => {
        const patientName = row.original.patient?.nama_lengkap?.toLowerCase() || "";
        const patientRM = row.original.patient?.no_rm?.toLowerCase() || "";
        const regNumber = row.original.registration_number?.toLowerCase() || "";
        const query = filterValue.toLowerCase();
        return patientName.includes(query) || patientRM.includes(query) || regNumber.includes(query);
      },
    },
    {
      id: "room",
      header: "Ruangan",
      cell: ({ row }) => row.original.destination_room?.name || "-",
    },
    {
      id: "source_visit",
      header: "Dari Kunjungan",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.source_visit?.visit_number || "-"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const reg = row.original;
        const regId = reg.ID || reg.id || 0;
        const canCheckIn = reg.status === "scheduled" && !reg.checked_in_at;
        const canReschedule = reg.status === "scheduled" || reg.status === "no_show";
        const canCancelReg = reg.status === "scheduled";

        return (
          <div className="flex items-center justify-end gap-2">
            {canCheckIn && hasPermission("registrations.update") && (
              <Button
                size="sm"
                onClick={() => openCheckInDrawer(regId)}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Check-in
              </Button>
            )}
            {canReschedule && hasPermission("registrations.update") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRescheduleData({
                    id: regId,
                    currentDate: reg.scheduled_date || "",
                    currentRoom: reg.destination_room_id,
                    patientName: reg.patient?.nama_lengkap || "",
                  });
                  setRescheduleForm({
                    new_date: "",
                    new_room_id: reg.destination_room_id.toString(),
                    reason: "",
                  });
                }}
              >
                <CalendarClock className="h-4 w-4 mr-1" />
                Reschedule
              </Button>
            )}
            {canCancelReg && hasPermission("registrations.delete") && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setCancelId(regId)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {reg.checked_in_at && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {format(parseISO(reg.checked_in_at), "HH:mm")}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Jadwal Kontrol Pasien"
        description="Daftar jadwal kontrol dan kunjungan ulang pasien"
        count={registrations.length}
        actions={
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate("")}
              className="h-8 text-xs"
            >
              Semua Data
            </Button>
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Semua Ruangan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Ruangan</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id.toString()}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="scheduled">Terjadwal</SelectItem>
                <SelectItem value="no_show">Tidak Datang</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={loadData}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      <PageContent>
        <DataTable
          columns={columns}
          data={registrations}
          searchPlaceholder="Cari nama pasien, No. RM..."
          pageSize={10}
          tableId="scheduled-registrations"
        />
      </PageContent>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={() => setCancelId(null)}
        title="Batalkan Jadwal Kontrol"
        description="Apakah Anda yakin ingin membatalkan jadwal kontrol ini? Tindakan ini tidak dapat dibatalkan."
        confirmText={actionLoading ? "Memproses..." : "Ya, Batalkan"}
        onConfirm={handleCancel}
        variant="destructive"
      />

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleData !== null} onOpenChange={() => setRescheduleData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Jadwal Kontrol</DialogTitle>
            <DialogDescription>
              Ubah jadwal kontrol untuk pasien {rescheduleData?.patientName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Jadwal saat ini: <strong>{formatDate(rescheduleData?.currentDate)}</strong>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="new_date">Tanggal Baru <span className="text-red-500">*</span></Label>
              <Input
                id="new_date"
                type="date"
                value={rescheduleForm.new_date}
                onChange={(e) => setRescheduleForm(prev => ({ ...prev, new_date: e.target.value }))}
                min={getTodayString()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_room">Ruangan Tujuan</Label>
              <Select
                value={rescheduleForm.new_room_id}
                onValueChange={(value) => setRescheduleForm(prev => ({ ...prev, new_room_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ruangan (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Reschedule</Label>
              <Textarea
                id="reason"
                placeholder="Alasan perubahan jadwal (opsional)..."
                value={rescheduleForm.reason}
                onChange={(e) => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleData(null)}>
              Batal
            </Button>
            <Button onClick={handleReschedule} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-in Kontrol Drawer */}
      <CheckInKontrolDrawer
        open={checkInDrawerOpen}
        onOpenChange={setCheckInDrawerOpen}
        registrationId={checkInId}
        onSuccess={handleCheckInSuccess}
      />
    </PageShell>
  );
}