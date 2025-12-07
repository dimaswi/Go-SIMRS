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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="flex flex-1 flex-col gap-4 p-6">
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/purchases")}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base font-semibold">
                    {purchase.purchase_number}
                  </CardTitle>
                  <Badge className={statusColors[status]}>
                    {statusLabels[status]}
                  </Badge>
                </div>
                <CardDescription>Detail pembelian</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
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
                  Terima Barang
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Info Section */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
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
          </div>

          {purchase.notes && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Catatan</p>
              <p className="text-sm">{purchase.notes}</p>
            </div>
          )}

          <Separator />

          {/* Items Table */}
          <div>
            <h3 className="font-semibold mb-4">Daftar Item</h3>
            <Table>
              <TableHeader>
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
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">Tidak ada item</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
