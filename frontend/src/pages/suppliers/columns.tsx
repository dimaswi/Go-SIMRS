import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowUpDown, Phone, Mail } from "lucide-react";
import type { Supplier } from "@/lib/api/suppliers";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  hasViewPermission: boolean;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
}

export function createSupplierColumns(options: ColumnOptions): ColumnDef<Supplier>[] {
  const { onView, onEdit, onDelete, hasViewPermission, hasEditPermission, hasDeletePermission } = options;

  return [
    {
      accessorKey: "code",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Kode
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Nama Supplier
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original.id)}
          className="text-left hover:underline text-primary font-medium"
        >
          {row.getValue("name")}
        </button>
      ),
    },
    {
      accessorKey: "phone",
      header: "Kontak",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {row.original.phone}
            </div>
          )}
          {row.original.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {row.original.email}
            </div>
          )}
          {!row.original.phone && !row.original.email && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "contact_person",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          PIC
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.contact_person || "-"}</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_active ? "default" : "secondary"}
          className={
            row.original.is_active
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }
        >
          {row.original.is_active ? "Aktif" : "Non-Aktif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const hasAnyAction = hasViewPermission || hasEditPermission || hasDeletePermission;

        if (!hasAnyAction) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasViewPermission && (
                <DropdownMenuItem onClick={() => onView(row.original.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Detail
                </DropdownMenuItem>
              )}
              {hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(row.original.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {hasDeletePermission && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(row.original.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
