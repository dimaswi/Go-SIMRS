import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors, jenisRawatOptions } from '@/lib/api/eklaim-local';
import type { EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, BarChart3, SlidersHorizontal, Search } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface ClaimStatusItem {
  no_sep: string;
  nama_pasien: string;
  tgl_masuk: string;
  tgl_pulang: string;
  jenis_rawat: string;
  status: EKlaimLocalStatus;
  cbg_code: string;
  cbg_description: string;
  cbg_tariff: number;
  hospital_tariff: number;
}

export default function EklaimReportPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClaimStatusItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [tglFrom, setTglFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [tglTo, setTglTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [jenisRawat, setJenisRawat] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setPageTitle('Laporan E-Klaim');
  }, []);

  const handleSearch = async () => {
    if (!tglFrom || !tglTo) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Tanggal harus diisi.' });
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, any> = {
        tgl_masuk_from: tglFrom,
        tgl_masuk_to: tglTo,
      };
      if (jenisRawat && jenisRawat !== 'all') params.jenis_rawat = jenisRawat;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

      const response = await eklaimLocalApi.getClaimStatus(params as any);
      setData(response.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat laporan.' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const columns: ColumnDef<ClaimStatusItem>[] = [
    {
      accessorKey: 'no_sep',
      header: 'No. SEP',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.no_sep}</span>
      ),
    },
    {
      accessorKey: 'nama_pasien',
      header: 'Pasien',
    },
    {
      accessorKey: 'tgl_masuk',
      header: 'Tgl Masuk',
      cell: ({ row }) => formatDate(row.original.tgl_masuk),
    },
    {
      accessorKey: 'tgl_pulang',
      header: 'Tgl Pulang',
      cell: ({ row }) => formatDate(row.original.tgl_pulang),
    },
    {
      accessorKey: 'jenis_rawat',
      header: 'Jenis',
      cell: ({ row }) => {
        const opt = jenisRawatOptions.find((o) => o.value === row.original.jenis_rawat);
        return opt?.label || row.original.jenis_rawat || '-';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status as EKlaimLocalStatus;
        return (
          <Badge className={eklaimLocalStatusColors[status] || ''}>
            {eklaimLocalStatusLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'cbg_code',
      header: 'CBG',
      cell: ({ row }) => (
        <div>
          {row.original.cbg_code ? (
            <>
              <p className="font-mono text-sm font-medium">{row.original.cbg_code}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.original.cbg_description}</p>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'cbg_tariff',
      header: 'Tarif CBG',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.cbg_tariff ? formatCurrency(row.original.cbg_tariff) : '-'}</span>
      ),
    },
    {
      accessorKey: 'hospital_tariff',
      header: 'Tarif RS',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.hospital_tariff ? formatCurrency(row.original.hospital_tariff) : '-'}</span>
      ),
    },
  ];

  // Summary
  const totalCBG = data.reduce((sum, d) => sum + (d.cbg_tariff || 0), 0);
  const totalRS = data.reduce((sum, d) => sum + (d.hospital_tariff || 0), 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Report E-Klaim
            </h1>
            <p className="text-sm text-muted-foreground">
                Laporan klaim berdasarkan tanggal masuk, jenis rawat, dan status klaim
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-wrap items-end gap-3 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tgl Masuk Dari</Label>
              <Input
                type="date"
                value={tglFrom}
                onChange={(e) => setTglFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tgl Masuk Sampai</Label>
              <Input
                type="date"
                value={tglTo}
                onChange={(e) => setTglTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jenis Rawat</Label>
              <Select value={jenisRawat} onValueChange={setJenisRawat}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {jenisRawatOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="new_claim">New Claim</SelectItem>
                  <SelectItem value="set_claim_data">Data Terisi</SelectItem>
                  <SelectItem value="grouped">Grouped</SelectItem>
                  <SelectItem value="finalized">Final</SelectItem>
                  <SelectItem value="sent">Terkirim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Cari
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Summary */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">
            Total Klaim: <span className="font-medium text-foreground">{data.length}</span>
          </span>
          <span className="text-muted-foreground">
            Total Tarif CBG: <span className="font-mono font-medium text-foreground">{formatCurrency(totalCBG)}</span>
          </span>
          <span className="text-muted-foreground">
            Total Tarif RS: <span className="font-mono font-medium text-foreground">{formatCurrency(totalRS)}</span>
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Cari klaim..."
        />
      )}
    </div>
  );
}
