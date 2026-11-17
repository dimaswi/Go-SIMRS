import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

import { DataTable } from '@/components/ui/data-table';
import { createProcedureColumns } from './columns';
import { proceduresApi } from '@/lib/api/procedures';
import type { Procedure } from '@/lib/api/procedures';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function ProceduresPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await proceduresApi.getAll();
      setProcedures(res.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data tindakan.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Tindakan');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!procedureToDelete) return;
    
    try {
      await proceduresApi.delete(procedureToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus tindakan.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/procedures/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/procedures/${id}/edit`);
  };

  const handleDeleteProcedure = (id: number) => {
    setProcedureToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createProcedureColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteProcedure,
    hasViewPermission: hasPermission('procedures.view'),
    hasEditPermission: hasPermission('procedures.update'),
    hasDeletePermission: hasPermission('procedures.delete'),
  });

  return (
    <PageShell>
      <PageHeader
        title="Master Tindakan"
        description="Kelola data tindakan medis, radiologi, dan laboratorium"
        count={procedures.length}
        actions={
          hasPermission('procedures.create') ? (
            <Button
              onClick={() => navigate('/procedures/create')}
              size="sm"
              className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
            >
              <Plus className="size-3.5" />
              Tambah Tindakan
            </Button>
          ) : undefined
        }
      />
      <PageContent noPadding>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={procedures}
            searchPlaceholder="Cari tindakan berdasarkan kode atau nama..."
            pageSize={10}
            tableId="procedures"
          />
        )}
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Tindakan"
        description="Apakah Anda yakin ingin menghapus tindakan ini? Tindakan yang sudah terhubung dengan ruangan tidak dapat dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
