import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { setPageTitle } from '@/lib/page-title';
import {
  qualityCostApi,
  type QualityMetricsResponse,
  type CostAnalysisSummary,
  type CostCaseDetail,
  type TopLossCase,
  type CostByCategory,
  type PendingClaimSummary,
  type QualityTrendPoint
} from '@/lib/api';
import {
  Activity, TrendingUp, TrendingDown, Bed, Clock,
  DollarSign, AlertTriangle, CheckCircle2, XCircle,
  Loader2, RefreshCw,
  PieChart as PieChartIcon, BarChart3, FileText, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

// Color constants
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Format helpers
const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const getVisitTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    outpatient: 'Rawat Jalan', inpatient: 'Rawat Inap', emergency: 'IGD',
    consultation: 'Konsultasi', lab: 'Lab', radiology: 'Radiologi',
  };
  return labels[type] || type;
};

// Tab trigger class - underline style
const tabTriggerClass = "px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium text-muted-foreground data-[state=active]:text-foreground";

export default function QualityCostPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<string>('all'); // Default: semua data

  // Data states
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetricsResponse | null>(null);
  const [qualityTrends, setQualityTrends] = useState<QualityTrendPoint[]>([]);
  const [costSummary, setCostSummary] = useState<CostAnalysisSummary | null>(null);
  const [costCases, setCostCases] = useState<CostCaseDetail[]>([]);
  const [topLossCases, setTopLossCases] = useState<TopLossCase[]>([]);
  const [costByCategory, setCostByCategory] = useState<CostByCategory[]>([]);
  const [pendingClaims, setPendingClaims] = useState<PendingClaimSummary | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      console.log('Loading data with period:', period);

      const [
        qualityRes,
        trendsRes,
        costRes,
        casesRes,
        lossRes,
        categoryRes,
        claimsRes
      ] = await Promise.all([
        qualityCostApi.getQualityMetrics(period),
        qualityCostApi.getQualityTrends('year'),
        qualityCostApi.getCostSummary(period), // No payment method filter - show ALL
        qualityCostApi.getCostCases({ period, sort_by: 'date', sort_order: 'desc' }),
        qualityCostApi.getTopLossCases(period),
        qualityCostApi.getCostByCategory(period),
        qualityCostApi.getPendingClaims()
      ]);

      console.log('Quality Metrics:', qualityRes.data);
      console.log('Cost Summary:', costRes.data);
      console.log('Cost Cases:', casesRes.data);

      if (qualityRes.data.success) setQualityMetrics(qualityRes.data.data);
      if (trendsRes.data.success) setQualityTrends(trendsRes.data.data);
      if (costRes.data.success) setCostSummary(costRes.data.data);
      if (casesRes.data.success) setCostCases(casesRes.data.data);
      if (lossRes.data.success) setTopLossCases(lossRes.data.data);
      if (categoryRes.data.success) setCostByCategory(categoryRes.data.data);
      if (claimsRes.data.success) setPendingClaims(claimsRes.data.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setPageTitle('Kendali Mutu & Biaya');
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const indicators = qualityMetrics?.indicators;
  const standards = indicators?.standards;

  const getIndicatorStatus = (value: number, min?: number, max?: number): 'success' | 'warning' | 'danger' => {
    if (min !== undefined && max !== undefined) {
      if (value >= min && value <= max) return 'success';
      if (value < min * 0.8 || value > max * 1.2) return 'danger';
      return 'warning';
    }
    if (max !== undefined) {
      if (value <= max) return 'success';
      if (value > max * 1.5) return 'danger';
      return 'warning';
    }
    return 'success';
  };

  const getStatusColor = (status: 'success' | 'warning' | 'danger') => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'danger': return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Kendali Mutu & Biaya
              </CardTitle>
              <CardDescription>
                Monitoring indikator mutu rumah sakit dan analisis biaya
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Data</SelectItem>
                  <SelectItem value="week">7 Hari</SelectItem>
                  <SelectItem value="month">30 Hari</SelectItem>
                  <SelectItem value="quarter">3 Bulan</SelectItem>
                  <SelectItem value="year">1 Tahun</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="h-auto p-0 px-6 pt-4 bg-transparent border-b border-border rounded-none w-full justify-start gap-6">
              <TabsTrigger value="overview" className={tabTriggerClass}>
                <PieChartIcon className="h-4 w-4 mr-2" />
                Ringkasan
              </TabsTrigger>
              <TabsTrigger value="cost" className={tabTriggerClass}>
                <DollarSign className="h-4 w-4 mr-2" />
                Analisis Biaya
              </TabsTrigger>
              <TabsTrigger value="quality" className={tabTriggerClass}>
                <Activity className="h-4 w-4 mr-2" />
                Indikator Mutu
              </TabsTrigger>
              <TabsTrigger value="reports" className={tabTriggerClass}>
                <FileText className="h-4 w-4 mr-2" />
                Laporan
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0">
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
                <div className="p-6 space-y-6">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Cost Recovery Rate */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl", 
                    (costSummary?.cost_recovery_rate || 0) >= 100 ? "bg-green-100" : "bg-red-100"
                  )}>
                    <DollarSign className={cn("h-5 w-5", 
                      (costSummary?.cost_recovery_rate || 0) >= 100 ? "text-green-600" : "text-red-600"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Cost Recovery</p>
                    <span className="text-xl font-bold">{costSummary?.cost_recovery_rate?.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Net Balance */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl",
                    (costSummary?.net_balance || 0) >= 0 ? "bg-green-100" : "bg-red-100"
                  )}>
                    {(costSummary?.net_balance || 0) >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Saldo Bersih</p>
                    <span className={cn("text-xl font-bold",
                      (costSummary?.net_balance || 0) >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(Math.abs(costSummary?.net_balance || 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* BOR */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl",
                    getStatusColor(getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max))
                  )}>
                    <Bed className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">BOR</p>
                    <span className="text-xl font-bold">{indicators?.bor?.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ALOS */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl",
                    getStatusColor(getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max))
                  )}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">ALOS</p>
                    <span className="text-xl font-bold">{indicators?.alos?.toFixed(1) || 0}</span>
                    <span className="text-xs text-muted-foreground ml-1">hari</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cost vs Claim Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Perbandingan Biaya vs Klaim</CardTitle>
                <CardDescription>Total biaya aktual vs klaim BPJS</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { name: 'Biaya Aktual', value: costSummary?.total_actual_cost || 0 },
                    { name: 'Klaim BPJS', value: costSummary?.total_claim_amount || 0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Category Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribusi Biaya</CardTitle>
                <CardDescription>Breakdown biaya per kategori</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={costByCategory || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="category"
                      label={({ category, percentage }) => `${category} ${percentage?.toFixed(0) || 0}%`}
                      labelLine={false}
                    >
                      {(costByCategory || []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Surplus vs Deficit */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Kasus Surplus vs Defisit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Surplus</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-600">{costSummary?.surplus_cases || 0}</span>
                    <span className="text-xs text-muted-foreground ml-1">kasus</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Defisit</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-red-600">{costSummary?.deficit_cases || 0}</span>
                    <span className="text-xs text-muted-foreground ml-1">kasus</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Surplus</span>
                    <span className="font-medium text-green-600">{formatCurrency(costSummary?.total_surplus || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground">Total Defisit</span>
                    <span className="font-medium text-red-600">-{formatCurrency(costSummary?.total_deficit || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Claims */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Klaim Tertunda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Klaim</span>
                  <span className="font-bold">{pendingClaims?.total_pending_claims || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nilai Tertunda</span>
                  <span className="font-bold">{formatCurrency(pendingClaims?.total_pending_amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Terlama</span>
                  <Badge variant={pendingClaims?.oldest_pending_days && pendingClaims.oldest_pending_days > 30 ? "destructive" : "secondary"}>
                    {pendingClaims?.oldest_pending_days || 0} hari
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Drug Cost Ratio */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rasio Biaya Obat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-2">
                  <span className="text-3xl font-bold">{costSummary?.drug_cost_ratio?.toFixed(1) || 0}%</span>
                  <p className="text-xs text-muted-foreground mt-1">dari total biaya</p>
                </div>
                <Progress value={costSummary?.drug_cost_ratio || 0} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Standar ideal: 20-30%
                </p>
              </CardContent>
            </Card>
          </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Cost Analysis Tab */}
            <TabsContent value="cost" className="mt-0">
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
                <div className="p-6 space-y-6">
          {/* Top Loss Cases */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Kasus dengan Selisih Rugi Terbesar
              </CardTitle>
              <CardDescription>Kasus BPJS dengan biaya melebihi tarif INA-CBG</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Billing</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead className="text-right">Biaya Aktual</TableHead>
                      <TableHead className="text-right">Tarif INA-CBG</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead>LOS</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!topLossCases || topLossCases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Tidak ada kasus defisit
                        </TableCell>
                      </TableRow>
                    ) : (
                      topLossCases.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.billing_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{c.patient_name || '-'}</p>
                              <p className="text-xs text-muted-foreground">{c.mrn}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{c.diagnosis || '-'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(c.actual_cost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.inacbg_tariff)}</TableCell>
                          <TableCell className="text-right">
                            <span className="text-red-600 font-bold">{formatCurrency(Math.abs(c.difference))}</span>
                            <span className="text-xs text-muted-foreground ml-1">({c.difference_percent?.toFixed(1) || 0}%)</span>
                          </TableCell>
                          <TableCell>{c.los} hari</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{c.loss_reason}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* All Cases Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daftar Semua Kasus</CardTitle>
              <CardDescription>Analisis biaya per kasus (diurutkan dari defisit terbesar)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Billing</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-right">Biaya</TableHead>
                      <TableHead className="text-right">Klaim</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!costCases || costCases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Tidak ada data
                        </TableCell>
                      </TableRow>
                    ) : (
                      costCases.slice(0, 20).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.billing_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{c.patient_name || '-'}</p>
                              <p className="text-xs text-muted-foreground">{c.mrn}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{getVisitTypeLabel(c.visit_type)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(c.actual_cost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.inacbg_tariff)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-medium",
                              c.difference >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {c.difference >= 0 ? '+' : ''}{formatCurrency(c.difference)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.status === 'paid' ? 'default' : 'outline'}>
                              {c.status === 'paid' ? 'Lunas' : c.status === 'pending' ? 'Pending' : c.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Quality Indicators Tab */}
            <TabsContent value="quality" className="mt-0">
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
                <div className="p-6 space-y-6">
          {/* Indicator Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* BOR */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">BOR (Bed Occupancy Rate)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max))
                  )}>
                    {getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max) === 'success' ? 'Normal' : 
                     getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                  </Badge>
                </div>
                <CardDescription>Tingkat hunian tempat tidur</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.bor?.toFixed(1) || 0}%</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.bor_min || 60}% - {standards?.bor_max || 85}%</p>
                </div>
                <Progress value={Math.min(indicators?.bor || 0, 100)} className="h-2" />
              </CardContent>
            </Card>

            {/* ALOS */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">ALOS (Average Length of Stay)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max))
                  )}>
                    {getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max) === 'success' ? 'Normal' : 
                     getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                  </Badge>
                </div>
                <CardDescription>Rata-rata lama rawat inap</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.alos?.toFixed(1) || 0}</span>
                  <span className="text-lg text-muted-foreground ml-1">hari</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.alos_min || 6} - {standards?.alos_max || 9} hari</p>
                </div>
              </CardContent>
            </Card>

            {/* TOI */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">TOI (Turn Over Interval)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max))
                  )}>
                    {getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max) === 'success' ? 'Normal' : 
                     getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                  </Badge>
                </div>
                <CardDescription>Interval pergantian pasien</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.toi?.toFixed(1) || 0}</span>
                  <span className="text-lg text-muted-foreground ml-1">hari</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.toi_min || 1} - {standards?.toi_max || 3} hari</p>
                </div>
              </CardContent>
            </Card>

            {/* BTO */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">BTO (Bed Turn Over)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max))
                  )}>
                    {getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max) === 'success' ? 'Normal' : 
                     getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                  </Badge>
                </div>
                <CardDescription>Frekuensi pemakaian TT per tahun</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.bto?.toFixed(1) || 0}</span>
                  <span className="text-lg text-muted-foreground ml-1">kali</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.bto_min || 40} - {standards?.bto_max || 50}x/tahun</p>
                </div>
              </CardContent>
            </Card>

            {/* NDR */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">NDR (Net Death Rate)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.ndr || 0, undefined, standards?.ndr_max))
                  )}>
                    {(indicators?.ndr || 0) <= (standards?.ndr_max || 25) ? 'Normal' : 'Perhatian'}
                  </Badge>
                </div>
                <CardDescription>Kematian &gt;48 jam (per 1000)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.ndr?.toFixed(1) || 0}</span>
                  <span className="text-lg text-muted-foreground ml-1">‰</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: &lt;{standards?.ndr_max || 25}‰</p>
                </div>
              </CardContent>
            </Card>

            {/* GDR */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">GDR (Gross Death Rate)</CardTitle>
                  <Badge className={cn(
                    getStatusColor(getIndicatorStatus(indicators?.gdr || 0, undefined, standards?.gdr_max))
                  )}>
                    {(indicators?.gdr || 0) <= (standards?.gdr_max || 45) ? 'Normal' : 'Perhatian'}
                  </Badge>
                </div>
                <CardDescription>Kematian keseluruhan (per 1000)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold">{indicators?.gdr?.toFixed(1) || 0}</span>
                  <span className="text-lg text-muted-foreground ml-1">‰</span>
                  <p className="text-sm text-muted-foreground mt-2">Standar: &lt;{standards?.gdr_max || 45}‰</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quality Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Indikator Mutu</CardTitle>
              <CardDescription>Perkembangan BOR dan ALOS bulanan</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={qualityTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bor" name="BOR (%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="alos" name="ALOS (hari)" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Statistics Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Statistik Periode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{qualityMetrics?.total_beds || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Tempat Tidur</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{qualityMetrics?.total_discharges || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Pasien Keluar</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{qualityMetrics?.total_patient_days || 0}</p>
                  <p className="text-sm text-muted-foreground">Hari Perawatan</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{qualityMetrics?.total_deaths || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Kematian</p>
                </div>
              </div>
            </CardContent>
          </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-0">
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
                <div className="p-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Laporan Kendali Mutu & Biaya</CardTitle>
              <CardDescription>Unduh laporan dalam berbagai format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium">Laporan Indikator Mutu</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      BOR, ALOS, TOI, BTO, NDR, GDR
                    </p>
                    <Button variant="outline" disabled>
                      <Calendar className="h-4 w-4 mr-2" />
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium">Laporan Analisis Biaya</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Cost Recovery, Surplus/Defisit, Top Loss Cases
                    </p>
                    <Button variant="outline" disabled>
                      <Calendar className="h-4 w-4 mr-2" />
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
