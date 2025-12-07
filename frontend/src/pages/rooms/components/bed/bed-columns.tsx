import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Bed } from "@/lib/api";

interface ColumnOptions {
  onEdit: (bed: Bed) => void;
  onDelete: (id: number) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  getMasterDataName: (category: string, code: string) => string;
}

// Map status to badge variant
function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'available':
      return 'default';
    case 'occupied':
      return 'destructive';
    case 'reserved':
      return 'secondary';
    case 'maintenance':
    case 'cleaning':
    case 'out_of_service':
      return 'outline';
    default:
      return 'outline';
  }
}

export function createBedColumns(options: ColumnOptions): ColumnDef<Bed>[] {
  const { onEdit, onDelete, hasEditPermission, hasDeletePermission, getMasterDataName } = options;

  return [
    {
      accessorKey: "bed_number",
      header: "No. Tempat Tidur",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("bed_number")}</span>
      ),
    },
    {
      accessorKey: "bed_type",
      header: "Tipe",
      cell: ({ row }) => {
        const bedType = row.getValue("bed_type") as string;
        return bedType ? getMasterDataName('bed_type', bedType) : '-';
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={getStatusBadgeVariant(status)}>
            {getMasterDataName('bed_status', status)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Catatan",
      cell: ({ row }) => {
        const notes = row.getValue("notes") as string;
        return notes ? (
          <span className="text-sm text-muted-foreground">{notes}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const bed = row.original;

        if (!hasEditPermission && !hasDeletePermission) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(bed)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && bed.status !== 'occupied' && (
                <DropdownMenuItem
                  onClick={() => onDelete(bed.id)}
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
