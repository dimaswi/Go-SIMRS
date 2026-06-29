import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  nutritionPackageApi,
  nutritionMenuApi,
  nutritionMealTimeLabels,
  nutritionCategoryLabels,
  type NutritionPackage,
} from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil, Flame, Beef, Droplets, Wheat, UtensilsCrossed } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { NutritionSectionPanel, NutritionSummaryCue } from "../shared-page-chrome";

export default function NutritionMealPackageShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<NutritionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [dietTypeMap, setDietTypeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setPageTitle("Detail Paket Makanan");
    loadPackage();
    loadDietTypes();
  }, [id]);

  const loadDietTypes = async () => {
    try {
      const res = await nutritionMenuApi.getDietTypes();
      const options = res.data?.data || [];
      setDietTypeMap(
        options.reduce((acc: Record<string, string>, item: { value: string; label: string }) => {
          acc[item.value] = item.label;
          return acc;
        }, {})
      );
    } catch {
      setDietTypeMap({});
    }
  };

  const loadPackage = async () => {
    try {
      const res = await nutritionPackageApi.getById(Number(id));
      setPkg(res.data.data);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data paket makanan." });
      navigate("/nutrition/meal-packages");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !pkg) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={pkg.name}
        description="Tinjau identitas paket makanan, komposisi menu, nilai gizi total, dan status operasional dalam pola halaman yang sama dengan modul master data lain."
        icon={UtensilsCrossed}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/meal-packages")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/meal-packages/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{pkg.code}</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{pkg.items?.length || 0} item menu</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <NutritionSummaryCue label="Jenis Diet" description={dietTypeMap[pkg.diet_type] || pkg.diet_type} tone="from-background via-background to-emerald-50/50" />
          <NutritionSummaryCue label="Waktu Makan" description={nutritionMealTimeLabels[pkg.meal_time] || pkg.meal_time} tone="from-background via-background to-sky-50/40" />
          <NutritionSummaryCue label="Status Paket" description={pkg.is_active ? "Aktif" : "Nonaktif"} tone="from-background via-background to-amber-50/50" />
        </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        {/* Info */}
        <NutritionSectionPanel icon={UtensilsCrossed} title="Informasi Paket" description="Identitas paket, diet, waktu makan, harga, status, dan deskripsi singkat paket makanan.">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jenis Diet</span>
              <Badge variant="outline">{dietTypeMap[pkg.diet_type] || pkg.diet_type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Waktu Makan</span>
              <Badge variant="secondary">{nutritionMealTimeLabels[pkg.meal_time] || pkg.meal_time}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={pkg.is_active ? "default" : "secondary"}>{pkg.is_active ? "Aktif" : "Nonaktif"}</Badge>
            </div>
          </div>
          {pkg.description && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{pkg.description}</p>
            </div>
          )}
        </NutritionSectionPanel>

        {/* Nutrition Totals */}
        <NutritionSectionPanel icon={Flame} title="Total Nilai Gizi" description="Akumulasi nutrisi seluruh menu dalam paket sebagai dasar evaluasi kebutuhan diet pasien.">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 text-center">
              <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
              <div className="text-lg font-bold">{pkg.total_calories}</div>
              <div className="text-xs text-muted-foreground">kkal</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center">
              <Beef className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <div className="text-lg font-bold">{pkg.total_protein}g</div>
              <div className="text-xs text-muted-foreground">Protein</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3 text-center">
              <Droplets className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <div className="text-lg font-bold">{pkg.total_fat}g</div>
              <div className="text-xs text-muted-foreground">Lemak</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
              <Wheat className="h-5 w-5 mx-auto mb-1 text-amber-600" />
              <div className="text-lg font-bold">{pkg.total_carbohydrate}g</div>
              <div className="text-xs text-muted-foreground">Karbohidrat</div>
            </div>
          </div>
        </NutritionSectionPanel>
      </div>

      {/* Items */}
      <NutritionSectionPanel title="Item Menu" description={`Daftar menu yang membentuk paket ini beserta jumlah porsi dan ringkasan kalori per item.`}>
        <h3 className="text-sm font-medium text-foreground">Item Menu ({pkg.items?.length || 0})</h3>
        {pkg.items && pkg.items.length > 0 ? (
          <div className="space-y-2">
            {pkg.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.menu?.name || `Menu #${item.menu_id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {nutritionCategoryLabels[item.menu?.category || ''] || ''} &middot; {item.menu?.calories} kkal/porsi
                  </div>
                </div>
                <Badge variant="secondary">x{item.quantity}</Badge>
                <div className="text-sm text-right">
                  <span className="font-medium">{((item.menu?.calories || 0) * item.quantity).toFixed(0)} kkal</span>
                </div>
                {item.notes && <span className="text-xs text-muted-foreground italic">{item.notes}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada item.</p>
        )}
      </NutritionSectionPanel>

      {pkg.notes && (
        <NutritionSectionPanel title="Catatan" description="Keterangan tambahan dari tim gizi untuk paket makanan ini.">
          <p className="text-sm text-muted-foreground">{pkg.notes}</p>
        </NutritionSectionPanel>
      )}
    </PageContent>
    </PageShell>
  );
}
