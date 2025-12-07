import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { District } from '@/lib/api';

interface DistrictColumnsProps {
  onView: (district: District) => void;
  onEdit: (district: District) => void;
}

export function createDistrictColumns({
  onView,
  onEdit,
}: DistrictColumnsProps): ColumnDef<District>[] {
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
      header: 'Nama Kecamatan',
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
        const district = row.original;

        return (
          <div className='text-right'>
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
              <DropdownMenuItem onClick={() => onView(district)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(district)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
