import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Smartphone,
  Calendar,
  Activity,
  AlertCircle,
  Send,
} from "lucide-react";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";

interface TaskLog {
  task_id: number;
  task_name: string;
  sent_at?: string;
  response_code?: number;
  response_message?: string;
  is_success: boolean;
}

interface QueueWithTaskLogs extends BPJSQueue {
  task_logs?: TaskLog[];
}

export default function BPJSQueueMonitoringPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState<QueueWithTaskLogs[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<QueueWithTaskLogs | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Manual send task state
  const [sendingTask, setSendingTask] = useState<number | null>(null);
  const [lastSendResult, setLastSendResult] = useState<{
    taskId: number;
    success: boolean;
    responseCode: number;
    responseMsg: string;
  } | null>(null);
  
  // Editable task times (milliseconds)
  const [taskTimes, setTaskTimes] = useState<Record<number, string>>({});
  
  // Retry AddAntrean state
  const [retryingAdd, setRetryingAdd] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setPageTitle("Monitoring Antrian BPJS");
    loadQueues();
  }, []);

  const loadQueues = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const response = await bpjsApi.getQueues(params);
      setQueues(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data antrian BPJS",
      });
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, toast]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  // Handle manual send task
  const handleSendTask = async (queueId: number, taskId: number) => {
    // Get waktu from taskTimes state
    const waktuStr = taskTimes[taskId];
    if (!waktuStr) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Waktu untuk Task ${taskId} belum diisi`,
      });
      return;
    }
    
    // Parse datetime-local to milliseconds
    const waktuDate = new Date(waktuStr);
    if (isNaN(waktuDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Format waktu tidak valid`,
      });
      return;
    }
    const waktuMs = waktuDate.getTime();
    
    setSendingTask(taskId);
    setLastSendResult(null);
    
    try {
      const response = await bpjsApi.sendTaskManual(queueId, taskId, waktuMs);
      const result = {
        taskId,
        success: response.data.success,
        responseCode: response.data.response_code,
        responseMsg: response.data.response_msg,
      };
      setLastSendResult(result);
      
      toast({
        variant: result.success ? "default" : "destructive",
        title: result.success ? "Berhasil" : "Gagal",
        description: `Task ${taskId}: ${result.responseMsg} (code: ${result.responseCode})`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Gagal mengirim task";
      setLastSendResult({
        taskId,
        success: false,
        responseCode: 0,
        responseMsg: errorMsg,
      });
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
    } finally {
      setSendingTask(null);
    }
  };
  
  // Handle retry AddAntrean
  const handleRetryAddAntrean = async (queueId: number) => {
    setRetryingAdd(true);
    
    try {
      const response = await bpjsApi.retryAddAntrean(queueId);
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        title: response.data.success ? "Berhasil" : "Gagal",
        description: `AddAntrean: ${response.data.response_msg} (code: ${response.data.response_code})`,
      });
      
      // Update selected queue with new data
      if (response.data.data) {
        setSelectedQueue(response.data.data);
        // Also update in the list
        setQueues(prev => prev.map(q => 
          q.id === queueId ? response.data.data : q
        ));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Gagal mengirim AddAntrean";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
    } finally {
      setRetryingAdd(false);
    }
  };
  
  // Initialize task times when selected queue changes
  useEffect(() => {
    if (selectedQueue) {
      const times: Record<number, string> = {};
      
      // Task 3: waktu_checkin
      if (selectedQueue.waktu_checkin) {
        times[3] = format(new Date(selectedQueue.waktu_checkin), "yyyy-MM-dd'T'HH:mm:ss");
      }
      // Task 4-7: use task*_at if available, or leave empty
      if (selectedQueue.task4_at) {
        times[4] = format(new Date(selectedQueue.task4_at), "yyyy-MM-dd'T'HH:mm:ss");
      }
      if (selectedQueue.task5_at) {
        times[5] = format(new Date(selectedQueue.task5_at), "yyyy-MM-dd'T'HH:mm:ss");
      }
      if (selectedQueue.task6_at) {
        times[6] = format(new Date(selectedQueue.task6_at), "yyyy-MM-dd'T'HH:mm:ss");
      }
      if (selectedQueue.task7_at) {
        times[7] = format(new Date(selectedQueue.task7_at), "yyyy-MM-dd'T'HH:mm:ss");
      }
      
      setTaskTimes(times);
    }
  }, [selectedQueue]);

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: idLocale });
    } catch {
      return "-";
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "HH:mm:ss", { locale: idLocale });
    } catch {
      return "-";
    }
  };

  const getTaskStatus = (queue: QueueWithTaskLogs, taskNum: number) => {
    const taskField = `task${taskNum}_at` as keyof BPJSQueue;
    const taskTime = queue[taskField];
    
    if (taskTime) {
      return { sent: true, time: taskTime as string };
    }
    return { sent: false, time: null };
  };

  const TaskBadge = ({ queue, taskNum, taskName }: { queue: QueueWithTaskLogs; taskNum: number; taskName: string }) => {
    const status = getTaskStatus(queue, taskNum);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              status.sent 
                ? "bg-green-100 text-green-800 border border-green-300" 
                : "bg-gray-100 text-gray-500 border border-gray-300"
            }`}>
              {status.sent ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>T{taskNum}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">Task {taskNum}: {taskName}</p>
              {status.sent ? (
                <p className="text-green-600">Terkirim: {formatTime(status.time!)}</p>
              ) : (
                <p className="text-gray-500">Belum terkirim</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      booking: { color: "bg-yellow-100 text-yellow-800", label: "Booking" },
      checkin: { color: "bg-blue-100 text-blue-800", label: "Check-in" },
      dipanggil: { color: "bg-purple-100 text-purple-800", label: "Dipanggil" },
      dilayani: { color: "bg-indigo-100 text-indigo-800", label: "Dilayani" },
      selesai: { color: "bg-green-100 text-green-800", label: "Selesai" },
      batal: { color: "bg-red-100 text-red-800", label: "Batal" },
    };
    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getSyncStatusBadge = (syncStatus: string) => {
    if (syncStatus === "success" || syncStatus === "synced") {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Synced</Badge>;
    } else if (syncStatus === "failed") {
      return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const columns: ColumnDef<QueueWithTaskLogs>[] = [
    {
      accessorKey: "kode_booking",
      header: "Kode Booking",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.original.kode_booking}</span>
      ),
    },
    {
      accessorKey: "nama_pasien",
      header: "Pasien",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.nama_pasien}</p>
          <p className="text-xs text-muted-foreground">{row.original.no_kartu}</p>
        </div>
      ),
    },
    {
      accessorKey: "nomor_antrean",
      header: "No. Antrian",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">{row.original.nomor_antrean}</Badge>
      ),
    },
    {
      accessorKey: "nama_poli",
      header: "Poli",
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.nama_poli}</p>
          <p className="text-xs text-muted-foreground">{row.original.nama_dokter}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "tasks",
      header: "Task Status",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <TaskBadge queue={row.original} taskNum={3} taskName="Tunggu Poli" />
          <TaskBadge queue={row.original} taskNum={4} taskName="Dipanggil" />
          <TaskBadge queue={row.original} taskNum={5} taskName="Dilayani" />
          <TaskBadge queue={row.original} taskNum={6} taskName="Selesai" />
          <TaskBadge queue={row.original} taskNum={7} taskName="Farmasi" />
        </div>
      ),
    },
    {
      accessorKey: "sync_status",
      header: "Sync",
      cell: ({ row }) => getSyncStatusBadge(row.original.sync_status),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedQueue(row.original);
            setDetailOpen(true);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const filteredQueues = queues.filter((queue) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      queue.nama_pasien?.toLowerCase().includes(search) ||
      queue.no_kartu?.toLowerCase().includes(search) ||
      queue.kode_booking?.toLowerCase().includes(search) ||
      queue.nomor_antrean?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Monitoring Antrian BPJS
          </h1>
          <p className="text-muted-foreground">
            Pantau status pengiriman task BPJS Antrian Online
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b bg-muted/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Daftar Antrian BPJS</CardTitle>
              <CardDescription>
                {dateFilter
                  ? format(new Date(dateFilter), "EEEE, dd MMMM yyyy", { locale: idLocale })
                  : "Semua Tanggal"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="checkin">Check-in</SelectItem>
                  <SelectItem value="dipanggil">Dipanggil</SelectItem>
                  <SelectItem value="dilayani">Dilayani</SelectItem>
                  <SelectItem value="selesai">Selesai</SelectItem>
                  <SelectItem value="batal">Batal</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Cari pasien..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
              <Button variant="outline" size="icon" onClick={loadQueues} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredQueues}
              searchPlaceholder="Cari..."
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Detail Antrian BPJS
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap dan status task BPJS
            </DialogDescription>
          </DialogHeader>

          {selectedQueue && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 p-1">
                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Nama Pasien</label>
                    <p className="font-medium">{selectedQueue.nama_pasien}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">No. Kartu BPJS</label>
                    <p className="font-mono">{selectedQueue.no_kartu}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kode Booking</label>
                    <p className="font-mono font-medium text-primary">{selectedQueue.kode_booking}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">No. Antrian</label>
                    <p className="font-mono text-xl font-bold">{selectedQueue.nomor_antrean}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Poli</label>
                    <p>{selectedQueue.nama_poli}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Dokter</label>
                    <p>{selectedQueue.nama_dokter}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <div>{getStatusBadge(selectedQueue.status)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Sync Status</label>
                    <div>{getSyncStatusBadge(selectedQueue.sync_status)}</div>
                  </div>
                </div>

                {/* AddAntrean Status */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Status Pendaftaran ke BPJS (/antrean/add)
                  </h4>
                  <div className={`p-4 rounded-lg border ${
                    selectedQueue.add_antrean_code === 200
                      ? "bg-green-50 border-green-200"
                      : selectedQueue.add_antrean_sent
                        ? "bg-red-50 border-red-200"
                        : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${
                          selectedQueue.add_antrean_code === 200
                            ? "text-green-800"
                            : selectedQueue.add_antrean_sent
                              ? "text-red-800"
                              : "text-yellow-800"
                        }`}>
                          {selectedQueue.add_antrean_code === 200 ? (
                            <><CheckCircle className="h-4 w-4 inline mr-2" />Terdaftar di BPJS</>
                          ) : selectedQueue.add_antrean_sent ? (
                            <><XCircle className="h-4 w-4 inline mr-2" />Gagal Mendaftar</>
                          ) : (
                            <><Clock className="h-4 w-4 inline mr-2" />Belum Dikirim</>
                          )}
                        </p>
                        {selectedQueue.add_antrean_sent && (
                          <p className="text-sm mt-1">
                            Code: {selectedQueue.add_antrean_code} - {selectedQueue.add_antrean_msg || "-"}
                          </p>
                        )}
                      </div>
                      {/* Retry button if failed or not sent */}
                      {selectedQueue.add_antrean_code !== 200 && (
                        <Button
                          variant={selectedQueue.add_antrean_sent ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleRetryAddAntrean(selectedQueue.id)}
                          disabled={retryingAdd}
                        >
                          {retryingAdd ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Kirim Ulang
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Timeline */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Timeline Task BPJS
                  </h4>
                  
                  {/* Last Send Result */}
                  {lastSendResult && (
                    <div className={`mb-4 p-3 rounded-lg border ${
                      lastSendResult.success 
                        ? "bg-green-50 border-green-200" 
                        : "bg-red-50 border-red-200"
                    }`}>
                      <p className={`text-sm font-medium ${
                        lastSendResult.success ? "text-green-800" : "text-red-800"
                      }`}>
                        {lastSendResult.success ? "✓" : "✗"} Task {lastSendResult.taskId}: {lastSendResult.responseMsg}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Response Code: {lastSendResult.responseCode}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {[
                      { num: 1, name: "Mulai Tunggu Admisi", field: "task1_at", canSend: false },
                      { num: 2, name: "Selesai Admisi", field: "task2_at", canSend: false },
                      { num: 3, name: "Tunggu Poli (Check-in)", field: "task3_at", canSend: true, timeSource: "waktu_checkin" },
                      { num: 4, name: "Dipanggil Dokter", field: "task4_at", canSend: true },
                      { num: 5, name: "Mulai Dilayani", field: "task5_at", canSend: true },
                      { num: 6, name: "Selesai Periksa", field: "task6_at", canSend: true },
                      { num: 7, name: "Farmasi/Serah Obat", field: "task7_at", canSend: true },
                    ].map((task) => {
                      const taskTime = selectedQueue[task.field as keyof BPJSQueue] as string | undefined;
                      const isSent = !!taskTime;
                      const isSending = sendingTask === task.num;

                      return (
                        <div
                          key={task.num}
                          className={`p-3 rounded-lg border ${
                            isSent
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                isSent
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-300 text-gray-600"
                              }`}
                            >
                              {task.num}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Task {task.num}: {task.name}</p>
                              {isSent ? (
                                <p className="text-sm text-green-600">
                                  <CheckCircle className="h-3 w-3 inline mr-1" />
                                  Terkirim: {formatDateTime(taskTime)}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  Belum terkirim
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isSent ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Sent
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Editable time input + Send button for task 3-7 */}
                          {task.canSend && (
                            <div className="mt-3 flex items-center gap-2 pl-14">
                              <div className="flex-1">
                                <Input
                                  type="datetime-local"
                                  step="1"
                                  value={taskTimes[task.num] || ""}
                                  onChange={(e) => setTaskTimes(prev => ({
                                    ...prev,
                                    [task.num]: e.target.value
                                  }))}
                                  className="text-sm"
                                  placeholder="Pilih waktu..."
                                />
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleSendTask(selectedQueue.id, task.num)}
                                disabled={isSending || sendingTask !== null || !taskTimes[task.num]}
                                className="h-9"
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-4 w-4 mr-1" />
                                )}
                                Kirim
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sync Error */}
                {selectedQueue.sync_error && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Error Sinkronisasi
                    </h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <pre className="text-sm text-red-800 whitespace-pre-wrap">
                        {selectedQueue.sync_error}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span>Dibuat: </span>
                      <span>{formatDateTime(selectedQueue.created_at)}</span>
                    </div>
                    <div>
                      <span>Diupdate: </span>
                      <span>{formatDateTime(selectedQueue.updated_at)}</span>
                    </div>
                    {selectedQueue.waktu_checkin && (
                      <div>
                        <span>Check-in: </span>
                        <span>{formatDateTime(selectedQueue.waktu_checkin)}</span>
                      </div>
                    )}
                    {selectedQueue.last_sync_at && (
                      <div>
                        <span>Last Sync: </span>
                        <span>{formatDateTime(selectedQueue.last_sync_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
