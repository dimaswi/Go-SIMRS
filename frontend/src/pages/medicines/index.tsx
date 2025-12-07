import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { createMedicineColumns } from './columns';
import { medicinesApi, type Medicine } from '@/lib/api/medicines';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus, Pill } from 'lucide-react';

export default function MedicinesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<number | null>(null);

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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Pill className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">Master Obat</CardTitle>
                  <CardDescription>Kelola data obat dan farmasi rumah sakit</CardDescription>
                </div>
              </div>
              {hasPermission('medicines.create') && (
                <Button onClick={() => navigate('/medicines/create')} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Obat
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={medicines}
              searchPlaceholder="Cari obat berdasarkan kode, nama, atau nama generik..."
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
