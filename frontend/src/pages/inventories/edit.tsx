import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { inventoriesApi, type Inventory, type InventoryCategory } from "@/lib/api/inventories";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Package, Tag, DollarSign, FileText, Layers, Hash, Box } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function InventoryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<ComboboxOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<ComboboxOption[]>([]);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "" as InventoryCategory | "",
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
    setPageTitle("Edit Inventaris");
    loadMasterData();
    loadData();
  }, [id]);

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

  const loadData = async () => {
    try {
      const response = await inventoriesApi.getById(Number(id));
      const inventory: Inventory = response.data.data;
      
      setFormData({
        code: inventory.code,
        name: inventory.name,
        description: inventory.description || "",
        category: inventory.category,
        unit: inventory.unit,
        brand: inventory.brand || "",
        model: inventory.model || "",
        min_stock: inventory.min_stock,
        max_stock: inventory.max_stock,
        current_stock: inventory.current_stock,
        price: inventory.price,
        is_consumable: inventory.is_consumable,
        is_reusable: inventory.is_reusable,
        require_serial: inventory.require_serial,
        is_active: inventory.is_active,
        specifications: inventory.specifications || "",
        notes: inventory.notes || "",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data inventaris.",
      });
      navigate("/inventories");
    } finally {
      setLoadingData(false);
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
      await inventoriesApi.update(Number(id), {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category as InventoryCategory,
        unit: formData.unit,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock,
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
        description: "Inventaris berhasil diperbarui.",
      });
      navigate("/inventories");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui inventaris.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
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
          variant="outline"
          size="icon"
          onClick={() => navigate("/inventories")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Edit Inventaris</h1>
          <p className="text-sm text-muted-foreground">Perbarui informasi inventaris</p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Informasi Dasar</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="code"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      Kode Inventaris *
                    </Label>
                    <Input
                      id="code"
                      required
                      placeholder="Contoh: INV-001"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      className="h-9 text-sm"
                    />
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
              </div>

              {/* Stock Info - Read Only for current_stock */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Informasi Stok</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="current_stock"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      Stok Saat Ini
                    </Label>
                    <Input
                      id="current_stock"
                      type="number"
                      disabled
                      value={formData.current_stock}
                      className="h-9 text-sm bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stok diubah melalui transaksi
                    </p>
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
              </div>

              {/* Properties */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Properti</h3>
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
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Informasi Tambahan</h3>
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
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/inventories")}
                  size="sm"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading} size="sm">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
      </div>
    </div>
  );
}
