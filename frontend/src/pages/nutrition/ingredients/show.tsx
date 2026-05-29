import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nutritionIngredientApi, nutritionIngredientUnitLabels, type NutritionIngredient } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel } from "../shared-page-chrome";

export default function NutritionIngredientShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [item, setItem] = useState<NutritionIngredient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle("Detail Bahan Gizi");
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await nutritionIngredientApi.getById(Number(id));
      setItem(res.data.data);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data bahan." });
      navigate("/nutrition/ingredients");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !item) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={item.name}
        description="Tinjau detail master bahan yang digunakan dalam komposisi menu gizi."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/ingredients")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/ingredients/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        )}
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{item.code}</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{item.is_active ? "Bahan aktif" : "Bahan nonaktif"}</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <NutritionSectionPanel title="Informasi Bahan" description="Identitas bahan, kategori, satuan default, dan status operasional.">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Nama Bahan</span><span className="font-medium">{item.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Kategori</span><span>{item.category || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Satuan Default</span><span>{nutritionIngredientUnitLabels[item.default_unit] || item.default_unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Berat/Isi Default</span><span>{item.default_weight || 0} {nutritionIngredientUnitLabels[item.default_unit] || item.default_unit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge></div>
          </div>
          {item.notes && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{item.notes}</p>
            </div>
          )}
        </NutritionSectionPanel>
      </PageContent>
    </PageShell>
  );
}
