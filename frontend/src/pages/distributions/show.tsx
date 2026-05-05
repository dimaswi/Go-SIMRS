import { useState, useEffect, useCallback } from "react";
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
  distributionsApi,
  type StockDistribution,
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
  User,
  Calendar,
  Building,
  FileText,
  AlertTriangle,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  delivered: "Dikirim",
  received: "Diterima",
};

export default function DistributionShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [distribution, setDistribution] = useState<StockDistribution | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await distributionsApi.getById(Number(id));
      setDistribution(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data distribusi.",
      });
      navigate("/distributions");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Detail Distribusi");
    loadData();
  }, [loadData]);

  const handleReceive = async () => {
    setReceiving(true);
    try {
      await distributionsApi.receive(Number(id));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Distribusi berhasil diterima.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menerima distribusi.",
      });
    } finally {
      setReceiving(false);
      setReceiveDialogOpen(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!distribution) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate("/distributions")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  const canReceive = hasPermission("distributions.receive") &&
    (distribution.status === "pending" || distribution.status === "delivered");

  return (
    <div className="flex flex-1 flex-col px-4">


      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Package className="h-3 w-3" />
            Informasi Distribusi
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  No. Distribusi & Status
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-medium font-mono text-base">{distribution.distribution_number}</p>
                  <Badge className={statusColors[distribution.status]}>
                    {statusLabels[distribution.status]}
                  </Badge>
                </div>
              </div>
              {/* From Room */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Dari Ruangan
                </div>
                <p className="font-medium">
                  {distribution.from_room?.code} - {distribution.from_room?.name}
                </p>
              </div>

              {/* To Room */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Ke Ruangan
                </div>
                <p className="font-medium">
                  {distribution.to_room?.code} - {distribution.to_room?.name}
                </p>
              </div>

              {/* Distribution Date */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Tanggal Distribusi
                </div>
                <p className="font-medium">{formatDate(distribution.distribution_date)}</p>
              </div>

              {/* Request Number */}
              {distribution.stock_request && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    No. Permintaan
                  </div>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium"
                    onClick={() => navigate(`/stock-requests/${distribution.stock_request_id}`)}
                  >
                    {distribution.stock_request.request_number}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* People Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <User className="h-3 w-3" />
            Informasi Pihak Terlibat
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Distributed By */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Dikirim Oleh
                </div>
                <p className="font-medium">{distribution.distributed_by?.full_name || "-"}</p>
                <p className="text-xs text-muted-foreground">{formatDate(distribution.distribution_date)}</p>
              </div>

              {/* Received By */}
              {distribution.received_by && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    Diterima Oleh
                  </div>
                  <p className="font-medium">{distribution.received_by?.full_name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(distribution.received_date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {distribution.notes && (
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3" />
              Catatan
            </div>
            <div className="p-3 sm:p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Catatan
                </div>
                <p className="text-sm">{distribution.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Package className="h-3 w-3" />
            Daftar Item ({distribution.items?.length || 0} item)
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Exp. Date</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribution.items && distribution.items.length > 0 ? (
                  distribution.items.map((item, index) => {
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
                        <TableCell className="font-mono text-sm">
                          {item.batch_number || "-"}
                        </TableCell>
                        <TableCell>
                          {item.expiry_date
                            ? new Date(item.expiry_date).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {item.quantity}
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
        </div>
      </div>

      {/* Receive Confirmation Dialog */}
      <ConfirmDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        title="Terima Distribusi?"
        description="Apakah Anda yakin sudah menerima semua item dalam distribusi ini?"
        confirmText={receiving ? "Memproses..." : "Ya, Terima"}
        cancelText="Batal"
        onConfirm={handleReceive}
      />

      {/* Sticky Footer Actions */}
      <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-between border-t bg-background">
        <Button variant="outline" onClick={() => navigate("/distributions")}>
          Kembali
        </Button>
        <div className="flex gap-2">
          {canReceive && (
            <Button onClick={() => setReceiveDialogOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Terima Distribusi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
