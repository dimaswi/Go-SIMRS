import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CircleAlert,
  FileText,
  User,
  CheckCircle,
  Pencil,
  Trash2,
  ClipboardList,
  Package,
  Pill,
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

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

function SummaryCue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br px-4 py-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

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
      <PageShell>
        <PageHeader title="Detail Stock Opname" description="Lihat hasil hitung fisik, status approval, dan selisih per item." />
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
  const matchedItems = opname.items?.filter((item) => (item.difference || 0) === 0).length || 0;
  const surplusItems = opname.items?.filter((item) => (item.difference || 0) > 0).length || 0;
  const deficitItems = opname.items?.filter((item) => (item.difference || 0) < 0).length || 0;

  return (
    <PageShell>
      <PageHeader
        title={opname.opname_number}
        description="Lihat status opname, total selisih, dan rincian hasil hitung fisik per item."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/stock-opname")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
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
        }
      />
      <PageContent className="flex-none pb-8">
        <div className="space-y-6">
          <SectionPanel
            icon={Building2}
            title="Informasi Stock Opname"
            description="Ringkasan ruangan, tanggal opname, petugas pembuat, dan akumulasi selisih stok."
            actions={<Badge className={statusColors[status]}>{statusLabels[status]}</Badge>}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 pb-4">
              <SummaryCue label="Item Sesuai" value={`${matchedItems}`} tone="from-emerald-50 via-background to-background" />
              <SummaryCue label="Surplus" value={`${surplusItems}`} tone="from-blue-50 via-background to-background" />
              <SummaryCue label="Defisit" value={`${deficitItems}`} tone="from-rose-50 via-background to-background" />
              <SummaryCue label="Total Selisih" value={totalDifference > 0 ? `+${totalDifference}` : `${totalDifference}`} tone="from-amber-50 via-background to-background" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Ruangan</p>
                  <p className="font-medium">{opname.room?.name || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Opname</p>
                  <p className="font-medium">{formatDate(opname.opname_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Dibuat Oleh</p>
                  <p className="font-medium">{opname.created_by?.full_name || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Jumlah Item</p>
                  <p className="text-lg font-bold text-foreground">{opname.items?.length || 0}</p>
                </div>
              </div>
            </div>

            {opname.notes && (
              <div className="mt-6 rounded-md border border-border/70 bg-muted/40 p-4">
                <p className="mb-1 text-sm text-muted-foreground">Catatan</p>
                <p className="text-sm">{opname.notes}</p>
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            icon={ClipboardList}
            title="Daftar Item"
            description="Bandingkan stok sistem dan fisik untuk setiap item, lengkap dengan selisih dan catatan lapangan."
            actions={
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleAlert className="h-3.5 w-3.5" />
                Fokus pada item dengan selisih non-zero
              </div>
            }
          >
            <div className="-mx-3 -mb-4 sm:-mx-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Tipe</TableHead>
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
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {item.inventory_id ? (
                                <>
                                  <Package className="h-3 w-3" />
                                  Inventaris
                                </>
                              ) : (
                                <>
                                  <Pill className="h-3 w-3" />
                                  Obat
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.system_stock} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.physical_stock} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <Badge
                                variant="outline"
                                className={
                                  difference === 0
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : difference > 0
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }
                              >
                                {difference > 0 ? `+${difference}` : difference}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        <p className="text-muted-foreground">Tidak ada item</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionPanel>
        </div>
      </PageContent>

      <ConfirmDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        title="Selesaikan Stock Opname?"
        description="Setelah diselesaikan, stock opname akan menunggu persetujuan. Pastikan data sudah benar sebelum menyelesaikan."
        confirmText={completing ? "Memproses..." : "Selesaikan"}
        onConfirm={handleComplete}
      />

      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title="Setujui Stock Opname?"
        description="Setelah disetujui, stok akan disesuaikan dengan hasil penghitungan fisik. Tindakan ini tidak dapat dibatalkan."
        confirmText={approving ? "Memproses..." : "Setujui & Sesuaikan Stok"}
        onConfirm={handleApprove}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Hapus Stock Opname?"
        description="Apakah Anda yakin ingin menghapus stock opname ini? Tindakan ini tidak dapat dibatalkan."
        confirmText={deleting ? "Menghapus..." : "Hapus"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </PageShell>
  );
}
