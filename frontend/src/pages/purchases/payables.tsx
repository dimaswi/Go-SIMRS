import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Loader2, Receipt, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { PageShell, PageHeader, FilterBar, FilterPill, PageContent } from "@/components/layout/page-shell";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  purchasePaymentMethodLabels,
  purchasePaymentStatusLabels,
  purchasesApi,
  type Purchase,
} from "@/lib/api/stock-requests";

type PayableView = "all" | "unpaid" | "partial" | "overdue" | "paid";

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  overdue: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

// function SummaryStrip({
//   label,
//   value,
//   helper,
// }: {
//   label: string;
//   value: string;
//   helper: string;
// }) {
//   return (
//     <div className="border border-border/70 bg-background px-4 py-3">
//       <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
//       <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
//       <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
//     </div>
//   );
// }

// function getAgeInDays(dueDate?: string) {
//   if (!dueDate) return 0;

//   const due = new Date(dueDate);
//   const today = new Date();
//   due.setHours(0, 0, 0, 0);
//   today.setHours(0, 0, 0, 0);

//   const diff = today.getTime() - due.getTime();
//   if (diff <= 0) return 0;

//   return Math.floor(diff / (1000 * 60 * 60 * 24));
// }

export default function PurchasePayablesIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<Purchase[]>([]);
  const [activeView, setActiveView] = useState<PayableView>("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  useEffect(() => {
    setPageTitle("Hutang Supplier");
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await purchasesApi.getAll({ limit: 500 });
        const purchaseRows = (response.data.data || []).filter(
          (purchase: Purchase) => purchase.total_amount > 0 && purchase.status !== "cancelled"
        );
        setPayables(purchaseRows);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Gagal memuat monitoring hutang supplier.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  const supplierOptions = useMemo(() => {
    const options = payables
      .map((purchase) => ({
        value: String(purchase.supplier_id || purchase.supplier_name || purchase.id),
        label: purchase.supplier?.name || purchase.supplier_name || "Supplier tanpa nama",
      }))
      .filter((option, index, array) => array.findIndex((item) => item.value === option.value) === index)
      .sort((left, right) => left.label.localeCompare(right.label, "id-ID"));

    return [{ value: "all", label: "Semua Supplier" }, ...options];
  }, [payables]);

  const filteredPayables = useMemo(() => {
    return payables.filter((purchase) => {
      if (activeView !== "all" && purchase.payment_status !== activeView) {
        return false;
      }

      if (supplierFilter !== "all") {
        const supplierKey = String(purchase.supplier_id || purchase.supplier_name || purchase.id);
        if (supplierKey !== supplierFilter) {
          return false;
        }
      }

      return true;
    });
  }, [activeView, payables, supplierFilter]);

//   const outstandingTotal = useMemo(
//     () => payables.reduce((sum, purchase) => sum + (purchase.remaining_amount || 0), 0),
//     [payables]
//   );

//   const overdueTotal = useMemo(
//     () => payables
//       .filter((purchase) => purchase.payment_status === "overdue")
//       .reduce((sum, purchase) => sum + (purchase.remaining_amount || 0), 0),
//     [payables]
//   );

//   const paidThisRegister = useMemo(
//     () => payables.reduce((sum, purchase) => sum + (purchase.paid_amount || 0), 0),
//     [payables]
//   );

//   const agingBuckets = useMemo(() => {
//     const buckets = {
//       current: { label: "Belum Jatuh Tempo", amount: 0, count: 0, helper: "Outstanding yang belum melewati jatuh tempo." },
//       bucket30: { label: "0-30 Hari", amount: 0, count: 0, helper: "Tagihan overdue maksimal 30 hari." },
//       bucket60: { label: "31-60 Hari", amount: 0, count: 0, helper: "Tagihan overdue 31 sampai 60 hari." },
//       bucket90Plus: { label: ">60 Hari", amount: 0, count: 0, helper: "Tagihan overdue lebih dari 60 hari." },
//     };

//     payables.forEach((purchase) => {
//       const outstanding = purchase.remaining_amount || 0;
//       if (outstanding <= 0) {
//         return;
//       }

//       const age = getAgeInDays(purchase.due_date);
//       if (age <= 0) {
//         buckets.current.amount += outstanding;
//         buckets.current.count += 1;
//         return;
//       }

//       if (age <= 30) {
//         buckets.bucket30.amount += outstanding;
//         buckets.bucket30.count += 1;
//         return;
//       }

//       if (age <= 60) {
//         buckets.bucket60.amount += outstanding;
//         buckets.bucket60.count += 1;
//         return;
//       }

//       buckets.bucket90Plus.amount += outstanding;
//       buckets.bucket90Plus.count += 1;
//     });

//     return [buckets.current, buckets.bucket30, buckets.bucket60, buckets.bucket90Plus];
//   }, [payables]);

  const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const columns = useMemo<ColumnDef<Purchase>[]>(
    () => [
      {
        accessorKey: "purchase_number",
        header: "No. Pembelian",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => navigate(`/purchases/${row.original.id}`)}
            className="text-left font-mono font-medium text-primary hover:underline"
          >
            {row.original.purchase_number}
          </button>
        ),
      },
      {
        accessorKey: "supplier_name",
        header: "Supplier",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.supplier?.name || row.original.supplier_name || "-"}</div>
            <div className="text-xs text-muted-foreground">{row.original.invoice_number || "Tanpa nomor faktur"}</div>
          </div>
        ),
      },
      {
        accessorKey: "invoice_date",
        header: "Faktur / JT",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{formatDate(row.original.invoice_date || row.original.order_date || row.original.created_at)}</div>
            <div className="text-xs text-muted-foreground">JT {formatDate(row.original.due_date)}</div>
          </div>
        ),
      },
      {
        accessorKey: "payment_method",
        header: "Metode",
        cell: ({ row }) => (
          <div>
            <div>{purchasePaymentMethodLabels[row.original.payment_method] || row.original.payment_method || "-"}</div>
            <div className="text-xs text-muted-foreground">Termin {row.original.payment_term_days || 0} hari</div>
          </div>
        ),
      },
      {
        accessorKey: "remaining_amount",
        header: "Outstanding",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-amber-600">{formatCurrency(row.original.remaining_amount || 0)}</div>
            <div className="text-xs text-muted-foreground">Dibayar {formatCurrency(row.original.paid_amount || 0)}</div>
          </div>
        ),
      },
      {
        accessorKey: "payment_status",
        header: "Status",
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
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" onClick={() => navigate(`/purchases/${row.original.id}`)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Detail
          </Button>
        ),
      },
    ],
    [navigate]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Hutang Supplier"
        description="Pantau outstanding pembelian supplier, jatuh tempo, dan transaksi yang sudah atau belum dilunasi."
        count={filteredPayables.length}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/purchases")} size="sm">
              <ShoppingCart className="h-4 w-4" />
              Daftar Pembelian
            </Button>
            <Button onClick={() => navigate("/purchases/create")} size="sm">
              <Receipt className="h-4 w-4" />
              Buat Pembelian
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="space-y-4">
          {/* <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryStrip label="Outstanding" value={formatCurrency(outstandingTotal)} helper="Total sisa hutang seluruh pembelian supplier." />
            <SummaryStrip label="Overdue" value={formatCurrency(overdueTotal)} helper="Nilai hutang yang sudah melewati jatuh tempo." />
            <SummaryStrip label="Sudah Dibayar" value={formatCurrency(paidThisRegister)} helper="Akumulasi pembayaran yang tercatat pada register pembelian." />
            <SummaryStrip label="Dokumen Aktif" value={filteredPayables.length.toLocaleString("id-ID")} helper="Jumlah pembelian pada filter monitoring saat ini." />
          </div>

          
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {agingBuckets.map((bucket) => (
                <SummaryStrip
                  key={bucket.label}
                  label={bucket.label}
                  value={formatCurrency(bucket.amount)}
                  helper={`${bucket.count.toLocaleString("id-ID")} dokumen. ${bucket.helper}`}
                />
              ))}
            </div> */}
          
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Monitoring Hutang Supplier
            </div>
            <div className="space-y-4 p-3 sm:p-4">
              <FilterBar>
                <FilterPill active={activeView === "all"} onClick={() => setActiveView("all")} count={payables.length}>
                  Semua
                </FilterPill>
                <FilterPill active={activeView === "unpaid"} onClick={() => setActiveView("unpaid")} count={payables.filter((item) => item.payment_status === "unpaid").length}>
                  Belum Bayar
                </FilterPill>
                <FilterPill active={activeView === "partial"} onClick={() => setActiveView("partial")} count={payables.filter((item) => item.payment_status === "partial").length}>
                  Sebagian
                </FilterPill>
                <FilterPill active={activeView === "overdue"} onClick={() => setActiveView("overdue")} count={payables.filter((item) => item.payment_status === "overdue").length}>
                  Overdue
                </FilterPill>
                <FilterPill active={activeView === "paid"} onClick={() => setActiveView("paid")} count={payables.filter((item) => item.payment_status === "paid").length}>
                  Lunas
                </FilterPill>
              </FilterBar>

              <DataTable
                columns={columns}
                data={filteredPayables}
                searchPlaceholder="Cari nomor pembelian, supplier, atau nomor faktur..."
                pageSize={10}
                tableId="purchase_payables"
                searchSlot={
                  <div className="flex min-w-[220px] items-center gap-2">
                    <Combobox
                      options={supplierOptions}
                      value={supplierFilter}
                      onValueChange={(value) => setSupplierFilter(value || "all")}
                      placeholder="Filter supplier"
                      searchPlaceholder="Cari supplier..."
                      emptyText="Supplier tidak ditemukan"
                      className="h-7 min-w-[220px] text-xs"
                    />
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}