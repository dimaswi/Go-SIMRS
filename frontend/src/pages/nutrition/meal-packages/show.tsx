import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  nutritionPackageApi,
  nutritionDietTypeLabels,
  nutritionMealTimeLabels,
  nutritionCategoryLabels,
  type NutritionPackage,
} from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil, Flame, Beef, Droplets, Wheat, UtensilsCrossed } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function NutritionMealPackageShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<NutritionPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle("Detail Paket Makanan");
    loadPackage();
  }, [id]);

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

  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{pkg.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{pkg.code}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/meal-packages/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" /> Informasi Paket</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jenis Diet</span>
              <Badge variant="outline">{nutritionDietTypeLabels[pkg.diet_type] || pkg.diet_type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Waktu Makan</span>
              <Badge variant="secondary">{nutritionMealTimeLabels[pkg.meal_time] || pkg.meal_time}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga</span>
              <span className="font-medium">{pkg.price > 0 ? fmt(pkg.price) : "-"}</span>
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
        </div>

        {/* Nutrition Totals */}
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2"><Flame className="h-4 w-4" /> Total Nilai Gizi</h3>
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
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Item Menu ({pkg.items?.length || 0})</h3>
        {pkg.items && pkg.items.length > 0 ? (
          <div className="space-y-2">
            {pkg.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.menu?.name || `Menu #${item.menu_id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {nutritionCategoryLabels[item.menu?.category || ''] || ''} Â· {item.menu?.calories} kkal/porsi
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
      </div>

      {pkg.notes && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-medium">Catatan</h3>
          <p className="text-sm text-muted-foreground">{pkg.notes}</p>
        </div>
      )}
    </div>
  );
}
