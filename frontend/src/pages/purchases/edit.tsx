import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, FileText, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { api } from "@/lib/api/client";
import {
  purchasesApi,
  purchaseStatusLabels,
  type Purchase,
} from "@/lib/api/stock-requests";
import {
  ItemPickerDialog,
  SelectedItemsTable,
  type SelectableItem,
  type SelectedItemWithQty,
} from "@/components/item-picker";

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
  unit_large?: string;
  large_to_small_factor?: number;
  current_stock: number;
  purchase_price: number;
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

export default function PurchaseEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allItems, setAllItems] = useState<SelectableItem[]>([]);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_contact: "",
    invoice_number: "",
    invoice_date: "",
    payment_method: "credit",
    payment_term_days: 0,
    due_date: "",
    notes: "",
  });

  const [items, setItems] = useState<SelectedItemWithQty[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [response, inventoriesRes, medicinesRes] = await Promise.all([
        purchasesApi.getById(Number(id)),
        api.get("/inventories", { params: { limit: 500, is_active: true } }),
        api.get("/medicines", { params: { limit: 500, is_active: true } }),
      ]);
      const data = response.data.data as Purchase;

      // Check if editable (only draft or pending status)
      if (data.status !== "draft" && data.status !== "pending") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Pembelian yang sudah diproses tidak dapat diedit.",
        });
        navigate(`/purchases/${id}`);
        return;
      }

      setPurchase(data);
      setFormData({
        supplier_name: data.supplier_name,
        supplier_contact: data.supplier_contact || "",
        invoice_number: data.invoice_number || "",
        invoice_date: data.invoice_date ? new Date(data.invoice_date).toISOString().split("T")[0] : "",
        payment_method: data.payment_method || "credit",
        payment_term_days: data.payment_term_days || 0,
        due_date: data.due_date ? new Date(data.due_date).toISOString().split("T")[0] : "",
        notes: data.notes || "",
      });

      // Map items
      const inventories: Inventory[] = inventoriesRes.data.data || [];
      const medicines: Medicine[] = medicinesRes.data.data || [];

      const selectableItems: SelectableItem[] = [
        ...inventories.map((inventory) => ({
          id: inventory.id,
          code: inventory.code,
          name: inventory.name,
          unit: inventory.unit,
          type: "inventory" as const,
          current_stock: inventory.current_stock,
          price: inventory.purchase_price || 0,
        })),
        ...medicines.map((medicine) => ({
          id: medicine.id,
          code: medicine.code,
          name: medicine.name,
          unit: medicine.unit,
          unit_large: medicine.unit_large,
          large_to_small_factor: medicine.large_to_small_factor || 1,
          type: "medicine" as const,
          current_stock: medicine.current_stock,
          price: medicine.purchase_price || 0,
        })),
      ];
      setAllItems(selectableItems);

      const editItems: SelectedItemWithQty[] = (data.items || []).map((item) => {
        const itemData = item.inventory || item.medicine;
        return {
          id: item.inventory_id || item.medicine_id || item.id,
          type: item.inventory_id ? "inventory" : "medicine",
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          unit_large: item.unit_large || (itemData as any)?.unit_large || "",
          unit_small: item.unit_small || item.unit || itemData?.unit || "",
          conversion_factor: item.conversion_factor || (itemData as any)?.large_to_small_factor || 1,
          quantity: item.quantity_ordered,
          quantity_large: item.quantity_large_ordered || 0,
          quantity_small: item.quantity_small_ordered || 0,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          tax_percent: item.tax_percent || 0,
          tax_amount: item.tax_amount || 0,
          batch_number: item.batch_number || "",
          expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split("T")[0] : "",
          notes: item.notes || "",
        };
      });
      setItems(editItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data pembelian.",
      });
      navigate("/purchases");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    setPageTitle("Edit Pembelian");
    loadData();
  }, [loadData]);

  const handleItemsConfirm = (selectedItems: SelectedItemWithQty[]) => {
    setItems(
      selectedItems.map((item) => {
        if (item.type !== "medicine") return item;
        const factor = Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1));
        return {
          ...item,
          unit_small: item.unit_small || item.unit,
          conversion_factor: factor,
          quantity_large: item.quantity_large ?? 0,
          quantity_small: item.quantity_small ?? 0,
        };
      })
    );
  };

  const handleUpdateItem = (index: number, updates: Partial<SelectedItemWithQty>) => {
    setItems((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  };

  const handleRemoveItem = (index: number) => {
    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleRemoveMultiple = (indices: number[]) => {
    setItems((previous) => previous.filter((_, itemIndex) => !indices.includes(itemIndex)));
  };

  const handleSubmit = async () => {
    if (!formData.supplier_name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nama supplier harus diisi.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await purchasesApi.update(Number(id), {
        supplier_name: formData.supplier_name,
        supplier_contact: formData.supplier_contact || undefined,
        invoice_number: formData.invoice_number || undefined,
        invoice_date: formData.invoice_date || undefined,
        payment_method: formData.payment_method,
        payment_term_days: formData.payment_term_days,
        due_date: formData.due_date || undefined,
        notes: formData.notes || undefined,
        items: items.map((item) => ({
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
          notes: item.notes || undefined,
        })),
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Pembelian berhasil diperbarui.",
      });
      navigate(`/purchases/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui pembelian.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Edit Pembelian"
          description="Perbarui informasi supplier dan catatan pembelian yang masih bisa diubah."
        />
        <PageContent className="flex-none pb-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Edit Pembelian"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(`/purchases/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 [&_label]:text-[10px] [&_label]:tracking-[0.08em] [&_label]:uppercase [&_label]:text-muted-foreground [&_input]:h-8 lg:grid-cols-[minmax(330px,390px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <SectionPanel
              icon={Building2}
              title="Detail Pembelian"
              className="flex h-full flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col gap-3 px-2.5 py-2.5 sm:px-3"
            >
              <div className="space-y-3 border-b border-border/70 pb-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">No. Pembelian</p>
                    <p className="text-sm font-medium font-mono">{purchase.purchase_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className="mt-0.5">
                      {purchaseStatusLabels[purchase.status] || purchase.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Nama Supplier *</Label>
                  <Input
                    placeholder="Nama supplier..."
                    value={formData.supplier_name}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Kontak Supplier</Label>
                  <Input
                    placeholder="Telepon/email supplier..."
                    value={formData.supplier_contact}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_contact: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 border-b border-border/70 pb-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                  <p className="text-sm text-muted-foreground">Ruangan Tujuan</p>
                  <p className="font-medium">{purchase.to_room?.name}</p>
                  </div>
                  <div>
                  <p className="text-sm text-muted-foreground">Tanggal Pembelian</p>
                  <p className="font-medium">
                    {purchase.order_date ? new Date(purchase.order_date).toLocaleDateString("id-ID") : "-"}
                  </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-b border-border/70 pb-3">
                <div className="space-y-1">
                  <Label>No. Faktur Supplier</Label>
                  <Input
                    placeholder="Nomor faktur atau invoice supplier"
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_number: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Tanggal Faktur</Label>
                    <Input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) =>
                        setFormData({ ...formData, invoice_date: e.target.value })
                      }
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
                      onChange={(e) =>
                        setFormData({ ...formData, payment_term_days: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Jatuh Tempo</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) =>
                        setFormData({ ...formData, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Catatan</Label>
                <Textarea
                  className="min-h-[68px] resize-none"
                  placeholder="Catatan tambahan..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </SectionPanel>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={FileText}
              title="Daftar Item"
              actions={
                <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="h-6 px-2 text-[10px]">
                  <Plus className="mr-1 h-3 w-3" />
                  Kelola Item
                </Button>
              }
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
            >
              <SelectedItemsTable
                items={items}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRemoveMultiple={handleRemoveMultiple}
                enableDualUnit={true}
                compactMode={true}
                showPrice={true}
                showBatch={true}
                showExpiry={true}
                emptyMessage="Klik 'Kelola Item' untuk menambahkan atau mengubah item pembelian"
                className="flex min-h-0 flex-1 flex-col"
                scrollAreaClassName="min-h-0 flex-1"
              />

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-2.5 py-2.5 sm:px-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/purchases/${id}`)}
                >
                  Batal
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </SectionPanel>
          </div>
        </div>
      </PageContent>

      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Rincian Item Pembelian"
        description="Kelola item, batch, diskon, PPN, dan total harga dalam satu tabel besar yang bisa diedit penuh."
        items={allItems}
        selectedItems={items}
        onConfirm={handleItemsConfirm}
        showPrice={true}
        showStock={true}
        showTabs={true}
        enableDualUnit={true}
      />
    </PageShell>
  );
}
