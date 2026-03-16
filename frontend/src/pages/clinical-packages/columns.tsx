import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ClinicalPackage } from '@/lib/api/clinical-packages';
import { Eye, Pencil, Trash2 } from 'lucide-react';

interface ClinicalPackageColumnsOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export function createClinicalPackageColumns({ onView, onEdit, onDelete }: ClinicalPackageColumnsOptions): ColumnDef<ClinicalPackage>[] {
  return [
    {
      accessorKey: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Nama Paket',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description ? (
            <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'summary',
      header: 'Isi Paket',
      cell: ({ row }) => (
        <div className="flex gap-2 text-xs">
          <Badge variant="outline">{row.original.procedure_items?.length || 0} tindakan</Badge>
          <Badge variant="outline">{row.original.medicine_items?.length || 0} obat</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onView(row.original.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(row.original.id)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(row.original.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}