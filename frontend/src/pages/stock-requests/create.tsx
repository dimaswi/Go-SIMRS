import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { stockRequestsApi } from "@/lib/api/stock-requests";
import { roomsApi } from "@/lib/api/rooms";
import { inventoriesApi, roomInventoriesApi } from "@/lib/api/inventories";
import { medicinesApi, roomMedicinesApi } from "@/lib/api/medicines";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Send, ClipboardList, Package, Pill } from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
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
    is_active?: boolean;
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
    is_active?: boolean;
  };
  quantity: number;
  min_quantity: number;
}

interface MasterInventoryItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  is_active?: boolean;
}

interface MasterMedicineItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  is_active?: boolean;
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

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className={cn("border-b border-neutral-200 dark:border-neutral-800 pb-2.5", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Icon className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</div>
              {description ? <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </section>
  );
}

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
    request_mode: "depo" as "depo" | "self_purchase",
    from_room_id: 0,
    to_room_id: 0,
    priority: "normal",
    required_date: "",
    reason: "",
    notes: "",
    receipt_number: "",
    receipt_date: "",
    receipt_file_url: "",
    supplier_name: "",
    total_amount: 0,
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItemWithQty[]>([]);

  useEffect(() => {
    setPageTitle("Buat Permintaan Stok");
    loadRooms();
  }, []);

  // Load selectable items based on request mode:
  // - depo: source from depo room stock
  // - self_purchase: source from master active items
  const loadRoomItems = useCallback(async (roomId: number, requestType: string, requestMode: "depo" | "self_purchase") => {
    if (requestMode === "depo" && !roomId) {
      setAvailableItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      let items: SelectableItem[] = [];

      if (requestMode === "depo") {
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
              is_active: ri.inventory!.is_active,
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
              is_active: rm.medicine!.is_active,
            }));
        }
      } else {
        if (requestType === "inventory") {
          const res = await inventoriesApi.getAll({
            limit: 500,
            item_group: "bhp",
            item_scope: "unit,both",
          });
          const inventoryItems: MasterInventoryItem[] = res.data.data || [];
          items = inventoryItems.map((inv) => ({
            id: inv.id,
            code: inv.code,
            name: inv.name,
            unit: inv.unit,
            type: "inventory" as const,
            is_active: inv.is_active,
          }));
        } else {
          const res = await medicinesApi.getAll({ limit: 500 });
          const medicineItems: MasterMedicineItem[] = res.data.data || [];
          items = medicineItems.map((med) => ({
            id: med.id,
            code: med.code,
            name: med.name,
            unit: med.unit,
            type: "medicine" as const,
            is_active: med.is_active,
          }));
        }
      }

      setAvailableItems(items);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data item.",
      });
    } finally {
      setLoadingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    if (formData.request_mode === "depo" && formData.to_room_id === 0) {
      setAvailableItems([]);
      setSelectedItems([]);
      return;
    }
    loadRoomItems(formData.to_room_id, formData.request_type, formData.request_mode);
    setSelectedItems([]);
  }, [formData.to_room_id, formData.request_type, formData.request_mode, loadRoomItems]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const roomsRes = await roomsApi.getAll({ limit: 100 });

      const allRooms = roomsRes.data.data || [];

      // All rooms for "from" selection
      setRooms(allRooms.map((r: any) => ({
        value: r.id.toString(),
        label: r.name,
      })));

      // Filter depo/pharmacy rooms for "to" selection
      const depoTypes = ['depo_farmasi', 'gudang_farmasi', 'farmasi_rawat_jalan', 'farmasi_rawat_inap', 'farmasi_ugd', 'gudang'];
      const depos = allRooms.filter((r: any) => depoTypes.includes(r.room_type));
      setDepoRooms(depos.map((r: any) => ({
        value: r.id.toString(),
        label: r.name,
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
    if (!formData.from_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan pemohon.",
      });
      return;
    }

    if (formData.request_mode === "depo" && !formData.to_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih depo/gudang tujuan.",
      });
      return;
    }

    if (formData.request_mode === "self_purchase" && !formData.receipt_number.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nomor struk wajib diisi untuk pembelian sendiri.",
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
        request_mode: formData.request_mode,
        from_room_id: formData.from_room_id,
        to_room_id: formData.request_mode === "depo" ? formData.to_room_id : undefined,
        priority: formData.priority,
        required_date: formData.required_date || undefined,
        reason: formData.reason,
        notes: formData.notes,
        receipt_number: formData.request_mode === "self_purchase" ? formData.receipt_number : undefined,
        receipt_date: formData.request_mode === "self_purchase" ? (formData.receipt_date || undefined) : undefined,
        receipt_file_url: formData.request_mode === "self_purchase" ? (formData.receipt_file_url || undefined) : undefined,
        supplier_name: formData.request_mode === "self_purchase" ? (formData.supplier_name || undefined) : undefined,
        total_amount: formData.request_mode === "self_purchase" ? formData.total_amount : undefined,
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
    <PageShell>
      <PageHeader
        icon={ClipboardList}
        title="Buat Permintaan Stok"
        description="Buat permintaan barang inventaris atau obat ke depo/gudang"
        onBack={() => navigate("/stock-requests")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/stock-requests")}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Kirim Permintaan
            </Button>
          </div>
        }
      />

      <PageContent>
        <div className="grid gap-6 items-start [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-muted-foreground [&_input]:h-8 [&_[role=combobox]]:h-8 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="flex flex-col gap-6">
              <SectionPanel
                icon={ClipboardList}
                title="Informasi Permintaan"
                description="Tentukan tipe permintaan sebelum memilih item."
              >
                <div className="space-y-3 border-b border-border/70 pb-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Tipe Permintaan *</Label>
                      <Combobox
                        options={requestTypeOptions}
                        value={formData.request_type}
                        onValueChange={(value) => {
                          setFormData({ ...formData, request_type: value as any });
                          setSelectedItems([]);
                        }}
                        placeholder="Pilih tipe"
                        searchPlaceholder="Cari tipe..."
                        emptyText="Tipe tidak ditemukan"
                        className="h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Prioritas</Label>
                      <Combobox
                        options={priorityOptions}
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
                        placeholder="Pilih prioritas"
                        searchPlaceholder="Cari prioritas..."
                        emptyText="Prioritas tidak ditemukan"
                        className="h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Sumber Pemenuhan *</Label>
                    <RadioGroup
                      value={formData.request_mode}
                      onValueChange={(value) => {
                        const nextMode = value as "depo" | "self_purchase";
                        setFormData((prev) => ({
                          ...prev,
                          request_mode: nextMode,
                          to_room_id: nextMode === "depo" ? prev.to_room_id : 0,
                        }));
                        setSelectedItems([]);
                        setAvailableItems([]);
                      }}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <label className="flex items-start gap-2 border border-border/70 bg-background px-3 py-2">
                        <RadioGroupItem value="depo" id="request-mode-depo" className="mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Depo</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 border border-border/70 bg-background px-3 py-2">
                        <RadioGroupItem value="self_purchase" id="request-mode-self" className="mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Beli Sendiri</p>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className={cn("grid gap-3", formData.request_mode === "depo" ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
                    <div className="space-y-1">
                      <Label>Ruangan Pemohon *</Label>
                      <Combobox
                        options={rooms}
                        value={formData.from_room_id ? formData.from_room_id.toString() : ""}
                        onValueChange={(value) => setFormData({ ...formData, from_room_id: parseInt(value) })}
                        placeholder="Pilih ruangan"
                        searchPlaceholder="Cari ruangan..."
                        emptyText="Ruangan tidak ditemukan"
                        className="h-8"
                      />
                    </div>

                    {formData.request_mode === "depo" ? (
                      <div className="space-y-1">
                        <Label>Depo/Gudang Tujuan *</Label>
                        <Combobox
                          options={depoRooms}
                          value={formData.to_room_id ? formData.to_room_id.toString() : ""}
                          onValueChange={(value) => setFormData({ ...formData, to_room_id: parseInt(value) })}
                          placeholder="Pilih depo/gudang"
                          searchPlaceholder="Cari depo/gudang..."
                          emptyText="Depo/gudang tidak ditemukan"
                          className="h-8"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Tanggal Dibutuhkan</Label>
                      <Input
                        type="date"
                        value={formData.required_date}
                        onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Alasan Permintaan</Label>
                      <Input
                        placeholder="Alasan permintaan"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Catatan</Label>
                    <Textarea
                      placeholder="Catatan tambahan"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="min-h-[96px] resize-none"
                    />
                  </div>

                  {formData.request_mode === "self_purchase" ? (
                    <div className="grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Nomor Struk *</Label>
                        <Input
                          placeholder="Masukkan nomor struk"
                          value={formData.receipt_number}
                          onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Tanggal Struk</Label>
                        <Input
                          type="date"
                          value={formData.receipt_date}
                          onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nama Supplier</Label>
                        <Input
                          placeholder="Supplier / toko"
                          value={formData.supplier_name}
                          onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Total Belanja (Rp)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={formData.total_amount || ""}
                          onChange={(e) => setFormData({ ...formData, total_amount: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>File/URL Struk</Label>
                        <Input
                          placeholder="Link file struk (opsional)"
                          value={formData.receipt_file_url}
                          onChange={(e) => setFormData({ ...formData, receipt_file_url: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionPanel>

              <SectionPanel
                icon={formData.request_type === "inventory" ? Package : Pill}
                title="Ringkasan Permintaan"
                description="Pantau arah permintaan dan jumlah item."
              >
                <div className="grid grid-cols-2 border border-neutral-200 dark:border-neutral-800 divide-x divide-y divide-neutral-200 dark:divide-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/30">
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sumber</div>
                    <div className="mt-1 text-xs font-medium text-foreground truncate">{rooms.find((room) => room.value === String(formData.from_room_id))?.label || "Pilih ruangan"}</div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Item Dipilih</div>
                    <div className="mt-1 text-xs font-medium text-foreground">{selectedItems.length} dari {availableItems.length}</div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mode</div>
                    <div className="mt-1 text-xs font-medium text-foreground">{formData.request_mode === "depo" ? "Permintaan ke Depo" : "Beli Sendiri"}</div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tipe</div>
                    <div className="mt-1 text-xs font-medium text-foreground">{formData.request_type === "inventory" ? "Barang inventaris" : "Obat/farmasi"}</div>
                  </div>
                </div>
              </SectionPanel>
            </div>
          </div>

          <div className="flex flex-col lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-6">
            <SectionPanel
              icon={formData.request_type === "inventory" ? Package : Pill}
              title="Daftar Item"
              description={formData.request_mode === "depo"
                ? "Ambil item langsung dari stok depo atau gudang yang dipilih, lalu sesuaikan jumlah per item."
                : "Pilih item master yang akan dibeli sendiri oleh unit, lalu tentukan jumlah per item."}
              actions={
                <Button
                  onClick={() => setPickerOpen(true)}
                  disabled={(formData.request_mode === "depo" && formData.to_room_id === 0) || loadingItems}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs rounded-none"
                >
                  {loadingItems ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="mr-1 h-3 w-3" />
                  )}
                  Pilih Item
                </Button>
              }
            >
              {formData.request_mode === "depo" && formData.to_room_id === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 text-sm text-muted-foreground">
                  Pilih depo/gudang tujuan terlebih dahulu
                </div>
              ) : loadingItems ? (
                <div className="flex min-h-[280px] items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-background">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 text-sm text-muted-foreground">
                  {formData.request_mode === "depo"
                    ? `Tidak ada ${formData.request_type === "inventory" ? "inventaris" : "obat"} di depo/gudang ini`
                    : `Tidak ada item master ${formData.request_type === "inventory" ? "BHP" : "obat"} yang aktif`}
                </div>
              ) : (
                <SelectedItemsTable
                  items={selectedItems}
                  onUpdateItem={handleUpdateItem}
                  onRemoveItem={handleRemoveItem}
                  onRemoveMultiple={handleRemoveMultiple}
                  compactMode={true}
                  showPrice={false}
                  showStock={formData.request_mode === "depo"}
                  enforceStockLimit={formData.request_mode === "depo"}
                  emptyMessage={`Klik 'Pilih Item' untuk menambahkan ${formData.request_type === "inventory" ? "inventaris" : "obat"}`}
                  className="flex flex-col"
                  scrollAreaClassName="max-h-[520px]"
                />
              )}
            </SectionPanel>
          </div>
        </div>

        <ItemPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title={`Pilih ${formData.request_type === "inventory" ? "Inventaris" : "Obat"}`}
          description={formData.request_mode === "depo"
            ? `Pilih ${formData.request_type === "inventory" ? "inventaris" : "obat"} yang ingin diminta dari depo`
            : `Pilih ${formData.request_type === "inventory" ? "item BHP" : "obat"} yang akan dibeli sendiri oleh unit`}
          items={availableItems}
          selectedItems={selectedItems}
          onConfirm={handleItemsConfirm}
          showPrice={false}
          showStock={formData.request_mode === "depo"}
          showTabs={false}
        />
      </PageContent>
    </PageShell>
  );
}
