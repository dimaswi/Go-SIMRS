import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Trash2 } from "lucide-react";
import type { RoomStaff, MasterData } from "@/lib/api";

interface ColumnOptions {
  onRemove: (id: number) => void;
  hasPermission: boolean;
  masterData: Record<string, MasterData[]>;
}

export function createStaffColumns(
  options: ColumnOptions
): ColumnDef<RoomStaff>[] {
  const { onRemove, hasPermission, masterData } = options;

  const getRoleTypeName = (code: string) => {
    const role = masterData.room_staff_role?.find((r) => r.code === code);
    return role?.name || code;
  };

  return [
    {
      accessorKey: "employee.nama_lengkap",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Nama Pegawai
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {row.original.employee?.nama_lengkap || "Unknown"}
          </span>
          {row.original.is_primary && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              Utama
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "employee.nip",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          NIP
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.employee?.nip || "-"}
        </span>
      ),
    },
    {
      accessorKey: "employee.tipe_karyawan",
      header: "Tipe Karyawan",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.employee?.tipe_karyawan || "-"}
        </span>
      ),
    },
    {
      accessorKey: "role_type",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Peran
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {getRoleTypeName(row.getValue("role_type"))}
        </Badge>
      ),
    },
    {
      accessorKey: "notes",
      header: "Catatan",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.getValue("notes") || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-center">Aksi</div>,
      cell: ({ row }) => {
        if (!hasPermission) return null;

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
}
