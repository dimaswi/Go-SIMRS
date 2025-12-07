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
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { roomsApi, type Bed, type MasterData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface BedFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  unitId: number;
  bed: Bed | null;
  masterData: Record<string, MasterData[]>;
  onSuccess: () => void;
}

export function BedFormDialog({
  open,
  onOpenChange,
  roomId,
  unitId,
  bed,
  masterData,
  onSuccess,
}: BedFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bed_number: "",
    bed_type: "",
    status: "available",
    notes: "",
  });

  const isEdit = !!bed;

  useEffect(() => {
    if (bed) {
      setFormData({
        bed_number: bed.bed_number,
        bed_type: bed.bed_type || "",
        status: bed.status,
        notes: bed.notes || "",
      });
    } else {
      setFormData({
        bed_number: "",
        bed_type: "",
        status: "available",
        notes: "",
      });
    }
  }, [bed, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit && bed) {
        await roomsApi.updateBed(roomId, unitId, bed.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Tempat tidur berhasil diperbarui.",
        });
      } else {
        await roomsApi.createBed(roomId, unitId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Tempat tidur berhasil ditambahkan.",
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan tempat tidur.",
      });
    } finally {
      setLoading(false);
    }
  };

  const bedTypeOptions: ComboboxOption[] = (masterData.bed_type || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const bedStatusOptions: ComboboxOption[] = (masterData.bed_status || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tempat Tidur" : "Tambah Tempat Tidur"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui data tempat tidur" : "Masukkan data tempat tidur baru"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bed_number">No. Tempat Tidur *</Label>
              <Input
                id="bed_number"
                value={formData.bed_number}
                onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                placeholder="Contoh: A, B, 1, 2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe Tempat Tidur</Label>
              <Combobox
                options={bedTypeOptions}
                value={formData.bed_type}
                onValueChange={(value) => setFormData({ ...formData, bed_type: value })}
                placeholder="Pilih tipe"
                searchPlaceholder="Cari tipe..."
              />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Combobox
                options={bedStatusOptions}
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                placeholder="Pilih status"
                searchPlaceholder="Cari status..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Keterangan tambahan"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
