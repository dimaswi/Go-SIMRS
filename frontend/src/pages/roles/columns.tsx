import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { createSelectColumn } from "@/components/ui/data-table-utils"

interface Role {
  id: number;
  name: string;
  description: string;
  permissions?: Permission[];
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface RoleColumnsProps {
  onView: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  hasViewPermission: boolean
  hasEditPermission: boolean
  hasDeletePermission: boolean
}

export function createRoleColumns({
  onView,
  onEdit,
  onDelete,
  hasViewPermission,
  hasEditPermission,
  hasDeletePermission,
}: RoleColumnsProps): ColumnDef<Role>[] {
  return [
    createSelectColumn<Role>(),
    {
      accessorKey: "name",
      sortDescFirst: false,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const role = row.original
        return (
          <div className="flex flex-col">
            <button
              onClick={() => onView(role.id)}
              className="font-medium text-primary hover:underline text-left"
            >
              {role.name}
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Description
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const description = row.getValue("description") as string
        return (
          <div className="text-muted-foreground">
            {description || "No description"}
          </div>
        )
      },
    },
    {
      accessorKey: "permissions",
      header: "Permissions",
      cell: ({ row }) => {
        const role = row.original
        const permissionCount = role.permissions?.length || 0
        return (
          <Badge variant="outline" className="font-normal">
            {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const role = row.original
        
        return (
          <div className="flex items-center justify-end gap-1.5">
            {hasViewPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
                title="View role"
                onClick={() => onView(role.id)}
              >
                <Eye className="size-3.5" />
                <span className="sr-only">View role</span>
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                title="Edit role"
                onClick={() => onEdit(role.id)}
              >
                <Edit className="size-3.5" />
                <span className="sr-only">Edit role</span>
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
                title="Delete role"
                onClick={() => onDelete(role.id)}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete role</span>
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
