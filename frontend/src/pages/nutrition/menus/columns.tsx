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
      cell: ({ row }) => {
        const menu = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(menu.id)}>
                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
              </DropdownMenuItem>
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(menu.id)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(menu.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
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
