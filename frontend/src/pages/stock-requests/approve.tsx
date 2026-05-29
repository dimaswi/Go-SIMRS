import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  stockRequestsApi,
  type StockRequest,
  stockRequestStatusLabels,
  priorityLabels,
  requestTypeLabels,
  requestModeLabels,
} from "@/lib/api/stock-requests";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Package,
  Pill,
  CheckCircle,
  XCircle,
  Building,
  AlertTriangle,
  FileText,
  ArrowLeft,
  CheckCheck,
  User,
  Calendar,
} from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

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

interface ApprovalItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  current_stock: number;
  quantity_requested: number;
  quantity_already_approved: number;
  quantity_remaining_request: number;
  quantity_approved: number;
}

export default function StockRequestApprove() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<StockRequest | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [notes, setNotes] = useState("");

  // Reject Dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await stockRequestsApi.getById(Number(id));
      const data = response.data.data as StockRequest;
      setRequest(data);

      // Map items for approval
      const approvalItems: ApprovalItem[] = (data.items || []).map((item) => {
        const itemData = item.inventory || item.medicine;
        const quantityRemainingRequest = Math.max(0, item.quantity_requested - item.quantity_approved);
        const maxApproval = data.request_mode === "self_purchase"
          ? quantityRemainingRequest
          : Math.min(quantityRemainingRequest, itemData?.current_stock || 0);
        return {
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          current_stock: itemData?.current_stock || 0,
          quantity_requested: item.quantity_requested,
          quantity_already_approved: item.quantity_approved,
          quantity_remaining_request: quantityRemainingRequest,
          quantity_approved: maxApproval,
        };
      });
      setItems(approvalItems);
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
    setPageTitle("Proses Persetujuan");
    loadData();
  }, [loadData]);

  const handleItemChange = (itemId: number, quantity: number) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            quantity_approved: Math.min(
              Math.max(0, quantity),
              request?.request_mode === "self_purchase"
                ? item.quantity_remaining_request
                : Math.min(item.quantity_remaining_request, item.current_stock)
            ),
          }
          : item
      )
    );
  };

  const handleApproveAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity_approved: request?.request_mode === "self_purchase"
          ? item.quantity_remaining_request
          : Math.min(item.quantity_remaining_request, item.current_stock),
      }))
    );
  };

  const handleClearAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity_approved: 0,
      }))
    );
  };

  const handleApprove = async () => {
    // Validate at least one item has quantity
    const hasApprovedItems = items.some((item) => item.quantity_approved > 0);
    if (!hasApprovedItems) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Setidaknya satu item harus memiliki jumlah approval tambahan.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await stockRequestsApi.approve(Number(id), {
        items: items.map((item) => ({
          id: item.id,
          quantity_approved: item.quantity_approved,
        })),
        notes,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil disetujui.",
      });
      navigate(`/stock-requests/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyetujui permintaan.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Alasan penolakan wajib diisi.",
      });
      return;
    }

    setRejecting(true);
    try {
      await stockRequestsApi.reject(Number(id), {
        rejection_reason: rejectionReason,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permintaan berhasil ditolak.",
      });
      navigate(`/stock-requests/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menolak permintaan.",
      });
    } finally {
      setRejecting(false);
      setRejectDialogOpen(false);
    }
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

  if (request.status !== "pending" && request.status !== "partial") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-muted-foreground">
          Permintaan ini sudah diproses (Status: {stockRequestStatusLabels[request.status]})
        </p>
        <Button onClick={() => navigate(`/stock-requests/${id}`)}>
          Lihat Detail
        </Button>
      </div>
    );
  }

  const totalRequested = items.reduce((sum, item) => sum + item.quantity_requested, 0);
  const totalAlreadyApproved = items.reduce((sum, item) => sum + item.quantity_already_approved, 0);
  const totalApproveNow = items.reduce((sum, item) => sum + item.quantity_approved, 0);
  const totalAfterApprove = totalAlreadyApproved + totalApproveNow;
  const fullyCoveredCount = items.filter((item) => item.current_stock >= item.quantity_remaining_request).length;
  const approvalStageLabel = request.status === "partial" ? "Persetujuan Lanjutan" : "Persetujuan Awal";

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Proses Persetujuan"
        description="Nilai stok tersedia, tentukan jumlah yang disetujui, lalu selesaikan approval dengan catatan yang jelas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/stock-requests/${id}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Tolak
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!submitting && <CheckCircle className="mr-2 h-4 w-4" />}
              {request.status === "partial" ? "Setujui Lagi" : "Setujui"}
            </Button>
          </div>
        }
      />

      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-muted-foreground [&_input]:h-8 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,410px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
              <SectionPanel
                icon={CheckCheck}
                title="Informasi Permintaan"
                description="Lihat prioritas distribusi stok."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Mode</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{approvalStageLabel}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prioritas</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{priorityLabels[request.priority]}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-cyan-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Jenis Permintaan</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{requestModeLabels[request.request_mode] || request.request_mode}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty Sudah Approved</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{totalAlreadyApproved}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-rose-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty Belum Approved</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{Math.max(0, totalRequested - totalAlreadyApproved)}</div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/70 pt-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      No. Permintaan & Prioritas
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">{request.request_number}</p>
                      <Badge variant="outline" className={priorityColors[request.priority]}>
                        Prioritas: {priorityLabels[request.priority]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{requestTypeLabels[request.request_type]}</p>
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
                        Ke Ruangan (Anda)
                      </div>
                      <p className="text-sm font-medium">{request.to_room?.code} - {request.to_room?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        Diminta Oleh
                      </div>
                      <p className="text-sm font-medium">{request.requested_by?.full_name || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Tanggal Dibutuhkan
                      </div>
                      <p className="text-sm font-medium">{request.required_date ? new Date(request.required_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</p>
                    </div>
                  </div>
                </div>

                {request.reason ? (
                  <div className="space-y-1 border-t border-border/70 pt-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Alasan Permintaan</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                ) : null}
              </SectionPanel>

              <SectionPanel
                icon={FileText}
                title="Persetujuan"
                description="Tambahkan catatan approval sebelum keputusan akhir dikirimkan."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty Diminta</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{totalRequested}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty Approve Sekarang</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{totalApproveNow}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty Setelah Approve</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{totalAfterApprove}</div>
                  </div>
                </div>

                <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-3 text-xs leading-5 text-sky-800">
                  Approval tambahan otomatis dibatasi ke stok tersedia dan tidak bisa melebihi sisa item yang belum disetujui. Distribusi tetap bisa berjalan parsial dari total approval yang sudah terkumpul.
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-3 text-xs leading-5 text-amber-800">
                  {fullyCoveredCount} dari {items.length} item dapat ditutup penuh pada sesi ini. Sisanya bisa tetap parsial dan di-approve lagi saat stok tersedia.
                </div>

                <div className="space-y-1">
                  <Label>Catatan Persetujuan</Label>
                  <Textarea
                    placeholder="Catatan tambahan untuk persetujuan ini"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                </div>
              </SectionPanel>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={request.request_type === "inventory" ? Package : Pill}
              title="Daftar Item"
              description="Tentukan jumlah yang disetujui berdasarkan stok yang benar-benar tersedia di ruangan Anda."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
              actions={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={handleApproveAll}>
                    Setujui Semua
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={handleClearAll}>
                    Reset
                  </Button>
                </div>
              }
            >
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/80 bg-background">
                <ScrollArea className="h-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th rowSpan={2} className="h-9 w-[30%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th rowSpan={2} className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sat</th>
                        <th colSpan={4} className="h-9 border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                        <th rowSpan={2} className="h-9 w-[16%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Status</th>
                      </tr>
                      <tr className="bg-muted/10">
                        <th className="h-8 w-[11%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Stok</th>
                        <th className="h-8 w-[11%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Diminta</th>
                        <th className="h-8 w-[11%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Sudah</th>
                        <th className="h-8 w-[11%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Approve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const maxApproved = request.request_mode === "self_purchase"
                          ? item.quantity_remaining_request
                          : Math.min(item.quantity_remaining_request, item.current_stock);
                        const stockEnough = request.request_mode === "self_purchase" || item.current_stock >= item.quantity_remaining_request;
                        const totalAfterItemApproval = item.quantity_already_approved + item.quantity_approved;
                        return (
                          <tr key={item.id} className="transition-colors hover:bg-muted/10">
                            <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                              <div className="flex items-start gap-2">
                                {item.inventory_id ? (
                                  <Package className="mt-0.5 h-4 w-4 text-blue-500" />
                                ) : (
                                  <Pill className="mt-0.5 h-4 w-4 text-green-500" />
                                )}
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                                  <p className="font-mono text-[11px] leading-4 text-muted-foreground">{item.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">
                              {item.unit}
                            </td>
                            <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center">
                              <Badge
                                variant="outline"
                                className={stockEnough ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}
                              >
                                {item.current_stock}
                              </Badge>
                            </td>
                            <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-sm font-medium text-foreground">
                              {item.quantity_requested}
                            </td>
                            <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-sm font-medium text-foreground">
                              {item.quantity_already_approved}
                            </td>
                            <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxApproved}
                                  value={item.quantity_approved}
                                  onChange={(e) => handleItemChange(item.id, parseInt(e.target.value) || 0)}
                                  className="h-8 text-center text-xs"
                                />
                                <p className="text-[11px] text-muted-foreground">Maks. {maxApproved} dari sisa {item.quantity_remaining_request}</p>
                              </div>
                            </td>
                            <td className="border-b border-border/60 px-3 py-1.5 align-middle text-[11px] text-muted-foreground">
                              {item.quantity_remaining_request === 0 ? (
                                <span className="text-emerald-600">Sudah penuh</span>
                              ) : item.quantity_approved === 0 ? (
                                <span className="text-amber-600">Belum ada tambahan</span>
                              ) : totalAfterItemApproval < item.quantity_requested ? (
                                <span className="text-amber-600">Parsial ({item.quantity_requested - totalAfterItemApproval} belum approved)</span>
                              ) : (
                                <span className="text-emerald-600">Sesuai permintaan</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </SectionPanel>
          </div>
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tolak Permintaan</DialogTitle>
              <DialogDescription>
                Berikan alasan mengapa permintaan ini ditolak.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Alasan Penolakan *</Label>
                <Textarea
                  placeholder="Jelaskan alasan penolakan..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejecting || !rejectionReason.trim()}
              >
                {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tolak Permintaan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PageShell>
  );
}
