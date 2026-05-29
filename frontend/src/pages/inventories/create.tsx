import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { inventoriesApi, type InventoryCategory, type InventoryItemGroup, type InventoryItemScope } from "@/lib/api/inventories";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, DollarSign, FileText, Layers, Hash, Box, ArrowLeft } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

function SummaryCue({
  label,
  description,
  tone,
}: {
  label: string;
  description: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br ${tone} px-4 py-3 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{description}</div>
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-4">{children}</div>
    </div>
  );
}

export default function InventoryCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<ComboboxOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<ComboboxOption[]>([]);
  const itemGroupOptions: ComboboxOption[] = [
    { value: "bhp", label: "BHP" },
    { value: "other", label: "Lainnya" },
  ];
  const itemScopeOptions: ComboboxOption[] = [
    { value: "unit", label: "Unit" },
    { value: "pharmacy", label: "Farmasi" },
    { value: "both", label: "Unit & Farmasi" },
  ];

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "" as InventoryCategory | "",
    item_group: "other" as InventoryItemGroup,
    item_scope: "both" as InventoryItemScope,
    unit: "",
    brand: "",
    model: "",
    min_stock: 0,
    max_stock: 100,
    current_stock: 0,
    price: 0,
    is_consumable: false,
    is_reusable: true,
    require_serial: false,
    is_active: true,
    specifications: "",
    notes: "",
  });

  useEffect(() => {
    setPageTitle("Tambah Inventaris");
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [categoriesRes, unitsRes] = await Promise.all([
        inventoriesApi.getCategories(),
        inventoriesApi.getUnits(),
      ]);

      setCategoryOptions(
        (categoriesRes.data.data || []).map((item: { code: string; name: string }) => ({
          value: item.code,
          label: item.name,
        }))
      );

      setUnitOptions(
        (unitsRes.data.data || []).map((item: { code: string; name: string }) => ({
          value: item.code,
          label: item.name,
        }))
      );
    } catch (error) {
      console.error("Failed to load master data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kategori harus dipilih.",
      });
      return;
    }

    setLoading(true);

    try {
      await inventoriesApi.create({
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category as InventoryCategory,
        item_group: formData.item_group,
        item_scope: formData.item_scope,
        unit: formData.unit,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock,
        current_stock: formData.current_stock,
        price: formData.price,
        is_consumable: formData.is_consumable,
        is_reusable: formData.is_reusable,
        require_serial: formData.require_serial,
        is_active: formData.is_active,
        specifications: formData.specifications || undefined,
        notes: formData.notes || undefined,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Inventaris berhasil ditambahkan.",
      });
      navigate("/inventories");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan inventaris.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Tambah Inventaris"
        description="Buat master inventaris baru dengan identitas, stok, dan properti operasional yang lengkap agar siap dipakai untuk tracking item dan transaksi."
        icon={Package}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/inventories")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="inventory-create-form" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Inventaris
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Kode inventaris otomatis</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Stok awal bisa diisi</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Properti item fleksibel</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <SummaryCue label="Identitas" description="Kode inventaris dibuat sistem, lalu isi nama inventaris, kategori, dan satuan." tone="from-background via-background to-sky-50/40" />
          <SummaryCue label="Kontrol Stok" description="Isi stok awal dan batas stok agar monitoring inventaris langsung aktif." tone="from-background via-background to-emerald-50/40" />
          <SummaryCue label="Properti Item" description="Tentukan apakah inventaris habis pakai, reusable, dan perlu serial number." tone="from-background via-background to-amber-50/50" />
        </div>

        <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <form id="inventory-create-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <SectionPanel icon={Package} title="Informasi Dasar" description="Identitas inventaris, klasifikasi, satuan, dan detail produk utama.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Kode Inventaris</Label>
                  <Input value="Otomatis dibuat sistem saat simpan" disabled className="h-9 text-sm bg-muted" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    Nama Inventaris *
                  </Label>
                  <Input
                    id="name"
                    required
                    placeholder="Contoh: Stetoskop Digital"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    Kategori *
                  </Label>
                  <Combobox
                    options={categoryOptions}
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value as InventoryCategory })
                    }
                    placeholder="Pilih kategori"
                    searchPlaceholder="Cari kategori..."
                    emptyText="Kategori tidak ditemukan"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="unit"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    Satuan *
                  </Label>
                  <Combobox
                    options={unitOptions}
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                    placeholder="Pilih satuan..."
                    searchPlaceholder="Cari satuan..."
                    emptyText="Satuan tidak ditemukan"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="price"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    Harga Satuan (Rp)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Kelompok Barang</Label>
                  <Combobox
                    options={itemGroupOptions}
                    value={formData.item_group}
                    onValueChange={(value) =>
                      setFormData({ ...formData, item_group: value as InventoryItemGroup })
                    }
                    placeholder="Pilih kelompok"
                    searchPlaceholder="Cari kelompok..."
                    emptyText="Kelompok tidak ditemukan"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Pengelola Barang</Label>
                  <Combobox
                    options={itemScopeOptions}
                    value={formData.item_scope}
                    onValueChange={(value) =>
                      setFormData({ ...formData, item_scope: value as InventoryItemScope })
                    }
                    placeholder="Pilih pengelola"
                    searchPlaceholder="Cari pengelola..."
                    emptyText="Pengelola tidak ditemukan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="brand"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    Merek
                  </Label>
                  <Input
                    id="brand"
                    placeholder="Contoh: Philips"
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="model"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    Model
                  </Label>
                  <Input
                    id="model"
                    placeholder="Contoh: HD-200"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
          </SectionPanel>

          {/* Stock Info */}
          <SectionPanel icon={Hash} title="Informasi Stok" description="Stok awal dan ambang minimum-maksimum untuk monitoring inventaris.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="current_stock"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    Stok Awal
                  </Label>
                  <Input
                    id="current_stock"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.current_stock || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="min_stock"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    Stok Minimum
                  </Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.min_stock || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="max_stock"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    Stok Maksimum
                  </Label>
                  <Input
                    id="max_stock"
                    type="number"
                    min={0}
                    placeholder="100"
                    value={formData.max_stock || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, max_stock: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
          </SectionPanel>

          {/* Properties */}
          <SectionPanel icon={Layers} title="Properti" description="Aturan operasional inventaris untuk konsumsi, reuse, serial, dan status aktif.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_consumable" className="text-xs font-medium">
                      Habis Pakai
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Barang sekali pakai
                    </p>
                  </div>
                  <Switch
                    id="is_consumable"
                    checked={formData.is_consumable}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_consumable: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_reusable" className="text-xs font-medium">
                      Dapat Dipakai Ulang
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Barang bisa digunakan berulang
                    </p>
                  </div>
                  <Switch
                    id="is_reusable"
                    checked={formData.is_reusable}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_reusable: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_serial" className="text-xs font-medium">
                      Wajib Serial Number
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Setiap item perlu SN
                    </p>
                  </div>
                  <Switch
                    id="require_serial"
                    checked={formData.require_serial}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, require_serial: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active" className="text-xs font-medium">
                      Aktif
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Status inventaris aktif
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
          </SectionPanel>

          {/* Additional Info */}
          <SectionPanel icon={FileText} title="Informasi Tambahan" description="Deskripsi, spesifikasi teknis, dan catatan pendukung inventaris.">
              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Deskripsi
                </Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi inventaris..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="min-h-[80px] text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="specifications"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  Spesifikasi
                </Label>
                <Textarea
                  id="specifications"
                  placeholder="Spesifikasi teknis inventaris..."
                  value={formData.specifications}
                  onChange={(e) =>
                    setFormData({ ...formData, specifications: e.target.value })
                  }
                  className="min-h-[80px] text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="notes"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  Catatan
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Catatan tambahan..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="min-h-[60px] text-sm"
                />
              </div>
          </SectionPanel>

          {/* Sticky Footer Actions */}
          <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/inventories")}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
        </div>
      </PageContent>
    </PageShell>
  );
}
