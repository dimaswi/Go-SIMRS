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
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data paket klinis.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Master Paket Klinis');
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!selectedId) {
      return;
    }

    try {
      await clinicalPackagesApi.delete(selectedId);
      toast({ title: 'Berhasil!', description: 'Paket klinis berhasil dihapus.' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal menghapus paket klinis.' });
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
        title="Master Paket Klinis"
        description="Kelola template tindakan dan obat yang dapat di-assign ke ruangan"
        count={packages.length}
        actions={
          <Button size="sm" onClick={() => navigate('/clinical-packages/create')}>
            <Plus className="h-4 w-4" /> Tambah Paket Klinis
          </Button>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Paket Klinis
          </div>
          <div className="p-3 sm:p-4">
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
          searchPlaceholder="Cari paket klinis berdasarkan kode atau nama..."
          pageSize={10}
          tableId="clinical-packages"
        />
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Paket Klinis"
        description="Apakah Anda yakin ingin menghapus paket klinis ini?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}