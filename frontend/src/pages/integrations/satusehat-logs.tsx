import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SyncLog {
  id: number;
  integration: string;
  endpoint: string;
  method: string;
  request_body: string;
  response_code: number;
  response_body: string;
  status: "success" | "failed" | "timeout";
  error_message: string;
  request_at: string;
  response_at: string;
  duration_ms: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
}

export default function SatuSehatLogsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [searchEndpoint, setSearchEndpoint] = useState("");
  const [limit, setLimit] = useState("100");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: SyncLog[] }>('/integrations/sync-logs', {
        params: {
          integration: 'satusehat',
          limit: parseInt(limit),
        }
      });
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

  const viewLogDetail = (log: SyncLog) => {
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
        return "bg-blue-100 text-blue-800";
      case "POST":
        return "bg-green-100 text-green-800";
      case "PUT":
        return "bg-yellow-100 text-yellow-800";
      case "DELETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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
  const columns: ColumnDef<SyncLog>[] = [
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
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Log Request SatuSehat
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau semua request ke API SatuSehat
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setFilterOpen(!filterOpen)}>
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 p-4 border rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Request</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{stats.success}</p>
          <p className="text-xs text-muted-foreground">Sukses</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          <p className="text-xs text-muted-foreground">Gagal</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{stats.avgDuration}ms</p>
          <p className="text-xs text-muted-foreground">Rata-rata Durasi</p>
        </div>
      </div>

      {/* Filter */}
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent>
          <div className="p-4 border rounded-lg mt-2 flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="success">Sukses</SelectItem>
                  <SelectItem value="failed">Gagal</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cari Endpoint</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="/Encounter, /Patient..."
                  value={searchEndpoint}
                  onChange={(e) => setSearchEndpoint(e.target.value)}
                  className="w-[200px] h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limit</Label>
              <Select value={limit} onValueChange={(v) => { setLimit(v); }}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={loadLogs}>
              <Search className="h-4 w-4 mr-2" />
              Terapkan
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <DataTable
        columns={columns}
        data={filteredLogs}
        pageSize={15}
        tableId="satusehat-logs"
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
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600 font-medium mb-1">Error Message:</p>
                  <p className="text-sm text-red-800">{selectedLog.error_message}</p>
                </div>
              )}

              {/* Request/Response Tabs */}
              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request Body</TabsTrigger>
                  <TabsTrigger value="response">Response Body</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <ScrollArea className="h-[300px] rounded-md border">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap bg-slate-950 text-slate-50">
                      {formatJSON(selectedLog.request_body) || "(kosong)"}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="response">
                  <ScrollArea className="h-[300px] rounded-md border">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap bg-slate-950 text-slate-50">
                      {formatJSON(selectedLog.response_body) || "(kosong)"}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
