import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { createSelectColumn } from "@/components/ui/data-table"

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface PermissionColumnsProps {
  onView: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  hasViewPermission: boolean
  hasEditPermission: boolean
  hasDeletePermission: boolean
}

export function createPermissionColumns({
  onView,
  onEdit,
  onDelete,
  hasViewPermission,
  hasEditPermission,
  hasDeletePermission,
}: PermissionColumnsProps): ColumnDef<Permission>[] {
  return [
    createSelectColumn<Permission>(),
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
        const permission = row.original
        return (
          <div className="flex flex-col">
            <button
              onClick={() => onView(permission.id)}
              className="font-medium font-mono text-sm text-primary hover:underline text-left"
            >
              {permission.name}
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
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const permission = row.original
        
        return (
          <div className="flex items-center justify-end gap-2">
            {hasViewPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onView(permission.id)}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">View permission</span>
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(permission.id)}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit permission</span>
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(permission.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete permission</span>
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}