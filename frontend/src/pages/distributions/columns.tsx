import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, ArrowUpDown } from "lucide-react";
import { type StockDistribution } from "@/lib/api/stock-requests";

interface ColumnOptions {
  onView: (id: number) => void;
  onReceive: (id: number) => void;
  statusColors: Record<string, string>;
  hasReceivePermission: boolean;
}

const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  delivered: "Dikirim",
  received: "Diterima",
};

export function createDistributionColumns(options: ColumnOptions): ColumnDef<StockDistribution>[] {
  const { onView, onReceive, statusColors, hasReceivePermission } = options;

  return [
    {
      accessorKey: "distribution_number",
      sortDescFirst: false,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-0 hover:bg-transparent"
        >
          No. Distribusi
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original.id)}
          className="font-mono font-medium hover:underline text-primary"
        >
          {row.getValue("distribution_number")}
        </button>
      ),
    },
    {
      accessorKey: "stock_request",
      header: "No. Permintaan",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.original.stock_request?.request_number || "-"}
        </span>
      ),
    },
    {
      accessorKey: "from_room",
      header: "Dari",
      cell: ({ row }) => row.original.from_room?.name || "-",
    },
    {
      accessorKey: "to_room",
      header: "Ke",
      cell: ({ row }) => row.original.to_room?.name || "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={statusColors[status] || "bg-gray-100"}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "distribution_date",
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
        const date = row.getValue("distribution_date") as string;
        return new Date(date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      },
    },
    {
      accessorKey: "distributed_by",
      header: "Pengirim",
      cell: ({ row }) => row.original.distributed_by?.full_name || "-",
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
        const distribution = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(distribution.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {(distribution.status === "pending" || distribution.status === "delivered") && hasReceivePermission && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-none border border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-100/50 size-7 p-0 shadow-none"
                onClick={() => onReceive(distribution.id)}
                title="Terima Distribusi"
              >
                <CheckCircle className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
