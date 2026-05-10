import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200",
};

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
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

  const canApprove = hasPermission("stock_requests.approve") && request.status === "pending";
  const canCancel = hasPermission("stock_requests.delete") && (request.status === "draft" || request.status === "pending");
  const canDelete = hasPermission("stock_requests.delete") && request.status === "draft";
  const canEdit = hasPermission("stock_requests.update") && (request.status === "draft" || request.status === "pending");
  const canSubmit = hasPermission("stock_requests.create") && request.status === "draft";

  return (
    <PageShell>
      <PageHeader
        title="Detail Permintaan Stok"
        description="Pantau status permintaan, pihak terlibat, dan kemajuan item dalam satu halaman yang lebih mudah dipindai."
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/stock-requests")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/stock-requests/${id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" onClick={() => setSubmitDialogOpen(true)}>
                <Send className="h-4 w-4" />
                Ajukan
              </Button>
            )}
            {canApprove && (
              <Button size="sm" onClick={() => navigate(`/stock-requests/${id}/approve`)}>
                <CheckCircle className="h-4 w-4" />
                Proses
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status permintaan live</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Progress item mudah dibaca</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Aksi utama pindah ke header</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</div><div className="mt-1 text-sm font-semibold text-foreground">{stockRequestStatusLabels[request.status]}</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prioritas</div><div className="mt-1 text-sm font-semibold text-foreground">{priorityLabels[request.priority]}</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Jumlah Item</div><div className="mt-1 text-sm font-semibold text-foreground">{request.items?.length || 0} item</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-rose-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ruang Tujuan</div><div className="mt-1 text-sm font-semibold text-foreground">{request.to_room?.name || "-"}</div></div>
        </div>

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <SectionPanel icon={ClipboardList} title="Informasi Permintaan" description="Ringkasan status, prioritas, asal dan tujuan ruangan, serta waktu kebutuhan permintaan.">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              <div className="space-y-1 lg:col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  No. Permintaan & Status
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-medium font-mono text-base">{request.request_number}</p>
                  <Badge className={statusColors[request.status]}>
                    {stockRequestStatusLabels[request.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {requestTypeLabels[request.request_type]} â€¢ Dibuat {formatDate(request.created_at)}
                </p>
              </div>
              {/* Priority */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Prioritas
                </div>
                <Badge className={priorityColors[request.priority]}>
                  {priorityLabels[request.priority]}
                </Badge>
              </div>

              {/* From Room */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Dari Ruangan
                </div>
                <p className="font-medium">
                  {request.from_room?.code} - {request.from_room?.name}
                </p>
              </div>

              {/* To Room */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Ke Ruangan
                </div>
                <p className="font-medium">
                  {request.to_room?.code} - {request.to_room?.name}
                </p>
              </div>

              {/* Required Date */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Tanggal Dibutuhkan
                </div>
                <p className="font-medium">{formatShortDate(request.required_date)}</p>
              </div>
            </div>
          </div>
        </SectionPanel>

        {/* People Info */}
        <SectionPanel icon={User} title="Informasi Pihak Terlibat" description="Jejak siapa yang meminta, menyetujui, dan menyelesaikan permintaan ini.">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Requested By */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Diminta Oleh
                </div>
                <p className="font-medium">{request.requested_by?.full_name || "-"}</p>
                <p className="text-xs text-muted-foreground">{formatDate(request.request_date)}</p>
              </div>

              {/* Approved By */}
              {request.approved_by && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    Disetujui Oleh
                  </div>
                  <p className="font-medium">{request.approved_by?.full_name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(request.approved_date)}</p>
                </div>
              )}

              {/* Completed By */}
              {request.completed_by && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    Diselesaikan Oleh
                  </div>
                  <p className="font-medium">{request.completed_by?.full_name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(request.completed_date)}</p>
                </div>
              )}
            </div>
          </div>
        </SectionPanel>

        {/* Reason & Notes */}
        {(request.reason || request.notes) && (
          <SectionPanel icon={FileText} title="Alasan & Catatan" description="Konteks utama permintaan dan catatan tambahan dari pengaju.">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {request.reason && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      Alasan Permintaan
                    </div>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                )}
                {request.notes && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      Catatan
                    </div>
                    <p className="text-sm">{request.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </SectionPanel>
        )}

        {/* Rejection Reason */}
        {request.rejection_reason && (
          <SectionPanel icon={XCircle} title="Alasan Penolakan" description="Penjelasan mengapa permintaan ini tidak dilanjutkan ke tahap berikutnya.">
            <div>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  <XCircle className="h-4 w-4" />
                  Alasan Penolakan
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">{request.rejection_reason}</p>
              </div>
            </div>
          </SectionPanel>
        )}

        {/* Items Table */}
        <SectionPanel icon={request.request_type === "inventory" ? Package : Pill} title="Daftar Item" description={`Rincian ${request.items?.length || 0} item yang diminta, disetujui, dan sudah dipenuhi.`}>
          <div className="-mx-3 -mb-4 sm:-mx-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead className="text-center">Qty Diminta</TableHead>
                  <TableHead className="text-center">Qty Disetujui</TableHead>
                  <TableHead className="text-center">Qty Terpenuhi</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items && request.items.length > 0 ? (
                  request.items.map((item, index) => {
                    const itemData = item.inventory || item.medicine;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {itemData?.code || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.inventory_id ? (
                              <Package className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Pill className="h-4 w-4 text-green-500" />
                            )}
                            {itemData?.name || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {item.quantity_requested}
                        </TableCell>
                        <TableCell className="text-center">
                          {request.status === "pending" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className={item.quantity_approved < item.quantity_requested ? "text-orange-600" : "text-green-600"}>
                              {item.quantity_approved}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity_fulfilled > 0 ? (
                            <span className={item.quantity_fulfilled < item.quantity_approved ? "text-orange-600" : "text-green-600"}>
                              {item.quantity_fulfilled}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{item.unit || itemData?.unit || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada item
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionPanel>
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

      {canDelete || canCancel ? (
        <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 backdrop-blur">
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Batalkan
            </Button>
          )}
        </div>
      ) : null}
      </PageContent>
    </PageShell>
  );
}
