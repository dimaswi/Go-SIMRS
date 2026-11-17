import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Village } from '@/lib/api';

interface VillageColumnsProps {
  onView: (village: Village) => void;
  onEdit: (village: Village) => void;
}

export function createVillageColumns({
  onView,
  onEdit,
}: VillageColumnsProps): ColumnDef<Village>[] {
  return [
    // {
    //   accessorKey: 'id',
    //   header: 'Kode',
    //   cell: ({ row }) => (
    //     <span className="font-mono text-sm">{row.getValue('id')}</span>
    //   ),
    // },
    {
      accessorKey: 'name',
      header: 'Nama Desa/Kelurahan',
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original)}
          className="font-medium text-primary hover:underline text-left"
        >
          {row.getValue('name')}
        </button>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const village = row.original;

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(village)}
              title="Lihat"
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
              onClick={() => onEdit(village)}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];
}
