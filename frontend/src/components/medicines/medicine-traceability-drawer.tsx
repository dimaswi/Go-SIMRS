import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  type MedicineTraceabilityDistribution,
  type MedicineTraceabilityPatientUsage,
  type MedicineTraceabilityPurchase,
  type MedicineTraceabilityRequest,
} from '@/lib/api/medicines';
import { cn } from '@/lib/utils';
import {
  Activity,
  ArrowRightLeft,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Filter,
  PackageSearch,
  Pill,
  RotateCcw,
} from 'lucide-react';

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

function formatShortDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

function cleanRoomName(room?: string) {
  if (!room) return '-';
  // Strip any ID/code pattern in parentheses or brackets, e.g. "DEPO FARMASI (ROM20260624001)" -> "DEPO FARMASI"
  return room.replace(/\s*[\(\[][^()\[\]]*[\)\]]\s*/g, ' ').replace(/\s+/g, ' ').trim() || '-';
}

function statusTone(status?: string) {
  const value = (status || '').toLowerCase();

  if (['approved', 'completed', 'received', 'ready', 'delivered', 'given', 'paid', 'active'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (['partial', 'pending', 'reviewed', 'preparing', 'scheduled', 'urgent'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (['cancelled', 'rejected', 'held', 'skipped', 'refused', 'not_available', 'unpaid', 'emergency'].includes(value)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchesDateRange(dateStr: string | undefined | null, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  if (!dateStr) return false;
  const itemDate = new Date(dateStr);
  if (Number.isNaN(itemDate.getTime())) return false;

  if (start) {
    const startDate = new Date(`${start}T00:00:00`);
    if (itemDate < startDate) return false;
  }
  if (end) {
    const endDate = new Date(`${end}T23:59:59.999`);
    if (itemDate > endDate) return false;
  }
  return true;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
      <span>{label}</span>
    </div>
  );
}

function SectionStrip({
  title,
  icon: Icon,
  count,
  totalCount,
  badgeText,
}: {
  title: string;
  icon: typeof PackageSearch;
  count?: number;
  totalCount?: number;
  badgeText?: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span>{title}</span>
      </div>
      {badgeText ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold bg-background border-border/80 text-foreground">
          {badgeText}
        </Badge>
      ) : typeof count === 'number' ? (
        <Badge
          variant="outline"
          className={cn(
            "h-5 px-1.5 text-[10px] font-semibold border-border/80",
            count > 0 ? "bg-primary/10 text-primary border-primary/20" : "bg-background text-muted-foreground"
          )}
        >
          {formatNumber(count)}
          {typeof totalCount === 'number' && totalCount !== count ? ` / ${formatNumber(totalCount)}` : ''}
        </Badge>
      ) : null}
    </div>
  );
}

function SubSectionHeader({ title, icon: Icon, count }: { title: string; icon: typeof PackageSearch; count?: number }) {
  return (
    <div className="flex items-center justify-between border-y border-border/60 bg-muted/50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span>{title}</span>
      </div>
      {typeof count === 'number' ? (
        <span className="text-[10px] font-semibold text-foreground">{formatNumber(count)}</span>
      ) : null}
    </div>
  );
}

function KeyValueRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 border-b border-border/40 px-3.5 py-1.5 text-xs last:border-b-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 break-words text-foreground', valueClassName)}>{value || '-'}</span>
    </div>
  );
}

// Collapsible card wrapper
function CollapsibleCard({
  idKey,
  isExpanded,
  onToggle,
  headerContent,
  children,
}: {
  idKey: string;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  headerContent: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 bg-background transition-colors hover:bg-muted/15 last:border-b-0">
      <div
        className="cursor-pointer p-3 select-none hover:bg-muted/20 transition-colors"
        onClick={() => onToggle(idKey)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">{headerContent}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(idKey);
            }}
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {isExpanded ? (
        <div className="border-t border-border/50 bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
          {children}
        </div>
      ) : null}
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

  // Filter per tanggal
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7days' | '30days' | 'thisMonth'>('all');

  // Collapsible management
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [defaultExpanded, setDefaultExpanded] = useState<boolean>(true);

  const toggleItem = (key: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !defaultExpanded,
    }));
  };

  const isExpanded = (key: string) => {
    if (expandedMap[key] !== undefined) {
      return expandedMap[key];
    }
    return defaultExpanded;
  };

  const toggleAllExpanded = () => {
    const nextState = !defaultExpanded;
    setDefaultExpanded(nextState);
    setExpandedMap({});
  };

  const handlePreset = (preset: 'all' | 'today' | '7days' | '30days' | 'thisMonth') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    if (preset === 'today') {
      const todayStr = toDateInputValue(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }
    if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(toDateInputValue(past));
      setEndDate(toDateInputValue(now));
      return;
    }
    if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(toDateInputValue(past));
      setEndDate(toDateInputValue(now));
      return;
    }
    if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateInputValue(firstDay));
      setEndDate(toDateInputValue(now));
      return;
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setActivePreset('all');
  };

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
      setStartDate('');
      setEndDate('');
      setActivePreset('all');
      setExpandedMap({});
      setDefaultExpanded(true);
    }
  }, [open]);

  const medicine = data?.medicine || initialMedicine || null;

  // Filtered collections
  const filteredPurchases = useMemo(() => {
    if (!data?.purchases) return [];
    return data.purchases.filter((p: MedicineTraceabilityPurchase) =>
      matchesDateRange(p.received_date || p.order_date, startDate, endDate)
    );
  }, [data?.purchases, startDate, endDate]);

  const filteredRequests = useMemo(() => {
    if (!data?.requests) return [];
    return data.requests.filter((r: MedicineTraceabilityRequest) =>
      matchesDateRange(r.request_date, startDate, endDate)
    );
  }, [data?.requests, startDate, endDate]);

  const filteredDistributions = useMemo(() => {
    if (!data?.distributions) return [];
    return data.distributions.filter((d: MedicineTraceabilityDistribution) =>
      matchesDateRange(d.distribution_date, startDate, endDate)
    );
  }, [data?.distributions, startDate, endDate]);

  const filteredPatientUsages = useMemo(() => {
    if (!data?.patient_usages) return [];
    return data.patient_usages.filter((u: MedicineTraceabilityPatientUsage) =>
      matchesDateRange(u.ordered_at || u.delivered_at, startDate, endDate)
    );
  }, [data?.patient_usages, startDate, endDate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-[100vw] border-l border-border/70 p-0 sm:w-[96vw] sm:max-w-[96vw] xl:w-[98vw] xl:max-w-[98vw]"
      >
        <div className="flex h-full flex-col bg-background">
          {/* Header */}
          <SheetHeader className="border-b border-border/70 px-5 py-3 pr-14">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-lg font-bold tracking-tight">
                    {medicine?.name || 'Traceability Obat'}
                  </SheetTitle>
                  <span className="text-xs text-muted-foreground font-medium">(Kartu Stok Digital)</span>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Alur lengkap obat mulai dari pembelian, permintaan stok, perpindahan distribusi, hingga pemakaian langsung ke pasien.
                </SheetDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {medicineId && onOpenDetail ? (
                  <Button variant="outline" size="sm" className="h-8 rounded-none text-xs" onClick={() => onOpenDetail(medicineId)}>
                    Buka Detail Obat
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              {medicine?.code ? <Badge variant="outline" className="rounded-none font-mono text-[11px]">{medicine.code}</Badge> : null}
              {medicine?.category ? <Badge className="rounded-none border-border bg-background text-foreground text-[11px]">{medicineCategoryLabels[medicine.category]}</Badge> : null}
              {medicine?.type ? <Badge className="rounded-none border-border bg-background text-foreground text-[11px]">{medicineTypeLabels[medicine.type]}</Badge> : null}
              {medicine?.form ? <Badge className="rounded-none border-border bg-background text-foreground text-[11px]">{medicineFormLabels[medicine.form]}</Badge> : null}
              {medicine?.strength ? <Badge className="rounded-none border-border bg-background text-foreground text-[11px]">{medicine.strength}</Badge> : null}
            </div>
          </SheetHeader>

          {/* Filter Bar (Rapi & Sejajar) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-5 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Label & Date Inputs */}
              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Filter Tanggal:</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                    className="h-8 w-[136px] text-xs bg-background rounded-md px-2 border-border/80 shadow-2xs [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                  <span className="text-xs text-muted-foreground font-medium">s/d</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                    className="h-8 w-[136px] text-xs bg-background rounded-md px-2 border-border/80 shadow-2xs [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
              </div>

              {/* Segmented Preset Controls */}
              <div className="inline-flex items-center rounded-md border border-border/80 bg-muted/50 p-0.5 text-xs shadow-2xs">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: '7days', label: '7 Hari' },
                  { id: '30days', label: '30 Hari' },
                  { id: 'thisMonth', label: 'Bulan Ini' },
                ].map((preset) => {
                  const isSelected =
                    preset.id === 'all'
                      ? !startDate && !endDate && activePreset === 'all'
                      : activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePreset(preset.id as any)}
                      className={cn(
                        "h-6 px-2.5 text-xs rounded transition-all cursor-pointer select-none",
                        isSelected
                          ? "bg-background text-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground font-normal"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Reset Filter"
                  onClick={() => handlePreset('all')}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </Button>
              )}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-md bg-background border-border/80 shadow-2xs hover:bg-muted/50"
                onClick={toggleAllExpanded}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{defaultExpanded ? 'Ciutkan Semua Log' : 'Buka Semua Log'}</span>
              </Button>
            </div>
          </div>

          {error ? (
            <div className="border-b border-border/70 bg-destructive/5 px-5 py-2 text-xs text-destructive">{error}</div>
          ) : null}

          {/* 5 Kolom: Detail, Pembelian, Permintaan, Distribusi, Pemakaian */}
          <div className="flex-1 min-h-0 overflow-x-auto">
            <div className="grid h-full min-h-0 min-w-[1380px] xl:min-w-full grid-cols-5 divide-x divide-border/70">
              
              {/* Kolom 1: DETAIL (Ringkasan Obat & Sebaran Stok Ruang) */}
              <div className="flex h-full min-h-0 flex-col bg-muted/10">
                <ScrollArea className="h-full min-h-0">
                  <div className="divide-y divide-border/60">
                    <div>
                      <SectionStrip
                        title="Detail Obat"
                        icon={Pill}
                        badgeText={medicine ? `${formatNumber(data?.stats.total_stock ?? medicine.current_stock)} ${medicine.unit}` : undefined}
                      />
                      {loading && !data ? (
                        <div className="space-y-2 p-3.5">
                          <Skeleton className="h-4 w-3/4 rounded-none" />
                          <Skeleton className="h-4 w-full rounded-none" />
                          <Skeleton className="h-4 w-2/3 rounded-none" />
                        </div>
                      ) : medicine ? (
                        <div className="py-1">
                          <KeyValueRow label="Nama" value={medicine.name} valueClassName="font-medium" />
                          <KeyValueRow label="Generik" value={medicine.generic_name || '-'} />
                          <KeyValueRow label="Satuan" value={medicine.unit} />
                          <KeyValueRow
                            label="Stok Total"
                            value={`${formatNumber(data?.stats.total_stock ?? medicine.current_stock)} ${medicine.unit}`}
                            valueClassName="font-bold text-primary"
                          />
                          <KeyValueRow
                            label="Min - Max"
                            value={`${formatNumber(medicine.min_stock)} - ${formatNumber(medicine.max_stock)} ${medicine.unit}`}
                          />
                          <KeyValueRow label="Harga Beli" value={formatCurrency(medicine.purchase_price)} />
                          <KeyValueRow label="Harga Jual" value={formatCurrency(medicine.selling_price)} />
                        </div>
                      ) : (
                        <EmptyState label="Data obat belum tersedia." />
                      )}
                    </div>

                    <div>
                      <SubSectionHeader
                        title="Sebaran Stok Ruang"
                        icon={Building2}
                        count={data?.room_stocks.length}
                      />
                      {loading && !data ? (
                        <div className="space-y-2 p-3.5">
                          <Skeleton className="h-10 w-full rounded-none" />
                          <Skeleton className="h-10 w-full rounded-none" />
                        </div>
                      ) : data?.room_stocks.length ? (
                        <div className="divide-y divide-border/50">
                          {data.room_stocks.map((stock) => (
                            <div key={stock.room_id} className="px-3.5 py-2 text-xs">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground truncate">{cleanRoomName(stock.room_name)}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-bold text-foreground">
                                    {formatNumber(stock.quantity)} <span className="font-normal text-[10px] text-muted-foreground">{medicine?.unit}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">min {formatNumber(stock.min_quantity)}</div>
                                </div>
                              </div>
                              {stock.notes && !stock.notes.toLowerCase().includes('import') && !stock.notes.toLowerCase().includes('.csv') ? (
                                <div className="mt-1 text-[11px] text-muted-foreground italic">{stock.notes}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState label="Belum ada sebaran stok di ruang." />
                      )}
                    </div>

                    <div>
                      <SubSectionHeader title="Ringkasan Log" icon={PackageSearch} />
                      {loading && !data ? (
                        <div className="space-y-2 p-3.5">
                          <Skeleton className="h-8 w-full rounded-none" />
                          <Skeleton className="h-8 w-full rounded-none" />
                        </div>
                      ) : data ? (
                        <div className="py-1">
                          <KeyValueRow
                            label="Pembelian"
                            value={`${formatNumber(filteredPurchases.length)} transaksi`}
                          />
                          <KeyValueRow
                            label="Permintaan"
                            value={`${formatNumber(filteredRequests.length)} permohonan`}
                          />
                          <KeyValueRow
                            label="Distribusi"
                            value={`${formatNumber(filteredDistributions.length)} pengiriman`}
                          />
                          <KeyValueRow
                            label="Pemakaian"
                            value={`${formatNumber(filteredPatientUsages.length)} order pasien`}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Kolom 2: PEMBELIAN */}
              <div className="flex h-full min-h-0 flex-col">
                <ScrollArea className="h-full min-h-0">
                  <SectionStrip
                    title="Pembelian"
                    icon={PackageSearch}
                    count={filteredPurchases.length}
                    totalCount={data?.purchases.length}
                  />
                  {loading && !data ? (
                    <div className="space-y-2 p-3.5">
                      <Skeleton className="h-16 w-full rounded-none" />
                      <Skeleton className="h-16 w-full rounded-none" />
                    </div>
                  ) : filteredPurchases.length ? (
                    <div className="divide-y divide-border/60">
                      {filteredPurchases.map((purchase) => {
                        const key = `purchase-${purchase.purchase_id}-${purchase.batch_number || 'nobatch'}`;
                        const open = isExpanded(key);

                        return (
                          <CollapsibleCard
                            key={key}
                            idKey={key}
                            isExpanded={open}
                            onToggle={toggleItem}
                            headerContent={
                              <div className="space-y-1.5">
                                {/* Top: ID dikecilkan & Status */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-[10px] text-muted-foreground">{purchase.purchase_number}</span>
                                  <Badge className={cn('rounded-none border text-[10px] px-1.5 py-0', statusTone(purchase.status))}>
                                    {purchase.status || '-'}
                                  </Badge>
                                </div>

                                {/* Nama diperbesar dan di-bold */}
                                <div className="text-sm font-bold text-foreground leading-snug">
                                  {purchase.supplier_name || 'Tanpa Nama Supplier'}
                                </div>

                                {/* Tanggal & Jumlah */}
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatShortDate(purchase.received_date || purchase.order_date)}</span>
                                  </div>
                                  <Badge variant="secondary" className="rounded-none font-semibold text-xs">
                                    {formatNumber(purchase.quantity_received)} / {formatNumber(purchase.quantity_ordered)} {purchase.unit}
                                  </Badge>
                                </div>

                                {/* BN & ED jika ada */}
                                {(purchase.batch_number || purchase.expiry_date) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    {purchase.batch_number ? (
                                      <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-mono px-1.5 py-0">
                                        BN: {purchase.batch_number}
                                      </Badge>
                                    ) : null}
                                    {purchase.expiry_date ? (
                                      <Badge variant="outline" className="rounded-none border-rose-300 bg-rose-50 text-rose-800 text-[10px] px-1.5 py-0">
                                        ED: {formatShortDate(purchase.expiry_date)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            }
                          >
                            <div className="space-y-1">
                              <div>Masuk ke: <span className="text-foreground font-medium">{cleanRoomName(purchase.destination_room)}</span></div>
                              <div>Tgl Order: {formatDate(purchase.order_date)}</div>
                              <div>Tgl Terima: {formatDate(purchase.received_date)}</div>
                              <div>Harga Satuan: {formatCurrency(purchase.unit_price)}</div>
                              <div>Total Nilai: <span className="font-semibold text-foreground">{formatCurrency(purchase.total_price)}</span></div>
                              <div>Sisa Belum Diterima: {formatNumber(purchase.remaining_quantity)} {purchase.unit}</div>
                              {purchase.invoice_number ? <div>No Invoice: <span className="font-mono">{purchase.invoice_number}</span></div> : null}
                              {purchase.payment_status ? <div>Status Bayar: <span className="capitalize">{purchase.payment_status}</span></div> : null}
                              {purchase.recorded_by ? <div>Pencatat: {purchase.recorded_by}</div> : null}
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState label={startDate || endDate ? 'Tidak ada pembelian pada periode tanggal ini.' : 'Belum ada data pembelian.'} />
                  )}
                </ScrollArea>
              </div>

              {/* Kolom 3: PERMINTAAN */}
              <div className="flex h-full min-h-0 flex-col">
                <ScrollArea className="h-full min-h-0">
                  <SectionStrip
                    title="Permintaan"
                    icon={ClipboardList}
                    count={filteredRequests.length}
                    totalCount={data?.requests.length}
                  />
                  {loading && !data ? (
                    <div className="space-y-2 p-3.5">
                      <Skeleton className="h-16 w-full rounded-none" />
                      <Skeleton className="h-16 w-full rounded-none" />
                    </div>
                  ) : filteredRequests.length ? (
                    <div className="divide-y divide-border/60">
                      {filteredRequests.map((request) => {
                        const key = `request-${request.request_id}`;
                        const open = isExpanded(key);

                        return (
                          <CollapsibleCard
                            key={key}
                            idKey={key}
                            isExpanded={open}
                            onToggle={toggleItem}
                            headerContent={
                              <div className="space-y-1.5">
                                {/* Top: ID dikecilkan & Priority/Status */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-[10px] text-muted-foreground">{request.request_number}</span>
                                  <div className="flex items-center gap-1">
                                    {request.priority ? (
                                      <Badge className={cn('rounded-none border text-[10px] px-1 py-0', statusTone(request.priority))}>
                                        {request.priority}
                                      </Badge>
                                    ) : null}
                                    <Badge className={cn('rounded-none border text-[10px] px-1 py-0', statusTone(request.status))}>
                                      {request.status || '-'}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Nama diperbesar dan di-bold (Ruangan Peminta -> Tujuan) */}
                                <div className="text-sm font-bold text-foreground leading-snug">
                                  {cleanRoomName(request.from_room)} <span className="font-normal text-muted-foreground text-xs">➔</span> {cleanRoomName(request.to_room)}
                                </div>

                                {/* Tanggal & Jumlah */}
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatShortDate(request.request_date)}</span>
                                  </div>
                                  <Badge variant="secondary" className="rounded-none font-semibold text-xs">
                                    Minta: {formatNumber(request.quantity_requested)}
                                  </Badge>
                                </div>
                              </div>
                            }
                          >
                            <div className="space-y-1">
                              <div>Dibutuhkan: {formatDate(request.required_date)}</div>
                              <div>Qty Disetujui: <span className="font-semibold text-foreground">{formatNumber(request.quantity_approved)}</span></div>
                              <div>Qty Didistribusi: <span className="font-semibold text-foreground">{formatNumber(request.quantity_fulfilled)}</span></div>
                              <div>Sisa Approval: {formatNumber(request.quantity_remaining_approval)}</div>
                              <div>Sisa Distribusi: {formatNumber(request.quantity_remaining_distribution)}</div>
                              {request.requested_by ? <div>Peminta: {request.requested_by}</div> : null}
                              {request.notes ? <div className="italic">Catatan: {request.notes}</div> : null}
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState label={startDate || endDate ? 'Tidak ada permintaan pada periode tanggal ini.' : 'Belum ada data permintaan stok.'} />
                  )}
                </ScrollArea>
              </div>

              {/* Kolom 4: DISTRIBUSI */}
              <div className="flex h-full min-h-0 flex-col">
                <ScrollArea className="h-full min-h-0">
                  <SectionStrip
                    title="Distribusi"
                    icon={ArrowRightLeft}
                    count={filteredDistributions.length}
                    totalCount={data?.distributions.length}
                  />
                  {loading && !data ? (
                    <div className="space-y-2 p-3.5">
                      <Skeleton className="h-16 w-full rounded-none" />
                      <Skeleton className="h-16 w-full rounded-none" />
                    </div>
                  ) : filteredDistributions.length ? (
                    <div className="divide-y divide-border/60">
                      {filteredDistributions.map((dist) => {
                        const key = `dist-${dist.distribution_id}`;
                        const open = isExpanded(key);

                        return (
                          <CollapsibleCard
                            key={key}
                            idKey={key}
                            isExpanded={open}
                            onToggle={toggleItem}
                            headerContent={
                              <div className="space-y-1.5">
                                {/* Top: ID dikecilkan & Status */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-[10px] text-muted-foreground">{dist.distribution_number}</span>
                                  <Badge className={cn('rounded-none border text-[10px] px-1.5 py-0', statusTone(dist.status))}>
                                    {dist.status || '-'}
                                  </Badge>
                                </div>

                                {/* Nama diperbesar dan di-bold (Ruang Asal -> Ruang Tujuan Distribusi) */}
                                <div className="text-sm font-bold text-foreground leading-snug">
                                  {cleanRoomName(dist.from_room)} <span className="font-normal text-muted-foreground text-xs">➔</span> {cleanRoomName(dist.to_room)}
                                </div>

                                {/* Tanggal & Jumlah */}
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatShortDate(dist.distribution_date)}</span>
                                  </div>
                                  <Badge variant="secondary" className="rounded-none font-semibold text-xs">
                                    Kirim: {formatNumber(dist.quantity_sent)} {dist.unit}
                                  </Badge>
                                </div>

                                {/* BN & ED jika ada */}
                                {(dist.batch_number || dist.expiry_date) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    {dist.batch_number ? (
                                      <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-mono px-1.5 py-0">
                                        BN: {dist.batch_number}
                                      </Badge>
                                    ) : null}
                                    {dist.expiry_date ? (
                                      <Badge variant="outline" className="rounded-none border-rose-300 bg-rose-50 text-rose-800 text-[10px] px-1.5 py-0">
                                        ED: {formatShortDate(dist.expiry_date)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            }
                          >
                            <div className="space-y-1">
                              <div>Tgl Distribusi: {formatDate(dist.distribution_date)}</div>
                              {dist.request_number ? <div>No Permintaan: <span className="font-mono">{dist.request_number}</span></div> : null}
                              {dist.distributed_by ? <div>Petugas Distribusi: {dist.distributed_by}</div> : null}
                              {dist.received_by ? (
                                <div>Diterima oleh: <span className="font-medium text-foreground">{dist.received_by}</span> ({formatDate(dist.received_date)})</div>
                              ) : null}
                              {dist.notes ? <div className="italic">Catatan: {dist.notes}</div> : null}
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState label={startDate || endDate ? 'Tidak ada distribusi pada periode tanggal ini.' : 'Belum ada data distribusi.'} />
                  )}
                </ScrollArea>
              </div>

              {/* Kolom 5: PEMAKAIAN (Pasien, RM, Ruangan) */}
              <div className="flex h-full min-h-0 flex-col">
                <ScrollArea className="h-full min-h-0">
                  <SectionStrip
                    title="Pemakaian"
                    icon={Activity}
                    count={filteredPatientUsages.length}
                    totalCount={data?.patient_usages.length}
                  />
                  {loading && !data ? (
                    <div className="space-y-2 p-3.5">
                      <Skeleton className="h-16 w-full rounded-none" />
                      <Skeleton className="h-16 w-full rounded-none" />
                    </div>
                  ) : filteredPatientUsages.length ? (
                    <div className="divide-y divide-border/60">
                      {filteredPatientUsages.map((usage) => {
                        const key = `usage-${usage.order_item_id}`;
                        const open = isExpanded(key);

                        return (
                          <CollapsibleCard
                            key={key}
                            idKey={key}
                            isExpanded={open}
                            onToggle={toggleItem}
                            headerContent={
                              <div className="space-y-1.5">
                                {/* Top: ID dikecilkan & Status */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-[10px] text-muted-foreground">{usage.order_number}</span>
                                  <div className="flex items-center gap-1">
                                    <Badge className={cn('rounded-none border text-[10px] px-1 py-0', statusTone(usage.order_status))}>
                                      {usage.order_status || '-'}
                                    </Badge>
                                    <Badge className={cn('rounded-none border text-[10px] px-1 py-0', statusTone(usage.item_status))}>
                                      {usage.item_status || '-'}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Pasien: Nama diperbesar dan di-bold */}
                                <div className="text-sm font-bold text-foreground leading-snug">
                                  {usage.patient_name || 'Pasien Umum'}
                                </div>

                                {/* Pasien, RM, Ruangan */}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1 py-0 bg-muted/40">
                                    RM: {usage.patient_no_rm || '-'}
                                  </Badge>
                                  <span className="font-medium text-foreground truncate text-[11px]">
                                    Ruang: {cleanRoomName(usage.source_room) !== '-' ? cleanRoomName(usage.source_room) : cleanRoomName(usage.pharmacy_room)}
                                  </span>
                                </div>

                                {/* Tanggal & Jumlah */}
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatShortDate(usage.ordered_at)}</span>
                                  </div>
                                  <Badge variant="secondary" className="rounded-none font-semibold text-xs">
                                    Pakai: {formatNumber(usage.quantity_dispensed || usage.quantity_ordered)} {usage.unit}
                                    {usage.quantity_returned > 0 ? ` (Retur: ${usage.quantity_returned})` : ''}
                                  </Badge>
                                </div>

                                {/* BN & ED jika ada */}
                                {(usage.batch_number || usage.expiry_date) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    {usage.batch_number ? (
                                      <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-mono px-1.5 py-0">
                                        BN: {usage.batch_number}
                                      </Badge>
                                    ) : null}
                                    {usage.expiry_date ? (
                                      <Badge variant="outline" className="rounded-none border-rose-300 bg-rose-50 text-rose-800 text-[10px] px-1.5 py-0">
                                        ED: {formatShortDate(usage.expiry_date)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            }
                          >
                            <div className="space-y-1.5">
                              <div>No Registrasi: <span className="font-mono text-foreground">{usage.registration_number}</span></div>
                              <div>Depo Farmasi: {cleanRoomName(usage.pharmacy_room)}</div>
                              {usage.prescriber_name ? <div>Dokter: <span className="font-medium text-foreground">{usage.prescriber_name}</span></div> : null}
                              {usage.dosage ? (
                                <div>
                                  Aturan Pakai: <span className="font-medium text-foreground">{usage.dosage}</span>{' '}
                                  {usage.frequency ? `| ${usage.frequency}` : ''}{' '}
                                  {usage.route ? `| ${usage.route}` : ''}
                                </div>
                              ) : null}
                              {usage.instructions ? <div className="italic">Instruksi: {usage.instructions}</div> : null}

                              {/* Ringkasan Administrasi (hanya jika ada data jadwal/pemberian) */}
                              {usage.administration_summary &&
                              (usage.administration_summary.scheduled_count > 0 ||
                                usage.administration_summary.given_count > 0 ||
                                (usage.administration_summary.recent_administrations && usage.administration_summary.recent_administrations.length > 0)) ? (
                                <div className="mt-2 border border-border/60 bg-background">
                                  <div className="grid grid-cols-3 border-b border-border/50 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <span>Jadwal</span>
                                    <span>Diberikan</span>
                                    <span>Hold/Skip</span>
                                  </div>
                                  <div className="grid grid-cols-3 px-2 py-1 text-xs text-foreground">
                                    <span>{formatNumber(usage.administration_summary.scheduled_count)}</span>
                                    <span>{formatNumber(usage.administration_summary.given_count)}</span>
                                    <span>{formatNumber(usage.administration_summary.held_count)} / {formatNumber(usage.administration_summary.skipped_count)}</span>
                                  </div>

                                  {usage.administration_summary.recent_administrations.length ? (
                                    <>
                                      <Separator />
                                      <div className="p-2 space-y-1.5">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                          Riwayat Pemberian
                                        </div>
                                        {usage.administration_summary.recent_administrations.map((adm, i) => (
                                          <div
                                            key={`${usage.order_item_id}-${adm.scheduled_at}-${i}`}
                                            className="flex items-center justify-between gap-1 text-[11px] border-b border-border/40 pb-1 last:border-b-0 last:pb-0"
                                          >
                                            <div>
                                              <div className="font-medium text-foreground">{formatShortDate(adm.scheduled_at)}</div>
                                              <div className="text-muted-foreground text-[10px]">{adm.reason_detail || adm.notes || '-'}</div>
                                            </div>
                                            <Badge className={cn('rounded-none border text-[9px] px-1 py-0', statusTone(adm.status))}>
                                              {adm.status}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState label={startDate || endDate ? 'Tidak ada pemakaian pada periode tanggal ini.' : 'Belum ada data pemakaian pasien.'} />
                  )}
                </ScrollArea>
              </div>

            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
