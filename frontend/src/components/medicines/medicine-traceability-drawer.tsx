import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  medicineCategoryLabels,
  medicineFormLabels,
  medicinesApi,
  medicineTypeLabels,
  type Medicine,
  type MedicineTraceability,
} from '@/lib/api/medicines';
import { cn } from '@/lib/utils';
import { Activity, ArrowRightLeft, ClipboardList, PackageSearch, Pill } from 'lucide-react';

interface MedicineTraceabilityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineId: number | null;
  initialMedicine?: Medicine | null;
  onOpenDetail?: (id: number) => void;
}

function formatDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(date);
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function statusTone(status?: string) {
  const value = (status || '').toLowerCase();

  if (['approved', 'completed', 'received', 'ready', 'delivered', 'given', 'paid', 'active'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (['partial', 'pending', 'reviewed', 'preparing', 'scheduled'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (['cancelled', 'rejected', 'held', 'skipped', 'refused', 'not_available', 'unpaid'].includes(value)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function SectionStrip({ title, icon: Icon, count }: { title: string; icon: typeof PackageSearch; count?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
      </div>
      {typeof count === 'number' ? <span className="text-[11px] text-muted-foreground">{formatNumber(count)}</span> : null}
    </div>
  );
}

function KeyValueRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-border/60 px-4 py-2 text-sm last:border-b-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 break-words text-foreground', valueClassName)}>{value || '-'}</span>
    </div>
  );
}

export function MedicineTraceabilityDrawer({
  open,
  onOpenChange,
  medicineId,
  initialMedicine,
  onOpenDetail,
}: MedicineTraceabilityDrawerProps) {
  const [data, setData] = useState<MedicineTraceability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !medicineId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await medicinesApi.getTraceability(medicineId);
        if (!cancelled) {
          setData(response.data.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat traceability obat.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [medicineId, open]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
      setData(null);
    }
  }, [open]);

  const medicine = data?.medicine || initialMedicine || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-screen max-w-[100vw] border-l border-border/70 p-0 sm:w-[90vw] sm:max-w-[90vw]">
        <div className="flex h-full flex-col bg-background">
          <SheetHeader className="border-b border-border/70 px-6 py-5 pr-14">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  {medicine?.name || 'Traceability Obat'}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Lacak alur obat dari pembelian, perpindahan antar-ruang, sampai pemakaian ke pasien.
                </SheetDescription>
              </div>
              {medicineId && onOpenDetail ? (
                <Button variant="outline" size="sm" className="rounded-none" onClick={() => onOpenDetail(medicineId)}>
                  Buka Detail Obat
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {medicine?.code ? <Badge variant="outline" className="rounded-none font-mono">{medicine.code}</Badge> : null}
              {medicine?.category ? <Badge className="rounded-none border-border bg-background text-foreground">{medicineCategoryLabels[medicine.category]}</Badge> : null}
              {medicine?.type ? <Badge className="rounded-none border-border bg-background text-foreground">{medicineTypeLabels[medicine.type]}</Badge> : null}
              {medicine?.form ? <Badge className="rounded-none border-border bg-background text-foreground">{medicineFormLabels[medicine.form]}</Badge> : null}
              {medicine?.strength ? <Badge className="rounded-none border-border bg-background text-foreground">{medicine.strength}</Badge> : null}
            </div>
          </SheetHeader>

          {error ? (
            <div className="border-b border-border/70 bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[300px_minmax(0,0.9fr)_minmax(0,0.95fr)_minmax(0,1.15fr)]">
            <ScrollArea className="min-h-0 border-b border-border/70 lg:border-r lg:border-b-0">
              <div>
                <SectionStrip title="Ringkasan Obat" icon={Pill} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-5 w-3/4 rounded-none" />
                    <Skeleton className="h-5 w-full rounded-none" />
                    <Skeleton className="h-5 w-2/3 rounded-none" />
                  </div>
                ) : medicine ? (
                  <>
                    <KeyValueRow label="Nama" value={medicine.name} />
                    <KeyValueRow label="Generik" value={medicine.generic_name || '-'} />
                    <KeyValueRow label="Produsen" value={medicine.manufacturer || '-'} />
                    <KeyValueRow label="Unit" value={medicine.unit} />
                    <KeyValueRow label="Stok Total" value={`${formatNumber(data?.stats.total_stock ?? medicine.current_stock)} ${medicine.unit}`} valueClassName="font-semibold" />
                    <KeyValueRow label="Min-Max" value={`${formatNumber(medicine.min_stock)} - ${formatNumber(medicine.max_stock)} ${medicine.unit}`} />
                    <KeyValueRow label="Harga Beli" value={formatCurrency(medicine.purchase_price)} />
                    <KeyValueRow label="Harga Jual" value={formatCurrency(medicine.selling_price)} />
                  </>
                ) : (
                  <EmptyState label="Data obat belum tersedia." />
                )}

                <SectionStrip title="Jejak Ringkas" icon={PackageSearch} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-10 w-full rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                    <Skeleton className="h-10 w-full rounded-none" />
                  </div>
                ) : data ? (
                  <>
                    <KeyValueRow label="Ruang" value={`${formatNumber(data.stats.room_count)} lokasi stok`} />
                    <KeyValueRow label="Pembelian" value={`${formatNumber(data.stats.purchase_count)} transaksi`} />
                    <KeyValueRow label="Permintaan" value={`${formatNumber(data.stats.request_count)} permintaan`} />
                    <KeyValueRow label="Distribusi" value={`${formatNumber(data.stats.distribution_count)} pengiriman`} />
                    <KeyValueRow label="Pasien" value={`${formatNumber(data.stats.patient_usage_count)} order pasien`} />
                  </>
                ) : (
                  <EmptyState label="Belum ada jejak yang tercatat." />
                )}

                <SectionStrip title="Sebaran Stok Ruang" icon={ArrowRightLeft} count={data?.room_stocks.length} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-12 w-full rounded-none" />
                    <Skeleton className="h-12 w-full rounded-none" />
                  </div>
                ) : data?.room_stocks.length ? (
                  <div className="divide-y divide-border/60">
                    {data.room_stocks.map((stock) => (
                      <div key={stock.room_id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{stock.room_name || '-'}</div>
                            <div className="text-xs text-muted-foreground">{stock.room_code || '-'}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-foreground">{formatNumber(stock.quantity)}</div>
                            <div className="text-xs text-muted-foreground">min {formatNumber(stock.min_quantity)}</div>
                          </div>
                        </div>
                        {stock.notes ? <div className="mt-2 text-xs text-muted-foreground">{stock.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Obat ini belum terpasang di stok ruang." />
                )}
              </div>
            </ScrollArea>

            <ScrollArea className="min-h-0 border-b border-border/70 xl:border-r xl:border-b-0">
              <div>
                <SectionStrip title="Pembelian" icon={PackageSearch} count={data?.purchases.length} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-14 w-full rounded-none" />
                    <Skeleton className="h-14 w-full rounded-none" />
                  </div>
                ) : data?.purchases.length ? (
                  <div className="divide-y divide-border/60">
                    {data.purchases.map((purchase) => (
                      <div key={`${purchase.purchase_id}-${purchase.batch_number || 'no-batch'}`} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{purchase.purchase_number}</div>
                            <div className="text-xs text-muted-foreground">{purchase.supplier_name || '-'}</div>
                          </div>
                          <Badge className={cn('rounded-none border', statusTone(purchase.status))}>{purchase.status || '-'}</Badge>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <div>Masuk ke: {purchase.destination_room || '-'}</div>
                          <div>Tgl order: {formatDate(purchase.order_date)} | Tgl terima: {formatDate(purchase.received_date)}</div>
                          <div>Qty: {formatNumber(purchase.quantity_received)} / {formatNumber(purchase.quantity_ordered)} {purchase.unit}</div>
                          <div>Harga: {formatCurrency(purchase.total_price)} {purchase.batch_number ? `| Batch ${purchase.batch_number}` : ''}</div>
                          <div>Sisa terima: {formatNumber(purchase.remaining_quantity)} {purchase.unit}</div>
                          {purchase.expiry_date ? <div>ED: {formatDate(purchase.expiry_date)}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Belum ada riwayat pembelian obat ini." />
                )}
              </div>
            </ScrollArea>

            <ScrollArea className="min-h-0 border-b border-border/70 lg:border-r lg:border-b-0">
              <div>
                <SectionStrip title="Permintaan Stok" icon={ClipboardList} count={data?.requests.length} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-14 w-full rounded-none" />
                    <Skeleton className="h-14 w-full rounded-none" />
                  </div>
                ) : data?.requests.length ? (
                  <div className="divide-y divide-border/60">
                    {data.requests.map((request) => (
                      <div key={request.request_id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{request.request_number}</div>
                            <div className="text-xs text-muted-foreground">{request.from_room} {'->'} {request.to_room}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn('rounded-none border', statusTone(request.priority))}>{request.priority || '-'}</Badge>
                            <Badge className={cn('rounded-none border', statusTone(request.status))}>{request.status || '-'}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <div>Tgl minta: {formatDate(request.request_date)} | Dibutuhkan: {formatDate(request.required_date)}</div>
                          <div>Qty minta: {formatNumber(request.quantity_requested)} | approve: {formatNumber(request.quantity_approved)} | distribusi: {formatNumber(request.quantity_fulfilled)}</div>
                          <div>Sisa approval: {formatNumber(request.quantity_remaining_approval)} | sisa distribusi: {formatNumber(request.quantity_remaining_distribution)}</div>
                          {request.requested_by ? <div>Peminta: {request.requested_by}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Belum ada permintaan stok untuk obat ini." />
                )}

                <SectionStrip title="Distribusi" icon={ArrowRightLeft} count={data?.distributions.length} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-14 w-full rounded-none" />
                    <Skeleton className="h-14 w-full rounded-none" />
                  </div>
                ) : data?.distributions.length ? (
                  <div className="divide-y divide-border/60">
                    {data.distributions.map((distribution) => (
                      <div key={distribution.distribution_id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{distribution.distribution_number}</div>
                            <div className="text-xs text-muted-foreground">{distribution.from_room} {'->'} {distribution.to_room}</div>
                          </div>
                          <Badge className={cn('rounded-none border', statusTone(distribution.status))}>{distribution.status || '-'}</Badge>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <div>Tgl distribusi: {formatDate(distribution.distribution_date)}</div>
                          <div>Qty kirim: {formatNumber(distribution.quantity_sent)} {distribution.unit}</div>
                          {distribution.request_number ? <div>Asal request: {distribution.request_number}</div> : null}
                          {distribution.received_by ? <div>Diterima oleh: {distribution.received_by} ({formatDate(distribution.received_date)})</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Belum ada distribusi tercatat untuk obat ini." />
                )}
              </div>
            </ScrollArea>

            <ScrollArea className="min-h-0">
              <div>
                <SectionStrip title="Pemakaian Pasien" icon={Activity} count={data?.patient_usages.length} />
                {loading && !data ? (
                  <div className="space-y-2 px-4 py-4">
                    <Skeleton className="h-16 w-full rounded-none" />
                    <Skeleton className="h-16 w-full rounded-none" />
                  </div>
                ) : data?.patient_usages.length ? (
                  <div className="divide-y divide-border/60">
                    {data.patient_usages.map((usage) => (
                      <div key={usage.order_item_id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{usage.patient_name}</div>
                            <div className="text-xs text-muted-foreground">No. RM {usage.patient_no_rm} | Reg {usage.registration_number}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn('rounded-none border', statusTone(usage.order_status))}>{usage.order_status || '-'}</Badge>
                            <Badge className={cn('rounded-none border', statusTone(usage.item_status))}>{usage.item_status || '-'}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <div>Order: {usage.order_number} | Tgl: {formatDate(usage.ordered_at)}</div>
                          <div>Ruang asal: {usage.source_room} | Farmasi: {usage.pharmacy_room}</div>
                          <div>Qty: {formatNumber(usage.quantity_dispensed)} / {formatNumber(usage.quantity_ordered)} {usage.unit} | retur: {formatNumber(usage.quantity_returned)}</div>
                          <div>Aturan: {usage.dosage || '-'} {usage.frequency ? `| ${usage.frequency}` : ''} {usage.route ? `| ${usage.route}` : ''}</div>
                          {usage.prescriber_name ? <div>Dokter: {usage.prescriber_name}</div> : null}
                        </div>

                        <div className="mt-3 border border-border/60">
                          <div className="grid grid-cols-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <span>Jadwal</span>
                            <span>Diberikan</span>
                            <span>Catatan</span>
                          </div>
                          <div className="grid grid-cols-3 px-3 py-2 text-xs text-foreground">
                            <span>{formatNumber(usage.administration_summary.scheduled_count)}</span>
                            <span>{formatNumber(usage.administration_summary.given_count)}</span>
                            <span>Hold {formatNumber(usage.administration_summary.held_count)} | Skip {formatNumber(usage.administration_summary.skipped_count)}</span>
                          </div>
                          {usage.administration_summary.recent_administrations.length ? (
                            <>
                              <Separator />
                              <div className="px-3 py-2">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Aktivitas Terbaru</div>
                                <div className="space-y-2">
                                  {usage.administration_summary.recent_administrations.map((administration, index) => (
                                    <div key={`${usage.order_item_id}-${administration.scheduled_at}-${index}`} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 text-xs last:border-b-0 last:pb-0">
                                      <div>
                                        <div className="font-medium text-foreground">{formatDate(administration.scheduled_at)}</div>
                                        <div className="text-muted-foreground">{administration.reason_detail || administration.notes || '-'}</div>
                                      </div>
                                      <Badge className={cn('rounded-none border', statusTone(administration.status))}>{administration.status}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Belum ada order pasien untuk obat ini." />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}