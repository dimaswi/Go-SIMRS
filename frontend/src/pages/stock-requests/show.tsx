import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  stockRequestsApi,
  type StockRequest,
  stockRequestStatusLabels,
  priorityLabels,
  requestTypeLabels,
} from "@/lib/api/stock-requests";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Package,
  Pill,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Building,
  FileText,
  AlertTriangle,
  Pencil,
  Send,
  Trash2,
  ArrowLeft,
  ClipboardList,
  Truck,
} from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("border border-border/70 bg-background/95", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-2.5 py-2 sm:px-3", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("space-y-3 p-2.5 sm:p-3", contentClassName)}>{children}</div>
    </div>
  );
}

export default function StockRequestShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<StockRequest | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await stockRequestsApi.getById(Number(id));
      setRequest(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data permintaan stok.",
      });
      navigate("/stock-requests");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Detail Permintaan Stok");
    loadData();
  }, [loadData]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await stockRequestsApi.cancel(Number(id));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil dibatalkan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal membatalkan permintaan.",
      });
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await stockRequestsApi.submit(Number(id));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil diajukan untuk persetujuan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengajukan permintaan.",
      });
    } finally {
      setSubmitting(false);
      setSubmitDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await stockRequestsApi.delete(Number(id));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan stok berhasil dihapus.",
      });
      navigate("/stock-requests");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus permintaan.",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate("/stock-requests")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  const canApprove = hasPermission("stock_requests.approve") && (request.status === "pending" || request.status === "partial");
  const canCancel = hasPermission("stock_requests.delete") && (request.status === "draft" || request.status === "pending");
  const canDelete = hasPermission("stock_requests.delete") && request.status === "draft";
  const canEdit = hasPermission("stock_requests.update") && (request.status === "draft" || request.status === "pending");
  const canSubmit = hasPermission("stock_requests.create") && request.status === "draft";
  const canCreateDistribution = hasPermission("distributions.create")
    && (request.status === "approved" || request.status === "partial")
    && request.items.some((item) => item.quantity_approved > item.quantity_fulfilled);
  const approvalHistories = [...(request.approval_histories || [])].sort(
    (left, right) => new Date(right.approved_date).getTime() - new Date(left.approved_date).getTime()
  );

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Detail Permintaan Stok"
        description="Pantau status permintaan, pihak terlibat, dan kemajuan item dalam satu halaman yang lebih mudah dipindai."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/stock-requests")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Hapus
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Batalkan
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/stock-requests/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" onClick={() => setSubmitDialogOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                Ajukan
              </Button>
            )}
            {canCreateDistribution && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/distributions/create?request_id=${id}`)}>
                <Truck className="mr-2 h-4 w-4" />
                Distribusi
              </Button>
            )}
            {canApprove && (
              <Button size="sm" onClick={() => navigate(`/stock-requests/${id}/approve`)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {request.status === "partial" ? "Approve Lagi" : "Proses"}
              </Button>
            )}
          </div>
        }
      />

      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(330px,390px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
              <SectionPanel
                icon={ClipboardList}
                title="Informasi Permintaan"
                description="Ringkasan status permintaan."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{stockRequestStatusLabels[request.status]}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prioritas</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{priorityLabels[request.priority]}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Jumlah Item</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{request.items?.length || 0} item</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-rose-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ruang Tujuan</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{request.to_room?.name || "-"}</div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/70 pt-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      No. Permintaan & Status
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">{request.request_number}</p>
                      <Badge className={statusColors[request.status]}>
                        {stockRequestStatusLabels[request.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requestTypeLabels[request.request_type]} • Dibuat {formatDate(request.created_at)}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        Dari Ruangan
                      </div>
                      <p className="text-sm font-medium">{request.from_room?.code} - {request.from_room?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        Ke Ruangan
                      </div>
                      <p className="text-sm font-medium">{request.to_room?.code} - {request.to_room?.name}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Tanggal Dibutuhkan
                      </div>
                      <p className="text-sm font-medium">{formatShortDate(request.required_date)}</p>
                    </div>
                  </div>
                </div>
              </SectionPanel>

              <SectionPanel
                icon={User}
                title="Riwayat"
                description="Jejak aktivitas permintaan stok."
                actions={approvalHistories.length > 0 ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => setHistoryDialogOpen(true)}
                  >
                    Lihat {approvalHistories.length} Riwayat Approval
                  </Button>
                ) : undefined}
              >
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      Diminta Oleh
                    </div>
                    <p className="text-sm font-medium">{request.requested_by?.full_name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(request.request_date)}</p>
                  </div>

                  {request.approved_by && (
                    <div className="space-y-1 border-t border-border/70 pt-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4" />
                        Approval Terakhir
                      </div>
                      <p className="text-sm font-medium">{request.approved_by.full_name || "-"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(request.approved_date)}</p>
                      {approvalHistories.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground">{approvalHistories.length} sesi approval tersimpan.</p>
                      ) : null}
                    </div>
                  )}

                  {request.completed_by && (
                    <div className="space-y-1 border-t border-border/70 pt-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4" />
                        Diselesaikan Oleh
                      </div>
                      <p className="text-sm font-medium">{request.completed_by.full_name || "-"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(request.completed_date)}</p>
                    </div>
                  )}
                </div>
              </SectionPanel>

              {(request.reason || request.notes) && (
                <SectionPanel icon={FileText} title="Alasan & Catatan" description="Konteks utama permintaan dan catatan tambahan dari pengaju.">
                  <div className="grid gap-3">
                    {request.reason && (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Alasan Permintaan</p>
                        <p className="text-sm">{request.reason}</p>
                      </div>
                    )}
                    {request.notes && (
                      <div className="space-y-1 border-t border-border/70 pt-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Catatan</p>
                        <p className="text-sm">{request.notes}</p>
                      </div>
                    )}
                  </div>
                </SectionPanel>
              )}

              {request.rejection_reason && (
                <SectionPanel icon={XCircle} title="Alasan Penolakan" description="Penjelasan mengapa permintaan ini tidak dilanjutkan ke tahap berikutnya.">
                  <div className="rounded-md border border-rose-200 bg-rose-50/70 px-3 py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-800">
                      <XCircle className="h-4 w-4" />
                      Alasan Penolakan
                    </div>
                    <p className="text-sm text-rose-700">{request.rejection_reason}</p>
                  </div>
                </SectionPanel>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={request.request_type === "inventory" ? Package : Pill}
              title="Daftar Item"
              description={`Rincian ${request.items?.length || 0} item yang diminta, disetujui, dan sudah dipenuhi.`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
            >
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/80 bg-background">
                <ScrollArea className="h-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th className="h-9 w-[30%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th className="h-9 w-[12%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sat</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Diminta</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Disetujui</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Terpenuhi</th>
                        <th className="h-9 w-[16%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.items && request.items.length > 0 ? (
                        request.items.map((item) => {
                          const itemData = item.inventory || item.medicine;
                          return (
                            <tr key={item.id} className="transition-colors hover:bg-muted/10">
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2">
                                  {item.inventory_id ? (
                                    <Package className="mt-0.5 h-4 w-4 text-blue-500" />
                                  ) : (
                                    <Pill className="mt-0.5 h-4 w-4 text-green-500" />
                                  )}
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs font-semibold leading-4 text-foreground">{itemData?.name || "-"}</p>
                                    <p className="font-mono text-[11px] leading-4 text-muted-foreground">{itemData?.code || "-"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                                {item.unit || itemData?.unit || "-"}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-sm font-medium text-foreground">
                                {item.quantity_requested}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                {request.status === "pending" ? (
                                  <span className="text-[11px] text-muted-foreground">-</span>
                                ) : (
                                  <span className={item.quantity_approved < item.quantity_requested ? "text-sm font-medium text-orange-600" : "text-sm font-medium text-green-600"}>
                                    {item.quantity_approved}
                                  </span>
                                )}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                {item.quantity_fulfilled > 0 ? (
                                  <span className={item.quantity_fulfilled < item.quantity_approved ? "text-sm font-medium text-orange-600" : "text-sm font-medium text-green-600"}>
                                    {item.quantity_fulfilled}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="border-b border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                                {item.notes || "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            Tidak ada item
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </SectionPanel>
          </div>
        </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Batalkan Permintaan?"
        description="Apakah Anda yakin ingin membatalkan permintaan ini? Tindakan ini tidak dapat dibatalkan."
        confirmText={cancelling ? "Membatalkan..." : "Ya, Batalkan"}
        cancelText="Tidak"
        variant="destructive"
        onConfirm={handleCancel}
      />

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Ajukan Permintaan?"
        description="Apakah Anda yakin ingin mengajukan permintaan ini untuk diproses? Setelah diajukan, permintaan akan menunggu persetujuan."
        confirmText={submitting ? "Mengajukan..." : "Ya, Ajukan"}
        cancelText="Batal"
        onConfirm={handleSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Permintaan Stok?"
        description={`Apakah Anda yakin ingin menghapus permintaan "${request.request_number}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={deleting ? "Menghapus..." : "Hapus"}
        cancelText="Batal"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden rounded-none border-border/80 p-0">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-12">
            <DialogTitle>Riwayat Approval</DialogTitle>
            <DialogDescription>
              Seluruh sesi approval untuk permintaan {request.request_number} ditampilkan dalam tabel agar lebih cepat dipindai.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto px-5 pb-4">
            {approvalHistories.length === 0 ? (
              <div className="border border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada riwayat approval.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/80 bg-background">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead className="bg-background">
                    <tr className="bg-muted/20">
                      <th className="h-9 w-[34%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Detail Approval</th>
                      <th className="h-9 border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">List Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalHistories.flatMap((history, index) => {
                      const rowCount = Math.max(history.items?.length || 0, 1);
                      const sessionLabel = `Sesi ${approvalHistories.length - index}`;
                      const sessionNotes = history.notes?.trim() || "-";

                      if (!history.items || history.items.length === 0) {
                        return [
                          <tr key={history.id} className="transition-colors hover:bg-muted/5">
                            <td rowSpan={1} className="border-b border-r border-border/60 px-3 py-3 align-top">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-foreground">{sessionLabel}</div>
                                <div className="space-y-1 text-[11px] text-muted-foreground">
                                  <div>{formatDate(history.approved_date)}</div>
                                  <div className="font-medium text-foreground">{stockRequestStatusLabels[history.status]}</div>
                                  <div>{history.approved_by?.full_name || "-"}</div>
                                  <div>{sessionNotes}</div>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-border/60 px-3 py-3 align-top text-[11px] text-muted-foreground">
                              Tidak ada item pada sesi ini.
                            </td>
                          </tr>,
                        ];
                      }

                      return history.items.map((item, itemIndex) => {
                        const itemData = item.inventory || item.medicine;
                        return (
                          <tr key={`${history.id}-${item.id}`} className="transition-colors hover:bg-muted/5">
                            {itemIndex === 0 ? (
                              <td rowSpan={rowCount} className="border-b border-r border-border/60 px-3 py-3 align-top">
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-foreground">{sessionLabel}</div>
                                  <div className="space-y-1 text-[11px] text-muted-foreground">
                                    <div>{formatDate(history.approved_date)}</div>
                                    <div className="font-medium text-foreground">{stockRequestStatusLabels[history.status]}</div>
                                    <div>{history.approved_by?.full_name || "-"}</div>
                                    <div>{sessionNotes}</div>
                                  </div>
                                </div>
                              </td>
                            ) : null}
                            <td className="border-b border-border/60 px-3 py-3 align-top">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-xs font-semibold leading-4 text-foreground">{itemData?.name || "-"}</div>
                                  <div className="font-mono text-[11px] leading-4 text-muted-foreground">{itemData?.code || "-"}</div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-[11px] text-muted-foreground">{item.unit || itemData?.unit || "-"}</div>
                                  <div className="text-sm font-semibold text-emerald-600">{item.quantity_approved}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </PageContent>
    </PageShell>
  );
}
