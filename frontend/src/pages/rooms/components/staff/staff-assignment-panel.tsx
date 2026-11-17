import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import type { RoomStaff, MasterData } from "@/lib/api";

interface StaffAssignmentPanelProps {
  masterData: Record<string, MasterData[]>;
  staff: RoomStaff[];
  hasPermission: boolean;
  onAdd?: () => void;
  onDelete?: (staffId: number) => void;
}

export function StaffAssignmentPanel({
  masterData,
  staff,
  hasPermission,
  onAdd,
  onDelete,
}: StaffAssignmentPanelProps) {
  const getRoleTypeName = (code: string) => {
    const role = masterData.room_staff_role?.find((item) => item.code === code);
    return role?.name || code;
  };

  const columns = useMemo<ColumnDef<RoomStaff>[]>(() => [
    {
      id: "pegawai",
      accessorFn: (row) => row.employee?.nama_lengkap || "Unknown",
      header: "Pegawai",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{row.original.employee?.nama_lengkap || "Unknown"}</span>
          {row.original.is_primary ? (
            <Badge variant="secondary" className="h-4 text-[10px] px-1.5 font-normal">
              Utama
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "nip",
      accessorFn: (row) => row.employee?.nip || "-",
      header: "NIP",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.employee?.nip || "-"}</span>
      ),
    },
    {
      id: "tipe",
      accessorFn: (row) => row.employee?.tipe_karyawan || "-",
      header: "Tipe",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.employee?.tipe_karyawan || "-"}</span>
      ),
    },
    {
      accessorKey: "role_type",
      header: "Peran",
      cell: ({ row }) => (
        <Badge variant="outline" className="h-5 text-[10px] font-normal">
          {getRoleTypeName(row.original.role_type)}
        </Badge>
      ),
    },
    {
      accessorKey: "notes",
      header: "Catatan",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.notes || "-"}</span>
      ),
    },
    ...(hasPermission && onDelete
      ? [
          {
            id: "actions",
            header: () => <div className="text-right">Aksi</div>,
            cell: ({ row }: { row: { original: RoomStaff } }) => (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          } as ColumnDef<RoomStaff>,
        ]
      : []),
  ], [hasPermission, onDelete, masterData]);

  return (
    <DataTable
      columns={columns}
      data={staff}
      searchPlaceholder="Cari staff..."
      hideRowCount
      toolbarRight={
        hasPermission && onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Staff
          </Button>
        ) : undefined
      }
    />
  );
}
