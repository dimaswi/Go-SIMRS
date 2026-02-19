import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { medicinesApi, type MedicineCategory, type MedicineType, type MedicineForm } from "@/lib/api/medicines";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pill, Tag, DollarSign, FileText, Layers, Hash, Box, Beaker, AlertTriangle, Info } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function MedicineCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<ComboboxOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<ComboboxOption[]>([]);
  const [formOptions, setFormOptions] = useState<ComboboxOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<ComboboxOption[]>([]);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    generic_name: "",
    description: "",
    category: "" as MedicineCategory | "",
    type: "otc" as MedicineType,
    form: "" as MedicineForm | "",
    strength: "",
    unit: "",
    manufacturer: "",
    min_stock: 0,
    max_stock: 100,
    current_stock: 0,
    purchase_price: 0,
    selling_price: 0,
    indication: "",
    contraindication: "",
    side_effects: "",
    dosage: "",
    interaction: "",
    storage_info: "",
    is_active: true,
    require_recipe: false,
    notes: "",
  });

  useEffect(() => {
    setPageTitle("Tambah Obat");
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [categoriesRes, typesRes, formsRes, unitsRes] = await Promise.all([
        medicinesApi.getCategories(),
        medicinesApi.getTypes(),
        medicinesApi.getForms(),
        medicinesApi.getUnits(),
      ]);
      
      setCategoryOptions(
        (categoriesRes.data.data || []).map((item: { value: string; label: string }) => ({
          value: item.value,
          label: item.label,
        }))
      );
      
      setTypeOptions(
        (typesRes.data.data || []).map((item: { value: string; label: string }) => ({
          value: item.value,
          label: item.label,
        }))
      );
      
      setFormOptions(
        (formsRes.data.data || []).map((item: { value: string; label: string }) => ({
          value: item.value,
          label: item.label,
        }))
      );
      
      setUnitOptions(
        (unitsRes.data.data || []).map((item: { value: string; label: string }) => ({
          value: item.value,
          label: item.label,
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

    if (!formData.form) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Bentuk sediaan harus dipilih.",
      });
      return;
    }

    setLoading(true);

    try {
      await medicinesApi.create({
        code: formData.code,
        name: formData.name,
        generic_name: formData.generic_name || undefined,
        description: formData.description || undefined,
        category: formData.category as MedicineCategory,
        type: formData.type,
        form: formData.form as MedicineForm,
        strength: formData.strength || undefined,
        unit: formData.unit,
        manufacturer: formData.manufacturer || undefined,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock,
        purchase_price: formData.purchase_price,
        selling_price: formData.selling_price,
        indication: formData.indication || undefined,
        contraindication: formData.contraindication || undefined,
        side_effects: formData.side_effects || undefined,
        dosage: formData.dosage || undefined,
        interaction: formData.interaction || undefined,
        storage_info: formData.storage_info || undefined,
        is_active: formData.is_active,
        require_recipe: formData.require_recipe,
        notes: formData.notes || undefined,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Obat berhasil ditambahkan.",
      });
      navigate("/medicines");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan obat.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/medicines")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Tambah Obat</h1>
          <p className="text-sm text-muted-foreground">Masukkan detail informasi obat baru</p>
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
                      Kode Obat *
                    </Label>
                    <Input
                      id="code"
                      required
                      placeholder="Contoh: MED-001"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                      Nama Obat *
                    </Label>
                    <Input
                      id="name"
                      required
                      placeholder="Contoh: Paracetamol 500mg"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="generic_name"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Nama Generik
                    </Label>
                    <Input
                      id="generic_name"
                      placeholder="Contoh: Paracetamol"
                      value={formData.generic_name}
                      onChange={(e) =>
                        setFormData({ ...formData, generic_name: e.target.value })
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
                        setFormData({ ...formData, category: value as MedicineCategory })
                      }
                      placeholder="Pilih kategori"
                      searchPlaceholder="Cari kategori..."
                      emptyText="Kategori tidak ditemukan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      Golongan Obat *
                    </Label>
                    <Combobox
                      options={typeOptions}
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as MedicineType })
                      }
                      placeholder="Pilih golongan"
                      searchPlaceholder="Cari golongan..."
                      emptyText="Golongan tidak ditemukan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Beaker className="h-3.5 w-3.5 text-muted-foreground" />
                      Bentuk Sediaan *
                    </Label>
                    <Combobox
                      options={formOptions}
                      value={formData.form}
                      onValueChange={(value) =>
                        setFormData({ ...formData, form: value as MedicineForm })
                      }
                      placeholder="Pilih bentuk"
                      searchPlaceholder="Cari bentuk..."
                      emptyText="Bentuk tidak ditemukan"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="strength"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Kekuatan/Dosis
                    </Label>
                    <Input
                      id="strength"
                      placeholder="Contoh: 500mg, 10ml"
                      value={formData.strength}
                      onChange={(e) =>
                        setFormData({ ...formData, strength: e.target.value })
                      }
                      className="h-9 text-sm"
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
                      htmlFor="manufacturer"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Produsen
                    </Label>
                    <Input
                      id="manufacturer"
                      placeholder="Contoh: PT Kimia Farma"
                      value={formData.manufacturer}
                      onChange={(e) =>
                        setFormData({ ...formData, manufacturer: e.target.value })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Price & Stock Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Harga & Stok</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="purchase_price"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Harga Beli (HNA)
                    </Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={formData.purchase_price || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, purchase_price: parseInt(e.target.value) || 0 })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="selling_price"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Harga Jual (HET)
                    </Label>
                    <Input
                      id="selling_price"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={formData.selling_price || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, selling_price: parseInt(e.target.value) || 0 })
                      }
                      className="h-9 text-sm"
                    />
                  </div>
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
              </div>

              {/* Medical Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Informasi Medis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="indication"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      Indikasi
                    </Label>
                    <Textarea
                      id="indication"
                      placeholder="Indikasi penggunaan obat..."
                      value={formData.indication}
                      onChange={(e) =>
                        setFormData({ ...formData, indication: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="contraindication"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      Kontraindikasi
                    </Label>
                    <Textarea
                      id="contraindication"
                      placeholder="Kondisi di mana obat tidak boleh digunakan..."
                      value={formData.contraindication}
                      onChange={(e) =>
                        setFormData({ ...formData, contraindication: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="dosage"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Dosis
                    </Label>
                    <Textarea
                      id="dosage"
                      placeholder="Petunjuk dosis penggunaan..."
                      value={formData.dosage}
                      onChange={(e) =>
                        setFormData({ ...formData, dosage: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="side_effects"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Efek Samping
                    </Label>
                    <Textarea
                      id="side_effects"
                      placeholder="Efek samping yang mungkin terjadi..."
                      value={formData.side_effects}
                      onChange={(e) =>
                        setFormData({ ...formData, side_effects: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="interaction"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Interaksi Obat
                    </Label>
                    <Textarea
                      id="interaction"
                      placeholder="Interaksi dengan obat lain..."
                      value={formData.interaction}
                      onChange={(e) =>
                        setFormData({ ...formData, interaction: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="storage_info"
                      className="text-xs font-medium flex items-center gap-2"
                    >
                      Penyimpanan
                    </Label>
                    <Textarea
                      id="storage_info"
                      placeholder="Cara penyimpanan obat..."
                      value={formData.storage_info}
                      onChange={(e) =>
                        setFormData({ ...formData, storage_info: e.target.value })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Properties */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Properti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="require_recipe" className="text-xs font-medium">
                        Butuh Resep Dokter
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Obat hanya bisa diberikan dengan resep
                      </p>
                    </div>
                    <Switch
                      id="require_recipe"
                      checked={formData.require_recipe}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, require_recipe: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_active" className="text-xs font-medium">
                        Aktif
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Status obat aktif/tersedia
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
                    placeholder="Deskripsi obat..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
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
                  onClick={() => navigate("/medicines")}
                  size="sm"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading} size="sm">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
      </div>
    </div>
  );
}
