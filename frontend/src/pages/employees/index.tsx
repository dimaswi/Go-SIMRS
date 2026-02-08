import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { DataTable } from '@/components/ui/data-table';
import { createEmployeeColumns } from './columns';
import { employeesApi, masterDataApi, type Employee, type MasterData } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});

  const loadData = useCallback(async () => {
    try {
      const [employeesRes, masterDataRes] = await Promise.all([
        employeesApi.getAll(),
        masterDataApi.getMultiple(['employee_type', 'employment_status'])
      ]);
      setEmployees(employeesRes.data.data);
      setMasterData(masterDataRes.data.data || {});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data pegawai.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Pegawai');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      await employeesApi.delete(employeeToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pegawai berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus pegawai.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/employees/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/employees/${id}/edit`);
  };

  const handleDeleteEmployee = (id: number) => {
    setEmployeeToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createEmployeeColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteEmployee,
    hasViewPermission: hasPermission('employees.view'),
    hasEditPermission: hasPermission('employees.update'),
    hasDeletePermission: hasPermission('employees.delete'),
    masterData,
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
          <h1 className="text-lg font-semibold">Pegawai</h1>
          <p className="text-sm text-muted-foreground">Kelola data pegawai rumah sakit</p>
        </div>
        {hasPermission('employees.create') && (
          <Button onClick={() => navigate('/employees/create')} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pegawai
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={employees}
        searchPlaceholder="Cari pegawai berdasarkan nama, NIK, atau NIP..."
        pageSize={10}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Pegawai"
        description="Apakah Anda yakin ingin menghapus pegawai ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
