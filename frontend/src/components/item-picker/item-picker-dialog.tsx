import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Package, Pill, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectableItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  type: "inventory" | "medicine";
  category?: string;
  current_stock?: number;
  price?: number;
}

export interface SelectedItemWithQty extends SelectableItem {
  quantity: number;
  unit_price?: number;
  notes?: string;
}

interface ItemPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  items: SelectableItem[];
  loading?: boolean;
  selectedItems: SelectedItemWithQty[];
  onConfirm: (items: SelectedItemWithQty[]) => void;
  showPrice?: boolean;
  showStock?: boolean;
  defaultTab?: "inventory" | "medicine" | "all";
  showTabs?: boolean;
}

export function ItemPickerDialog({
  open,
  onOpenChange,
  title = "Pilih Item",
  description = "Pilih item yang ingin ditambahkan",
  items,
  loading = false,
  selectedItems: initialSelectedItems,
  onConfirm,
  showPrice = false,
  showStock = true,
  defaultTab = "all",
  showTabs = true,
}: ItemPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [tempSelected, setTempSelected] = useState<Map<string, SelectedItemWithQty>>(new Map());

  // Initialize temp selection from initial selected items
  useEffect(() => {
    if (open) {
      const map = new Map<string, SelectedItemWithQty>();
      initialSelectedItems.forEach((item) => {
        const key = `${item.type}_${item.id}`;
        map.set(key, item);
      });
      setTempSelected(map);
      setSearchTerm("");
    }
  }, [open, initialSelectedItems]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by tab
    if (activeTab !== "all") {
      filtered = filtered.filter((item) => item.type === activeTab);
    }

    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.code.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [items, activeTab, searchTerm]);

  const inventoryItems = useMemo(() => items.filter((i) => i.type === "inventory"), [items]);
  const medicineItems = useMemo(() => items.filter((i) => i.type === "medicine"), [items]);

  const toggleItem = (item: SelectableItem) => {
    const key = `${item.type}_${item.id}`;
    const newMap = new Map(tempSelected);

    if (newMap.has(key)) {
      newMap.delete(key);
    } else {
      newMap.set(key, {
        ...item,
        quantity: 1,
        unit_price: item.price || 0,
        notes: "",
      });
    }

    setTempSelected(newMap);
  };

  const updateQuantity = (item: SelectableItem, quantity: number) => {
    const key = `${item.type}_${item.id}`;
    const existing = tempSelected.get(key);
    if (existing) {
      const newMap = new Map(tempSelected);
      newMap.set(key, { ...existing, quantity: Math.max(1, quantity) });
      setTempSelected(newMap);
    }
  };

  const updatePrice = (item: SelectableItem, price: number) => {
    const key = `${item.type}_${item.id}`;
    const existing = tempSelected.get(key);
    if (existing) {
      const newMap = new Map(tempSelected);
      newMap.set(key, { ...existing, unit_price: Math.max(0, price) });
      setTempSelected(newMap);
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(tempSelected.values()));
    onOpenChange(false);
  };

  const handleSelectAll = () => {
    const newMap = new Map(tempSelected);
    filteredItems.forEach((item) => {
      const key = `${item.type}_${item.id}`;
      if (!newMap.has(key)) {
        newMap.set(key, {
          ...item,
          quantity: 1,
          unit_price: item.price || 0,
          notes: "",
        });
      }
    });
    setTempSelected(newMap);
  };

  const handleDeselectAll = () => {
    const newMap = new Map(tempSelected);
    filteredItems.forEach((item) => {
      const key = `${item.type}_${item.id}`;
      newMap.delete(key);
    });
    setTempSelected(newMap);
  };

  const isSelected = (item: SelectableItem) => {
    return tempSelected.has(`${item.type}_${item.id}`);
  };

  const getSelectedQuantity = (item: SelectableItem) => {
    return tempSelected.get(`${item.type}_${item.id}`)?.quantity || 1;
  };

  const getSelectedPrice = (item: SelectableItem) => {
    return tempSelected.get(`${item.type}_${item.id}`)?.unit_price || 0;
  };

  const renderItemList = (itemList: SelectableItem[]) => (
    <div className="divide-y">
      {itemList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">Tidak ada item ditemukan</p>
        </div>
      ) : (
        itemList.map((item) => {
          const selected = isSelected(item);
          return (
            <div
              key={`${item.type}_${item.id}`}
              className={cn(
                "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                selected && "bg-primary/5"
              )}
              onClick={() => toggleItem(item)}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => toggleItem(item)}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                  item.type === "medicine" ? "bg-blue-100" : "bg-green-100"
                )}
              >
                {item.type === "medicine" ? (
                  <Pill className="h-4 w-4 text-blue-600" />
                ) : (
                  <Package className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.code}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.unit}</span>
                  {showStock && item.current_stock !== undefined && (
                    <>
                      <span>•</span>
                      <span>Stok: {item.current_stock}</span>
                    </>
                  )}
                  {showPrice && item.price !== undefined && (
                    <>
                      <span>•</span>
                      <span>Rp {item.price.toLocaleString("id-ID")}</span>
                    </>
                  )}
                </div>
              </div>
              {selected && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Qty:</Label>
                    <Input
                      type="number"
                      min={1}
                      value={getSelectedQuantity(item)}
                      onChange={(e) => updateQuantity(item, parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {showPrice && (
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Harga:</Label>
                      <Input
                        type="number"
                        min={0}
                        value={getSelectedPrice(item)}
                        onChange={(e) => updatePrice(item, parseFloat(e.target.value) || 0)}
                        className="w-24 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Search and Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau kode item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              <Check className="h-4 w-4 mr-1" />
              Pilih Semua
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              <X className="h-4 w-4 mr-1" />
              Hapus Semua
            </Button>
          </div>

          {/* Selection Count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {filteredItems.length} item tersedia
            </span>
            <Badge variant="secondary">
              {tempSelected.size} item dipilih
            </Badge>
          </div>

          {/* Item List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : showTabs ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Semua ({items.length})</TabsTrigger>
                <TabsTrigger value="inventory">Inventaris ({inventoryItems.length})</TabsTrigger>
                <TabsTrigger value="medicine">Obat ({medicineItems.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[350px] border rounded-md">
                  {renderItemList(filteredItems)}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="inventory" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[350px] border rounded-md">
                  {renderItemList(filteredItems)}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="medicine" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[350px] border rounded-md">
                  {renderItemList(filteredItems)}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <ScrollArea className="h-[400px] border rounded-md">
              {renderItemList(filteredItems)}
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={tempSelected.size === 0}>
            <Check className="h-4 w-4 mr-2" />
            Tambahkan {tempSelected.size} Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
