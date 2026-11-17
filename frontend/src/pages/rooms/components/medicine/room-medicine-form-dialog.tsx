import { useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
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

type SelectedMedicineEntry = {
  quantity: number;
  min_quantity: number;
};

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
  const [search, setSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState<Record<number, SelectedMedicineEntry>>({});
  const [defaultQty, setDefaultQty] = useState(1);
  const [defaultMinQty, setDefaultMinQty] = useState(0);

  const [formData, setFormData] = useState({
    medicine_id: 0,
    quantity: 1,
    min_quantity: 0,
    notes: "",
  });

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (open) {
      if (!hasInitialized.current) {
        if (roomMedicine) {
          setFormData({
            medicine_id: roomMedicine.medicine_id,
            quantity: roomMedicine.quantity,
            min_quantity: roomMedicine.min_quantity,
            notes: roomMedicine.notes || "",
          });
        } else {
          loadMedicines();
          setSelectedMap({});
          setSearch("");
          setDefaultQty(1);
          setDefaultMinQty(0);
          setFormData({
            medicine_id: 0,
            quantity: 1,
            min_quantity: 0,
            notes: "",
          });
        }
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
    }
  }, [roomMedicine, open]);

  const loadMedicines = async () => {
    setLoadingMedicines(true);
    try {
      const [medRes, roomMedRes] = await Promise.all([
        medicinesApi.getAll({ is_active: true, limit: 1000 }),
        roomMedicinesApi.getByRoom(roomId),
      ]);
      const existingIds = new Set((roomMedRes.data.data || []).map((rm: RoomMedicine) => rm.medicine_id));
      const available = (medRes.data.data || []).filter((m: Medicine) => !existingIds.has(m.id));
      setMedicines(available);
    } catch (error) {
      console.error("Failed to load medicines:", error);
    } finally {
      setLoadingMedicines(false);
    }
  };

  const filteredMedicines = useMemo(() => {
    if (!search.trim()) return medicines;
    const q = search.toLowerCase().trim();
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.generic_name && m.generic_name.toLowerCase().includes(q))
    );
  }, [medicines, search]);

  const selectedIds = Object.keys(selectedMap).map(Number);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next: Record<number, SelectedMedicineEntry> = { ...selectedMap };
      filteredMedicines.forEach((m) => {
        if (!next[m.id]) {
          next[m.id] = { quantity: defaultQty, min_quantity: defaultMinQty };
        }
      });
      setSelectedMap(next);
    } else {
      const next = { ...selectedMap };
      filteredMedicines.forEach((m) => {
        delete next[m.id];
      });
      setSelectedMap(next);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (checked) {
        next[id] = { quantity: defaultQty, min_quantity: defaultMinQty };
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const handleUpdateEntry = (id: number, field: keyof SelectedMedicineEntry, value: number) => {
    setSelectedMap((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], [field]: value },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (roomMedicine) {
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
      return;
    }

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih minimal satu obat terlebih dahulu.",
      });
      return;
    }

    const invalidEntry = selectedIds.find((id) => (selectedMap[id]?.quantity ?? 0) < 1);
    if (invalidEntry !== undefined) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Jumlah setiap obat minimal 1.",
      });
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        selectedIds.map((medId) =>
          roomMedicinesApi.assignToRoom(roomId, {
            medicine_id: medId,
            quantity: selectedMap[medId].quantity,
            min_quantity: selectedMap[medId].min_quantity,
            notes: formData.notes,
          })
        )
      );
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${selectedIds.length} obat berhasil ditambahkan ke ruangan.`,
      });
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

  const getCategoryBadge = (category: MedicineCategory) => {
    const colorMap: Record<MedicineCategory, string> = {
      generic: "bg-blue-100 text-blue-800",
      patent: "bg-purple-100 text-purple-800",
      herbal: "bg-green-100 text-green-800",
      traditional: "bg-amber-100 text-amber-800",
      biological: "bg-pink-100 text-pink-800",
    };
    return (
      <Badge variant="outline" className={cn("h-5 text-[10px]", colorMap[category])}>
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
      <Badge variant="outline" className={cn("h-5 text-[10px]", colorMap[type])}>
        {medicineTypeLabels[type]}
      </Badge>
    );
  };

  const isEditMode = !!roomMedicine;
  const allFilteredSelected =
    filteredMedicines.length > 0 && filteredMedicines.every((m) => !!selectedMap[m.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isEditMode ? "sm:max-w-[425px]" : "sm:max-w-[80vw] h-[85vh] flex flex-col"}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Obat Ruangan" : "Tambah Obat ke Ruangan"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Edit jumlah dan pengaturan obat di ruangan ini"
              : "Pilih satu atau beberapa obat untuk ditambahkan sekaligus ke ruangan ini"}
          </DialogDescription>
        </DialogHeader>

        {isEditMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-medium">Jumlah *</Label>
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
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_quantity" className="text-xs font-medium">Stok Minimum</Label>
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
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Catatan tambahan..."
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, kode, atau generik obat..."
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Default Jumlah:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={defaultQty}
                    onChange={(e) => setDefaultQty(Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 w-20 text-xs text-right"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Default Min.:</Label>
                  <Input
                    type="number"
                    min={0}
                    value={defaultMinQty}
                    onChange={(e) => setDefaultMinQty(Math.max(0, Number(e.target.value) || 0))}
                    className="h-8 w-20 text-xs text-right"
                  />
                </div>
                <Badge variant="secondary" className="h-6 text-xs">
                  {selectedIds.length} dipilih
                </Badge>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border">
              {loadingMedicines ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMedicines.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {search ? "Tidak ada obat yang sesuai pencarian." : "Semua obat aktif sudah terdaftar di ruangan ini."}
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                        />
                      </TableHead>
                      <TableHead>Obat</TableHead>
                      <TableHead>Kategori / Tipe</TableHead>
                      <TableHead>Stok Gudang</TableHead>
                      <TableHead className="w-28 text-right">Jumlah</TableHead>
                      <TableHead className="w-28 text-right">Min. Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMedicines.map((medicine) => {
                      const entry = selectedMap[medicine.id];
                      const isChecked = !!entry;

                      return (
                        <TableRow
                          key={medicine.id}
                          className={cn("cursor-pointer", isChecked && "bg-primary/5")}
                          onClick={() => handleSelectOne(medicine.id, !isChecked)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => handleSelectOne(medicine.id, Boolean(checked))}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{medicine.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {medicine.code}
                              {medicine.generic_name ? ` • ${medicine.generic_name}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {getCategoryBadge(medicine.category)}
                              {getTypeBadge(medicine.type)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {medicine.current_stock} {medicine.unit}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              min={1}
                              disabled={!isChecked}
                              value={isChecked ? entry.quantity : defaultQty}
                              onChange={(e) => handleUpdateEntry(medicine.id, "quantity", Number(e.target.value) || 1)}
                              className="h-7 w-20 ml-auto text-right text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              min={0}
                              disabled={!isChecked}
                              value={isChecked ? entry.min_quantity : defaultMinQty}
                              onChange={(e) => handleUpdateEntry(medicine.id, "min_quantity", Number(e.target.value) || 0)}
                              className="h-7 w-20 ml-auto text-right text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={loading || selectedIds.length === 0}>
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  `Simpan (${selectedIds.length} Obat)`
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
