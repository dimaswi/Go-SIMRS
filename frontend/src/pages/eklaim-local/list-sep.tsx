import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { SEPWithClaim, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, Search, SlidersHorizontal, List, FilterX } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function ListSEPPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<SEPWithClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const [jnsPelayananFilter, setJnsPelayananFilter] = useState<string>('all');
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [page, setPage] = useState(1);
  const [_total, setTotal] = useState(0);

  const hasActiveFilters = statusFilter !== 'all' || claimFilter !== 'all' || jnsPelayananFilter !== 'all' || tglFrom !== '' || tglTo !== '';

  const resetFilters = () => {
    setStatusFilter('all');
    setClaimFilter('all');
    setJnsPelayananFilter('all');
    setTglFrom('');
    setTglTo('');
    setSearchTerm('');
    setPage(1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 20 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (claimFilter !== 'all') params.claim_status = claimFilter;
      if (jnsPelayananFilter !== 'all') params.jns_pelayanan = jnsPelayananFilter;
      if (tglFrom) params.tgl_from = tglFrom;
      if (tglTo) params.tgl_to = tglTo;
      const response = await eklaimLocalApi.getListSEP(params);
      setData(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data SEP.' });
    } finally {
      setLoading(false);
    }
  }, [toast, page, searchTerm, statusFilter, claimFilter, jnsPelayananFilter, tglFrom, tglTo]);

  useEffect(() => {
    setPageTitle('List SEP - E-Klaim');
    loadData();
  }, [loadData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const columns: ColumnDef<SEPWithClaim>[] = [
    {
      accessorKey: 'no_sep',
      header: 'No. SEP',
      cell: ({ row }) => (
        <div>
          <span className="font-medium font-mono text-sm">{row.original.no_sep}</span>
          {row.original.no_kartu && (
            <div className="text-xs text-muted-foreground mt-0.5">BPJS: {row.original.no_kartu}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'nama_pasien',
      header: 'Pasien',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.nama_pasien || '-'}</span>
          {row.original.no_mr && (
            <div className="text-xs text-muted-foreground">RM: {row.original.no_mr}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'tgl_sep',
      header: 'Tgl SEP',
      cell: ({ row }) => formatDate(row.original.tgl_sep),
    },
    {
      accessorKey: 'jns_pelayanan',
      header: 'Jenis',
      cell: ({ row }) => {
        const jns = row.original.jns_pelayanan;
        return (
          <Badge variant="outline">
            {jns === '1' ? 'Ranap' : jns === '2' ? 'Rajal' : jns || '-'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'nama_poli',
      header: 'Poli / DPJP',
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.nama_poli || '-'}</div>
          {row.original.nama_dpjp && (
            <div className="text-xs text-muted-foreground">{row.original.nama_dpjp}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'diag_awal',
      header: 'Diagnosa Awal',
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          {row.original.diag_awal && (
            <span className="font-mono text-xs">{row.original.diag_awal}</span>
          )}
          {row.original.nama_diagnosa && (
            <div className="text-xs text-muted-foreground truncate">{row.original.nama_diagnosa}</div>
          )}
          {!row.original.diag_awal && '-'}
        </div>
      ),
    },
    {
      id: 'claim_status',
      header: 'Status Klaim',
      cell: ({ row }) => {
        const eklaim = row.original.eklaim_local;
        if (!eklaim) {
          return <Badge variant="outline" className="text-muted-foreground">Belum diklaim</Badge>;
        }
        const status = eklaim.status as EKlaimLocalStatus;
        return (
          <Badge className={eklaimLocalStatusColors[status] || ''}>
            {eklaimLocalStatusLabels[status] || status}
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
            onClick={() => navigate(`/eklaim/list-sep/${row.original.id}`)}
          >
            <Eye className="mr-1 h-4 w-4" />
            Detail
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col p-4">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <List className="h-5 w-5" />
              List SEP
            </h1>
            <p className="text-sm text-muted-foreground">
              Daftar kunjungan yang sudah memiliki SEP untuk diproses E-Klaim
            </p>
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
                placeholder="Cari no. SEP, nama pasien, no. BPJS, no. RM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="pl-9"
              />
            </div>
            {/* Row 2: Selects & Date Range */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status SEP</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua SEP</SelectItem>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="batal">Batal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status Klaim</Label>
                <Select value={claimFilter} onValueChange={(v) => { setClaimFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="has_claim">Sudah Diklaim</SelectItem>
                    <SelectItem value="no_claim">Belum Diklaim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Jenis Pelayanan</Label>
                <Select value={jnsPelayananFilter} onValueChange={(v) => { setJnsPelayananFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="1">Rawat Inap</SelectItem>
                    <SelectItem value="2">Rawat Jalan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tgl SEP Dari</Label>
                <Input type="date" className="h-9" value={tglFrom} onChange={(e) => { setTglFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tgl SEP Sampai</Label>
                <Input type="date" className="h-9" value={tglTo} onChange={(e) => { setTglTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={loadData}>
                <Search className="h-4 w-4 mr-1" /> Cari
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Cari..."
          pageSize={20}
          tableId="eklaim-local-list-sep"
        />
      )}
    </div>
  );
}
