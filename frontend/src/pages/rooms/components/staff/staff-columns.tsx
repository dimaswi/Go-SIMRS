import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Star } from "lucide-react";
import type { RoomStaff } from "@/lib/api";

interface ColumnOptions {
  onDelete: (id: number) => void;
  hasDeletePermission: boolean;
  getMasterDataName: (category: string, code: string) => string;
}

export function createStaffColumns(options: ColumnOptions): ColumnDef<RoomStaff>[] {
  const { onDelete, hasDeletePermission, getMasterDataName } = options;

  return [
    {
      accessorKey: "employee.nama_lengkap",
      header: "Nama Staff",
      cell: ({ row }) => {
        const employee = row.original.employee;
        const isPrimary = row.original.is_primary;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{employee?.nama_lengkap || '-'}</span>
            {isPrimary && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "employee.nip",
      header: "NIP",
      cell: ({ row }) => {
        const employee = row.original.employee;
        return employee?.nip || '-';
      },
    },
    {
      accessorKey: "role_type",
      header: "Peran",
      cell: ({ row }) => {
        const roleType = row.getValue("role_type") as string;
        return (
          <Badge variant="outline">
            {getMasterDataName('room_staff_role', roleType)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "employee.tipe_karyawan",
      header: "Tipe Karyawan",
      cell: ({ row }) => {
        const employee = row.original.employee;
        return employee?.tipe_karyawan || '-';
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
        const staff = row.original;

        if (!hasDeletePermission) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(staff.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus dari Ruangan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
