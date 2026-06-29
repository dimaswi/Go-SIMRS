import { useState, useEffect, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  AlertCircle,
  Send,
  SlidersHorizontal,
  Search,
  X,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  ListOrdered,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const [filterOpen, setFilterOpen] = useState(false);
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

  // Handle retry AddAntrean
  const handleRetryAddAntrean = async (queueId: number) => {
    setSendingTask(-1); // use -1 as "retrying add" indicator

    try {
      const response = await bpjsApi.retryAddAntrean(queueId);

      toast({
        variant: response.data.success ? "default" : "destructive",
        title: response.data.success ? "Berhasil" : "Gagal",
        description: `AddAntrean: ${response.data.response_msg} (code: ${response.data.response_code})`,
      });

      if (response.data.data) {
        setQueues(prev => prev.map(q =>
          q.id === queueId ? { ...q, ...response.data.data } : q
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

  const getJenisKunjunganLabel = (jenis: number) => {
    switch (jenis) {
      case 1: return "Rujukan FKTP";
      case 2: return "Rujukan Internal";
      case 3: return "Kontrol";
      case 4: return "Rujukan Antar RS";
      default: return String(jenis);
    }
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

  return (
    <BPJSPageFrame
      title="Monitoring Antrian BPJS"
      description=""
    >
      <BPJSSectionPanel title="Workspace Monitoring">
        <Tabs value={mainTab} onValueChange={setMainTab} variant="inline" className="w-full">
          <TabsList>
            <TabsTrigger value="lokal">
              <Activity className="mr-2 h-4 w-4" />
              Monitoring Lokal
            </TabsTrigger>
            <TabsTrigger value="antrian-online">
              <ListOrdered className="mr-2 h-4 w-4" />
              Antrian Online BPJS
            </TabsTrigger>
          </TabsList>

          {/* ===== MONITORING LOKAL ===== */}
          <TabsContent value="lokal" className="mt-6 space-y-4">
            <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Data Antrian Lokal</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dateFilter
                      ? format(new Date(dateFilter), "EEEE, dd MMMM yyyy", { locale: idLocale })
                      : "Semua Tanggal"}
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                    Filter
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="flex items-center gap-2 flex-wrap pt-3">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-9 w-40"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-32">
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
                    className="h-9 w-48"
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadQueues} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredQueues.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Tidak ada data antrian</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{filteredQueues.length} antrean ditemukan</p>
                <div className="border rounded-lg overflow-x-auto bg-background">
                  <Table containerClassName="!border-none">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[280px] h-7 py-0">No. Reg / Antrean</TableHead>
                        <TableHead className="w-[180px] h-7 py-0">Nama Pasien</TableHead>
                        <TableHead className="w-[50px] h-7 py-0">Task Timeline</TableHead>
                        <TableHead className="w-[160px] h-7 py-0">Sync Info</TableHead>
                        <TableHead className="w-[40px] h-7 py-0"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQueues.map((queue) => (
                        <TableRow key={queue.id} className="group">
                          <TableCell className="align-middle py-1 whitespace-nowrap">
                            <div className="font-mono text-[16px] font-semibold flex items-center gap-1.5">
                              {queue.kode_booking}
                              <div className="scale-90 origin-left flex gap-1">
                                {getStatusBadge(queue.nomor_antrean)}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="align-middle py-1 whitespace-nowrap">
                            <div className="font-medium text-[16px] truncate max-w-[300px]" title={queue.nama_pasien}>{queue.nama_pasien}</div>
                          </TableCell>

                          <TableCell className="align-middle py-1 whitespace-nowrap">
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

                              {/* Farmasi buffer warnings - inline icons if needed */}
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
                          </TableCell>

                          <TableCell className="align-middle py-1 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {queue.last_sync_at && (
                                <div className="text-[12px] text-muted-foreground whitespace-nowrap" title={format(new Date(queue.last_sync_at), "dd/MM HH:mm")}>
                                  {format(new Date(queue.last_sync_at), "HH:mm")}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle py-1 whitespace-nowrap text-right pr-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedQueueDetail(queue)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== ANTRIAN ONLINE BPJS ===== */}
          <TabsContent value="antrian-online" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Pendaftaran Antrean Online</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Lihat daftar antrean yang terdaftar di BPJS Antrian Online per tanggal</p>
            </div>

            <div className="flex gap-2 items-end max-w-lg">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Tanggal</label>
                <Input
                  type="date"
                  value={antreanTanggal}
                  onChange={(e) => setAntreanTanggal(e.target.value)}
                />
              </div>
              <Button onClick={handleSearchAntrean} variant="outline" disabled={antreanLoading}>
                {antreanLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Cari
              </Button>
            </div>

            {/* Results */}
            {antreanSearched && !antreanLoading && antreanData.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Tidak ada data antrean untuk tanggal ini</p>
            )}

            {antreanData.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{antreanData.length} antrean ditemukan</p>
                <div className="border rounded-lg overflow-x-auto bg-background">
                  <Table containerClassName="!border-none">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[280px] h-7 py-0">No. Reg / Antrean</TableHead>
                        <TableHead className="w-[180px] h-7 py-0">RM / BPJS</TableHead>
                        <TableHead className="w-[250px] h-7 py-0">Poli & Dokter</TableHead>
                        <TableHead className="w-[160px] h-7 py-0">Status</TableHead>
                        <TableHead className="w-[120px] h-7 py-0"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {antreanData.map((item) => (
                        <Fragment key={item.kodebooking}>
                          <TableRow className="group">
                            <TableCell className="align-middle py-1 whitespace-nowrap">
                              <div className="font-mono text-[16px] font-semibold flex items-center gap-1.5">
                                {item.kodebooking}
                                <div className="scale-90 origin-left flex gap-1">
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{item.noantrean}</Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-middle py-1 whitespace-nowrap">
                              <div className="flex flex-col text-[12px]">
                                <span className="font-medium">RM: {item.norekammedis}</span>
                                <span className="text-muted-foreground">BPJS: {item.nokapst}</span>
                              </div>
                            </TableCell>
                            <TableCell className="align-middle py-1 whitespace-nowrap">
                              <div className="flex flex-col text-[12px]">
                                <span className="font-medium truncate max-w-[200px]" title={String(item.kodedokter)}>{item.kodepoli} / {item.kodedokter}</span>
                                <span className="text-muted-foreground">{item.jampraktek}</span>
                              </div>
                            </TableCell>
                            <TableCell className="align-middle py-1 whitespace-nowrap">
                              <div className="scale-90 origin-left">
                                <Badge variant="outline" className={cn("text-[10px]",
                                  item.status === "Belum" || item.status === "Belum dilayani" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    item.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                                      item.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        "bg-muted text-muted-foreground"
                                )}>
                                  {item.status}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="align-middle py-1 whitespace-nowrap text-right pr-4">
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
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
                            </TableCell>
                          </TableRow>


                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </BPJSSectionPanel>

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