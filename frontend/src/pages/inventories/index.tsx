import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { createInventoryColumns } from './columns';
import { inventoriesApi, type Inventory } from '@/lib/api/inventories';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus, Package } from 'lucide-react';

export default function InventoriesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await inventoriesApi.getAll({ limit: 100 });
      setInventories(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data inventaris.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Inventaris');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!inventoryToDelete) return;
    
    try {
      await inventoriesApi.delete(inventoryToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Inventaris berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus inventaris.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setInventoryToDelete(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/inventories/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/inventories/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setInventoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createInventoryColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasViewPermission: hasPermission('inventories.view'),
    hasEditPermission: hasPermission('inventories.update'),
    hasDeletePermission: hasPermission('inventories.delete'),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">Inventaris</CardTitle>
                  <CardDescription>Kelola data inventaris dan barang rumah sakit</CardDescription>
                </div>
              </div>
              {hasPermission('inventories.create') && (
                <Button onClick={() => navigate('/inventories/create')} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Inventaris
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={inventories}
              searchPlaceholder="Cari inventaris berdasarkan kode atau nama..."
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Inventaris"
        description="Apakah Anda yakin ingin menghapus inventaris ini? Semua item dan riwayat transaksi terkait juga akan dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
