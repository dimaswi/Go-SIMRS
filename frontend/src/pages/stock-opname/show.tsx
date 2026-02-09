import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  User,
  CheckCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { stockOpnameApi, type StockOpname } from "@/lib/api/stock-requests";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  in_progress: "Dalam Proses",
  completed: "Selesai",
  approved: "Disetujui",
  cancelled: "Dibatalkan",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-400",
};

export default function StockOpnameShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [opname, setOpname] = useState<StockOpname | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await stockOpnameApi.getById(parseInt(id));
      setOpname(response.data.data);
      setPageTitle(`Stock Opname - ${response.data.data.opname_number}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data stock opname.",
      });
      navigate("/stock-opname");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleComplete = async () => {
    if (!id) return;

    setCompleting(true);
    try {
      await stockOpnameApi.complete(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil diselesaikan.",
      });
      loadData();
      setShowCompleteDialog(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyelesaikan stock opname.",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;

    setApproving(true);
    try {
      await stockOpnameApi.approve(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil disetujui dan stok telah disesuaikan.",
      });
      loadData();
      setShowApproveDialog(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyetujui stock opname.",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await stockOpnameApi.delete(parseInt(id));
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil dihapus.",
      });
      navigate("/stock-opname");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menghapus stock opname.",
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

  if (!opname) {
    return null;
  }

  const status = opname.status || "draft";
  const isDraft = status === "draft";
  const canEdit = hasPermission("stock_opname.update") && isDraft;
  const canDelete = hasPermission("stock_opname.delete") && isDraft;
  const canComplete =
    hasPermission("stock_opname.complete") &&
    (status === "draft" || status === "in_progress");
  const canApprove =
    hasPermission("stock_opname.approve") && status === "completed";

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Calculate differences
  const totalDifference =
    opname.items?.reduce(
      (sum, item) => sum + (item.difference || 0),
      0
    ) || 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/stock-opname")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">
                {opname.opname_number}
              </h1>
              <Badge className={statusColors[status]}>
                {statusLabels[status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Detail stock opname</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/stock-opname/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canComplete && (
            <Button size="sm" onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Selesaikan
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="default" onClick={() => setShowApproveDialog(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Setujui & Sesuaikan Stok
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-6">
          {/* Info Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Ruangan</p>
                <p className="font-medium">{opname.room?.name || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Tanggal Opname</p>
                <p className="font-medium">{formatDate(opname.opname_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Dibuat Oleh</p>
                <p className="font-medium">{opname.created_by?.full_name || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Total Selisih</p>
                <p
                  className={`text-lg font-bold ${
                    totalDifference === 0
                      ? "text-green-600"
                      : totalDifference > 0
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}
                >
                  {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                </p>
              </div>
            </div>
          </div>

          {opname.notes && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Catatan</p>
              <p className="text-sm">{opname.notes}</p>
            </div>
          )}

          <Separator className="my-6" />

          {/* Items Table */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Daftar Item</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead className="text-right">Stok Sistem</TableHead>
                <TableHead className="text-right">Stok Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opname.items && opname.items.length > 0 ? (
                opname.items.map((item, index) => {
                  const difference = item.difference || 0;
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
                        {item.system_stock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.physical_stock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            difference === 0
                              ? "text-green-600"
                              : difference > 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {difference > 0 ? `+${difference}` : difference}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.notes || "-"}
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
      </div>

      {/* Complete Dialog */}
      <ConfirmDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        title="Selesaikan Stock Opname?"
        description="Setelah diselesaikan, stock opname akan menunggu persetujuan. Pastikan data sudah benar sebelum menyelesaikan."
        confirmText={completing ? "Memproses..." : "Selesaikan"}
        onConfirm={handleComplete}
      />

      {/* Approve Dialog */}
      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title="Setujui Stock Opname?"
        description="Setelah disetujui, stok akan disesuaikan dengan hasil penghitungan fisik. Tindakan ini tidak dapat dibatalkan."
        confirmText={approving ? "Memproses..." : "Setujui & Sesuaikan Stok"}
        onConfirm={handleApprove}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Hapus Stock Opname?"
        description="Apakah Anda yakin ingin menghapus stock opname ini? Tindakan ini tidak dapat dibatalkan."
        confirmText={deleting ? "Menghapus..." : "Hapus"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
