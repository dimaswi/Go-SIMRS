import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nutritionMenuApi, type NutritionMenu, nutritionCategoryLabels, nutritionCategoryColors, nutritionDietTypeLabels } from "@/lib/api/nutrition";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Pencil, Flame, Beef, Droplets, Wheat } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

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

  let dietTypes: string[] = [];
  if (menu.diet_types) {
    try { dietTypes = JSON.parse(menu.diet_types); } catch { dietTypes = []; }
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/nutrition/menus")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{menu.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{menu.code}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/menus/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">Informasi Menu</h3>
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
        </div>

        {/* Nutrition */}
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2"><Flame className="h-4 w-4" /> Informasi Gizi</h3>
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
        </div>
      </div>

      {/* Diet Types */}
      {dietTypes.length > 0 && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-medium">Jenis Diet yang Cocok</h3>
          <div className="flex flex-wrap gap-2">
            {dietTypes.map((dt) => (
              <Badge key={dt} variant="outline">{nutritionDietTypeLabels[dt] || dt}</Badge>
            ))}
          </div>
        </div>
      )}

      {menu.notes && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-medium">Catatan</h3>
          <p className="text-sm text-muted-foreground">{menu.notes}</p>
        </div>
      )}
    </div>
  );
}
