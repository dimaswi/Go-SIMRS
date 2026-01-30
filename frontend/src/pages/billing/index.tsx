import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { billingApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, FileText, ReceiptText } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BillableRegistration {
  id: number;
  registration_number: string;
  registration_type: string;
  status: string;
  payment_method: string;
  bpjs_number?: string;
  insurance_name?: string;
  created_at?: string;
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

const paymentMethodLabels: Record<string, string> = {
  cash: 'Tunai',
  bpjs: 'BPJS',
  insurance: 'Asuransi',
};

const registrationStatusLabels: Record<string, string> = {
  pending: 'Pending',
  registered: 'Terdaftar',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  discharged: 'Pulang',
  cancelled: 'Dibatalkan',
};

const registrationStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500 text-black',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  discharged: 'bg-purple-500',
  cancelled: 'bg-red-500',
};

const billingStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
};

const billingStatusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending: 'bg-yellow-500 text-black',
  partial: 'bg-blue-500',
  paid: 'bg-green-500',
  cancelled: 'bg-red-500',
};

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

  const loadData = useCallback(async () => {
    try {
      const response = await billingApi.getBillableRegistrations();
      setRegistrations(response.data || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data pendaftaran.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Kasir');
    loadData();
  }, [loadData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: id });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: ColumnDef<BillableRegistration>[] = [
    {
      accessorKey: 'registration_number',
      header: 'No. Registrasi',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.registration_number}</span>
          {row.original.billing_number && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <ReceiptText className="h-3 w-3" />
              {row.original.billing_number}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'patient.nama_lengkap',
      header: 'Pasien',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.patient?.nama_lengkap || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.original.patient?.no_rm || '-'}</div>
        </div>
      ),
    },
    {
      accessorKey: 'main_room_name',
      header: 'Layanan',
      cell: ({ row }) => (
        <div>
          <div>{row.original.main_room_name || '-'}</div>
          <div className="text-xs text-muted-foreground">
            {visitTypeLabels[row.original.main_visit_type || ''] || row.original.main_visit_type}
            {row.original.visit_count > 1 && (
              <span className="ml-1">({row.original.visit_count} kunjungan)</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: 'Pembayaran',
      cell: ({ row }) => (
        <Badge variant={row.original.payment_method === 'bpjs' ? 'default' : 'secondary'}>
          {paymentMethodLabels[row.original.payment_method || ''] || row.original.payment_method}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={registrationStatusColors[row.original.status] || ''}>
          {registrationStatusLabels[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Tanggal',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      accessorKey: 'total_amount',
      header: 'Total',
      cell: ({ row }) => {
        if (row.original.has_billing) {
          return (
            <div>
              <div className="font-medium">{formatCurrency(row.original.total_amount)}</div>
              {row.original.remaining_amount !== undefined && row.original.remaining_amount > 0 && (
                <div className="text-xs text-muted-foreground">
                  Sisa: {formatCurrency(row.original.remaining_amount)}
                </div>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: 'billing_status',
      header: 'Tagihan',
      cell: ({ row }) => {
        if (row.original.has_billing) {
          const status = row.original.billing_status || '';
          return (
            <Badge className={billingStatusColors[status] || ''}>
              {billingStatusLabels[status] || status}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <FileText className="h-3 w-3 mr-1" />
            Belum dibuat
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to billing detail via main visit
              if (row.original.main_visit_id) {
                navigate(`/billing/${row.original.main_visit_id}`);
              }
            }}
            disabled={!row.original.main_visit_id}
          >
            <Eye className="mr-2 h-4 w-4" />
            Detail
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Kasir</CardTitle>
            <CardDescription>Daftar semua pendaftaran pasien (1 pendaftaran = 1 tagihan)</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={registrations}
            searchPlaceholder="Cari no. registrasi, nama pasien, atau no. RM..."
            pageSize={10}
            tableId="billing-registrations"
          />
        </CardContent>
      </Card>
    </div>
  );
}
