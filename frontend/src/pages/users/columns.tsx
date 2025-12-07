import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Eye, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { createSelectColumn } from "@/components/ui/data-table"
import type { User } from "@/lib/api"

interface UserColumnsProps {
  onView: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  hasViewPermission: boolean
  hasEditPermission: boolean
  hasDeletePermission: boolean
}

export function createUserColumns({
  onView,
  onEdit,
  onDelete,
  hasViewPermission,
  hasEditPermission,
  hasDeletePermission,
}: UserColumnsProps): ColumnDef<User>[] {
  return [
    createSelectColumn<User>(),
    {
      accessorKey: "full_name",
      sortDescFirst: false,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            User
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <button
                onClick={() => onView(user.id)}
                className="font-medium text-primary hover:underline text-left"
              >
                {user.full_name}
              </button>
              <span className="text-sm text-muted-foreground">@{user.username}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-muted-foreground">{row.getValue("email")}</div>
      },
    },
    {
      accessorKey: "role.name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 hover:bg-transparent"
          >
            Role
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const user = row.original
        return (
          <Badge variant="outline" className="font-normal">
            {user.role?.name || 'N/A'}
          </Badge>
        )
      },
    },
    {
      accessorKey: "is_active",
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
        const isActive = row.getValue("is_active") as boolean
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const user = row.original
        
        return (
          <div className="flex items-center justify-end gap-2">
            {hasViewPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onView(user.id)}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">View user</span>
              </Button>
            )}
            {hasEditPermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(user.id)}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit user</span>
              </Button>
            )}
            {hasDeletePermission && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(user.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete user</span>
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}