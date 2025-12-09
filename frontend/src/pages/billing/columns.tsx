import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, CreditCard } from "lucide-react";
import type { Billing } from "@/lib/api";

interface BillingColumnsProps {
  onView: (billing: Billing) => void;
  onPayment: (billing: Billing) => void;
  hasPermission?: (permission: string) => boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "pending":
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
    case "partial":
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Sebagian</Badge>;
    case "paid":
      return <Badge className="bg-green-500">Lunas</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Dibatalkan</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getPaymentMethodBadge = (method: string) => {
  switch (method) {
    case "cash":
      return <Badge variant="outline">Cash</Badge>;
    case "bpjs":
      return <Badge className="bg-green-600">BPJS</Badge>;
    case "insurance":
      return <Badge className="bg-blue-600">Asuransi</Badge>;
    default:
      return <Badge variant="secondary">{method}</Badge>;
  }
};

export const createBillingColumns = ({
  onView,
  onPayment,
}: BillingColumnsProps): ColumnDef<Billing>[] => [
  {
    accessorKey: "billing_number",
    header: "No. Billing",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.billing_number}</span>
    ),
  },
  {
    accessorKey: "registration",
    header: "Pasien",
    cell: ({ row }) => {
      const patient = row.original.registration?.patient;
      return patient ? (
        <div>
          <div className="font-medium">{patient.nama_lengkap}</div>
          <div className="text-sm text-muted-foreground">{patient.no_rm}</div>
        </div>
      ) : (
        "-"
      );
    },
  },
  {
    accessorKey: "visit",
    header: "Ruangan",
    cell: ({ row }) => {
      const room = row.original.visit?.room;
      return room ? (
        <div>
          <div className="font-medium">{room.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.visit?.visit_number}</div>
        </div>
      ) : (
        "-"
      );
    },
  },
  {
    accessorKey: "payment_method",
    header: "Metode Bayar",
    cell: ({ row }) => getPaymentMethodBadge(row.original.payment_method),
  },
  {
    accessorKey: "final_amount",
    header: "Total Tagihan",
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.final_amount)}</span>
    ),
  },
  {
    accessorKey: "paid_amount",
    header: "Dibayar",
    cell: ({ row }) => formatCurrency(row.original.paid_amount),
  },
  {
    accessorKey: "remaining_amount",
    header: "Sisa",
    cell: ({ row }) => {
      const remaining = row.original.remaining_amount;
      return (
        <span className={remaining > 0 ? "text-red-600 font-medium" : "text-green-600"}>
          {formatCurrency(remaining)}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "created_at",
    header: "Tanggal",
    cell: ({ row }) => {
      const date = new Date(row.original.created_at);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
  {
    id: "actions",
    header: "Aksi",
    cell: ({ row }) => {
      const billing = row.original;
      const canPay = billing.status === "pending" || billing.status === "partial";

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
            <DropdownMenuItem onClick={() => onView(billing)}>
              <Eye className="mr-2 h-4 w-4" />
              Detail
            </DropdownMenuItem>
            {canPay && (
              <DropdownMenuItem onClick={() => onPayment(billing)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Pembayaran
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
