import { useState, useEffect, useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Activity,
  Send,
  Search,
  X,
  ClipboardList,
  ListOrdered,
} from "lucide-react";

import { bpjsApi, type BPJSQueue, type BPJSPendaftaranAntreanItem, type BPJSListTaskItem } from "@/lib/api/bpjs";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BPJSPageFrame, BPJSSectionPanel } from "./shared-page-chrome";

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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState<QueueWithTaskLogs[]>([]);

  // Per-task send modal state
  const [sendTaskModal, setSendTaskModal] = useState<{ queue: QueueWithTaskLogs; taskNum: number; taskName: string } | null>(null);
  const [sendTaskWaktu, setSendTaskWaktu] = useState("");

  // Manual send task state
  const [sendingTask, setSendingTask] = useState<number | null>(null);
  const [lastSendResult, setLastSendResult] = useState<{
    taskId: number;
    success: boolean;
    responseCode: number;
    responseMsg: string;
  } | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Active main tab
  const [mainTab, setMainTab] = useState("lokal");

  // Antrian Online state
  const [antreanTanggal, setAntreanTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [antreanLoading, setAntreanLoading] = useState(false);
  const [antreanData, setAntreanData] = useState<BPJSPendaftaranAntreanItem[]>([]);
  const [antreanSearched, setAntreanSearched] = useState(false);
  const [antreanCancelling, setAntreanCancelling] = useState<string | null>(null);
  const [antreanCancelConfirm, setAntreanCancelConfirm] = useState<BPJSPendaftaranAntreanItem | null>(null);
  const [antreanCancelKeterangan, setAntreanCancelKeterangan] = useState("");
  const [antreanExpandedItem, setAntreanExpandedItem] = useState<string | null>(null);
  const [antreanDetailTab, setAntreanDetailTab] = useState<"tasks" | "detail">("tasks");
  const [antreanTasks, setAntreanTasks] = useState<Record<string, BPJSListTaskItem[]>>({});
  const [antreanTasksLoading, setAntreanTasksLoading] = useState<string | null>(null);
  const [antreanBookingDetail, setAntreanBookingDetail] = useState<Record<string, BPJSPendaftaranAntreanItem[]>>({});
  const [antreanDetailLoading, setAntreanDetailLoading] = useState<string | null>(null);

  const [selectedQueueDetail, setSelectedQueueDetail] = useState<QueueWithTaskLogs | null>(null);

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

  // Handle manual send task (from per-task modal)
  const handleSendTask = async (queueId: number, taskId: number) => {
    const waktuStr = sendTaskWaktu;
    if (!waktuStr) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Waktu untuk Task ${taskId} belum diisi`,
      });
      return;
    }

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

      if (result.success) {
        const taskField = `task${taskId}_at` as keyof BPJSQueue;
        const waktuISO = waktuDate.toISOString();

        setQueues(prev => prev.map(q =>
          q.id === queueId ? { ...q, [taskField]: waktuISO, sync_status: "synced", last_sync_at: new Date().toISOString() } : q
        ));

        // Close modal on success
        setSendTaskModal(null);
      } else {
        // Refresh to get the latest sync_error from DB
        loadQueues();
      }

      toast({
        variant: result.success ? "default" : "destructive",
        title: result.success ? "Berhasil" : "Gagal",
        description: `Task ${taskId}: ${result.responseMsg} (code: ${result.responseCode})`,
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || (error instanceof Error ? error.message : "Gagal mengirim task");
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
      // Refresh to get the latest sync_error from DB (if any)
      loadQueues();
    } finally {
      setSendingTask(null);
    }
  };

  // Initialize task times when selected queue changes - removed (now per-task modal)

  // Antrian Online handlers
  const handleSearchAntrean = async () => {
    if (!antreanTanggal) {
      toast({ variant: "destructive", title: "Tanggal wajib diisi" });
      return;
    }
    setAntreanLoading(true);
    setAntreanData([]);
    setAntreanSearched(true);
    try {
      const res = await bpjsApi.getPendaftaranAntrean(antreanTanggal);
      setAntreanData(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil data antrean" });
    } finally {
      setAntreanLoading(false);
    }
  };

  const handleBatalAntrean = async (item: BPJSPendaftaranAntreanItem) => {
    if (!antreanCancelKeterangan.trim()) {
      toast({ variant: "destructive", title: "Keterangan wajib diisi" });
      return;
    }
    setAntreanCancelling(item.kodebooking);
    try {
      await bpjsApi.batalAntrean(item.kodebooking, antreanCancelKeterangan);
      toast({ title: "Berhasil", description: `Antrean ${item.kodebooking} berhasil dibatalkan` });
      setAntreanData(prev => prev.filter(a => a.kodebooking !== item.kodebooking));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal membatalkan antrean" });
    } finally {
      setAntreanCancelling(null);
      setAntreanCancelConfirm(null);
      setAntreanCancelKeterangan("");
    }
  };

  const handleToggleAntreanDetail = async (kodebooking: string, tab: "tasks" | "detail") => {
    if (antreanExpandedItem === kodebooking && antreanDetailTab === tab) {
      setAntreanExpandedItem(null);
      return;
    }
    setAntreanExpandedItem(kodebooking);
    setAntreanDetailTab(tab);

    if (tab === "tasks" && !antreanTasks[kodebooking]) {
      setAntreanTasksLoading(kodebooking);
      try {
        const res = await bpjsApi.getListTask(kodebooking);
        setAntreanTasks(prev => ({ ...prev, [kodebooking]: res.data.data || [] }));
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil list task" });
      } finally {
        setAntreanTasksLoading(null);
      }
    }

    if (tab === "detail" && !antreanBookingDetail[kodebooking]) {
      setAntreanDetailLoading(kodebooking);
      try {
        const res = await bpjsApi.getPendaftaranByKodeBooking(kodebooking);
        setAntreanBookingDetail(prev => ({ ...prev, [kodebooking]: res.data.data || [] }));
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil detail pendaftaran" });
      } finally {
        setAntreanDetailLoading(null);
      }
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

    let taskError = null;
    if (queue.sync_status === "failed" && queue.sync_error && queue.sync_error.includes(`[Task ${taskNum}]`)) {
      taskError = queue.sync_error.replace(`[Task ${taskNum}] `, "");
    }

    if (taskTime) {
      return { sent: true, failed: false, time: taskTime as string, error: null };
    }
    if (taskError) {
      return { sent: false, failed: true, time: null, error: taskError };
    }
    return { sent: false, failed: false, time: null, error: null };
  };

  const TaskBadge = ({ queue, taskNum, taskName, onClick }: { queue: QueueWithTaskLogs; taskNum: number; taskName: string; onClick?: () => void }) => {
    const status = getTaskStatus(queue, taskNum);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={onClick}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${onClick ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-help"} ${status.sent
                ? "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
                : status.failed
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200"
                }`}>
              {status.sent ? (
                <CheckCircle className="h-3 w-3" />
              ) : status.failed ? (
                <XCircle className="h-3 w-3" />
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
              ) : status.failed ? (
                <p className="text-red-500 max-w-[200px] break-words">Gagal: {status.error}</p>
              ) : (
                <p className="text-gray-500">Belum terkirim</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };



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

  const lokalColumns = useMemo<ColumnDef<QueueWithTaskLogs>[]>(() => [
    {
      header: "No. Reg / Antrean",
      accessorKey: "kode_booking",
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="font-mono text-sm font-semibold flex items-center gap-2">
            {queue.kode_booking}
            <span className="text-muted-foreground font-normal text-xs">{queue.nomor_antrean}</span>
          </div>
        );
      },
    },
    {
      header: "Nama Pasien",
      accessorKey: "nama_pasien",
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="font-medium text-sm truncate max-w-[300px]" title={queue.nama_pasien}>
            {queue.nama_pasien}
          </div>
        );
      },
    },
    {
      header: "Task Timeline",
      id: "task_timeline",
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="flex items-center gap-1">
            {[
              { num: 3, name: "Tunggu Poli" },
              { num: 4, name: "Dipanggil" },
              { num: 5, name: "Selesai Periksa" },
              { num: 6, name: "Tunggu Farmasi" },
              { num: 7, name: "Serah Obat" },
            ].map(t => (
              <TaskBadge
                key={t.num}
                queue={queue}
                taskNum={t.num}
                taskName={t.name}
                onClick={() => {
                  const taskTime = queue[`task${t.num}_at` as keyof BPJSQueue] as string | undefined;
                  setSendTaskModal({ queue, taskNum: t.num, taskName: t.name });
                  setSendTaskWaktu(taskTime
                    ? format(new Date(taskTime), "yyyy-MM-dd'T'HH:mm:ss")
                    : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
                  );
                  setLastSendResult(null);
                }}
              />
            ))}
            {(queue.farmasi_ready_at && !queue.task6_at) || (queue.farmasi_selesai_at && !queue.task7_at) ? (
              <div className="flex gap-1 ml-1">
                {queue.farmasi_ready_at && !queue.task6_at && (
                  <div className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200 flex items-center h-[22px]" title="Resep dibuat, mnunggu T5">
                    <Clock className="h-2.5 w-2.5 mr-0.5" /> T5
                  </div>
                )}
                {queue.farmasi_selesai_at && !queue.task7_at && (
                  <div className="text-[9px] text-orange-600 bg-orange-50 px-1 rounded border border-orange-200 flex items-center h-[22px]" title="Obat diserahkan, mnunggu T6">
                    <Clock className="h-2.5 w-2.5 mr-0.5" /> T6
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "Sync Info",
      accessorKey: "last_sync_at",
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="flex items-center gap-2">
            {queue.last_sync_at && (
              <div className="text-[12px] text-muted-foreground whitespace-nowrap" title={format(new Date(queue.last_sync_at), "dd/MM HH:mm")}>
                {format(new Date(queue.last_sync_at), "HH:mm")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: () => <div className="text-center"></div>,
      id: "actions",
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedQueueDetail(queue)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], []);

  const antreanOnlineColumns = useMemo<ColumnDef<BPJSPendaftaranAntreanItem>[]>(() => [
    {
      header: "No. Reg / Antrean",
      accessorKey: "kodebooking",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="font-mono text-sm font-semibold flex items-center gap-2">
            {item.kodebooking}
            <span className="text-muted-foreground font-normal text-xs">{item.noantrean}</span>
          </div>
        );
      }
    },
    {
      header: "RM / BPJS",
      accessorKey: "norekammedis",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-[12px] whitespace-nowrap">
            <span className="font-medium mr-2">RM: {item.norekammedis}</span>
            <span className="text-muted-foreground">BPJS: {item.nokapst}</span>
          </div>
        );
      }
    },
    {
      header: "Poli & Dokter",
      accessorKey: "kodepoli",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-[12px] whitespace-nowrap truncate max-w-[250px]" title={`${item.kodepoli} / ${item.kodedokter} (${item.jampraktek})`}>
            <span className="font-medium mr-2">
              {item.kodepoli} / {item.kodedokter}
            </span>
            <span className="text-muted-foreground">{item.jampraktek}</span>
          </div>
        );
      }
    },
    {
      header: () => <div className="text-center">Status</div>,
      accessorKey: "status",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-center scale-90">
            <Badge variant="outline" className={cn("text-[10px]",
              item.status === "Belum" || item.status === "Belum dilayani" ? "bg-amber-50 text-amber-700 border-amber-200" :
                item.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                  item.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-muted text-muted-foreground"
            )}>
              {item.status}
            </Badge>
          </div>
        );
      }
    },
    {
      header: () => <div className="text-center"></div>,
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1 justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              disabled={antreanTasksLoading === item.kodebooking}
              onClick={() => handleToggleAntreanDetail(item.kodebooking, "tasks")}
              title="List Task"
            >
              {antreanTasksLoading === item.kodebooking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => handleToggleAntreanDetail(item.kodebooking, "detail")}
              title="Detail Pendaftaran"
            >
              {antreanDetailLoading === item.kodebooking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={antreanCancelling === item.kodebooking}
              onClick={() => setAntreanCancelConfirm(item)}
              title="Batalkan Antrean"
            >
              {antreanCancelling === item.kodebooking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        );
      }
    }
  ], [
    antreanTasksLoading,
    handleToggleAntreanDetail,
    antreanDetailLoading,
    antreanCancelling,
    setAntreanCancelConfirm
  ]);

  return (
    <BPJSPageFrame
      title="Monitoring Antrian BPJS"
      description=""
    >
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <BPJSSectionPanel
          title="Workspace Monitoring"
          actions={
            <TabsList className="h-auto bg-transparent p-0 gap-1.5">
              <TabsTrigger 
                value="lokal" 
                className="h-7 text-[11px] px-3.5 rounded-full border border-transparent data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:bg-muted/50 transition-all"
              >
                <Activity className="mr-1.5 h-3.5 w-3.5" />
                Monitoring Lokal
              </TabsTrigger>
              <TabsTrigger 
                value="antrian-online" 
                className="h-7 text-[11px] px-3.5 rounded-full border border-transparent data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:bg-muted/50 transition-all"
              >
                <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
                Antrian Online BPJS
              </TabsTrigger>
            </TabsList>
          }
        >

          {/* ===== MONITORING LOKAL ===== */}
          <TabsContent value="lokal" className="mt-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-7 w-[120px] !text-[11px]"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 w-[120px] !text-[11px]">
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
                <div className="relative flex-1 max-w-[200px]">
                  <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari pasien..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 pl-7 !text-[11px] w-full"
                  />
                </div>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={loadQueues} disabled={loading}>
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredQueues.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Tidak ada data antrian</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">{filteredQueues.length} antrean ditemukan</p>
                <div className="bg-background rounded-lg">
                  <DataTable
                    columns={lokalColumns}
                    data={filteredQueues}
                    showSearch={false}
                    showPagination={true}
                    pageSize={50}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== ANTRIAN ONLINE BPJS ===== */}
          <TabsContent value="antrian-online" className="mt-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <div className="flex gap-1.5 items-center">
                <Input
                  type="date"
                  value={antreanTanggal}
                  onChange={(e) => setAntreanTanggal(e.target.value)}
                  className="h-7 w-[120px] !text-[11px]"
                />
                <Button onClick={handleSearchAntrean} variant="outline" disabled={antreanLoading} className="h-7 !text-[11px] px-3">
                  {antreanLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Search className="h-3 w-3 mr-1.5" />}
                  Cari
                </Button>
              </div>
            </div>

            {/* Results */}
            {antreanSearched && !antreanLoading && antreanData.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Tidak ada data antrean untuk tanggal ini</p>
            )}

            {antreanData.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">{antreanData.length} antrean ditemukan</p>
                <div className="bg-background rounded-lg">
                  <DataTable
                    columns={antreanOnlineColumns}
                    data={antreanData}
                    showSearch={false}
                    showPagination={true}
                    pageSize={50}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </BPJSSectionPanel>
      </Tabs>

      {/* Batal Antrean Confirmation */}
      <AlertDialog open={!!antreanCancelConfirm} onOpenChange={(open) => { if (!open) { setAntreanCancelConfirm(null); setAntreanCancelKeterangan(""); } }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Antrean?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p>Antrean ini akan dibatalkan di BPJS Antrian Online.</p>
                {antreanCancelConfirm && (
                  <dl className="border rounded-md px-3 py-2 space-y-1 bg-muted/30 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kode Booking</dt>
                      <dd>{antreanCancelConfirm.kodebooking}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Poli</dt>
                      <dd>{antreanCancelConfirm.kodepoli}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. Antrean</dt>
                      <dd>{antreanCancelConfirm.noantrean}</dd>
                    </div>
                  </dl>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="batal-keterangan-monitor" className="text-xs">Keterangan <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="batal-keterangan-monitor"
                    placeholder="Alasan pembatalan antrean..."
                    value={antreanCancelKeterangan}
                    onChange={(e) => setAntreanCancelKeterangan(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              disabled={!antreanCancelKeterangan.trim() || antreanCancelling !== null}
              onClick={() => antreanCancelConfirm && handleBatalAntrean(antreanCancelConfirm)}
            >
              {antreanCancelling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
              Batalkan Antrean
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Queue Dialog */}
      <Dialog open={!!selectedQueueDetail} onOpenChange={(open) => { if (!open) setSelectedQueueDetail(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Detail Pendaftaran
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informasi lengkap pendaftaran antrean
            </DialogDescription>
          </DialogHeader>

          {selectedQueueDetail && (
            <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Kode Booking</p>
                  <p className="font-mono font-medium text-sm">{selectedQueueDetail.kode_booking}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">No. Antrean</p>
                  <p className="font-medium text-sm">{selectedQueueDetail.nomor_antrean}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedQueueDetail.status}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Tanggal Periksa</p>
                  <p>{format(new Date(selectedQueueDetail.tanggal_periksa), "dd MMM yyyy", { locale: idLocale })}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Nama Pasien</p>
                  <p className="font-medium">{selectedQueueDetail.nama_pasien}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">No. RM</p>
                  <p className="font-mono">{selectedQueueDetail.no_rm}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">No. Kartu BPJS</p>
                  <p className="font-mono">{selectedQueueDetail.no_kartu}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">NIK</p>
                  <p className="font-mono">{selectedQueueDetail.nik}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">No. HP</p>
                  <p>{selectedQueueDetail.no_hp}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Jenis Pasien</p>
                  <p>{selectedQueueDetail.jenis_pasien}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground col-span-2">No. Rujukan</p>
                  <p className="font-mono">{selectedQueueDetail.nomor_referensi || "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Poli</p>
                  <p className="font-medium">{selectedQueueDetail.nama_poli}</p>
                </div>
                <div className="space-y-1 col-span-3">
                  <p className="text-muted-foreground">Dokter</p>
                  <p className="font-medium">{selectedQueueDetail.nama_dokter} <span className="text-muted-foreground font-normal">({selectedQueueDetail.jam_praktek})</span></p>
                </div>
              </div>

              {selectedQueueDetail.task_logs && selectedQueueDetail.task_logs.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium mb-2">Riwayat Pengiriman Task BPJS</p>
                  <div className="border rounded-md overflow-hidden bg-background">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/40 text-muted-foreground">
                          <th className="text-left font-medium px-3 py-1.5 w-16">Task ID</th>
                          <th className="text-left font-medium px-3 py-1.5">Waktu Update</th>
                          <th className="text-left font-medium px-3 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQueueDetail.task_logs.map((log, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-mono font-medium">{log.task_id}</td>
                            <td className="px-3 py-1.5 tabular-nums">
                              {log.sent_at ? format(new Date(log.sent_at), "dd/MM/yyyy HH:mm:ss") : "-"}
                            </td>
                            <td className="px-3 py-1.5">
                              {log.is_success ? (
                                <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Sukses</span>
                              ) : (
                                <span className="text-red-600 flex items-center gap-1 cursor-help" title={log.response_message}><XCircle className="h-3 w-3" /> Gagal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Detail Queue Dialog BPJS Antrian Online */}
      <Dialog open={!!antreanExpandedItem} onOpenChange={(open) => { if (!open) setAntreanExpandedItem(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Detail Antrean BPJS Online
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informasi pendaftaran dan task dari BPJS Antrian Online
            </DialogDescription>
          </DialogHeader>

          {antreanExpandedItem && (
            <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              {/* Tab switcher */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleToggleAntreanDetail(antreanExpandedItem, "tasks")}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md transition-colors",
                    antreanDetailTab === "tasks" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                  )}
                >
                  <ClipboardList className="h-3 w-3 inline mr-1" />
                  List Task
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAntreanDetail(antreanExpandedItem, "detail")}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md transition-colors",
                    antreanDetailTab === "detail" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                  )}
                >
                  <Eye className="h-3 w-3 inline mr-1" />
                  Detail Pendaftaran
                </button>
              </div>

              {/* Tasks view */}
              {antreanDetailTab === "tasks" && (
                <>
                  {antreanTasksLoading === antreanExpandedItem ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Memuat list task...</span>
                    </div>
                  ) : antreanTasks[antreanExpandedItem]?.length ? (
                    <div className="border rounded-md overflow-hidden bg-background">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground">
                            <th className="text-left font-medium px-3 py-1.5 w-16">Task ID</th>
                            <th className="text-left font-medium px-3 py-1.5">Task Name</th>
                            <th className="text-left font-medium px-3 py-1.5">Waktu</th>
                            <th className="text-left font-medium px-3 py-1.5">Waktu RS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {antreanTasks[antreanExpandedItem].map((task) => (
                            <tr key={task.taskid} className="border-b last:border-0">
                              <td className="px-3 py-1.5 font-mono font-medium">{task.taskid}</td>
                              <td className="px-3 py-1.5">{task.taskname}</td>
                              <td className="px-3 py-1.5 tabular-nums">
                                {task.waktu || "-"}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{task.wakturs || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data task</p>
                  )}
                </>
              )}

              {/* Detail view */}
              {antreanDetailTab === "detail" && (
                <>
                  {antreanDetailLoading === antreanExpandedItem ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Memuat detail pendaftaran...</span>
                    </div>
                  ) : antreanBookingDetail[antreanExpandedItem]?.length ? (
                    <div className="space-y-3">
                      {antreanBookingDetail[antreanExpandedItem].map((d, idx) => (
                        <div key={idx} className="border rounded-md bg-background px-4 py-3">
                          <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-xs">
                            <div>
                              <dt className="text-muted-foreground mb-1">Kode Booking</dt>
                              <dd className="font-mono font-medium text-sm">{d.kodebooking}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">No. Antrean</dt>
                              <dd className="font-medium text-sm">{d.noantrean}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Status</dt>
                              <dd>
                                <Badge variant="outline" className={cn("text-[10px]",
                                  d.status === "Belum" || d.status === "Belum dilayani" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    d.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                                      d.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        "bg-muted text-muted-foreground"
                                )}>
                                  {d.status}
                                </Badge>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Tanggal</dt>
                              <dd>{d.tanggal}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Poli</dt>
                              <dd className="font-medium">{d.kodepoli}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Dokter</dt>
                              <dd>{d.kodedokter}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">NIK</dt>
                              <dd className="font-mono">{d.nik}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">No. Kartu BPJS</dt>
                              <dd className="font-mono">{d.nokapst}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">No. HP</dt>
                              <dd>{d.nohp}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">No. Rekam Medis</dt>
                              <dd className="font-mono">{d.norekammedis}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Jenis Kunjungan</dt>
                              <dd>{d.jeniskunjungan === 1 ? "Rujukan FKTP" : d.jeniskunjungan === 2 ? "Rujukan Internal" : d.jeniskunjungan === 3 ? "Kontrol" : d.jeniskunjungan === 4 ? "Rujukan Antar RS" : d.jeniskunjungan}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">No. Referensi</dt>
                              <dd className="font-mono">{d.nomorreferensi || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Sumber Data</dt>
                              <dd>{d.sumberdata}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Estimasi Dilayani</dt>
                              <dd>{d.estimasidilayani ? new Date(d.estimasidilayani).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground mb-1">Created</dt>
                              <dd>{d.createdtime ? new Date(d.createdtime).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data detail pendaftaran</p>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Per-Task Send Dialog */}
      <Dialog open={!!sendTaskModal} onOpenChange={(open) => { if (!open) setSendTaskModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Send className="h-4 w-4" />
              Kirim Task {sendTaskModal?.taskNum}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {sendTaskModal?.taskName}
            </DialogDescription>
          </DialogHeader>

          {sendTaskModal && (
            <div className="space-y-4">

              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Kode Booking: <span className="font-mono font-medium text-foreground">{sendTaskModal.queue.kode_booking}</span></p>
                <p className="text-muted-foreground">Pasien: <span className="font-medium text-foreground">{sendTaskModal.queue.nama_pasien}</span></p>
              </div>

              {/* Last send result */}
              {lastSendResult && lastSendResult.taskId === sendTaskModal.taskNum && (
                <div className={cn(
                  "p-2.5 rounded-md border text-xs",
                  lastSendResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                )}>
                  <p className="font-medium">{lastSendResult.success ? "Berhasil" : "Gagal"}: {lastSendResult.responseMsg}</p>
                  <p className="text-[10px] mt-0.5">Response Code: {lastSendResult.responseCode}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Waktu</Label>
                <Input
                  type="datetime-local"
                  step="1"
                  value={sendTaskWaktu}
                  onChange={(e) => setSendTaskWaktu(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSendTaskModal(null)}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleSendTask(sendTaskModal.queue.id, sendTaskModal.taskNum)}
                  disabled={sendingTask !== null || !sendTaskWaktu}
                >
                  {sendingTask === sendTaskModal.taskNum ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  Kirim ke BPJS
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BPJSPageFrame>
  );
}
