import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { stockRequestsApi } from "@/lib/api/stock-requests";
import { roomsApi } from "@/lib/api/rooms";
import { roomInventoriesApi } from "@/lib/api/inventories";
import { roomMedicinesApi } from "@/lib/api/medicines";
import { Loader2, Plus, Send } from "lucide-react";
import {
  ItemPickerDialog,
  SelectedItemsTable,
  type SelectableItem,
  type SelectedItemWithQty,
} from "@/components/item-picker";

interface RoomInventoryItem {
  id: number;
  room_id: number;
  inventory_id: number;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  quantity: number;
  min_quantity: number;
}

interface RoomMedicineItem {
  id: number;
  room_id: number;
  medicine_id: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  quantity: number;
  min_quantity: number;
}

const priorityOptions: ComboboxOption[] = [
  { value: "low", label: "Rendah" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Tinggi" },
  { value: "urgent", label: "Mendesak" },
];

const requestTypeOptions: ComboboxOption[] = [
  { value: "inventory", label: "Barang Inventaris" },
  { value: "medicine", label: "Obat/Farmasi" },
];

export default function StockRequestCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<ComboboxOption[]>([]);
  const [depoRooms, setDepoRooms] = useState<ComboboxOption[]>([]);
  const [availableItems, setAvailableItems] = useState<SelectableItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    request_type: "inventory" as "inventory" | "medicine",
    from_room_id: 0,
    to_room_id: 0,
    priority: "normal",
    required_date: "",
    reason: "",
    notes: "",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItemWithQty[]>([]);

  useEffect(() => {
    setPageTitle("Buat Permintaan Stok");
    loadRooms();
  }, []);

  // Load items when to_room_id (depo/gudang tujuan) or request_type changes
  const loadRoomItems = useCallback(async (roomId: number, requestType: string) => {
    if (!roomId) {
      setAvailableItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      let items: SelectableItem[] = [];

      if (requestType === "inventory") {
        const res = await roomInventoriesApi.getByRoom(roomId, { limit: 500 });
        const roomInventories: RoomInventoryItem[] = res.data.data || [];
        items = roomInventories
          .filter((ri) => ri.inventory && ri.quantity > 0)
          .map((ri) => ({
            id: ri.inventory_id,
            code: ri.inventory!.code,
            name: ri.inventory!.name,
            unit: ri.inventory!.unit,
            type: "inventory" as const,
            current_stock: ri.quantity,
          }));
      } else {
        const res = await roomMedicinesApi.getByRoom(roomId, { limit: 500 });
        const roomMedicines: RoomMedicineItem[] = res.data.data || [];
        items = roomMedicines
          .filter((rm) => rm.medicine && rm.quantity > 0)
          .map((rm) => ({
            id: rm.medicine_id,
            code: rm.medicine!.code,
            name: rm.medicine!.name,
            unit: rm.medicine!.unit,
            type: "medicine" as const,
            current_stock: rm.quantity,
          }));
      }

      setAvailableItems(items);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat stok ruangan.",
      });
    } finally {
      setLoadingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    if (formData.to_room_id > 0) {
      loadRoomItems(formData.to_room_id, formData.request_type);
      // Clear items when depo or type changes
      setSelectedItems([]);
    }
  }, [formData.to_room_id, formData.request_type, loadRoomItems]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const roomsRes = await roomsApi.getAll({ limit: 100 });

      const allRooms = roomsRes.data.data || [];

      // All rooms for "from" selection
      setRooms(allRooms.map((r: any) => ({
        value: r.id.toString(),
        label: `${r.code} - ${r.name}`,
      })));

      // Filter depo/pharmacy rooms for "to" selection
      const depoTypes = ['depo_farmasi', 'gudang_farmasi', 'farmasi_rawat_jalan', 'farmasi_rawat_inap', 'farmasi_ugd', 'gudang'];
      const depos = allRooms.filter((r: any) => depoTypes.includes(r.room_type));
      setDepoRooms(depos.map((r: any) => ({
        value: r.id.toString(),
        label: `${r.code} - ${r.name}`,
      })));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemsConfirm = (items: SelectedItemWithQty[]) => {
    setSelectedItems(items);
  };

  const handleUpdateItem = (index: number, updates: Partial<SelectedItemWithQty>) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveMultiple = (indices: number[]) => {
    setSelectedItems((prev) => prev.filter((_, i) => !indices.includes(i)));
  };

  const handleSubmit = async () => {
    if (!formData.from_room_id || !formData.to_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan asal dan tujuan.",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tambahkan minimal satu item.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await stockRequestsApi.create({
        request_type: formData.request_type,
        from_room_id: formData.from_room_id,
        to_room_id: formData.to_room_id,
        priority: formData.priority,
        required_date: formData.required_date || undefined,
        reason: formData.reason,
        notes: formData.notes,
        items: selectedItems.map((item) => ({
          inventory_id: item.type === "inventory" ? item.id : undefined,
          medicine_id: item.type === "medicine" ? item.id : undefined,
          quantity_requested: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Permintaan stok berhasil dibuat.",
      });
      navigate("/stock-requests");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat permintaan.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">


      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Form Fields */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informasi Permintaan
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipe Permintaan <span className="text-destructive">*</span></Label>
                <Combobox
                  options={requestTypeOptions}
                  value={formData.request_type}
                  onValueChange={(value) => {
                    setFormData({ ...formData, request_type: value as any });
                    setSelectedItems([]); // Clear items when switching type
                  }}
                  placeholder="Pilih tipe"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Prioritas</Label>
                <Combobox
                  options={priorityOptions}
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  placeholder="Pilih prioritas"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Ruangan Pemohon <span className="text-destructive">*</span></Label>
                <Combobox
                  options={rooms}
                  value={formData.from_room_id.toString()}
                  onValueChange={(value) => setFormData({ ...formData, from_room_id: parseInt(value) })}
                  placeholder="Pilih ruangan"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Depo/Gudang Tujuan <span className="text-destructive">*</span></Label>
                <Combobox
                  options={depoRooms}
                  value={formData.to_room_id.toString()}
                  onValueChange={(value) => setFormData({ ...formData, to_room_id: parseInt(value) })}
                  placeholder="Pilih depo/gudang"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tanggal Dibutuhkan</Label>
                <Input
                  type="date"
                  value={formData.required_date}
                  onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Alasan Permintaan</Label>
                <Input
                  placeholder="Alasan permintaan..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Catatan</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
            <span>Daftar Item</span>
            <Button
              onClick={() => setPickerOpen(true)}
              disabled={formData.to_room_id === 0 || loadingItems}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {loadingItems ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              Pilih Item
            </Button>
          </div>
          <div className="p-3 sm:p-4 space-y-4">

            {formData.to_room_id === 0 ? (
              <div className="text-center py-12 border rounded-md text-muted-foreground">
                <p className="text-sm">Pilih depo/gudang tujuan terlebih dahulu</p>
              </div>
            ) : loadingItems ? (
              <div className="flex items-center justify-center py-12 border rounded-md">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableItems.length === 0 ? (
              <div className="text-center py-12 border rounded-md text-muted-foreground">
                <p className="text-sm">Tidak ada {formData.request_type === "inventory" ? "inventaris" : "obat"} di depo/gudang ini</p>
              </div>
            ) : (
              <SelectedItemsTable
                items={selectedItems}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRemoveMultiple={handleRemoveMultiple}
                showPrice={false}
                emptyMessage={`Klik 'Pilih Item' untuk menambahkan ${formData.request_type === "inventory" ? "inventaris" : "obat"}`}
              />
            )}
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-2 border-t bg-background">
          <Button
            variant="outline"
            onClick={() => navigate("/stock-requests")}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Kirim Permintaan
          </Button>
        </div>
      </div>

      {/* Item Picker Dialog */}
      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={`Pilih ${formData.request_type === "inventory" ? "Inventaris" : "Obat"}`}
        description={`Pilih ${formData.request_type === "inventory" ? "inventaris" : "obat"} yang ingin diminta dari depo`}
        items={availableItems}
        selectedItems={selectedItems}
        onConfirm={handleItemsConfirm}
        showPrice={false}
        showStock={true}
        showTabs={false}
      />
    </div>
  );
}
