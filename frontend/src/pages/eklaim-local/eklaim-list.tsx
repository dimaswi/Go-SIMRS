import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { EKlaimLocal, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, FileStack, SlidersHorizontal, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EklaimListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EKlaimLocal[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

      const response = await eklaimLocalApi.getList(params);
      setData(response.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data E-Klaim.' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    setPageTitle('E-Klaim');
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

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const columns: ColumnDef<EKlaimLocal>[] = [
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
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.cbg_description}</p>
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
        <span className="font-mono text-sm">
          {row.original.cbg_tariff ? formatCurrency(row.original.cbg_tariff) : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Aksi',
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
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              Data Klaim
            </h1>
            <p className="text-sm text-muted-foreground">
              Daftar klaim yang sudah dibuat dan siap diproses
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
          <div className="flex flex-wrap gap-3 pt-4">
            <Input
              placeholder="Cari No. SEP / Nama pasien..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="new_claim">New Claim</SelectItem>
                <SelectItem value="set_claim_data">Data Terisi</SelectItem>
                <SelectItem value="grouped">Grouped</SelectItem>
                <SelectItem value="finalized">Final</SelectItem>
                <SelectItem value="sent">Terkirim</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

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
          pageSize={20}
          tableId="eklaim-local-list"
        />
      )}
    </div>
  );
}
