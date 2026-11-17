import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { 
  Inventory, 
  InventoryCategory,
  InventoryItemGroup,
  InventoryItemScope,
} from "@/lib/api/inventories";
import { inventoryItemGroupLabels, inventoryItemScopeLabels } from "@/lib/api/inventories";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasViewPermission: boolean;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

const categoryColors: Record<InventoryCategory, string> = {
  medical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  non_medical: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  consumable: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  equipment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  furniture: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  electronic: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  infrastructure: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

const categoryLabels: Record<InventoryCategory, string> = {
  medical: 'Alat Medis',
  non_medical: 'Non-Medis',
  consumable: 'Habis Pakai',
  equipment: 'Peralatan',
  furniture: 'Furniture',
  electronic: 'Elektronik',
  infrastructure: 'Infrastruktur',
};

const itemGroupColors: Record<InventoryItemGroup, string> = {
  bhp: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const itemScopeColors: Record<InventoryItemScope, string> = {
  unit: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  pharmacy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  both: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

export function createInventoryColumns(options: ColumnOptions): ColumnDef<Inventory>[] {
  const { onView, onEdit, onDelete, hasViewPermission, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "code",
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
        <span className="font-mono font-medium">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
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
        <button
          onClick={() => onView(row.original.id)}
          className="text-left hover:underline text-primary font-medium"
        >
          {row.getValue("name")}
        </button>
      ),
    },
    {
      accessorKey: "category",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kategori
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.getValue("category") as InventoryCategory;
        return (
          <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>
            {categoryLabels[category] || category}
          </Badge>
        );
      },
    },
    {
      accessorKey: "item_group",
      header: "Kelompok",
      cell: ({ row }) => {
        const group = row.getValue("item_group") as InventoryItemGroup;
        return (
          <Badge className={itemGroupColors[group] || "bg-gray-100 text-gray-800"}>
            {inventoryItemGroupLabels[group] || group}
          </Badge>
        );
      },
    },
    {
      accessorKey: "item_scope",
      header: "Pengelola",
      cell: ({ row }) => {
        const scope = row.getValue("item_scope") as InventoryItemScope;
        return (
          <Badge className={itemScopeColors[scope] || "bg-gray-100 text-gray-800"}>
            {inventoryItemScopeLabels[scope] || scope}
          </Badge>
        );
      },
    },
    {
      accessorKey: "brand",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Merek / Model
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const brand = row.original.brand;
        const model = row.original.model;
        if (!brand && !model) return <span className="text-muted-foreground">-</span>;
        return (
          <span>
            {brand || ''}{brand && model ? ' - ' : ''}{model || ''}
          </span>
        );
      },
    },
    {
      accessorKey: "unit",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Satuan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.getValue("unit"),
    },
    {
      accessorKey: "current_stock",
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
        const currentStock = row.original.current_stock;
        const minStock = row.original.min_stock;
        const isLowStock = currentStock <= minStock;
        
        return (
          <div className="flex items-center gap-2">
            <span className={isLowStock ? 'text-red-600 font-semibold' : ''}>
              {currentStock}
            </span>
            {isLowStock && (
              <Badge variant="destructive" className="text-xs">
                Stok Rendah
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Harga Satuan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const price = row.getValue("price") as number;
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(price);
      },
    },
    {
      accessorKey: "is_active",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Aktif" : "Tidak Aktif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const id = row.original.id;
        const hasAnyPermission = hasViewPermission || hasEditPermission || hasDeletePermission;

        if (!hasAnyPermission) return null;

        return (
          <div className="flex items-center justify-end gap-1">
            {hasViewPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
                onClick={() => onView(id)}
                title="Lihat Detail"
              >
                <Eye className="size-3.5" />
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(id)}
                title="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
                onClick={() => onDelete(id)}
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
