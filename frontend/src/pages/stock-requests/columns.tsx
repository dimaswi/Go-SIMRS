import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, CheckCircle, XCircle, Package, Pill, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
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
      header: "Aksi",
      cell: ({ row }) => {
        const request = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onView(request.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
              {request.status === "draft" && hasEditPermission && (
                <DropdownMenuItem onClick={() => onEdit(request.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {request.status === "pending" && (
                <>
                  <DropdownMenuItem onClick={() => onApprove(request.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Proses Persetujuan
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onCancel(request.id)}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Batalkan
                  </DropdownMenuItem>
                </>
              )}
              {request.status === "draft" && hasDeletePermission && (
                <DropdownMenuItem onClick={() => onDelete(request.id)} className="text-red-600">
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
