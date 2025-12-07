import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, ArrowUpDown } from 'lucide-react';
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
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Buka menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onView(province.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
