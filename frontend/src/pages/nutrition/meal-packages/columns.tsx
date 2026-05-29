import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, Flame } from "lucide-react";
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
      cell: ({ row }) => {
        const pkg = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onView(pkg.id)}>
                <Eye className="mr-2 h-4 w-4" /> Detail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onEdit(pkg.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => actions.onDelete(pkg.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
