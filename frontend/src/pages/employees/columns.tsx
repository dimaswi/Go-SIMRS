import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Eye, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { createSelectColumn } from "@/components/ui/data-table-utils"
import type { Employee, MasterData } from "@/lib/api"

interface EmployeeColumnsProps {
  onView: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  hasViewPermission: boolean
  hasEditPermission: boolean
  hasDeletePermission: boolean
  masterData: Record<string, MasterData[]>
}

// Helper function to get name from code
const getMasterDataName = (masterData: Record<string, MasterData[]>, category: string, code?: string): string => {
  if (!code) return '-';
  const items = masterData[category];
  if (!items) return code;
  const item = items.find(i => i.code === code);
  return item?.name || code;
};

export function createEmployeeColumns({
  onView,
  onEdit,
  onDelete,
  hasViewPermission,
  hasEditPermission,
  hasDeletePermission,
  masterData,
}: EmployeeColumnsProps): ColumnDef<Employee>[] {
  return [
    createSelectColumn<Employee>(),
    {
      accessorKey: "nama_lengkap",
      sortDescFirst: false,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Pegawai
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const employee = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {employee.nama_lengkap.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <button
                onClick={() => onView(employee.id)}
                className="font-medium text-primary hover:underline text-left"
              >
                {employee.nama_lengkap}
              </button>
              <span className="text-sm text-muted-foreground">{employee.nip || employee.nik}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "tipe_karyawan",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Tipe
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return (
          <Badge variant="outline" className="font-normal">
            {getMasterDataName(masterData, 'employee_type', row.getValue("tipe_karyawan"))}
          </Badge>
        )
      },
    },
    {
      accessorKey: "jabatan",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Jabatan
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-muted-foreground">{row.getValue("jabatan") || '-'}</div>
      },
    },
    {
      accessorKey: "departemen",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Departemen
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-muted-foreground">{row.getValue("departemen") || '-'}</div>
      },
    },
    {
      accessorKey: "status_kepegawaian",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const status = row.getValue("status_kepegawaian") as string
        const statusName = getMasterDataName(masterData, 'employment_status', status)
        return (
          <Badge 
            variant={status === "pns" || status === "pppk" ? "default" : "secondary"}
            className="font-normal"
          >
            {statusName}
          </Badge>
        )
      },
    },
    {
      accessorKey: "is_active",
      header: "Status Aktif",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean
        return (
          <Badge 
            variant={isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {isActive ? 'AKTIF' : 'TIDAK AKTIF'}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const employee = row.original
        return (
          <div className="flex items-center gap-1">
            {hasViewPermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onView(employee.id)}
                className="h-8 w-8"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(employee.id)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(employee.id)}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
