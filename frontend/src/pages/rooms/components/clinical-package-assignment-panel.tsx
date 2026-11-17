import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { roomClinicalPackagesApi, type RoomClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, Power, Trash2, Plus } from 'lucide-react';

interface ClinicalPackageAssignmentPanelProps {
  roomId: number;
  assignments: RoomClinicalPackage[];
  onRefresh: () => void;
  hasPermission: boolean;
  onAdd?: () => void;
  onDelete?: (assignment: RoomClinicalPackage) => void;
}

export function ClinicalPackageAssignmentPanel({
  roomId,
  assignments,
  onRefresh,
  hasPermission,
  onAdd,
  onDelete,
}: ClinicalPackageAssignmentPanelProps) {
  const { toast } = useToast();
  const [processingKey, setProcessingKey] = useState<string | null>(null);

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
    if (onDelete) {
      onDelete(assignment);
      return;
    }
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

  const columns = useMemo<ColumnDef<RoomClinicalPackage>[]>(() => [
    {
      id: 'package',
      accessorFn: (row) => `${row.clinical_package?.name || ''} ${row.clinical_package?.code || ''}`,
      header: 'Paket',
      cell: ({ row }) => {
        const assignment = row.original;
        return (
          <div className="text-xs">
            <div className="font-medium">{assignment.clinical_package?.name || `Paket #${assignment.clinical_package_id}`}</div>
            <div className="text-[11px] font-mono text-muted-foreground">{assignment.clinical_package?.code || '-'}</div>
            {assignment.clinical_package?.description && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">{assignment.clinical_package.description}</div>
            )}
          </div>
        );
      },
    },
    {
      id: 'items',
      header: 'Isi',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="h-5 text-[10px] font-normal">
            {row.original.clinical_package?.procedure_items?.length || 0} tindakan
          </Badge>
          <Badge variant="outline" className="h-5 text-[10px] font-normal">
            {row.original.clinical_package?.medicine_items?.length || 0} obat
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'} className="h-5 text-[10px] font-normal">
          {row.original.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    ...(hasPermission
      ? [
          {
            id: 'actions',
            header: () => <div className="text-right">Aksi</div>,
            cell: ({ row }: { row: { original: RoomClinicalPackage } }) => {
              const assignment = row.original;
              const isBusy = processingKey === `toggle-${assignment.id}` || processingKey === `remove-${assignment.id}`;
              return (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleAssignment(assignment)}
                    disabled={isBusy}
                    className="h-7 w-7"
                  >
                    {processingKey === `toggle-${assignment.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : assignment.is_active ? (
                      <Power className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeAssignment(assignment)}
                    disabled={isBusy}
                  >
                    {processingKey === `remove-${assignment.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              );
            },
          } as ColumnDef<RoomClinicalPackage>,
        ]
      : []),
  ], [hasPermission, processingKey]);

  return (
    <DataTable
      columns={columns}
      data={assignments}
      searchPlaceholder="Cari paket klinis..."
      hideRowCount
      toolbarRight={
        hasPermission && onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Paket
          </Button>
        ) : undefined
      }
    />
  );
}