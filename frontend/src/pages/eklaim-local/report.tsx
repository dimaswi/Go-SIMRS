import { useEffect, useState } from 'react';
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
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors, jenisRawatOptions } from '@/lib/api/eklaim-local';
import type { EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, SlidersHorizontal, Search } from 'lucide-react';
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
  idrg_code: string;
  idrg_description: string;
  idrg_cost_weight: string;
  inacbg_cbg_code: string;
  inacbg_cbg_description: string;
  inacbg_tariff: string;
  tarif_rs: number;
  los: number;
}

export default function EklaimReportPage() {
  const { toast } = useToast();
  const initialTglFrom = (() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  })();
  const initialTglTo = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClaimStatusItem[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const [tglFrom, setTglFrom] = useState(initialTglFrom);
  const [tglTo, setTglTo] = useState(initialTglTo);
  const [jenisRawat, setJenisRawat] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [draftTglFrom, setDraftTglFrom] = useState(initialTglFrom);
  const [draftTglTo, setDraftTglTo] = useState(initialTglTo);
  const [draftJenisRawat, setDraftJenisRawat] = useState('all');
  const [draftStatusFilter, setDraftStatusFilter] = useState('all');

  const hasActiveFilters =
    tglFrom !== initialTglFrom ||
    tglTo !== initialTglTo ||
    jenisRawat !== 'all' ||
    statusFilter !== 'all';

  const handleSearch = async (overrides?: {
    tglFrom?: string;
    tglTo?: string;
    jenisRawat?: string;
    statusFilter?: string;
  }) => {
    const nextTglFrom = overrides?.tglFrom ?? tglFrom;
    const nextTglTo = overrides?.tglTo ?? tglTo;
    const nextJenisRawat = overrides?.jenisRawat ?? jenisRawat;
    const nextStatusFilter = overrides?.statusFilter ?? statusFilter;

    if (!nextTglFrom || !nextTglTo) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Tanggal harus diisi.' });
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, any> = {
        tgl_masuk_from: nextTglFrom,
        tgl_masuk_to: nextTglTo,
      };
      if (nextJenisRawat !== 'all') params.jenis_rawat = nextJenisRawat;
      if (nextStatusFilter !== 'all') params.status = nextStatusFilter;

      const response = await eklaimLocalApi.getClaimStatus(params as never);
      setData(response.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat laporan.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageTitle('Laporan E-Klaim');
    void handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filterDialogOpen) return;

    setDraftTglFrom(tglFrom);
    setDraftTglTo(tglTo);
    setDraftJenisRawat(jenisRawat);
    setDraftStatusFilter(statusFilter);
  }, [filterDialogOpen, tglFrom, tglTo, jenisRawat, statusFilter]);

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
        <span className="block max-w-[120px] truncate font-mono text-xs" title={row.original.diagnosa}>
          {row.original.diagnosa || '-'}
        </span>
      ),
    },
    {
      id: 'idrg',
      header: 'iDRG',
      cell: ({ row }) => {
        const item = row.original;
        if (!item.idrg_code) return <span className="text-muted-foreground">-</span>;

        return (
          <div>
            <p className="font-mono text-xs font-medium">{item.idrg_code}</p>
            <p className="max-w-[150px] truncate text-xs text-muted-foreground">{item.idrg_description}</p>
            <p className="text-xs text-muted-foreground">CW: {item.idrg_cost_weight}</p>
          </div>
        );
      },
    },
    {
      id: 'inacbg',
      header: 'INACBG',
      cell: ({ row }) => {
        const item = row.original;
        if (!item.inacbg_cbg_code) return <span className="text-muted-foreground">-</span>;

        return (
          <div>
            <p className="font-mono text-xs font-medium">{item.inacbg_cbg_code}</p>
            <p className="max-w-[150px] truncate text-xs text-muted-foreground">{item.inacbg_cbg_description}</p>
          </div>
        );
      },
    },
    {
      id: 'inacbg_tariff',
      header: 'Tarif INACBG',
      cell: ({ row }) => {
        const value = row.original.inacbg_tariff ? Number(row.original.inacbg_tariff) : 0;
        return <span className="font-mono text-sm">{value ? formatCurrency(value) : '-'}</span>;
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

  const totalINACBG = data.reduce((sum, item) => sum + (item.inacbg_tariff ? Number(item.inacbg_tariff) : 0), 0);
  const totalRS = data.reduce((sum, item) => sum + (item.tarif_rs || 0), 0);

  const resetFilters = () => {
    setTglFrom(initialTglFrom);
    setTglTo(initialTglTo);
    setJenisRawat('all');
    setStatusFilter('all');
    void handleSearch({
      tglFrom: initialTglFrom,
      tglTo: initialTglTo,
      jenisRawat: 'all',
      statusFilter: 'all',
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Laporan E-Klaim"
        description="Rekap status klaim berdasarkan periode rawat dan hasil grouper"
        count={data.length}
        actions={
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={resetFilters}>
                Reset
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
              <DialogTitle>Filter Laporan E-Klaim</DialogTitle>
              <DialogDescription className="mt-1">
                Atur periode rawat, jenis rawat, dan status klaim sebelum mengambil rekap laporan.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="divide-y divide-border">
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tanggal Masuk</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dari</Label>
                  <Input type="date" value={draftTglFrom} onChange={(e) => setDraftTglFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sampai</Label>
                  <Input type="date" value={draftTglTo} onChange={(e) => setDraftTglTo(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Jenis Rawat</p>
              </div>
              <Select value={draftJenisRawat} onValueChange={setDraftJenisRawat}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {jenisRawatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDraftTglFrom(initialTglFrom);
                setDraftTglTo(initialTglTo);
                setDraftJenisRawat('all');
                setDraftStatusFilter('all');
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
                setTglFrom(draftTglFrom);
                setTglTo(draftTglTo);
                setJenisRawat(draftJenisRawat);
                setStatusFilter(draftStatusFilter);
                void handleSearch({
                  tglFrom: draftTglFrom,
                  tglTo: draftTglTo,
                  jenisRawat: draftJenisRawat,
                  statusFilter: draftStatusFilter,
                });
                setFilterDialogOpen(false);
              }}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Terapkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PageContent noPadding className="px-4 pb-4 pt-3">
        {data.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-4 border border-border/70 bg-background px-4 py-3 text-sm">
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
      </PageContent>
    </PageShell>
  );
}
