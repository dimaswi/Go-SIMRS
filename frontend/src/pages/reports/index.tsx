import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setPageTitle } from '@/lib/page-title';
import {
  reportVisitsApi, reportBpjsApi, reportBillingApi, reportInpatientApi,
  reportPharmacyApi, reportPenunjangApi, reportServicesApi, reportInventoryApi, reportHrApi, reportKemenkesApi
} from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  Loader2, Download, TrendingUp, Building2, DollarSign,
  HeartPulse, Pill, FlaskConical, Boxes, UserCheck, Landmark, Calendar,
  ArrowRight, ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PageShell,
  PageContent,
  PageHeader as ShellPageHeader,
  FilterBar,
  FilterPill,
} from '@/components/layout/page-shell';
import {
  reportCategories,
  reportQuickStats,
} from './report-catalog';
import {
  ReportPanel,
  REPORT_MONO_FAMILY,
} from './report-ui';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const formatCurrency = (v: number) => {
  if (v == null || isNaN(Number(v))) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v));
};
const formatNumber = (v: number) => {
  if (v == null || isNaN(Number(v))) return '-';
  return new Intl.NumberFormat('id-ID').format(Number(v));
};
const formatPercent = (v: number) => {
  if (v == null || isNaN(Number(v))) return '-';
  return `${Number(v).toFixed(1)}%`;
};
const formatDecimal = (v: number) => {
  if (v == null || isNaN(Number(v))) return '-';
  return Number(v).toFixed(2);
};

function renderReportBadge(value: string | number | null | undefined, key: string) {
  const text = value == null ? '-' : String(value);
  const normalized = text.toLowerCase();
  const titleized = text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (key === 'status') {
    if (normalized.includes('paid') || normalized.includes('completed')) return <Badge className="rounded-none bg-emerald-600 hover:bg-emerald-600">Selesai</Badge>;
    if (normalized.includes('ideal') || normalized.includes('active') || normalized.includes('aktif') || normalized.includes('success')) return <Badge className="rounded-none bg-emerald-600 hover:bg-emerald-600">Aktif</Badge>;
    if (normalized.includes('partial') || normalized.includes('pending')) return <Badge variant="secondary" className="rounded-none">Pending</Badge>;
    if (normalized.includes('warning') || normalized.includes('low') || normalized.includes('minimum')) return <Badge variant="secondary" className="rounded-none border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Perhatian</Badge>;
    if (normalized.includes('expired') || normalized.includes('critical') || normalized.includes('kritis')) return <Badge variant="destructive" className="rounded-none">Kritis</Badge>;
    if (normalized.includes('cancel')) return <Badge variant="destructive" className="rounded-none">Batal</Badge>;
    return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  }

  if (key === 'metode_bayar' || key === 'payment_method') {
    if (normalized.includes('bpjs')) return <Badge variant="secondary" className="rounded-none border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">BPJS</Badge>;
    if (normalized.includes('cash') || normalized.includes('umum')) return <Badge variant="secondary" className="rounded-none">Umum</Badge>;
    if (normalized.includes('asuransi')) return <Badge variant="secondary" className="rounded-none border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">Asuransi</Badge>;
  }

  if (key === 'jenis_kelamin' || key === 'jk') {
    if (normalized.includes('laki')) return <Badge variant="secondary" className="rounded-none border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">L</Badge>;
    if (normalized.includes('perempuan')) return <Badge variant="secondary" className="rounded-none border border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-50">P</Badge>;
  }

  if (key === 'service_type') {
    return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  }

  if (key === 'order_type') {
    if (normalized.includes('laboratory')) return <Badge variant="secondary" className="rounded-none border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Laboratory</Badge>;
    if (normalized.includes('radiology')) return <Badge variant="secondary" className="rounded-none border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Radiology</Badge>;
    if (normalized.includes('consultation')) return <Badge variant="secondary" className="rounded-none border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Consultation</Badge>;
    if (normalized.includes('surgery')) return <Badge variant="destructive" className="rounded-none">Surgery</Badge>;
    return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  }

  if (key === 'nama_ruangan' || key === 'nama_depo' || key === 'nama_poli') {
    return <Badge variant="outline" className="rounded-none border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-50">{titleized}</Badge>;
  }

  if (key === 'kategori' || key === 'tipe' || key === 'tipe_karyawan' || key === 'jenis_surat') {
    return <Badge variant="secondary" className="rounded-none border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">{titleized}</Badge>;
  }

  if (key === 'kondisi' || key === 'status_kepegawaian' || key === 'status_str') {
    return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  }

  if (key === 'kelas') {
    return <Badge variant="outline" className="rounded-none border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-50">{titleized}</Badge>;
  }

  return null;
}

// ============================================================
// Reusable Inline Nav
// ============================================================
function InlineNav({ items, value, onChange }: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border border-border/70 bg-background px-3 py-3">
      <FilterBar className="gap-2">
        {items.map(item => (
          <FilterPill
            key={item.value}
            onClick={() => onChange(item.value)}
            active={value === item.value}
            className="min-h-[38px] px-3 py-2 text-[10px] leading-none"
          >
            {item.label}
          </FilterPill>
        ))}
      </FilterBar>
    </div>
  );
}

// ============================================================
// Reusable Filter Bar (compact, for header row)
// ============================================================
function DateFilter({ startDate, endDate, onStartChange, onEndChange, onApply, onExport, loading }: {
  startDate: string; endDate: string;
  onStartChange: (v: string) => void; onEndChange: (v: string) => void;
  onApply: () => void; onExport?: () => void; loading?: boolean;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
      <div className="flex items-center gap-1.5 border border-border/70 bg-background px-2 py-2">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <Input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className="h-9 w-[145px] rounded-none border-border/70 px-2 text-xs" />
      <span className="shrink-0 text-[11px] text-muted-foreground"> - </span>
      <Input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} className="h-9 w-[145px] rounded-none border-border/70 px-2 text-xs" />
      <Button onClick={onApply} disabled={loading} size="sm" className="h-9 shrink-0 rounded-none px-3 text-xs">
        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        OK
      </Button>
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="h-9 shrink-0 rounded-none border-border/70 px-3 text-xs">
          <Download className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Page Header (title left, filter right)
// ============================================================
function PageHeader({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <ShellPageHeader
      title={title}
      actions={children ?? null}
      className="border-border/70 bg-background/95"
      badges={icon}
    />
  );
}

// Default date helpers
function getDefaultStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function getDefaultEnd() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// Shared data table component
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any) => string; align?: string; width?: string; wrap?: boolean }[]; data: any[] }) {
  if (!data || data.length === 0) return <p className="text-muted-foreground text-center py-8">Tidak ada data untuk periode ini.</p>;
  return (
    <div className="overflow-hidden border border-border/70 bg-background">
      <div
        className="hidden border-b border-border/70 bg-muted/20 px-4 py-3 md:grid"
        style={{ gridTemplateColumns: columns.map((col) => col.width || 'minmax(0,1fr)').join(' ') }}
      >
        {columns.map(col => (
          <div
            key={col.key}
            className={cn('px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground', col.align === 'right' && 'text-right')}
            style={{ fontFamily: REPORT_MONO_FAMILY }}
          >
            {col.label}
          </div>
        ))}
      </div>
      <div className="divide-y divide-dashed divide-border/70">
        {data.map((row, i) => (
          <div
            key={i}
            className="grid gap-3 px-4 py-3 md:items-center"
            style={{ gridTemplateColumns: columns.map((col) => col.width || 'minmax(0,1fr)').join(' ') }}
          >
            {columns.map(col => (
              <div key={col.key} className={cn('min-w-0 px-2', col.align === 'right' && 'md:text-right')}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:hidden" style={{ fontFamily: REPORT_MONO_FAMILY }}>
                  {col.label}
                </div>
                <div className={cn('text-sm', col.wrap ? 'whitespace-normal break-words' : 'truncate')}>
                  {renderReportBadge(row[col.key], col.key) ?? (col.format ? col.format(row[col.key]) : (row[col.key] != null ? String(row[col.key]) : '-'))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// KPI Card for indicators
// ============================================================
function KPICard({ label, value, subtitle, status }: { label: string; value: string; subtitle?: string; status?: 'good' | 'warning' | 'bad' }) {
  return (
    <div className="bg-background px-4 py-4">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.24em]" style={{ fontFamily: REPORT_MONO_FAMILY }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {subtitle && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">{subtitle}</span>
          {status && (
            <Badge variant={status === 'good' ? 'default' : 'destructive'} className="rounded-none text-[10px]">
              {status === 'good' ? 'Ideal' : status === 'warning' ? 'Perhatian' : 'Di Luar Standar'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function ReportFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ReportExplorerLayout({
  reportItems,
  activeTab,
  onTabChange,
  previewChildren,
  showPreview = false,
}: {
  sidebarTitle: string;
  reportItems: { value: string; label: string; note: string }[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onApply: () => void;
  onExport: () => void;
  filters: ReactNode;
  previewTitle: string;
  previewChildren: ReactNode;
  showPreview?: boolean;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-4">
          {opened ? (
            <div className="space-y-4 pb-12">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none border-border/70 text-xs bg-background hover:bg-muted"
                  onClick={() => setOpened(false)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali
                </Button>
              </div>
              {previewChildren}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {reportItems.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onTabChange(item.value);
                    setOpened(true);
                  }}
                  className={cn(
                    'flex min-h-[108px] items-start justify-between border px-4 py-4 text-left transition-colors',
                    activeTab === item.value ? 'border-foreground bg-muted/10' : 'border-border/70 bg-background hover:bg-muted/10',
                  )}
                >
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 items-center justify-center border border-border/70 bg-muted/20 text-[10px] font-semibold">
                      R
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold leading-6">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.note}</p>
                      <p className="text-sm text-muted-foreground">keterangan:</p>
                    </div>
                  </div>
                  <Download className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className="pt-2 pb-12">
          {previewChildren}
        </div>
      ) : null}
    </>
  );
}

function aggregateByKey<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
  metricKeys: string[],
  labelKey = 'label',
) {
  const map = new Map<string, Record<string, any>>();
  rows.forEach((row) => {
    const label = String(row[key] ?? '-');
    if (!map.has(label)) {
      const initial: Record<string, any> = { [labelKey]: label };
      metricKeys.forEach((metric) => {
        initial[metric] = 0;
      });
      map.set(label, initial);
    }
    const target = map.get(label)!;
    metricKeys.forEach((metric) => {
      target[metric] += Number(row[metric] ?? 0);
    });
  });
  return Array.from(map.values());
}

// ============================================================
// Report Index Page (Dashboard with category cards)
// ============================================================

function ReportIndexHero() {
  return (
    <div className="grid gap-px border border-border/70 bg-border/70 md:grid-cols-3">
      {reportQuickStats.map((item) => (
        <div key={item.label} className="bg-background px-4 py-4">
          <div
            className="text-[10px] uppercase leading-[1.6] tracking-[0.24em] text-muted-foreground"
            style={{ fontFamily: REPORT_MONO_FAMILY }}
          >
            {item.label}
          </div>
          <div className="mt-2 text-xl font-semibold text-foreground">{item.value}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

export default function ReportIndexPage() {
  useEffect(() => { setPageTitle('Laporan'); }, []);
  return (
    <PageShell>
      <PageContent className="space-y-6 px-4 pb-4 pt-4 md:px-6">
        <ReportIndexHero />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {reportCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <Link to={cat.path} key={cat.path} className="group">
                <div className="group relative h-full overflow-hidden border border-border/70 bg-background transition-colors duration-200 hover:bg-muted/10">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-500 via-cyan-500 to-emerald-500" />
                  <div className="flex h-full flex-col justify-between">
                    <div className="space-y-2 px-4 pb-0 pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border/70 bg-muted/20 text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-foreground">{cat.title}</h2>
                            <Badge variant="secondary" className="ml-auto rounded-none px-2 py-0 text-[10px]">
                              {cat.count}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{cat.description}</p>
                          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80" style={{ fontFamily: REPORT_MONO_FAMILY }}>
                            {cat.auditFocus}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-[11px] text-muted-foreground">
                      <span>Masuk</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        Buka <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category A: Kunjungan & Pasien
// Backend JSON keys from reports_visits.go:
//   daily: tanggal, rawat_jalan, rawat_inap, igd, total
//   byRoom: room_id, kode_ruangan, nama_ruangan, service_type, jumlah, laki, perempuan, baru, lama
//   byDoctor: doctor_id, nama_dokter, spesialisasi, jumlah, rawat_jalan, rawat_inap, igd
//   demographics: kategori, nilai, jumlah (grouped rows)
//   regions: provinsi, kabupaten, kecamatan, jumlah (depends on level param)
//   topDiagnoses: kode_icd10, nama, jumlah, laki, perempuan
//   newVsOld: tanggal, pasien_baru, pasien_lama, total
//   paymentMethods: metode_bayar, jumlah, persentase
//   referrals: asal_rujukan, nama_rujukan, jumlah
// ============================================================
export function ReportVisitsPage() {
  const [tab, setTab] = useState('daily');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Kunjungan & Pasien'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'daily': res = await reportVisitsApi.daily(startDate, endDate); break;
        case 'summary': res = await reportVisitsApi.daily(startDate, endDate); break;
        case 'per-patient': res = await reportVisitsApi.perPatient(startDate, endDate); break;
        case 'service-mix': res = await reportVisitsApi.daily(startDate, endDate); break;
        case 'by-room': res = await reportVisitsApi.byRoom(startDate, endDate); break;
        case 'by-doctor': res = await reportVisitsApi.byDoctor(startDate, endDate); break;
        case 'demographics': res = await reportVisitsApi.demographics(startDate, endDate); break;
        case 'regions': res = await reportVisitsApi.regions(startDate, endDate); break;
        case 'top-diagnoses': res = await reportVisitsApi.topDiagnoses(startDate, endDate); break;
        case 'new-vs-old': res = await reportVisitsApi.newVsOld(startDate, endDate); break;
        case 'payment-methods': res = await reportVisitsApi.paymentMethods(startDate, endDate); break;
        case 'referrals': res = await reportVisitsApi.referrals(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportVisitsApi.exportExcel(
    tab === 'service-mix' || tab === 'summary' ? 'daily' : tab,
    startDate,
    endDate,
  );

  const reportItems = [
    { value: 'per-patient', label: 'Kunjungan Per Pasien', note: 'download: Kunjungan Per Pasien' },
    { value: 'daily', label: 'Kunjungan Per Hari', note: 'download: Kunjungan Per Hari' },
    { value: 'payment-methods', label: 'Kunjungan Per Cara Bayar', note: 'download: Kunjungan Per Cara Bayar' },
    { value: 'by-room', label: 'Kunjungan Per Unit', note: 'download: Kunjungan Per Unit' },
    { value: 'summary', label: 'Kunjungan Rekap', note: 'download: Kunjungan Rekap' },
    { value: 'service-mix', label: 'Mix Layanan', note: 'download: Mix Layanan' },
    { value: 'by-doctor', label: 'Kunjungan Per Dokter', note: 'download: Kunjungan Per Dokter' },
    { value: 'demographics', label: 'Demografi Pasien', note: 'download: Demografi Pasien' },
    { value: 'regions', label: 'Sebaran Wilayah', note: 'download: Sebaran Wilayah' },
    { value: 'top-diagnoses', label: 'Top Diagnosa', note: 'download: Top Diagnosa' },
    { value: 'new-vs-old', label: 'Pasien Baru vs Lama', note: 'download: Pasien Baru vs Lama' },
    { value: 'referrals', label: 'Rujukan Masuk', note: 'download: Rujukan Masuk' },
  ];

  // Demographics data is grouped: {kategori, nilai, jumlah}[]
  // Groups: "Jenis Kelamin", "Kelompok Umur", "Metode Pembayaran"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsGender = data.filter((r: any) => r.kategori === 'Jenis Kelamin').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsAge = data.filter((r: any) => r.kategori === 'Kelompok Umur').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsPayment = data.filter((r: any) => r.kategori === 'Metode Pembayaran').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  const totalRows = Array.isArray(data) ? data.length : 0;
  const serviceMixRows = (() => {
    const totals = data.reduce((acc: { layanan: string; jumlah: number }[], row: any) => {
      const entries = [
        { layanan: 'Rawat Jalan', jumlah: Number(row?.rawat_jalan ?? 0) },
        { layanan: 'Rawat Inap', jumlah: Number(row?.rawat_inap ?? 0) },
        { layanan: 'IGD', jumlah: Number(row?.igd ?? 0) },
      ];
      entries.forEach((entry) => {
        const found = acc.find((item) => item.layanan === entry.layanan);
        if (found) found.jumlah += entry.jumlah;
        else acc.push({ ...entry });
      });
      return acc;
    }, []);
    return totals.filter((item) => item.jumlah > 0);
  })();
  const summaryRows = [
    {
      kategori: 'Rawat Jalan',
      jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.rawat_jalan ?? 0), 0),
    },
    {
      kategori: 'Rawat Inap',
      jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.rawat_inap ?? 0), 0),
    },
    {
      kategori: 'IGD',
      jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.igd ?? 0), 0),
    },
    {
      kategori: 'Total',
      jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.total ?? 0), 0),
    },
  ].filter((item) => item.jumlah > 0);
  const totalVisitCount = Array.isArray(data)
    ? data.reduce((sum: number, row: any) => {
      const directValue = Number(row?.total ?? row?.jumlah ?? 0);
      if (!Number.isNaN(directValue) && directValue > 0) return sum + directValue;
      return sum;
    }, 0)
    : 0;
  const activeReport = reportItems.find((item) => item.value === tab);
  const normalizedData = Array.isArray(data)
    ? data.map((row: any) => ({
      ...row,
      service_type:
        row?.service_type === 'rawat_jalan' ? 'Rawat Jalan'
          : row?.service_type === 'rawat_inap' ? 'Rawat Inap'
            : row?.service_type === 'gawat_darurat' ? 'Gawat Darurat'
              : row?.service_type,
      nilai: row?.nilai === 'â‰¥ 65 tahun' ? '65+ tahun' : row?.nilai,
    }))
    : data;

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<TrendingUp className="h-5 w-5" />} title="Laporan Kunjungan & Pasien">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan kunjungan"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  Baris: {formatNumber(totalRows)} | Total: {formatNumber(totalVisitCount)}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'per-patient' && (
                <DataTable columns={[
                  { key: 'no_rm', label: 'No RM', width: '0.85fr' },
                  { key: 'nama_pasien', label: 'Pasien', width: '1.4fr' },
                  { key: 'jenis_kelamin', label: 'JK', width: '0.7fr' },
                  { key: 'total', label: 'Total', align: 'right', format: formatNumber, width: '0.7fr' },
                  { key: 'rawat_jalan', label: 'Rajal', align: 'right', format: formatNumber, width: '0.8fr' },
                  { key: 'rawat_inap', label: 'Ranap', align: 'right', format: formatNumber, width: '0.8fr' },
                  { key: 'igd', label: 'IGD', align: 'right', format: formatNumber, width: '0.7fr' },
                  { key: 'kunjungan_awal', label: 'Awal', width: '0.9fr' },
                  { key: 'kunjungan_akhir', label: 'Akhir', width: '0.9fr' },
                ]} data={normalizedData} />
              )}

              {tab === 'daily' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Kunjungan Per Hari">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={normalizedData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="rawat_jalan" fill="#1d4ed8" name="Rawat Jalan" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="rawat_inap" fill="#0f766e" name="Rawat Inap" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="igd" fill="#dc2626" name="IGD" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Kunjungan Per Hari">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
                      { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
                      { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
                      { key: 'total', label: 'Total', align: 'right', format: formatNumber },
                    ]} data={normalizedData} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'summary' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Kunjungan Rekap">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={summaryRows}>
                        <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="kategori" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Kunjungan Rekap">
                    <DataTable columns={[
                      { key: 'kategori', label: 'Kategori' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    ]} data={summaryRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-room' && (
                <ReportPanel eyebrow="Data" title="Kunjungan Per Unit">
                  <DataTable columns={[
                    { key: 'kode_ruangan', label: 'Kode' },
                    { key: 'nama_ruangan', label: 'Unit/Ruangan' },
                    { key: 'service_type', label: 'Layanan' },
                    { key: 'jumlah', label: 'Total', align: 'right', format: formatNumber },
                    { key: 'laki', label: 'L', align: 'right', format: formatNumber },
                    { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
                    { key: 'baru', label: 'Baru', align: 'right', format: formatNumber },
                    { key: 'lama', label: 'Lama', align: 'right', format: formatNumber },
                  ]} data={normalizedData} />
                </ReportPanel>
              )}

              {tab === 'by-doctor' && (
                <ReportPanel eyebrow="Data" title="Kunjungan Per Dokter">
                  <DataTable columns={[
                    { key: 'nama_dokter', label: 'Dokter', width: '1.5fr', wrap: true },
                    { key: 'spesialisasi', label: 'Spesialisasi', width: '1fr' },
                    { key: 'jumlah', label: 'Total', align: 'right', format: formatNumber, width: '0.7fr' },
                    { key: 'rawat_jalan', label: 'Rajal', align: 'right', format: formatNumber, width: '0.7fr' },
                    { key: 'rawat_inap', label: 'Ranap', align: 'right', format: formatNumber, width: '0.7fr' },
                    { key: 'igd', label: 'IGD', align: 'right', format: formatNumber, width: '0.6fr' },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'demographics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ReportPanel eyebrow="Chart" title="Jenis Kelamin">
                      {demographicsGender.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart><Pie data={demographicsGender} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={{ fontSize: 11 }}>
                            {demographicsGender.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                        </ResponsiveContainer>
                      ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
                    </ReportPanel>
                    <ReportPanel eyebrow="Chart" title="Kelompok Umur">
                      {demographicsAge.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={demographicsAge}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                            <Bar dataKey="value" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
                    </ReportPanel>
                    <ReportPanel eyebrow="Chart" title="Metode Pembayaran">
                      {demographicsPayment.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart><Pie data={demographicsPayment} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={{ fontSize: 11 }}>
                            {demographicsPayment.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                        </ResponsiveContainer>
                      ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
                    </ReportPanel>
                  </div>
                  <ReportPanel eyebrow="Data" title="Demografi">
                    <DataTable columns={[
                      { key: 'kategori', label: 'Kategori' },
                      { key: 'nilai', label: 'Nilai' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    ]} data={normalizedData} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'service-mix' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Mix Layanan">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={serviceMixRows} cx="50%" cy="50%" outerRadius={82} dataKey="jumlah" nameKey="layanan" label={{ fontSize: 11 }}>
                          {serviceMixRows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Mix Layanan">
                    <DataTable columns={[
                      { key: 'layanan', label: 'Layanan' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    ]} data={serviceMixRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'regions' && (
                <ReportPanel eyebrow="Data" title="Sebaran Wilayah Pasien">
                  <DataTable columns={[
                    { key: 'provinsi', label: 'Provinsi', width: '1.2fr', wrap: true },
                    { key: 'kabupaten', label: 'Kabupaten', width: '1.2fr', wrap: true },
                    { key: 'kecamatan', label: 'Kecamatan', width: '1.2fr', wrap: true },
                    { key: 'jumlah', label: 'Jumlah Pasien', align: 'right', format: formatNumber, width: '0.8fr' },
                  ]} data={normalizedData} />
                </ReportPanel>
              )}

              {tab === 'top-diagnoses' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Diagnosa Terbanyak">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.slice(0, 15)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="kode_icd10" type="category" width={80} tick={{ fontSize: 10 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Top Diagnosa">
                    <DataTable columns={[
                      { key: 'kode_icd10', label: 'Kode ICD-10' },
                      { key: 'nama', label: 'Nama Penyakit', width: '1.5fr' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                      { key: 'laki', label: 'L', align: 'right', format: formatNumber },
                      { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
                    ]} data={normalizedData} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'new-vs-old' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Pasien Baru vs Lama">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="pasien_baru" stroke="#3b82f6" name="Baru" strokeWidth={2} />
                        <Line type="monotone" dataKey="pasien_lama" stroke="#22c55e" name="Lama" strokeWidth={2} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Pasien Baru vs Lama">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'pasien_baru', label: 'Pasien Baru', align: 'right', format: formatNumber },
                      { key: 'pasien_lama', label: 'Pasien Lama', align: 'right', format: formatNumber },
                      { key: 'total', label: 'Total', align: 'right', format: formatNumber },
                    ]} data={normalizedData} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'payment-methods' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Kunjungan Per Cara Bayar">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart><Pie data={normalizedData} cx="50%" cy="50%" outerRadius={80} dataKey="jumlah" nameKey="metode_bayar" label={{ fontSize: 11 }}>
                        {normalizedData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Kunjungan Per Cara Bayar">
                    <DataTable columns={[
                      { key: 'metode_bayar', label: 'Cara Bayar' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                      { key: 'persentase', label: '%', align: 'right', format: formatPercent },
                    ]} data={normalizedData} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'referrals' && (
                <DataTable columns={[
                  { key: 'asal_rujukan', label: 'Asal Rujukan', width: '1.1fr', wrap: true },
                  { key: 'nama_rujukan', label: 'Nama Perujuk', width: '1.8fr', wrap: true },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber, width: '0.7fr' },
                ]} data={normalizedData} />
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category B: BPJS
// Backend JSON keys from reports_bpjs.go:
//   daily: tanggal, rawat_jalan, rawat_inap, igd, total
//   sep: no_sep, tgl_sep, no_kartu, nama_pasien, jns_pelayanan, kode_poli, nama_poli, diag_awal, nama_diagnosa, nama_dpjp, asal_rujukan, nama_rujukan
//   suratKontrol: no_surat_kontrol, tgl_rencana_kontrol, no_kartu, nama, nama_poli, nama_dokter, nama_diagnosa, is_prb, status
//   antrean: tanggal, total_booking, checkin, dilayani, selesai, batal, jkn, non_jkn
//   eklaim: no_sep, nama_pasien, tgl_masuk, tgl_pulang, jenis_rawat, state, total_tarif_rs, inacbg_code, inacbg_tariff, selisih (+ summary)
//   byPoli: kode_poli, nama_poli, jumlah, sep_count
// ============================================================
export function ReportBPJSPage() {
  const [tab, setTab] = useState('daily');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);

  useEffect(() => { setPageTitle('Laporan BPJS'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'daily': res = await reportBpjsApi.daily(startDate, endDate); break;
        case 'sep': res = await reportBpjsApi.sep(startDate, endDate); break;
        case 'surat-kontrol': res = await reportBpjsApi.suratKontrol(startDate, endDate); break;
        case 'antrean': res = await reportBpjsApi.antrean(startDate, endDate); break;
        case 'eklaim': res = await reportBpjsApi.eklaim(startDate, endDate); break;
        case 'by-poli': res = await reportBpjsApi.byPoli(startDate, endDate); break;
      }
      setData(res?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportBpjsApi.exportExcel(tab, startDate, endDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const summary = data?.summary || null;

  const reportItems = [
    { value: 'daily', label: 'Kunjungan BPJS Harian', note: 'download: Kunjungan BPJS Harian' },
    { value: 'sep', label: 'Data SEP', note: 'download: Data SEP' },
    { value: 'surat-kontrol', label: 'Surat Kontrol', note: 'download: Surat Kontrol' },
    { value: 'antrean', label: 'Antrean BPJS', note: 'download: Antrean BPJS' },
    { value: 'eklaim', label: 'E-Klaim', note: 'download: E-Klaim' },
    { value: 'by-poli', label: 'BPJS Per Poli', note: 'download: BPJS Per Poli' },
  ];
  const activeReport = reportItems.find((item) => item.value === tab);

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<Building2 className="h-5 w-5" />} title="Laporan BPJS">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan BPJS"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  Baris: {formatNumber(rows.length)} {summary ? `| Total: ${formatNumber(Number(summary.total ?? summary.total_sep ?? 0))}` : ''}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'daily' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Kunjungan BPJS Harian">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="rawat_jalan" fill="#1d4ed8" name="Rajal" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="rawat_inap" fill="#0f766e" name="Ranap" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="igd" fill="#dc2626" name="IGD" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Harian">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
                      { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
                      { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
                      { key: 'total', label: 'Total', align: 'right', format: formatNumber },
                    ]} data={rows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'sep' && (
                <DataTable columns={[
                  { key: 'no_sep', label: 'No SEP' },
                  { key: 'tgl_sep', label: 'Tanggal' },
                  { key: 'no_kartu', label: 'No Kartu' },
                  { key: 'nama_pasien', label: 'Pasien' },
                  { key: 'jns_pelayanan', label: 'Jenis' },
                  { key: 'nama_poli', label: 'Poli' },
                  { key: 'diag_awal', label: 'Kode Diagnosa' },
                  { key: 'nama_diagnosa', label: 'Nama Diagnosa' },
                  { key: 'nama_dpjp', label: 'DPJP' },
                  { key: 'asal_rujukan', label: 'Asal Rujukan' },
                  { key: 'nama_rujukan', label: 'Nama Rujukan' },
                ]} data={rows} />
              )}

              {tab === 'surat-kontrol' && (
                <DataTable columns={[
                  { key: 'no_surat_kontrol', label: 'No Surat' },
                  { key: 'tgl_rencana_kontrol', label: 'Tgl Kontrol' },
                  { key: 'no_kartu', label: 'No Kartu' },
                  { key: 'nama', label: 'Pasien' },
                  { key: 'nama_poli', label: 'Poli' },
                  { key: 'nama_dokter', label: 'Dokter' },
                  { key: 'nama_diagnosa', label: 'Diagnosa' },
                  { key: 'is_prb', label: 'PRB', format: (v: boolean) => v ? 'Ya' : 'Tidak' },
                  { key: 'status', label: 'Status' },
                ]} data={rows} />
              )}

              {tab === 'antrean' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Antrean Mobile JKN">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="total_booking" fill="#1d4ed8" name="Booking" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="checkin" fill="#0f766e" name="Check-in" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="dilayani" fill="#d97706" name="Dilayani" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="selesai" fill="#7c3aed" name="Selesai" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="batal" fill="#dc2626" name="Batal" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Antrean">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'total_booking', label: 'Booking', align: 'right', format: formatNumber },
                      { key: 'checkin', label: 'Check-in', align: 'right', format: formatNumber },
                      { key: 'dilayani', label: 'Dilayani', align: 'right', format: formatNumber },
                      { key: 'selesai', label: 'Selesai', align: 'right', format: formatNumber },
                      { key: 'batal', label: 'Batal', align: 'right', format: formatNumber },
                      { key: 'jkn', label: 'JKN', align: 'right', format: formatNumber },
                      { key: 'non_jkn', label: 'Non-JKN', align: 'right', format: formatNumber },
                    ]} data={rows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'eklaim' && (
                <div className="space-y-4">
                  {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                      <KPICard label="Total Kasus" value={formatNumber(summary.total_kasus)} />
                      <KPICard label="Total Tarif RS" value={formatCurrency(summary.total_tarif_rs)} />
                      <KPICard label="Total INACBG" value={formatCurrency(summary.total_inacbg)} />
                      <KPICard label="Total Selisih" value={formatCurrency(summary.total_selisih)} />
                    </div>
                  )}
                  <DataTable columns={[
                    { key: 'no_sep', label: 'No SEP' },
                    { key: 'nama_pasien', label: 'Pasien' },
                    { key: 'tgl_masuk', label: 'Tgl Masuk' },
                    { key: 'tgl_pulang', label: 'Tgl Pulang' },
                    { key: 'jenis_rawat', label: 'Jenis Rawat' },
                    { key: 'inacbg_code', label: 'Kode INACBG' },
                    { key: 'total_tarif_rs', label: 'Tarif RS', align: 'right', format: formatCurrency },
                    { key: 'inacbg_tariff', label: 'Tarif INACBG', align: 'right', format: formatCurrency },
                    { key: 'selisih', label: 'Selisih', align: 'right', format: formatCurrency },
                    { key: 'state', label: 'Status' },
                  ]} data={rows} />
                </div>
              )}

              {tab === 'by-poli' && (
                <DataTable columns={[
                  { key: 'kode_poli', label: 'Kode Poli' },
                  { key: 'nama_poli', label: 'Poli' },
                  { key: 'jumlah', label: 'Kunjungan', align: 'right', format: formatNumber },
                  { key: 'sep_count', label: 'Jumlah SEP', align: 'right', format: formatNumber },
                ]} data={rows} />
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category C: Keuangan
// Backend JSON keys from reports_billing.go:
//   dailyRevenue: tanggal, total_tagihan, total_bayar, total_piutang, jumlah_billing (+ summary)
//   byPayment: metode_bayar, total_tagihan, total_bayar, jumlah
//   byRoom: nama_ruangan, service_type, total_tagihan, total_bayar, jumlah
//   byDoctor: nama_dokter, spesialisasi, total_tagihan, total_bayar, jumlah
//   receivables: billing_number, nama_pasien, no_rm, metode_bayar, total_tagihan, total_bayar, sisa_piutang, tgl_billing, status
//   byItemType: item_type, jumlah, total_nilai
// ============================================================
export function ReportBillingPage() {
  const [tab, setTab] = useState('daily-revenue');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);

  useEffect(() => { setPageTitle('Laporan Keuangan'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'daily-revenue': res = await reportBillingApi.dailyRevenue(startDate, endDate); break;
        case 'by-payment': res = await reportBillingApi.byPayment(startDate, endDate); break;
        case 'by-room': res = await reportBillingApi.byRoom(startDate, endDate); break;
        case 'by-doctor': res = await reportBillingApi.byDoctor(startDate, endDate); break;
        case 'receivables': res = await reportBillingApi.receivables(); break;
        case 'aging-receivables': res = await reportBillingApi.receivables(); break;
        case 'by-item-type': res = await reportBillingApi.byItemType(startDate, endDate); break;
      }
      setData(res?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportBillingApi.exportExcel(tab === 'aging-receivables' ? 'receivables' : tab, startDate, endDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const summary = data?.summary || null;

  const reportItems = [
    { value: 'daily-revenue', label: 'Pendapatan Harian', note: 'download: Pendapatan Harian' },
    { value: 'by-payment', label: 'Pendapatan Per Cara Bayar', note: 'download: Pendapatan Per Cara Bayar' },
    { value: 'by-room', label: 'Pendapatan Per Ruangan', note: 'download: Pendapatan Per Ruangan' },
    { value: 'by-doctor', label: 'Pendapatan Per Dokter', note: 'download: Pendapatan Per Dokter' },
    { value: 'receivables', label: 'Piutang Pasien', note: 'download: Piutang Pasien' },
    { value: 'aging-receivables', label: 'Aging Piutang', note: 'download: Aging Piutang' },
    { value: 'by-item-type', label: 'Billing Per Tipe', note: 'download: Billing Per Tipe' },
  ];
  const receivableAgingRows = [
    { bucket: '0-30 Hari', jumlah_billing: 0, total_piutang: 0 },
    { bucket: '31-60 Hari', jumlah_billing: 0, total_piutang: 0 },
    { bucket: '61-90 Hari', jumlah_billing: 0, total_piutang: 0 },
    { bucket: '> 90 Hari', jumlah_billing: 0, total_piutang: 0 },
  ];
  rows.forEach((row: any) => {
    const umur = Number(row?.umur_hari ?? 0);
    const nominal = Number(row?.sisa_piutang ?? 0);
    const target = umur <= 30 ? receivableAgingRows[0] : umur <= 60 ? receivableAgingRows[1] : umur <= 90 ? receivableAgingRows[2] : receivableAgingRows[3];
    target.jumlah_billing += 1;
    target.total_piutang += nominal;
  });

  const activeReport = reportItems.find((item) => item.value === tab);

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<DollarSign className="h-5 w-5" />} title="Laporan Keuangan">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan keuangan"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  Tagihan: {summary ? formatCurrency(summary.total_tagihan) : '-'} | Piutang: {summary ? formatCurrency(summary.total_piutang) : '-'}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'daily-revenue' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Harian">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={rows}><CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="total_tagihan" fill="#1d4ed8" name="Tagihan" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="total_bayar" fill="#0f766e" name="Bayar" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="total_piutang" fill="#dc2626" name="Piutang" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Harian">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
                      { key: 'total_bayar', label: 'Bayar', align: 'right', format: formatCurrency },
                      { key: 'total_piutang', label: 'Piutang', align: 'right', format: formatCurrency },
                      { key: 'jumlah_billing', label: 'Billing', align: 'right', format: formatNumber },
                    ]} data={rows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-payment' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Mix" title="Cara Bayar">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart><Pie data={rows} cx="50%" cy="50%" innerRadius={50} outerRadius={74} dataKey="total_tagihan" nameKey="metode_bayar">
                        {rows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} formatter={(v: number) => formatCurrency(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Cara Bayar">
                    <DataTable columns={[
                      { key: 'metode_bayar', label: 'Metode' },
                      { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
                      { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
                      { key: 'total_bayar', label: 'Bayar', align: 'right', format: formatCurrency },
                    ]} data={rows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-room' && (
                <ReportPanel eyebrow="Data" title="Per Ruangan">
                  <DataTable columns={[
                    { key: 'nama_ruangan', label: 'Ruangan' },
                    { key: 'service_type', label: 'Layanan' },
                    { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
                    { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
                    { key: 'total_bayar', label: 'Bayar', align: 'right', format: formatCurrency },
                  ]} data={rows} />
                </ReportPanel>
              )}

              {tab === 'by-doctor' && (
                <ReportPanel eyebrow="Data" title="Per Dokter">
                  <DataTable columns={[
                    { key: 'nama_dokter', label: 'Dokter' },
                    { key: 'spesialisasi', label: 'Spesialisasi' },
                    { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
                    { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
                    { key: 'total_bayar', label: 'Bayar', align: 'right', format: formatCurrency },
                  ]} data={rows} />
                </ReportPanel>
              )}

              {tab === 'receivables' && (
                <ReportPanel eyebrow="Data" title="Piutang">
                  <DataTable columns={[
                    { key: 'billing_number', label: 'No Billing', width: '1.1fr' },
                    { key: 'nama_pasien', label: 'Pasien', width: '1.3fr' },
                    { key: 'no_rm', label: 'No RM', width: '0.8fr' },
                    { key: 'metode_bayar', label: 'Metode', width: '0.9fr' },
                    { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency, width: '1fr' },
                    { key: 'total_bayar', label: 'Bayar', align: 'right', format: formatCurrency, width: '1fr' },
                    { key: 'sisa_piutang', label: 'Piutang', align: 'right', format: formatCurrency, width: '1fr' },
                    { key: 'tgl_billing', label: 'Tanggal', width: '0.9fr' },
                    { key: 'umur_hari', label: 'Umur', align: 'right', format: formatNumber, width: '0.7fr' },
                    { key: 'status', label: 'Status', width: '0.8fr' },
                  ]} data={rows} />
                </ReportPanel>
              )}

              {tab === 'aging-receivables' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Aging Piutang">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={receivableAgingRows}>
                        <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="total_piutang" fill="#1d4ed8" name="Piutang" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Aging Piutang">
                    <DataTable columns={[
                      { key: 'bucket', label: 'Umur Piutang' },
                      { key: 'jumlah_billing', label: 'Billing', align: 'right', format: formatNumber },
                      { key: 'total_piutang', label: 'Total Piutang', align: 'right', format: formatCurrency },
                    ]} data={receivableAgingRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-item-type' && (
                <ReportPanel eyebrow="Data" title="Per Tipe">
                  <DataTable columns={[
                    { key: 'item_type', label: 'Tipe Item' },
                    { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    { key: 'total_nilai', label: 'Total Nilai', align: 'right', format: formatCurrency },
                  ]} data={rows} />
                </ReportPanel>
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category D: Rawat Inap
// Backend JSON keys from reports_inpatient.go:
//   indicators: SINGLE OBJECT → total_beds, occupied_days, total_discharges, total_deaths, deaths_less_48h, period_days, bor, alos, bto, toi, gdr, ndr
//   census: nama_ruangan, room_class, total_bed, terisi, kosong, bor
//   list: no_rm, nama_pasien, jenis_kelamin, nama_ruangan, nama_bed, dokter_dpjp, tgl_masuk, tgl_keluar, los, metode_bayar, status
//   byRoom: nama_ruangan, room_class, jumlah_masuk, jumlah_keluar, masih_rawat, rata_rata_los
// ============================================================
export function ReportInpatientPage() {
  const [tab, setTab] = useState('indicators');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);

  useEffect(() => { setPageTitle('Laporan Rawat Inap'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'indicators': res = await reportInpatientApi.indicators(startDate, endDate); break;
        case 'census': res = await reportInpatientApi.census(); break;
        case 'list': res = await reportInpatientApi.list(startDate, endDate); break;
        case 'by-payment': res = await reportInpatientApi.list(startDate, endDate); break;
        case 'by-room': res = await reportInpatientApi.byRoom(startDate, endDate); break;
      }
      setData(res?.data?.data || res?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportInpatientApi.exportExcel(tab === 'by-payment' ? 'list' : tab, startDate, endDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(data) ? data : [];

  const reportItems = [
    { value: 'indicators', label: 'Indikator Rawat Inap', note: 'download: Indikator Rawat Inap' },
    { value: 'census', label: 'Sensus Rawat Inap', note: 'download: Sensus Rawat Inap' },
    { value: 'list', label: 'Daftar Pasien Rawat Inap', note: 'download: Daftar Pasien Rawat Inap' },
    { value: 'by-payment', label: 'Rawat Inap Per Cara Bayar', note: 'download: Rawat Inap Per Cara Bayar' },
    { value: 'by-room', label: 'Rawat Inap Per Ruangan', note: 'download: Rawat Inap Per Ruangan' },
  ];
  const inpatientPaymentRows = aggregateByKey(rows, 'metode_bayar', ['los'], 'metode_bayar').map((row) => {
    const subset = rows.filter((item: any) => String(item?.metode_bayar ?? '-') === String(row.metode_bayar));
    return {
      metode_bayar: row.metode_bayar,
      jumlah_pasien: subset.length,
      total_los: Number(row.los ?? 0),
      avg_los: subset.length ? Number(row.los ?? 0) / subset.length : 0,
    };
  });

  // Indicators is a single object, not an array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ind: any = (tab === 'indicators' && data && !Array.isArray(data)) ? data : null;
  const activeReport = reportItems.find((item) => item.value === tab);

  const getBORStatus = (v: number): 'good' | 'warning' | 'bad' => {
    if (v >= 60 && v <= 85) return 'good';
    if (v >= 50 && v <= 90) return 'warning';
    return 'bad';
  };
  const getALOSStatus = (v: number): 'good' | 'warning' | 'bad' => {
    if (v >= 6 && v <= 9) return 'good';
    if (v >= 4 && v <= 12) return 'warning';
    return 'bad';
  };
  const getBTOStatus = (v: number): 'good' | 'warning' | 'bad' => {
    if (v >= 40 && v <= 50) return 'good';
    if (v >= 30 && v <= 60) return 'warning';
    return 'bad';
  };
  const getTOIStatus = (v: number): 'good' | 'warning' | 'bad' => {
    if (v >= 1 && v <= 3) return 'good';
    if (v >= 0 && v <= 5) return 'warning';
    return 'bad';
  };
  const getGDRStatus = (v: number): 'good' | 'warning' | 'bad' => v <= 45 ? 'good' : 'bad';
  const getNDRStatus = (v: number): 'good' | 'warning' | 'bad' => v <= 25 ? 'good' : 'bad';

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<HeartPulse className="h-5 w-5" />} title="Laporan Rawat Inap">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan rawat inap"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  BOR: {ind ? `${formatDecimal(ind.bor)}%` : '-'} | ALOS: {ind ? formatDecimal(ind.alos) : '-'}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'indicators' && ind && (
                <div className="space-y-4">
                  <div className="grid gap-px bg-border/70 md:grid-cols-2 lg:grid-cols-4">
                    <KPICard label="Total TT" value={formatNumber(ind.total_beds)} subtitle="Tempat Tidur" />
                    <KPICard label="Hari Rawat" value={formatNumber(ind.occupied_days)} subtitle="Occupied Days" />
                    <KPICard label="Pasien Keluar" value={formatNumber(ind.total_discharges)} subtitle="Discharges" />
                    <KPICard label="Kematian" value={formatNumber(ind.total_deaths)} subtitle={`< 48 jam: ${formatNumber(ind.deaths_less_48h)}`} />
                  </div>
                  <div className="grid gap-px bg-border/70 md:grid-cols-3">
                    <KPICard label="BOR" value={formatDecimal(ind.bor) + '%'} subtitle="Standar: 60-85%" status={getBORStatus(Number(ind.bor))} />
                    <KPICard label="ALOS" value={formatDecimal(ind.alos) + ' hari'} subtitle="Standar: 6-9 hari" status={getALOSStatus(Number(ind.alos))} />
                    <KPICard label="BTO" value={formatDecimal(ind.bto) + ' kali'} subtitle="Standar: 40-50 kali" status={getBTOStatus(Number(ind.bto))} />
                    <KPICard label="TOI" value={formatDecimal(ind.toi) + ' hari'} subtitle="Standar: 1-3 hari" status={getTOIStatus(Number(ind.toi))} />
                    <KPICard label="GDR" value={formatDecimal(ind.gdr) + '‰'} subtitle="Standar: ≤ 45‰" status={getGDRStatus(Number(ind.gdr))} />
                    <KPICard label="NDR" value={formatDecimal(ind.ndr) + '‰'} subtitle="Standar: ≤ 25‰" status={getNDRStatus(Number(ind.ndr))} />
                  </div>
                </div>
              )}
              {tab === 'indicators' && !ind && !loading && (
                <p className="text-muted-foreground text-center py-8">Tidak ada data untuk periode ini.</p>
              )}

              {tab === 'census' && (
                <ReportPanel eyebrow="Data" title="Sensus">
                  <DataTable columns={[
                    { key: 'nama_ruangan', label: 'Ruangan' },
                    { key: 'room_class', label: 'Kelas' },
                    { key: 'total_bed', label: 'Total TT', align: 'right', format: formatNumber },
                    { key: 'terisi', label: 'Terisi', align: 'right', format: formatNumber },
                    { key: 'kosong', label: 'Kosong', align: 'right', format: formatNumber },
                    { key: 'bor', label: 'BOR (%)', align: 'right', format: formatDecimal },
                  ]} data={rows} />
                </ReportPanel>
              )}

              {tab === 'list' && (
                <ReportPanel eyebrow="Data" title="Daftar Pasien">
                  <DataTable columns={[
                    { key: 'no_rm', label: 'No RM', width: '0.85fr' },
                    { key: 'nama_pasien', label: 'Pasien', width: '1.2fr' },
                    { key: 'jenis_kelamin', label: 'JK', width: '0.8fr' },
                    { key: 'nama_ruangan', label: 'Ruangan', width: '1fr' },
                    { key: 'nama_bed', label: 'Bed', width: '0.7fr' },
                    { key: 'dokter_dpjp', label: 'DPJP', width: '1.2fr' },
                    { key: 'tgl_masuk', label: 'Tgl Masuk', width: '1fr' },
                    { key: 'tgl_keluar', label: 'Tgl Keluar', width: '1fr' },
                    { key: 'los', label: 'LOS', align: 'right', format: formatNumber, width: '0.6fr' },
                    { key: 'metode_bayar', label: 'Bayar', width: '0.9fr' },
                    { key: 'status', label: 'Status', width: '0.8fr' },
                  ]} data={rows} />
                </ReportPanel>
              )}

              {tab === 'by-payment' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Cara Bayar">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={inpatientPaymentRows} cx="50%" cy="50%" outerRadius={82} dataKey="jumlah_pasien" nameKey="metode_bayar" label={{ fontSize: 11 }}>
                          {inpatientPaymentRows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Cara Bayar">
                    <DataTable columns={[
                      { key: 'metode_bayar', label: 'Metode Bayar' },
                      { key: 'jumlah_pasien', label: 'Pasien', align: 'right', format: formatNumber },
                      { key: 'total_los', label: 'Total LOS', align: 'right', format: formatNumber },
                      { key: 'avg_los', label: 'Avg LOS', align: 'right', format: formatDecimal },
                    ]} data={inpatientPaymentRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-room' && (
                <ReportPanel eyebrow="Data" title="Per Ruangan">
                  <DataTable columns={[
                    { key: 'nama_ruangan', label: 'Ruangan' },
                    { key: 'room_class', label: 'Kelas' },
                    { key: 'jumlah_masuk', label: 'Masuk', align: 'right', format: formatNumber },
                    { key: 'jumlah_keluar', label: 'Keluar', align: 'right', format: formatNumber },
                    { key: 'masih_rawat', label: 'Masih Rawat', align: 'right', format: formatNumber },
                    { key: 'rata_rata_los', label: 'Avg LOS', align: 'right', format: formatDecimal },
                  ]} data={rows} />
                </ReportPanel>
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category E: Farmasi
// Backend JSON keys from reports_pharmacy.go:
//   daily: tanggal, total_resep, pending, disiapkan, diserahkan, dibatalkan, racikan, non_racikan
//   topMedicines: kode_obat, nama_obat, satuan, jumlah_qty, jumlah_rx
//   byDoctor: nama_dokter, spesialisasi, jumlah_resep, jumlah_item
//   byDepo: nama_depo, jumlah_resep, delivered, pending
//   tat: nama_depo, avg_tat_menit, min_tat_menit, max_tat_menit, jumlah_resep
// ============================================================
export function ReportPharmacyPage() {
  const [tab, setTab] = useState('daily');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Farmasi'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'daily': res = await reportPharmacyApi.daily(startDate, endDate); break;
        case 'mix-resep': res = await reportPharmacyApi.daily(startDate, endDate); break;
        case 'top-medicines': res = await reportPharmacyApi.topMedicines(startDate, endDate); break;
        case 'by-doctor': res = await reportPharmacyApi.byDoctor(startDate, endDate); break;
        case 'by-depo': res = await reportPharmacyApi.byDepo(startDate, endDate); break;
        case 'tat': res = await reportPharmacyApi.tat(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportPharmacyApi.exportExcel(tab === 'mix-resep' ? 'daily' : tab, startDate, endDate);

  const reportItems = [
    { value: 'daily', label: 'Resep Harian', note: 'download: Resep Harian' },
    { value: 'mix-resep', label: 'Mix Resep', note: 'download: Mix Resep' },
    { value: 'top-medicines', label: 'Obat Terbanyak', note: 'download: Obat Terbanyak' },
    { value: 'by-doctor', label: 'Resep Per Dokter', note: 'download: Resep Per Dokter' },
    { value: 'by-depo', label: 'Resep Per Depo', note: 'download: Resep Per Depo' },
    { value: 'tat', label: 'Waktu Tunggu Farmasi', note: 'download: Waktu Tunggu Farmasi' },
  ];
  const activeReport = reportItems.find((item) => item.value === tab);
  const pharmacyMixRows = [
    { kategori: 'Racikan', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.racikan ?? 0), 0) },
    { kategori: 'Non Racikan', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.non_racikan ?? 0), 0) },
    { kategori: 'Pending', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.pending ?? 0), 0) },
    { kategori: 'Diserahkan', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.diserahkan ?? 0), 0) },
  ].filter((item) => item.jumlah > 0);

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<Pill className="h-5 w-5" />} title="Laporan Farmasi">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan farmasi"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  Total: {formatNumber(data.reduce((sum: number, row: any) => sum + Number(row?.total_resep ?? row?.jumlah_resep ?? row?.jumlah_qty ?? 0), 0))}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'daily' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Harian">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data}><CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="disiapkan" fill="#1d4ed8" name="Siap" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="diserahkan" fill="#0f766e" name="Serah" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="pending" fill="#d97706" name="Pending" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="dibatalkan" fill="#dc2626" name="Batal" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Harian">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'total_resep', label: 'Total', align: 'right', format: formatNumber },
                      { key: 'pending', label: 'Pending', align: 'right', format: formatNumber },
                      { key: 'disiapkan', label: 'Disiapkan', align: 'right', format: formatNumber },
                      { key: 'diserahkan', label: 'Diserahkan', align: 'right', format: formatNumber },
                      { key: 'dibatalkan', label: 'Dibatalkan', align: 'right', format: formatNumber },
                      { key: 'racikan', label: 'Racikan', align: 'right', format: formatNumber },
                      { key: 'non_racikan', label: 'Non-Racikan', align: 'right', format: formatNumber },
                    ]} data={data} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'mix-resep' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Komposisi Resep">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pharmacyMixRows} cx="50%" cy="50%" outerRadius={82} dataKey="jumlah" nameKey="kategori" label={{ fontSize: 11 }}>
                          {pharmacyMixRows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Mix Resep">
                    <DataTable columns={[
                      { key: 'kategori', label: 'Kategori' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    ]} data={pharmacyMixRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'top-medicines' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Obat">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.slice(0, 15)} layout="vertical">
                        <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis dataKey="nama_obat" type="category" width={150} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="jumlah_qty" fill="#1d4ed8" name="Qty" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Obat">
                    <DataTable columns={[
                      { key: 'kode_obat', label: 'Kode Obat' },
                      { key: 'nama_obat', label: 'Nama Obat' },
                      { key: 'satuan', label: 'Satuan' },
                      { key: 'jumlah_qty', label: 'Total Qty', align: 'right', format: formatNumber },
                      { key: 'jumlah_rx', label: 'Jumlah Resep', align: 'right', format: formatNumber },
                    ]} data={data} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'by-doctor' && (
                <ReportPanel eyebrow="Data" title="Per Dokter">
                  <DataTable columns={[
                    { key: 'nama_dokter', label: 'Dokter' },
                    { key: 'spesialisasi', label: 'Spesialisasi' },
                    { key: 'jumlah_resep', label: 'Resep', align: 'right', format: formatNumber },
                    { key: 'jumlah_item', label: 'Jumlah Item', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'by-depo' && (
                <ReportPanel eyebrow="Data" title="Per Depo">
                  <DataTable columns={[
                    { key: 'nama_depo', label: 'Depo Farmasi' },
                    { key: 'jumlah_resep', label: 'Total Resep', align: 'right', format: formatNumber },
                    { key: 'delivered', label: 'Diserahkan', align: 'right', format: formatNumber },
                    { key: 'pending', label: 'Pending', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'tat' && (
                <ReportPanel eyebrow="Data" title="Waktu Tunggu">
                  <DataTable columns={[
                    { key: 'nama_depo', label: 'Depo' },
                    { key: 'avg_tat_menit', label: 'Rata-rata (menit)', align: 'right', format: formatDecimal },
                    { key: 'min_tat_menit', label: 'Min (menit)', align: 'right', format: formatDecimal },
                    { key: 'max_tat_menit', label: 'Max (menit)', align: 'right', format: formatDecimal },
                    { key: 'jumlah_resep', label: 'Jumlah Resep', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category F: Penunjang
// Backend JSON keys from reports_penunjang.go:
//   daily: tanggal, total_order, laboratorium, radiologi, konsultasi, operasi, completed, pending
//   topLab: nama_pemeriksaan, jumlah, completed
//   topRadiology: nama_pemeriksaan, jumlah, completed
//   criticalResults: tanggal, nama_pasien, nama_pemeriksaan, hasil, order_type, nama_ruangan, nama_dokter
//   tat: order_type, nama_ruangan, avg_tat_menit, min_tat_menit, max_tat_menit, jumlah_order
// ============================================================
export function ReportPenunjangPage() {
  const [tab, setTab] = useState('daily');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Penunjang'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'daily': res = await reportPenunjangApi.daily(startDate, endDate); break;
        case 'mix-order': res = await reportPenunjangApi.daily(startDate, endDate); break;
        case 'top-lab': res = await reportPenunjangApi.topLab(startDate, endDate); break;
        case 'top-radiology': res = await reportPenunjangApi.topRadiology(startDate, endDate); break;
        case 'critical-results': res = await reportPenunjangApi.criticalResults(startDate, endDate); break;
        case 'tat': res = await reportPenunjangApi.tat(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportPenunjangApi.exportExcel(tab === 'mix-order' ? 'daily' : tab, startDate, endDate);

  const reportItems = [
    { value: 'daily', label: 'Order Penunjang Harian', note: 'download: Order Penunjang Harian' },
    { value: 'mix-order', label: 'Mix Order Penunjang', note: 'download: Mix Order Penunjang' },
    { value: 'top-lab', label: 'Lab Terbanyak', note: 'download: Lab Terbanyak' },
    { value: 'top-radiology', label: 'Radiologi Terbanyak', note: 'download: Radiologi Terbanyak' },
    { value: 'critical-results', label: 'Hasil Kritis', note: 'download: Hasil Kritis' },
    { value: 'tat', label: 'TAT Penunjang', note: 'download: TAT Penunjang' },
  ];
  const activeReport = reportItems.find((item) => item.value === tab);
  const penunjangMixRows = [
    { kategori: 'Laboratorium', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.laboratorium ?? 0), 0) },
    { kategori: 'Radiologi', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.radiologi ?? 0), 0) },
    { kategori: 'Konsultasi', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.konsultasi ?? 0), 0) },
    { kategori: 'Operasi', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.operasi ?? 0), 0) },
    { kategori: 'Selesai', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.completed ?? 0), 0) },
    { kategori: 'Pending', jumlah: data.reduce((sum: number, row: any) => sum + Number(row?.pending ?? 0), 0) },
  ].filter((item) => item.jumlah > 0);

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<FlaskConical className="h-5 w-5" />} title="Laporan Penunjang (Lab & Radiologi)">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <ReportExplorerLayout
          sidebarTitle="Parameter laporan penunjang"
          reportItems={reportItems}
          activeTab={tab}
          onTabChange={setTab}
          onApply={fetchData}
          onExport={exportExcel}
          previewTitle={activeReport?.label || 'Preview'}
          filters={
            <>
              <ReportFilterField label="Periode Awal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Periode Akhir">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </ReportFilterField>
              <ReportFilterField label="Ringkasan">
                <div className="border border-border/70 bg-muted/10 px-3 py-2 text-sm">
                  Total: {formatNumber(data.reduce((sum: number, row: any) => sum + Number(row?.total_order ?? row?.jumlah ?? row?.jumlah_order ?? 0), 0))}
                </div>
              </ReportFilterField>
            </>
          }
          previewChildren={
            <>
              {tab === 'daily' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Trend" title="Harian">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data}><CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="laboratorium" fill="#1d4ed8" name="Lab" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="radiologi" fill="#0f766e" name="Radiologi" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="operasi" fill="#dc2626" name="Operasi" radius={[0, 0, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Harian">
                    <DataTable columns={[
                      { key: 'tanggal', label: 'Tanggal' },
                      { key: 'total_order', label: 'Total Order', align: 'right', format: formatNumber },
                      { key: 'laboratorium', label: 'Lab', align: 'right', format: formatNumber },
                      { key: 'radiologi', label: 'Radiologi', align: 'right', format: formatNumber },
                      { key: 'konsultasi', label: 'Konsultasi', align: 'right', format: formatNumber },
                      { key: 'operasi', label: 'Operasi', align: 'right', format: formatNumber },
                      { key: 'completed', label: 'Selesai', align: 'right', format: formatNumber },
                      { key: 'pending', label: 'Pending', align: 'right', format: formatNumber },
                    ]} data={data} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'mix-order' && (
                <div className="space-y-4">
                  <ReportPanel eyebrow="Chart" title="Komposisi Order">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={penunjangMixRows} cx="50%" cy="50%" outerRadius={82} dataKey="jumlah" nameKey="kategori" label={{ fontSize: 11 }}>
                          {penunjangMixRows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel eyebrow="Data" title="Mix Order">
                    <DataTable columns={[
                      { key: 'kategori', label: 'Kategori' },
                      { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    ]} data={penunjangMixRows} />
                  </ReportPanel>
                </div>
              )}

              {tab === 'top-lab' && (
                <ReportPanel eyebrow="Data" title="Lab">
                  <DataTable columns={[
                    { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
                    { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    { key: 'completed', label: 'Selesai', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'top-radiology' && (
                <ReportPanel eyebrow="Data" title="Radiologi">
                  <DataTable columns={[
                    { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
                    { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                    { key: 'completed', label: 'Selesai', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'critical-results' && (
                <ReportPanel eyebrow="Data" title="Hasil Kritis">
                  <DataTable columns={[
                    { key: 'tanggal', label: 'Tanggal' },
                    { key: 'nama_pasien', label: 'Pasien' },
                    { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
                    { key: 'hasil', label: 'Hasil' },
                    { key: 'order_type', label: 'Tipe' },
                    { key: 'nama_ruangan', label: 'Ruangan' },
                    { key: 'nama_dokter', label: 'Dokter' },
                  ]} data={data} />
                </ReportPanel>
              )}

              {tab === 'tat' && (
                <ReportPanel eyebrow="Data" title="TAT">
                  <DataTable columns={[
                    { key: 'order_type', label: 'Tipe Order' },
                    { key: 'nama_ruangan', label: 'Ruangan' },
                    { key: 'avg_tat_menit', label: 'Rata-rata (menit)', align: 'right', format: formatDecimal },
                    { key: 'min_tat_menit', label: 'Min (menit)', align: 'right', format: formatDecimal },
                    { key: 'max_tat_menit', label: 'Max (menit)', align: 'right', format: formatDecimal },
                    { key: 'jumlah_order', label: 'Jumlah', align: 'right', format: formatNumber },
                  ]} data={data} />
                </ReportPanel>
              )}
            </>
          }
        />
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category G: Layanan
// Backend JSON keys from reports_services.go:
//   perPatient: no_rm, nama_pasien, jenis_kelamin, jumlah, selesai, terakhir
//   summary: tanggal, jumlah, selesai, pasien_unik
//   byPayment: payment_method, jumlah, persentase
//   byClass: kelas, jumlah, persentase
//   surgeryPatients: no_rm, nama_pasien, tindakan, dokter_bedah, ruangan, jadwal, status
//   surgerySchedule: tanggal, ruangan, total, pending, selesai
// ============================================================
export function ReportServicesPage() {
  const [tab, setTab] = useState('per-patient');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Layanan'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'per-patient': res = await reportServicesApi.perPatient(startDate, endDate); break;
        case 'summary': res = await reportServicesApi.summary(startDate, endDate); break;
        case 'by-payment': res = await reportServicesApi.byPayment(startDate, endDate); break;
        case 'by-class': res = await reportServicesApi.byClass(startDate, endDate); break;
        case 'surgery-patients': res = await reportServicesApi.surgeryPatients(startDate, endDate); break;
        case 'surgery-schedule': res = await reportServicesApi.surgerySchedule(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportServicesApi.exportExcel(tab, startDate, endDate);

  const reportItems = [
    { value: 'per-patient', label: 'Volume Tindakan Per Pasien', note: 'download: Volume Tindakan Per Pasien' },
    { value: 'summary', label: 'Volume Tindakan Rekap', note: 'download: Volume Tindakan Rekap' },
    { value: 'by-payment', label: 'Laporan Tindakan Cara Bayar', note: 'download: Laporan Tindakan Cara Bayar' },
    { value: 'by-class', label: 'Laporan Tindakan Per Kelas', note: 'download: Laporan Tindakan Per Kelas' },
    { value: 'surgery-patients', label: 'Laporan Pasien Operasi', note: 'download: Laporan Pasien Operasi' },
    { value: 'surgery-schedule', label: 'Laporan Penjadwalan Operasi', note: 'download: Laporan Penjadwalan Operasi' },
  ];
  const activeReport = reportItems.find((item) => item.value === tab);

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<HeartPulse className="h-5 w-5" />} title="Laporan Layanan">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border border-border/70 bg-background">
            <div className="space-y-3 p-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: REPORT_MONO_FAMILY }}>Filter</p>
                <p className="text-sm font-medium">Parameter laporan layanan</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Periode Awal</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Periode Akhir</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-none border-border/70" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Cara Bayar</label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-10 rounded-none border-border/70 text-sm">
                    <SelectValue placeholder="Pilih cara bayar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="bpjs">BPJS</SelectItem>
                    <SelectItem value="cash">Umum/Cash</SelectItem>
                    <SelectItem value="insurance">Asuransi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Dokter</label>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="h-10 rounded-none border-border/70 text-sm">
                    <SelectValue placeholder="Pilih dokter" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Semua Dokter</SelectItem>
                    <SelectItem value="surgeon">Dokter Bedah</SelectItem>
                    <SelectItem value="operator">Dokter Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Tindakan</label>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="h-10 rounded-none border-border/70 text-sm">
                    <SelectValue placeholder="Pilih tindakan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Semua Tindakan</SelectItem>
                    <SelectItem value="medical">Tindakan Langsung</SelectItem>
                    <SelectItem value="surgery">Operasi</SelectItem>
                    <SelectItem value="lab-rad">Lab/Radiologi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Ruangan</label>
                <Select value={roomFilter} onValueChange={setRoomFilter}>
                  <SelectTrigger className="h-10 rounded-none border-border/70 text-sm">
                    <SelectValue placeholder="Pilih ruangan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all">Semua Ruangan</SelectItem>
                    <SelectItem value="ok">Kamar Operasi</SelectItem>
                    <SelectItem value="poli">Poli</SelectItem>
                    <SelectItem value="penunjang">Penunjang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 border-t border-border/70">
              <Button variant="ghost" className="h-11 rounded-none border-r border-border/70 text-xs" onClick={fetchData}>HTML</Button>
              <Button variant="ghost" className="h-11 rounded-none border-r border-border/70 text-xs">WORD</Button>
              <Button variant="ghost" className="h-11 rounded-none border-r border-border/70 text-xs" onClick={exportExcel}>EXCEL</Button>
              <Button variant="ghost" className="h-11 rounded-none text-xs">PDF</Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-2">
              {reportItems.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={cn(
                    'flex min-h-[108px] items-start justify-between border px-4 py-4 text-left transition-colors',
                    tab === item.value ? 'border-foreground bg-muted/10' : 'border-border/70 bg-background hover:bg-muted/10',
                  )}
                >
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 items-center justify-center border border-border/70 bg-muted/20 text-[10px] font-semibold">
                      R
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold leading-6">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.note}</p>
                      <p className="text-sm text-muted-foreground">keterangan:</p>
                    </div>
                  </div>
                  <Download className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <ReportPanel eyebrow="Data" title={activeReport?.label || 'Preview'}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-none">{activeReport?.label || '-'}</Badge>
              <Badge variant="outline" className="rounded-none">{startDate} s/d {endDate}</Badge>
            </div>

            {tab === 'per-patient' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="nama_pasien" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} hide />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="selesai" fill="#0f766e" name="Selesai" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable columns={[
                  { key: 'no_rm', label: 'No RM', width: '0.8fr' },
                  { key: 'nama_pasien', label: 'Pasien', width: '1.5fr', wrap: true },
                  { key: 'jenis_kelamin', label: 'JK', width: '0.7fr' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber, width: '0.7fr' },
                  { key: 'selesai', label: 'Selesai', align: 'right', format: formatNumber, width: '0.7fr' },
                  { key: 'terakhir', label: 'Terakhir', width: '0.9fr' },
                ]} data={data} />
              </div>
            )}

            {tab === 'summary' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="selesai" fill="#0f766e" name="Selesai" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable columns={[
                  { key: 'tanggal', label: 'Tanggal' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                  { key: 'selesai', label: 'Selesai', align: 'right', format: formatNumber },
                  { key: 'pasien_unik', label: 'Pasien', align: 'right', format: formatNumber },
                ]} data={data} />
              </div>
            )}

            {tab === 'by-payment' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={82} dataKey="jumlah" nameKey="payment_method" label={{ fontSize: 11 }}>
                      {data.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <DataTable columns={[
                  { key: 'payment_method', label: 'Cara Bayar' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                  { key: 'persentase', label: '%', align: 'right', format: formatPercent },
                ]} data={data} />
              </div>
            )}

            {tab === 'by-class' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="kelas" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable columns={[
                  { key: 'kelas', label: 'Kelas' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                  { key: 'persentase', label: '%', align: 'right', format: formatPercent },
                ]} data={data} />
              </div>
            )}

            {tab === 'surgery-patients' && (
              <DataTable columns={[
                { key: 'no_rm', label: 'No RM', width: '0.8fr' },
                { key: 'nama_pasien', label: 'Pasien', width: '1.2fr', wrap: true },
                { key: 'tindakan', label: 'Tindakan', width: '1.3fr', wrap: true },
                { key: 'dokter_bedah', label: 'Dokter', width: '1.2fr', wrap: true },
                { key: 'ruangan', label: 'Ruangan', width: '1fr' },
                { key: 'jadwal', label: 'Jadwal', width: '0.9fr' },
                { key: 'status', label: 'Status', width: '0.8fr' },
              ]} data={data} />
            )}

            {tab === 'surgery-schedule' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="total" fill="#1d4ed8" name="Total" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="selesai" fill="#0f766e" name="Selesai" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="batal" fill="#dc2626" name="Batal" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable columns={[
                  { key: 'tanggal', label: 'Tanggal' },
                  { key: 'ruangan', label: 'Ruangan', wrap: true },
                  { key: 'total', label: 'Total', align: 'right', format: formatNumber },
                  { key: 'pending', label: 'Pending', align: 'right', format: formatNumber },
                  { key: 'selesai', label: 'Selesai', align: 'right', format: formatNumber },
                  { key: 'batal', label: 'Batal', align: 'right', format: formatNumber },
                ]} data={data} />
              </div>
            )}
          </ReportPanel>
        </div>
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category H: Inventaris
// Backend JSON keys from reports_inventory.go:
//   medicineStock: nama_depo, kode_obat, nama_obat, satuan, stok_saat_ini, stok_min, stok_max, harga_satuan, nilai_stok, status
//   expiredMedicines: kode_obat, nama_obat, no_batch, tgl_kadaluarsa, sisa, nama_depo
//   stock: nama_ruangan, kode_barang, nama_barang, kategori, stok_saat_ini, kondisi
//   mutations: tanggal, kode_obat, nama_obat, tipe, jumlah, keterangan, nama_depo
// ============================================================
export function ReportInventoryPage() {
  const [tab, setTab] = useState('medicine-stock');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Inventaris & Stok'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'medicine-stock': res = await reportInventoryApi.medicineStock(); break;
        case 'expired-medicines': res = await reportInventoryApi.expiredMedicines(); break;
        case 'stock': res = await reportInventoryApi.stock(); break;
        case 'mutations': res = await reportInventoryApi.mutations(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportInventoryApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: 'medicine-stock', label: 'Stok Obat' },
    { value: 'expired-medicines', label: 'Kadaluarsa' },
    { value: 'stock', label: 'Stok Inventaris' },
    { value: 'mutations', label: 'Mutasi Stok' },
  ];

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<Boxes className="h-5 w-5" />} title="Laporan Inventaris & Stok">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <InlineNav items={navItems} value={tab} onChange={setTab} />

        <div className="pt-2">
          {tab === 'medicine-stock' && (
            <ReportPanel eyebrow="Data" title="Stok Obat">
              <DataTable columns={[
                { key: 'nama_depo', label: 'Depo' },
                { key: 'kode_obat', label: 'Kode Obat' },
                { key: 'nama_obat', label: 'Nama Obat', width: '1.4fr' },
                { key: 'satuan', label: 'Satuan' },
                { key: 'stok_saat_ini', label: 'Stok', align: 'right', format: formatNumber },
                { key: 'stok_min', label: 'Min', align: 'right', format: formatNumber },
                { key: 'stok_max', label: 'Max', align: 'right', format: formatNumber },
                { key: 'harga_satuan', label: 'Harga', align: 'right', format: formatCurrency, width: '1.1fr' },
                { key: 'nilai_stok', label: 'Nilai', align: 'right', format: formatCurrency, width: '1.1fr' },
                { key: 'status', label: 'Status' },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'expired-medicines' && (
            <ReportPanel eyebrow="Data" title="Obat Kadaluarsa">
              <DataTable columns={[
                { key: 'kode_obat', label: 'Kode Obat' },
                { key: 'nama_obat', label: 'Nama Obat', width: '1.4fr' },
                { key: 'no_batch', label: 'Batch' },
                { key: 'tgl_kadaluarsa', label: 'Kadaluarsa' },
                { key: 'sisa', label: 'Sisa', align: 'right', format: formatNumber },
                { key: 'nama_depo', label: 'Depo' },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'stock' && (
            <ReportPanel eyebrow="Data" title="Stok Inventaris">
              <DataTable columns={[
                { key: 'nama_ruangan', label: 'Ruangan' },
                { key: 'kode_barang', label: 'Kode Barang' },
                { key: 'nama_barang', label: 'Nama Barang', width: '1.5fr' },
                { key: 'kategori', label: 'Kategori' },
                { key: 'stok_saat_ini', label: 'Stok', align: 'right', format: formatNumber },
                { key: 'kondisi', label: 'Kondisi' },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'mutations' && (
            <ReportPanel eyebrow="Data" title="Mutasi Stok">
              <DataTable columns={[
                { key: 'tanggal', label: 'Tanggal' },
                { key: 'kode_obat', label: 'Kode Obat' },
                { key: 'nama_obat', label: 'Obat', width: '1.3fr' },
                { key: 'tipe', label: 'Tipe' },
                { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                { key: 'nama_depo', label: 'Depo' },
                { key: 'keterangan', label: 'Keterangan', width: '1.5fr' },
              ]} data={data} />
            </ReportPanel>
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category H: SDM
// Backend JSON keys from reports_hr.go:
//   summary: tipe_karyawan, status_kepegawaian, jumlah, laki, perempuan
//   doctors: nama_lengkap, spesialisasi, no_str, masa_berlaku_str, no_sip, masa_berlaku_sip, status_kepegawaian, status_str
//   licenseExpiry: nama_lengkap, tipe_karyawan, spesialisasi, jenis_surat, nomor_surat, tgl_berlaku, sisa_hari, status
//   doctorWorkload: nama_dokter, spesialisasi, jumlah_pasien, rawat_jalan, rawat_inap, avg_per_hari
// ============================================================
export function ReportHRPage() {
  const [tab, setTab] = useState('summary');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan SDM'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'summary': res = await reportHrApi.summary(); break;
        case 'doctors': res = await reportHrApi.doctors(); break;
        case 'by-specialization': res = await reportHrApi.doctors(); break;
        case 'license-expiry': res = await reportHrApi.licenseExpiry(); break;
        case 'doctor-workload': res = await reportHrApi.doctorWorkload(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportHrApi.exportExcel(tab === 'by-specialization' ? 'doctors' : tab, startDate, endDate);

  const navItems = [
    { value: 'summary', label: 'Rekap' },
    { value: 'doctors', label: 'Daftar Dokter' },
    { value: 'by-specialization', label: 'Spesialisasi' },
    { value: 'license-expiry', label: 'STR/SIP' },
    { value: 'doctor-workload', label: 'Beban Kerja' },
  ];
  const specializationRows = aggregateByKey(data, 'spesialisasi', [], 'spesialisasi').map((row) => ({
    spesialisasi: row.spesialisasi,
    jumlah_dokter: data.filter((item: any) => String(item?.spesialisasi ?? '-') === String(row.spesialisasi)).length,
  }));

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<UserCheck className="h-5 w-5" />} title="Laporan SDM">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <InlineNav items={navItems} value={tab} onChange={setTab} />

        <div className="pt-2">
          {tab === 'summary' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Trend" title="Komposisi Pegawai">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="tipe_karyawan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="laki" fill="#1d4ed8" name="Laki-laki" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="perempuan" fill="#db2777" name="Perempuan" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="Rekap Pegawai">
                <DataTable columns={[
                  { key: 'tipe_karyawan', label: 'Tipe' },
                  { key: 'status_kepegawaian', label: 'Status' },
                  { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                  { key: 'laki', label: 'L', align: 'right', format: formatNumber },
                  { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
                ]} data={data} />
              </ReportPanel>
            </div>
          )}

          {tab === 'doctors' && (
            <ReportPanel eyebrow="Data" title="Daftar Dokter">
              <DataTable columns={[
                { key: 'nama_lengkap', label: 'Nama', width: '1.3fr' },
                { key: 'spesialisasi', label: 'Spesialisasi' },
                { key: 'no_str', label: 'No STR' },
                { key: 'masa_berlaku_str', label: 'Berlaku STR' },
                { key: 'no_sip', label: 'No SIP' },
                { key: 'masa_berlaku_sip', label: 'Berlaku SIP' },
                { key: 'status_kepegawaian', label: 'Status Pegawai' },
                { key: 'status_str', label: 'Status STR' },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'by-specialization' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Chart" title="Sebaran Spesialisasi">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={specializationRows}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="spesialisasi" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="jumlah_dokter" fill="#1d4ed8" name="Dokter" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="Spesialisasi">
                <DataTable columns={[
                  { key: 'spesialisasi', label: 'Spesialisasi' },
                  { key: 'jumlah_dokter', label: 'Jumlah Dokter', align: 'right', format: formatNumber },
                ]} data={specializationRows} />
              </ReportPanel>
            </div>
          )}

          {tab === 'license-expiry' && (
            <ReportPanel eyebrow="Data" title="Masa Berlaku STR / SIP">
              <DataTable columns={[
                { key: 'nama_lengkap', label: 'Nama', width: '1.3fr' },
                { key: 'tipe_karyawan', label: 'Tipe' },
                { key: 'spesialisasi', label: 'Spesialisasi' },
                { key: 'jenis_surat', label: 'Jenis' },
                { key: 'nomor_surat', label: 'Nomor' },
                { key: 'tgl_berlaku', label: 'Berlaku s/d' },
                { key: 'sisa_hari', label: 'Sisa Hari', align: 'right', format: formatNumber },
                { key: 'status', label: 'Status' },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'doctor-workload' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Trend" title="Beban Kerja Dokter">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.slice(0, 15)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nama_dokter" type="category" width={150} tick={{ fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="rawat_jalan" fill="#3b82f6" name="Rajal" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rawat_inap" fill="#22c55e" name="Ranap" stackId="a" radius={[0, 2, 2, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="Beban Kerja">
                <DataTable columns={[
                  { key: 'nama_dokter', label: 'Dokter', width: '1.3fr' },
                  { key: 'spesialisasi', label: 'Spesialisasi' },
                  { key: 'jumlah_pasien', label: 'Total', align: 'right', format: formatNumber },
                  { key: 'rawat_jalan', label: 'Rajal', align: 'right', format: formatNumber },
                  { key: 'rawat_inap', label: 'Ranap', align: 'right', format: formatNumber },
                  { key: 'avg_per_hari', label: 'Avg/Hari', align: 'right', format: formatDecimal },
                ]} data={data} />
              </ReportPanel>
            </div>
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}

// ============================================================
// Category I: Kemenkes
// Backend JSON keys from reports_kemenkes.go:
//   qualityIndicators: indikator, nilai, standar, status
//   rl12Beds: ruang_perawatan, kelas, total_bed, bed_terisi, bed_kosong, persentase
//   rl31/rl32: ranking, icd10_code, icd10_name, jumlah, laki_laki, perempuan, baru_laki, baru_wanita, lama_laki, lama_wanita
//   rl4a: bulan, rawat_jalan, rawat_inap, igd, total_pasien, pasien_baru, pasien_lama
//   rl51: tipe_karyawan, pns, kontrak, honorer, magang, lainnya, total
// ============================================================
export function ReportKemenkesPage() {
  const [tab, setTab] = useState('quality-indicators');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { setPageTitle('Laporan Kemenkes / RL'); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'quality-indicators': res = await reportKemenkesApi.qualityIndicators(startDate, endDate); break;
        case 'rl12-beds': res = await reportKemenkesApi.rl12Beds(); break;
        case 'bed-summary': res = await reportKemenkesApi.rl12Beds(); break;
        case 'rl31-outpatient': res = await reportKemenkesApi.rl31OutpatientDiseases(startDate, endDate); break;
        case 'rl32-inpatient': res = await reportKemenkesApi.rl32InpatientDiseases(startDate, endDate); break;
        case 'rl4a-visits': res = await reportKemenkesApi.rl4aVisits(startDate, endDate); break;
        case 'rl51-workforce': res = await reportKemenkesApi.rl51Workforce(); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => {
    const endpointMap: Record<string, string> = {
      'quality-indicators': 'quality-indicators',
      'rl12-beds': 'rl12-beds',
      'bed-summary': 'rl12-beds',
      'rl31-outpatient': 'rl31-top-diseases-outpatient',
      'rl32-inpatient': 'rl32-top-diseases-inpatient',
      'rl4a-visits': 'rl4a-visits',
      'rl51-workforce': 'rl51-workforce',
    };
    reportKemenkesApi.exportExcel(endpointMap[tab], startDate, endDate);
  };

  const navItems = [
    { value: 'quality-indicators', label: 'Indikator Mutu' },
    { value: 'rl12-beds', label: 'RL 1.2 TT' },
    { value: 'bed-summary', label: 'Ringkas TT' },
    { value: 'rl31-outpatient', label: 'RL 3.1 Rajal' },
    { value: 'rl32-inpatient', label: 'RL 3.2 Ranap' },
    { value: 'rl4a-visits', label: 'RL 4A Kunjungan' },
    { value: 'rl51-workforce', label: 'RL 5.1 Ketenagaan' },
  ];
  const bedSummaryRows = aggregateByKey(data, 'kelas', ['total_bed', 'bed_terisi', 'bed_kosong'], 'kelas').map((row) => ({
    kelas: row.kelas,
    total_bed: Number(row.total_bed ?? 0),
    bed_terisi: Number(row.bed_terisi ?? 0),
    bed_kosong: Number(row.bed_kosong ?? 0),
    persentase: Number(row.total_bed ?? 0) > 0 ? (Number(row.bed_terisi ?? 0) / Number(row.total_bed ?? 0)) * 100 : 0,
  }));

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
        <PageHeader icon={<Landmark className="h-5 w-5" />} title="Laporan Kemenkes / RL">
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
        </PageHeader>
        <InlineNav items={navItems} value={tab} onChange={setTab} />

        <div className="pt-2">
          {tab === 'quality-indicators' && (
            <div className="grid gap-px bg-border/70 md:grid-cols-2 lg:grid-cols-3">
              {data.map((row: { indikator: string; nilai: string; standar: string; status: string }, i: number) => (
                <KPICard
                  key={i}
                  label={row.indikator}
                  value={String(row.nilai)}
                  subtitle={`Standar: ${row.standar}`}
                  status={row.status === 'Ideal' ? 'good' : 'bad'}
                />
              ))}
              {data.length === 0 && !loading && <p className="text-muted-foreground text-center py-8 col-span-full">Tidak ada data untuk periode ini.</p>}
            </div>
          )}

          {tab === 'rl12-beds' && (
            <ReportPanel eyebrow="Data" title="RL 1.2 Tempat Tidur">
              <DataTable columns={[
                { key: 'ruang_perawatan', label: 'Ruang', width: '1.3fr' },
                { key: 'kelas', label: 'Kelas' },
                { key: 'total_bed', label: 'Total TT', align: 'right', format: formatNumber },
                { key: 'bed_terisi', label: 'Terisi', align: 'right', format: formatNumber },
                { key: 'bed_kosong', label: 'Kosong', align: 'right', format: formatNumber },
                { key: 'persentase', label: '% Terisi', align: 'right', format: formatPercent },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'bed-summary' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Chart" title="Ringkasan Tempat Tidur">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={bedSummaryRows}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="kelas" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="bed_terisi" fill="#0f766e" name="Terisi" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="bed_kosong" fill="#dc2626" name="Kosong" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="Ringkas Tempat Tidur">
                <DataTable columns={[
                  { key: 'kelas', label: 'Kelas' },
                  { key: 'total_bed', label: 'Total TT', align: 'right', format: formatNumber },
                  { key: 'bed_terisi', label: 'Terisi', align: 'right', format: formatNumber },
                  { key: 'bed_kosong', label: 'Kosong', align: 'right', format: formatNumber },
                  { key: 'persentase', label: '% Terisi', align: 'right', format: formatPercent },
                ]} data={bedSummaryRows} />
              </ReportPanel>
            </div>
          )}

          {tab === 'rl31-outpatient' && (
            <ReportPanel eyebrow="Data" title="RL 3.1 Rajal">
              <DataTable columns={[
                { key: 'ranking', label: '#', align: 'right' },
                { key: 'icd10_code', label: 'Kode ICD-10' },
                { key: 'icd10_name', label: 'Penyakit', width: '1.5fr' },
                { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                { key: 'laki_laki', label: 'L', align: 'right', format: formatNumber },
                { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
                { key: 'baru_laki', label: 'Baru L', align: 'right', format: formatNumber },
                { key: 'baru_wanita', label: 'Baru P', align: 'right', format: formatNumber },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'rl32-inpatient' && (
            <ReportPanel eyebrow="Data" title="RL 3.2 Ranap">
              <DataTable columns={[
                { key: 'ranking', label: '#', align: 'right' },
                { key: 'icd10_code', label: 'Kode ICD-10' },
                { key: 'icd10_name', label: 'Penyakit', width: '1.5fr' },
                { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
                { key: 'laki_laki', label: 'L', align: 'right', format: formatNumber },
                { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
                { key: 'baru_laki', label: 'Baru L', align: 'right', format: formatNumber },
                { key: 'baru_wanita', label: 'Baru P', align: 'right', format: formatNumber },
                { key: 'lama_laki', label: 'Lama L', align: 'right', format: formatNumber },
                { key: 'lama_wanita', label: 'Lama P', align: 'right', format: formatNumber },
              ]} data={data} />
            </ReportPanel>
          )}

          {tab === 'rl4a-visits' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Trend" title="RL 4A Kunjungan">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="rawat_jalan" fill="#1d4ed8" name="Rawat Jalan" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rawat_inap" fill="#0f766e" name="Rawat Inap" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="igd" fill="#dc2626" name="IGD" radius={[0, 0, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="RL 4A Kunjungan">
                <DataTable columns={[
                  { key: 'bulan', label: 'Bulan' },
                  { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
                  { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
                  { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
                  { key: 'total_pasien', label: 'Total', align: 'right', format: formatNumber },
                  { key: 'pasien_baru', label: 'Baru', align: 'right', format: formatNumber },
                  { key: 'pasien_lama', label: 'Lama', align: 'right', format: formatNumber },
                ]} data={data} />
              </ReportPanel>
            </div>
          )}

          {tab === 'rl51-workforce' && (
            <div className="space-y-4">
              <ReportPanel eyebrow="Trend" title="RL 5.1 Ketenagaan">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="tipe_karyawan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="pns" fill="#3b82f6" name="PNS" stackId="a" />
                    <Bar dataKey="kontrak" fill="#22c55e" name="Kontrak" stackId="a" />
                    <Bar dataKey="honorer" fill="#f59e0b" name="Honorer" stackId="a" />
                    <Bar dataKey="magang" fill="#8b5cf6" name="Magang" stackId="a" />
                    <Bar dataKey="lainnya" fill="#ec4899" name="Lainnya" stackId="a" />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ReportPanel>
              <ReportPanel eyebrow="Data" title="RL 5.1 Ketenagaan">
                <DataTable columns={[
                  { key: 'tipe_karyawan', label: 'Tipe' },
                  { key: 'pns', label: 'PNS', align: 'right', format: formatNumber },
                  { key: 'kontrak', label: 'Kontrak', align: 'right', format: formatNumber },
                  { key: 'honorer', label: 'Honorer', align: 'right', format: formatNumber },
                  { key: 'magang', label: 'Magang', align: 'right', format: formatNumber },
                  { key: 'lainnya', label: 'Lainnya', align: 'right', format: formatNumber },
                  { key: 'total', label: 'Total', align: 'right', format: formatNumber },
                ]} data={data} />
              </ReportPanel>
            </div>
          )}
        </div>
      </PageContent>
    </PageShell>
  );
}
