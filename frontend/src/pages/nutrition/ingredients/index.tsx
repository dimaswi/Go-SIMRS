import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { DataTable } from "@/components/ui/data-table";
import { createNutritionIngredientColumns } from "./columns";
import { nutritionIngredientApi, type NutritionIngredient } from "@/lib/api/nutrition";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Plus, Wheat } from "lucide-react";

export default function NutritionIngredientsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [items, setItems] = useState<NutritionIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await nutritionIngredientApi.getAll({ limit: 200 });
      setItems(response.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data master bahan.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Master Bahan Gizi");
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await nutritionIngredientApi.delete(itemToDelete);
      toast({ variant: "success", title: "Berhasil!", description: "Bahan berhasil dihapus." });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus bahan.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleView = (id: number) => navigate(`/nutrition/ingredients/${id}`);
  const handleEdit = (id: number) => navigate(`/nutrition/ingredients/${id}/edit`);
  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createNutritionIngredientColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasEditPermission: hasPermission("nutrition.update") || hasPermission("medicines.update"),
    hasDeletePermission: hasPermission("nutrition.delete") || hasPermission("medicines.delete"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={Wheat}
        title="Master Bahan Gizi"
        description="Kelola bahan baku menu makanan beserta satuan default untuk komposisi dan laporan pemakaian."
        count={items.length}
        actions={(
          <Button
            onClick={() => navigate("/nutrition/ingredients/create")}
            size="sm"
            className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Bahan
          </Button>
        )}
      />
      <PageContent noPadding>
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder="Cari bahan berdasarkan kode atau nama..."
          pageSize={10}
          tableId="nutrition-ingredients"
        />
      </PageContent>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Bahan Gizi"
        description="Apakah Anda yakin ingin menghapus bahan ini? Bahan yang dipakai di komposisi menu tidak bisa dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
