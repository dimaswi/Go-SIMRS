import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { RoomClinicalPackage } from '@/lib/api/clinical-packages';
import { Package, X } from 'lucide-react';

interface ClinicalPackageSelectorProps {
  assignments: RoomClinicalPackage[];
  selectedPackageId?: number | null;
  onValueChange: (packageId: number | null) => void;
  loading?: boolean;
}

export function ClinicalPackageSelector({
  assignments,
  selectedPackageId,
  onValueChange,
  loading = false,
}: ClinicalPackageSelectorProps) {
  const options = assignments
    .filter((assignment) => assignment.clinical_package)
    .map((assignment) => ({
      value: String(assignment.clinical_package_id),
      label: `${assignment.clinical_package?.code || '-'} - ${assignment.clinical_package?.name || 'Paket'}`,
    }));

  const selectedAssignment = assignments.find((assignment) => assignment.clinical_package_id === selectedPackageId);
  const selectedPackage = selectedAssignment?.clinical_package;

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            Paket Klinis
          </div>
          <p className="text-xs text-muted-foreground">
            Pilih paket untuk mengisi otomatis tindakan dan obat sesuai pengaturan ruangan.
          </p>
        </div>
        {selectedPackageId ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onValueChange(null)}>
            <X className="mr-2 h-4 w-4" /> Reset
          </Button>
        ) : null}
      </div>

      <Combobox
        options={options}
        value={selectedPackageId ? String(selectedPackageId) : ''}
        onValueChange={(value) => onValueChange(value ? Number(value) : null)}
        placeholder={loading ? 'Memuat paket klinis...' : assignments.length > 0 ? 'Pilih paket klinis...' : 'Belum ada paket klinis aktif'}
        searchPlaceholder="Cari paket klinis..."
        emptyText="Tidak ada paket klinis"
        loading={loading}
        disabled={!loading && assignments.length === 0}
      />

      {!loading && assignments.length === 0 ? (
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Belum ada paket klinis aktif yang di-assign ke ruangan ini. Tambahkan assignment paket pada master ruangan terlebih dahulu.
        </div>
      ) : null}

      {selectedPackage ? (
        <div className="rounded-md bg-muted/40 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{selectedPackage.name}</p>
              <p className="text-muted-foreground font-mono">{selectedPackage.code}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{selectedPackage.procedure_items?.length || 0} tindakan</Badge>
              <Badge variant="outline">{selectedPackage.medicine_items?.length || 0} obat</Badge>
            </div>
          </div>
          {selectedPackage.description ? (
            <p className="text-muted-foreground">{selectedPackage.description}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}