import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { setPageTitle } from '@/lib/page-title';
import {
  reportVisitsApi, reportBpjsApi, reportBillingApi, reportInpatientApi,
  reportPharmacyApi, reportPenunjangApi, reportInventoryApi, reportHrApi, reportKemenkesApi
} from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  Loader2, Download, BarChart3, TrendingUp, Building2, DollarSign,
  HeartPulse, Pill, FlaskConical, Boxes, UserCheck, Landmark, Calendar,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

// ============================================================
// Reusable Inline Nav
// ============================================================
function InlineNav({ items, value, onChange }: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {items.map(item => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
            value === item.value
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
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
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className="w-[140px] h-8 text-xs rounded-none" />
      <span className="text-muted-foreground text-xs">s/d</span>
      <Input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} className="w-[140px] h-8 text-xs rounded-none" />
      <Button onClick={onApply} disabled={loading} size="sm" className="h-8 rounded-none text-xs">
        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        Tampilkan
      </Button>
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="h-8 rounded-none text-xs">
          <Download className="h-3 w-3 mr-1" /> Excel
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
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
      <h1 className="text-lg font-semibold flex items-center gap-2">
        {icon} {title}
      </h1>
      {children}
    </div>
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
function DataTable({ columns, data }: { columns: { key: string; label: string; format?: (v: any) => string; align?: string }[]; data: any[] }) {
  if (!data || data.length === 0) return <p className="text-muted-foreground text-center py-8">Tidak ada data untuk periode ini.</p>;
  return (
    <div className="border border-border overflow-auto max-h-[600px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map(col => (
              <TableHead key={col.key} className={cn('text-xs font-semibold uppercase tracking-wider', col.align === 'right' && 'text-right')}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i} className="hover:bg-muted/30">
              {columns.map(col => (
                <TableCell key={col.key} className={cn('text-sm', col.align === 'right' && 'text-right')}>
                  {col.format ? col.format(row[col.key]) : (row[col.key] != null ? String(row[col.key]) : '-')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// KPI Card for indicators
// ============================================================
function KPICard({ label, value, subtitle, status }: { label: string; value: string; subtitle?: string; status?: 'good' | 'warning' | 'bad' }) {
  return (
    <div className="border border-border p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
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

// ============================================================
// Report Index Page (Dashboard with category cards)
// ============================================================

interface ReportCategory {
  path: string;
  title: string;
  description: string;
  icon: ReactNode;
  count: number;
}

const categories: ReportCategory[] = [
  { path: '/reports/visits', title: 'Kunjungan & Pasien', description: 'Kunjungan harian, per poli, per dokter, demografi, diagnosa terbanyak, wilayah pasien', icon: <TrendingUp className="h-5 w-5" />, count: 9 },
  { path: '/reports/bpjs', title: 'BPJS', description: 'Kunjungan BPJS, SEP, Surat Kontrol, Antrean Mobile JKN, E-Klaim', icon: <Building2 className="h-5 w-5" />, count: 6 },
  { path: '/reports/billing', title: 'Keuangan', description: 'Pendapatan harian, per metode bayar, per ruangan, per dokter, piutang', icon: <DollarSign className="h-5 w-5" />, count: 6 },
  { path: '/reports/inpatient', title: 'Rawat Inap', description: 'Indikator BOR/ALOS/BTO/TOI, sensus harian, daftar pasien dirawat', icon: <HeartPulse className="h-5 w-5" />, count: 4 },
  { path: '/reports/pharmacy', title: 'Farmasi', description: 'Resep harian, obat terbanyak, per dokter, per depo, waktu tunggu', icon: <Pill className="h-5 w-5" />, count: 5 },
  { path: '/reports/penunjang', title: 'Penunjang', description: 'Order lab/radiologi, pemeriksaan terbanyak, hasil kritis, TAT', icon: <FlaskConical className="h-5 w-5" />, count: 5 },
  { path: '/reports/inventory', title: 'Inventaris & Stok', description: 'Stok obat, obat kadaluarsa, stok inventaris, mutasi stok', icon: <Boxes className="h-5 w-5" />, count: 4 },
  { path: '/reports/hr', title: 'SDM', description: 'Rekap pegawai, daftar dokter, STR/SIP expiry, beban kerja dokter', icon: <UserCheck className="h-5 w-5" />, count: 4 },
  { path: '/reports/kemenkes', title: 'Kemenkes / RL', description: 'RL 1.2 TT, RL 3 penyakit terbesar, RL 4A kunjungan, RL 5.1 ketenagaan, indikator mutu', icon: <Landmark className="h-5 w-5" />, count: 6 },
];

export default function ReportIndexPage() {
  useEffect(() => { setPageTitle('Laporan'); }, []);
  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Sistem Laporan SIMRS</h1>
        <p className="text-sm text-muted-foreground mt-1">Pilih kategori laporan yang ingin ditampilkan. Semua laporan mendukung ekspor Excel.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
        {categories.map(cat => (
          <Link to={cat.path} key={cat.path} className="group">
            <div className="border border-border p-4 hover:bg-muted/40 transition-colors h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-primary">{cat.icon}</div>
                  <span className="font-medium text-sm">{cat.title}</span>
                  <Badge variant="secondary" className="ml-auto rounded-none text-[10px]">{cat.count} Laporan</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Buka laporan <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
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
  const exportExcel = () => reportVisitsApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: 'daily', label: 'Harian' },
    { value: 'by-room', label: 'Per Poli' },
    { value: 'by-doctor', label: 'Per Dokter' },
    { value: 'demographics', label: 'Demografi' },
    { value: 'regions', label: 'Wilayah' },
    { value: 'top-diagnoses', label: 'Diagnosa' },
    { value: 'new-vs-old', label: 'Baru vs Lama' },
    { value: 'payment-methods', label: 'Cara Bayar' },
    { value: 'referrals', label: 'Rujukan' },
  ];

  // Demographics data is grouped: {kategori, nilai, jumlah}[]
  // Groups: "Jenis Kelamin", "Kelompok Umur", "Metode Pembayaran"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsGender = data.filter((r: any) => r.kategori === 'Jenis Kelamin').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsAge = data.filter((r: any) => r.kategori === 'Kelompok Umur').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demographicsPayment = data.filter((r: any) => r.kategori === 'Metode Pembayaran').map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<TrendingUp className="h-5 w-5" />} title="Laporan Kunjungan & Pasien">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'daily' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="rawat_jalan" fill="#3b82f6" name="Rawat Jalan" radius={[2,2,0,0]} />
                  <Bar dataKey="rawat_inap" fill="#22c55e" name="Rawat Inap" radius={[2,2,0,0]} />
                  <Bar dataKey="igd" fill="#ef4444" name="IGD" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tanggal', label: 'Tanggal' },
              { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
              { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
              { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
              { key: 'total', label: 'Total', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'by-room' && (
          <DataTable columns={[
            { key: 'kode_ruangan', label: 'Kode' },
            { key: 'nama_ruangan', label: 'Poli/Ruangan' },
            { key: 'service_type', label: 'Tipe Layanan' },
            { key: 'jumlah', label: 'Total', align: 'right', format: formatNumber },
            { key: 'laki', label: 'L', align: 'right', format: formatNumber },
            { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
            { key: 'baru', label: 'Baru', align: 'right', format: formatNumber },
            { key: 'lama', label: 'Lama', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'by-doctor' && (
          <DataTable columns={[
            { key: 'nama_dokter', label: 'Dokter' },
            { key: 'spesialisasi', label: 'Spesialisasi' },
            { key: 'jumlah', label: 'Total', align: 'right', format: formatNumber },
            { key: 'rawat_jalan', label: 'Rajal', align: 'right', format: formatNumber },
            { key: 'rawat_inap', label: 'Ranap', align: 'right', format: formatNumber },
            { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'demographics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-none border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">Jenis Kelamin</CardTitle></CardHeader><CardContent>
                {demographicsGender.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={demographicsGender} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={{ fontSize: 11 }}>
                      {demographicsGender.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
              </CardContent></Card>
              <Card className="rounded-none border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">Kelompok Umur</CardTitle></CardHeader><CardContent>
                {demographicsAge.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demographicsAge}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="value" fill="#3b82f6" name="Jumlah" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
              </CardContent></Card>
              <Card className="rounded-none border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">Metode Pembayaran</CardTitle></CardHeader><CardContent>
                {demographicsPayment.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={demographicsPayment} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={{ fontSize: 11 }}>
                      {demographicsPayment.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>}
              </CardContent></Card>
            </div>
            <DataTable columns={[
              { key: 'kategori', label: 'Kategori' },
              { key: 'nilai', label: 'Nilai' },
              { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'regions' && (
          <DataTable columns={[
            { key: 'provinsi', label: 'Provinsi' },
            { key: 'kabupaten', label: 'Kabupaten' },
            { key: 'kecamatan', label: 'Kecamatan' },
            { key: 'jumlah', label: 'Jumlah Pasien', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'top-diagnoses' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="kode_icd10" type="category" width={80} tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="jumlah" fill="#3b82f6" name="Jumlah" radius={[0,2,2,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'kode_icd10', label: 'Kode ICD-10' },
              { key: 'nama', label: 'Nama Penyakit' },
              { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
              { key: 'laki', label: 'L', align: 'right', format: formatNumber },
              { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'new-vs-old' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="pasien_baru" stroke="#3b82f6" name="Baru" strokeWidth={2} />
                  <Line type="monotone" dataKey="pasien_lama" stroke="#22c55e" name="Lama" strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tanggal', label: 'Tanggal' },
              { key: 'pasien_baru', label: 'Pasien Baru', align: 'right', format: formatNumber },
              { key: 'pasien_lama', label: 'Pasien Lama', align: 'right', format: formatNumber },
              { key: 'total', label: 'Total', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'payment-methods' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="jumlah" nameKey="metode_bayar" label={{ fontSize: 11 }}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'metode_bayar', label: 'Cara Bayar' },
              { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
              { key: 'persentase', label: '%', align: 'right', format: formatPercent },
            ]} data={data} />
          </div>
        )}

        {tab === 'referrals' && (
          <DataTable columns={[
            { key: 'asal_rujukan', label: 'Asal Rujukan' },
            { key: 'nama_rujukan', label: 'Nama Perujuk' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
          ]} data={data} />
        )}
      </div>
    </div>
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

  const navItems = [
    { value: 'daily', label: 'Harian' },
    { value: 'sep', label: 'SEP' },
    { value: 'surat-kontrol', label: 'Surat Kontrol' },
    { value: 'antrean', label: 'Antrean' },
    { value: 'eklaim', label: 'E-Klaim' },
    { value: 'by-poli', label: 'Per Poli' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<Building2 className="h-5 w-5" />} title="Laporan BPJS">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'daily' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="rawat_jalan" fill="#3b82f6" name="Rajal" radius={[2,2,0,0]} />
                  <Bar dataKey="rawat_inap" fill="#22c55e" name="Ranap" radius={[2,2,0,0]} />
                  <Bar dataKey="igd" fill="#ef4444" name="IGD" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tanggal', label: 'Tanggal' },
              { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
              { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
              { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
              { key: 'total', label: 'Total', align: 'right', format: formatNumber },
            ]} data={rows} />
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
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total_booking" fill="#3b82f6" name="Booking" radius={[2,2,0,0]} />
                  <Bar dataKey="checkin" fill="#22c55e" name="Check-in" radius={[2,2,0,0]} />
                  <Bar dataKey="dilayani" fill="#f59e0b" name="Dilayani" radius={[2,2,0,0]} />
                  <Bar dataKey="selesai" fill="#8b5cf6" name="Selesai" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
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
      </div>
    </div>
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
        case 'by-item-type': res = await reportBillingApi.byItemType(startDate, endDate); break;
      }
      setData(res?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportBillingApi.exportExcel(tab, startDate, endDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const summary = data?.summary || null;

  const navItems = [
    { value: 'daily-revenue', label: 'Harian' },
    { value: 'by-payment', label: 'Cara Bayar' },
    { value: 'by-room', label: 'Per Ruangan' },
    { value: 'by-doctor', label: 'Per Dokter' },
    { value: 'receivables', label: 'Piutang' },
    { value: 'by-item-type', label: 'Per Tipe Item' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<DollarSign className="h-5 w-5" />} title="Laporan Keuangan">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'daily-revenue' && (
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                <KPICard label="Total Tagihan" value={formatCurrency(summary.total_tagihan)} />
                <KPICard label="Total Dibayar" value={formatCurrency(summary.total_bayar)} />
                <KPICard label="Total Piutang" value={formatCurrency(summary.total_piutang)} />
                <KPICard label="Jumlah Billing" value={formatNumber(summary.total_billing)} />
              </div>
            )}
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total_tagihan" fill="#3b82f6" name="Tagihan" radius={[2,2,0,0]} />
                  <Bar dataKey="total_bayar" fill="#22c55e" name="Dibayar" radius={[2,2,0,0]} />
                  <Bar dataKey="total_piutang" fill="#ef4444" name="Piutang" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tanggal', label: 'Tanggal' },
              { key: 'total_tagihan', label: 'Total Tagihan', align: 'right', format: formatCurrency },
              { key: 'total_bayar', label: 'Dibayar', align: 'right', format: formatCurrency },
              { key: 'total_piutang', label: 'Piutang', align: 'right', format: formatCurrency },
              { key: 'jumlah_billing', label: 'Jumlah Billing', align: 'right', format: formatNumber },
            ]} data={rows} />
          </div>
        )}

        {tab === 'by-payment' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={rows} cx="50%" cy="50%" outerRadius={80} dataKey="total_tagihan" nameKey="metode_bayar" label={{ fontSize: 11 }}>
                  {rows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'metode_bayar', label: 'Cara Bayar' },
              { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
              { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
              { key: 'total_bayar', label: 'Dibayar', align: 'right', format: formatCurrency },
            ]} data={rows} />
          </div>
        )}

        {tab === 'by-room' && (
          <DataTable columns={[
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'service_type', label: 'Tipe Layanan' },
            { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
            { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
            { key: 'total_bayar', label: 'Dibayar', align: 'right', format: formatCurrency },
          ]} data={rows} />
        )}

        {tab === 'by-doctor' && (
          <DataTable columns={[
            { key: 'nama_dokter', label: 'Dokter' },
            { key: 'spesialisasi', label: 'Spesialisasi' },
            { key: 'jumlah', label: 'Transaksi', align: 'right', format: formatNumber },
            { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
            { key: 'total_bayar', label: 'Dibayar', align: 'right', format: formatCurrency },
          ]} data={rows} />
        )}

        {tab === 'receivables' && (
          <DataTable columns={[
            { key: 'billing_number', label: 'No Billing' },
            { key: 'nama_pasien', label: 'Pasien' },
            { key: 'no_rm', label: 'No RM' },
            { key: 'metode_bayar', label: 'Cara Bayar' },
            { key: 'total_tagihan', label: 'Tagihan', align: 'right', format: formatCurrency },
            { key: 'total_bayar', label: 'Dibayar', align: 'right', format: formatCurrency },
            { key: 'sisa_piutang', label: 'Sisa Piutang', align: 'right', format: formatCurrency },
            { key: 'tgl_billing', label: 'Tgl Billing' },
            { key: 'status', label: 'Status' },
          ]} data={rows} />
        )}

        {tab === 'by-item-type' && (
          <DataTable columns={[
            { key: 'item_type', label: 'Tipe Item' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'total_nilai', label: 'Total Nilai', align: 'right', format: formatCurrency },
          ]} data={rows} />
        )}
      </div>
    </div>
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
        case 'by-room': res = await reportInpatientApi.byRoom(startDate, endDate); break;
      }
      setData(res?.data?.data || res?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportInpatientApi.exportExcel(tab, startDate, endDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(data) ? data : [];

  const navItems = [
    { value: 'indicators', label: 'Indikator' },
    { value: 'census', label: 'Sensus' },
    { value: 'list', label: 'Daftar Pasien' },
    { value: 'by-room', label: 'Per Ruangan' },
  ];

  // Indicators is a single object, not an array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ind: any = (tab === 'indicators' && data && !Array.isArray(data)) ? data : null;

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
    <div className="p-6 space-y-4">
      <PageHeader icon={<HeartPulse className="h-5 w-5" />} title="Laporan Rawat Inap">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'indicators' && ind && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
              <KPICard label="Total TT" value={formatNumber(ind.total_beds)} subtitle="Tempat Tidur" />
              <KPICard label="Hari Rawat" value={formatNumber(ind.occupied_days)} subtitle="Occupied Days" />
              <KPICard label="Pasien Keluar" value={formatNumber(ind.total_discharges)} subtitle="Discharges" />
              <KPICard label="Kematian" value={formatNumber(ind.total_deaths)} subtitle={`< 48 jam: ${formatNumber(ind.deaths_less_48h)}`} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0">
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
          <DataTable columns={[
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'room_class', label: 'Kelas' },
            { key: 'total_bed', label: 'Total TT', align: 'right', format: formatNumber },
            { key: 'terisi', label: 'Terisi', align: 'right', format: formatNumber },
            { key: 'kosong', label: 'Kosong', align: 'right', format: formatNumber },
            { key: 'bor', label: 'BOR (%)', align: 'right', format: formatDecimal },
          ]} data={rows} />
        )}

        {tab === 'list' && (
          <DataTable columns={[
            { key: 'no_rm', label: 'No RM' },
            { key: 'nama_pasien', label: 'Pasien' },
            { key: 'jenis_kelamin', label: 'JK' },
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'nama_bed', label: 'Bed' },
            { key: 'dokter_dpjp', label: 'DPJP' },
            { key: 'tgl_masuk', label: 'Tgl Masuk' },
            { key: 'tgl_keluar', label: 'Tgl Keluar' },
            { key: 'los', label: 'LOS', align: 'right', format: formatNumber },
            { key: 'metode_bayar', label: 'Bayar' },
            { key: 'status', label: 'Status' },
          ]} data={rows} />
        )}

        {tab === 'by-room' && (
          <DataTable columns={[
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'room_class', label: 'Kelas' },
            { key: 'jumlah_masuk', label: 'Masuk', align: 'right', format: formatNumber },
            { key: 'jumlah_keluar', label: 'Keluar', align: 'right', format: formatNumber },
            { key: 'masih_rawat', label: 'Masih Rawat', align: 'right', format: formatNumber },
            { key: 'rata_rata_los', label: 'Avg LOS', align: 'right', format: formatDecimal },
          ]} data={rows} />
        )}
      </div>
    </div>
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
        case 'top-medicines': res = await reportPharmacyApi.topMedicines(startDate, endDate); break;
        case 'by-doctor': res = await reportPharmacyApi.byDoctor(startDate, endDate); break;
        case 'by-depo': res = await reportPharmacyApi.byDepo(startDate, endDate); break;
        case 'tat': res = await reportPharmacyApi.tat(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportPharmacyApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: 'daily', label: 'Harian' },
    { value: 'top-medicines', label: 'Obat Terbanyak' },
    { value: 'by-doctor', label: 'Per Dokter' },
    { value: 'by-depo', label: 'Per Depo' },
    { value: 'tat', label: 'Waktu Tunggu' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<Pill className="h-5 w-5" />} title="Laporan Farmasi">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'daily' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="disiapkan" fill="#3b82f6" name="Disiapkan" radius={[2,2,0,0]} />
                  <Bar dataKey="diserahkan" fill="#22c55e" name="Diserahkan" radius={[2,2,0,0]} />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[2,2,0,0]} />
                  <Bar dataKey="dibatalkan" fill="#ef4444" name="Dibatalkan" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
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
          </div>
        )}

        {tab === 'top-medicines' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nama_obat" type="category" width={150} tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="jumlah_qty" fill="#3b82f6" name="Qty" radius={[0,2,2,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'kode_obat', label: 'Kode Obat' },
              { key: 'nama_obat', label: 'Nama Obat' },
              { key: 'satuan', label: 'Satuan' },
              { key: 'jumlah_qty', label: 'Total Qty', align: 'right', format: formatNumber },
              { key: 'jumlah_rx', label: 'Jumlah Resep', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'by-doctor' && (
          <DataTable columns={[
            { key: 'nama_dokter', label: 'Dokter' },
            { key: 'spesialisasi', label: 'Spesialisasi' },
            { key: 'jumlah_resep', label: 'Resep', align: 'right', format: formatNumber },
            { key: 'jumlah_item', label: 'Jumlah Item', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'by-depo' && (
          <DataTable columns={[
            { key: 'nama_depo', label: 'Depo Farmasi' },
            { key: 'jumlah_resep', label: 'Total Resep', align: 'right', format: formatNumber },
            { key: 'delivered', label: 'Diserahkan', align: 'right', format: formatNumber },
            { key: 'pending', label: 'Pending', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'tat' && (
          <DataTable columns={[
            { key: 'nama_depo', label: 'Depo' },
            { key: 'avg_tat_menit', label: 'Rata-rata (menit)', align: 'right', format: formatDecimal },
            { key: 'min_tat_menit', label: 'Min (menit)', align: 'right', format: formatDecimal },
            { key: 'max_tat_menit', label: 'Max (menit)', align: 'right', format: formatDecimal },
            { key: 'jumlah_resep', label: 'Jumlah Resep', align: 'right', format: formatNumber },
          ]} data={data} />
        )}
      </div>
    </div>
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
        case 'top-lab': res = await reportPenunjangApi.topLab(startDate, endDate); break;
        case 'top-radiology': res = await reportPenunjangApi.topRadiology(startDate, endDate); break;
        case 'critical-results': res = await reportPenunjangApi.criticalResults(startDate, endDate); break;
        case 'tat': res = await reportPenunjangApi.tat(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportPenunjangApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: 'daily', label: 'Harian' },
    { value: 'top-lab', label: 'Lab Terbanyak' },
    { value: 'top-radiology', label: 'Radiologi Terbanyak' },
    { value: 'critical-results', label: 'Hasil Kritis' },
    { value: 'tat', label: 'TAT' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<FlaskConical className="h-5 w-5" />} title="Laporan Penunjang (Lab & Radiologi)">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'daily' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="laboratorium" fill="#3b82f6" name="Laboratorium" radius={[2,2,0,0]} />
                  <Bar dataKey="radiologi" fill="#22c55e" name="Radiologi" radius={[2,2,0,0]} />
                  <Bar dataKey="operasi" fill="#ef4444" name="Operasi" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
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
          </div>
        )}

        {tab === 'top-lab' && (
          <DataTable columns={[
            { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'completed', label: 'Selesai', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'top-radiology' && (
          <DataTable columns={[
            { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'completed', label: 'Selesai', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'critical-results' && (
          <DataTable columns={[
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'nama_pasien', label: 'Pasien' },
            { key: 'nama_pemeriksaan', label: 'Pemeriksaan' },
            { key: 'hasil', label: 'Hasil' },
            { key: 'order_type', label: 'Tipe' },
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'nama_dokter', label: 'Dokter' },
          ]} data={data} />
        )}

        {tab === 'tat' && (
          <DataTable columns={[
            { key: 'order_type', label: 'Tipe Order' },
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'avg_tat_menit', label: 'Rata-rata (menit)', align: 'right', format: formatDecimal },
            { key: 'min_tat_menit', label: 'Min (menit)', align: 'right', format: formatDecimal },
            { key: 'max_tat_menit', label: 'Max (menit)', align: 'right', format: formatDecimal },
            { key: 'jumlah_order', label: 'Jumlah', align: 'right', format: formatNumber },
          ]} data={data} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Category G: Inventaris
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
    <div className="p-6 space-y-4">
      <PageHeader icon={<Boxes className="h-5 w-5" />} title="Laporan Inventaris & Stok">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'medicine-stock' && (
          <DataTable columns={[
            { key: 'nama_depo', label: 'Depo' },
            { key: 'kode_obat', label: 'Kode Obat' },
            { key: 'nama_obat', label: 'Nama Obat' },
            { key: 'satuan', label: 'Satuan' },
            { key: 'stok_saat_ini', label: 'Stok', align: 'right', format: formatNumber },
            { key: 'stok_min', label: 'Min Stok', align: 'right', format: formatNumber },
            { key: 'stok_max', label: 'Max Stok', align: 'right', format: formatNumber },
            { key: 'harga_satuan', label: 'Harga Satuan', align: 'right', format: formatCurrency },
            { key: 'nilai_stok', label: 'Nilai Stok', align: 'right', format: formatCurrency },
            { key: 'status', label: 'Status' },
          ]} data={data} />
        )}

        {tab === 'expired-medicines' && (
          <DataTable columns={[
            { key: 'kode_obat', label: 'Kode Obat' },
            { key: 'nama_obat', label: 'Nama Obat' },
            { key: 'no_batch', label: 'No Batch' },
            { key: 'tgl_kadaluarsa', label: 'Kadaluarsa' },
            { key: 'sisa', label: 'Sisa', align: 'right', format: formatNumber },
            { key: 'nama_depo', label: 'Depo' },
          ]} data={data} />
        )}

        {tab === 'stock' && (
          <DataTable columns={[
            { key: 'nama_ruangan', label: 'Ruangan' },
            { key: 'kode_barang', label: 'Kode Barang' },
            { key: 'nama_barang', label: 'Nama Barang' },
            { key: 'kategori', label: 'Kategori' },
            { key: 'stok_saat_ini', label: 'Stok', align: 'right', format: formatNumber },
            { key: 'kondisi', label: 'Kondisi' },
          ]} data={data} />
        )}

        {tab === 'mutations' && (
          <DataTable columns={[
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'kode_obat', label: 'Kode Obat' },
            { key: 'nama_obat', label: 'Obat' },
            { key: 'tipe', label: 'Tipe' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'nama_depo', label: 'Depo' },
            { key: 'keterangan', label: 'Keterangan' },
          ]} data={data} />
        )}
      </div>
    </div>
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
        case 'license-expiry': res = await reportHrApi.licenseExpiry(); break;
        case 'doctor-workload': res = await reportHrApi.doctorWorkload(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const exportExcel = () => reportHrApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: 'summary', label: 'Rekap' },
    { value: 'doctors', label: 'Daftar Dokter' },
    { value: 'license-expiry', label: 'STR/SIP' },
    { value: 'doctor-workload', label: 'Beban Kerja' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<UserCheck className="h-5 w-5" />} title="Laporan SDM">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'summary' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tipe_karyawan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="laki" fill="#3b82f6" name="Laki-laki" radius={[2,2,0,0]} />
                  <Bar dataKey="perempuan" fill="#ec4899" name="Perempuan" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tipe_karyawan', label: 'Tipe' },
              { key: 'status_kepegawaian', label: 'Status' },
              { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
              { key: 'laki', label: 'L', align: 'right', format: formatNumber },
              { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'doctors' && (
          <DataTable columns={[
            { key: 'nama_lengkap', label: 'Nama' },
            { key: 'spesialisasi', label: 'Spesialisasi' },
            { key: 'no_str', label: 'No STR' },
            { key: 'masa_berlaku_str', label: 'Berlaku STR' },
            { key: 'no_sip', label: 'No SIP' },
            { key: 'masa_berlaku_sip', label: 'Berlaku SIP' },
            { key: 'status_kepegawaian', label: 'Status Pegawai' },
            { key: 'status_str', label: 'Status STR' },
          ]} data={data} />
        )}

        {tab === 'license-expiry' && (
          <DataTable columns={[
            { key: 'nama_lengkap', label: 'Nama' },
            { key: 'tipe_karyawan', label: 'Tipe' },
            { key: 'spesialisasi', label: 'Spesialisasi' },
            { key: 'jenis_surat', label: 'Jenis' },
            { key: 'nomor_surat', label: 'Nomor' },
            { key: 'tgl_berlaku', label: 'Berlaku s/d' },
            { key: 'sisa_hari', label: 'Sisa Hari', align: 'right', format: formatNumber },
            { key: 'status', label: 'Status' },
          ]} data={data} />
        )}

        {tab === 'doctor-workload' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nama_dokter" type="category" width={150} tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="rawat_jalan" fill="#3b82f6" name="Rajal" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="rawat_inap" fill="#22c55e" name="Ranap" stackId="a" radius={[0,2,2,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'nama_dokter', label: 'Dokter' },
              { key: 'spesialisasi', label: 'Spesialisasi' },
              { key: 'jumlah_pasien', label: 'Total', align: 'right', format: formatNumber },
              { key: 'rawat_jalan', label: 'Rajal', align: 'right', format: formatNumber },
              { key: 'rawat_inap', label: 'Ranap', align: 'right', format: formatNumber },
              { key: 'avg_per_hari', label: 'Avg/Hari', align: 'right', format: formatDecimal },
            ]} data={data} />
          </div>
        )}
      </div>
    </div>
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
    { value: 'rl31-outpatient', label: 'RL 3.1 Rajal' },
    { value: 'rl32-inpatient', label: 'RL 3.2 Ranap' },
    { value: 'rl4a-visits', label: 'RL 4A Kunjungan' },
    { value: 'rl51-workforce', label: 'RL 5.1 Ketenagaan' },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader icon={<Landmark className="h-5 w-5" />} title="Laporan Kemenkes / RL">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === 'quality-indicators' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
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
          <DataTable columns={[
            { key: 'ruang_perawatan', label: 'Ruang' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'total_bed', label: 'Total TT', align: 'right', format: formatNumber },
            { key: 'bed_terisi', label: 'Terisi', align: 'right', format: formatNumber },
            { key: 'bed_kosong', label: 'Kosong', align: 'right', format: formatNumber },
            { key: 'persentase', label: '% Terisi', align: 'right', format: formatPercent },
          ]} data={data} />
        )}

        {tab === 'rl31-outpatient' && (
          <DataTable columns={[
            { key: 'ranking', label: '#', align: 'right' },
            { key: 'icd10_code', label: 'Kode ICD-10' },
            { key: 'icd10_name', label: 'Penyakit' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'laki_laki', label: 'L', align: 'right', format: formatNumber },
            { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
            { key: 'baru_laki', label: 'Baru L', align: 'right', format: formatNumber },
            { key: 'baru_wanita', label: 'Baru P', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'rl32-inpatient' && (
          <DataTable columns={[
            { key: 'ranking', label: '#', align: 'right' },
            { key: 'icd10_code', label: 'Kode ICD-10' },
            { key: 'icd10_name', label: 'Penyakit' },
            { key: 'jumlah', label: 'Jumlah', align: 'right', format: formatNumber },
            { key: 'laki_laki', label: 'L', align: 'right', format: formatNumber },
            { key: 'perempuan', label: 'P', align: 'right', format: formatNumber },
            { key: 'baru_laki', label: 'Baru L', align: 'right', format: formatNumber },
            { key: 'baru_wanita', label: 'Baru P', align: 'right', format: formatNumber },
            { key: 'lama_laki', label: 'Lama L', align: 'right', format: formatNumber },
            { key: 'lama_wanita', label: 'Lama P', align: 'right', format: formatNumber },
          ]} data={data} />
        )}

        {tab === 'rl4a-visits' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="rawat_jalan" fill="#3b82f6" name="Rawat Jalan" radius={[2,2,0,0]} />
                  <Bar dataKey="rawat_inap" fill="#22c55e" name="Rawat Inap" radius={[2,2,0,0]} />
                  <Bar dataKey="igd" fill="#ef4444" name="IGD" radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <DataTable columns={[
              { key: 'bulan', label: 'Bulan' },
              { key: 'rawat_jalan', label: 'Rawat Jalan', align: 'right', format: formatNumber },
              { key: 'rawat_inap', label: 'Rawat Inap', align: 'right', format: formatNumber },
              { key: 'igd', label: 'IGD', align: 'right', format: formatNumber },
              { key: 'total_pasien', label: 'Total', align: 'right', format: formatNumber },
              { key: 'pasien_baru', label: 'Baru', align: 'right', format: formatNumber },
              { key: 'pasien_lama', label: 'Lama', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}

        {tab === 'rl51-workforce' && (
          <div className="space-y-4">
            <Card className="rounded-none border-border"><CardContent className="pt-4">
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
            </CardContent></Card>
            <DataTable columns={[
              { key: 'tipe_karyawan', label: 'Tipe' },
              { key: 'pns', label: 'PNS', align: 'right', format: formatNumber },
              { key: 'kontrak', label: 'Kontrak', align: 'right', format: formatNumber },
              { key: 'honorer', label: 'Honorer', align: 'right', format: formatNumber },
              { key: 'magang', label: 'Magang', align: 'right', format: formatNumber },
              { key: 'lainnya', label: 'Lainnya', align: 'right', format: formatNumber },
              { key: 'total', label: 'Total', align: 'right', format: formatNumber },
            ]} data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
