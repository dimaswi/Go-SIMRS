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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomsApi, type Schedule } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  schedule: Schedule | null;
  onSuccess: () => void;
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  roomId,
  schedule,
  onSuccess,
}: ScheduleFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: "08:00",
    end_time: "16:00",
    max_patients: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    if (schedule) {
      setFormData({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        max_patients: schedule.max_patients,
        is_active: schedule.is_active,
        notes: schedule.notes || "",
      });
    } else {
      setFormData({
        day_of_week: 1,
        start_time: "08:00",
        end_time: "16:00",
        max_patients: 0,
        is_active: true,
        notes: "",
      });
    }
  }, [schedule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (schedule) {
        await roomsApi.updateSchedule(roomId, schedule.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Jadwal berhasil diperbarui.",
        });
      } else {
        await roomsApi.createSchedule(roomId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Jadwal berhasil ditambahkan.",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan jadwal.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit Jadwal" : "Tambah Jadwal"}</DialogTitle>
          <DialogDescription>
            {schedule ? "Perbarui jadwal operasional ruangan" : "Tambahkan jadwal operasional baru"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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

            <div className="space-y-2">
              <Label htmlFor="max_patients">Maks. Pasien (0 = tidak terbatas)</Label>
              <Input
                id="max_patients"
                type="number"
                min={0}
                value={formData.max_patients}
                onChange={(e) => setFormData({ ...formData, max_patients: parseInt(e.target.value) || 0 })}
              />
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
