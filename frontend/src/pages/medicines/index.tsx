import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MedicineTraceabilityDrawer } from '@/components/medicines/medicine-traceability-drawer';
import { createMedicineColumns } from './columns';
import { medicinesApi, type Medicine } from '@/lib/api/medicines';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Pill, Plus, Search, X } from 'lucide-react';

type MedicineStatusFilter = 'active' | 'inactive' | 'all';

export default function MedicinesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MedicineStatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<number | null>(null);
  const [traceabilityOpen, setTraceabilityOpen] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);
  const requestSequenceRef = useRef(0);

  const selectedMedicine = medicines.find((medicine) => medicine.id === selectedMedicineId) || null;

  const loadData = useCallback(async () => {
    const requestId = ++requestSequenceRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await medicinesApi.getAll({
        limit: 1000,
        search: debouncedSearchQuery.trim() || undefined,
        is_active:
          statusFilter === 'all' ? undefined : statusFilter === 'active',
      });
      if (requestId === requestSequenceRef.current) {
        setMedicines(response.data.data || []);
      }
    } catch (error) {
      if (requestId === requestSequenceRef.current) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: error instanceof Error ? error.message : "Gagal memuat data obat.",
        });
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        if (isInitialLoad) {
          setLoading(false);
          hasLoadedRef.current = true;
        } else {
          setIsRefreshing(false);
        }
      }
    }
  }, [debouncedSearchQuery, statusFilter, toast]);

  useEffect(() => {
    setPageTitle('Obat');
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
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
        icon={Pill}
        title="Master Obat"
        description="Kelola data obat dan farmasi rumah sakit"
        count={medicines.length}
        actions={
          hasPermission('medicines.create') ? (
            <Button
              onClick={() => navigate('/medicines/create')}
              size="sm"
              className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Obat
            </Button>
          ) : undefined
        }
      />
      <PageContent noPadding>
        <DataTable
          columns={columns}
          data={medicines}
          showSearch={false}
          pageSize={10}
          tableId="medicines"
          searchSlot={
            <>
              <div className="relative w-full max-w-[280px] min-w-0">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari obat berdasarkan kode, nama, atau nama generik..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-7 w-full bg-background pl-7 pr-12 text-xs rounded-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {isRefreshing && (
                  <Loader2 className="pointer-events-none absolute right-7 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MedicineStatusFilter)}>
                <SelectTrigger className="h-7 w-[150px] bg-background text-xs rounded-none">
                  <SelectValue placeholder="Status obat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hanya aktif</SelectItem>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="inactive">Hanya nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />
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
