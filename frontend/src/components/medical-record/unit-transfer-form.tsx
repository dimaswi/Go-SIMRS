import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Loader2,
  Building,
  CheckCircle2,
  Calendar,
  History,
  Save,
  User,
  RotateCcw,
} from "lucide-react";
import { roomsApi, type Room, type DoctorSchedule, type RoomStaff } from "@/lib/api/rooms";
import { unitTransferApi, type UnitTransfer, type CreateUnitTransferInput } from "@/lib/api/inpatient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UnitTransferFormProps {
  visitId: number;
  currentRoomId?: number;
  // currentDoctorId?: number;
  serviceType: string; // "rawat_jalan" | "gawat_darurat"
  readOnly?: boolean;
  onTransferComplete?: () => void;
}

function formatDoctorName(doctor: { nama_lengkap: string; gelar_depan?: string; gelar_belakang?: string } | undefined): string {
  if (!doctor) return "-";
  const parts: string[] = [];
  if (doctor.gelar_depan) parts.push(doctor.gelar_depan);
  parts.push(doctor.nama_lengkap);
  if (doctor.gelar_belakang) parts.push(doctor.gelar_belakang);
  return parts.join(" ");
}

export function UnitTransferForm({
  visitId,
  currentRoomId,
  serviceType,
  readOnly = false,
  onTransferComplete,
}: UnitTransferFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // Transfer history
  const [transfers, setTransfers] = useState<UnitTransfer[]>([]);

  // Room selection
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Doctor selection
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [roomStaffDoctors, setRoomStaffDoctors] = useState<RoomStaff[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // Form data
  const [transferReason, setTransferReason] = useState("");
  const [notes, setNotes] = useState("");

  // Load data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load transfer history
        const transfersResponse = await unitTransferApi.getAll(visitId);
        setTransfers(transfersResponse.data.data || []);

        // Load rooms filtered by rawat_jalan and gawat_darurat (allow cross-service transfer)
        const roomsResponse = await roomsApi.getAll({ limit: 1000, is_active: "true" });
        const allRooms = roomsResponse.data.data || [];
        // Show both rawat_jalan and gawat_darurat rooms
        setRooms(allRooms.filter(r => (r.service_type === "rawat_jalan" || r.service_type === "gawat_darurat") && r.is_active));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [visitId, serviceType]);

  // Load doctors when room is selected
  useEffect(() => {
    if (selectedRoomId) {
      loadDoctors(selectedRoomId);
    } else {
      setDoctorSchedules([]);
      setRoomStaffDoctors([]);
      setSelectedDoctorId(null);
    }
  }, [selectedRoomId]);

  const loadDoctors = async (roomId: number) => {
    setLoadingDoctors(true);
    try {
      // Try doctor schedules first
      const response = await roomsApi.getDoctorSchedules(roomId);
      const schedules = response.data.data || [];
      const today = new Date().getDay();
      const uniqueDoctors = new Map<number, DoctorSchedule>();
      for (const s of schedules) {
        if (s.is_active && !uniqueDoctors.has(s.employee_id)) {
          uniqueDoctors.set(s.employee_id, s);
        }
      }
      const sorted = Array.from(uniqueDoctors.values()).sort((a, b) => {
        const aToday = a.day_of_week === today ? 0 : 1;
        const bToday = b.day_of_week === today ? 0 : 1;
        return aToday - bToday;
      });
      setDoctorSchedules(sorted);

      // If no schedules found, fallback to room staff (for UGD etc.)
      if (sorted.length === 0) {
        const staffResponse = await roomsApi.getStaff(roomId);
        const doctors = (staffResponse.data.data || []).filter(
          (staff: RoomStaff) =>
            staff.employee?.tipe_karyawan === "dokter" &&
            (!staff.end_date || new Date(staff.end_date) >= new Date())
        );
        setRoomStaffDoctors(doctors);
      } else {
        setRoomStaffDoctors([]);
      }
    } catch (error) {
      console.error("Failed to load doctors:", error);
      setDoctorSchedules([]);
      setRoomStaffDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleReset = () => {
    setSelectedRoomId(null);
    setSelectedDoctorId(null);
    setTransferReason("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!selectedRoomId) {
      toast({
        title: "Error",
        description: "Pilih ruangan tujuan",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const data: CreateUnitTransferInput = {
        to_room_id: selectedRoomId,
        to_doctor_id: selectedDoctorId || undefined,
        transfer_reason: transferReason,
        notes: notes,
      };

      const response = await unitTransferApi.create(visitId, data);

      toast({
        title: "Berhasil",
        description: response.data.message || "Mutasi unit berhasil",
      });

      // Reset form
      handleReset();

      // Reload transfers
      const transfersResponse = await unitTransferApi.getAll(visitId);
      setTransfers(transfersResponse.data.data || []);

      // Trigger refresh
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));

      onTransferComplete?.();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal melakukan mutasi unit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const serviceLabel = "Rawat Jalan / UGD";

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedDoctorName =
    selectedDoctorId
      ? doctorSchedules.find((d) => d.employee_id === selectedDoctorId)?.employee?.nama_lengkap ||
        roomStaffDoctors.find((d) => d.employee_id === selectedDoctorId)?.employee?.nama_lengkap
      : undefined;

  if (loading) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[240px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      {/* Inline Sub-Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-4 sm:px-5">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "form"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Form Mutasi
            {activeTab === "form" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "history"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Riwayat Mutasi
            {transfers.length > 0 && (
              <Badge variant="secondary" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                {transfers.length}
              </Badge>
            )}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
        </div>
      </div>

      {/* Form Tab */}
      {activeTab === "form" && !readOnly && (
        <fieldset disabled={saving} className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
          {/* Room Selection */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Pilih Ruangan Tujuan
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {rooms.length} unit tersedia
              </span>
            </div>

            {rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const isCurrent = room.id === currentRoomId;

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent) {
                          setSelectedRoomId(room.id);
                          setSelectedDoctorId(null);
                        }
                      }}
                      disabled={isCurrent}
                      className={cn(
                        "p-3.5 rounded-none border text-left transition-all relative",
                        isSelected
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/[0.04] dark:bg-white/[0.06] ring-1 ring-neutral-900 dark:ring-neutral-100"
                          : isCurrent
                          ? "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 cursor-not-allowed opacity-85"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                      )}
                      {isCurrent && !isSelected && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5">
                          Sekarang
                        </span>
                      )}
                      <div className="font-semibold text-xs text-foreground pr-12 truncate">
                        {room.name}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">{room.code}</span>
                        {room.service_type !== serviceType && (
                          <Badge variant="outline" className="rounded-none text-[10px] h-4 px-1">
                            {room.service_type === "gawat_darurat" ? "UGD" : "Poli"}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                Tidak ada ruangan {serviceLabel} yang tersedia
              </div>
            )}
          </div>

          {/* Detail Mutasi & Dokter */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Detail Mutasi & Dokter Tujuan
            </div>

            {selectedRoomId && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Pilih Dokter Tujuan (Opsional)
                </Label>
                {loadingDoctors ? (
                  <div className="flex items-center gap-2 h-9 px-3 border border-neutral-200 dark:border-neutral-800 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memuat daftar dokter...
                  </div>
                ) : doctorSchedules.length > 0 ? (
                  <Select
                    value={selectedDoctorId?.toString() || "none"}
                    onValueChange={(val) => setSelectedDoctorId(val === "none" ? null : Number(val))}
                  >
                    <SelectTrigger className="w-full h-9 text-xs rounded-none">
                      <SelectValue placeholder="Pilih dokter (opsional)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Tidak memilih dokter</SelectItem>
                      {doctorSchedules.map((ds) => (
                        <SelectItem key={ds.employee_id} value={ds.employee_id.toString()}>
                          {ds.employee
                            ? `${ds.employee.nama_lengkap}${ds.employee.spesialisasi ? ` - ${ds.employee.spesialisasi}` : ""}`
                            : `Dokter ID ${ds.employee_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : roomStaffDoctors.length > 0 ? (
                  <Select
                    value={selectedDoctorId?.toString() || "none"}
                    onValueChange={(val) => setSelectedDoctorId(val === "none" ? null : Number(val))}
                  >
                    <SelectTrigger className="w-full h-9 text-xs rounded-none">
                      <SelectValue placeholder="Pilih dokter (opsional)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Tidak memilih dokter</SelectItem>
                      {roomStaffDoctors.map((staff) => (
                        <SelectItem key={staff.employee_id} value={staff.employee_id.toString()}>
                          {staff.employee
                            ? `${staff.employee.nama_lengkap}${staff.employee.spesialisasi ? ` - ${staff.employee.spesialisasi}` : ""}`
                            : `Dokter ID ${staff.employee_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 px-3 border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center text-xs text-muted-foreground">
                    Tidak ada jadwal dokter di ruangan ini
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="transfer_reason" className="text-xs font-medium">
                  Alasan Mutasi
                </Label>
                <Textarea
                  id="transfer_reason"
                  placeholder="Alasan memindahkan pasien ke ruangan lain..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="min-h-[80px] text-xs rounded-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer_notes" className="text-xs font-medium">
                  Catatan Tambahan (Opsional)
                </Label>
                <Textarea
                  id="transfer_notes"
                  placeholder="Catatan tambahan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[80px] text-xs rounded-none resize-none"
                />
              </div>
            </div>

            {selectedRoom && (
              <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/70 dark:bg-neutral-900/40 px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
                <Building className="h-4 w-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">Konfirmasi Mutasi:</span>{" "}
                  <span className="text-muted-foreground">
                    Pasien akan dipindahkan ke{" "}
                    <strong className="text-foreground">{selectedRoom.name}</strong>
                    {selectedDoctorName && (
                      <>
                        {" "}— Dokter <strong className="text-foreground">{selectedDoctorName}</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-4 sm:px-5 py-3 bg-neutral-50/40 dark:bg-neutral-900/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="h-8 rounded-none text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !selectedRoomId}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Simpan Mutasi
            </Button>
          </div>
        </fieldset>
      )}

      {/* Form Tab - readOnly */}
      {activeTab === "form" && readOnly && (
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ArrowRightLeft className="h-4 w-4 opacity-50" />
            <span>Mode hanya baca — tidak dapat melakukan mutasi unit pada kunjungan ini.</span>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="p-4 sm:p-5 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Riwayat Mutasi Unit
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {transfers.length} entri
            </span>
          </div>

          {transfers.length > 0 ? (
            <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {transfers.map((transfer, index) => (
                <div
                  key={transfer.id}
                  className={cn(
                    "p-3.5 space-y-2.5",
                    index === 0 ? "bg-neutral-50/70 dark:bg-neutral-900/30" : "bg-background"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="border border-neutral-200 dark:border-neutral-800 bg-background px-2.5 py-1.5 min-w-[140px]">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dari Unit</div>
                        <div className="text-xs font-semibold">{transfer.from_room?.name || "-"}</div>
                        {transfer.from_doctor && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDoctorName(transfer.from_doctor)}
                          </div>
                        )}
                      </div>

                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                      <div className="border border-neutral-900/20 dark:border-neutral-100/20 bg-neutral-50 dark:bg-neutral-900/60 px-2.5 py-1.5 min-w-[140px]">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ke Unit</div>
                        <div className="text-xs font-semibold">{transfer.to_room?.name || "-"}</div>
                        {transfer.to_doctor && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDoctorName(transfer.to_doctor)}
                          </div>
                        )}
                      </div>

                      {index === 0 && (
                        <Badge className="rounded-none text-[10px] h-5 px-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                          Terbaru
                        </Badge>
                      )}
                    </div>

                    <div className="text-left sm:text-right text-[11px] text-muted-foreground shrink-0">
                      <div className="flex items-center sm:justify-end gap-1 font-mono">
                        <Calendar className="h-3 w-3" />
                        {new Date(transfer.transfer_date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {transfer.created_by && (
                        <p className="mt-0.5">
                          oleh {transfer.created_by.full_name || transfer.created_by.username}
                        </p>
                      )}
                    </div>
                  </div>

                  {(transfer.transfer_reason || transfer.notes) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-muted-foreground">
                      {transfer.transfer_reason && (
                        <p>
                          <span className="font-semibold text-foreground">Alasan:</span> {transfer.transfer_reason}
                        </p>
                      )}
                      {transfer.notes && (
                        <p>
                          <span className="font-semibold text-foreground">Catatan:</span> {transfer.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <History className="h-4 w-4 opacity-50" />
              <span>Belum ada riwayat mutasi unit — pasien belum pernah dipindahkan ke ruangan lain.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
