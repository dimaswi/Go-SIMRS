import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

import { DataTable } from '@/components/ui/data-table';
import { createInventoryColumns } from './columns';
import { inventoriesApi, type Inventory } from '@/lib/api/inventories';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Package, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type InventoryStatusFilter = 'active' | 'inactive' | 'all';

export default function InventoriesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('active');

  const loadData = useCallback(async () => {
    try {
      const response = await inventoriesApi.getAll({
        limit: 100,
        is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      });
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
  }, [toast, statusFilter]);

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
    <PageShell>
      <PageHeader
        icon={Package}
        title="Inventaris"
        description="Kelola data inventaris dan barang rumah sakit"
        count={inventories.length}
        actions={
          hasPermission('inventories.create') ? (
            <Button
              onClick={() => navigate('/inventories/create')}
              size="sm"
              className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Inventaris
            </Button>
          ) : undefined
        }
      />
      <PageContent noPadding>
        <DataTable
          columns={columns}
          data={inventories}
          searchPlaceholder="Cari inventaris berdasarkan kode atau nama..."
          pageSize={10}
          tableId="inventories"
          searchSlot={
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InventoryStatusFilter)}>
              <SelectTrigger className="h-7 w-[150px] bg-background text-xs rounded-none">
                <SelectValue placeholder="Status inventaris" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Hanya aktif</SelectItem>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="inactive">Hanya nonaktif</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </PageContent>

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
    </PageShell>
  );
}
