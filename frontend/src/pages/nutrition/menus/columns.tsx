import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import type { NutritionMenu } from "@/lib/api/nutrition";
import { nutritionCategoryLabels, nutritionCategoryColors } from "@/lib/api/nutrition";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createNutritionMenuColumns(options: ColumnOptions): ColumnDef<NutritionMenu>[] {
  const { onView, onEdit, onDelete, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "code",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0 hover:bg-transparent">
          Kode <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono font-medium text-xs">{row.getValue("code")}</span>,
    },
    {
      accessorKey: "name",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0 hover:bg-transparent">
          Nama Menu <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const menu = row.original;
        return (
          <div>
            <div className="font-medium">{menu.name}</div>
            {menu.description && <div className="text-xs text-muted-foreground line-clamp-1">{menu.description}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Kategori",
      cell: ({ row }) => {
        const category = row.getValue("category") as string;
        return (
          <Badge variant="outline" className={nutritionCategoryColors[category] || ''}>
            {nutritionCategoryLabels[category] || category}
          </Badge>
        );
      },
    },
    {
      accessorKey: "calories",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0 hover:bg-transparent">
          Kalori <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const menu = row.original;
        return (
          <div className="text-xs">
            <div><span className="font-medium">{menu.calories}</span> kkal</div>
            <div className="text-muted-foreground">P:{menu.protein}g L:{menu.fat}g K:{menu.carbohydrate}g</div>
          </div>
        );
      },
    },
    {
      accessorKey: "unit_price",
      header: "Harga",
      cell: ({ row }) => {
        const price = row.getValue("unit_price") as number;
        return price > 0 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price) : "-";
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const menu = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(menu.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {hasEditPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(menu.id)}
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
                onClick={() => onDelete(menu.id)}
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
