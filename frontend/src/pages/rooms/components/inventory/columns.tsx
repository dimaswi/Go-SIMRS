import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import type { RoomInventory, InventoryCategory } from "@/lib/api/inventories";
import { inventoryCategoryLabels } from "@/lib/api/inventories";
import { cn } from "@/lib/utils";

const getCategoryBadgeColor = (category: InventoryCategory) => {
  const colorMap: Record<InventoryCategory, string> = {
    medical: "bg-red-100 text-red-800",
    non_medical: "bg-blue-100 text-blue-800",
    consumable: "bg-yellow-100 text-yellow-800",
    equipment: "bg-purple-100 text-purple-800",
    furniture: "bg-orange-100 text-orange-800",
    electronic: "bg-cyan-100 text-cyan-800",
    infrastructure: "bg-gray-100 text-gray-800",
  };
  return colorMap[category] || "bg-gray-100 text-gray-800";
};

export function createInventoryColumns(): ColumnDef<RoomInventory>[] {
  return [
    {
      accessorKey: "inventory.code",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kode
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium text-sm">
          {row.original.inventory?.code || "-"}
        </span>
      ),
    },
    {
      accessorKey: "inventory.name",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Nama Inventaris
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.inventory?.name || "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "inventory.category",
      header: "Kategori",
      cell: ({ row }) => {
        const category = row.original.inventory?.category;
        if (!category) return <span className="text-muted-foreground">-</span>;
        
        return (
          <Badge
            variant="outline"
            className={cn("text-xs", getCategoryBadgeColor(category))}
          >
            {inventoryCategoryLabels[category] || category}
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Stok
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        const minQuantity = row.original.min_quantity;
        const isLowStock = quantity <= minQuantity;

        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-semibold",
                isLowStock ? "text-yellow-600" : "text-foreground"
              )}
            >
              {quantity}
            </span>
            {isLowStock && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-[10px]">
                Rendah
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "min_quantity",
      header: () => <div className="text-right">Min. Stok</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {row.getValue("min_quantity")}
        </div>
      ),
    },
    {
      accessorKey: "inventory.unit",
      header: "Satuan",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.inventory?.unit || "-"}
        </span>
      ),
    },
    {
      accessorKey: "location",
      header: "Lokasi",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.getValue("location") || "-"}
        </span>
      ),
    },
  ];
}
