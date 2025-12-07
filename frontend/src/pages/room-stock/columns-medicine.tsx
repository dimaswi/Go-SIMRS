import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, RefreshCw } from 'lucide-react';

interface RoomMedicine {
  id: number;
  room_id: number;
  medicine_id: number;
  quantity: number;
  min_quantity: number;
  notes: string;
  room?: { id: number; name: string; code: string };
  medicine?: { id: number; name: string; code: string; unit: string };
}

interface ColumnOptions {
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onAdjust: (id: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createRoomMedicineColumns(options: ColumnOptions): ColumnDef<RoomMedicine>[] {
  const { onEdit, onDelete, onAdjust, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: 'room.name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Ruangan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const room = row.original.room;
        return (
          <div className="font-medium">
            {room?.name || '-'}
            <div className="text-xs text-muted-foreground">{room?.code}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'medicine.name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Obat
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const medicine = row.original.medicine;
        return (
          <div className="font-medium">
            {medicine?.name || '-'}
            <div className="text-xs text-muted-foreground">{medicine?.code}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Stok
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const quantity = row.original.quantity;
        const minQuantity = row.original.min_quantity;
        const unit = row.original.medicine?.unit || '';
        const isLow = minQuantity > 0 && quantity < minQuantity;
        
        return (
          <div>
            <Badge variant={isLow ? 'destructive' : 'secondary'}>
              {quantity} {unit}
            </Badge>
            {isLow && (
              <div className="text-xs text-destructive mt-1">
                Stok minimum: {minQuantity}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'min_quantity',
      header: 'Min. Stok',
      cell: ({ row }) => {
        const unit = row.original.medicine?.unit || '';
        return `${row.original.min_quantity} ${unit}`;
      },
    },
    {
      accessorKey: 'notes',
      header: 'Catatan',
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate" title={row.original.notes}>
          {row.original.notes || '-'}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasEditPermission && (
                <>
                  <DropdownMenuItem onClick={() => onAdjust(item.id)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sesuaikan Stok
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(item.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                </>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(item.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
