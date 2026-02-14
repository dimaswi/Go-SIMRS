import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { billingApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  Search,
  Receipt,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Banknote,
  Shield,
  Heart,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface BillableRegistration {
  id: number;
  registration_number: string;
  registration_type: string;
  status: string;
  payment_method: string;
  bpjs_number?: string;
  insurance_name?: string;
  created_at?: string;
  CreatedAt?: string;
  registration_date?: string;
  patient?: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
  };
  visit_count: number;
  main_visit_id?: number;
  main_visit_type?: string;
  main_room_name?: string;
  has_billing?: boolean;
  billing_id?: number;
  billing_status?: string;
  billing_number?: string;
  total_amount?: number;
  remaining_amount?: number;
}

type TabFilter = 'all' | 'need_billing' | 'need_payment' | 'paid';

const visitTypeLabels: Record<string, string> = {
  outpatient: 'Rawat Jalan',
  inpatient: 'Rawat Inap',
  emergency: 'UGD',
  surgery: 'Operasi',
};

export default function BillingIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<BillableRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await billingApi.getBillableRegistrations({ limit: 50 });
      setRegistrations(response.data || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Kasir');
    loadData();
  }, [loadData]);

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatSmartDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isToday(date)) return `Hari ini, ${format(date, 'HH:mm', { locale: localeId })}`;
    if (isYesterday(date)) return `Kemarin, ${format(date, 'HH:mm', { locale: localeId })}`;
    return format(date, 'dd MMM yyyy, HH:mm', { locale: localeId });
  };

  // Filter registrations
  const filtered = useMemo(() => {
    let data = registrations;

    // Tab filter
    switch (activeTab) {
      case 'need_billing':
        data = data.filter(r => !r.has_billing && (r.status === 'completed' || r.status === 'discharged'));
        break;
      case 'need_payment':
        data = data.filter(r => r.has_billing && r.billing_status !== 'paid' && r.billing_status !== 'cancelled');
        break;
      case 'paid':
        data = data.filter(r => r.has_billing && r.billing_status === 'paid');
        break;
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.patient?.nama_lengkap?.toLowerCase().includes(q) ||
        r.patient?.no_rm?.toLowerCase().includes(q) ||
        r.registration_number?.toLowerCase().includes(q) ||
        r.billing_number?.toLowerCase().includes(q)
      );
    }

    return data;
  }, [registrations, activeTab, search]);

  // Stats
  const stats = useMemo(() => {
    const needBilling = registrations.filter(r => !r.has_billing && (r.status === 'completed' || r.status === 'discharged')).length;
    const needPayment = registrations.filter(r => r.has_billing && r.billing_status !== 'paid' && r.billing_status !== 'cancelled').length;
    const paid = registrations.filter(r => r.has_billing && r.billing_status === 'paid').length;
    return { all: registrations.length, needBilling, needPayment, paid };
  }, [registrations]);

  const tabs: { key: TabFilter; label: string; count: number; icon: React.ReactNode; color?: string }[] = [
    { key: 'all', label: 'Semua', count: stats.all, icon: <Users className="h-4 w-4" /> },
    { key: 'need_billing', label: 'Perlu Tagihan', count: stats.needBilling, icon: <Receipt className="h-4 w-4" />, color: 'text-amber-600' },
    { key: 'need_payment', label: 'Belum Bayar', count: stats.needPayment, icon: <Clock className="h-4 w-4" />, color: 'text-blue-600' },
    { key: 'paid', label: 'Lunas', count: stats.paid, icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
  ];

  const PaymentMethodIcon = ({ method }: { method: string }) => {
    switch (method) {
      case 'bpjs': return <Shield className="h-3.5 w-3.5" />;
      case 'insurance': return <Heart className="h-3.5 w-3.5" />;
      default: return <Banknote className="h-3.5 w-3.5" />;
    }
  };

  const paymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bpjs': return 'BPJS';
      case 'insurance': return 'Asuransi';
      default: return 'Tunai';
    }
  };

  const getBillingStatusStyle = (reg: BillableRegistration) => {
    if (!reg.has_billing) {
      if (reg.status === 'completed' || reg.status === 'discharged') {
        return { label: 'Perlu Tagihan', variant: 'outline' as const, className: 'border-amber-500 text-amber-600 bg-amber-50' };
      }
      return { label: 'Belum Selesai', variant: 'outline' as const, className: 'text-muted-foreground' };
    }
    switch (reg.billing_status) {
      case 'draft': return { label: 'Draft', variant: 'secondary' as const, className: '' };
      case 'pending': return { label: 'Menunggu Bayar', variant: 'outline' as const, className: 'border-yellow-500 text-yellow-600 bg-yellow-50' };
      case 'partial': return { label: 'Bayar Sebagian', variant: 'outline' as const, className: 'border-blue-500 text-blue-600 bg-blue-50' };
      case 'paid': return { label: 'Lunas', variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' };
      case 'cancelled': return { label: 'Dibatalkan', variant: 'destructive' as const, className: '' };
      default: return { label: reg.billing_status || '', variant: 'secondary' as const, className: '' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Kasir</h1>
          <p className="text-sm text-muted-foreground">Kelola tagihan dan pembayaran pasien</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tab Filters */}
      <div className="flex items-center gap-4 border-b w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-1.5 px-1 pb-2 text-sm font-medium transition-all border-b-2 -mb-px
              ${activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }
            `}
          >
            <span className={activeTab === tab.key ? (tab.color || '') : ''}>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center
                ${activeTab === tab.key
                  ? (tab.key === 'need_billing' ? 'bg-amber-100 text-amber-700'
                    : tab.key === 'need_payment' ? 'bg-blue-100 text-blue-700'
                    : tab.key === 'paid' ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground')
                  : 'bg-muted text-muted-foreground'
                }
              `}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, No. RM, atau No. Registrasi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'Tidak ada hasil pencarian' : 'Belum ada data'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(reg => {
            const statusStyle = getBillingStatusStyle(reg);
            const isActionable = !reg.has_billing
              ? (reg.status === 'completed' || reg.status === 'discharged')
              : reg.billing_status !== 'paid' && reg.billing_status !== 'cancelled';

            return (
              <button
                key={reg.id}
                onClick={() => reg.main_visit_id && navigate(`/billing/${reg.main_visit_id}`)}
                disabled={!reg.main_visit_id}
                className={`
                  w-full text-left rounded-lg border p-3 sm:p-4 transition-all
                  hover:border-primary/30 hover:shadow-sm hover:bg-accent/30
                  ${isActionable ? 'border-l-4 border-l-primary/60' : ''}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                `}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Patient Avatar */}
                  <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                    {reg.patient?.nama_lengkap
                      ? reg.patient.nama_lengkap.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
                      : '?'
                    }
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm truncate">{reg.patient?.nama_lengkap || '-'}</span>
                      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{reg.patient?.no_rm}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <PaymentMethodIcon method={reg.payment_method} />
                        {paymentMethodLabel(reg.payment_method)}
                      </span>
                      <span className="text-muted-foreground/30">|</span>
                      <span>{reg.main_room_name || visitTypeLabels[reg.main_visit_type || ''] || '-'}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatSmartDate(reg.registration_date || reg.created_at || reg.CreatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Amount + Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {reg.has_billing && reg.total_amount ? (
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold font-mono">{formatCurrency(reg.total_amount)}</div>
                        {reg.remaining_amount !== undefined && reg.remaining_amount > 0 && reg.billing_status !== 'cancelled' && (
                          <div className="text-xs text-red-500 font-mono">Sisa {formatCurrency(reg.remaining_amount)}</div>
                        )}
                      </div>
                    ) : null}
                    <Badge variant={statusStyle.variant} className={`text-xs whitespace-nowrap ${statusStyle.className}`}>
                      {statusStyle.label}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 hidden sm:block" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
