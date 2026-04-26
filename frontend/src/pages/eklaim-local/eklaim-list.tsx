import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { EKlaimLocal, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, FilterX, SlidersHorizontal, Search } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const ALL = 'all';

export default function EklaimListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EKlaimLocal[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [_total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try { return localStorage.getItem('eklaim_list_status') || ALL; } catch { return ALL; }
  });
  const [jenisRawatFilter, setJenisRawatFilter] = useState<string>(ALL);
  const [kelasRawatFilter, setKelasRawatFilter] = useState<string>(ALL);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');

  useEffect(() => {
    try { localStorage.setItem('eklaim_list_status', statusFilter); } catch { /* ignore */ }
  }, [statusFilter]);

  const hasActiveFilters = statusFilter !== ALL || jenisRawatFilter !== ALL || kelasRawatFilter !== ALL || tglFrom !== '' || tglTo !== '' || searchTerm !== '';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter(ALL);
    setJenisRawatFilter(ALL);
    setKelasRawatFilter(ALL);
    setTglFrom('');
    setTglTo('');
    setPage(1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 20 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== ALL) params.status = statusFilter;
      if (jenisRawatFilter !== ALL) params.jenis_rawat = jenisRawatFilter;
      if (kelasRawatFilter !== ALL) params.kelas_rawat = kelasRawatFilter;
      if (tglFrom) params.tgl_from = tglFrom;
      if (tglTo) params.tgl_to = tglTo;
      const response = await eklaimLocalApi.getList(params);
      setData(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data E-Klaim.' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, jenisRawatFilter, kelasRawatFilter, tglFrom, tglTo, searchTerm, page, toast]);

  useEffect(() => {
    setPageTitle('E-Klaim');
    loadData();
  }, [loadData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId }); } catch { return dateString; }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const columns: ColumnDef<EKlaimLocal>[] = useMemo(() => [
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
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.nama_pasien}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.original.no_kartu}</p>
        </div>
      ),
    },
    {
      accessorKey: 'jenis_rawat',
      header: 'Jenis',
      cell: ({ row }) => {
        const jr = row.original.jenis_rawat;
        return (
          <Badge variant="outline">
            {jr === '1' ? 'Ranap' : jr === '2' ? 'Rajal' : jr || '-'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'kelas_rawat',
      header: 'Kelas',
      cell: ({ row }) => {
        const kr = row.original.kelas_rawat;
        return kr ? <span className="text-sm">Kelas {kr}</span> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: 'tgl_masuk',
      header: 'Tgl Masuk',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.tgl_masuk)}</span>,
    },
    {
      accessorKey: 'tgl_pulang',
      header: 'Tgl Pulang',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.tgl_pulang)}</span>,
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
      id: 'grouper_result',
      header: 'Hasil Grouper',
      cell: ({ row }) => {
        const d = row.original;
        const code = d.inacbg_cbg_code || d.idrg_code || d.cbg_code;
        const desc = d.inacbg_cbg_description || d.idrg_description || d.cbg_description;
        const source = d.inacbg_cbg_code ? 'INACBG' : d.idrg_code ? 'iDRG' : d.cbg_code ? 'CBG' : '';
        return code ? (
          <div>
            <p className="font-mono text-sm font-medium">{code}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{desc}</p>
            {source && <Badge variant="outline" className="text-[10px] mt-0.5">{source}</Badge>}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: 'tarif_result',
      header: 'Tarif',
      cell: ({ row }) => {
        const d = row.original;
        const tarif = d.inacbg_tariff ? parseFloat(d.inacbg_tariff) : (d.cbg_tariff || 0);
        const costWeight = d.idrg_cost_weight;
        return (
          <div className="font-mono text-sm">
            {tarif > 0 ? (
              <p className="font-medium">{formatCurrency(tarif)}</p>
            ) : costWeight ? (
              <p className="text-xs">CW: {costWeight}</p>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/eklaim/data-klaim/${row.original.id}`)}
        >
          <Eye className="mr-1 h-4 w-4" />
          Detail
        </Button>
      ),
      enableHiding: false,
    },
  ], [navigate]);

  return (
    <div className="flex flex-1 flex-col px-4">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              Data Klaim
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={resetFilters}>
                <FilterX className="h-4 w-4 mr-1" /> Reset
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filter
                {hasActiveFilters && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">aktif</Badge>}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="space-y-3 pt-4">
            {/* Row 1: Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari No. SEP, nama pasien, no. BPJS, kode CBG/iDRG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="pl-9"
              />
            </div>
            {/* Row 2: Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Semua Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="new_claim">New Claim</SelectItem>
                    <SelectItem value="set_claim_data">Data Terisi</SelectItem>
                    <SelectItem value="grouped">Grouped</SelectItem>
                    <SelectItem value="finalized">Final</SelectItem>
                    <SelectItem value="sent">Terkirim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Jenis Rawat</Label>
                <Select value={jenisRawatFilter} onValueChange={(v) => { setJenisRawatFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Semua</SelectItem>
                    <SelectItem value="1">Rawat Inap</SelectItem>
                    <SelectItem value="2">Rawat Jalan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Kelas Rawat</Label>
                <Select value={kelasRawatFilter} onValueChange={(v) => { setKelasRawatFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Semua</SelectItem>
                    <SelectItem value="1">Kelas 1</SelectItem>
                    <SelectItem value="2">Kelas 2</SelectItem>
                    <SelectItem value="3">Kelas 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tgl Masuk Dari</Label>
                <Input type="date" className="h-9" value={tglFrom} onChange={(e) => { setTglFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tgl Masuk Sampai</Label>
                <Input type="date" className="h-9" value={tglTo} onChange={(e) => { setTglTo(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1 flex items-end">
                <Button className="h-9 w-full" size="sm" onClick={loadData}>
                  <Search className="h-4 w-4 mr-1" /> Cari
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Cari No. SEP, nama pasien, kode..."
          pageSize={20}
          tableId="eklaim-local-list"
          showSearch={false}
          showPagination={true}
          showColumnVisibility={true}
        />
      )}
    </div>
  );
}
