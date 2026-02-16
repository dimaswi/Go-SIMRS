import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  eklaimLocalApi,
  eklaimLocalStatusLabels,
  eklaimLocalStatusColors,
  jenisRawatOptions,
} from '@/lib/api/eklaim-local';
import type { DashboardData, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EKlaimDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [bulan, setBulan] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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

  useEffect(() => {
    setPageTitle('Dashboard E-Klaim');
    loadDashboard(bulan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulan]);

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

  if (loading && !data) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
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
        </>
      ) : null}
    </div>
  );
}
