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
  inventoriesApi,
  roomInventoriesApi,
  inventoryCategoryLabels,
  type Inventory,
  type RoomInventory,
  type InventoryCategory,
} from "@/lib/api/inventories";

interface RoomInventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  roomInventory?: RoomInventory | null;
  onSuccess: () => void;
}

export function RoomInventoryFormDialog({
  open,
  onOpenChange,
  roomId,
  roomInventory,
  onSuccess,
}: RoomInventoryFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loadingInventories, setLoadingInventories] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);

  const [formData, setFormData] = useState({
    inventory_id: 0,
    quantity: 1,
    min_quantity: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadInventories();
      if (roomInventory) {
        setFormData({
          inventory_id: roomInventory.inventory_id,
          quantity: roomInventory.quantity,
          min_quantity: roomInventory.min_quantity,
          notes: roomInventory.notes || "",
        });
        if (roomInventory.inventory) {
          setSelectedInventory(roomInventory.inventory);
        }
      } else {
        setFormData({
          inventory_id: 0,
          quantity: 1,
          min_quantity: 0,
          notes: "",
        });
        setSelectedInventory(null);
      }
    }
  }, [roomInventory, open]);

  const loadInventories = async () => {
    setLoadingInventories(true);
    try {
      const res = await inventoriesApi.getAll({ is_active: true, limit: 1000 });
      setInventories(res.data.data || []);
    } catch (error) {
      console.error("Failed to load inventories:", error);
    } finally {
      setLoadingInventories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomInventory && !formData.inventory_id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih inventaris terlebih dahulu.",
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
      if (roomInventory) {
        await roomInventoriesApi.update(roomInventory.id, {
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          notes: formData.notes,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Inventaris ruangan berhasil diperbarui.",
        });
      } else {
        await roomInventoriesApi.assignToRoom(roomId, {
          inventory_id: formData.inventory_id,
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          notes: formData.notes,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Inventaris berhasil ditambahkan ke ruangan.",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan inventaris.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInventorySelect = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    setFormData((prev) => ({
      ...prev,
      inventory_id: inventory.id,
    }));
    setInventoryOpen(false);
  };

  const getCategoryBadge = (category: InventoryCategory) => {
    const colorMap: Record<InventoryCategory, string> = {
      medical: "bg-red-100 text-red-800",
      non_medical: "bg-blue-100 text-blue-800",
      consumable: "bg-yellow-100 text-yellow-800",
      equipment: "bg-purple-100 text-purple-800",
      furniture: "bg-orange-100 text-orange-800",
      electronic: "bg-cyan-100 text-cyan-800",
      infrastructure: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", colorMap[category])}>
        {inventoryCategoryLabels[category]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {roomInventory ? "Edit Inventaris Ruangan" : "Tambah Inventaris ke Ruangan"}
          </DialogTitle>
          <DialogDescription>
            {roomInventory
              ? "Edit jumlah dan pengaturan inventaris di ruangan ini"
              : "Pilih dan tambahkan inventaris ke ruangan ini"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Inventory Selection */}
          <div className="space-y-2">
            <Label>Inventaris *</Label>
            <Popover open={inventoryOpen} onOpenChange={setInventoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={inventoryOpen}
                  className="w-full justify-between"
                  disabled={!!roomInventory}
                >
                  {selectedInventory
                    ? `${selectedInventory.code} - ${selectedInventory.name}`
                    : "Pilih inventaris..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Cari inventaris..." />
                  <CommandList>
                    <CommandEmpty>
                      {loadingInventories
                        ? "Memuat..."
                        : "Tidak ada inventaris ditemukan."}
                    </CommandEmpty>
                    <CommandGroup>
                      {inventories.map((inventory) => (
                        <CommandItem
                          key={inventory.id}
                          value={`${inventory.code} ${inventory.name}`}
                          onSelect={() => handleInventorySelect(inventory)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedInventory?.id === inventory.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {inventory.code} - {inventory.name}
                              </span>
                              {getCategoryBadge(inventory.category)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Stok: {inventory.current_stock} {inventory.unit}
                              {inventory.brand && ` • ${inventory.brand}`}
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

          {/* Selected inventory info */}
          {selectedInventory && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedInventory.name}</span>
                {getCategoryBadge(selectedInventory.category)}
              </div>
              <div className="text-xs text-muted-foreground">
                Stok tersedia: {selectedInventory.current_stock} {selectedInventory.unit}
                {selectedInventory.brand && ` • Merek: ${selectedInventory.brand}`}
                {selectedInventory.model && ` • Model: ${selectedInventory.model}`}
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
                placeholder="Jumlah inventaris"
              />
              {selectedInventory && (
                <p className="text-xs text-muted-foreground">
                  Satuan: {selectedInventory.unit}
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
