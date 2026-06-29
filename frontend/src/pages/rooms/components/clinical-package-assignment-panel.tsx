import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roomClinicalPackagesApi, type RoomClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, Power, Trash2, Search, Plus } from 'lucide-react';

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
  const [assignedSearch, setAssignedSearch] = useState('');

  const filteredAssignments = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    if (!query) return assignments;

    return assignments.filter((assignment) =>
      [assignment.clinical_package?.name, assignment.clinical_package?.code, assignment.clinical_package?.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [assignments, assignedSearch]);

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

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <div className="border-b border-border/70 bg-muted/20 p-3 flex justify-between">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={assignedSearch}
              onChange={(event) => setAssignedSearch(event.target.value)}
              placeholder="Cari paket klinis..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {hasPermission && onAdd && (
              <Button onClick={onAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Paket
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/50 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Paket</th>
                <th className="px-4 py-3 font-medium">Isi</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {hasPermission && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-background">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={hasPermission ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada paket klinis yang ditugaskan ke ruangan ini.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="align-middle hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{assignment.clinical_package?.name || `Paket #${assignment.clinical_package_id}`}</div>
                      <div className="text-xs text-muted-foreground">{assignment.clinical_package?.code || '-'}</div>
                      {assignment.clinical_package?.description && <div className="mt-1 text-xs text-muted-foreground">{assignment.clinical_package.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">{assignment.clinical_package?.procedure_items?.length || 0} tindakan</Badge>
                        <Badge variant="outline" className="text-[10px] font-normal">{assignment.clinical_package?.medicine_items?.length || 0} obat</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={assignment.is_active ? 'default' : 'secondary'} className="text-[10px] font-normal">
                        {assignment.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    {hasPermission && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleAssignment(assignment)}
                            disabled={processingKey === `toggle-${assignment.id}` || processingKey === `remove-${assignment.id}`}
                            className="h-8 w-8"
                          >
                            {processingKey === `toggle-${assignment.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : assignment.is_active ? <Power className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-600" />}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeAssignment(assignment)}
                            disabled={processingKey === `toggle-${assignment.id}` || processingKey === `remove-${assignment.id}`}
                          >
                            {processingKey === `remove-${assignment.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}