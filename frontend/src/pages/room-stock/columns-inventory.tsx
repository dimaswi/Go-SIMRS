import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, ArrowUpDown, RefreshCw } from 'lucide-react';

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
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex items-center justify-end gap-1">
            {hasEditPermission && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-none border border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-100/50 size-7 p-0 shadow-none"
                  onClick={() => onAdjust(item.id)}
                  title="Sesuaikan Stok"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                  onClick={() => onEdit(item.id)}
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </>
            )}
            {hasDeletePermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
                onClick={() => onDelete(item.id)}
                title="Hapus"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
