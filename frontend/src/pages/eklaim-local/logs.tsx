import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { eklaimLocalApi } from '@/lib/api/eklaim-local';
import type { EKlaimLocalLog } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, ScrollText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EklaimLogsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<EKlaimLocalLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<EKlaimLocalLog | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await eklaimLocalApi.getLogs(Number(id));
      setLogs(response.data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat log.' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    setPageTitle('Log E-Klaim');
    loadData();
  }, [loadData]);

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

  const columns: ColumnDef<EKlaimLocalLog>[] = [
    {
      accessorKey: 'created_at',
      header: 'Waktu',
      cell: ({ row }) => (
        <span className="text-sm">{formatDate(row.original.created_at)}</span>
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
          {row.original.is_success ? 'Sukses' : 'Gagal'}
        </Badge>
      ),
    },
    {
      accessorKey: 'response_code',
      header: 'Kode',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.response_code || '-'}</span>
      ),
    },
    {
      accessorKey: 'response_time_ms',
      header: 'Waktu (ms)',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.response_time_ms || 0} ms</span>
      ),
    },
    {
      accessorKey: 'error_message',
      header: 'Error',
      cell: ({ row }) => (
        <span className="text-sm text-destructive truncate max-w-[200px] block">
          {row.original.error_message || '-'}
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
          onClick={() => setSelectedLog(row.original)}
        >
          <Eye className="mr-1 h-4 w-4" />
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(`/eklaim/data-klaim/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Log Komunikasi E-Klaim
            </h1>
            <p className="text-sm text-muted-foreground">
              Riwayat komunikasi dengan E-Klaim server
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          searchPlaceholder="Cari log..."
          pageSize={20}
          tableId={`eklaim-local-logs-${id}`}
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Method</span>
                <Badge variant="outline" className="w-fit font-mono">{selectedLog.method}</Badge>
                <span className="text-muted-foreground">Waktu</span>
                <span>{formatDate(selectedLog.created_at)}</span>
                <span className="text-muted-foreground">Status</span>
                <Badge className={selectedLog.is_success ? 'bg-green-100 text-green-800 w-fit' : 'bg-red-100 text-red-800 w-fit'}>
                  {selectedLog.is_success ? 'Sukses' : 'Gagal'}
                </Badge>
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
    </div>
  );
}
