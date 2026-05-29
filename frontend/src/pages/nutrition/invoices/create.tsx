import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { nutritionIngredientApi, nutritionIngredientInvoiceApi, nutritionIngredientUnitLabels, type NutritionIngredient } from "@/lib/api/nutrition";
import { setPageTitle } from "@/lib/page-title";
import { NutritionSectionPanel } from "../shared-page-chrome";

type InvoiceItemForm = {
  ingredient_id: number;
  quantity: number;
  unit: string;
  unit_price: number;
  notes: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

const todayDate = () => new Date().toISOString().slice(0, 10);

export default function NutritionInvoiceCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [ingredientsMaster, setIngredientsMaster] = useState<NutritionIngredient[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([{ ingredient_id: 0, quantity: 0, unit: "kemasan", unit_price: 0, notes: "" }]);

  const [formData, setFormData] = useState({
    invoice_number: "",
    invoice_date: todayDate(),
    supplier_name: "",
    notes: "",
  });

  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [targetRowIndex, setTargetRowIndex] = useState<number | null>(null);
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    category: "",
    default_unit: "gram",
    default_weight: 0,
    is_active: true,
    notes: "",
  });

  const ingredientOptions: ComboboxOption[] = ingredientsMaster.map((item) => ({
    value: String(item.id),
    label: `${item.name} (${item.code})`,
  }));
  const unitOptions: ComboboxOption[] = Object.entries(nutritionIngredientUnitLabels).map(([value, label]) => ({ value, label }));

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0) * Math.max(0, item.unit_price || 0), 0),
    [items]
  );

  useEffect(() => {
    setPageTitle("Input Faktur Bahan Gizi");
    loadIngredientMaster();
  }, []);

  const loadIngredientMaster = async () => {
    setLoadingIngredients(true);
    try {
      const res = await nutritionIngredientApi.getAll({ limit: 500, is_active: "true" });
      setIngredientsMaster(res.data.data || []);
    } catch {
      setIngredientsMaster([]);
    } finally {
      setLoadingIngredients(false);
    }
  };

  const addRow = () => {
    setItems((prev) => [...prev, { ingredient_id: 0, quantity: 0, unit: "kemasan", unit_price: 0, notes: "" }]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<InvoiceItemForm>) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const openCreateIngredientModal = (rowIndex: number) => {
    setTargetRowIndex(rowIndex);
    setIngredientModalOpen(true);
  };

  const handleCreateIngredient = async () => {
    if (!ingredientForm.name.trim()) {
      toast({ variant: "destructive", title: "Error!", description: "Nama bahan wajib diisi." });
      return;
    }
    setIngredientSaving(true);
    try {
      const res = await nutritionIngredientApi.create(ingredientForm);
      const created: NutritionIngredient = res.data.data;
      await loadIngredientMaster();
      if (targetRowIndex !== null) {
        updateRow(targetRowIndex, {
          ingredient_id: created.id,
          unit: "kemasan",
        });
      }
      toast({ variant: "success", title: "Berhasil!", description: "Master bahan baru berhasil ditambahkan." });
      setIngredientModalOpen(false);
      setIngredientForm({
        name: "",
        category: "",
        default_unit: "gram",
        default_weight: 0,
        is_active: true,
        notes: "",
      });
      setTargetRowIndex(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan master bahan.",
      });
    } finally {
      setIngredientSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoice_number.trim()) {
      toast({ variant: "destructive", title: "Error!", description: "Nomor faktur wajib diisi." });
      return;
    }

    const payloadItems = items
      .filter((row) => row.ingredient_id > 0)
      .map((row) => ({
        ingredient_id: row.ingredient_id,
        quantity: row.quantity || 0,
        unit: row.unit || "kemasan",
        unit_price: row.unit_price || 0,
        notes: row.notes || "",
      }));

    if (payloadItems.length === 0) {
      toast({ variant: "destructive", title: "Error!", description: "Tambahkan minimal 1 bahan." });
      return;
    }
    if (payloadItems.some((row) => row.quantity <= 0)) {
      toast({ variant: "destructive", title: "Error!", description: "Jumlah bahan harus lebih dari 0." });
      return;
    }

    setLoading(true);
    try {
      await nutritionIngredientInvoiceApi.create({
        ...formData,
        invoice_number: formData.invoice_number.trim(),
        supplier_name: formData.supplier_name.trim(),
        notes: formData.notes.trim(),
        items: payloadItems,
      });
      toast({ variant: "success", title: "Berhasil!", description: "Faktur bahan gizi berhasil disimpan." });
      navigate("/nutrition/invoices");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan faktur bahan gizi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Input Faktur Bahan Gizi"
        description="Catat faktur pembelian bahan gizi untuk kebutuhan laporan pemakaian dan administrasi pembelian unit."
        icon={ReceiptText}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/invoices")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="nutrition-invoice-create-form" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Faktur
            </Button>
          </div>
        )}
      />

      <PageContent className="flex-none pb-8">
        <form id="nutrition-invoice-create-form" onSubmit={handleSubmit} className="space-y-6">
          <NutritionSectionPanel title="Informasi Faktur" description="Isi nomor faktur, tanggal, supplier, dan catatan faktur.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kode Internal</Label>
                <Input value="Otomatis dibuat sistem saat simpan" disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Nomor Faktur *</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="Contoh: INV/KS/05/2026/001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Tanggal Faktur *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, invoice_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_name">Supplier</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplier_name: e.target.value }))}
                  placeholder="Nama supplier (opsional)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>
          </NutritionSectionPanel>

          <NutritionSectionPanel title="Daftar Bahan Faktur" description="Pilih bahan dari master bahan dan isi jumlah serta harga per item.">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Tanpa pengaruh stok, hanya pencatatan faktur bahan.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="h-4 w-4" />
                  Tambah Baris
                </Button>
              </div>
            </div>

            {loadingIngredients ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat master bahan...
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left">
                        <th className="px-2 py-2 text-xs font-semibold">Bahan</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[110px]">Qty Kemasan</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[140px]">Berat/Kemasan</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[130px]">Total Berat</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[130px]">Harga/Kemasan</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[130px]">Subtotal</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[180px]">Catatan</th>
                        <th className="px-2 py-2 text-xs font-semibold w-[56px] text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, index) => {
                        const selectedIngredient = ingredientsMaster.find((item) => item.id === row.ingredient_id);
                        const subtotal = (row.quantity || 0) * (row.unit_price || 0);

                        return (
                          <tr key={`invoice-item-${index}`} className="border-b align-top">
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <Combobox
                                    options={ingredientOptions}
                                    value={row.ingredient_id ? String(row.ingredient_id) : ""}
                                    onValueChange={(value) => {
                                      const ingredientID = Number(value);
                                      updateRow(index, { ingredient_id: ingredientID });
                                    }}
                                    placeholder="Pilih bahan..."
                                  />
                                </div>
                                <Button type="button" variant="outline" size="icon" onClick={() => openCreateIngredientModal(index)} title="Tambah master bahan">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.quantity || ""}
                                onChange={(e) => updateRow(index, { quantity: parseFloat(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                value={`${selectedIngredient?.default_weight || 0} ${nutritionIngredientUnitLabels[selectedIngredient?.default_unit || "gram"] || selectedIngredient?.default_unit || "gram"}`}
                                disabled
                                className="bg-muted text-xs"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                value={`${(row.quantity || 0) * (selectedIngredient?.default_weight || 0)} ${nutritionIngredientUnitLabels[selectedIngredient?.default_unit || "gram"] || selectedIngredient?.default_unit || "gram"}`}
                                disabled
                                className="bg-muted text-xs"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min="0"
                                value={row.unit_price || ""}
                                onChange={(e) => updateRow(index, { unit_price: parseFloat(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input value={formatCurrency(subtotal)} disabled className="bg-muted text-xs" />
                            </td>
                            <td className="px-2 py-2">
                              <Input value={row.notes} onChange={(e) => updateRow(index, { notes: e.target.value })} placeholder="Opsional" />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(index)} disabled={items.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Faktur</span>
                <span className="text-base font-semibold">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </NutritionSectionPanel>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/nutrition/invoices")}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Faktur
            </Button>
          </div>
        </form>
      </PageContent>

      <Dialog open={ingredientModalOpen} onOpenChange={setIngredientModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah Master Bahan</DialogTitle>
            <DialogDescription>Buat master bahan baru langsung dari form faktur, lalu pilih otomatis ke baris aktif.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kode Bahan</Label>
                <Input value="Otomatis dibuat sistem saat simpan" disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Nama Bahan *</Label>
                <Input value={ingredientForm.name} onChange={(e) => setIngredientForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Contoh: Beras" />
              </div>
              <div className="space-y-2">
                <Label>Kategori Bahan</Label>
                <Input value={ingredientForm.category} onChange={(e) => setIngredientForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Contoh: Karbohidrat" />
              </div>
              <div className="space-y-2">
                <Label>Satuan Default</Label>
                <Combobox
                  options={unitOptions}
                  value={ingredientForm.default_unit}
                  onValueChange={(value) => setIngredientForm((prev) => ({ ...prev, default_unit: value }))}
                  placeholder="Pilih satuan..."
                />
              </div>
              <div className="space-y-2">
                <Label>Berat/Isi Default</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredientForm.default_weight || ""}
                  onChange={(e) => setIngredientForm((prev) => ({ ...prev, default_weight: parseFloat(e.target.value) || 0 }))}
                  placeholder="Contoh: 500"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={ingredientForm.is_active}
                  onCheckedChange={(checked) => setIngredientForm((prev) => ({ ...prev, is_active: checked }))}
                />
                <Label>Bahan Aktif</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={ingredientForm.notes} onChange={(e) => setIngredientForm((prev) => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Catatan tambahan..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIngredientModalOpen(false);
                  setTargetRowIndex(null);
                }}
              >
                Batal
              </Button>
              <Button type="button" onClick={handleCreateIngredient} disabled={ingredientSaving}>
                {ingredientSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Bahan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
