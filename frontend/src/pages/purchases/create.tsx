import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Package, Plus, ShoppingCart } from "lucide-react";
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
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { purchasesApi } from "@/lib/api/stock-requests";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { api } from "@/lib/api/client";
import {
  ItemPickerDialog,
  SelectedItemsTable,
  type SelectedItemWithQty,
  fetchPurchaseItems,
} from "@/components/item-picker";

interface Room {
  id: number;
  code: string;
  name: string;
}

function resolveOrderedQtySmall(item: SelectedItemWithQty) {
  const factor = Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1));
  const qtyLarge = Math.max(0, Number(item.quantity_large || 0));
  const qtySmall = Math.max(0, Number(item.quantity_small || 0));
  if (qtyLarge > 0 || qtySmall > 0) {
    return (qtyLarge * factor) + qtySmall;
  }
  return Math.max(1, Number(item.quantity || 0));
}

export default function PurchaseCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [depoRooms, setDepoRooms] = useState<ComboboxOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [useManualSupplier, setUseManualSupplier] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: 0,
    supplier_name: "",
    supplier_contact: "",
    to_room_id: 0,
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    payment_method: "credit",
    payment_term_days: 30,
    due_date: "",
    notes: "",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItemWithQty[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, suppliersRes] = await Promise.all([
        api.get("/rooms", { params: { limit: 500 } }),
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
    setSelectedItems(
      items.map((item) => {
        if (item.type !== "medicine") return item;
        const factor = Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1));
        return {
          ...item,
          unit_small: item.unit_small || item.unit,
          conversion_factor: factor,
          quantity_large: item.quantity_large ?? 0,
          quantity_small: item.quantity_small || item.quantity || 1,
        };
      })
    );
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
        invoice_number: formData.invoice_number || undefined,
        invoice_date: formData.invoice_date || undefined,
        payment_method: formData.payment_method,
        payment_term_days: formData.payment_term_days,
        due_date: formData.due_date || undefined,
        notes: formData.notes,
        items: selectedItems.map((item) => ({
          inventory_id: item.type === "inventory" ? item.id : undefined,
          medicine_id: item.type === "medicine" ? item.id : undefined,
          quantity_ordered: resolveOrderedQtySmall(item),
          quantity_large: item.type === "medicine" ? Math.max(0, Number(item.quantity_large || 0)) : undefined,
          quantity_small: item.type === "medicine" ? Math.max(0, Number(item.quantity_small || 0)) : undefined,
          unit_large: item.type === "medicine" ? (item.unit_large || undefined) : undefined,
          unit_small: item.type === "medicine" ? (item.unit_small || item.unit || undefined) : undefined,
          conversion_factor: item.type === "medicine" ? Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1)) : 1,
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          tax_percent: item.tax_percent || 0,
          tax_amount: item.tax_amount || 0,
          batch_number: item.batch_number || undefined,
          expiry_date: item.expiry_date || undefined,
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
      <PageShell>
        <PageHeader
          title="Buat Pembelian"
        />
        <PageContent className="flex-none pb-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Buat Pembelian"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 [&_label]:text-[10px] [&_label]:tracking-[0.08em] [&_label]:uppercase [&_label]:text-muted-foreground [&_input]:h-8 [&_[role=combobox]]:h-8 lg:grid-cols-[minmax(330px,390px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <SectionPanel
              icon={Building2}
              title="Detail Pembelian"
              className="flex h-full flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col gap-3 px-2.5 py-2.5 sm:px-3"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUseManualSupplier(!useManualSupplier);
                    if (!useManualSupplier) {
                      setFormData({ ...formData, supplier_id: 0 });
                    } else {
                      setFormData({ ...formData, supplier_name: "", supplier_contact: "" });
                    }
                  }}
                  className="h-6 px-2 text-[10px]"
                >
                  {useManualSupplier ? "Pilih dari Daftar" : "Input Manual"}
                </Button>
              }
            >
              <div className="space-y-3 border-b border-border/70 pb-3">
                {!useManualSupplier ? (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="space-y-1">
                      <Label>Supplier *</Label>
                      <Combobox
                        options={suppliers.map((supplier) => ({
                          value: supplier.id.toString(),
                          label: supplier.code ? `${supplier.code} - ${supplier.name}` : supplier.name,
                        }))}
                        value={formData.supplier_id?.toString() || ""}
                        onValueChange={handleSupplierChange}
                        placeholder="Pilih supplier"
                        searchPlaceholder="Cari supplier..."
                        emptyText="Supplier tidak ditemukan"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Kontak Supplier</Label>
                      <Input
                        placeholder="No. telepon"
                        value={formData.supplier_contact}
                        onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Nama Supplier *</Label>
                      <Input
                        placeholder="Masukkan nama supplier"
                        value={formData.supplier_name}
                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
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

              <div className="space-y-3 border-b border-border/70 pb-3">
                <div className="space-y-1">
                  <Label>Ruangan Tujuan (Depo/Gudang) *</Label>
                  <Combobox
                    options={depoRooms}
                    value={formData.to_room_id?.toString() || ""}
                    onValueChange={(value) => setFormData({ ...formData, to_room_id: parseInt(value) })}
                    placeholder="Pilih depo/gudang tujuan"
                    searchPlaceholder="Cari ruangan..."
                    emptyText="Tidak ada depo/gudang"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-3 border-b border-border/70 pb-3">
                <div className="space-y-1">
                  <Label>No. Faktur Supplier</Label>
                  <Input
                    placeholder="Nomor faktur atau invoice supplier"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Tanggal Faktur</Label>
                    <Input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Metode Pembayaran</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Pilih metode pembayaran" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Kredit / Termin</SelectItem>
                        <SelectItem value="cash">Tunai</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                        <SelectItem value="cbd">CBD</SelectItem>
                        <SelectItem value="consignment">Konsinyasi</SelectItem>
                        <SelectItem value="installment">Cicilan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Termin (Hari)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.payment_term_days}
                      onChange={(e) => setFormData({ ...formData, payment_term_days: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Jatuh Tempo</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Catatan</Label>
                <Input
                  placeholder="Catatan tambahan (opsional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </SectionPanel>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={Package}
              title="Daftar Item"
              actions={
                <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="h-6 px-2 text-[10px]">
                  <Plus className="mr-1 h-3 w-3" />
                  Pilih Item
                </Button>
              }
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col px-2.5 py-2.5 sm:px-3"
            >
              <SelectedItemsTable
                items={selectedItems}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRemoveMultiple={handleRemoveMultiple}
                enableDualUnit={true}
                compactMode={true}
                showPrice={true}
                showBatch={false}
                showExpiry={true}
                enforceStockLimit={false}
                emptyMessage="Klik 'Pilih Item' untuk menambahkan item pembelian"
                className="flex min-h-0 flex-1 flex-col"
                scrollAreaClassName="min-h-0 h-full flex-1"
              />

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 pt-2.5">
                <Button type="button" size="sm" variant="outline" onClick={() => navigate("/purchases")}>
                  Batal
                </Button>
                <Button size="sm" onClick={onSubmit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-4 w-4" />
                  )}
                  {submitting ? "Menyimpan..." : "Buat Pembelian"}
                </Button>
              </div>
            </SectionPanel>
          </div>
        </div>
      </PageContent>

      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Pilih Item Pembelian"
        description="Centang item yang ingin dibeli. Anda dapat mengatur jumlah, batch, dan harga pada tabel di halaman sebelumnya."
        fetchItems={fetchPurchaseItems}
        selectedItems={selectedItems}
        onConfirm={handleItemsConfirm}
        showPrice={false}
        showStock={true}
        enforceStockLimit={false}
        showTabs={true}
        enableDualUnit={false}
      />
    </PageShell>
  );
}
