import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { roomsApi, employeesApi, type DoctorSchedule, type Employee } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

interface DoctorScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  schedule: DoctorSchedule | null;
  onSuccess: () => void;
}

export function DoctorScheduleFormDialog({
  open,
  onOpenChange,
  roomId,
  schedule,
  onSuccess,
}: DoctorScheduleFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [existingSchedules, setExistingSchedules] = useState<DoctorSchedule[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employee_id: 0,
    day_of_week: 1,
    start_time: "08:00",
    end_time: "12:00",
    max_patients: 0,
    consult_fee: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadEmployees();
      loadExistingSchedules();
    }
  }, [open]);

  // Check for duplicate doctor when employee or day changes
  useEffect(() => {
    checkDuplicateDoctor();
  }, [formData.employee_id, formData.day_of_week, existingSchedules]);

  const loadExistingSchedules = async () => {
    try {
      const res = await roomsApi.getDoctorSchedules(roomId);
      setExistingSchedules(res.data.data || []);
    } catch (error) {
      console.error("Failed to load existing schedules:", error);
    }
  };

  const checkDuplicateDoctor = () => {
    if (!formData.employee_id || !existingSchedules.length) {
      setDuplicateWarning(null);
      return;
    }

    // Find if this doctor already has a schedule on the same day in this room
    const duplicates = existingSchedules.filter(
      (s) =>
        s.employee_id === formData.employee_id &&
        s.day_of_week === formData.day_of_week &&
        s.is_active &&
        // Exclude the current schedule being edited
        (!schedule || s.id !== schedule.id)
    );

    if (duplicates.length > 0) {
      const dayName = days.find((d) => d.value === formData.day_of_week)?.label || "";
      const doctorName = employees.find((e) => e.id === formData.employee_id)?.nama_lengkap || "Dokter ini";
      const existingTimes = duplicates.map((d) => `${d.start_time} - ${d.end_time}`).join(", ");
      setDuplicateWarning(
        `${doctorName} sudah memiliki jadwal pada hari ${dayName} (${existingTimes}). Pastikan waktu tidak bentrok.`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  useEffect(() => {
    if (schedule) {
      setFormData({
        employee_id: schedule.employee_id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        max_patients: schedule.max_patients,
        consult_fee: schedule.consult_fee,
        is_active: schedule.is_active,
        notes: schedule.notes || "",
      });
    } else {
      setFormData({
        employee_id: 0,
        day_of_week: 1,
        start_time: "08:00",
        end_time: "12:00",
        max_patients: 0,
        consult_fee: 0,
        is_active: true,
        notes: "",
      });
    }
  }, [schedule, open]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      // Get employees who are doctors (tipe_karyawan = 'dokter')
      const res = await employeesApi.getAll({ limit: 1000, tipe_karyawan: 'dokter' });
      setEmployees(res.data.data || []);
    } catch (error) {
      console.error("Failed to load employees:", error);
      // Fallback to all employees if filter fails
      try {
        const res = await employeesApi.getAll({ limit: 1000 });
        setEmployees(res.data.data || []);
      } catch (e) {
        console.error("Failed to load all employees:", e);
      }
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih dokter terlebih dahulu.",
      });
      return;
    }

    setLoading(true);

    try {
      if (schedule) {
        await roomsApi.updateDoctorSchedule(roomId, schedule.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Jadwal dokter berhasil diperbarui.",
        });
      } else {
        await roomsApi.createDoctorSchedule(roomId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Jadwal dokter berhasil ditambahkan.",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan jadwal dokter.",
      });
    } finally {
      setLoading(false);
    }
  };

  const days = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 0, label: "Minggu" },
  ];

  const employeeOptions = employees.map((emp) => ({
    value: emp.id.toString(),
    label: emp.nama_lengkap + (emp.nip ? ` (${emp.nip})` : ''),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit Jadwal Dokter" : "Tambah Jadwal Dokter"}</DialogTitle>
          <DialogDescription>
            {schedule ? "Perbarui jadwal praktik dokter" : "Tambahkan jadwal praktik dokter baru"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Dokter</Label>
              {loadingEmployees ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat data dokter...
                </div>
              ) : (
                <Combobox
                  options={employeeOptions}
                  value={formData.employee_id ? formData.employee_id.toString() : ""}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: parseInt(value) || 0 })}
                  placeholder="Pilih dokter"
                  searchPlaceholder="Cari dokter..."
                  disabled={!!schedule}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Hari</Label>
              <Select
                value={formData.day_of_week.toString()}
                onValueChange={(value) => setFormData({ ...formData, day_of_week: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih hari" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning for duplicate doctor on same day */}
            {duplicateWarning && (
              <Alert variant="destructive" className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700">
                  {duplicateWarning}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Jam Mulai</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Jam Selesai</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_patients">Maks. Pasien</Label>
                <Input
                  id="max_patients"
                  type="number"
                  min={0}
                  value={formData.max_patients}
                  onChange={(e) => setFormData({ ...formData, max_patients: parseInt(e.target.value) || 0 })}
                  placeholder="0 = tidak terbatas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consult_fee">Tarif Konsultasi</Label>
                <Input
                  id="consult_fee"
                  type="number"
                  min={0}
                  value={formData.consult_fee}
                  onChange={(e) => setFormData({ ...formData, consult_fee: parseFloat(e.target.value) || 0 })}
                  placeholder="Rp"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || loadingEmployees || !!duplicateWarning}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
