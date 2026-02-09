import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Master Pasien</h1>
          <p className="text-sm text-muted-foreground">Kelola data pasien rumah sakit</p>
        </div>
        {hasPermission('patients.create') && (
          <Button onClick={() => navigate('/patients/create')} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Registrasi Pasien
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={patients}
        searchPlaceholder="Cari nama, No. RM, NIK, atau No. BPJS..."
        pageSize={10}
        tableId="patients"
        meta={{ onView: handleView }}
      />

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
    </div>
  );
}
