import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Mutasi Unit
        </CardTitle>
        <CardDescription>
          Pindahkan pasien ke ruangan Rawat Jalan atau UGD lain
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Inline Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "form"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Form Mutasi
              </span>
              {activeTab === "form" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "history"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Riwayat Mutasi
                {transfers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {transfers.length}
                  </Badge>
                )}
              </span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Form Tab */}
          {activeTab === "form" && !readOnly && (
            <fieldset disabled={saving}>
              {/* Room Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Pilih Ruangan Tujuan
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rooms.map(room => {
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
                          "p-4 rounded-lg border-2 text-left transition-all relative",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : isCurrent
                            ? "border-yellow-400 bg-yellow-50 cursor-not-allowed"
                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        {isSelected && (
                          <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-primary" />
                        )}
                        {isCurrent && !isSelected && (
                          <span className="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-medium">
                            Sekarang
                          </span>
                        )}
                        <div className="font-semibold text-sm mb-1">{room.name}</div>
                        <div className="text-xs text-muted-foreground">{room.code}</div>
                        {room.service_type !== serviceType && (
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                            {room.service_type === "gawat_darurat" ? "UGD" : "Poli"}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                {rooms.length === 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>Tidak ada ruangan {serviceLabel} yang tersedia</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Doctor Selection */}
              {selectedRoomId && (
                <div className="space-y-3 mt-6">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Pilih Dokter Tujuan (Opsional)
                  </Label>
                  {loadingDoctors ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Memuat daftar dokter...</span>
                    </div>
                  ) : doctorSchedules.length > 0 ? (
                    <Select
                      value={selectedDoctorId?.toString() || "none"}
                      onValueChange={(val) => setSelectedDoctorId(val === "none" ? null : Number(val))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih dokter (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak memilih dokter</SelectItem>
                        {doctorSchedules.map(ds => (
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
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih dokter (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak memilih dokter</SelectItem>
                        {roomStaffDoctors.map(staff => (
                          <SelectItem key={staff.employee_id} value={staff.employee_id.toString()}>
                            {staff.employee
                              ? `${staff.employee.nama_lengkap}${staff.employee.spesialisasi ? ` - ${staff.employee.spesialisasi}` : ""}`
                              : `Dokter ID ${staff.employee_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Tidak ada jadwal dokter di ruangan ini
                    </p>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2 mt-6">
                <Label htmlFor="transfer_reason" className="text-sm font-semibold">
                  Alasan Mutasi
                </Label>
                <Textarea
                  id="transfer_reason"
                  placeholder="Alasan memindahkan pasien ke ruangan lain..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 mt-4">
                <Label htmlFor="transfer_notes" className="text-sm">
                  Catatan Tambahan (Opsional)
                </Label>
                <Textarea
                  id="transfer_notes"
                  placeholder="Catatan tambahan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
              </div>

              {/* Summary */}
              {selectedRoomId && (
                <Alert className="bg-blue-50 border-blue-200 mt-6">
                  <Building className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700">Konfirmasi Mutasi Unit</AlertTitle>
                  <AlertDescription className="text-blue-600">
                    Pasien akan dipindahkan ke{" "}
                    <strong>{rooms.find(r => r.id === selectedRoomId)?.name}</strong>
                    {selectedDoctorId && doctorSchedules.find(d => d.employee_id === selectedDoctorId)?.employee && (
                      <> - Dokter <strong>{doctorSchedules.find(d => d.employee_id === selectedDoctorId)!.employee!.nama_lengkap}</strong></>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || !selectedRoomId}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Mutasi
                </Button>
              </div>
            </fieldset>
          )}

          {/* Form Tab - readOnly */}
          {activeTab === "form" && readOnly && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Mode Hanya Baca</p>
              <p className="text-sm text-muted-foreground">
                Tidak dapat melakukan mutasi pada kunjungan ini
              </p>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {transfers.length > 0 ? (
                transfers.map((transfer, index) => (
                  <div
                    key={transfer.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      index === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* From */}
                        <div className="flex flex-col p-2 rounded bg-background border text-sm min-w-[120px]">
                          <span className="font-medium">{transfer.from_room?.name || "-"}</span>
                          {transfer.from_doctor && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {formatDoctorName(transfer.from_doctor)}
                            </span>
                          )}
                        </div>

                        {/* Arrow */}
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />

                        {/* To */}
                        <div className="flex flex-col p-2 rounded bg-primary/10 border-primary/20 border text-sm min-w-[120px]">
                          <span className="font-medium">{transfer.to_room?.name || "-"}</span>
                          {transfer.to_doctor && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {formatDoctorName(transfer.to_doctor)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="text-right text-sm shrink-0">
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
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
                          <p className="text-xs text-muted-foreground mt-1">
                            oleh {transfer.created_by.full_name || transfer.created_by.username}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    {transfer.transfer_reason && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Alasan:</span> {transfer.transfer_reason}
                      </p>
                    )}
                    {transfer.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">Catatan:</span> {transfer.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Belum ada riwayat mutasi unit</p>
                  <p className="text-sm text-muted-foreground">
                    Pasien belum pernah dipindahkan ke ruangan lain
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
