import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

import { DataTable } from '@/components/ui/data-table';
import { createPatientColumns } from './columns';
import { patientsApi } from '@/lib/api';
import type { Patient } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function PatientsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await patientsApi.getAll({ limit: 1000 });
      setPatients(response.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pasien.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Pasien');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    
    try {
      await patientsApi.delete(patientToDelete.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data pasien berhasil dihapus.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal menghapus data pasien.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPatientToDelete(null);
    }
  };

  const handleView = (patient: Patient) => {
    navigate(`/patients/${patient.id}`);
  };

  const handleEdit = (patient: Patient) => {
    navigate(`/patients/${patient.id}/edit`);
  };

  const handleDelete = (patient: Patient) => {
    setPatientToDelete(patient);
    setDeleteDialogOpen(true);
  };

  // Create columns
  const columns = createPatientColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    canEdit: hasPermission('patients.update'),
    canDelete: hasPermission('patients.delete'),
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
        title="Master Pasien"
        description="Kelola data pasien rumah sakit"
        count={patients.length}
        actions={
          hasPermission('patients.create') ? (
            <Button onClick={() => navigate('/patients/create')} size="sm">
              <Plus className="h-4 w-4" />
              Registrasi Pasien
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Pasien
          </div>
          <div className="p-3 sm:p-4">
            <DataTable
          columns={columns}
          data={patients}
          searchPlaceholder="Cari nama, No. RM, NIK, atau No. BPJS..."
          pageSize={10}
          tableId="patients"
          meta={{ onView: handleView }}
        />
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Data Pasien"
        description={`Apakah Anda yakin ingin menghapus data pasien "${patientToDelete?.nama_lengkap}" (${patientToDelete?.no_rm})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
