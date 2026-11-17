import type { ColumnDef } from "@tanstack/react-table";
import { Eye, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  purchasePaymentMethodLabels,
  purchasePaymentStatusLabels,
  type Purchase,
} from "@/lib/api/stock-requests";

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

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  overdue: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
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
      accessorKey: "due_date",
      header: "Jatuh Tempo",
      cell: ({ row }) => {
        const dueDate = row.original.due_date;
        if (!dueDate) {
          return <span>-</span>;
        }

        return (
          <span>
            {new Date(dueDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        );
      },
    },
    {
      accessorKey: "payment_method",
      header: "Pembayaran",
      cell: ({ row }) => (
        <span>
          {purchasePaymentMethodLabels[row.original.payment_method] || row.original.payment_method || "-"}
        </span>
      ),
    },
    {
      accessorKey: "payment_status",
      header: "Status Bayar",
      cell: ({ row }) => {
        const paymentStatus = row.original.payment_status || "unpaid";
        return (
          <Badge className={paymentStatusColors[paymentStatus] || paymentStatusColors.unpaid}>
            {purchasePaymentStatusLabels[paymentStatus] || paymentStatus}
          </Badge>
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
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const purchase = row.original;
        const isDraft = purchase.status === "draft";
        const canEdit = hasEditPermission && isDraft;
        const canDelete = hasDeletePermission && isDraft;
        const canReceive =
          hasReceivePermission &&
          (purchase.status === "ordered" || purchase.status === "partial");
        const receiveLabel = purchase.status === "partial" ? "Terima Lagi" : "Terima Barang";

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-none border border-blue-200 text-blue-500 bg-blue-50/20 hover:bg-blue-100/50 hover:text-blue-600 p-0 shadow-none"
              onClick={() => onView(purchase.id)}
              title="Lihat Detail"
            >
              <Eye className="size-3.5" />
            </Button>
            {canReceive && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-none border border-emerald-200 text-emerald-600 bg-emerald-50/20 hover:bg-emerald-100/50 size-7 p-0 shadow-none"
                onClick={() => onReceive(purchase.id)}
                title={receiveLabel}
              >
                <PackageCheck className="size-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-none border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-100/50 hover:text-amber-700 p-0 shadow-none"
                onClick={() => onEdit(purchase.id)}
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
                onClick={() => onDelete(purchase.id)}
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
