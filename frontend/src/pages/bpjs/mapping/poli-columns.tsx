import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Users } from "lucide-react";
import type { BPJSPoliMapping } from "@/lib/api/bpjs";

interface ColumnOptions {
  onEdit: (mapping: BPJSPoliMapping) => void;
  onDelete: (mapping: BPJSPoliMapping) => void;
  onManageDoctors: (mapping: BPJSPoliMapping) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createPoliMappingColumns(options: ColumnOptions): ColumnDef<BPJSPoliMapping>[] {
  const { onEdit, onDelete, onManageDoctors, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "room_code",
      header: "Kode Ruangan",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.room_code}</span>
      ),
    },
    {
      accessorKey: "room_name",
      header: "Nama Ruangan",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.room_name}</span>
      ),
    },
    {
      accessorKey: "kode_poli_bpjs",
      header: "Kode Poli BPJS",
      cell: ({ row }) => (
        <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
          {row.original.kode_poli_bpjs}
        </span>
      ),
    },
    {
      accessorKey: "nama_poli_bpjs",
      header: "Nama Poli BPJS",
    },
    {
      accessorKey: "doctor_mappings",
      header: "Dokter",
      cell: ({ row }) => {
        const count = row.original.doctor_mappings?.length || 0;
        return (
          <Badge variant={count > 0 ? "default" : "secondary"}>
            {count} dokter
          </Badge>
        );
      },
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
      header: "Aksi",
      cell: ({ row }) => {
        const mapping = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onManageDoctors(mapping)}>
                <Users className="mr-2 h-4 w-4" />
                Kelola Dokter
              </DropdownMenuItem>
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(mapping)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <DropdownMenuItem
                  onClick={() => onDelete(mapping)}
                  className="text-destructive focus:text-destructive"
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
