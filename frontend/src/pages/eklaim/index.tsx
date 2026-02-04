import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eklaimApi, eklaimStateLabels, eklaimStateColors } from '@/lib/api/eklaim';
import type { EKlaim, EKlaimState } from '@/lib/api/eklaim';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, Plus, FileCheck, Search, Filter } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const jenisRawatLabels: Record<string, string> = {
  '1': 'Rawat Jalan',
  '2': 'Rawat Inap',
  '3': 'IGD',
};

export default function EKlaimIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claims, setClaims] = useState<EKlaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { state?: EKlaimState; no_sep?: string } = {};
      if (statusFilter && statusFilter !== 'all') {
        params.state = statusFilter as EKlaimState;
      }
      if (searchTerm) {
        params.no_sep = searchTerm;
      }
      const response = await eklaimApi.getList(params);
      setClaims(response.data || []);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data E-Klaim.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, statusFilter, searchTerm]);

  useEffect(() => {
    setPageTitle('E-Klaim BPJS');
    loadData();
  }, [loadData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: id });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: ColumnDef<EKlaim>[] = [
    {
      accessorKey: 'no_sep',
      header: 'No. SEP',
      cell: ({ row }) => (
        <div>
          <span className="font-medium font-mono">{row.original.no_sep || '-'}</span>
          {row.original.no_kartu && (
            <div className="text-xs text-muted-foreground mt-0.5">
              BPJS: {row.original.no_kartu}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'jenis_rawat',
      header: 'Tipe Pelayanan',
      cell: ({ row }) => (
        <Badge variant="outline">
          {jenisRawatLabels[row.original.jenis_rawat || ''] || row.original.jenis_rawat || '-'}
        </Badge>
      ),
    },
    {
      accessorKey: 'tgl_masuk',
      header: 'Tanggal Masuk',
      cell: ({ row }) => (
        <div>
          <div>{formatDate(row.original.tgl_masuk)}</div>
          {row.original.tgl_pulang && row.original.tgl_pulang !== row.original.tgl_masuk && (
            <div className="text-xs text-muted-foreground">
              s/d {formatDate(row.original.tgl_pulang)}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'los',
      header: 'LOS',
      cell: ({ row }) => (
        <span>{row.original.los || 0} hari</span>
      ),
    },
    {
      accessorKey: 'idrg_code',
      header: 'iDRG',
      cell: ({ row }) => (
        <div>
          {row.original.idrg_code ? (
            <>
              <span className="font-mono font-medium">{row.original.idrg_code}</span>
              {row.original.idrg_tarif !== undefined && row.original.idrg_tarif > 0 && (
                <div className="text-xs text-green-600">
                  {formatCurrency(row.original.idrg_tarif)}
                </div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'inacbg_code',
      header: 'INA-CBG',
      cell: ({ row }) => (
        <div>
          {row.original.inacbg_code ? (
            <>
              <span className="font-mono font-medium">{row.original.inacbg_code}</span>
              {row.original.inacbg_tarif !== undefined && row.original.inacbg_tarif > 0 && (
                <div className="text-xs text-blue-600">
                  {formatCurrency(row.original.inacbg_tarif)}
                </div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'state',
      header: 'Status',
      cell: ({ row }) => {
        const state = row.original.state as EKlaimState;
        return (
          <Badge className={eklaimStateColors[state] || ''}>
            {eklaimStateLabels[state] || state}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/eklaim/${row.original.id}`)}
          >
            <Eye className="mr-1 h-4 w-4" />
            Detail
          </Button>
        </div>
      ),
    },
  ];

  const handleSearch = () => {
    loadData();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                E-Klaim BPJS
              </CardTitle>
              <CardDescription>
                Kelola klaim BPJS dengan iDRG dan INA-CBG sesuai 25 Kriteria KEMENKES
              </CardDescription>
            </div>
            <Button onClick={() => navigate('/eklaim/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Buat Klaim Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari no. SEP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="IDRG_GROUPED">iDRG Grouped</SelectItem>
                  <SelectItem value="IDRG_FINAL">iDRG Final</SelectItem>
                  <SelectItem value="INACBG_GROUPED">INA-CBG Grouped</SelectItem>
                  <SelectItem value="INACBG_FINAL">INA-CBG Final</SelectItem>
                  <SelectItem value="CLAIM_FINAL">Klaim Final</SelectItem>
                  <SelectItem value="SENT">Terkirim</SelectItem>
                  <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={claims}
              searchPlaceholder="Cari..."
              pageSize={10}
              tableId="eklaim-list"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
