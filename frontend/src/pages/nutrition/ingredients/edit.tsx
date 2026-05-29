import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function NutritionIngredientEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const unitOptions: ComboboxOption[] = Object.entries(nutritionIngredientUnitLabels).map(([value, label]) => ({ value, label }));

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "",
    default_unit: "gram",
    default_weight: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    setPageTitle("Edit Bahan Gizi");
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await nutritionIngredientApi.getById(Number(id));
      const item = res.data.data;
      setFormData({
        code: item.code || "",
        name: item.name || "",
        category: item.category || "",
        default_unit: item.default_unit || "gram",
        default_weight: item.default_weight || 0,
        is_active: item.is_active ?? true,
        notes: item.notes || "",
      });
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data bahan." });
      navigate("/nutrition/ingredients");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ variant: "destructive", title: "Error!", description: "Nama bahan wajib diisi." });
      return;
    }
    setLoading(true);
    try {
      await nutritionIngredientApi.update(Number(id), formData);
      toast({ variant: "success", title: "Berhasil!", description: "Bahan gizi berhasil diperbarui." });
      navigate("/nutrition/ingredients");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui bahan gizi.",
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
        title="Edit Bahan Gizi"
        description={`Perbarui master bahan ${formData.name || ""} untuk menjaga akurasi komposisi menu.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/ingredients")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="nutrition-ingredient-edit-form" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        )}
      />

      <PageContent className="flex-none pb-8">
        <form id="nutrition-ingredient-edit-form" onSubmit={handleSubmit} className="space-y-6">
          <NutritionSectionPanel title="Informasi Bahan" description="Perbarui identitas bahan, kategori, satuan default, dan status aktif.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode Bahan</Label>
                <Input id="code" value={formData.code} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Bahan *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Kategori Bahan</Label>
                <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
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
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label>Bahan Aktif</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </NutritionSectionPanel>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/nutrition/ingredients")}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
