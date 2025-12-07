import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  medicinesApi,
  roomMedicinesApi,
  medicineCategoryLabels,
  medicineTypeLabels,
  type Medicine,
  type RoomMedicine,
  type MedicineCategory,
  type MedicineType,
} from "@/lib/api/medicines";

interface RoomMedicineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  roomMedicine?: RoomMedicine | null;
  onSuccess: () => void;
}

export function RoomMedicineFormDialog({
  open,
  onOpenChange,
  roomId,
  roomMedicine,
  onSuccess,
}: RoomMedicineFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [medicineOpen, setMedicineOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  const [formData, setFormData] = useState({
    medicine_id: 0,
    quantity: 1,
    min_quantity: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadMedicines();
      if (roomMedicine) {
        setFormData({
          medicine_id: roomMedicine.medicine_id,
          quantity: roomMedicine.quantity,
          min_quantity: roomMedicine.min_quantity,
          notes: roomMedicine.notes || "",
        });
        if (roomMedicine.medicine) {
          setSelectedMedicine(roomMedicine.medicine);
        }
      } else {
        setFormData({
          medicine_id: 0,
          quantity: 1,
          min_quantity: 0,
          notes: "",
        });
        setSelectedMedicine(null);
      }
    }
  }, [roomMedicine, open]);

  const loadMedicines = async () => {
    setLoadingMedicines(true);
    try {
      const res = await medicinesApi.getAll({ is_active: true, limit: 1000 });
      setMedicines(res.data.data || []);
    } catch (error) {
      console.error("Failed to load medicines:", error);
    } finally {
      setLoadingMedicines(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomMedicine && !formData.medicine_id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih obat terlebih dahulu.",
      });
      return;
    }

    if (formData.quantity < 1) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Jumlah minimal 1.",
      });
      return;
    }

    setLoading(true);

    try {
      if (roomMedicine) {
        await roomMedicinesApi.update(roomMedicine.id, {
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          notes: formData.notes,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Obat ruangan berhasil diperbarui.",
        });
      } else {
        await roomMedicinesApi.assignToRoom(roomId, {
          medicine_id: formData.medicine_id,
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          notes: formData.notes,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Obat berhasil ditambahkan ke ruangan.",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan obat.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineSelect = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setFormData((prev) => ({
      ...prev,
      medicine_id: medicine.id,
    }));
    setMedicineOpen(false);
  };

  const getCategoryBadge = (category: MedicineCategory) => {
    const colorMap: Record<MedicineCategory, string> = {
      generic: "bg-blue-100 text-blue-800",
      patent: "bg-purple-100 text-purple-800",
      herbal: "bg-green-100 text-green-800",
      traditional: "bg-amber-100 text-amber-800",
      biological: "bg-pink-100 text-pink-800",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", colorMap[category])}>
        {medicineCategoryLabels[category]}
      </Badge>
    );
  };

  const getTypeBadge = (type: MedicineType) => {
    const colorMap: Record<MedicineType, string> = {
      otc: "bg-green-100 text-green-800",
      limited: "bg-yellow-100 text-yellow-800",
      hard: "bg-red-100 text-red-800",
      narcotic: "bg-purple-100 text-purple-800",
      psychotrope: "bg-pink-100 text-pink-800",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", colorMap[type])}>
        {medicineTypeLabels[type]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {roomMedicine ? "Edit Obat Ruangan" : "Tambah Obat ke Ruangan"}
          </DialogTitle>
          <DialogDescription>
            {roomMedicine
              ? "Edit jumlah dan pengaturan obat di ruangan ini"
              : "Pilih dan tambahkan obat ke ruangan ini"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Medicine Selection */}
          <div className="space-y-2">
            <Label>Obat *</Label>
            <Popover open={medicineOpen} onOpenChange={setMedicineOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={medicineOpen}
                  className="w-full justify-between"
                  disabled={!!roomMedicine}
                >
                  {selectedMedicine
                    ? `${selectedMedicine.code} - ${selectedMedicine.name}`
                    : "Pilih obat..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Cari obat..." />
                  <CommandList>
                    <CommandEmpty>
                      {loadingMedicines
                        ? "Memuat..."
                        : "Tidak ada obat ditemukan."}
                    </CommandEmpty>
                    <CommandGroup>
                      {medicines.map((medicine) => (
                        <CommandItem
                          key={medicine.id}
                          value={`${medicine.code} ${medicine.name} ${medicine.generic_name || ""}`}
                          onSelect={() => handleMedicineSelect(medicine)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedMedicine?.id === medicine.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {medicine.code} - {medicine.name}
                              </span>
                              {getCategoryBadge(medicine.category)}
                              {getTypeBadge(medicine.type)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {medicine.generic_name && `${medicine.generic_name} • `}
                              Stok: {medicine.current_stock} {medicine.unit}
                              {medicine.strength && ` • ${medicine.strength}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected medicine info */}
          {selectedMedicine && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedMedicine.name}</span>
                <div className="flex items-center gap-1">
                  {getCategoryBadge(selectedMedicine.category)}
                  {getTypeBadge(selectedMedicine.type)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedMedicine.generic_name && `${selectedMedicine.generic_name} • `}
                Stok tersedia: {selectedMedicine.current_stock} {selectedMedicine.unit}
                {selectedMedicine.strength && ` • Kekuatan: ${selectedMedicine.strength}`}
                {selectedMedicine.manufacturer && ` • ${selectedMedicine.manufacturer}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Jumlah *</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: Number(e.target.value),
                  }))
                }
                placeholder="Jumlah obat"
              />
              {selectedMedicine && (
                <p className="text-xs text-muted-foreground">
                  Satuan: {selectedMedicine.unit}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_quantity">Stok Minimum</Label>
              <Input
                id="min_quantity"
                type="number"
                min={0}
                value={formData.min_quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    min_quantity: Number(e.target.value),
                  }))
                }
                placeholder="0 = tidak ada minimum"
              />
              <p className="text-xs text-muted-foreground">
                Alert jika stok di bawah minimum
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Catatan tambahan..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
