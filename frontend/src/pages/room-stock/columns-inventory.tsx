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

interface RoomInventory {
  id: number;
  room_id: number;
  inventory_id: number;
  quantity: number;
  min_quantity: number;
  notes: string;
  room?: { id: number; name: string; code: string };
  inventory?: { id: number; name: string; code: string; unit: string; category: string };
}

interface ColumnOptions {
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onAdjust: (id: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

const categoryLabels: Record<string, string> = {
  medical: 'Alat Medis',
  non_medical: 'Non-Medis',
  consumable: 'Habis Pakai',
  equipment: 'Peralatan',
  furniture: 'Furniture',
  electronic: 'Elektronik',
  infrastructure: 'Infrastruktur',
};

export function createRoomInventoryColumns(options: ColumnOptions): ColumnDef<RoomInventory>[] {
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
      accessorKey: 'inventory.name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Inventaris
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const inventory = row.original.inventory;
        return (
          <div className="font-medium">
            {inventory?.name || '-'}
            <div className="text-xs text-muted-foreground">{inventory?.code}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'inventory.category',
      header: 'Kategori',
      cell: ({ row }) => {
        const category = row.original.inventory?.category || '';
        return (
          <Badge variant="outline">
            {categoryLabels[category] || category}
          </Badge>
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
        const unit = row.original.inventory?.unit || '';
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
        const unit = row.original.inventory?.unit || '';
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
