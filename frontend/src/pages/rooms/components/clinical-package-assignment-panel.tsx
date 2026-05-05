import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { clinicalPackagesApi, roomClinicalPackagesApi, type ClinicalPackage, type RoomClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, PlusCircle, Power, Trash2, X } from 'lucide-react';

interface ClinicalPackageAssignmentPanelProps {
  roomId: number;
  assignments: RoomClinicalPackage[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function ClinicalPackageAssignmentPanel({
  roomId,
  assignments,
  onRefresh,
  hasPermission,
}: ClinicalPackageAssignmentPanelProps) {
  const { toast } = useToast();
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [allPackages, setAllPackages] = useState<ClinicalPackage[]>([]);
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const loadReferences = useCallback(async () => {
    try {
      const response = await clinicalPackagesApi.getAll({ limit: 200, is_active: true });
      setAllPackages(response.data.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat paket klinis aktif.' });
    } finally {
      setLoadingReferences(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  const availablePackages = useMemo(
    () => allPackages.filter((pkg) => !assignments.some((assignment) => assignment.clinical_package_id === pkg.id)),
    [allPackages, assignments]
  );

  const handleAdd = async (packageId: number) => {
    setProcessingKey(`add-${packageId}`);
    try {
      await roomClinicalPackagesApi.create(roomId, { clinical_package_id: packageId, is_active: true });
      toast({ variant: 'success', title: 'Berhasil!', description: 'Paket klinis berhasil ditambahkan ke ruangan.' });
      onRefresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal menambahkan paket klinis ke ruangan.' });
    } finally {
      setProcessingKey(null);
    }
  };

  const toggleAssignment = async (assignment: RoomClinicalPackage) => {
    setProcessingKey(`toggle-${assignment.id}`);
    try {
      await roomClinicalPackagesApi.update(roomId, assignment.id, { is_active: !assignment.is_active, notes: assignment.notes || '' });
      toast({ variant: 'success', title: 'Berhasil!', description: 'Status assignment paket klinis berhasil diupdate.' });
      onRefresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal mengupdate assignment paket klinis.' });
    } finally {
      setProcessingKey(null);
    }
  };

  const removeAssignment = async (assignment: RoomClinicalPackage) => {
    setProcessingKey(`remove-${assignment.id}`);
    try {
      await roomClinicalPackagesApi.delete(roomId, assignment.id);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Assignment paket klinis berhasil dihapus.' });
      onRefresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal menghapus assignment paket klinis.' });
    } finally {
      setProcessingKey(null);
    }
  };

  if (loadingReferences) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableColumns: ColumnDef<ClinicalPackage>[] = [
    {
      accessorKey: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Nama Paket',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.name}</div>
          {row.original.description ? <p className="text-xs text-muted-foreground">{row.original.description}</p> : null}
        </div>
      ),
    },
    {
      id: 'contents',
      header: 'Isi',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{row.original.procedure_items?.length || 0} tindakan</Badge>
          <Badge variant="outline">{row.original.medicine_items?.length || 0} obat</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => {
        if (!hasPermission) return null;

        return (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleAdd(row.original.id)}
            disabled={processingKey === `add-${row.original.id}`}
            className="h-8"
          >
            {processingKey === `add-${row.original.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4 text-green-600" />
            )}
          </Button>
        );
      },
    },
  ];

  const assignedColumns: ColumnDef<RoomClinicalPackage>[] = [
    {
      id: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.clinical_package?.code || '-'}</span>,
    },
    {
      id: 'name',
      header: 'Nama Paket',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.clinical_package?.name || `Paket #${row.original.clinical_package_id}`}</div>
          {row.original.clinical_package?.description ? <p className="text-xs text-muted-foreground">{row.original.clinical_package.description}</p> : null}
        </div>
      ),
    },
    {
      id: 'contents',
      header: 'Isi',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{row.original.clinical_package?.procedure_items?.length || 0} tindakan</Badge>
          <Badge variant="outline">{row.original.clinical_package?.medicine_items?.length || 0} obat</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => {
        if (!hasPermission) return null;

        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => toggleAssignment(row.original)}
              disabled={processingKey === `toggle-${row.original.id}` || processingKey === `remove-${row.original.id}`}
              className="h-8 w-8"
            >
              {processingKey === `toggle-${row.original.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : row.original.is_active ? (
                <Power className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => removeAssignment(row.original)}
              disabled={processingKey === `toggle-${row.original.id}` || processingKey === `remove-${row.original.id}`}
            >
              {processingKey === `remove-${row.original.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <X className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Tersedia ({availablePackages.length})</h2>
              <p className="text-xs text-muted-foreground">Paket aktif yang belum ditugaskan ke ruangan ini.</p>
            </div>
          </div>
          <div className="rounded-lg border p-4">
              <DataTable
                columns={availableColumns}
                data={availablePackages}
                searchPlaceholder="Cari kode atau nama paket..."
                pageSize={8}
                tableId={`room_clinical_packages_available_${roomId}`}
              />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Ditugaskan ({assignments.length})</h2>
              <p className="text-xs text-muted-foreground">Paket klinis yang tersedia saat pendaftaran untuk ruangan ini.</p>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <DataTable
              columns={assignedColumns}
              data={assignments}
              searchPlaceholder="Cari paket yang sudah ditugaskan..."
              pageSize={8}
              tableId={`room_clinical_packages_assigned_${roomId}`}
            />
          </div>
        </div>
      </div>

      {!hasPermission ? null : (
        <div className="rounded-lg border border-dashed p-4">
          <div>
            <h3 className="text-sm font-semibold">Catatan Pengelolaan</h3>
            <p className="text-xs text-muted-foreground">
              Tambahkan paket dari kartu kiri. Paket yang sudah masuk akan langsung muncul di kartu kanan dan tersedia di form pendaftaran.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}