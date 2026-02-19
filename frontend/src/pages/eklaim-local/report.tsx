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
  id: number;
  no_sep: string;
  nama_pasien: string;
  tgl_masuk: string;
  tgl_pulang: string;
  jenis_rawat: string;
  kelas_rawat: string;
  status: EKlaimLocalStatus;
  diagnosa: string;
  procedure: string;
  nama_dokter: string;
  // iDRG
  idrg_code: string;
  idrg_description: string;
  idrg_cost_weight: string;
  // INACBG
  inacbg_cbg_code: string;
  inacbg_cbg_description: string;
  inacbg_tariff: string;
  // Tarif RS
  tarif_rs: number;
  los: number;
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
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const kelasLabel = (k: string) => {
    if (k === '1') return 'Kelas 1';
    if (k === '2') return 'Kelas 2';
    if (k === '3') return 'Kelas 3';
    return k || '-';
  };

  const columns: ColumnDef<ClaimStatusItem>[] = [
    {
      accessorKey: 'no_sep',
      header: 'No. SEP',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.no_sep}</span>
      ),
    },
    {
      accessorKey: 'nama_pasien',
      header: 'Pasien',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.nama_pasien}</p>
          {row.original.nama_dokter && (
            <p className="text-xs text-muted-foreground">{row.original.nama_dokter}</p>
          )}
        </div>
      ),
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
      accessorKey: 'los',
      header: 'LOS',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.los} hr</span>
      ),
    },
    {
      accessorKey: 'jenis_rawat',
      header: 'Jenis',
      cell: ({ row }) => {
        const opt = jenisRawatOptions.find((o) => o.value === row.original.jenis_rawat);
        return (
          <Badge variant="outline" className="text-xs">
            {opt?.label || row.original.jenis_rawat || '-'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'kelas_rawat',
      header: 'Kelas',
      cell: ({ row }) => (
        <span className="text-sm">{kelasLabel(row.original.kelas_rawat)}</span>
      ),
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
      accessorKey: 'diagnosa',
      header: 'Diagnosa',
      cell: ({ row }) => (
        <span className="font-mono text-xs truncate max-w-[120px] block" title={row.original.diagnosa}>
          {row.original.diagnosa || '-'}
        </span>
      ),
    },
    {
      id: 'idrg',
      header: 'iDRG',
      cell: ({ row }) => {
        const d = row.original;
        if (!d.idrg_code) return <span className="text-muted-foreground">-</span>;
        return (
          <div>
            <p className="font-mono text-xs font-medium">{d.idrg_code}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{d.idrg_description}</p>
            <p className="text-xs text-muted-foreground">CW: {d.idrg_cost_weight}</p>
          </div>
        );
      },
    },
    {
      id: 'inacbg',
      header: 'INACBG',
      cell: ({ row }) => {
        const d = row.original;
        if (!d.inacbg_cbg_code) return <span className="text-muted-foreground">-</span>;
        return (
          <div>
            <p className="font-mono text-xs font-medium">{d.inacbg_cbg_code}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{d.inacbg_cbg_description}</p>
          </div>
        );
      },
    },
    {
      id: 'inacbg_tariff',
      header: 'Tarif INACBG',
      cell: ({ row }) => {
        const val = row.original.inacbg_tariff ? Number(row.original.inacbg_tariff) : 0;
        return <span className="font-mono text-sm">{val ? formatCurrency(val) : '-'}</span>;
      },
    },
    {
      accessorKey: 'tarif_rs',
      header: 'Tarif RS',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.tarif_rs ? formatCurrency(row.original.tarif_rs) : '-'}</span>
      ),
    },
  ];

  // Summary
  const totalINACBG = data.reduce((sum, d) => sum + (d.inacbg_tariff ? Number(d.inacbg_tariff) : 0), 0);
  const totalRS = data.reduce((sum, d) => sum + (d.tarif_rs || 0), 0);

  return (
    <div className="flex flex-1 flex-col p-4">
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
                  <SelectItem value="claim_final">Claim Final</SelectItem>
                  <SelectItem value="claim_sent">Terkirim</SelectItem>
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
            Total Tarif INACBG: <span className="font-mono font-medium text-foreground">{formatCurrency(totalINACBG)}</span>
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
