import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Eye, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ICD10, ICD9CM } from "@/lib/api/icd";

interface ColumnActions {
  onView: (code: string) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

export const createColumns = ({
  onView,
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}: ColumnActions): ColumnDef<ICD10 | ICD9CM>[] => [
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
      <span className="font-mono font-medium">{row.original.code}</span>
    ),
  },
  {
    accessorKey: "display",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Nama/Deskripsi
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <button
        onClick={() => onView(row.original.code)}
        className="text-left hover:underline text-primary font-medium line-clamp-2"
      >
        {row.original.display}
      </button>
    ),
  },
  {
    accessorKey: "valid_code",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Tipe
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.valid_code ? "default" : "secondary"}>
        {row.original.valid_code ? "Valid" : "Header"}
      </Badge>
    ),
  },
  {
    accessorKey: "is_active",
    sortDescFirst: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-8 p-0 hover:bg-transparent"
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? "Aktif" : "Nonaktif"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
          onClick={() => onView(row.original.code)}
          title="Lihat"
        >
          <Eye className="size-3.5" />
        </Button>
        {canUpdate && (
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
            onClick={() => onEdit(row.original.id)}
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
            onClick={() => onDelete(row.original.id)}
            title="Hapus"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    ),
  },
];
