import type { ColumnDef } from "@tanstack/react-table";
import { Eye, CheckCircle, Pencil, Trash2, Building2, CalendarDays, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const opname = row.original;
        const isDraft = opname.status === "draft";
        const canEdit = hasEditPermission && isDraft;
        const canDelete = hasDeletePermission && isDraft;
        const canComplete =
          hasCompletePermission &&
          (opname.status === "draft" || opname.status === "in_progress");

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(opname.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {canComplete && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-none border border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-100/50 size-7 p-0 shadow-none"
                onClick={() => onComplete(opname.id)}
                title="Selesaikan"
              >
                <CheckCircle className="size-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(opname.id)}
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
                onClick={() => onDelete(opname.id)}
                title="Hapus"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
