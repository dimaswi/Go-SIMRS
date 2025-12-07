import type { ColumnDef } from "@tanstack/react-table";
import { Eye, PackageCheck, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Purchase } from "@/lib/api/stock-requests";

interface CreateColumnsOptions {
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onReceive: (id: number) => void;
  statusColors: Record<string, string>;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  hasReceivePermission: boolean;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu",
  ordered: "Dipesan",
  partial: "Sebagian",
  received: "Diterima",
  cancelled: "Dibatalkan",
};

export function createPurchaseColumns({
  onView,
  onEdit,
  onDelete,
  onReceive,
  statusColors,
  hasEditPermission,
  hasDeletePermission,
  hasReceivePermission,
}: CreateColumnsOptions): ColumnDef<Purchase>[] {
  return [
    {
      accessorKey: "purchase_number",
      header: "Nomor Pembelian",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          {row.original.purchase_number}
        </span>
      ),
    },
    {
      accessorKey: "supplier_name",
      header: "Supplier",
      cell: ({ row }) => (
        <span>{row.original.supplier?.name || row.original.supplier_name || "-"}</span>
      ),
    },
    {
      accessorKey: "to_room",
      header: "Ruangan Tujuan",
      cell: ({ row }) => (
        <span>{row.original.to_room?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "order_date",
      header: "Tanggal",
      cell: ({ row }) => {
        const date = row.original.order_date || row.original.created_at
          ? new Date(row.original.order_date || row.original.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "-";
        return <span>{date}</span>;
      },
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) => {
        const amount = row.original.total_amount || 0;
        return (
          <span className="font-medium">
            Rp {amount.toLocaleString("id-ID")}
          </span>
        );
      },
    },
    {
      accessorKey: "items",
      header: "Jumlah Item",
      cell: ({ row }) => {
        const items = row.original.items?.length || 0;
        return <span>{items} item</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "pending";
        return (
          <Badge className={statusColors[status] || statusColors.pending}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const purchase = row.original;
        const isDraft = purchase.status === "draft";
        const canEdit = hasEditPermission && isDraft;
        const canDelete = hasDeletePermission && isDraft;
        const canReceive =
          hasReceivePermission &&
          (purchase.status === "ordered" || purchase.status === "partial");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(purchase.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(purchase.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canReceive && (
                <DropdownMenuItem onClick={() => onReceive(purchase.id)}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Terima Barang
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={() => onDelete(purchase.id)} className="text-red-600">
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
