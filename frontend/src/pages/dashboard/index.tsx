import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/store';
import { dashboardApi, type DashboardCharts, type DashboardStats, type DashboardSummary, type BedMonitoringData } from '@/lib/api';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bed,
  CheckCircle2,
  Clock,
  DollarSign,
  HeartPulse,
  Hotel,
  Loader2,
  Pill,
  Receipt,
  RefreshCw,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setPageTitle } from '@/lib/page-title';
import { Button } from '@/components/ui/button';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePermission } from '@/hooks/usePermission';
import { DASHBOARD_PERMISSION_GROUPS, DASHBOARD_WORKSPACES, type DashboardPermissionKey } from './config';

const CHART_COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#64748b', '#16a34a'];
const FLAT_CARD_CLASS = 'rounded-none border-border/70 shadow-none';
const FLAT_PANEL_CLASS = 'rounded-none border border-border/70 bg-background';
const FLAT_TINTED_PANEL_CLASS = 'rounded-none border border-border/70';

interface MetricCardConfig {
  key: string;
  title: string;
  value: string;
  detail?: string;
  trend?: number;
  icon: LucideIcon;
  tintClass: string;
  iconClass: string;
  permissions: DashboardPermissionKey[];
}

interface DashboardSectionConfig {
  key: string;
  title: string;
  description: string;
  permissions: DashboardPermissionKey[];
  content: ReactNode;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number): string => new Intl.NumberFormat('id-ID').format(value);

const formatChartDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return dateStr;
    }
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
};

const getVisitTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    outpatient: 'Rawat Jalan',
    inpatient: 'Rawat Inap',
    emergency: 'IGD',
    consultation: 'Konsultasi',
    lab: 'Lab',
    radiology: 'Radiologi',
    pharmacy: 'Farmasi',
    other: 'Lainnya',
  };
  return labels[type] || type;
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    bpjs: 'BPJS',
    insurance: 'Asuransi',
    debit: 'Debit',
    credit: 'Kredit',
    transfer: 'Transfer',
  };
  return labels[method] || method;
};

function DashboardShellCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn(FLAT_CARD_CLASS, className)}>{children}</Card>;
}

function SectionBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ icon: Icon, label, value, iconClass, badgeVariant = 'outline' }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClass: string;
  badgeVariant?: 'outline' | 'secondary';
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-border/70 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant={badgeVariant} className="rounded-none">{value}</Badge>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { hasAnyPermission, getPermissionsByModule, getUserPermissions } = usePermission();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [bedMonitoring, setBedMonitoring] = useState<BedMonitoringData | null>(null);

  const permissionMatrix = useMemo<Record<DashboardPermissionKey, boolean>>(() => {
    return Object.entries(DASHBOARD_PERMISSION_GROUPS).reduce((accumulator, [key, permissions]) => {
      accumulator[key as DashboardPermissionKey] = hasAnyPermission(permissions);
      return accumulator;
    }, {} as Record<DashboardPermissionKey, boolean>);
  }, [hasAnyPermission]);

  const canShowSection = useCallback(
    (permissions: DashboardPermissionKey[]) => permissions.some((permission) => permissionMatrix[permission]),
    [permissionMatrix],
  );

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const [statsRes, chartsRes, summaryRes, bedRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getCharts(chartPeriod),
        dashboardApi.getSummary(),
        dashboardApi.getBedMonitoring(),
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (chartsRes.data.success) setCharts(chartsRes.data.data);
      if (summaryRes.data.success) setSummary(summaryRes.data.data);
      if (bedRes.data.success) setBedMonitoring(bedRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartPeriod]);

  useEffect(() => {
    setPageTitle('Dashboard');
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!loading) {
      dashboardApi.getCharts(chartPeriod).then((res) => {
        if (res.data.success) setCharts(res.data.data);
      });
    }
  }, [chartPeriod, loading]);

  const registrationTrendData = charts?.registration_trends?.map((item) => ({
    date: formatChartDate(item.label),
    value: item.count,
  })) || [];

  const visitTypeData = charts?.visit_type_trends?.map((item, index) => ({
    name: getVisitTypeLabel(item.label),
    value: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  })) || [];

  const paymentMethodData = charts?.payment_method_trends?.map((item, index) => ({
    name: getPaymentMethodLabel(item.label),
    value: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  })) || [];

  const bedOccupancy = bedMonitoring?.summary.occupancy_rate || stats?.bed_occupancy_rate || 0;

  const metricCards: MetricCardConfig[] = [
    {
      key: 'registrations-today',
      title: 'Kunjungan Hari Ini',
      value: formatNumber(stats?.registrations_today || 0),
      detail: 'registrasi',
      trend: summary?.today.registrations_change,
      icon: Users,
      tintClass: 'bg-cyan-50',
      iconClass: 'text-cyan-700',
      permissions: ['overview', 'frontOffice'],
    },
    {
      key: 'revenue-today',
      title: 'Pendapatan Hari Ini',
      value: formatCurrency(stats?.revenue_today || 0),
      detail: 'kasir aktif',
      icon: DollarSign,
      tintClass: 'bg-emerald-50',
      iconClass: 'text-emerald-700',
      permissions: ['overview', 'billing'],
    },
    {
      key: 'active-queue',
      title: 'Antrian Aktif',
      value: formatNumber((stats?.visits_waiting || 0) + (stats?.visits_in_progress || 0)),
      detail: 'pasien',
      icon: Clock,
      tintClass: 'bg-amber-50',
      iconClass: 'text-amber-700',
      permissions: ['overview', 'frontOffice'],
    },
    {
      key: 'bed-occupancy',
      title: 'BOR',
      value: `${bedOccupancy.toFixed(1)}%`,
      detail: `${bedMonitoring?.summary.occupied_beds || 0}/${bedMonitoring?.summary.total_beds || 0} bed`,
      icon: Bed,
      tintClass: 'bg-slate-100',
      iconClass: 'text-slate-700',
      permissions: ['overview', 'rooms'],
    },
    {
      key: 'pending-billings',
      title: 'Tagihan Pending',
      value: formatNumber(stats?.pending_billings || 0),
      detail: formatCurrency(stats?.unpaid_billing_amount || 0),
      icon: Receipt,
      tintClass: 'bg-rose-50',
      iconClass: 'text-rose-700',
      permissions: ['billing'],
    },
    {
      key: 'pending-orders',
      title: 'Order Farmasi Pending',
      value: formatNumber(stats?.pending_medicine_orders || 0),
      detail: `${formatNumber(stats?.medicine_orders_today || 0)} order hari ini`,
      icon: Pill,
      tintClass: 'bg-lime-50',
      iconClass: 'text-lime-700',
      permissions: ['pharmacy'],
    },
    {
      key: 'procedure-orders',
      title: 'Tindakan Pending',
      value: formatNumber(stats?.pending_procedure_orders || 0),
      detail: `${formatNumber((stats?.lab_orders_today || 0) + (stats?.radiology_orders_today || 0))} lab/rad hari ini`,
      icon: Activity,
      tintClass: 'bg-violet-50',
      iconClass: 'text-violet-700',
      permissions: ['procedures'],
    },
  ];

  const visibleMetricCards = metricCards.filter((card) => canShowSection(card.permissions));
  const userPermissions = getUserPermissions();
  const permissionsByModule = getPermissionsByModule();

  const visibleWorkspaces = DASHBOARD_WORKSPACES.filter((workspace) =>
    workspace.permissions.some((permission) => userPermissions.some((userPermission) => userPermission.name === permission)),
  );

  const visibleModuleSummaries = Object.entries(permissionsByModule)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 8);

  const dashboardSections: DashboardSectionConfig[] = [
    {
      key: 'front-office-trend',
      title: 'Front Office',
      description: 'Kunjungan, jenis layanan, dan pola pembayaran sesuai permission operasional pendaftaran.',
      permissions: ['overview', 'frontOffice'],
      content: (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Tren Kunjungan</CardTitle>
                  <CardDescription>Pergerakan registrasi pasien berdasarkan periode aktif.</CardDescription>
                </div>
                <Select value={chartPeriod} onValueChange={(value) => setChartPeriod(value as 'week' | 'month' | 'year')}>
                  <SelectTrigger className="h-9 w-[120px] rounded-none border-border/70 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="week">7 Hari</SelectItem>
                    <SelectItem value="month">30 Hari</SelectItem>
                    <SelectItem value="year">1 Tahun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={registrationTrendData}>
                  <defs>
                    <linearGradient id="dashboard-registration-trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#d4d4d8" />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                  <Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#dashboard-registration-trend)" strokeWidth={2} name="Kunjungan" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </DashboardShellCard>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <DashboardShellCard>
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base">Jenis Kunjungan</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={visitTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {visitTypeData.map((entry, index) => (
                        <Cell key={`visit-type-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid gap-2 text-xs">
                  {visitTypeData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-dashed border-border/70 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-none" style={{ backgroundColor: item.fill }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{formatNumber(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </DashboardShellCard>

            <DashboardShellCard>
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base">Metode Bayar</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`payment-method-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid gap-2 text-xs">
                  {paymentMethodData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-dashed border-border/70 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-none" style={{ backgroundColor: item.fill }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{formatNumber(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </DashboardShellCard>
          </div>
        </div>
      ),
    },
    {
      key: 'service-summary',
      title: 'Layanan Hari Ini',
      description: 'Ringkasan operasional rawat jalan, rawat inap, dan IGD untuk pengguna klinis.',
      permissions: ['overview', 'frontOffice', 'procedures'],
      content: (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Ringkasan Hari Ini</CardTitle>
              <CardDescription>Per status layanan dan progres antrean saat ini.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <SummaryRow icon={Stethoscope} label="Rawat Jalan" value={stats?.outpatient_today || 0} iconClass="text-cyan-700" badgeVariant="secondary" />
              <SummaryRow icon={Bed} label="Rawat Inap" value={stats?.inpatient_today || 0} iconClass="text-emerald-700" badgeVariant="secondary" />
              <SummaryRow icon={HeartPulse} label="IGD" value={stats?.emergency_today || 0} iconClass="text-rose-700" badgeVariant="secondary" />
              <SummaryRow icon={Clock} label="Menunggu" value={stats?.visits_waiting || 0} iconClass="text-amber-700" />
              <SummaryRow icon={Activity} label="Dilayani" value={stats?.visits_in_progress || 0} iconClass="text-violet-700" />
              <SummaryRow icon={CheckCircle2} label="Selesai" value={stats?.visits_completed_today || 0} iconClass="text-emerald-700" />
            </CardContent>
          </DashboardShellCard>

          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Ruangan Terbanyak Dikunjungi</CardTitle>
              <CardDescription>Top ruangan berdasarkan volume kunjungan.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts?.top_rooms?.slice(0, 6)} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="4 4" horizontal vertical={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="room_name" fontSize={11} width={120} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0 }} />
                  <Bar dataKey="count" fill="#2563eb" name="Kunjungan" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </DashboardShellCard>
        </div>
      ),
    },
    {
      key: 'room-monitoring',
      title: 'Manajemen Ruangan',
      description: 'Panel BOR dan status tempat tidur untuk role yang punya akses ruangan.',
      permissions: ['overview', 'rooms'],
      content: (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Status Tempat Tidur</CardTitle>
              <CardDescription>Komposisi ketersediaan bed secara real-time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-1 text-center">
                <div className="text-4xl font-semibold tracking-tight">{bedOccupancy.toFixed(1)}%</div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Bed Occupancy Rate</p>
              </div>
              <Progress value={bedOccupancy} className="h-2 rounded-none bg-slate-200" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={cn(FLAT_PANEL_CLASS, 'p-3')}>
                  <div className="text-xl font-semibold">{bedMonitoring?.summary.total_beds || 0}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</div>
                </div>
                <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-emerald-200 bg-emerald-50 p-3')}>
                  <div className="text-xl font-semibold text-emerald-700">{bedMonitoring?.summary.available_beds || 0}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tersedia</div>
                </div>
                <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-amber-200 bg-amber-50 p-3')}>
                  <div className="text-xl font-semibold text-amber-700">{bedMonitoring?.summary.occupied_beds || 0}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Terisi</div>
                </div>
              </div>
            </CardContent>
          </DashboardShellCard>

          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Peta Bed per Ruangan</CardTitle>
              <CardDescription>Prioritas monitoring di ruangan dengan okupansi tertinggi.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {bedMonitoring?.rooms?.slice(0, 5).map((room) => (
                  <div key={room.room_id} className="grid gap-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Hotel className="h-4 w-4 text-slate-600" />
                        <span className="font-medium">{room.room_name}</span>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{room.room_code} · {room.room_class}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{room.occupied_beds}/{room.total_beds} bed</span>
                        <span>{room.occupancy_rate.toFixed(0)}%</span>
                      </div>
                      <Progress value={room.occupancy_rate} className="h-2 rounded-none bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </DashboardShellCard>
        </div>
      ),
    },
    {
      key: 'billing-finance',
      title: 'Billing',
      description: 'Kartu keuangan khusus permission billing dan laporan tagihan berjalan.',
      permissions: ['overview', 'billing'],
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Keuangan</CardTitle>
              <CardDescription>Ringkasan pendapatan dan outstanding billing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Minggu Ini</div>
                  <div className="mt-2 text-xl font-semibold">{formatCurrency(stats?.revenue_week || 0)}</div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bulan Ini</div>
                  <div className="mt-2 text-xl font-semibold">{formatCurrency(stats?.revenue_month || 0)}</div>
                </div>
              </div>
              <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-rose-200 bg-rose-50 p-4')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Belum Dibayar</div>
                    <div className="mt-1 text-xl font-semibold text-rose-700">{formatCurrency(stats?.unpaid_billing_amount || 0)}</div>
                  </div>
                  <Badge variant="outline" className="rounded-none border-rose-300 bg-transparent">{stats?.pending_billings || 0} tagihan</Badge>
                </div>
              </div>
            </CardContent>
          </DashboardShellCard>

          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Metode Pembayaran Dominan</CardTitle>
              <CardDescription>Komposisi pembayaran paling aktif di periode yang dipilih.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {paymentMethodData.slice(0, 5).map((item) => (
                  <div key={item.name} className="grid gap-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_140px] md:items-center">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-none" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-right text-sm font-medium">{formatNumber(item.value)} transaksi</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </DashboardShellCard>
        </div>
      ),
    },
    {
      key: 'orders',
      title: 'Farmasi & Tindakan',
      description: 'Panel order pending untuk unit farmasi, laboratorium, dan radiologi.',
      permissions: ['pharmacy', 'procedures'],
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          {canShowSection(['pharmacy']) && (
            <DashboardShellCard>
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base">Farmasi</CardTitle>
                <CardDescription>Performa order obat dan stok operasional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-lime-200 bg-lime-50 p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order Obat Pending</div>
                  <div className="mt-2 text-2xl font-semibold text-lime-700">{formatNumber(stats?.pending_medicine_orders || 0)}</div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order Hari Ini</span>
                    <span className="font-semibold">{formatNumber(stats?.medicine_orders_today || 0)}</span>
                  </div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selesai Hari Ini</span>
                    <span className="font-semibold">{formatNumber(stats?.completed_medicine_orders_today || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </DashboardShellCard>
          )}

          {canShowSection(['procedures']) && (
            <DashboardShellCard>
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base">Lab & Radiologi</CardTitle>
                <CardDescription>Monitoring tindakan penunjang yang masih berjalan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-violet-200 bg-violet-50 p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tindakan Pending</div>
                  <div className="mt-2 text-2xl font-semibold text-violet-700">{formatNumber(stats?.pending_procedure_orders || 0)}</div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Lab Hari Ini</span>
                    <span className="font-semibold">{formatNumber(stats?.lab_orders_today || 0)}</span>
                  </div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Radiologi Hari Ini</span>
                    <span className="font-semibold">{formatNumber(stats?.radiology_orders_today || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </DashboardShellCard>
          )}
        </div>
      ),
    },
  ];

  const visibleSections = dashboardSections.filter((section) => canShowSection(section.permissions));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-muted/20 p-4 md:p-6">
      <div className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-border/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Dashboard
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {user?.role?.name || 'Tanpa Role'}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Ringkasan per permission</h1>
              <p className="text-sm text-muted-foreground">
                Komponen dashboard tampil sesuai akses {user?.full_name}. Setiap blok hanya muncul jika permission modul tersedia.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-none" onClick={() => loadDashboardData(true)} disabled={refreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <SectionBlock title="Snapshot" description="Kartu utama dipilih dari permission yang dimiliki user saat ini.">
        <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
          {visibleMetricCards.map((card) => {
            const Icon = card.icon;
            return (
              <DashboardShellCard key={card.key} className="border-0 bg-background">
                <CardContent className="p-0">
                  <div className="grid min-h-[152px] grid-cols-[96px_minmax(0,1fr)]">
                    <div className={cn('flex items-center justify-center border-r border-border/70', card.tintClass)}>
                      <Icon className={cn('h-7 w-7', card.iconClass)} />
                    </div>
                    <div className="flex flex-col justify-between p-5">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{card.title}</p>
                        <div className="text-2xl font-semibold leading-none tracking-tight">{card.value}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {typeof card.trend === 'number' && (
                          <span className={cn('inline-flex items-center gap-1 font-medium', card.trend >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                            {card.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(card.trend).toFixed(0)}%
                          </span>
                        )}
                        {card.detail && <span>{card.detail}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </DashboardShellCard>
            );
          })}
        </div>
      </SectionBlock>

      <SectionBlock title="Workspace" description="Akses dashboard tambahan untuk tiap modul yang diizinkan oleh permission user.">
        <div className="grid gap-px bg-border/70 md:grid-cols-2 2xl:grid-cols-4">
          {visibleWorkspaces.map((workspace) => {
            const Icon = workspace.icon;
            const accessCount = workspace.permissions.filter((permission) =>
              userPermissions.some((userPermission) => userPermission.name === permission),
            ).length;

            return (
              <DashboardShellCard key={workspace.key} className="border-0 bg-background">
                <CardContent className="p-0">
                  <div className="grid min-h-[180px] grid-cols-[84px_minmax(0,1fr)]">
                    <div className={cn('flex items-center justify-center border-r border-border/70', workspace.tintClass)}>
                      <Icon className={cn('h-7 w-7', workspace.iconClass)} />
                    </div>
                    <div className="flex flex-col justify-between p-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{workspace.title}</p>
                          <Badge variant="outline" className="rounded-none">{accessCount}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{workspace.description}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {workspace.permissions
                            .filter((permission) => userPermissions.some((userPermission) => userPermission.name === permission))
                            .slice(0, 3)
                            .map((permission) => (
                              <span key={permission} className="border border-border/70 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {permission}
                              </span>
                            ))}
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full rounded-none justify-between">
                          <Link to={workspace.href}>
                            Buka workspace
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </DashboardShellCard>
            );
          })}
        </div>
      </SectionBlock>

      <SectionBlock title="Permission Map" description="Ringkasan modul yang aktif untuk user ini berdasarkan permission yang terbaca dari role.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Modul Aktif</CardTitle>
              <CardDescription>Distribusi permission yang tersedia per modul.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {visibleModuleSummaries.map(([moduleName, permissions]) => (
                  <div key={moduleName} className="grid gap-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_140px] md:items-center">
                    <div>
                      <div className="font-medium">{moduleName}</div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {permissions.slice(0, 3).map((permission) => permission.name).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Progress value={Math.min((permissions.length / Math.max(userPermissions.length, 1)) * 100, 100)} className="h-2 rounded-none bg-slate-200" />
                      <span className="min-w-10 text-right text-sm font-semibold">{permissions.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </DashboardShellCard>

          <DashboardShellCard>
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Akses User</CardTitle>
              <CardDescription>Jumlah permission dan role yang sedang aktif.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Permission</div>
                  <div className="mt-2 text-2xl font-semibold">{userPermissions.length}</div>
                </div>
                <div className={cn(FLAT_PANEL_CLASS, 'p-4')}>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Modul</div>
                  <div className="mt-2 text-2xl font-semibold">{visibleModuleSummaries.length}</div>
                </div>
              </div>
              <div className={cn(FLAT_TINTED_PANEL_CLASS, 'border-sky-200 bg-sky-50 p-4')}>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Role Aktif</div>
                <div className="mt-2 text-xl font-semibold text-sky-700">{user?.role?.name || 'Tanpa Role'}</div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Permission Teratas</p>
                <div className="flex flex-wrap gap-2">
                  {userPermissions.slice(0, 10).map((permission) => (
                    <span key={permission.id} className="border border-border/70 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {permission.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </DashboardShellCard>
        </div>
      </SectionBlock>

      {visibleSections.map((section) => (
        <SectionBlock key={section.key} title={section.title} description={section.description}>
          {section.content}
        </SectionBlock>
      ))}

      {visibleSections.length === 0 && (
        <DashboardShellCard>
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Belum ada panel untuk permission ini</p>
              <p className="max-w-md text-sm text-muted-foreground">
                User tetap masuk ke dashboard, tetapi belum memiliki permission modul yang dipetakan ke komponen dashboard. Tambahkan permission modul untuk menampilkan panel terkait.
              </p>
            </div>
          </CardContent>
        </DashboardShellCard>
      )}
    </div>
  );
}
