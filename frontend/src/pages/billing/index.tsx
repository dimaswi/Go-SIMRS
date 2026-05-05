import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { billingApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { cn } from '@/lib/utils';
import {
  Loader2,
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

const BILLING_DEFAULT_TAB: TabFilter = 'all';

const normalizeBillingTab = (value: string | null | undefined): TabFilter => {
  switch (value) {
    case 'need_billing':
    case 'need_payment':
    case 'paid':
      return value;
    default:
      return BILLING_DEFAULT_TAB;
  }
};

const visitTypeLabels: Record<string, string> = {
  outpatient: 'Rawat Jalan',
  inpatient: 'Rawat Inap',
  emergency: 'UGD',
  surgery: 'Operasi',
};

export default function BillingIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<BillableRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>(() => normalizeBillingTab(searchParams.get('statusView')));
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    const nextTab = normalizeBillingTab(searchParams.get('statusView'));
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (activeTab !== BILLING_DEFAULT_TAB) nextParams.set('statusView', activeTab);
    else nextParams.delete('statusView');

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

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

  const filtered = useMemo(() => {
    let data = registrations;

    switch (activeTab) {
      case 'need_billing':
        data = data.filter((registration) => !registration.has_billing && (registration.status === 'completed' || registration.status === 'discharged'));
        break;
      case 'need_payment':
        data = data.filter((registration) => registration.has_billing && registration.billing_status !== 'paid' && registration.billing_status !== 'cancelled');
        break;
      case 'paid':
        data = data.filter((registration) => registration.has_billing && registration.billing_status === 'paid');
        break;
      default:
        break;
    }

    return data;
  }, [activeTab, registrations]);

  const stats = useMemo(() => {
    const needBilling = registrations.filter((registration) => !registration.has_billing && (registration.status === 'completed' || registration.status === 'discharged')).length;
    const needPayment = registrations.filter((registration) => registration.has_billing && registration.billing_status !== 'paid' && registration.billing_status !== 'cancelled').length;
    const paid = registrations.filter((registration) => registration.has_billing && registration.billing_status === 'paid').length;

    return {
      all: registrations.length,
      needBilling,
      needPayment,
      paid,
    };
  }, [registrations]);

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Semua', count: stats.all },
    { key: 'need_billing', label: 'Perlu Tagihan', count: stats.needBilling },
    { key: 'need_payment', label: 'Belum Bayar', count: stats.needPayment },
    { key: 'paid', label: 'Lunas', count: stats.paid },
  ];

  const totalStatusCount = useMemo(
    () => tabs.reduce((sum, tab) => sum + tab.count, 0),
    [tabs],
  );

  const PaymentMethodIcon = ({ method }: { method: string }) => {
    switch (method) {
      case 'bpjs':
        return <Shield className="h-3.5 w-3.5" />;
      case 'insurance':
        return <Heart className="h-3.5 w-3.5" />;
      default:
        return <Banknote className="h-3.5 w-3.5" />;
    }
  };

  const paymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bpjs':
        return 'BPJS';
      case 'insurance':
        return 'Asuransi';
      default:
        return 'Tunai';
    }
  };

  const getBillingStatusStyle = (registration: BillableRegistration) => {
    if (!registration.has_billing) {
      if (registration.status === 'completed' || registration.status === 'discharged') {
        return { label: 'Perlu Tagihan', variant: 'outline' as const, className: 'border-amber-500 text-amber-600 bg-amber-50' };
      }

      return { label: 'Belum Selesai', variant: 'outline' as const, className: 'text-muted-foreground' };
    }

    switch (registration.billing_status) {
      case 'draft':
        return { label: 'Draft', variant: 'secondary' as const, className: '' };
      case 'pending':
        return { label: 'Menunggu Bayar', variant: 'outline' as const, className: 'border-yellow-500 text-yellow-600 bg-yellow-50' };
      case 'partial':
        return { label: 'Bayar Sebagian', variant: 'outline' as const, className: 'border-blue-500 text-blue-600 bg-blue-50' };
      case 'paid':
        return { label: 'Lunas', variant: 'default' as const, className: 'bg-green-600 hover:bg-green-600' };
      case 'cancelled':
        return { label: 'Dibatalkan', variant: 'destructive' as const, className: '' };
      default:
        return { label: registration.billing_status || '', variant: 'secondary' as const, className: '' };
    }
  };

  const billingColumns: ColumnDef<BillableRegistration>[] = [
    {
      id: 'patient',
      accessorFn: (registration) => [
        registration.patient?.nama_lengkap,
        registration.patient?.no_rm,
        registration.registration_number,
        registration.billing_number,
      ].filter(Boolean).join(' '),
      header: 'Pasien',
      cell: ({ row }) => {
        const registration = row.original;

        return (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {registration.patient?.nama_lengkap || 'Pasien tanpa nama'}
              </span>
              <Badge variant="outline" className="font-mono text-[11px]">
                {registration.patient?.no_rm || '-'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{registration.registration_number}</span>
              {registration.billing_number && (
                <span className="font-mono">{registration.billing_number}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'service',
      accessorFn: (registration) => [
        visitTypeLabels[registration.main_visit_type || registration.registration_type] || registration.main_visit_type || registration.registration_type,
        registration.main_room_name,
        registration.registration_date || registration.created_at || registration.CreatedAt,
      ].filter(Boolean).join(' '),
      header: 'Layanan',
      cell: ({ row }) => {
        const registration = row.original;
        const visitLabel = visitTypeLabels[registration.main_visit_type || registration.registration_type] || registration.main_visit_type || registration.registration_type || '-';

        return (
          <div className="space-y-1 text-sm">
            <div className="font-medium text-foreground">{visitLabel}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {registration.main_room_name && <span>{registration.main_room_name}</span>}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatSmartDate(registration.registration_date || registration.created_at || registration.CreatedAt)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'payment_method',
      header: 'Pembayaran',
      cell: ({ row }) => {
        const registration = row.original;

        return (
          <Badge variant="outline" className="inline-flex gap-1 text-xs">
            <PaymentMethodIcon method={registration.payment_method} />
            {paymentMethodLabel(registration.payment_method)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Total',
      cell: ({ row }) => {
        const registration = row.original;

        return (
          <div className="text-sm">
            <div className="font-medium tabular-nums text-foreground">
              {formatCurrency(registration.total_amount)}
            </div>
            {!!registration.has_billing && (registration.remaining_amount || 0) > 0 && (
              <div className="text-xs font-mono text-red-500">
                Sisa {formatCurrency(registration.remaining_amount)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      accessorFn: (registration) => getBillingStatusStyle(registration).label,
      header: 'Status',
      cell: ({ row }) => {
        const statusStyle = getBillingStatusStyle(row.original);

        return (
          <Badge variant={statusStyle.variant} className={`whitespace-nowrap text-xs ${statusStyle.className}`}>
            {statusStyle.label}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => {
        const registration = row.original;
        const detailPath = registration.main_visit_id ? `/billing/${registration.main_visit_id}` : null;

        if (!detailPath) {
          return <span className="text-xs text-muted-foreground">Tidak tersedia</span>;
        }

        return (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate(detailPath)}>
            Buka
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        );
      },
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Kasir"
        description="Kelola tagihan dan pembayaran pasien"
        count={filtered.length}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant={statusOpen ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 gap-2 text-xs"
              onClick={() => setStatusOpen((prev) => !prev)}
            >
              <span className="max-w-[140px] truncate font-medium text-foreground">{tabs.find((tab) => tab.key === activeTab)?.label || 'Semua'}</span>
              {totalStatusCount > 0 && (
                <Badge className="h-5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-600">
                  {totalStatusCount}
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadData}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
        <CollapsibleContent>
          <div className="border-border bg-muted/15 px-6 py-2">
            <div className="flex min-w-0 overflow-x-auto border-y border-border bg-background">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'min-w-[148px] border-r border-border px-3 py-2 text-left transition-colors last:border-r-0',
                      isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</span>
                      {tab.count > 0 ? (
                        <Badge className="h-5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-600">
                          {tab.count}
                        </Badge>
                      ) : (
                        <span className="text-[11px] tabular-nums text-muted-foreground">0</span>
                      )}
                    </div>
                    <div className={cn('mt-1 text-sm font-medium', isActive && 'text-foreground')}>{tab.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <PageContent className="py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataTable
            columns={billingColumns}
            data={filtered}
            searchPlaceholder="Cari pasien, No. RM, no. registrasi, atau no. billing..."
          />
        )}
      </PageContent>
    </PageShell>
  );
}
