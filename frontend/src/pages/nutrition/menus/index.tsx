import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { DataTable } from '@/components/ui/data-table';
import { createNutritionMenuColumns } from './columns';
import { nutritionMenuApi, type NutritionMenu } from '@/lib/api/nutrition';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function NutritionMenusPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [menus, setMenus] = useState<NutritionMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await nutritionMenuApi.getAll({ limit: 100 });
      setMenus(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data menu makanan.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Menu Makanan');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!menuToDelete) return;
    try {
      await nutritionMenuApi.delete(menuToDelete);
      toast({ variant: "success", title: "Berhasil!", description: "Menu makanan berhasil dihapus." });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus menu makanan.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setMenuToDelete(null);
    }
  };

  const handleView = (id: number) => navigate(`/nutrition/menus/${id}`);
  const handleEdit = (id: number) => navigate(`/nutrition/menus/${id}/edit`);
  const handleDelete = (id: number) => {
    setMenuToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createNutritionMenuColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasEditPermission: hasPermission('nutrition.update') || hasPermission('medicines.update'),
    hasDeletePermission: hasPermission('nutrition.delete') || hasPermission('medicines.delete'),
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
        title="Master Menu Makanan"
        description="Kelola data menu makanan untuk layanan gizi"
        count={menus.length}
        actions={
          <Button onClick={() => navigate('/nutrition/menus/create')} size="sm">
            <Plus className="h-4 w-4" />
            Tambah Menu
          </Button>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    Daftar Menu Makanan
  </div>
  <div className="p-3 sm:p-4">
    <DataTable
          columns={columns}
          data={menus}
          searchPlaceholder="Cari menu berdasarkan kode atau nama..."
          pageSize={10}
          tableId="nutrition-menus"
        />
  </div>
</div>
      </PageContent>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Menu Makanan"
        description="Apakah Anda yakin ingin menghapus menu makanan ini? Menu yang sudah digunakan dalam paket tidak bisa dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
