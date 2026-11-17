import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Eye, Pencil, Trash2 } from "lucide-react";
import type { NutritionIngredient } from "@/lib/api/nutrition";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createNutritionIngredientColumns(options: ColumnOptions): ColumnDef<NutritionIngredient>[] {
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
          Nama Bahan <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <div className="font-medium">{item.name}</div>
            {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "default_unit",
      header: "Satuan",
      cell: ({ row }) => <span className="text-xs uppercase">{String(row.getValue("default_unit") || "-").replace("_", " ")}</span>,
    },
    {
      accessorKey: "default_weight",
      header: "Berat Default",
      cell: ({ row }) => {
        const item = row.original;
        return <span className="text-xs">{item.default_weight || 0} {String(item.default_unit || "").replace("_", " ")}</span>;
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Aktif" : "Nonaktif"}</Badge>;
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(item.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {hasEditPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(item.id)}
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
