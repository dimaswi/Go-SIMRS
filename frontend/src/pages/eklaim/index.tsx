import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  eklaimLocalApi,
  eklaimLocalStatusLabels,
  eklaimLocalStatusColors,
  jenisRawatOptions,
} from '@/lib/api/eklaim-local';
import type { DashboardData } from '@/lib/api/eklaim-local';
import {
  qualityCostApi,
  type QualityMetricsResponse,
  type CostAnalysisSummary,
  type CostCaseDetail,
  type TopLossCase,
  type CostByCategory,
  type PendingClaimSummary,
  type QualityTrendPoint,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  FileText,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bed,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

// Chart colors
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Format helpers
const fmtQcCurrency = (value: number): string => {
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const qcVisitTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    outpatient: 'Rawat Jalan', inpatient: 'Rawat Inap', emergency: 'IGD',
    consultation: 'Konsultasi', lab: 'Lab', radiology: 'Radiologi',
  };
  return labels[type] || type;
};

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

export default function EKlaimDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [bulan, setBulan] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState('klaim');

  // Quality-Cost states
  const [qcLoading, setQcLoading] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetricsResponse | null>(null);
  const [qualityTrends, setQualityTrends] = useState<QualityTrendPoint[]>([]);
  const [costSummary, setCostSummary] = useState<CostAnalysisSummary | null>(null);
  const [costCases, setCostCases] = useState<CostCaseDetail[]>([]);
  const [topLossCases, setTopLossCases] = useState<TopLossCase[]>([]);
  const [costByCategory, setCostByCategory] = useState<CostByCategory[]>([]);
  const [pendingClaims, setPendingClaims] = useState<PendingClaimSummary | null>(null);

  const loadDashboard = async (month: string) => {
    setLoading(true);
    try {
      const result = await eklaimLocalApi.getDashboard(month);
      setData(result);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data dashboard.' });
    } finally {
      setLoading(false);
    }
  };

  const loadQualityCostData = useCallback(async () => {
    try {
      setQcLoading(true);

      const [qualityRes, trendsRes, costRes, casesRes, lossRes, categoryRes, claimsRes] = await Promise.all([
        qualityCostApi.getQualityMetrics('month', bulan),
        qualityCostApi.getQualityTrends('year', bulan),
        qualityCostApi.getCostSummary('month', undefined, bulan),
        qualityCostApi.getCostCases({ period: 'month', sort_by: 'date', sort_order: 'desc', month: bulan }),
        qualityCostApi.getTopLossCases('month', bulan),
        qualityCostApi.getCostByCategory('month', bulan),
        qualityCostApi.getPendingClaims(),
      ]);

      if (qualityRes.data.success) setQualityMetrics(qualityRes.data.data);
      if (trendsRes.data.success) setQualityTrends(trendsRes.data.data);
      if (costRes.data.success) setCostSummary(costRes.data.data);
      if (casesRes.data.success) setCostCases(casesRes.data.data);
      if (lossRes.data.success) setTopLossCases(lossRes.data.data);
      if (categoryRes.data.success) setCostByCategory(categoryRes.data.data);
      if (claimsRes.data.success) setPendingClaims(claimsRes.data.data);
    } catch (error) {
      console.error('Failed to load quality-cost data:', error);
    } finally {
      setQcLoading(false);
    }
  }, [bulan]);

  useEffect(() => {
    setPageTitle('Dashboard E-Klaim');
    loadDashboard(bulan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulan]);

  // Load quality-cost data when on QC tab and bulan changes
  // loadQualityCostData reference changes when bulan changes (useCallback dep),
  // which re-triggers this effect automatically.
  useEffect(() => {
    if (activeTab === 'kendali-mutu' || activeTab === 'analisis-biaya') {
      loadQualityCostData();
    }
  }, [activeTab, loadQualityCostData]);

  const fmtNum = (value?: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!num) return '-';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const fmtCurrency = (value?: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!num) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const fmtDate = (dateString?: string) => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId }); } catch { return dateString; }
  };

  const jenisLabel = (val: string) => jenisRawatOptions.find((o) => o.value === val)?.label || val || '-';
  const kelasLabel = (k: string) => ({ '1': 'Kelas 1', '2': 'Kelas 2', '3': 'Kelas 3' }[k] || k || '-');

  const prevMonth = () => {
    const [y, m] = bulan.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setBulan(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = bulan.split('-').map(Number);
    const d = new Date(y, m, 1);
    setBulan(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const bulanLabel = () => {
    try {
      const [y, m] = bulan.split('-').map(Number);
      return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: localeId });
    } catch { return bulan; }
  };

  const totalPending = data
    ? data.pending_actions.draft + data.pending_actions.new_claim + data.pending_actions.pending_grouper + data.pending_actions.pending_final + data.pending_actions.pending_send
    : 0;

  const maxDailyTarif = data?.daily_claims?.length
    ? Math.max(...data.daily_claims.map((d) => Math.max(d.total_inacbg, d.total_tarif_rs)), 1)
    : 1;

  const selisih = data ? data.financial.total_tarif_rs - data.financial.total_inacbg_tariff : 0;

  // Quality-cost derived
  const indicators = qualityMetrics?.indicators;
  const standards = indicators?.standards;

  if (loading && !data) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard E-Klaim
          </h1>
          <p className="text-sm text-muted-foreground">Ringkasan dan monitoring klaim BPJS</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center capitalize">{bulanLabel()}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Financial Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Jumlah Klaim</p>
              <p className="text-xl font-bold mt-0.5">{data.total_claims}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarif INACBG</p>
              <p className="text-base font-semibold text-blue-600 font-mono mt-0.5">{fmtCurrency(data.financial.total_inacbg_tariff)}</p>
              <p className="text-[11px] text-muted-foreground font-mono">Avg {fmtCurrency(data.financial.avg_inacbg_tariff)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarif RS</p>
              <p className="text-base font-semibold text-green-600 font-mono mt-0.5">{fmtCurrency(data.financial.total_tarif_rs)}</p>
              <p className="text-[11px] text-muted-foreground font-mono">Avg {fmtCurrency(data.financial.avg_tarif_rs)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Selisih (RS - INACBG)</p>
              <p className={`text-base font-semibold font-mono mt-0.5 ${selisih > 0 ? 'text-red-600' : selisih < 0 ? 'text-emerald-600' : ''}`}>
                {selisih !== 0 ? (selisih > 0 ? '+' : '') + fmtNum(selisih) : '-'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selisih > 0 ? 'RS lebih tinggi' : selisih < 0 ? 'INACBG lebih tinggi' : ''}
              </p>
            </div>
          </div>

          {/* Tabs: Klaim + Kendali Mutu + Analisis Biaya */}
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="inline" className="w-full">
            <TabsList>
              <TabsTrigger value="klaim">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Klaim
                {totalPending > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {totalPending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="kendali-mutu">
                <Activity className="mr-2 h-4 w-4" />
                Kendali Mutu
              </TabsTrigger>
              <TabsTrigger value="analisis-biaya">
                <DollarSign className="mr-2 h-4 w-4" />
                Analisis Biaya
              </TabsTrigger>
            </TabsList>

            {/* === Tab: Klaim === */}
            <TabsContent value="klaim" className="mt-6 space-y-4">
              {/* Pending Actions */}
              {totalPending > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Perlu tindakan:
                  </span>
                  {data.pending_actions.draft > 0 && (
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => navigate('/eklaim/data-klaim?status=draft')}>
                      <Pencil className="h-3 w-3 mr-1" /> {data.pending_actions.draft} Draft
                    </Badge>
                  )}
                  {data.pending_actions.new_claim > 0 && (
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted text-blue-700 border-blue-200" onClick={() => navigate('/eklaim/data-klaim?status=new_claim')}>
                      <FileText className="h-3 w-3 mr-1" /> {data.pending_actions.new_claim} Perlu Set Data
                    </Badge>
                  )}
                  {data.pending_actions.pending_grouper > 0 && (
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted text-purple-700 border-purple-200" onClick={() => navigate('/eklaim/data-klaim?status=set_claim_data')}>
                      <Clock className="h-3 w-3 mr-1" /> {data.pending_actions.pending_grouper} Perlu Grouper
                    </Badge>
                  )}
                  {data.pending_actions.pending_final > 0 && (
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted text-indigo-700 border-indigo-200" onClick={() => navigate('/eklaim/data-klaim?status=idrg_grouped')}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {data.pending_actions.pending_final} Perlu Final
                    </Badge>
                  )}
                  {data.pending_actions.pending_send > 0 && (
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted text-green-700 border-green-200" onClick={() => navigate('/eklaim/data-klaim?status=claim_final')}>
                      <Send className="h-3 w-3 mr-1" /> {data.pending_actions.pending_send} Perlu Kirim
                    </Badge>
                  )}
                </div>
              )}
                {/* Chart + Status + Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Daily Tariff Chart */}
                  <div className="lg:col-span-5 rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Tarif Harian</h3>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> INACBG</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> RS</span>
                      </div>
                    </div>
                    {data.daily_claims?.length > 0 ? (
                      <div className="flex gap-[3px]" style={{ height: '112px' }}>
                        {data.daily_claims.map((d) => {
                          const hINACBG = Math.max((d.total_inacbg / maxDailyTarif) * 96, 2);
                          const hRS = Math.max((d.total_tarif_rs / maxDailyTarif) * 96, 2);
                          const dayNum = d.date.split('-')[2];
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center group" title={`${fmtDate(d.date)}\nINACBG: ${fmtCurrency(d.total_inacbg)}\nRS: ${fmtCurrency(d.total_tarif_rs)}\n${d.count} klaim`}>
                              <div className="flex-1 w-full flex gap-[1px] items-end">
                                <div className="flex-1 bg-blue-400 rounded-t hover:bg-blue-500 transition-colors" style={{ height: `${hINACBG}px` }} />
                                <div className="flex-1 bg-green-400 rounded-t hover:bg-green-500 transition-colors" style={{ height: `${hRS}px` }} />
                              </div>
                              <span className="text-[8px] text-muted-foreground leading-none mt-1">{dayNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
                    )}
                  </div>

                  {/* Status Distribution */}
                  <div className="lg:col-span-4 rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-3">Distribusi Status</h3>
                    {data.status_counts?.length > 0 ? (
                      <div className="space-y-1.5">
                        {data.status_counts.map((s) => {
                          const pct = data.total_claims > 0 ? (s.count / data.total_claims) * 100 : 0;
                          return (
                            <div key={s.status} className="flex items-center gap-2">
                              <Badge className={`${eklaimLocalStatusColors[s.status] || ''} text-[10px] min-w-[90px] justify-center h-5`}>
                                {eklaimLocalStatusLabels[s.status] || s.status}
                              </Badge>
                              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                              </div>
                              <span className="text-xs font-mono w-6 text-right">{s.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">-</p>
                    )}
                  </div>

                  {/* Jenis & Kelas Rawat */}
                  <div className="lg:col-span-3 rounded-lg border p-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Jenis Rawat</h3>
                      {data.jenis_rawat_counts?.length > 0 ? (
                        <div className="space-y-1">
                          {data.jenis_rawat_counts.map((j) => (
                            <div key={j.jenis_rawat} className="flex items-center justify-between text-sm">
                              <span>{jenisLabel(j.jenis_rawat)}</span>
                              <span className="font-mono font-medium">{j.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">-</p>}
                    </div>
                    <hr />
                    <div>
                      <h3 className="text-sm font-medium mb-2">Kelas Rawat</h3>
                      {data.kelas_rawat_counts?.length > 0 ? (
                        <div className="space-y-1">
                          {data.kelas_rawat_counts.map((k) => (
                            <div key={k.kelas_rawat} className="flex items-center justify-between text-sm">
                              <span>{kelasLabel(k.kelas_rawat)}</span>
                              <span className="font-mono font-medium">{k.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">-</p>}
                    </div>
                  </div>
                </div>

                {/* Bottom: Top CBG + Recent Claims */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top CBG */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-3">Top Kode INACBG</h3>
                    {data.top_cbg?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b">
                            <th className="text-left pb-1.5 font-medium">#</th>
                            <th className="text-left pb-1.5 font-medium">Kode</th>
                            <th className="text-left pb-1.5 font-medium">Deskripsi</th>
                            <th className="text-right pb-1.5 font-medium">Jml</th>
                            <th className="text-right pb-1.5 font-medium">Total Tarif</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_cbg.map((cbg, i) => (
                            <tr key={cbg.cbg_code} className="border-b border-dashed last:border-0">
                              <td className="py-1 text-muted-foreground">{i + 1}</td>
                              <td className="py-1 font-mono text-xs font-medium">{cbg.cbg_code}</td>
                              <td className="py-1 text-xs truncate max-w-[200px]" title={cbg.cbg_description}>{cbg.cbg_description}</td>
                              <td className="py-1 text-right font-mono">{cbg.count}</td>
                              <td className="py-1 text-right font-mono text-xs">{fmtCurrency(cbg.total_tariff)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Belum ada data INACBG</p>
                    )}
                  </div>

                  {/* Recent Claims */}
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Klaim Terbaru</h3>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => navigate('/eklaim/data-klaim')}>
                        Semua <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                    {data.recent_claims?.length > 0 ? (
                      <div className="space-y-0">
                        {data.recent_claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="flex items-center gap-3 py-2 border-b border-dashed last:border-0 hover:bg-muted/30 cursor-pointer -mx-1 px-1 rounded transition-colors"
                            onClick={() => navigate(`/eklaim/data-klaim/${claim.id}`)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{claim.nama_pasien}</span>
                                <Badge className={`${eklaimLocalStatusColors[claim.status] || ''} text-[10px] h-4 px-1.5`}>
                                  {eklaimLocalStatusLabels[claim.status] || claim.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <span className="font-mono">{claim.no_sep}</span>
                                <span className="text-muted-foreground/40">|</span>
                                <span>{fmtDate(claim.tgl_masuk)}</span>
                                {claim.inacbg_cbg_code && (
                                  <>
                                    <span className="text-muted-foreground/40">|</span>
                                    <span className="font-mono font-medium">{claim.inacbg_cbg_code}</span>
                                    {claim.inacbg_tariff && <span className="text-blue-600">{fmtCurrency(claim.inacbg_tariff)}</span>}
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Belum ada klaim</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* === Tab: Kendali Mutu === */}
              <TabsContent value="kendali-mutu" className="mt-6 space-y-6">
                {qcLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-lg border p-4">
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
                      </div>

                      <div className="rounded-lg border p-4">
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
                                {fmtQcCurrency(Math.abs(costSummary?.net_balance || 0))}
                              </span>
                            </div>
                          </div>
                      </div>

                      <div className="rounded-lg border p-4">
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
                      </div>

                      <div className="rounded-lg border p-4">
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
                      </div>
                    </div>

                    {/* Indicator Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">BOR (Bed Occupancy Rate)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max)))}>
                              {getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max) === 'success' ? 'Normal' :
                               getIndicatorStatus(indicators?.bor || 0, standards?.bor_min, standards?.bor_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Tingkat hunian tempat tidur</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.bor?.toFixed(1) || 0}%</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.bor_min || 60}% - {standards?.bor_max || 85}%</p>
                          </div>
                          <Progress value={Math.min(indicators?.bor || 0, 100)} className="h-2" />
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">ALOS (Average Length of Stay)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max)))}>
                              {getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max) === 'success' ? 'Normal' :
                               getIndicatorStatus(indicators?.alos || 0, standards?.alos_min, standards?.alos_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Rata-rata lama rawat inap</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.alos?.toFixed(1) || 0}</span>
                            <span className="text-lg text-muted-foreground ml-1">hari</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.alos_min || 6} - {standards?.alos_max || 9} hari</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">TOI (Turn Over Interval)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max)))}>
                              {getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max) === 'success' ? 'Normal' :
                               getIndicatorStatus(indicators?.toi || 0, standards?.toi_min, standards?.toi_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Interval pergantian pasien</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.toi?.toFixed(1) || 0}</span>
                            <span className="text-lg text-muted-foreground ml-1">hari</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.toi_min || 1} - {standards?.toi_max || 3} hari</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">BTO (Bed Turn Over)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max)))}>
                              {getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max) === 'success' ? 'Normal' :
                               getIndicatorStatus(indicators?.bto || 0, standards?.bto_min, standards?.bto_max) === 'warning' ? 'Perhatian' : 'Kritis'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Frekuensi pemakaian TT per tahun</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.bto?.toFixed(1) || 0}</span>
                            <span className="text-lg text-muted-foreground ml-1">kali</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: {standards?.bto_min || 40} - {standards?.bto_max || 50}x/tahun</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">NDR (Net Death Rate)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.ndr || 0, undefined, standards?.ndr_max)))}>
                              {(indicators?.ndr || 0) <= (standards?.ndr_max || 25) ? 'Normal' : 'Perhatian'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Kematian &gt;48 jam (per 1000)</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.ndr?.toFixed(1) || 0}</span>
                            <span className="text-lg text-muted-foreground ml-1">‰</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: &lt;{standards?.ndr_max || 25}‰</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">GDR (Gross Death Rate)</h4>
                            <Badge className={cn(getStatusColor(getIndicatorStatus(indicators?.gdr || 0, undefined, standards?.gdr_max)))}>
                              {(indicators?.gdr || 0) <= (standards?.gdr_max || 45) ? 'Normal' : 'Perhatian'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Kematian keseluruhan (per 1000)</p>
                        </div>
                        <div className="p-4 pt-0">
                          <div className="text-center py-4">
                            <span className="text-4xl font-bold">{indicators?.gdr?.toFixed(1) || 0}</span>
                            <span className="text-lg text-muted-foreground ml-1">‰</span>
                            <p className="text-sm text-muted-foreground mt-2">Standar: &lt;{standards?.gdr_max || 45}‰</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quality Trends Chart */}
                    <div className="rounded-lg border">
                      <div className="p-6 pb-2">
                        <h3 className="text-base font-semibold">Tren Indikator Mutu</h3>
                        <p className="text-sm text-muted-foreground">Perkembangan BOR dan ALOS bulanan</p>
                      </div>
                      <div className="p-6 pt-0">
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
                      </div>
                    </div>

                    {/* Statistics Summary */}
                    <div className="rounded-lg border">
                      <div className="p-6 pb-2">
                        <h3 className="text-base font-semibold">Data Statistik Periode</h3>
                      </div>
                      <div className="p-6 pt-0">
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
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* === Tab: Analisis Biaya === */}
              <TabsContent value="analisis-biaya" className="mt-6 space-y-6">
                {qcLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Charts Row */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <h3 className="text-base font-semibold">Perbandingan Biaya vs Klaim</h3>
                          <p className="text-sm text-muted-foreground">Total biaya aktual vs klaim BPJS</p>
                        </div>
                        <div className="p-4 pt-0">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={[
                              { name: 'Biaya Aktual', value: costSummary?.total_actual_cost || 0 },
                              { name: 'Klaim BPJS', value: costSummary?.total_claim_amount || 0 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="name" fontSize={11} />
                              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                              <Tooltip formatter={(value: number) => fmtQcCurrency(value)} />
                              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <h3 className="text-base font-semibold">Distribusi Biaya</h3>
                          <p className="text-sm text-muted-foreground">Breakdown biaya per kategori</p>
                        </div>
                        <div className="p-4 pt-0">
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
                              <Tooltip formatter={(value: number) => fmtQcCurrency(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <h4 className="text-sm font-medium">Kasus Surplus vs Defisit</h4>
                        </div>
                        <div className="p-4 pt-0 space-y-3">
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
                              <span className="font-medium text-green-600">{fmtQcCurrency(costSummary?.total_surplus || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm text-muted-foreground">Total Defisit</span>
                              <span className="font-medium text-red-600">-{fmtQcCurrency(costSummary?.total_deficit || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <h4 className="text-sm font-medium">Klaim Tertunda</h4>
                        </div>
                        <div className="p-4 pt-0 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Total Klaim</span>
                            <span className="font-bold">{pendingClaims?.total_pending_claims || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Nilai Tertunda</span>
                            <span className="font-bold">{fmtQcCurrency(pendingClaims?.total_pending_amount || 0)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Terlama</span>
                            <Badge variant={pendingClaims?.oldest_pending_days && pendingClaims.oldest_pending_days > 30 ? "destructive" : "secondary"}>
                              {pendingClaims?.oldest_pending_days || 0} hari
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <div className="p-4 pb-2">
                          <h4 className="text-sm font-medium">Rasio Biaya Obat</h4>
                        </div>
                        <div className="p-4 pt-0 space-y-3">
                          <div className="text-center py-2">
                            <span className="text-3xl font-bold">{costSummary?.drug_cost_ratio?.toFixed(1) || 0}%</span>
                            <p className="text-xs text-muted-foreground mt-1">dari total biaya</p>
                          </div>
                          <Progress value={costSummary?.drug_cost_ratio || 0} className="h-2" />
                          <p className="text-xs text-muted-foreground text-center">Standar ideal: 20-30%</p>
                        </div>
                      </div>
                    </div>

                    {/* Top Loss Cases */}
                    <div className="rounded-lg border">
                      <div className="p-6 pb-2">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Kasus dengan Selisih Rugi Terbesar
                        </h3>
                        <p className="text-sm text-muted-foreground">Kasus BPJS dengan biaya melebihi tarif INA-CBG</p>
                      </div>
                      <div className="px-6 pb-6">
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
                                    <TableCell className="text-right font-medium">{fmtQcCurrency(c.actual_cost)}</TableCell>
                                    <TableCell className="text-right">{fmtQcCurrency(c.inacbg_tariff)}</TableCell>
                                    <TableCell className="text-right">
                                      <span className="text-red-600 font-bold">{fmtQcCurrency(Math.abs(c.difference))}</span>
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
                      </div>
                    </div>

                    {/* All Cases Table */}
                    <div className="rounded-lg border">
                      <div className="p-6 pb-2">
                        <h3 className="text-base font-semibold">Daftar Semua Kasus</h3>
                        <p className="text-sm text-muted-foreground">Analisis biaya per kasus (diurutkan dari defisit terbesar)</p>
                      </div>
                      <div className="px-6 pb-6">
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
                                      <Badge variant="secondary" className="text-xs">{qcVisitTypeLabel(c.visit_type)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{fmtQcCurrency(c.actual_cost)}</TableCell>
                                    <TableCell className="text-right">{fmtQcCurrency(c.inacbg_tariff)}</TableCell>
                                    <TableCell className="text-right">
                                      <span className={cn("font-medium",
                                        c.difference >= 0 ? "text-green-600" : "text-red-600"
                                      )}>
                                        {c.difference >= 0 ? '+' : ''}{fmtQcCurrency(c.difference)}
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
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
