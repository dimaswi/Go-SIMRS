import { useState, useEffect, useCallback } from "react";
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
  
  // Local card expand state
  const [localExpandedItem, setLocalExpandedItem] = useState<number | null>(null);

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
      }
      
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
    <div className="flex flex-1 flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Monitoring Antrian BPJS
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau dan kelola antrian BPJS lokal maupun dari server BPJS
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-lg border p-6">
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
                <div className="border rounded-lg divide-y">
                  {filteredQueues.map((queue) => (
                    <div key={queue.id}>
                      <div className="px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-medium">{queue.kode_booking}</span>
                            {getStatusBadge(queue.status)}
                            {getSyncStatusBadge(queue.sync_status)}
                            {queue.add_antrean_code === 200 && (
                              <Badge variant="outline" className="text-[10px]">Bridging Antrean</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Poli: <strong className="text-foreground">{queue.nama_poli || queue.kode_poli}</strong></span>
                            <span>Dokter: <strong className="text-foreground">{queue.nama_dokter || queue.kode_dokter}</strong></span>
                            <span>Jam: {queue.jam_praktek}</span>
                            <span>No. Antrean: <strong className="text-foreground">{queue.nomor_antrean}</strong></span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Pasien: <strong className="text-foreground">{queue.nama_pasien}</strong></span>
                            <span>No. BPJS: {queue.no_kartu}</span>
                            <span>No. RM: {queue.no_rm}</span>
                            <span>No. HP: {queue.no_hp || "-"}</span>
                          </div>
                          {queue.nomor_referensi && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Referensi: <span className="font-mono">{queue.nomor_referensi}</span>
                              <span className="ml-2">(Jenis: {getJenisKunjunganLabel(queue.jenis_kunjungan)})</span>
                            </div>
                          )}
                          {/* Task badges row */}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <TaskBadge queue={queue} taskNum={3} taskName="Tunggu Poli" />
                            <TaskBadge queue={queue} taskNum={4} taskName="Dipanggil" />
                            <TaskBadge queue={queue} taskNum={5} taskName="Selesai Periksa" />
                            <TaskBadge queue={queue} taskNum={6} taskName="Tunggu Farmasi" />
                            <TaskBadge queue={queue} taskNum={7} taskName="Serah Obat" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setLocalExpandedItem(localExpandedItem === queue.id ? null : queue.id)}
                            title="Detail Task"
                          >
                            {localExpandedItem === queue.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded task detail panel */}
                      {localExpandedItem === queue.id && (
                        <div className="border-t bg-muted/20 px-4 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium">Detail Task & Sync</span>
                            <button
                              type="button"
                              onClick={() => setLocalExpandedItem(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          </div>

                          {/* AddAntrean status */}
                          <div className={cn(
                            "p-2.5 rounded-md border text-xs mb-3",
                            queue.add_antrean_code === 200
                              ? "bg-green-50 border-green-200"
                              : queue.add_antrean_sent
                                ? "bg-red-50 border-red-200"
                                : "bg-yellow-50 border-yellow-200"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {queue.add_antrean_code === 200 ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                ) : queue.add_antrean_sent ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-yellow-600" />
                                )}
                                <span className="font-medium">
                                  {queue.add_antrean_code === 200 ? "Terdaftar di BPJS" : queue.add_antrean_sent ? "Gagal Mendaftar" : "Belum Dikirim"}
                                </span>
                                {queue.add_antrean_sent && (
                                  <span className="text-muted-foreground">
                                    Code: {queue.add_antrean_code} - {queue.add_antrean_msg || "-"}
                                  </span>
                                )}
                              </div>
                              {queue.add_antrean_code !== 200 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleRetryAddAntrean(queue.id)}
                                  disabled={sendingTask === -1}
                                >
                                  {sendingTask === -1 ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  Kirim Ulang
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Farmasi buffer indicator - Task 6 menunggu Task 5 */}
                          {queue.farmasi_ready_at && !queue.task6_at && (
                            <div className="p-2.5 rounded-md border bg-amber-50 border-amber-200 text-xs mb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                <span className="font-medium text-amber-800">Resep Dibuat — Menunggu Task 5</span>
                              </div>
                              <p className="text-amber-700 mt-1">
                                Resep dibuat pada {formatDateTime(queue.farmasi_ready_at)}, 
                                tapi Task 5 (Selesai Periksa) belum terkirim. 
                                Task 6 akan otomatis dikirim setelah Task 5 berhasil.
                              </p>
                            </div>
                          )}

                          {/* Farmasi selesai buffer indicator - Task 7 menunggu Task 6 */}
                          {queue.farmasi_selesai_at && !queue.task7_at && (
                            <div className="p-2.5 rounded-md border bg-orange-50 border-orange-200 text-xs mb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-orange-600" />
                                <span className="font-medium text-orange-800">Obat Diserahkan — Menunggu Task 6</span>
                              </div>
                              <p className="text-orange-700 mt-1">
                                Obat diserahkan pada {formatDateTime(queue.farmasi_selesai_at)}, 
                                tapi Task 6 belum terkirim. 
                                Task 7 akan otomatis dikirim setelah Task 6 berhasil.
                              </p>
                            </div>
                          )}

                          {/* Task timeline compact */}
                          <div className="border rounded-md overflow-hidden bg-background">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-muted/40 text-muted-foreground">
                                  <th className="text-left font-medium px-3 py-1.5 w-16">Task</th>
                                  <th className="text-left font-medium px-3 py-1.5">Nama</th>
                                  <th className="text-left font-medium px-3 py-1.5">Status</th>
                                  <th className="text-left font-medium px-3 py-1.5">Waktu</th>
                                  <th className="text-left font-medium px-3 py-1.5 w-20"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { num: 1, name: "Mulai Tunggu Admisi", field: "task1_at", canSend: false },
                                  { num: 2, name: "Selesai Admisi", field: "task2_at", canSend: false },
                                  { num: 3, name: "Tunggu Poli (Check-in)", field: "task3_at", canSend: true },
                                  { num: 4, name: "Dipanggil Dokter", field: "task4_at", canSend: true },
                                  { num: 5, name: "Selesai Periksa (Visit Selesai)", field: "task5_at", canSend: true },
                                  { num: 6, name: "Mulai Tunggu Farmasi", field: "task6_at", canSend: true },
                                  { num: 7, name: "Selesai Farmasi (Serah Obat)", field: "task7_at", canSend: true },
                                ].map((task) => {
                                  const taskTime = queue[task.field as keyof BPJSQueue] as string | undefined;
                                  return (
                                    <tr key={task.num} className="border-b last:border-0">
                                      <td className="px-3 py-1.5 font-mono font-medium">{task.num}</td>
                                      <td className="px-3 py-1.5">{task.name}</td>
                                      <td className="px-3 py-1.5">
                                        {taskTime ? (
                                          <span className="inline-flex items-center gap-1 text-green-700">
                                            <CheckCircle className="h-3 w-3" />Terkirim
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">Pending</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 tabular-nums">{taskTime ? formatDateTime(taskTime) : "-"}</td>
                                      <td className="px-3 py-1.5">
                                        {task.canSend && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[10px]"
                                            onClick={() => {
                                              setSendTaskModal({ queue, taskNum: task.num, taskName: task.name });
                                              setSendTaskWaktu(taskTime
                                                ? format(new Date(taskTime), "yyyy-MM-dd'T'HH:mm:ss")
                                                : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
                                              );
                                              setLastSendResult(null);
                                            }}
                                          >
                                            <Send className="h-3 w-3 mr-1" />
                                            {taskTime ? "Kirim Ulang" : "Kirim"}
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Sync info */}
                          {queue.sync_error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              {queue.sync_error}
                            </div>
                          )}

                          <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                            {queue.waktu_checkin && <span>Check-in: {formatDateTime(queue.waktu_checkin)}</span>}
                            {queue.last_sync_at && <span>Last Sync: {formatDateTime(queue.last_sync_at)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                <div className="border rounded-lg divide-y">
                  {antreanData.map((item) => (
                    <div key={item.kodebooking}>
                      <div className="px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-medium">{item.kodebooking}</span>
                            <Badge variant="outline" className={cn("text-[10px]",
                              item.status === "Belum" || item.status === "Belum dilayani" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              item.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                              item.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {item.status}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.sumberdata}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Poli: <strong className="text-foreground">{item.kodepoli}</strong></span>
                            <span>Dokter: <strong className="text-foreground">{item.kodedokter}</strong></span>
                            <span>Jam: {item.jampraktek}</span>
                            <span>No. Antrean: <strong className="text-foreground">{item.noantrean}</strong></span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>NIK: {item.nik}</span>
                            <span>No. BPJS: {item.nokapst}</span>
                            <span>No. RM: {item.norekammedis}</span>
                            <span>No. HP: {item.nohp}</span>
                          </div>
                          {item.nomorreferensi && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Referensi: <span className="font-mono">{item.nomorreferensi}</span>
                              <span className="ml-2">
                                (Jenis: {item.jeniskunjungan === 1 ? "Rujukan FKTP" : item.jeniskunjungan === 2 ? "Rujukan Internal" : item.jeniskunjungan === 3 ? "Kontrol" : item.jeniskunjungan === 4 ? "Rujukan Antar RS" : item.jeniskunjungan})
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                      </div>

                      {/* Expanded detail panel */}
                      {antreanExpandedItem === item.kodebooking && (
                        <div className="border-t bg-muted/20 px-4 py-3">
                          {/* Tab switcher */}
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => handleToggleAntreanDetail(item.kodebooking, "tasks")}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md transition-colors",
                                antreanDetailTab === "tasks" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                              )}
                            >
                              <ClipboardList className="h-3 w-3 inline mr-1" />
                              List Task
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAntreanDetail(item.kodebooking, "detail")}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md transition-colors",
                                antreanDetailTab === "detail" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                              )}
                            >
                              <Eye className="h-3 w-3 inline mr-1" />
                              Detail Pendaftaran
                            </button>
                            <div className="flex-1" />
                            <button
                              type="button"
                              onClick={() => setAntreanExpandedItem(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Tasks view */}
                          {antreanDetailTab === "tasks" && (
                            <>
                              {antreanTasksLoading === item.kodebooking ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Memuat list task...</span>
                                </div>
                              ) : antreanTasks[item.kodebooking]?.length ? (
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
                                      {antreanTasks[item.kodebooking].map((task) => (
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
                              {antreanDetailLoading === item.kodebooking ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Memuat detail pendaftaran...</span>
                                </div>
                              ) : antreanBookingDetail[item.kodebooking]?.length ? (
                                <div className="space-y-3">
                                  {antreanBookingDetail[item.kodebooking].map((d, idx) => (
                                    <div key={idx} className="border rounded-md bg-background px-4 py-3">
                                      <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                        <div>
                                          <dt className="text-muted-foreground">Kode Booking</dt>
                                          <dd className="font-mono font-medium">{d.kodebooking}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Tanggal</dt>
                                          <dd>{d.tanggal}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Kode Poli</dt>
                                          <dd className="font-medium">{d.kodepoli}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Kode Dokter</dt>
                                          <dd>{d.kodedokter}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Jam Praktek</dt>
                                          <dd>{d.jampraktek}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">NIK</dt>
                                          <dd className="font-mono">{d.nik}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Kartu BPJS</dt>
                                          <dd className="font-mono">{d.nokapst}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. HP</dt>
                                          <dd>{d.nohp}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Rekam Medis</dt>
                                          <dd className="font-mono">{d.norekammedis}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Antrean</dt>
                                          <dd className="font-medium">{d.noantrean}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Jenis Kunjungan</dt>
                                          <dd>{d.jeniskunjungan === 1 ? "Rujukan FKTP" : d.jeniskunjungan === 2 ? "Rujukan Internal" : d.jeniskunjungan === 3 ? "Kontrol" : d.jeniskunjungan === 4 ? "Rujukan Antar RS" : d.jeniskunjungan}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Referensi</dt>
                                          <dd className="font-mono">{d.nomorreferensi || "-"}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Sumber Data</dt>
                                          <dd>{d.sumberdata}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Status</dt>
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
                                          <dt className="text-muted-foreground">Estimasi Dilayani</dt>
                                          <dd>{d.estimasidilayani ? new Date(d.estimasidilayani).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Created</dt>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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
    </div>
  );
}