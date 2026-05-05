import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { EKlaimLocal, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Eye, FilterX, SlidersHorizontal, Search, UserRoundPen, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const ALL = 'all';

export default function EklaimListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EKlaimLocal[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try { return localStorage.getItem('eklaim_list_status') || ALL; } catch { return ALL; }
  });
  const [jenisRawatFilter, setJenisRawatFilter] = useState<string>(ALL);
  const [kelasRawatFilter, setKelasRawatFilter] = useState<string>(ALL);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');

  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<string>(ALL);
  const [draftJenisRawatFilter, setDraftJenisRawatFilter] = useState<string>(ALL);
  const [draftKelasRawatFilter, setDraftKelasRawatFilter] = useState<string>(ALL);
  const [draftTglFrom, setDraftTglFrom] = useState('');
  const [draftTglTo, setDraftTglTo] = useState('');

  useEffect(() => {
    try { localStorage.setItem('eklaim_list_status', statusFilter); } catch { /* ignore */ }
  }, [statusFilter]);

  useEffect(() => {
    if (!filterDialogOpen) return;

    setDraftSearchTerm(searchTerm);
    setDraftStatusFilter(statusFilter);
    setDraftJenisRawatFilter(jenisRawatFilter);
    setDraftKelasRawatFilter(kelasRawatFilter);
    setDraftTglFrom(tglFrom);
    setDraftTglTo(tglTo);
  }, [filterDialogOpen, searchTerm, statusFilter, jenisRawatFilter, kelasRawatFilter, tglFrom, tglTo]);

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
      id: 'rm_actions',
      header: 'Aksi Rekam Medis',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            title="Edit Rekam Medis Casemix"
            onClick={() => navigate(`/eklaim/data-klaim/${row.original.id}/rekam-medis`)}
          >
            <UserRoundPen className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            title="Lihat Cetakan Berkas"
            onClick={() => navigate(`/eklaim/data-klaim/${row.original.id}/cetakan`)}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => navigate(`/eklaim/data-klaim/${row.original.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [navigate]);

  return (
    <PageShell>
      <PageHeader
        title="Data Klaim"
        description="Daftar klaim lokal BPJS beserta hasil grouper dan tarif"
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
              <DialogTitle>Filter Data Klaim</DialogTitle>
              <DialogDescription className="mt-1">
                Saring data klaim berdasarkan pencarian, status, jenis rawat, kelas rawat, dan tanggal masuk.
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
                  placeholder="Cari No. SEP, nama pasien, no. BPJS, kode CBG/iDRG..."
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
              </div>
              <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Jenis Rawat</p>
              </div>
              <Select value={draftJenisRawatFilter} onValueChange={setDraftJenisRawatFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Kelas Rawat</p>
              </div>
              <Select value={draftKelasRawatFilter} onValueChange={setDraftKelasRawatFilter}>
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

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tanggal Masuk</p>
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
                setDraftStatusFilter(ALL);
                setDraftJenisRawatFilter(ALL);
                setDraftKelasRawatFilter(ALL);
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
                setJenisRawatFilter(draftJenisRawatFilter);
                setKelasRawatFilter(draftKelasRawatFilter);
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

      <PageContent noPadding className="px-4 pb-4 pt-3">
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
          />
        )}
      </PageContent>
    </PageShell>
  );
}
