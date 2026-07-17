import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { nutritionMenuApi, nutritionIngredientApi, nutritionCategoryLabels, nutritionIngredientUnitLabels, type NutritionIngredient } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, UtensilsCrossed, Tag, DollarSign, FileText, Flame, Beef, Droplets, Wheat, Plus, Trash2 } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel, NutritionSummaryCue } from "../shared-page-chrome";

interface MenuIngredientInput {
  ingredient_id: number;
  weight_per_portion: number;
  unit: string;
  notes: string;
}

export default function NutritionMenuEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [ingredientsMaster, setIngredientsMaster] = useState<NutritionIngredient[]>([]);
  const [ingredients, setIngredients] = useState<MenuIngredientInput[]>([]);

  const categoryOptions: ComboboxOption[] = Object.entries(nutritionCategoryLabels).map(([value, label]) => ({ value, label }));
  const ingredientOptions: ComboboxOption[] = ingredientsMaster.map((item) => ({ value: String(item.id), label: `${item.name} (${item.code})` }));
  const unitOptions: ComboboxOption[] = Object.entries(nutritionIngredientUnitLabels).map(([value, label]) => ({ value, label }));

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrate: 0,
    fiber: 0,
    sodium: 0,
    serving_size: "",
    unit_price: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    setPageTitle("Edit Menu Makanan");
    loadIngredientMaster();
    loadMenu();
  }, [id]);

  const loadIngredientMaster = async () => {
    try {
      const res = await nutritionIngredientApi.getAll({ limit: 500, is_active: "true" });
      setIngredientsMaster(res.data.data || []);
    } catch {
      setIngredientsMaster([]);
    }
  };

  const loadMenu = async () => {
    try {
      const res = await nutritionMenuApi.getById(Number(id));
      const menu = res.data.data;
      setFormData({
        code: menu.code || "",
        name: menu.name || "",
        description: menu.description || "",
        category: menu.category || "",
        calories: menu.calories || 0,
        protein: menu.protein || 0,
        fat: menu.fat || 0,
        carbohydrate: menu.carbohydrate || 0,
        fiber: menu.fiber || 0,
        sodium: menu.sodium || 0,
        serving_size: menu.serving_size || "",
        unit_price: menu.unit_price || 0,
        is_active: menu.is_active ?? true,
        notes: menu.notes || "",
      });
      const ingredientRows = (menu.ingredients || []).map((item: any) => ({
        ingredient_id: item.ingredient_id || 0,
        weight_per_portion: item.weight_per_portion || 0,
        unit: item.unit || item.ingredient?.default_unit || "gram",
        notes: item.notes || "",
      }));
      setIngredients(ingredientRows);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data menu." });
      navigate("/nutrition/menus");
    } finally {
      setLoadingData(false);
    }
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { ingredient_id: 0, weight_per_portion: 0, unit: "gram", notes: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, patch: Partial<MenuIngredientInput>) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      toast({ variant: "destructive", title: "Error!", description: "Nama dan kategori wajib diisi." });
      return;
    }
    setLoading(true);
    try {
      const filteredIngredients = ingredients
        .filter((item) => item.ingredient_id > 0)
        .map((item) => ({
          ingredient_id: item.ingredient_id,
          weight_per_portion: item.weight_per_portion || 0,
          unit: item.unit || "gram",
          notes: item.notes || "",
        }));

      const payload = {
        ...formData,
        diet_types: "",
        ingredients: filteredIngredients,
      };
      await nutritionMenuApi.update(Number(id), payload);
      toast({ variant: "success", title: "Berhasil!", description: "Menu makanan berhasil diperbarui." });
      navigate("/nutrition/menus");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengubah menu makanan.",
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
    <PageShell>
      <PageHeader
        title="Edit Menu Makanan"
        description={`Perbarui menu gizi ${formData.name || ""} agar identitas dan nilai gizinya tetap sinkron dengan operasional layanan.`}
        icon={UtensilsCrossed}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/menus")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="nutrition-menu-edit-form" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Kode menu read only</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Komposisi bahan tetap terhubung</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status operasional menu</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <NutritionSummaryCue label="Menu Aktif" description="Pastikan nama, kategori, dan ukuran porsi tetap sesuai dengan menu yang disajikan." tone="from-background via-background to-emerald-50/50" />
          <NutritionSummaryCue label="Bahan dan Gizi" description="Perubahan komposisi bahan dan nutrisi akan memengaruhi paket makanan serta order gizi terkait." tone="from-background via-background to-sky-50/40" />
          <NutritionSummaryCue label="Harga dan Status" description="Jaga harga porsi dan status aktif agar daftar menu yang dipilih petugas tetap relevan." tone="from-background via-background to-amber-50/50" />
        </div>

        <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
      <form id="nutrition-menu-edit-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <NutritionSectionPanel icon={UtensilsCrossed} title="Informasi Menu" description="Perbarui identitas menu, kategori layanan, dan ukuran porsi.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code"><Tag className="inline h-3 w-3 mr-1" />Kode Menu</Label>
              <Input id="code" value={formData.code} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama Menu *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Combobox options={categoryOptions} value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })} placeholder="Pilih kategori..." />
            </div>
            <div className="space-y-2">
              <Label>Ukuran Porsi</Label>
              <Input value={formData.serving_size} onChange={(e) => setFormData({ ...formData, serving_size: e.target.value })} placeholder="Contoh: 1 porsi, 200ml" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description"><FileText className="inline h-3 w-3 mr-1" />Deskripsi</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
          </div>
        </NutritionSectionPanel>

        {/* Nutritional Info */}
        <NutritionSectionPanel icon={Flame} title="Informasi Gizi" description="Sesuaikan nilai gizi per porsi agar kalkulasi total nutrisi pada paket tetap akurat.">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label><Flame className="inline h-3 w-3 mr-1" />Kalori (kkal)</Label>
              <Input type="number" step="0.01" min="0" value={formData.calories ?? ""} onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Beef className="inline h-3 w-3 mr-1" />Protein (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.protein ?? ""} onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Droplets className="inline h-3 w-3 mr-1" />Lemak (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.fat ?? ""} onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Wheat className="inline h-3 w-3 mr-1" />Karbohidrat (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.carbohydrate ?? ""} onChange={(e) => setFormData({ ...formData, carbohydrate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Serat (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.fiber ?? ""} onChange={(e) => setFormData({ ...formData, fiber: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Natrium (mg)</Label>
              <Input type="number" step="0.01" min="0" value={formData.sodium ?? ""} onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </NutritionSectionPanel>

        <NutritionSectionPanel icon={Plus} title="Komposisi Bahan per Porsi" description="Kelola bahan baku yang digunakan untuk 1 porsi menu.">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Komposisi ini digunakan untuk perhitungan total pemakaian bahan pada laporan.</p>
            <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
              <Plus className="h-4 w-4" />
              Tambah Bahan
            </Button>
          </div>

          {ingredients.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Belum ada bahan pada menu ini.
            </div>
          ) : (
            <div className="space-y-2">
              {ingredients.map((item, idx) => {
                const selected = ingredientsMaster.find((ing) => ing.id === item.ingredient_id);
                return (
                  <div key={`${idx}-${item.ingredient_id}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <Label className="text-xs">Bahan</Label>
                      <Combobox
                        options={ingredientOptions}
                        value={item.ingredient_id ? String(item.ingredient_id) : ""}
                        onValueChange={(value) => {
                          const ingredientId = Number(value);
                          const selectedIngredient = ingredientsMaster.find((ing) => ing.id === ingredientId);
                          updateIngredient(idx, {
                            ingredient_id: ingredientId,
                            unit: selectedIngredient?.default_unit || item.unit || "gram",
                          });
                        }}
                        placeholder="Pilih bahan..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Berat/Jumlah</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.weight_per_portion || ""}
                        onChange={(e) => updateIngredient(idx, { weight_per_portion: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Satuan</Label>
                      <Combobox options={unitOptions} value={item.unit} onValueChange={(value) => updateIngredient(idx, { unit: value })} placeholder="Satuan..." />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Catatan</Label>
                      <Input value={item.notes} onChange={(e) => updateIngredient(idx, { notes: e.target.value })} placeholder={selected ? `Default ${selected.default_unit}` : "Opsional"} />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeIngredient(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </NutritionSectionPanel>

        {/* Price & Status */}
        <NutritionSectionPanel icon={DollarSign} title="Harga dan Status" description="Kelola harga per porsi, status aktif, dan catatan internal menu gizi.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Harga per Porsi</Label>
              <Input type="number" min="0" value={formData.unit_price ?? ""} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              <Label>Menu Aktif</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
          </div>
        </NutritionSectionPanel>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/nutrition/menus")}>Batal</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
      </PageContent>
    </PageShell>
  );
}
