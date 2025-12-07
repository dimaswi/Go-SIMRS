import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, BedDouble } from "lucide-react";
import type { RoomUnit, Bed } from "@/lib/api";

interface ColumnOptions {
  onView: (unit: RoomUnit) => void;
  onEdit: (unit: RoomUnit) => void;
  onDelete: (unitId: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createUnitColumns(options: ColumnOptions): ColumnDef<RoomUnit>[] {
  const { onView, onEdit, onDelete, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Kamar",
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original)}
          className="text-left hover:underline text-primary font-medium"
        >
          {row.getValue("name")}
        </button>
      ),
    },
    {
      accessorKey: "floor",
      header: "Lantai",
      cell: ({ row }) => `Lantai ${row.getValue("floor")}`,
    },
    {
      accessorKey: "beds",
      header: "Tempat Tidur",
      cell: ({ row }) => {
        const beds = row.original.beds || [];
        const capacity = row.original.capacity;
        const available = beds.filter((b: Bed) => b.status === 'available').length;
        return (
          <div className="flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            <span>{beds.length}/{capacity}</span>
            <span className="text-muted-foreground text-xs">
              ({available} tersedia)
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active");
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Aktif" : "Tidak Aktif"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const unit = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(unit)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Bed
              </DropdownMenuItem>
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(unit)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <DropdownMenuItem
                  onClick={() => onDelete(unit.id)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
