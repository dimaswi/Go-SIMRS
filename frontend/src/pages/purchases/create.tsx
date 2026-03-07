import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { purchasesApi } from "@/lib/api/stock-requests";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { api } from "@/lib/api/client";
import {
  ItemPickerDialog,
  SelectedItemsTable,
  type SelectableItem,
  type SelectedItemWithQty,
} from "@/components/item-picker";
import { Loader2 } from "lucide-react";

interface Room {
  id: number;
  code: string;
  name: string;
}

interface Inventory {
  id: number;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  purchase_price: number;
}

interface Medicine {
  id: number;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  purchase_price: number;
}

export default function PurchaseCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [depoRooms, setDepoRooms] = useState<ComboboxOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allItems, setAllItems] = useState<SelectableItem[]>([]);
  const [useManualSupplier, setUseManualSupplier] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: 0,
    supplier_name: "",
    supplier_contact: "",
    to_room_id: 0,
    notes: "",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItemWithQty[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, inventoriesRes, medicinesRes, suppliersRes] = await Promise.all([
        api.get("/rooms", { params: { limit: 500 } }),
        api.get("/inventories", { params: { limit: 500, is_active: true } }),
        api.get("/medicines", { params: { limit: 500, is_active: true } }),
        suppliersApi.getAllActive(),
      ]);

      // Filter only depo/farmasi rooms for purchases
      const allRooms = roomsRes.data.data || [];
      const depoTypes = ['depo_farmasi', 'gudang_farmasi', 'farmasi_rawat_jalan', 'farmasi_rawat_inap', 'farmasi_ugd', 'gudang'];
      const depos = allRooms.filter((r: Room) => depoTypes.includes((r as any).room_type));
      setDepoRooms(depos.map((r: Room) => ({
        value: r.id.toString(),
        label: `${r.code} - ${r.name}`,
      })));
      setSuppliers(suppliersRes.data.data || []);

      // Combine inventories and medicines into selectable items
      const inventories: Inventory[] = inventoriesRes.data.data || [];
      const medicines: Medicine[] = medicinesRes.data.data || [];

      const items: SelectableItem[] = [
        ...inventories.map((inv) => ({
          id: inv.id,
          code: inv.code,
          name: inv.name,
          unit: inv.unit,
          type: "inventory" as const,
          current_stock: inv.current_stock,
          price: inv.purchase_price || 0,
        })),
        ...medicines.map((med) => ({
          id: med.id,
          code: med.code,
          name: med.name,
          unit: med.unit,
          type: "medicine" as const,
          current_stock: med.current_stock,
          price: med.purchase_price || 0,
        })),
      ];

      setAllItems(items);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Buat Pembelian");
    loadData();
  }, [loadData]);

  const handleSupplierChange = (supplierId: string) => {
    const id = parseInt(supplierId);
    const supplier = suppliers.find((s) => s.id === id);
    setFormData({
      ...formData,
      supplier_id: id,
      supplier_name: supplier?.name || "",
      supplier_contact: supplier?.phone || "",
    });
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

  const onSubmit = async () => {
    // Validate
    if (!formData.supplier_id && !formData.supplier_name) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih supplier atau isi nama supplier manual.",
      });
      return;
    }

    if (!formData.to_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan tujuan.",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tambahkan minimal 1 item.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: formData.supplier_id || undefined,
        supplier_name: formData.supplier_name || "",
        supplier_contact: formData.supplier_contact,
        to_room_id: formData.to_room_id,
        notes: formData.notes,
        items: selectedItems.map((item) => ({
          inventory_id: item.type === "inventory" ? item.id : undefined,
          medicine_id: item.type === "medicine" ? item.id : undefined,
          quantity_ordered: item.quantity,
          unit_price: item.unit_price || 0,
          unit: item.unit,
          notes: item.notes,
        })),
      };

      await purchasesApi.create(payload);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Pembelian berhasil dibuat.",
      });
      navigate("/purchases");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal membuat pembelian.",
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
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => window.history.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Buat Pembelian</h1>
          <p className="text-sm text-muted-foreground">Buat order pembelian baru ke supplier</p>
        </div>
      </div>
      <div className="rounded-lg border p-6 space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Pilih Supplier</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUseManualSupplier(!useManualSupplier);
                  if (!useManualSupplier) {
                    setFormData({ ...formData, supplier_id: 0 });
                  } else {
                    setFormData({ ...formData, supplier_name: "", supplier_contact: "" });
                  }
                }}
              >
                {useManualSupplier ? "Pilih dari Daftar" : "Input Manual"}
              </Button>
            </div>

            {!useManualSupplier ? (
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select
                  onValueChange={handleSupplierChange}
                  value={formData.supplier_id?.toString() || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.code} - {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nama Supplier *</Label>
                  <Input
                    placeholder="Masukkan nama supplier"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kontak Supplier</Label>
                  <Input
                    placeholder="No. telepon supplier"
                    value={formData.supplier_contact}
                    onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Room Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ruangan Tujuan (Depo/Gudang) *</Label>
              <Combobox
                options={depoRooms}
                value={formData.to_room_id?.toString() || ""}
                onValueChange={(value) => setFormData({ ...formData, to_room_id: parseInt(value) })}
                placeholder="Pilih depo/gudang tujuan"
                searchPlaceholder="Cari ruangan..."
                emptyText="Tidak ada depo/gudang"
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                placeholder="Catatan tambahan (opsional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Daftar Item</h3>
                <p className="text-sm text-muted-foreground">
                  Pilih item yang akan dibeli dari supplier
                </p>
              </div>
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Pilih Item
              </Button>
            </div>

            <SelectedItemsTable
              items={selectedItems}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onRemoveMultiple={handleRemoveMultiple}
              showPrice={true}
              emptyMessage="Klik 'Pilih Item' untuk menambahkan item pembelian"
            />
          </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate("/purchases")}>
          Batal
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="mr-2 h-4 w-4" />
          )}
          {submitting ? "Menyimpan..." : "Buat Pembelian"}
        </Button>
      </div>

      {/* Item Picker Dialog */}
      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Pilih Item Pembelian"
        description="Pilih item inventaris atau obat yang akan dibeli"
        items={allItems}
        selectedItems={selectedItems}
        onConfirm={handleItemsConfirm}
        showPrice={true}
        showStock={true}
        showTabs={true}
      />
    </div>
  );
}
