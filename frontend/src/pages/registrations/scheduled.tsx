import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { type ColumnDef } from "@/components/ui/data-table-utils";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { registrationApi, type ScheduledRegistration } from "@/lib/api/queue";
import { roomsApi, type Room, schedulesApi } from "@/lib/api/rooms";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CheckInKontrolDrawer } from "@/components/registration/checkin-kontrol-drawer";
import { SuratKontrolFormSheet } from "@/components/sep/surat-kontrol-form-sheet";
import { setPageTitle } from "@/lib/page-title";
import { api } from "@/lib/api";
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
    currentDoctor?: number;
    patientName: string;
  } | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_room_id: "",
    new_doctor_id: "",
    reason: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState<Array<{ employee_id: number; employee_name: string }>>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Load available doctors when new_date or new_room_id changes
  useEffect(() => {
    const fetchDoctors = async () => {
      if (!rescheduleForm.new_date || !rescheduleForm.new_room_id) {
        setAvailableDoctors([]);
        return;
      }
      setLoadingDoctors(true);
      try {
        const res = await schedulesApi.getAvailableDoctorsByDate(
          parseInt(rescheduleForm.new_room_id),
          rescheduleForm.new_date
        );
        setAvailableDoctors(res.data.data || []);
      } catch (e) {
        console.error("Gagal mengambil daftar dokter:", e);
        setAvailableDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, [rescheduleForm.new_date, rescheduleForm.new_room_id]);

  // BPJS Reschedule state
  const [suratKontrolDrawerOpen, setSuratKontrolDrawerOpen] = useState(false);
  const [editSuratKontrolNo, setEditSuratKontrolNo] = useState<string>("");
  const [suratKontrolPatient, setSuratKontrolPatient] = useState<any>(null);
  const [editingBpjsReg, setEditingBpjsReg] = useState<ScheduledRegistration | null>(null);

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
    } catch {
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
      const payload: { new_date: string; new_room_id?: number; new_doctor_id?: number; reason?: string } = {
        new_date: rescheduleForm.new_date,
      };
      if (rescheduleForm.new_room_id) {
        payload.new_room_id = parseInt(rescheduleForm.new_room_id);
      }
      if (rescheduleForm.new_doctor_id) {
        payload.new_doctor_id = parseInt(rescheduleForm.new_doctor_id);
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
      setRescheduleForm({ new_date: "", new_room_id: "", new_doctor_id: "", reason: "" });
      loadData();
    } catch {
      toast({
        title: "Gagal",
        description: "Gagal mengubah jadwal",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reschedule Click
  const handleRescheduleClick = async (reg: ScheduledRegistration) => {
    console.log("handleRescheduleClick called for:", reg);
    const regId = reg.ID || reg.id || 0;

    if (reg.payment_method === "bpjs") {
      setActionLoading(true);
      try {
        console.log("Fetching kontrol info for regId:", regId);
        const res = await api.get<any>(`/registrations/${regId}/kontrol-info`);
        console.log("kontrol-info response:", res.data);

        const sk = res.data.data?.suratKontrol || res.data.data?.surat_kontrol;
        console.log("Extracted sk:", sk);

        if (sk && sk.no_surat_kontrol) {
          console.log("Opening BPJS drawer with SK:", sk.no_surat_kontrol);
          setEditSuratKontrolNo(sk.no_surat_kontrol);
          setSuratKontrolPatient(reg.patient);
          setEditingBpjsReg(reg);
          setSuratKontrolDrawerOpen(true);
          setActionLoading(false);
          return;
        } else {
          console.log("SK not found or invalid:", sk);
        }
      } catch (e) {
        console.error("Gagal mendapatkan kontrol info:", e);
      }
      setActionLoading(false);
    }

    console.log("Falling back to normal reschedule for regId:", regId);
    // Normal reschedule
    setRescheduleData({
      id: regId,
      currentDate: reg.scheduled_date || "",
      currentRoom: reg.destination_room_id,
      currentDoctor: reg.doctor_id,
      patientName: reg.patient?.nama_lengkap || "",
    });
    setRescheduleForm({
      new_date: "",
      new_room_id: reg.destination_room_id.toString(),
      new_doctor_id: reg.doctor_id ? reg.doctor_id.toString() : "",
      reason: "",
    });
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
      header: "Tanggal Kontrol",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {formatDate(row.original.scheduled_date)}
          </div>
          {row.original.surat_kontrol?.no_surat_kontrol && (
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {row.original.surat_kontrol.no_surat_kontrol}
            </div>
          )}
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
      cell: ({ row }) => {
        const paymentMethod = row.original.payment_method;
        const methodLabel = paymentMethod === "bpjs" ? "BPJS" : paymentMethod === "insurance" ? "ASURANSI" : "UMUM";
        const badgeColor = paymentMethod === "bpjs"
          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : paymentMethod === "insurance"
            ? "bg-blue-100 text-blue-800 border-blue-200"
            : "bg-slate-100 text-slate-800 border-slate-200";

        return (
          <div>
            <div className="font-medium flex items-center gap-2">
              {formatPatientName(row.original.patient?.nama_lengkap, row.original.patient?.jenis_kelamin, undefined, row.original.patient?.tanggal_lahir) || "-"}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>{row.original.patient?.no_rm || "-"}</span>
              <Badge variant="outline" className={`text-[9px] h-5 px-1.5 uppercase tracking-wider ${badgeColor}`}>
                {methodLabel}
              </Badge>
            </div>
          </div>
        );
      },
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
        const isDateToday = reg.scheduled_date ? isToday(parseISO(reg.scheduled_date)) : false;
        
        // Show Check-In button if status is scheduled and not yet checked in
        const showCheckIn = reg.status === "scheduled" && !reg.checked_in_at;
        
        const canReschedule = reg.status === "scheduled" || reg.status === "no_show";
        const canCancelReg = reg.status === "scheduled";

        return (
          <div className="flex items-center justify-end gap-2">
            <TooltipProvider delayDuration={300}>
              {showCheckIn && hasPermission("registrations.update") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Span wrapper needed for Tooltip on disabled button */}
                    <span tabIndex={0}>
                      <Button
                        size="sm"
                        disabled={!isDateToday}
                        onClick={() => openCheckInDrawer(regId)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{!isDateToday ? "Hanya dapat Check-in pada hari H sesuai jadwal" : "Check-in"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {canReschedule && hasPermission("registrations.update") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => handleRescheduleClick(reg)}
                    >
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reschedule / Edit</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {canCancelReg && hasPermission("registrations.delete") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setCancelId(regId)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Batalkan Jadwal</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
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

      <PageContent className="py-3">
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Pasien
          </div>
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={registrations}
                searchPlaceholder="Cari nama pasien, No. RM..."
                pageSize={10}
                tableId="scheduled-registrations"
              />
            )}
          </div>
        </div>
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
            {rescheduleForm.new_room_id && rescheduleForm.new_date && (
              <div className="space-y-2">
                <Label htmlFor="new_doctor">Dokter Tujuan <span className="text-red-500">*</span></Label>
                <Select
                  value={rescheduleForm.new_doctor_id}
                  onValueChange={(value) => setRescheduleForm(prev => ({ ...prev, new_doctor_id: value }))}
                  disabled={loadingDoctors}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDoctors ? "Memuat..." : "Pilih dokter"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDoctors.map((doc) => (
                      <SelectItem key={doc.employee_id} value={doc.employee_id.toString()}>
                        {doc.employee_name}
                      </SelectItem>
                    ))}
                    {availableDoctors.length === 0 && !loadingDoctors && (
                      <SelectItem value="none" disabled>
                        Tidak ada dokter tersedia
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
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

      {/* Check In Drawer */}
      <CheckInKontrolDrawer
        open={checkInDrawerOpen}
        onOpenChange={setCheckInDrawerOpen}
        registrationId={checkInId}
        onSuccess={handleCheckInSuccess}
      />

      {/* BPJS Reschedule Edit Drawer */}
      {suratKontrolPatient && (
        <SuratKontrolFormSheet
          open={suratKontrolDrawerOpen}
          onOpenChange={(open) => {
            setSuratKontrolDrawerOpen(open);
            if (!open) setEditingBpjsReg(null);
          }}
          patient={suratKontrolPatient as any}
          editNoSuratKontrol={editSuratKontrolNo}
          onSuratKontrolUpdated={async (data) => {
            // Ketika BPJS update sukses, sinkronisasikan tanggal ke SIMRS lokal
            if (editingBpjsReg) {
              try {
                const regId = editingBpjsReg.ID || editingBpjsReg.id || 0;
                await registrationApi.reschedule(regId, {
                  new_date: data.tglRencanaKontrol,
                });
                toast({ title: "Berhasil", description: "Jadwal kontrol dan Surat Kontrol berhasil diperbarui" });
                loadData();
              } catch (e) {
                console.error("Gagal sinkronisasi reschedule", e);
              }
            }
          }}
        />
      )}
    </PageShell>
  );
}