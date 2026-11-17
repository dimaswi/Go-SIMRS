import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, Package, Pill, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import {
  type StockRequest,
  stockRequestStatusLabels,
  priorityLabels,
  requestTypeLabels,
  requestModeLabels,
} from "@/lib/api/stock-requests";

interface ColumnOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onApprove: (id: number) => void;
  onCancel: (id: number) => void;
  statusColors: Record<string, string>;
  priorityColors: Record<string, string>;
  hasViewPermission?: boolean;
  hasEditPermission?: boolean;
  hasDeletePermission?: boolean;
  hasApprovePermission?: boolean;
}

export function createStockRequestColumns(options: ColumnOptions): ColumnDef<StockRequest>[] {
  const { 
    onView, 
    onEdit,
    onDelete,
    onApprove, 
    onCancel, 
    statusColors, 
    priorityColors,
    hasEditPermission,
    hasDeletePermission,
  } = options;

  return [
    {
      accessorKey: "request_number",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          No. Permintaan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.request_type === 'inventory' ? (
            <Package className="h-4 w-4 text-blue-500" />
          ) : (
            <Pill className="h-4 w-4 text-green-500" />
          )}
          <button
            onClick={() => onView(row.original.id)}
            className="font-mono font-medium hover:underline text-primary"
          >
            {row.getValue("request_number")}
          </button>
        </div>
      ),
    },
    {
      accessorKey: "request_type",
      header: "Tipe",
      cell: ({ row }) => (
        <Badge variant="outline">
          {requestTypeLabels[row.getValue("request_type") as string] || row.getValue("request_type")}
        </Badge>
      ),
    },
    {
      accessorKey: "request_mode",
      header: "Mode",
      cell: ({ row }) => (
        <Badge variant="outline">
          {requestModeLabels[row.getValue("request_mode") as "depo" | "self_purchase"] || row.getValue("request_mode")}
        </Badge>
      ),
    },
    {
      accessorKey: "from_room",
      header: "Dari Ruangan",
      cell: ({ row }) => row.original.from_room?.name || "-",
    },
    {
      accessorKey: "to_room",
      header: "Ke Ruangan",
      cell: ({ row }) => row.original.request_mode === "depo" ? (row.original.to_room?.name || "-") : "Unit Sendiri",
    },
    {
      accessorKey: "priority",
      header: "Prioritas",
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string;
        return (
          <Badge className={priorityColors[priority] || "bg-gray-100"}>
            {priorityLabels[priority] || priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={statusColors[status] || "bg-gray-100"}>
            {stockRequestStatusLabels[status as keyof typeof stockRequestStatusLabels] || status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "request_date",
      sortDescFirst: true,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          Tanggal
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("request_date") as string;
        return new Date(date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      },
    },
    {
      accessorKey: "requested_by",
      header: "Pemohon",
      cell: ({ row }) => row.original.requested_by?.full_name || "-",
    },
    {
      id: "items_count",
      header: "Item",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.items?.length || 0} item</Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(request.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {request.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-none border border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-100/50 size-7 p-0 shadow-none"
                  onClick={() => onApprove(request.id)}
                  title="Proses Persetujuan"
                >
                  <CheckCircle className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
                  onClick={() => onCancel(request.id)}
                  title="Batalkan"
                >
                  <XCircle className="size-3.5" />
                </Button>
              </>
            )}
            {request.status === "draft" && hasEditPermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(request.id)}
                title="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {request.status === "draft" && hasDeletePermission && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-rose-200 text-rose-500 bg-rose-50/20 hover:bg-rose-100/50 hover:text-rose-600 p-0 shadow-none"
                onClick={() => onDelete(request.id)}
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
