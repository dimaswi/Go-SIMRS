import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { eklaimLocalApi } from '@/lib/api/eklaim-local';
import type { EKlaimLocalLog } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  Eye,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface LogEntry extends EKlaimLocalLog {
  no_sep?: string;
  nama_pasien?: string;
}

const methodOptions = [
  { value: '', label: 'Semua Method' },
  { value: 'new_claim', label: 'new_claim' },
  { value: 'update_patient', label: 'update_patient' },
  { value: 'set_claim_data', label: 'set_claim_data' },
  { value: 'grouper', label: 'grouper' },
  { value: 'claim_final', label: 'claim_final' },
  { value: 'delete_claim', label: 'delete_claim' },
  { value: 'reedit_claim', label: 'reedit_claim' },
  { value: 'get_claim_data', label: 'get_claim_data' },
  { value: 'claim_print', label: 'claim_print' },
  { value: 'get_claim_status', label: 'get_claim_status' },
];

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'success', label: 'Sukses' },
  { value: 'failed', label: 'Gagal' },
];

export default function AllEklaimLogsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page')) || 20);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [method, setMethod] = useState(searchParams.get('method') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
  const [draftMethod, setDraftMethod] = useState(searchParams.get('method') || '');
  const [draftStatus, setDraftStatus] = useState(searchParams.get('status') || '');

  const hasActiveFilters = search !== '' || method !== '' || status !== '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eklaimLocalApi.getAllLogs({
        page,
        per_page: perPage,
        method: method || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setLogs(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat log.' });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, method, status, search, toast]);

  useEffect(() => {
    setPageTitle('Log E-Klaim');
    loadData();
  }, [loadData]);

  // Update URL params when filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (perPage !== 20) params.per_page = String(perPage);
    if (method) params.method = method;
    if (status) params.status = status;
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, perPage, method, status, search, setSearchParams]);

  useEffect(() => {
    if (!filterDialogOpen) return;

    setDraftSearch(search);
    setDraftMethod(method);
    setDraftStatus(status);
  }, [filterDialogOpen, search, method, status]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm:ss', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const formatJson = (str?: string) => {
    if (!str) return '-';
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  const columns: ColumnDef<LogEntry>[] = [
    {
      accessorKey: 'created_at',
      header: 'Waktu',
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">{formatDate(row.original.created_at)}</span>
      ),
    },
    {
      accessorKey: 'no_sep',
      header: 'No. SEP',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.no_sep || '-'}</span>
      ),
    },
    {
      accessorKey: 'nama_pasien',
      header: 'Pasien',
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[150px] block">
          {row.original.nama_pasien || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.method}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_success',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={row.original.is_success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {row.original.is_success ? (
            <><CheckCircle className="h-3 w-3 mr-1" /> Sukses</>
          ) : (
            <><XCircle className="h-3 w-3 mr-1" /> Gagal</>
          )}
        </Badge>
      ),
    },
    {
      accessorKey: 'response_code',
      header: 'Kode',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.response_code || '-'}</span>
      ),
    },
    {
      accessorKey: 'response_time_ms',
      header: 'Waktu (ms)',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.response_time_ms || 0} ms</span>
      ),
    },
    {
      accessorKey: 'error_message',
      header: 'Error',
      cell: ({ row }) => (
        <span className="text-xs text-destructive truncate max-w-[180px] block">
          {row.original.error_message || '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLog(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {row.original.eklaim_local_id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/eklaim/data-klaim/${row.original.eklaim_local_id}`)}
              title="Lihat detail klaim"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / perPage);

  return (
    <PageShell>
      <PageHeader
        title="Log E-Klaim"
        description="Riwayat request dan response seluruh integrasi e-klaim lokal"
        count={total}
        actions={
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setMethod('');
                  setStatus('');
                  setPage(1);
                }}
              >
                Reset
              </Button>
            )}
            <Button variant={filterDialogOpen ? 'secondary' : 'outline'} size="sm" className="h-9" onClick={() => setFilterDialogOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              Filter
              {hasActiveFilters && <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader>
            <div className="border-b border-border bg-muted/20 px-4 py-4">
              <DialogTitle>Filter Log E-Klaim</DialogTitle>
              <DialogDescription className="mt-1">
                Saring log berdasarkan kata kunci, method request, dan status hasil integrasi.
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
                  placeholder="Cari no. SEP, pasien, atau error..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Method</p>
              </div>
              <Select value={draftMethod || '_all'} onValueChange={(v) => setDraftMethod(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methodOptions.map((opt) => (
                    <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
              </div>
              <Select value={draftStatus || '_all'} onValueChange={(v) => setDraftStatus(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>
                      {opt.label}
                    </SelectItem>
                  ))}
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
                setDraftSearch('');
                setDraftMethod('');
                setDraftStatus('');
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
                setSearch(draftSearch);
                setMethod(draftMethod);
                setStatus(draftStatus);
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
          <>
            <DataTable
              columns={columns}
              data={logs}
              pageSize={perPage}
              showPagination={false}
              showSearch={false}
            />
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-muted-foreground">Baris per halaman</p>
                <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex w-[100px] items-center justify-center text-sm text-muted-foreground">
                  Halaman {page} dari {Math.max(1, totalPages)}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => setPage(1)} disabled={page <= 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </PageContent>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">No. SEP</span>
                <span className="font-mono">{selectedLog.no_sep || '-'}</span>
                <span className="text-muted-foreground">Pasien</span>
                <span>{selectedLog.nama_pasien || '-'}</span>
                <span className="text-muted-foreground">Method</span>
                <Badge variant="outline" className="w-fit font-mono">{selectedLog.method}</Badge>
                <span className="text-muted-foreground">Waktu</span>
                <span>{formatDate(selectedLog.created_at)}</span>
                <span className="text-muted-foreground">Status</span>
                <Badge className={selectedLog.is_success ? 'bg-green-100 text-green-800 w-fit' : 'bg-red-100 text-red-800 w-fit'}>
                  {selectedLog.is_success ? 'Sukses' : 'Gagal'}
                </Badge>
                <span className="text-muted-foreground">Response Code</span>
                <span className="font-mono">{selectedLog.response_code || '-'}</span>
                <span className="text-muted-foreground">Response Time</span>
                <span>{selectedLog.response_time_ms} ms</span>
                <span className="text-muted-foreground">User</span>
                <span>{selectedLog.user?.name || '-'}</span>
              </div>
              {selectedLog.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{selectedLog.error_message}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Request Body</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                  {formatJson(selectedLog.request_body)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Response Body</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                  {formatJson(selectedLog.response_body)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
