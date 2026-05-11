import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/lib/api/stock-requests";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
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

interface ApprovalItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  current_stock: number;
  quantity_requested: number;
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
        return {
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          current_stock: itemData?.current_stock || 0,
          quantity_requested: item.quantity_requested,
          quantity_approved: item.quantity_requested, // Default to requested amount
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
          ? { ...item, quantity_approved: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleApproveAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity_approved: item.quantity_requested,
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
        description: "Setidaknya satu item harus memiliki jumlah yang disetujui.",
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

  if (request.status !== "pending") {
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

  return (
    <PageShell>
      <PageHeader
        title="Proses Persetujuan"
        description="Nilai stok tersedia, tentukan jumlah yang disetujui, lalu selesaikan approval dengan catatan yang jelas."
        icon={CheckCheck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/stock-requests/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>
              <XCircle className="h-4 w-4" />
              Tolak
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" />
              Setujui
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Approval item per item</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Stok tersedia langsung terlihat</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Setujui semua atau reset cepat</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">No. Permintaan</div><div className="mt-1 text-sm font-semibold text-foreground">{request.request_number}</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prioritas</div><div className="mt-1 text-sm font-semibold text-foreground">{priorityLabels[request.priority]}</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Jumlah Item</div><div className="mt-1 text-sm font-semibold text-foreground">{items.length} item</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-rose-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ruang Pemohon</div><div className="mt-1 text-sm font-semibold text-foreground">{request.from_room?.name || "-"}</div></div>
        </div>

        <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
          <SectionPanel icon={CheckCheck} title="Informasi Permintaan" description="Lihat prioritas, ruangan asal-tujuan, dan alasan sebelum menyetujui distribusi stok.">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-1 lg:col-span-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    No. Permintaan & Prioritas
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium font-mono text-base">{request.request_number}</p>
                    <Badge variant="outline" className={priorityColors[request.priority]}>
                      Prioritas: {priorityLabels[request.priority]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {requestTypeLabels[request.request_type]}
                  </p>
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
                    Ke Ruangan (Anda)
                  </div>
                  <p className="font-medium">
                    {request.to_room?.code} - {request.to_room?.name}
                  </p>
                </div>

                {/* Requested By */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Diminta Oleh
                  </div>
                  <p className="font-medium">{request.requested_by?.full_name || "-"}</p>
                </div>
              </div>

              {request.reason && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Alasan Permintaan</div>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                </>
              )}
            </div>
          </SectionPanel>

          {/* Items Approval Card */}
          <SectionPanel icon={request.request_type === "inventory" ? Package : Pill} title="Daftar Item" description="Tentukan jumlah yang disetujui berdasarkan stok yang benar-benar tersedia di ruangan Anda.">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center justify-between flex-1">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tentukan jumlah yang disetujui untuk setiap item</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleApproveAll}>
                    Setujui Semua
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAll}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
            <div className="-mx-3 -mb-4 px-3 pb-4 sm:-mx-4 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead className="text-center">Stok Tersedia</TableHead>
                    <TableHead className="text-center">Qty Diminta</TableHead>
                    <TableHead className="text-center">Qty Disetujui</TableHead>
                    <TableHead>Satuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.inventory_id ? (
                            <Package className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Pill className="h-4 w-4 text-green-500" />
                          )}
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            item.current_stock >= item.quantity_requested
                              ? "default"
                              : "destructive"
                          }
                        >
                          {item.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.quantity_requested}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Input
                            type="number"
                            min={0}
                            max={Math.min(item.quantity_requested, item.current_stock)}
                            value={item.quantity_approved}
                            onChange={(e) =>
                              handleItemChange(item.id, parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-center"
                          />
                        </div>
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionPanel>

          <SectionPanel icon={FileText} title="Persetujuan" description="Tambahkan catatan approval sebelum keputusan akhir dikirimkan.">
            <div>
              {/* Notes */}
              <div className="space-y-2">
                <Label>Catatan Persetujuan</Label>
                <Textarea
                  placeholder="Catatan tambahan untuk persetujuan ini..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Sticky Footer Actions */}
              <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-4 border-t border-border/70 bg-background/95 backdrop-blur">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/stock-requests/${id}`)}
                >
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Tolak
                </Button>
                <Button onClick={handleApprove} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Setujui
                </Button>
              </div>
            </div>
          </SectionPanel>
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
