import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clinicalPackagesApi, roomClinicalPackagesApi, type ClinicalPackage, type RoomClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, PlusCircle, Power, Trash2, X, Search } from 'lucide-react';

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
  const [availableSearch, setAvailableSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');

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

  const filteredAvailablePackages = useMemo(() => {
    const query = availableSearch.trim().toLowerCase();
    if (!query) return availablePackages;

    return availablePackages.filter((pkg) =>
      [pkg.name, pkg.code, pkg.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [availablePackages, availableSearch]);

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

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <X className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Tersedia ({availablePackages.length})</h2>
              <p className="text-xs text-muted-foreground">Paket aktif yang belum ditugaskan ke ruangan ini.</p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={availableSearch} onChange={(event) => setAvailableSearch(event.target.value)} placeholder="Cari paket tersedia..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[40%] px-3 py-2.5 font-medium">Paket</th>
                    <th className="w-[28%] px-3 py-2.5 font-medium">Isi</th>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Status</th>
                    <th className="w-[14%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAvailablePackages.map((pkg) => (
                    <tr key={pkg.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium break-words">{pkg.name}</div>
                        <div className="text-xs text-muted-foreground break-words">{pkg.code}</div>
                        {pkg.description ? <div className="mt-1 text-xs text-muted-foreground break-words">{pkg.description}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{pkg.procedure_items?.length || 0} tindakan</Badge>
                          <Badge variant="outline">{pkg.medicine_items?.length || 0} obat</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge variant={pkg.is_active ? 'default' : 'secondary'} className="text-[10px]">{pkg.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      <td className="px-3 py-3 text-right">
                        {hasPermission ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleAdd(pkg.id)} disabled={processingKey === `add-${pkg.id}`} className="h-8">
                            {processingKey === `add-${pkg.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4 text-green-600" />}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Ditugaskan ({assignments.length})</h2>
              <p className="text-xs text-muted-foreground">Paket klinis yang tersedia saat pendaftaran untuk ruangan ini.</p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={assignedSearch} onChange={(event) => setAssignedSearch(event.target.value)} placeholder="Cari paket ditugaskan..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[40%] px-3 py-2.5 font-medium">Paket</th>
                    <th className="w-[28%] px-3 py-2.5 font-medium">Isi</th>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Status</th>
                    <th className="w-[14%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium break-words">{assignment.clinical_package?.name || `Paket #${assignment.clinical_package_id}`}</div>
                        <div className="text-xs text-muted-foreground break-words">{assignment.clinical_package?.code || '-'}</div>
                        {assignment.clinical_package?.description ? <div className="mt-1 text-xs text-muted-foreground break-words">{assignment.clinical_package.description}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{assignment.clinical_package?.procedure_items?.length || 0} tindakan</Badge>
                          <Badge variant="outline">{assignment.clinical_package?.medicine_items?.length || 0} obat</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge variant={assignment.is_active ? 'default' : 'secondary'} className="text-[10px]">{assignment.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      <td className="px-3 py-3 text-right">
                        {hasPermission ? (
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
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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