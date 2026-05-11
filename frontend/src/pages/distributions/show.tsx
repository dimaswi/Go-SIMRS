import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FileText,
  AlertTriangle,
  ArrowLeft,
  Truck,
} from "lucide-react";
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("border border-border/70 bg-background/95 shadow-sm", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-4 py-3", headerClassName)}>
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
      <div className={cn("p-3 sm:p-4", contentClassName)}>{children}</div>
    </div>
  );
}

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
    <PageShell>
      <PageHeader
        title="Detail Distribusi"
        description="Lihat rute distribusi, pihak yang terlibat, dan item yang telah dikirim atau diterima dari satu tampilan yang lebih ringkas."
        icon={Truck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/distributions')}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {canReceive && (
              <Button size="sm" onClick={() => setReceiveDialogOpen(true)}>
                <CheckCircle className="h-4 w-4" />
                Terima Distribusi
              </Button>
            )}
          </div>
        }
      >
      </PageHeader>

      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
              <SectionPanel icon={Truck} title="Informasi Distribusi" description="Ringkasan nomor distribusi, jalur ruangan, tanggal kirim, dan referensi permintaan.">
                <div className="grid gap-2 border border-border/70 bg-muted/10 px-3 py-3 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">No. Distribusi</div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-foreground">{distribution.distribution_number}</p>
                      <Badge className={statusColors[distribution.status]}>
                        {statusLabels[distribution.status]}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Dari Ruangan</div>
                    <div className="mt-1 font-semibold text-foreground">{distribution.from_room?.code} - {distribution.from_room?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ke Ruangan</div>
                    <div className="mt-1 font-semibold text-foreground">{distribution.to_room?.code} - {distribution.to_room?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tanggal Distribusi</div>
                    <div className="mt-1 font-semibold text-foreground">{formatDate(distribution.distribution_date)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Jumlah Item</div>
                    <div className="mt-1 font-semibold text-foreground">{distribution.items?.length || 0} item</div>
                  </div>
                  {distribution.stock_request && (
                    <div className="sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">No. Permintaan</div>
                      <Button
                        variant="link"
                        className="mt-1 h-auto p-0 text-sm font-semibold"
                        onClick={() => navigate(`/stock-requests/${distribution.stock_request_id}`)}
                      >
                        {distribution.stock_request.request_number}
                      </Button>
                    </div>
                  )}
                </div>
              </SectionPanel>

              <SectionPanel icon={User} title="Pihak Terlibat" description="Jejak pengirim dan penerima distribusi ini.">
                <div className="grid gap-2 border border-border/70 bg-muted/10 px-3 py-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Dikirim Oleh</div>
                    <div className="mt-1 font-semibold text-foreground">{distribution.distributed_by?.full_name || "-"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(distribution.distribution_date)}</div>
                  </div>
                  {distribution.received_by ? (
                    <div className="border-t border-border/70 pt-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Diterima Oleh</div>
                      <div className="mt-1 font-semibold text-foreground">{distribution.received_by?.full_name || "-"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(distribution.received_date)}</div>
                    </div>
                  ) : (
                    <div className="border-t border-border/70 pt-3 text-sm text-muted-foreground">
                      Distribusi ini belum diterima.
                    </div>
                  )}
                </div>
              </SectionPanel>

              {distribution.notes && (
                <SectionPanel icon={FileText} title="Catatan" description="Keterangan tambahan dari proses distribusi.">
                  <div className="border border-border/70 bg-muted/10 px-3 py-3 text-sm text-foreground">
                    {distribution.notes}
                  </div>
                </SectionPanel>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={Package}
              title="Daftar Item"
              description={`Rincian ${distribution.items?.length || 0} item yang ikut dalam distribusi ini.`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
              actions={<span className="text-xs text-muted-foreground">{distribution.items?.length || 0} item total</span>}
            >
              <div className="min-h-0 flex-1 overflow-hidden border border-border/80 bg-background">
                <ScrollArea className="h-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th className="h-9 w-[7%] border-b border-r border-border/70 px-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">No</th>
                        <th className="h-9 w-[16%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Kode</th>
                        <th className="h-9 w-[25%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Batch</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Exp Date</th>
                        <th className="h-9 w-[10%] border-b border-r border-border/70 px-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Qty</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Satuan</th>
                        <th className="h-9 border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distribution.items && distribution.items.length > 0 ? (
                        distribution.items.map((item, index) => {
                          const itemData = item.inventory || item.medicine;
                          return (
                            <tr key={item.id} className="transition-colors hover:bg-muted/5">
                              <td className="border-b border-r border-border/60 px-2 py-2.5 align-top text-xs text-muted-foreground">{index + 1}</td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top font-mono text-[11px] text-muted-foreground">
                                {itemData?.code || "-"}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2">
                                  {item.inventory_id ? (
                                    <Package className="mt-0.5 h-4 w-4 text-blue-500" />
                                  ) : (
                                    <Pill className="mt-0.5 h-4 w-4 text-green-500" />
                                  )}
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="text-xs font-semibold text-foreground">{itemData?.name || "-"}</div>
                                    <div className="text-[11px] text-muted-foreground">{item.inventory_id ? "Inventaris" : "Obat"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-foreground">{item.batch_number || "-"}</td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-foreground">
                                {item.expiry_date
                                  ? new Date(item.expiry_date).toLocaleDateString("id-ID", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "-"}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-center text-sm font-semibold text-foreground">
                                {item.quantity}
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-foreground">
                                {item.unit || itemData?.unit || "-"}
                              </td>
                              <td className="border-b border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                                {item.notes || "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
      </PageContent>
    </PageShell>
  );
}
