import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { nutritionMenuApi, nutritionPackageApi, type NutritionPackage } from "@/lib/api/nutrition";
import { createNutritionPackageColumns } from "./columns";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function NutritionMealPackagesIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<NutritionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pkgToDelete, setPkgToDelete] = useState<number | null>(null);
  const [dietTypeMap, setDietTypeMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [pkgRes, dietRes] = await Promise.all([
        nutritionPackageApi.getAll({ limit: 100 }),
        nutritionMenuApi.getDietTypes(),
      ]);
      setPackages(pkgRes.data.data || []);
      const options = dietRes.data?.data || [];
      setDietTypeMap(
        options.reduce((acc: Record<string, string>, item: { value: string; label: string }) => {
          acc[item.value] = item.label;
          return acc;
        }, {})
      );
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data paket makanan." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Master Paket Makanan");
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!pkgToDelete) return;
    try {
      await nutritionPackageApi.delete(pkgToDelete);
      toast({ title: "Berhasil!", description: "Paket makanan berhasil dihapus." });
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error!", description: err?.response?.data?.error || "Gagal menghapus paket makanan." });
    } finally {
      setDeleteDialogOpen(false);
      setPkgToDelete(null);
    }
  };

  const handleView = (id: number) => navigate(`/nutrition/meal-packages/${id}`);
  const handleEdit = (id: number) => navigate(`/nutrition/meal-packages/${id}/edit`);
  const handleDelete = (id: number) => {
    setPkgToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createNutritionPackageColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete, dietTypeMap });

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
        title="Master Paket Makanan"
        description="Kelola data paket makanan untuk layanan gizi"
        count={packages.length}
        actions={
          <Button size="sm" onClick={() => navigate("/nutrition/meal-packages/create")}>
            <Plus className="h-4 w-4" />
            Tambah Paket Makanan
          </Button>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    Daftar Paket Makanan
  </div>
  <div className="p-3 sm:p-4">
    <DataTable
          columns={columns}
          data={packages}
          searchPlaceholder="Cari paket berdasarkan kode atau nama..."
          pageSize={10}
          tableId="nutrition-meal-packages"
        />
  </div>
</div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Paket Makanan"
        description="Apakah Anda yakin ingin menghapus paket makanan ini?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
