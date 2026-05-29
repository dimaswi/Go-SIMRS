import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  User,
  PackageCheck,
  CheckCircle,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import {
  purchasePaymentMethodLabels,
  purchasePaymentStatusLabels,
  purchasesApi,
  type Purchase,
} from "@/lib/api/stock-requests";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu",
  ordered: "Dipesan",
  partial: "Sebagian",
  received: "Diterima",
  cancelled: "Dibatalkan",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  overdue: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

export default function PurchaseShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "transfer",
    reference_number: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await purchasesApi.getById(parseInt(id));
      setPurchase(response.data.data);
      setPageTitle(`Pembelian - ${response.data.data.purchase_number}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data pembelian.",
      });
      navigate("/purchases");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (!id) return;

    setApproving(true);
    try {
      await purchasesApi.approve(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Pembelian berhasil disetujui.",
      });
      loadData(); // Reload data
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyetujui pembelian.",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;

    setSubmitting(true);
    try {
      await purchasesApi.submit(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Pembelian berhasil diajukan.",
      });
      loadData(); // Reload data
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mengajukan pembelian.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await purchasesApi.delete(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Pembelian berhasil dihapus.",
      });
      navigate("/purchases");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menghapus pembelian.",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const openPaymentDialog = () => {
    if (!purchase) return;

    setPaymentForm({
      amount: purchase.remaining_amount || 0,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: purchase.payment_method || "transfer",
      reference_number: "",
      notes: "",
    });
    setPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!id || !purchase) return;

    if (paymentForm.amount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nominal pembayaran harus lebih besar dari 0.",
      });
      return;
    }

    setRecordingPayment(true);
    try {
      await purchasesApi.recordPayment(parseInt(id), {
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date || undefined,
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number || undefined,
        notes: paymentForm.notes || undefined,
      });
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Pembayaran supplier berhasil dicatat.",
      });
      setPaymentDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencatat pembayaran supplier.",
      });
    } finally {
      setRecordingPayment(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Detail Pembelian"
          description="Lihat status, supplier, dan progres penerimaan item pembelian."
        />
        <PageContent className="flex-none pb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!purchase) {
    return null;
  }

  const status = purchase.status || "draft";
  const canEdit =
    hasPermission("purchases.update") &&
    (status === "draft" || status === "pending");
  const canDelete =
    hasPermission("purchases.delete") && status === "draft";
  const canSubmit =
    hasPermission("purchases.create") && status === "draft";
  const canApprove =
    hasPermission("purchases.approve") && status === "pending";
  const canReceive =
    hasPermission("purchases.receive") &&
    (status === "ordered" || status === "partial");
  const receiveActionLabel = status === "partial" ? "Terima Lagi" : "Terima Barang";
  const incompleteItems = (purchase.items || []).filter(
    (item) => (item.quantity_received || 0) < item.quantity_ordered,
  );
  const incompleteItemCount = incompleteItems.length;
  const remainingReceiptQuantity = incompleteItems.reduce(
    (total, item) => total + Math.max(item.quantity_ordered - (item.quantity_received || 0), 0),
    0,
  );
  const canRecordPayment =
    hasPermission("purchases.update") &&
    status !== "cancelled" &&
    purchase.payment_status !== "paid";

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    return `Rp ${(amount || 0).toLocaleString("id-ID")}`;
  };

  const formatInputDate = (date: string | undefined) => {
    if (!date) return "-";
    return formatDate(date);
  };

  const payments = [...(purchase.payments || [])].sort(
    (left, right) => new Date(right.payment_date).getTime() - new Date(left.payment_date).getTime()
  );

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title={purchase.purchase_number}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-2.5">
        <div className="grid min-h-0 flex-1 gap-2.5 [&_input]:h-8 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] xl:grid-cols-[minmax(330px,400px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <SectionPanel
              icon={Building2}
              title="Ringkasan Pembelian"
              className="flex h-full flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 py-2 sm:px-3"
              actions={
                canRecordPayment ? (
                  <Button size="sm" onClick={openPaymentDialog}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Bayar
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-2.5 border-b border-border/70 pb-2.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">No. Pembelian</div>
                    <p className="font-mono text-sm font-medium">{purchase.purchase_number}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status Proses</div>
                    <div className="mt-1">
                    <Badge className={statusColors[status]}>
                      {statusLabels[status]}
                    </Badge>
                    {status === "partial" && incompleteItemCount > 0 ? (
                      <p className="mt-1 text-[11px] leading-4 text-amber-700">
                        Sisa {incompleteItemCount} item, {remainingReceiptQuantity} unit belum diterima.
                      </p>
                    ) : null}
                  </div>
                </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    Supplier
                  </div>
                    <p className="text-sm font-medium">
                      {purchase.supplier?.name || purchase.supplier_name || "-"}
                    </p>
                    {purchase.supplier?.code && (
                      <p className="text-xs text-muted-foreground">
                        {purchase.supplier.code}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Ruangan Tujuan
                  </div>
                    <p className="text-sm font-medium">{purchase.to_room?.name || "-"}</p>
                    {purchase.to_room?.code && (
                      <p className="text-xs text-muted-foreground">
                        {purchase.to_room.code}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Tanggal Pembelian
                    </div>
                    <p className="text-sm font-medium">{formatDate(purchase.order_date || purchase.created_at)}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      Dibuat Oleh
                    </div>
                    <p className="text-sm font-medium">{purchase.created_by?.full_name || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 border-b border-border/70 pb-2.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">No. Faktur</p>
                    <p className="text-sm font-medium">{purchase.invoice_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tanggal Faktur</p>
                    <p className="text-sm font-medium">{formatDate(purchase.invoice_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Metode Bayar</p>
                    <p className="text-sm font-medium">
                      {purchasePaymentMethodLabels[purchase.payment_method] || purchase.payment_method || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Termin</p>
                    <p className="text-sm font-medium">{purchase.payment_term_days || 0} hari</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Jatuh Tempo</p>
                    <p className="text-sm font-medium">{formatDate(purchase.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status Bayar</p>
                    <div className="mt-1">
                      <Badge className={paymentStatusColors[purchase.payment_status] || paymentStatusColors.unpaid}>
                        {purchasePaymentStatusLabels[purchase.payment_status] || purchase.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Tagihan</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(purchase.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sudah Dibayar</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-600">{formatCurrency(purchase.paid_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sisa Hutang</p>
                    <p className="mt-1 text-sm font-semibold text-amber-600">{formatCurrency(purchase.remaining_amount)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {purchase.notes ? (
                  <div className="mb-2.5 border-b border-border/70 pb-2.5">
                    <p className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Catatan</p>
                    <p className="text-sm leading-snug">{purchase.notes}</p>
                  </div>
                ) : null}

                <div className="flex flex-col">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Riwayat Pembayaran</p>
                    <span className="text-xs text-muted-foreground">{payments.length} transaksi</span>
                  </div>

                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada pembayaran yang dicatat.</p>
                  ) : (
                    <div className="rounded-md border border-border/70 bg-muted/10 px-3 py-2.5">
                      <div className="space-y-1 text-[11px] leading-4 text-muted-foreground">
                        <p>Pembayaran terakhir: <span className="font-medium text-foreground">{payments[0]?.payment_number || "-"}</span></p>
                        <p>Nominal terakhir: <span className="font-medium text-emerald-700">{formatCurrency(payments[0]?.amount)}</span></p>
                      </div>
                      <button
                        type="button"
                        className="mt-2 text-xs font-medium text-primary underline underline-offset-4"
                        onClick={() => setPaymentHistoryOpen(true)}
                      >
                        Lihat daftar pembayaran
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </SectionPanel>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={PackageCheck}
              title="Daftar Item"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
            >
              <div className="min-h-0 flex-1 overflow-hidden rounded-b-md">
                <ScrollArea className="h-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th className="h-9 w-[28%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th className="h-9 w-[17%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Qty</th>
                        <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Harga</th>
                        <th className="h-9 w-[20%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Komersial</th>
                        <th className="h-9 w-[17%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.items && purchase.items.length > 0 ? (
                        purchase.items.map((item) => {
                          const itemName = item.inventory?.name || item.medicine?.name || "-";
                          const itemCode = item.inventory?.code || item.medicine?.code;
                          const received = item.quantity_received || 0;
                          const isComplete = received >= item.quantity_ordered;
                          const factor = Math.max(1, Number(item.conversion_factor || 1));
                          const hasLargeUnit = !!item.unit_large && factor > 1;
                          const orderedLabel = hasLargeUnit
                            ? `${item.quantity_large_ordered || 0} ${item.unit_large} + ${item.quantity_small_ordered || 0} ${item.unit_small || item.unit}`
                            : `${item.quantity_ordered} ${item.unit}`;
                          const receivedLarge = hasLargeUnit ? Math.floor(received / factor) : 0;
                          const receivedSmall = hasLargeUnit ? (received % factor) : 0;
                          const receivedLabel = hasLargeUnit
                            ? `${receivedLarge} ${item.unit_large} + ${receivedSmall} ${item.unit_small || item.unit}`
                            : `${received} ${item.unit}`;
                          const remaining = Math.max(item.quantity_ordered - received, 0);
                          const remainingLarge = hasLargeUnit ? Math.floor(remaining / factor) : 0;
                          const remainingSmall = hasLargeUnit ? (remaining % factor) : 0;
                          const remainingLabel = hasLargeUnit
                            ? `${remainingLarge} ${item.unit_large} + ${remainingSmall} ${item.unit_small || item.unit}`
                            : `${remaining} ${item.unit}`;

                          return (
                            <tr key={item.id} className="align-top transition-colors hover:bg-muted/10">
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-0.5">
                                  <p className="text-xs font-semibold leading-4 text-foreground">{itemName}</p>
                                  {itemCode ? (
                                    <p className="font-mono text-[11px] leading-4 text-muted-foreground">{itemCode}</p>
                                  ) : null}
                                  <p className="text-[11px] leading-4 text-muted-foreground">
                                    Satuan: {item.unit}
                                    {hasLargeUnit ? ` (besar: ${item.unit_large} x${factor})` : ""}
                                  </p>
                                  {item.notes ? (
                                    <p className="line-clamp-2 pt-0.5 text-[11px] leading-4 text-muted-foreground">{item.notes}</p>
                                  ) : null}
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                                  <p>Dipesan: <span className="font-medium text-foreground">{orderedLabel}</span></p>
                                  <p>Diterima: <span className={isComplete ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{receivedLabel}</span></p>
                                  <p>Sisa: <span className="font-medium text-foreground">{remainingLabel}</span></p>
                                  <p>Batch: <span className="font-medium text-foreground">{item.batch_number || "-"}</span></p>
                                  <p>Exp: <span className="font-medium text-foreground">{formatInputDate(item.expiry_date)}</span></p>
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                                  <p>Harga satuan: <span className="font-medium text-foreground">{formatCurrency(item.unit_price)}</span></p>
                                  <p>Jumlah dasar: <span className="font-medium text-foreground">{formatCurrency((item.quantity_ordered || 0) * (item.unit_price || 0))}</span></p>
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                                  <p>Disc %: <span className="font-medium text-foreground">{item.discount_percent || 0}%</span></p>
                                  <p>Disc Rp: <span className="font-medium text-rose-600">{formatCurrency(item.discount_amount)}</span></p>
                                  <p>PPN %: <span className="font-medium text-foreground">{item.tax_percent || 0}%</span></p>
                                  <p>PPN Rp: <span className="font-medium text-sky-700">{formatCurrency(item.tax_amount)}</span></p>
                                </div>
                              </td>
                              <td className="border-b border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-1 rounded-md bg-muted/15 px-2.5 py-2">
                                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total Baris</p>
                                  <p className="text-sm font-semibold leading-5 text-foreground">{formatCurrency(item.total_price)}</p>
                                  <p className={isComplete ? "text-[11px] font-medium text-emerald-700" : "text-[11px] font-medium text-amber-700"}>
                                    {isComplete ? "Penerimaan lengkap" : "Menunggu sisa penerimaan"}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            Tidak ada item
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-border/70 px-2.5 py-2.5 sm:px-3">
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => navigate("/purchases")}>
                    Kembali
                  </Button>
                  {status === "partial" && incompleteItemCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Menunggu penerimaan lanjutan untuk {incompleteItemCount} item dengan sisa {remainingReceiptQuantity} unit.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/purchases/${id}/edit`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Hapus
                  </Button>
                )}
                {canSubmit && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Ajukan
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleApprove}
                    disabled={approving}
                  >
                    {approving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Setujui
                  </Button>
                )}
                {canReceive && (
                  <Button size="sm" onClick={() => navigate(`/purchases/${id}/receive`)}>
                    <PackageCheck className="mr-2 h-4 w-4" />
                    {receiveActionLabel}
                  </Button>
                )}
              </div>
              </div>
            </SectionPanel>
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Hapus Pembelian"
        description={`Apakah Anda yakin ingin menghapus pembelian "${purchase.purchase_number}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        variant="destructive"
      />

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Supplier</DialogTitle>
            <DialogDescription>
              Simpan pembayaran parsial atau pelunasan pembelian untuk memperbarui sisa hutang supplier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nominal Pembayaran</Label>
                <Input
                  type="number"
                  min={0}
                  max={purchase.remaining_amount || 0}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Tanggal Pembayaran</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Kredit / Termin</SelectItem>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="cod">COD</SelectItem>
                    <SelectItem value="cbd">CBD</SelectItem>
                    <SelectItem value="consignment">Konsinyasi</SelectItem>
                    <SelectItem value="installment">Cicilan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>No. Referensi</Label>
                <Input
                  placeholder="Nomor transfer, giro, atau referensi lain"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan pembayaran"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="border border-border/70 bg-muted/20 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Sisa hutang saat ini</span>
                <span className="font-semibold">{formatCurrency(purchase.remaining_amount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleRecordPayment} disabled={recordingPayment}>
              {recordingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Simpan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Daftar Pembayaran Supplier</DialogTitle>
            <DialogDescription>
              Riwayat seluruh pembayaran yang sudah dicatat untuk pembelian ini.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
            <ScrollArea className="h-[380px]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="bg-muted/20">
                    <th className="h-9 w-[22%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">No. Bayar</th>
                    <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Tanggal</th>
                    <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Metode</th>
                    <th className="h-9 w-[22%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Referensi</th>
                    <th className="h-9 w-[20%] border-b border-border/70 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-muted/10">
                        <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs font-medium text-foreground">{payment.payment_number}</p>
                            {payment.recorded_by?.full_name ? (
                              <p className="text-[11px] text-muted-foreground">{payment.recorded_by.full_name}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                          {purchasePaymentMethodLabels[payment.payment_method] || payment.payment_method}
                        </td>
                        <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                          <div className="space-y-0.5 text-[11px] text-muted-foreground">
                            <p>{payment.reference_number || "-"}</p>
                            {payment.notes ? <p className="line-clamp-2">{payment.notes}</p> : null}
                          </div>
                        </td>
                        <td className="border-b border-border/60 px-3 py-2.5 text-right align-top text-xs font-semibold text-emerald-600">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        Belum ada pembayaran yang dicatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentHistoryOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
