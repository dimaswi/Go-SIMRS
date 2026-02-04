import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/store';
import { dashboardApi, type DashboardStats, type DashboardCharts, type DashboardSummary, type BedMonitoringData } from '@/lib/api';
import { 
  Users, Activity, DollarSign, Bed, Stethoscope, Clock, CheckCircle2,
  Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, HeartPulse, Pill
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setPageTitle } from '@/lib/page-title';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// Color constants
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Format helpers
const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number): string => new Intl.NumberFormat('id-ID').format(value);

const formatChartDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Fallback for non-ISO format like "2026-01-31"
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
    outpatient: 'Rawat Jalan', inpatient: 'Rawat Inap', emergency: 'IGD',
    consultation: 'Konsultasi', lab: 'Lab', radiology: 'Radiologi', pharmacy: 'Farmasi', other: 'Lainnya',
  };
  return labels[type] || type;
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: 'Tunai', bpjs: 'BPJS', insurance: 'Asuransi', debit: 'Debit', credit: 'Kredit', transfer: 'Transfer',
  };
  return labels[method] || method;
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [bedMonitoring, setBedMonitoring] = useState<BedMonitoringData | null>(null);

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
      dashboardApi.getCharts(chartPeriod).then(res => {
        if (res.data.success) setCharts(res.data.data);
      });
    }
  }, [chartPeriod, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prepare chart data
  const registrationTrendData = charts?.registration_trends?.map(item => ({
    date: formatChartDate(item.label),
    value: item.count,
  })) || [];

  const visitTypeData = charts?.visit_type_trends?.map((item, i) => ({
    name: getVisitTypeLabel(item.label),
    value: item.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const paymentMethodData = charts?.payment_method_trends?.map((item, i) => ({
    name: getPaymentMethodLabel(item.label),
    value: item.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const bedOccupancy = bedMonitoring?.summary.occupancy_rate || stats?.bed_occupancy_rate || 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Selamat datang kembali, {user?.full_name}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadDashboardData(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Main Stats - Compact Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Kunjungan Hari Ini */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Kunjungan Hari Ini</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatNumber(stats?.registrations_today || 0)}</span>
                  {summary?.today.registrations_change !== undefined && (
                    <span className={cn("text-xs flex items-center", 
                      summary.today.registrations_change >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {summary.today.registrations_change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(summary.today.registrations_change).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendapatan Hari Ini */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Pendapatan Hari Ini</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatCurrency(stats?.revenue_today || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Antrian */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Antrian Aktif</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatNumber((stats?.visits_waiting || 0) + (stats?.visits_in_progress || 0))}</span>
                  <span className="text-xs text-muted-foreground">pasien</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BOR */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <Bed className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">BOR</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{bedOccupancy.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">
                    ({bedMonitoring?.summary.occupied_beds || 0}/{bedMonitoring?.summary.total_beds || 0})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tren Kunjungan</CardTitle>
                  <CardDescription>Grafik kunjungan pasien</CardDescription>
                </div>
                <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as 'week' | 'month' | 'year')}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">7 Hari</SelectItem>
                    <SelectItem value="month">30 Hari</SelectItem>
                    <SelectItem value="year">1 Tahun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={registrationTrendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#colorValue)" strokeWidth={2} name="Kunjungan" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Two smaller charts side by side */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Visit Type Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Jenis Kunjungan</CardTitle>
              </CardHeader>
              <CardContent>
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
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {visitTypeData.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Metode Bayar</CardTitle>
              </CardHeader>
              <CardContent>
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
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {paymentMethodData.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Rooms Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ruangan Terbanyak Dikunjungi</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts?.top_rooms?.slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="room_name" fontSize={11} width={120} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Kunjungan" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary Cards */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ringkasan Hari Ini</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Rawat Jalan</span>
                </div>
                <Badge variant="secondary">{stats?.outpatient_today || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bed className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Rawat Inap</span>
                </div>
                <Badge variant="secondary">{stats?.inpatient_today || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-red-500" />
                  <span className="text-sm">IGD</span>
                </div>
                <Badge variant="secondary">{stats?.emergency_today || 0}</Badge>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Menunggu</span>
                </div>
                <Badge variant="outline">{stats?.visits_waiting || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Dilayani</span>
                </div>
                <Badge variant="outline">{stats?.visits_in_progress || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">Selesai</span>
                </div>
                <Badge variant="outline">{stats?.visits_completed_today || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Bed Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status Tempat Tidur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold">{bedOccupancy.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Bed Occupancy Rate</p>
              </div>
              <Progress value={bedOccupancy} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <div className="text-lg font-semibold">{bedMonitoring?.summary.total_beds || 0}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-lg font-semibold text-green-600">{bedMonitoring?.summary.available_beds || 0}</div>
                  <div className="text-xs text-muted-foreground">Tersedia</div>
                </div>
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <div className="text-lg font-semibold text-orange-600">{bedMonitoring?.summary.occupied_beds || 0}</div>
                  <div className="text-xs text-muted-foreground">Terisi</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Pending</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Resep Obat</span>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-background">
                  {stats?.pending_medicine_orders || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Lab/Radiologi</span>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-background">
                  {stats?.pending_procedure_orders || 0}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Keuangan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Minggu ini</span>
                <span className="font-semibold">{formatCurrency(stats?.revenue_week || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Bulan ini</span>
                <span className="font-semibold">{formatCurrency(stats?.revenue_month || 0)}</span>
              </div>
              <hr />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tagihan Pending</span>
                <Badge variant="outline">{stats?.pending_billings || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Belum Dibayar</span>
                <span className="text-sm font-medium text-red-600">{formatCurrency(stats?.unpaid_billing_amount || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
