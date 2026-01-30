import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Employee, MasterData } from "@/lib/api";
import { Loader2, PlusCircle, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateAvailableStaffColumnsProps {
  onAdd: (employeeId: number, roleType: string) => void;
  hasPermission: boolean;
  addingId: number | null;
  masterData: Record<string, MasterData[]>;
  roleSelections: Record<number, string>;
  onRoleChange: (employeeId: number, roleType: string) => void;
  assignedEmployeeIds: number[]; // Add this to track assigned employees
}

export const createAvailableStaffColumns = ({
  onAdd,
  hasPermission,
  addingId,
  masterData,
  roleSelections,
  onRoleChange,
  assignedEmployeeIds,
}: CreateAvailableStaffColumnsProps): ColumnDef<Employee>[] => [
  {
    accessorKey: "nama_lengkap",
    header: "Nama Pegawai",
    cell: ({ row }) => {
      const isAssigned = assignedEmployeeIds.includes(row.original.id);
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.nama_lengkap}</span>
          {isAssigned && (
            <Badge variant="secondary" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Ditugaskan
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "nip",
    header: "NIP",
    cell: ({ row }) => {
      return <div className="text-sm">{row.original.nip || "-"}</div>;
    },
  },
  {
    accessorKey: "tipe_karyawan",
    header: "Tipe Karyawan",
    cell: ({ row }) => {
      return <div className="text-sm">{row.original.tipe_karyawan || "-"}</div>;
    },
  },
  {
    id: "role",
    header: "Peran di Ruangan",
    cell: ({ row }) => {
      const employee = row.original;
      const roleOptions = masterData.room_staff_role || [];
      const selectedRole = roleSelections[employee.id] || "";

      if (!hasPermission) return null;

      return (
        <Select
          value={selectedRole}
          onValueChange={(value) => onRoleChange(employee.id, value)}
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Pilih peran..." />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((role) => (
              <SelectItem key={role.code} value={role.code}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const employee = row.original;
      const selectedRole = roleSelections[employee.id] || "";
      const isAssigned = assignedEmployeeIds.includes(employee.id);
      
      if (!hasPermission) return null;

      return (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAdd(employee.id, selectedRole)}
          disabled={addingId === employee.id || !selectedRole || isAssigned}
          className="h-8"
          title={isAssigned ? "Pegawai sudah ditugaskan" : ""}
        >
          {addingId === employee.id ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menambahkan...
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4 text-green-500" />
            </>
          )}
        </Button>
      );
    },
  },
];
