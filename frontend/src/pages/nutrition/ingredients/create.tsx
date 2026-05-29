import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { nutritionIngredientApi, nutritionIngredientUnitLabels } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel } from "../shared-page-chrome";

export default function NutritionIngredientCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const unitOptions: ComboboxOption[] = Object.entries(nutritionIngredientUnitLabels).map(([value, label]) => ({ value, label }));

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    default_unit: "gram",
    default_weight: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    setPageTitle("Tambah Bahan Gizi");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ variant: "destructive", title: "Error!", description: "Nama bahan wajib diisi." });
      return;
    }
    setLoading(true);
    try {
      await nutritionIngredientApi.create(formData);
      toast({ variant: "success", title: "Berhasil!", description: "Bahan gizi berhasil ditambahkan." });
      navigate("/nutrition/ingredients");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan bahan gizi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Tambah Bahan Gizi"
        description="Buat master bahan baku untuk dipakai pada komposisi menu makanan per porsi."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/ingredients")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="nutrition-ingredient-create-form" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Bahan
            </Button>
          </div>
        )}
      />

      <PageContent className="flex-none pb-8">
        <form id="nutrition-ingredient-create-form" onSubmit={handleSubmit} className="space-y-6">
          <NutritionSectionPanel title="Informasi Bahan" description="Isi identitas bahan, kategori, satuan default, dan status aktif.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Bahan</Label>
                <Input value="Otomatis dibuat sistem saat simpan" disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Bahan *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: Beras" required />
              </div>
              <div className="space-y-2">
                <Label>Kategori Bahan</Label>
                <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Contoh: Karbohidrat, Bumbu, Lauk" />
              </div>
              <div className="space-y-2">
                <Label>Satuan Default</Label>
                <Combobox options={unitOptions} value={formData.default_unit} onValueChange={(value) => setFormData({ ...formData, default_unit: value })} placeholder="Pilih satuan..." />
              </div>
              <div className="space-y-2">
                <Label>Berat/Isi Default</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.default_weight || ""}
                  onChange={(e) => setFormData({ ...formData, default_weight: parseFloat(e.target.value) || 0 })}
                  placeholder="Contoh: 500"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label>Bahan Aktif</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Catatan tambahan..." rows={2} />
            </div>
          </NutritionSectionPanel>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/nutrition/ingredients")}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Bahan
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
