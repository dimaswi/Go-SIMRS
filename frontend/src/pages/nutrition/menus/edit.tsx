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
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel, NutritionSummaryCue } from "../shared-page-chrome";

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
    <PageShell>
      <PageHeader
        title="Edit Menu Makanan"
        description={`Perbarui menu gizi ${formData.name || ""} agar identitas, kecocokan diet, dan nilai gizinya tetap sinkron dengan operasional layanan.`}
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
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Diet cocok tetap multi-pilih</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status operasional menu</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <NutritionSummaryCue label="Menu Aktif" description="Pastikan nama, kategori, dan ukuran porsi tetap sesuai dengan menu yang disajikan." tone="from-background via-background to-emerald-50/50" />
          <NutritionSummaryCue label="Diet dan Gizi" description="Perubahan kecocokan diet dan nutrisi akan memengaruhi paket makanan serta order gizi terkait." tone="from-background via-background to-sky-50/40" />
          <NutritionSummaryCue label="Harga dan Status" description="Jaga harga porsi dan status aktif agar daftar menu yang dipilih petugas tetap relevan." tone="from-background via-background to-amber-50/50" />
        </div>

        <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
      <form id="nutrition-menu-edit-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <NutritionSectionPanel icon={UtensilsCrossed} title="Informasi Menu" description="Perbarui identitas menu, kategori layanan, ukuran porsi, dan kecocokan diet pasien.">
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
        </NutritionSectionPanel>

        {/* Nutritional Info */}
        <NutritionSectionPanel icon={Flame} title="Informasi Gizi" description="Sesuaikan nilai gizi per porsi agar kalkulasi total nutrisi pada paket tetap akurat.">
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
        </NutritionSectionPanel>

        {/* Price & Status */}
        <NutritionSectionPanel icon={DollarSign} title="Harga dan Status" description="Kelola harga per porsi, status aktif, dan catatan internal menu gizi.">
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
