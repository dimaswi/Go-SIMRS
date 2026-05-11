import type { ColumnDef } from "@tanstack/react-table";
import { Eye, CheckCircle, MoreHorizontal, Pencil, Trash2, Building2, CalendarDays, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type StockOpname } from "@/lib/api/stock-requests";

interface CreateColumnsOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  statusColors: Record<string, string>;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  hasCompletePermission: boolean;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  in_progress: "Dalam Proses",
  completed: "Selesai",
  approved: "Disetujui",
  cancelled: "Dibatalkan",
};

export function createStockOpnameColumns({
  onView,
  onEdit,
  onDelete,
  onComplete,
  statusColors,
  hasEditPermission,
  hasDeletePermission,
  hasCompletePermission,
}: CreateColumnsOptions): ColumnDef<StockOpname>[] {
  return [
    {
      accessorKey: "opname_number",
      header: "Nomor Opname",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-medium">
            {row.original.opname_number}
          </span>
          <p className="text-xs text-muted-foreground">
            {row.original.conducted_by?.full_name || "Tanpa petugas"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "opname_date",
      header: "Tanggal",
      cell: ({ row }) => {
        const date = row.original.opname_date
          ? new Date(row.original.opname_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "-";
        return (
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{date}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "room",
      header: "Ruangan",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p>{row.original.room?.name || "-"}</p>
            {row.original.room?.code && (
              <p className="text-xs text-muted-foreground">{row.original.room.code}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: "Jumlah Item",
      cell: ({ row }) => {
        const items = row.original.items?.length || 0;
        return (
          <div className="flex items-center gap-2">
            <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{items} item</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "draft";
        return (
          <Badge className={statusColors[status] || statusColors.draft}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const opname = row.original;
        const isDraft = opname.status === "draft";
        const canEdit = hasEditPermission && isDraft;
        const canDelete = hasDeletePermission && isDraft;
        const canComplete =
          hasCompletePermission &&
          (opname.status === "draft" || opname.status === "in_progress");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/80">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(opname.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(opname.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canComplete && (
                <DropdownMenuItem onClick={() => onComplete(opname.id)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Selesaikan
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={() => onDelete(opname.id)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
