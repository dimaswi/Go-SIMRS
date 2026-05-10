import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { SEPWithClaim, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, Search, SlidersHorizontal, FilterX } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function ListSEPPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<SEPWithClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const [jnsPelayananFilter, setJnsPelayananFilter] = useState<string>('all');
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<string>('all');
  const [draftClaimFilter, setDraftClaimFilter] = useState<string>('all');
  const [draftJnsPelayananFilter, setDraftJnsPelayananFilter] = useState<string>('all');
  const [draftTglFrom, setDraftTglFrom] = useState('');
  const [draftTglTo, setDraftTglTo] = useState('');

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || claimFilter !== 'all' || jnsPelayananFilter !== 'all' || tglFrom !== '' || tglTo !== '';

  const resetFilters = () => {
    setStatusFilter('all');
    setClaimFilter('all');
    setJnsPelayananFilter('all');
    setTglFrom('');
    setTglTo('');
    setSearchTerm('');
    setPage(1);
  };

  useEffect(() => {
    if (!filterDialogOpen) return;

    setDraftSearchTerm(searchTerm);
    setDraftStatusFilter(statusFilter);
    setDraftClaimFilter(claimFilter);
    setDraftJnsPelayananFilter(jnsPelayananFilter);
    setDraftTglFrom(tglFrom);
    setDraftTglTo(tglTo);
  }, [filterDialogOpen, searchTerm, statusFilter, claimFilter, jnsPelayananFilter, tglFrom, tglTo]);

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
    <PageShell>
      <PageHeader
        title="List SEP"
        description="Daftar SEP BPJS dan status klaim lokal"
        count={total}
        actions={
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={resetFilters}>
                <FilterX className="mr-1 h-4 w-4" /> Reset
              </Button>
            )}
            <Button variant={filterDialogOpen ? 'secondary' : 'outline'} size="sm" className="h-9" onClick={() => setFilterDialogOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filter
              {hasActiveFilters && <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
          </div>
        }
      />

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader>
            <div className="border-b border-border bg-muted/20 px-4 py-4">
              <DialogTitle>Filter List SEP</DialogTitle>
              <DialogDescription className="mt-1">
                Atur pencarian SEP, status klaim, jenis pelayanan, dan rentang tanggal dalam satu modal.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="divide-y divide-border">
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pencarian</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari no. SEP, nama pasien, no. BPJS, no. RM..."
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status SEP</p>
              </div>
              <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status Klaim</p>
              </div>
              <Select value={draftClaimFilter} onValueChange={setDraftClaimFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Jenis Pelayanan</p>
              </div>
              <Select value={draftJnsPelayananFilter} onValueChange={setDraftJnsPelayananFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tanggal SEP</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dari</Label>
                  <Input type="date" className="h-9" value={draftTglFrom} onChange={(e) => setDraftTglFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sampai</Label>
                  <Input type="date" className="h-9" value={draftTglTo} onChange={(e) => setDraftTglTo(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDraftSearchTerm('');
                setDraftStatusFilter('all');
                setDraftClaimFilter('all');
                setDraftJnsPelayananFilter('all');
                setDraftTglFrom('');
                setDraftTglTo('');
              }}
            >
              Reset
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFilterDialogOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSearchTerm(draftSearchTerm);
                setStatusFilter(draftStatusFilter);
                setClaimFilter(draftClaimFilter);
                setJnsPelayananFilter(draftJnsPelayananFilter);
                setTglFrom(draftTglFrom);
                setTglTo(draftTglTo);
                setPage(1);
                setFilterDialogOpen(false);
              }}
            >
              Terapkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PageContent className="py-3">
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar SEP
          </div>
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={data}
                searchPlaceholder="Cari No. SEP, nama pasien, kode..."
                pageSize={20}
                tableId="eklaim-local-list"
                showSearch={true}
                showPagination={true}
              />
            )}
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
