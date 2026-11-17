import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Eye, ArrowUpDown } from 'lucide-react';
import { type Province } from '@/lib/api';

interface ColumnOptions {
  onView: (id: string) => void;
}

export const createProvinceColumns = ({
  onView,
}: ColumnOptions): ColumnDef<Province>[] => [
  {
    accessorKey: 'name',
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Nama Provinsi
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <button
        onClick={() => onView(row.original.id)}
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
      const province = row.original;

      return (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
            onClick={() => onView(province.id)}
            title="Lihat Detail"
          >
            <Eye className="size-3.5" />
          </Button>
        </div>
      );
    },
  },
];
