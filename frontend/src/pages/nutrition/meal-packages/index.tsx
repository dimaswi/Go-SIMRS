import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { nutritionPackageApi, type NutritionPackage } from "@/lib/api/nutrition";
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

  const loadData = useCallback(async () => {
    try {
      const res = await nutritionPackageApi.getAll({ limit: 100 });
      setPackages(res.data.data || []);
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

  const columns = createNutritionPackageColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Master Paket Makanan</h1>
          <p className="text-sm text-muted-foreground">Kelola data paket makanan untuk layanan gizi</p>
        </div>
        <Button size="sm" onClick={() => navigate("/nutrition/meal-packages/create")}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Paket Makanan
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={packages}
        searchPlaceholder="Cari paket berdasarkan kode atau nama..."
        pageSize={10}
        tableId="nutrition-meal-packages"
      />

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
    </div>
  );
}
