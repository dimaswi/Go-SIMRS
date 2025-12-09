import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { createSelectColumn } from "@/components/ui/data-table"

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
          <div className="flex items-center justify-end gap-2">
            {hasViewPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onView(role.id)}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">View role</span>
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(role.id)}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit role</span>
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(role.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete role</span>
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
