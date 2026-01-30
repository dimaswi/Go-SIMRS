import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { BPJSDoctorMapping } from "@/lib/api/bpjs";

interface ColumnOptions {
  onEdit: (mapping: BPJSDoctorMapping) => void;
  onDelete: (mapping: BPJSDoctorMapping) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createDoctorMappingColumns(options: ColumnOptions): ColumnDef<BPJSDoctorMapping>[] {
  const { onEdit, onDelete, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "employee_name",
      header: "Nama Dokter (SIMRS)",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employee_name}</span>
      ),
    },
    {
      accessorKey: "kode_dokter_bpjs",
      header: "Kode Dokter BPJS",
      cell: ({ row }) => (
        <span className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
          {row.original.kode_dokter_bpjs}
        </span>
      ),
    },
    {
      accessorKey: "nama_dokter_bpjs",
      header: "Nama Dokter BPJS",
    },
    {
      accessorKey: "jadwal_hari",
      header: "Jadwal",
      cell: ({ row }) => {
        const jadwal = row.original.jadwal_hari;
        const jam = row.original.jam_praktek;
        if (!jadwal && !jam) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-sm">
            {jadwal && <div>{jadwal}</div>}
            {jam && <div className="text-muted-foreground">{jam}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "kuota_jkn",
      header: "Kuota JKN",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.kuota_jkn || 0}</Badge>
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
