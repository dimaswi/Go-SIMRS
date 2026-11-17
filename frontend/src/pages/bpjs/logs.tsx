import { useState, useEffect } from "react";
//import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Search,
} from "lucide-react";
import { bpjsApi, type BPJSSyncLog } from "@/lib/api/bpjs";
import { cn } from "@/lib/utils";
import { BPJSMetricCue, BPJSPageFrame } from "./shared-page-chrome";
import { PageToolbar } from "@/components/layout/page-shell";

export default function BPJSLogsPage() {
  //const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<BPJSSyncLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<BPJSSyncLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [searchEndpoint, setSearchEndpoint] = useState("");
  const [limit, setLimit] = useState("100");

  useEffect(() => {
    setPageTitle("Log BPJS");
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await bpjsApi.getLogs({ limit: parseInt(limit) });
      setLogs(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat log",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const viewLogDetail = (log: BPJSSyncLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const formatJSON = (jsonStr: string) => {
    if (!jsonStr) return "";
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "POST":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "PUT":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELETE":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string, responseCode: number) => {
    if (status === "success" && responseCode >= 200 && responseCode < 300) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (status === "timeout") {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (methodFilter !== "all" && log.method.toUpperCase() !== methodFilter) return false;
    if (searchEndpoint && !log.endpoint.toLowerCase().includes(searchEndpoint.toLowerCase())) return false;
    return true;
  });

  // Column definitions for DataTable
  const columns: ColumnDef<BPJSSyncLog>[] = [
    {
      accessorKey: "request_at",
      header: "Waktu",
      cell: ({ row }) => (
        <span className="text-xs">{formatDate(row.original.request_at)}</span>
      ),
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => (
        <Badge className={cn("font-mono", getMethodColor(row.original.method))}>
          {row.original.method}
        </Badge>
      ),
    },
    {
      accessorKey: "endpoint",
      header: "Endpoint",
      cell: ({ row }) => (
        <span className="font-mono text-xs max-w-[300px] truncate block">
          {row.original.endpoint}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {getStatusIcon(row.original.status, row.original.response_code)}
          <span className="text-xs capitalize">{row.original.status}</span>
        </div>
      ),
    },
    {
      accessorKey: "response_code",
      header: "Code",
      cell: ({ row }) => (
        <Badge variant={row.original.response_code >= 200 && row.original.response_code < 300 ? "outline" : "destructive"}>
          {row.original.response_code || "-"}
        </Badge>
      ),
    },
    {
      accessorKey: "duration_ms",
      header: "Durasi",
      cell: ({ row }) => (
        <span className="text-xs">{row.original.duration_ms}ms</span>
      ),
    },
    {
      accessorKey: "error_message",
      header: "Error",
      cell: ({ row }) => (
        <span className="text-xs text-red-600 max-w-[150px] truncate block">
          {row.original.error_message || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="icon" onClick={() => viewLogDetail(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Stats
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === "success").length,
    failed: logs.filter(l => l.status === "failed").length,
    avgDuration: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.duration_ms, 0) / logs.length)
      : 0,
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BPJSPageFrame
      icon={FileText}
      title="Log Request BPJS"
      description="Pantau seluruh request bridging BPJS dari Antrian Online, VClaim, dan layanan terkait dalam satu ruang kerja yang lebih rapi."
      noPadding
      className="space-y-0"
      actions={
        <Button variant="outline" size="sm" className="rounded-none h-8 px-3 text-xs font-semibold shadow-none" onClick={loadLogs} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Refresh
        </Button>
      }
    >
      <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-neutral-200 dark:border-neutral-800 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800">
        <BPJSMetricCue label="Total Request" value={stats.total} hint="Semua request yang tercatat" />
        <BPJSMetricCue label="Sukses" value={<span className="text-green-600">{stats.success}</span>} hint="Request dengan respons berhasil" />
        <BPJSMetricCue label="Gagal" value={<span className="text-red-600">{stats.failed}</span>} hint="Request yang perlu ditinjau" />
        <BPJSMetricCue label="Rata-rata Durasi" value={`${stats.avgDuration}ms`} hint="Respons rata-rata dari API" />
      </div>

      <PageToolbar className="justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari endpoint..."
              value={searchEndpoint}
              onChange={(e) => setSearchEndpoint(e.target.value)}
              className="pl-8 h-8 rounded-none text-xs bg-white dark:bg-neutral-950"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[125px] h-8 rounded-none text-xs bg-white dark:bg-neutral-950">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="success">Sukses</SelectItem>
              <SelectItem value="failed">Gagal</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[100px] h-8 rounded-none text-xs bg-white dark:bg-neutral-950">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">Method</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select value={limit} onValueChange={(v) => { setLimit(v); }}>
            <SelectTrigger className="w-[85px] h-8 rounded-none text-xs bg-white dark:bg-neutral-950">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 rounded-none text-xs px-3 bg-white dark:bg-neutral-950 shadow-none" onClick={loadLogs}>
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Terapkan
          </Button>
        </div>
      </PageToolbar>

      <DataTable
        columns={columns}
        data={filteredLogs}
        pageSize={15}
        tableId="bpjs-logs"
        showSearch={false}
      />

      {/* Log Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail Log #{selectedLog?.id}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4">
              <Badge className={cn("font-mono", getMethodColor(selectedLog?.method || ""))}>
                {selectedLog?.method}
              </Badge>
              <span className="font-mono text-sm">{selectedLog?.endpoint}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Meta Info */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Waktu Request</p>
                  <p className="font-medium">{formatDate(selectedLog.request_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedLog.status, selectedLog.response_code)}
                    <span className="font-medium capitalize">{selectedLog.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Response Code</p>
                  <Badge variant={selectedLog.response_code >= 200 && selectedLog.response_code < 300 ? "outline" : "destructive"}>
                    {selectedLog.response_code}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Durasi</p>
                  <p className="font-medium">{selectedLog.duration_ms}ms</p>
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Error Message:</p>
                  <p className="text-sm text-red-800 dark:text-red-200">{selectedLog.error_message}</p>
                </div>
              )}

              {/* Request/Response Tabs */}
              <Tabs defaultValue="response">
                <TabsList>
                  <TabsTrigger value="request">Request Body</TabsTrigger>
                  <TabsTrigger value="response">Response Body</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <ScrollArea className="h-[300px] rounded-md border">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all bg-slate-950 text-slate-50">
                      {formatJSON(selectedLog.request_body) || "(kosong)"}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="response">
                  <ScrollArea className="h-[300px] rounded-md border">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all bg-slate-950 text-slate-50">
                      {formatJSON(selectedLog.response_body) || "(kosong)"}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BPJSPageFrame>
  );
}
