import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { visitsApi, roomsApi } from "@/lib/api";
import type { RoomStaff } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface EditDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  roomId: number;
  currentDoctorId?: number | null;
  onSuccess?: () => void;
}

export function EditDoctorDialog({
  open,
  onOpenChange,
  visitId,
  roomId,
  currentDoctorId,
  onSuccess,
}: EditDoctorDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomStaff, setRoomStaff] = useState<RoomStaff[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedDoctorId(currentDoctorId || null);
      loadRoomStaff();
    }
  }, [open, currentDoctorId, roomId]);

  const loadRoomStaff = async () => {
    setLoading(true);
    try {
      const response = await roomsApi.getStaff(roomId);
      const allStaff = response.data?.data || response.data || [];
      const doctors = allStaff.filter(
        (staff: RoomStaff) => staff.employee?.tipe_karyawan === "dokter"
      );
      setRoomStaff(doctors);
    } catch (error: any) {
      console.error("Failed to load room staff:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data dokter",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDoctorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih dokter terlebih dahulu",
      });
      return;
    }

    setSaving(true);
    try {
      await visitsApi.update(visitId, {
        doctor_id: selectedDoctorId,
      });

      toast({
        title: "Berhasil",
        description: "Dokter berhasil diubah",
      });

      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal mengubah dokter",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Ganti Dokter</DialogTitle>
          <DialogDescription>
            Pilih dokter baru untuk kunjungan ini
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doctor">Dokter *</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : roomStaff.length > 0 ? (
              <Combobox
                options={roomStaff.map((staff) => ({
                  value: staff.employee_id.toString(),
                  label: staff.employee?.nama_lengkap || "Unknown",
                }))}
                value={selectedDoctorId?.toString() || ""}
                onValueChange={(value) =>
                  setSelectedDoctorId(value ? Number(value) : null)
                }
                placeholder="Pilih dokter"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada dokter yang terdaftar di ruangan ini
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedDoctorId || loading}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
