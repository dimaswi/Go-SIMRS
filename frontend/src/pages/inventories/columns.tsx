import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { 
  Inventory, 
  InventoryCategory
} from "@/lib/api/inventories";

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
      cell: ({ row }) => {
        const id = row.original.id;
        const hasAnyPermission = hasViewPermission || hasEditPermission || hasDeletePermission;

        if (!hasAnyPermission) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Buka menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasViewPermission && (
                <DropdownMenuItem onClick={() => onView(id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Lihat Detail
                </DropdownMenuItem>
              )}
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(id)}
                    className="text-destructive focus:text-destructive"
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
