import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { nutritionMenuApi, nutritionCategoryLabels, nutritionDietTypeLabels } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, UtensilsCrossed, Tag, DollarSign, FileText, Flame, Beef, Droplets, Wheat } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function NutritionMenuEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const categoryOptions: ComboboxOption[] = Object.entries(nutritionCategoryLabels).map(([value, label]) => ({ value, label }));
  const dietTypeOptions: ComboboxOption[] = Object.entries(nutritionDietTypeLabels).map(([value, label]) => ({ value, label }));

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    diet_types: [] as string[],
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
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    try {
      const res = await nutritionMenuApi.getById(Number(id));
      const menu = res.data.data;
      let dietTypes: string[] = [];
      if (menu.diet_types) {
        try { dietTypes = JSON.parse(menu.diet_types); } catch { dietTypes = []; }
      }
      setFormData({
        code: menu.code || "",
        name: menu.name || "",
        description: menu.description || "",
        category: menu.category || "",
        diet_types: dietTypes,
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
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data menu." });
      navigate("/nutrition/menus");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      toast({ variant: "destructive", title: "Error!", description: "Nama dan kategori wajib diisi." });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        diet_types: formData.diet_types.length > 0 ? JSON.stringify(formData.diet_types) : "",
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
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Edit Menu Makanan</h1>
          <p className="text-sm text-muted-foreground">Ubah data menu: {formData.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-medium flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" /> Informasi Menu</h3>
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
            <Label>Jenis Diet yang Cocok</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {dietTypeOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.diet_types.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, diet_types: [...formData.diet_types, opt.value] });
                      } else {
                        setFormData({ ...formData, diet_types: formData.diet_types.filter((d) => d !== opt.value) });
                      }
                    }}
                    className="rounded"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description"><FileText className="inline h-3 w-3 mr-1" />Deskripsi</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
          </div>
        </div>

        {/* Nutritional Info */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-medium flex items-center gap-2"><Flame className="h-4 w-4" /> Informasi Gizi (per porsi)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label><Flame className="inline h-3 w-3 mr-1" />Kalori (kkal)</Label>
              <Input type="number" step="0.01" min="0" value={formData.calories || ""} onChange={(e) => setFormData({ ...formData, calories: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Beef className="inline h-3 w-3 mr-1" />Protein (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.protein || ""} onChange={(e) => setFormData({ ...formData, protein: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Droplets className="inline h-3 w-3 mr-1" />Lemak (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.fat || ""} onChange={(e) => setFormData({ ...formData, fat: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label><Wheat className="inline h-3 w-3 mr-1" />Karbohidrat (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.carbohydrate || ""} onChange={(e) => setFormData({ ...formData, carbohydrate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Serat (g)</Label>
              <Input type="number" step="0.01" min="0" value={formData.fiber || ""} onChange={(e) => setFormData({ ...formData, fiber: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Natrium (mg)</Label>
              <Input type="number" step="0.01" min="0" value={formData.sodium || ""} onChange={(e) => setFormData({ ...formData, sodium: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        {/* Price & Status */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> Harga & Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Harga per Porsi</Label>
              <Input type="number" min="0" value={formData.unit_price || ""} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
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
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/nutrition/menus")}>Batal</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}
