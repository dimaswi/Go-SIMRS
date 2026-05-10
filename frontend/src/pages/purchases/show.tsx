import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { purchasesApi, type Purchase } from "@/lib/api/stock-requests";

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

export default function PurchaseShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);

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

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title={purchase.purchase_number}
        description="Lihat status pembelian, supplier, total nilai, dan progres penerimaan item."
        actions={
          <Button variant="outline" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-6">
        <div className="grid min-h-0 flex-1 gap-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11 lg:grid-cols-[minmax(240px,20%)_minmax(0,1fr)]">
          <div className="space-y-6 lg:overflow-hidden">
            <SectionPanel
              icon={Building2}
              title="Informasi Pembelian"
              description="Ringkasan supplier, ruangan tujuan, tanggal pembelian, penanggung jawab, dan total transaksi."
            >
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">No. Pembelian & Status</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-base font-medium">{purchase.purchase_number}</p>
                    <Badge className={statusColors[status]}>
                      {statusLabels[status]}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    Supplier
                  </div>
                  <p className="font-medium">
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
                  <p className="font-medium">{purchase.to_room?.name || "-"}</p>
                  {purchase.to_room?.code && (
                    <p className="text-xs text-muted-foreground">
                      {purchase.to_room.code}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Tanggal Pembelian
                  </div>
                  <p className="font-medium">{formatDate(purchase.order_date || purchase.created_at)}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Dibuat Oleh
                  </div>
                  <p className="font-medium">{purchase.created_by?.full_name || "-"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Total
                  </div>
                  <p className="text-lg font-bold text-primary">
                    Rp {(purchase.total_amount || 0).toLocaleString("id-ID")}
                  </p>
                </div>

                {purchase.notes && (
                  <div className="border-t border-border/70 pt-4">
                    <p className="mb-1 text-sm text-muted-foreground">Catatan</p>
                    <p className="text-sm">{purchase.notes}</p>
                  </div>
                )}
              </div>
            </SectionPanel>
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
            <SectionPanel
              icon={PackageCheck}
              title="Daftar Item"
              description="Rincian item yang dipesan, jumlah yang sudah diterima, harga satuan, dan subtotal per item."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            >
              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Diterima</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchase.items && purchase.items.length > 0 ? (
                      purchase.items.map((item, index) => {
                        const itemName = item.inventory?.name || item.medicine?.name || "-";
                        const itemCode = item.inventory?.code || item.medicine?.code;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{itemName}</p>
                                {itemCode && (
                                  <p className="text-xs text-muted-foreground">
                                    {itemCode}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity_ordered} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  (item.quantity_received || 0) >= item.quantity_ordered
                                    ? "text-green-600"
                                    : "text-orange-600"
                                }
                              >
                                {item.quantity_received || 0}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              Rp {(item.unit_price || 0).toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              Rp {(item.total_price || 0).toLocaleString("id-ID")}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <p className="text-muted-foreground">Tidak ada item</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionPanel>

            <div className="flex shrink-0 items-center justify-between border-t bg-background pt-3">
              <Button variant="outline" onClick={() => navigate("/purchases")}>
                Kembali
              </Button>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/purchases/${id}/edit`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
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
                  <Button onClick={() => navigate(`/purchases/${id}/receive`)}>
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Terima Barang
                  </Button>
                )}
              </div>
            </div>
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
    </PageShell>
  );
}
