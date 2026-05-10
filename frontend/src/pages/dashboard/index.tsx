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
  ArrowRight,
  ArrowUpRight,
  Bed,
  CheckCircle2,
  CircleAlert,
  Clock,
  Command,
  DollarSign,
  HeartPulse,
  Hotel,
  LayoutGrid,
  Loader2,
  Pill,
  Receipt,
  RefreshCw,
  ShieldCheck,
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
  CartesianGrid,
  Bar,
  BarChart,
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

const CHART_COLORS = ['#0f766e', '#b45309', '#1d4ed8', '#b91c1c', '#52525b', '#15803d'];
const FLAT_CARD_CLASS = 'rounded-none border-border/70 shadow-none';
const FLAT_PANEL_CLASS = 'rounded-none border border-border/70 bg-background';
const FLAT_TINTED_PANEL_CLASS = 'rounded-none border border-border/70';
const DASHBOARD_FONT_FAMILY = '"IBM Plex Sans", "Segoe UI", sans-serif';
const DASHBOARD_MONO_FAMILY = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';

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

interface DistributionRowProps {
  label: string;
  value: number;
  total: number;
  fill: string;
  suffix?: string;
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
      <div className="flex flex-col gap-1 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-foreground/80" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{title}</h2>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{description}</p>
      </div>
      {children}
    </section>
  );
}

function DashboardPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <DashboardShellCard className={cn('overflow-hidden bg-background/95 backdrop-blur', className)}>
      <CardHeader className="border-b border-border/70 bg-muted/10 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{eyebrow}</div>
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            {description && <CardDescription className="text-xs uppercase tracking-[0.16em]">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn('p-4 sm:p-5', contentClassName)}>{children}</CardContent>
    </DashboardShellCard>
  );
}

function DistributionRow({ label, value, total, fill, suffix }: DistributionRowProps) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="space-y-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="truncate font-medium">{label}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>
            {percentage.toFixed(0)}%
          </div>
        </div>
        <div className="shrink-0 text-right font-semibold">
          {formatNumber(value)}
          {suffix ? <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span> : null}
        </div>
      </div>
      <div className="h-2 bg-muted">
        <div className="h-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: fill }} />
      </div>
    </div>
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

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
      setLastUpdatedAt(new Date());
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
  const showFrontOffice = canShowSection(['overview', 'frontOffice']);
  const showRooms = canShowSection(['overview', 'rooms']);
  const showBilling = canShowSection(['overview', 'billing']);
  const showPharmacy = canShowSection(['pharmacy']);
  const showProcedures = canShowSection(['procedures']);
  const serviceTotal = (stats?.outpatient_today || 0) + (stats?.inpatient_today || 0) + (stats?.emergency_today || 0);
  const attentionCount = (stats?.visits_waiting || 0) + (stats?.pending_billings || 0) + (stats?.pending_medicine_orders || 0) + (stats?.pending_procedure_orders || 0);
  const completionRate = (stats?.registrations_today || 0) > 0
    ? ((stats?.visits_completed_today || 0) / (stats?.registrations_today || 1)) * 100
    : 0;
  const lastUpdatedLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(lastUpdatedAt)
    : '-';
  const currentDateLabel = useMemo(() => new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date()), []);

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

  const sortedVisitTypeData = [...visitTypeData].sort((left, right) => right.value - left.value);
  const sortedPaymentMethodData = [...paymentMethodData].sort((left, right) => right.value - left.value);
  const totalVisitTypeValue = sortedVisitTypeData.reduce((total, item) => total + item.value, 0);
  const totalPaymentMethodValue = sortedPaymentMethodData.reduce((total, item) => total + item.value, 0);
  const dominantVisitType = sortedVisitTypeData[0];
  const dominantPaymentMethod = sortedPaymentMethodData[0];
  const quickStats = [
    {
      label: 'Role Aktif',
      value: user?.role?.name || 'Tanpa Role',
      detail: `${userPermissions.length} permission`,
    },
    {
      label: 'Workspace',
      value: formatNumber(visibleWorkspaces.length),
      detail: 'jalur kerja terbuka',
    },
    {
      label: 'Prioritas',
      value: formatNumber(attentionCount),
      detail: 'item perlu tindak lanjut',
    },
  ];
  const commandRows = [
    showFrontOffice
      ? { icon: Clock, label: 'Menunggu', value: stats?.visits_waiting || 0, hint: 'antrian aktif', tone: 'text-amber-700' }
      : null,
    showFrontOffice
      ? { icon: Activity, label: 'Dilayani', value: stats?.visits_in_progress || 0, hint: 'visit berjalan', tone: 'text-violet-700' }
      : null,
    showFrontOffice
      ? { icon: CheckCircle2, label: 'Selesai', value: stats?.visits_completed_today || 0, hint: `${completionRate.toFixed(0)}% dari registrasi`, tone: 'text-emerald-700' }
      : null,
    showBilling
      ? { icon: Receipt, label: 'Tagihan Pending', value: stats?.pending_billings || 0, hint: formatCurrency(stats?.unpaid_billing_amount || 0), tone: 'text-rose-700' }
      : null,
    showPharmacy
      ? { icon: Pill, label: 'Farmasi Pending', value: stats?.pending_medicine_orders || 0, hint: `${formatNumber(stats?.medicine_orders_today || 0)} order`, tone: 'text-lime-700' }
      : null,
    showProcedures
      ? { icon: Stethoscope, label: 'Lab/Rad Pending', value: stats?.pending_procedure_orders || 0, hint: `${formatNumber((stats?.lab_orders_today || 0) + (stats?.radiology_orders_today || 0))} order`, tone: 'text-sky-700' }
      : null,
    showRooms
      ? { icon: Bed, label: 'BOR', value: `${bedOccupancy.toFixed(1)}%`, hint: `${bedMonitoring?.summary.occupied_beds || 0}/${bedMonitoring?.summary.total_beds || 0} bed`, tone: 'text-slate-700' }
      : null,
  ].filter(Boolean) as Array<{ icon: LucideIcon; label: string; value: string | number; hint: string; tone: string }>;

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
    <div className="relative flex flex-1 flex-col overflow-auto bg-muted/20" style={{ fontFamily: DASHBOARD_FONT_FAMILY }}>
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative flex flex-1 flex-col gap-4 p-3 md:p-5">
        <DashboardShellCard className="overflow-hidden bg-background/95 backdrop-blur">
          <div className="grid gap-px bg-border/70 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <div className="bg-background p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>
                    <span className="border border-border/70 px-2 py-1 text-foreground">SIMRS Board</span>
                    <span>{currentDateLabel}</span>
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pusat Operasi Harian</h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Kunjungan, kapasitas bed, billing, farmasi, dan tindakan dalam satu board operasional.
                    </p>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="rounded-none self-start" onClick={() => loadDashboardData(true)} disabled={refreshing}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              <div className="mt-6 grid gap-px bg-border/70 sm:grid-cols-3">
                {quickStats.map((item) => (
                  <div key={item.label} className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{item.label}</div>
                    <div className="mt-2 text-lg font-semibold leading-tight">{item.value}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-px bg-border/70 sm:grid-cols-3 xl:grid-cols-1">
              <div className="bg-background px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Last Sync</div>
                <div className="mt-2 text-2xl font-semibold">{lastUpdatedLabel}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">data dashboard terakhir</div>
              </div>
              <div className="bg-background px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Throughput</div>
                <div className="mt-2 text-2xl font-semibold">{completionRate.toFixed(0)}%</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">visit selesai hari ini</div>
              </div>
              <div className="bg-background px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Service Load</div>
                <div className="mt-2 text-2xl font-semibold">{formatNumber(serviceTotal)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">rawat jalan, inap, IGD</div>
              </div>
            </div>
          </div>
        </DashboardShellCard>

        {visibleMetricCards.length > 0 && (
          <SectionBlock title="Snapshot" description="angka utama sesuai permission aktif">
            <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
              {visibleMetricCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.key} className="bg-background px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>{card.title}</div>
                        <div className="mt-3 text-3xl font-semibold leading-none tracking-tight">{card.value}</div>
                      </div>
                      <div className={cn('flex h-11 w-11 items-center justify-center border border-border/70', card.tintClass)}>
                        <Icon className={cn('h-5 w-5', card.iconClass)} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {typeof card.trend === 'number' && (
                        <span className={cn('inline-flex items-center gap-1 font-medium', card.trend >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                          {card.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(card.trend).toFixed(0)}%
                        </span>
                      )}
                      {card.detail && <span className="uppercase tracking-[0.16em]">{card.detail}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionBlock>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_320px] xl:grid-cols-[minmax(0,1.35fr)_360px]">
          {showFrontOffice && (
            <DashboardPanel
              eyebrow="Traffic"
              title="Pergerakan Pasien"
              description="registrasi dan ritme layanan"
              action={
                <Select value={chartPeriod} onValueChange={(value) => setChartPeriod(value as 'week' | 'month' | 'year')}>
                  <SelectTrigger className="h-9 w-[124px] rounded-none border-border/70 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="week">7 Hari</SelectItem>
                    <SelectItem value="month">30 Hari</SelectItem>
                    <SelectItem value="year">1 Tahun</SelectItem>
                  </SelectContent>
                </Select>
              }
            >
              {registrationTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={286}>
                  <AreaChart data={registrationTrendData}>
                    <defs>
                      <linearGradient id="dashboard-registration-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0, border: '1px solid #d4d4d8' }} />
                    <Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#dashboard-registration-trend)" strokeWidth={2.25} name="Kunjungan" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[286px] items-center justify-center border border-dashed border-border/70 text-sm text-muted-foreground">
                  Belum ada data tren kunjungan.
                </div>
              )}

              <div className="mt-4 grid gap-px bg-border/70 lg:grid-cols-3">
                <div className="bg-background px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Visit Dominan</div>
                  <div className="mt-2 text-lg font-semibold">{dominantVisitType?.name || '-'}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatNumber(dominantVisitType?.value || 0)} kunjungan</div>
                </div>
                <div className="bg-background px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Pembayaran Dominan</div>
                  <div className="mt-2 text-lg font-semibold">{dominantPaymentMethod?.name || '-'}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatNumber(dominantPaymentMethod?.value || 0)} transaksi</div>
                </div>
                <div className="bg-background px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Registrasi Hari Ini</div>
                  <div className="mt-2 text-lg font-semibold">{formatNumber(stats?.registrations_today || 0)}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">pergerakan front office</div>
                </div>
              </div>
            </DashboardPanel>
          )}

          <DashboardPanel eyebrow="Command" title="Prioritas Hari Ini" description="item yang perlu ditutup lebih dulu">
            {commandRows.length > 0 ? (
              <div className="space-y-3">
                {commandRows.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="grid gap-3 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center border border-border/70 bg-muted/20">
                          <Icon className={cn('h-4 w-4', item.tone)} />
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.hint}</div>
                        </div>
                      </div>
                      <div className="text-left text-2xl font-semibold sm:text-right">{item.value}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[286px] items-center justify-center border border-dashed border-border/70 text-sm text-muted-foreground">
                Belum ada panel prioritas untuk permission ini.
              </div>
            )}
          </DashboardPanel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {showFrontOffice && (
            <DashboardPanel eyebrow="Mix" title="Komposisi Kunjungan" description="jenis layanan yang paling aktif">
              {sortedVisitTypeData.length > 0 ? (
                <div className="space-y-3">
                  {sortedVisitTypeData.slice(0, 5).map((item) => (
                    <DistributionRow key={item.name} label={item.name} value={item.value} total={totalVisitTypeValue} fill={item.fill} suffix="visit" />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Belum ada data jenis kunjungan.</div>
              )}
            </DashboardPanel>
          )}

          {showRooms && (
            <DashboardPanel eyebrow="Capacity" title="Kapasitas Rawat Inap" description="bor dan tekanan ruangan">
              <div className="space-y-5">
                <div className="grid gap-px bg-border/70 sm:grid-cols-3">
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>BOR</div>
                    <div className="mt-2 text-3xl font-semibold">{bedOccupancy.toFixed(1)}%</div>
                  </div>
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Bed Tersedia</div>
                    <div className="mt-2 text-3xl font-semibold text-emerald-700">{bedMonitoring?.summary.available_beds || 0}</div>
                  </div>
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Bed Terisi</div>
                    <div className="mt-2 text-3xl font-semibold text-amber-700">{bedMonitoring?.summary.occupied_beds || 0}</div>
                  </div>
                </div>

                <Progress value={bedOccupancy} className="h-2 rounded-none bg-slate-200" />

                <div className="space-y-3">
                  {(bedMonitoring?.rooms || []).slice(0, 5).map((room) => (
                    <div key={room.room_id} className="space-y-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{room.room_name}</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{room.room_code} · {room.room_class}</div>
                        </div>
                        <div className="text-right text-sm font-semibold">{room.occupied_beds}/{room.total_beds}</div>
                      </div>
                      <Progress value={room.occupancy_rate} className="h-2 rounded-none bg-slate-200" />
                    </div>
                  ))}

                  {(bedMonitoring?.rooms || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">Belum ada data bed per ruangan.</div>
                  )}
                </div>
              </div>
            </DashboardPanel>
          )}

          {showBilling && (
            <DashboardPanel eyebrow="Finance" title="Billing & Pendapatan" description="arus tagihan berjalan">
              <div className="grid gap-px bg-border/70 sm:grid-cols-2">
                <div className="bg-background px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Hari Ini</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(stats?.revenue_today || 0)}</div>
                </div>
                <div className="bg-background px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Bulan Ini</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(stats?.revenue_month || 0)}</div>
                </div>
              </div>

              <div className={cn(FLAT_TINTED_PANEL_CLASS, 'mt-4 border-rose-200 bg-rose-50 p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Outstanding</div>
                    <div className="mt-2 text-2xl font-semibold text-rose-700">{formatCurrency(stats?.unpaid_billing_amount || 0)}</div>
                  </div>
                  <Badge variant="outline" className="rounded-none border-rose-300 bg-transparent text-rose-700">{formatNumber(stats?.pending_billings || 0)} tagihan</Badge>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {sortedPaymentMethodData.length > 0 ? (
                  sortedPaymentMethodData.slice(0, 4).map((item) => (
                    <DistributionRow key={item.name} label={item.name} value={item.value} total={totalPaymentMethodValue} fill={item.fill} suffix="trx" />
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">Belum ada data metode pembayaran.</div>
                )}
              </div>
            </DashboardPanel>
          )}

          {(showPharmacy || showProcedures) && (
            <DashboardPanel eyebrow="Orders" title="Farmasi & Tindakan" description="antrean order penunjang">
              <div className="grid gap-px bg-border/70 sm:grid-cols-2">
                {showPharmacy && (
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Farmasi Pending</div>
                    <div className="mt-2 text-3xl font-semibold text-lime-700">{formatNumber(stats?.pending_medicine_orders || 0)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatNumber(stats?.medicine_orders_today || 0)} order hari ini</div>
                  </div>
                )}
                {showProcedures && (
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Lab / Rad Pending</div>
                    <div className="mt-2 text-3xl font-semibold text-sky-700">{formatNumber(stats?.pending_procedure_orders || 0)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatNumber((stats?.lab_orders_today || 0) + (stats?.radiology_orders_today || 0))} order hari ini</div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-px bg-border/70 sm:grid-cols-2">
                {showPharmacy && (
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Farmasi Selesai</div>
                    <div className="mt-2 text-2xl font-semibold">{formatNumber(stats?.completed_medicine_orders_today || 0)}</div>
                  </div>
                )}
                {showProcedures && (
                  <div className="bg-background px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>Lab + Radiologi</div>
                    <div className="mt-2 text-2xl font-semibold">{formatNumber((stats?.lab_orders_today || 0) + (stats?.radiology_orders_today || 0))}</div>
                  </div>
                )}
              </div>
            </DashboardPanel>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <DashboardPanel eyebrow="Workspace" title="Akses Kerja" description="jalur masuk modul harian">
            {visibleWorkspaces.length > 0 ? (
              <div className="space-y-2">
                {visibleWorkspaces.slice(0, 8).map((workspace) => {
                  const Icon = workspace.icon;
                  const accessCount = workspace.permissions.filter((permission) =>
                    userPermissions.some((userPermission) => userPermission.name === permission),
                  ).length;

                  return (
                    <div key={workspace.key} className="grid gap-3 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center border border-border/70', workspace.tintClass)}>
                          <Icon className={cn('h-4 w-4', workspace.iconClass)} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{workspace.title}</div>
                          <div className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{workspace.description}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <Badge variant="outline" className="rounded-none">{accessCount}</Badge>
                        <Button asChild variant="outline" size="sm" className="rounded-none">
                          <Link to={workspace.href}>
                            Buka
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center border border-dashed border-border/70 text-sm text-muted-foreground">
                Belum ada workspace yang aktif untuk role ini.
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel eyebrow="Access" title="Peta Permission" description="modul dan permission aktif">
            <div className="grid gap-px bg-border/70 sm:grid-cols-3">
              <div className="bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Permission
                </div>
                <div className="mt-2 text-3xl font-semibold">{userPermissions.length}</div>
              </div>
              <div className="bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Modul
                </div>
                <div className="mt-2 text-3xl font-semibold">{visibleModuleSummaries.length}</div>
              </div>
              <div className="bg-background px-4 py-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: DASHBOARD_MONO_FAMILY }}>
                  <Command className="h-3.5 w-3.5" />
                  User
                </div>
                <div className="mt-2 text-lg font-semibold leading-tight">{user?.full_name || '-'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visibleModuleSummaries.length > 0 ? (
                visibleModuleSummaries.map(([moduleName, permissions]) => (
                  <div key={moduleName} className="grid gap-2 border-b border-dashed border-border/70 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
                    <div>
                      <div className="font-medium">{moduleName}</div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {permissions.slice(0, 3).map((permission) => permission.name).join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Progress value={Math.min((permissions.length / Math.max(userPermissions.length, 1)) * 100, 100)} className="h-2 rounded-none bg-slate-200" />
                      <span className="min-w-8 text-right text-sm font-semibold">{permissions.length}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex min-h-[220px] items-center justify-center border border-dashed border-border/70 text-sm text-muted-foreground">
                  Belum ada permission modul yang dipetakan.
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>

        <SectionBlock title="Panel Modul" description="ringkasan operasional tambahan">
          <div className="grid gap-4">
            {visibleSections.map((section) => (
              <DashboardPanel key={section.key} eyebrow="Module" title={section.title} description={section.description}>
                {section.content}
              </DashboardPanel>
            ))}

            {visibleSections.length === 0 && visibleMetricCards.length === 0 && (
              <DashboardShellCard>
                <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                  <CircleAlert className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">Belum ada panel untuk permission ini</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Dashboard tetap aktif, tetapi role ini belum punya permission yang dipetakan ke panel operasional.
                    </p>
                  </div>
                </CardContent>
              </DashboardShellCard>
            )}
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}