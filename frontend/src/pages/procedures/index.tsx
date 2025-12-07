import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Tindakan</CardTitle>
                <CardDescription>Kelola data tindakan medis, radiologi, dan laboratorium</CardDescription>
              </div>
              {hasPermission('procedures.create') && (
                <Button onClick={() => navigate('/procedures/create')} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Tindakan
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
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
              />
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
