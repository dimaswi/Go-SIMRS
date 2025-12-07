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
import { MoreHorizontal, Eye, CheckCircle, ArrowUpDown } from "lucide-react";
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
      header: "Aksi",
      cell: ({ row }) => {
        const distribution = row.original;
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
              <DropdownMenuItem onClick={() => onView(distribution.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
              {(distribution.status === "pending" || distribution.status === "delivered") && hasReceivePermission && (
                <DropdownMenuItem onClick={() => onReceive(distribution.id)}>
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                  Terima Distribusi
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
