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
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
            title="Lihat Detail"
            onClick={() => onView(row.original.id)}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
            title="Edit"
            onClick={() => onEdit(row.original.id)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
            title="Hapus"
            onClick={() => onDelete(row.original.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}