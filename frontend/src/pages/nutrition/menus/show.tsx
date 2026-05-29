import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nutritionMenuApi, type NutritionMenu, nutritionCategoryLabels, nutritionCategoryColors, nutritionIngredientUnitLabels } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil, Flame, Beef, Droplets, Wheat, Plus } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel, NutritionSummaryCue } from "../shared-page-chrome";

export default function NutritionMenuShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [menu, setMenu] = useState<NutritionMenu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle("Detail Menu Makanan");
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    try {
      const res = await nutritionMenuApi.getById(Number(id));
      setMenu(res.data.data);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data menu." });
      navigate("/nutrition/menus");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !menu) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={menu.name}
        description="Tinjau detail menu gizi, kandungan nutrisi per porsi, komposisi bahan, dan status operasionalnya dalam format yang sama dengan halaman master lain."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/menus")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/menus/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{menu.code}</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{menu.is_active ? "Menu aktif" : "Menu nonaktif"}</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <NutritionSummaryCue label="Kategori" description={nutritionCategoryLabels[menu.category] || menu.category} tone="from-background via-background to-emerald-50/50" />
          <NutritionSummaryCue label="Ukuran Porsi" description={menu.serving_size || "Belum diisi"} tone="from-background via-background to-sky-50/40" />
          <NutritionSummaryCue label="Harga" description={menu.unit_price > 0 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(menu.unit_price) : "Belum diisi"} tone="from-background via-background to-amber-50/50" />
        </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Basic Info */}
        <NutritionSectionPanel title="Informasi Menu" description="Ringkasan identitas menu, kategori, ukuran porsi, harga, status, dan deskripsi singkat.">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Kategori</span>
              <Badge variant="outline" className={nutritionCategoryColors[menu.category] || ''}>{nutritionCategoryLabels[menu.category] || menu.category}</Badge>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ukuran Porsi</span><span>{menu.serving_size || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Harga</span>
              <span className="font-medium">{menu.unit_price > 0 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(menu.unit_price) : "-"}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <Badge variant={menu.is_active ? "default" : "secondary"}>{menu.is_active ? "Aktif" : "Nonaktif"}</Badge>
            </div>
          </div>
          {menu.description && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{menu.description}</p>
            </div>
          )}
        </NutritionSectionPanel>

        {/* Nutrition */}
        <NutritionSectionPanel icon={Flame} title="Informasi Gizi" description="Nilai nutrisi per porsi untuk kebutuhan analisis diet dan penyusunan paket makanan.">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 text-center">
              <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
              <div className="text-lg font-bold">{menu.calories}</div>
              <div className="text-xs text-muted-foreground">kkal</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center">
              <Beef className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <div className="text-lg font-bold">{menu.protein}g</div>
              <div className="text-xs text-muted-foreground">Protein</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3 text-center">
              <Droplets className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <div className="text-lg font-bold">{menu.fat}g</div>
              <div className="text-xs text-muted-foreground">Lemak</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
              <Wheat className="h-5 w-5 mx-auto mb-1 text-amber-600" />
              <div className="text-lg font-bold">{menu.carbohydrate}g</div>
              <div className="text-xs text-muted-foreground">Karbohidrat</div>
            </div>
          </div>
          <div className="text-sm space-y-1 pt-2 border-t">
            <div className="flex justify-between"><span className="text-muted-foreground">Serat</span><span>{menu.fiber}g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Natrium</span><span>{menu.sodium}mg</span></div>
          </div>
        </NutritionSectionPanel>
      </div>

      <NutritionSectionPanel icon={Plus} title="Komposisi Bahan per Porsi" description="Daftar bahan baku yang digunakan untuk 1 porsi menu ini.">
        {menu.ingredients && menu.ingredients.length > 0 ? (
          <div className="space-y-2">
            {menu.ingredients.map((item, index) => (
              <div key={item.id || `${item.ingredient_id}-${index}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{item.ingredient?.name || `Bahan #${item.ingredient_id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.ingredient?.code || "-"}{item.notes ? ` • ${item.notes}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{item.weight_per_portion} {nutritionIngredientUnitLabels[item.unit] || item.unit}</div>
                  <div className="text-xs text-muted-foreground">per porsi</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada komposisi bahan untuk menu ini.</p>
        )}
      </NutritionSectionPanel>

      {menu.notes && (
        <NutritionSectionPanel title="Catatan" description="Keterangan operasional tambahan dari tim gizi untuk menu ini.">
          <p className="text-sm text-muted-foreground">{menu.notes}</p>
        </NutritionSectionPanel>
      )}
    </PageContent>
    </PageShell>
  );
}
