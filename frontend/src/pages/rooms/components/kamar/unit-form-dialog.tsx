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
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { roomsApi, type RoomUnit } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  totalFloors: number;
  unit: RoomUnit | null;
  onSuccess: () => void;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  roomId,
  totalFloors,
  unit,
  onSuccess,
}: UnitFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    floor: 1,
    capacity: 1,
    is_active: true,
    notes: "",
  });

  const isEdit = !!unit;

  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name,
        floor: unit.floor || 1,
        capacity: unit.capacity || 1,
        is_active: unit.is_active,
        notes: unit.notes || "",
      });
    } else {
      setFormData({
        name: "",
        floor: 1,
        capacity: 1,
        is_active: true,
        notes: "",
      });
    }
  }, [unit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit && unit) {
        await roomsApi.updateUnit(roomId, unit.id, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Kamar berhasil diperbarui.",
        });
      } else {
        await roomsApi.createUnit(roomId, formData);
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Kamar berhasil ditambahkan.",
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan kamar.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate floor options based on totalFloors
  const floorOptions: ComboboxOption[] = Array.from({ length: totalFloors }, (_, i) => ({
    value: (i + 1).toString(),
    label: `Lantai ${i + 1}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Kamar" : "Tambah Kamar"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui data kamar" : "Masukkan data kamar baru"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Kamar</Label>
                <Input value={isEdit ? unit?.code || "-" : "Otomatis dibuat sistem saat simpan"} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Kamar *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Kamar 1"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lantai *</Label>
                <Combobox
                  options={floorOptions}
                  value={formData.floor.toString()}
                  onValueChange={(value) => setFormData({ ...formData, floor: parseInt(value) || 1 })}
                  placeholder="Pilih lantai"
                  searchPlaceholder="Cari..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Kapasitas Bed *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
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
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="text-sm">
                Kamar Aktif
              </Label>
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
