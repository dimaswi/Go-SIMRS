import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { clinicalPackagesApi, type ClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';
import { createClinicalPackageColumns } from './columns';

export default function ClinicalPackagesIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<ClinicalPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await clinicalPackagesApi.getAll({ limit: 200 });
      setPackages(response.data.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data paket tindakan.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Master Paket Tindakan');
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!selectedId) {
      return;
    }

    try {
      await clinicalPackagesApi.delete(selectedId);
      toast({ title: 'Berhasil!', description: 'Paket tindakan berhasil dihapus.' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal menghapus paket tindakan.' });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedId(null);
    }
  };

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
        title="Master Paket Tindakan"
        description="Kelola paket tindakan dan obat standar yang dapat ditugaskan ke ruangan"
        count={packages.length}
        actions={
          <Button
            size="sm"
            onClick={() => navigate('/clinical-packages/create')}
            className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
          >
            <Plus className="size-3.5" /> Tambah Paket Tindakan
          </Button>
        }
      />
      <PageContent noPadding>
        <DataTable
          columns={createClinicalPackageColumns({
            onView: (id) => navigate(`/clinical-packages/${id}`),
            onEdit: (id) => navigate(`/clinical-packages/${id}/edit`),
            onDelete: (id) => {
              setSelectedId(id);
              setDeleteDialogOpen(true);
            },
          })}
          data={packages}
          searchPlaceholder="Cari paket tindakan berdasarkan kode atau nama..."
          pageSize={10}
          tableId="clinical-packages"
        />
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Paket Tindakan"
        description="Apakah Anda yakin ingin menghapus paket tindakan ini?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}