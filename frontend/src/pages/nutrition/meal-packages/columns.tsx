import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, Flame } from "lucide-react";
import { type NutritionPackage, nutritionDietTypeLabels, nutritionMealTimeLabels } from "@/lib/api/nutrition";

interface ColumnActions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  dietTypeMap?: Record<string, string>;
}

export function createNutritionPackageColumns(actions: ColumnActions): ColumnDef<NutritionPackage>[] {
  const resolveDietLabel = (value: string) =>
    actions.dietTypeMap?.[value] || nutritionDietTypeLabels[value] || value;

  return [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Nama Paket",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "diet_type",
      header: "Jenis Diet",
      cell: ({ row }) => (
        <Badge variant="outline">{resolveDietLabel(row.original.diet_type)}</Badge>
      ),
    },
    {
      accessorKey: "meal_time",
      header: "Waktu Makan",
      cell: ({ row }) => (
        <Badge variant="secondary">{nutritionMealTimeLabels[row.original.meal_time] || row.original.meal_time}</Badge>
      ),
    },
    {
      accessorKey: "total_calories",
      header: "Kalori",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Flame className="h-3 w-3 text-orange-500" />
          {row.original.total_calories} kkal
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: "Item",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.items?.length || 0} menu</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const pkg = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => actions.onView(pkg.id)}
              title="Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
              onClick={() => actions.onEdit(pkg.id)}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
              onClick={() => actions.onDelete(pkg.id)}
              title="Hapus"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];
}
