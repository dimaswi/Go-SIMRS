import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  type RoomInventory,
  type InventoryCategory,
  inventoryCategoryLabels,
} from "@/lib/api/inventories";
import { cn } from "@/lib/utils";

interface CreateRoomInventoryColumnsOptions {
  onEdit: (roomInventory: RoomInventory) => void;
  onDelete: (roomInventoryId: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

const getCategoryBadgeColor = (category: InventoryCategory): string => {
  const colorMap: Record<InventoryCategory, string> = {
    medical: "bg-red-100 text-red-800",
    non_medical: "bg-blue-100 text-blue-800",
    consumable: "bg-yellow-100 text-yellow-800",
    equipment: "bg-purple-100 text-purple-800",
    furniture: "bg-orange-100 text-orange-800",
    electronic: "bg-cyan-100 text-cyan-800",
    infrastructure: "bg-gray-100 text-gray-800",
  };
  return colorMap[category] || "";
};

export function createRoomInventoryColumns({
  onEdit,
  onDelete,
  hasEditPermission,
  hasDeletePermission,
}: CreateRoomInventoryColumnsOptions): ColumnDef<RoomInventory>[] {
  return [
    {
      accessorKey: "inventory.code",
      header: "Kode",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.inventory?.code || "-"}
        </span>
      ),
    },
    {
      accessorKey: "inventory.name",
      header: "Nama Inventaris",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.inventory?.name || "-"}</div>
          {row.original.inventory?.brand && (
            <div className="text-xs text-muted-foreground">
              {row.original.inventory.brand}
              {row.original.inventory.model && ` - ${row.original.inventory.model}`}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "inventory.category",
      header: "Kategori",
      cell: ({ row }) => {
        const category = row.original.inventory?.category;
        if (!category) return "-";
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", getCategoryBadgeColor(category))}
          >
            {inventoryCategoryLabels[category]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Jumlah",
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-semibold">{row.original.quantity}</span>
          {row.original.inventory?.unit && (
            <span className="text-muted-foreground ml-1 text-sm">
              {row.original.inventory.unit}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "min_quantity",
      header: "Min. Stok",
      cell: ({ row }) => {
        const min = row.original.min_quantity;
        const current = row.original.quantity;
        const isLow = min > 0 && current < min;
        return (
          <div className="text-center">
            {min > 0 ? (
              <span className={isLow ? "text-destructive font-medium" : ""}>
                {min}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const min = row.original.min_quantity;
        const current = row.original.quantity;
        if (min > 0 && current < min) {
          return (
            <Badge variant="destructive" className="text-xs">
              Stok Rendah
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            Normal
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center gap-1">
          {hasEditPermission && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasDeletePermission && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
