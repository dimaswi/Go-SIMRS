import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

import { DataTable } from '@/components/ui/data-table';
import { MedicineTraceabilityDrawer } from '@/components/medicines/medicine-traceability-drawer';
import { createMedicineColumns } from './columns';
import { medicinesApi, type Medicine } from '@/lib/api/medicines';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function MedicinesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<number | null>(null);
  const [traceabilityOpen, setTraceabilityOpen] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState<number | null>(null);

  const selectedMedicine = medicines.find((medicine) => medicine.id === selectedMedicineId) || null;

  const loadData = useCallback(async () => {
    try {
      const response = await medicinesApi.getAll({ limit: 100 });
      setMedicines(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data obat.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Obat');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!medicineToDelete) return;
    
    try {
      await medicinesApi.delete(medicineToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Obat berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus obat.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setMedicineToDelete(null);
    }
  };

  const handleTrace = (id: number) => {
    setSelectedMedicineId(id);
    setTraceabilityOpen(true);
  };

  const handleView = (id: number) => {
    navigate(`/medicines/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/medicines/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setMedicineToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createMedicineColumns({
    onTrace: handleTrace,
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasViewPermission: hasPermission('medicines.view'),
    hasEditPermission: hasPermission('medicines.update'),
    hasDeletePermission: hasPermission('medicines.delete'),
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
        title="Master Obat"
        description="Kelola data obat dan farmasi rumah sakit"
        count={medicines.length}
        actions={
          hasPermission('medicines.create') ? (
            <Button onClick={() => navigate('/medicines/create')} size="sm">
              <Plus className="h-4 w-4" />
              Tambah Obat
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Obat
          </div>
          <div className="p-3 sm:p-4">
            <DataTable
          columns={columns}
          data={medicines}
          searchPlaceholder="Cari obat berdasarkan kode, nama, atau nama generik..."
          pageSize={10}
          tableId="medicines"
        />
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Obat"
        description="Apakah Anda yakin ingin menghapus obat ini? Data terkait juga akan dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />

      <MedicineTraceabilityDrawer
        open={traceabilityOpen}
        onOpenChange={setTraceabilityOpen}
        medicineId={selectedMedicineId}
        initialMedicine={selectedMedicine}
        onOpenDetail={(id) => navigate(`/medicines/${id}`)}
      />
    </PageShell>
  );
}
