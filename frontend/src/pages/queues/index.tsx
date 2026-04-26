import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { createQueueColumns } from "./columns";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RegistrationDialog } from "./registration-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCcw,
  SlidersHorizontal,
  Monitor,
  Tv,
  ExternalLink,
  DoorOpen,
  DoorClosed,
  ScreenShare,
  Volume2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";


export default function QueueIndex() {
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCounters, setLoadingCounters] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCounter, setSelectedCounter] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(""); // Empty = show all data
  const [skipId, setSkipId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [registerQueue, setRegisterQueue] = useState<{
    id: number;
    number: string;
  } | null>(null);
  const [counterPanelOpen, setCounterPanelOpen] = useState(false);
  const [displayPanelOpen, setDisplayPanelOpen] = useState(false);
  const [togglingCounterId, setTogglingCounterId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};

      // Only add date filter if date is selected
      if (selectedDate) {
        params.date = selectedDate;
      }

      if (selectedCounter !== "all")
        params.counter_id = parseInt(selectedCounter);
      if (selectedStatus !== "all") params.status = selectedStatus;

      const response = await queueApi.getAll(params);
      setQueues(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data antrean.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCounter, selectedStatus, selectedDate, toast]);

  useEffect(() => {
    setPageTitle("Antrean");

    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoadingCounters(false);
      }
    };
    loadCounters();
  }, [toast]);

  const handleToggleCounter = async (counterId: number) => {
    setTogglingCounterId(counterId);
    try {
      const result = await counterApi.toggleOpen(counterId);
      setCounters((prev) =>
        prev.map((c) => (c.id === counterId ? { ...c, is_open: result.data.is_open } : c))
      );
      toast({
        title: "Berhasil",
        description: result.message,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengubah status loket.",
      });
    } finally {
      setTogglingCounterId(null);
    }
  };

  const handleOpenAll = async () => {
    const closedCounters = counters.filter((c) => !c.is_open);
    if (closedCounters.length === 0) return;
    try {
      await counterApi.bulkToggleOpen(closedCounters.map((c) => c.id), true);
      setCounters((prev) => prev.map((c) => ({ ...c, is_open: true })));
      toast({ title: "Berhasil", description: "Semua loket dibuka." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal membuka semua loket." });
    }
  };

  const handleCloseAll = async () => {
    const openCounters = counters.filter((c) => c.is_open);
    if (openCounters.length === 0) return;
    try {
      await counterApi.bulkToggleOpen(openCounters.map((c) => c.id), false);
      setCounters((prev) => prev.map((c) => ({ ...c, is_open: false })));
      toast({ title: "Berhasil", description: "Semua loket ditutup." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal menutup semua loket." });
    }
  };

  useEffect(() => {
    loadData();
    // Hentikan auto refresh jika dialog registrasi sedang dibuka
    if (registerQueue !== null) return;

    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData, registerQueue]);

  const handleCall = async (id: number) => {
    try {
      const response = await queueApi.call(id);
      toast({
        title: "Antrean Dipanggil",
        description: `Nomor ${response.data.data.queue_number} berhasil dipanggil.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memanggil antrean.",
      });
    }
  };

  const handleRecall = async (id: number) => {
    try {
      const response = await queueApi.call(id);
      toast({
        title: "Antrean Dipanggil Ulang",
        description: `Nomor ${response.data.data.queue_number} berhasil dipanggil ulang.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil ulang antrean.",
      });
    }
  };

  const handleSkip = async () => {
    if (!skipId) return;
    try {
      await queueApi.skip(skipId);
      toast({
        title: "Antrean Dilewati",
        description: "Antrean berhasil dilewati.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal melewati antrean.",
      });
    } finally {
      setSkipId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await queueApi.cancel(cancelId);
      toast({
        title: "Antrean Dibatalkan",
        description: "Antrean berhasil dibatalkan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan antrean.",
      });
    } finally {
      setCancelId(null);
    }
  };

  const handleRegister = (queue: Queue) => {
    setRegisterQueue({ id: queue.id, number: queue.queue_number });
  };

  const columns = createQueueColumns({
    onCall: handleCall,
    onRecall: handleRecall,
    onSkip: setSkipId,
    onCancel: setCancelId,
    onRegister: handleRegister,
    hasCallPermission: hasPermission("queues.call"),
    hasDeletePermission: hasPermission("queues.delete"),
    hasRegisterPermission: hasPermission("registrations.create"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Antrean Pasien</h1>
            <p className="text-sm text-muted-foreground">
              Kelola antrean pasien untuk pendaftaran -{" "}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Access Buttons */}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => window.open("/kiosk", "_blank")}
            >
              <Monitor className="h-4 w-4 mr-2" />
              KIOSK
              <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => window.open("/queue-display", "_blank")}
            >
              <Tv className="h-4 w-4 mr-2" />
              Display
              <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
            <Button
              variant={counterPanelOpen ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setCounterPanelOpen(!counterPanelOpen)}
            >
              {counterPanelOpen ? <DoorOpen className="h-4 w-4 mr-2" /> : <DoorClosed className="h-4 w-4 mr-2" />}
              Buka/Tutup Loket
            </Button>
            <Button
              variant={displayPanelOpen ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setDisplayPanelOpen(!displayPanelOpen)}
            >
              <ScreenShare className="h-4 w-4 mr-2" />
              Display Antrean
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="flex items-center gap-2 flex-wrap pt-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-48"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate("")}
              className="h-9"
            >
              Semua Data
            </Button>
            <Select
              value={selectedCounter}
              onValueChange={setSelectedCounter}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Pilih Loket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Loket</SelectItem>
                {loadingCounters ? (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="h-3 w-3 animate-spin mr-2 inline" />
                    Memuat...
                  </SelectItem>
                ) : (
                  counters.map((counter) => (
                    <SelectItem
                      key={counter.id}
                      value={counter.id.toString()}
                    >
                      {counter.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select
              value={selectedStatus}
              onValueChange={setSelectedStatus}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="waiting">Menunggu</SelectItem>
                <SelectItem value="called">Dipanggil</SelectItem>
                <SelectItem value="serving">Dilayani</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="skipped">Dilewati</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadData}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Counter Open/Close Panel */}
      {counterPanelOpen && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm">Status Buka/Tutup Loket</h3>
              <p className="text-xs text-muted-foreground">
                Loket yang dibuka akan tampil di KIOSK untuk pasien mengambil nomor antrean
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenAll}>
                <DoorOpen className="h-3 w-3 mr-1" />
                Buka Semua
              </Button>
              <Button variant="outline" size="sm" onClick={handleCloseAll}>
                <DoorClosed className="h-3 w-3 mr-1" />
                Tutup Semua
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {loadingCounters ? (
              <div className="col-span-full flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Memuat loket...</span>
              </div>
            ) : counters.length === 0 ? (
              <div className="col-span-full text-center py-4 text-sm text-muted-foreground">
                Tidak ada loket aktif
              </div>
            ) : (
              counters.map((counter) => (
                <div
                  key={counter.id}
                  className={`flex items-center justify-between border rounded-md p-3 transition-colors ${counter.is_open
                      ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                      : "bg-background border-border"
                    }`}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="font-medium text-sm truncate">{counter.name}</div>
                    <Badge
                      variant={counter.is_open ? "default" : "secondary"}
                      className={`text-[10px] px-1.5 py-0 ${counter.is_open
                          ? "bg-green-600 hover:bg-green-600"
                          : ""
                        }`}
                    >
                      {counter.is_open ? "Buka" : "Tutup"}
                    </Badge>
                  </div>
                  <Switch
                    checked={counter.is_open}
                    disabled={togglingCounterId === counter.id}
                    onCheckedChange={() => handleToggleCounter(counter.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Display Switcher Panel */}
      {displayPanelOpen && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm">Display Antrean</h3>
              <p className="text-xs text-muted-foreground">
                Buka display untuk ditampilkan di layar TV / monitor
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.open("/queue-display", "_blank")}>
              <Tv className="h-3 w-3 mr-1" />
              Pengaturan Lengkap
              <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Main Display */}
            <div className="border rounded-md p-3 bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center">
                    <Tv className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Display Utama (Lobby)</div>
                    <div className="text-xs text-muted-foreground">Menampilkan semua ruangan &amp; loket</div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify([]));
                  localStorage.setItem("queueDisplay_selectedCounters", JSON.stringify([]));
                  window.open("/queue-display/main", "_blank");
                }}>
                  Buka
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>

            {/* Per-Counter Display */}
            <div className="border rounded-md p-3 bg-background">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-sm">Display Per Loket</div>
                  <div className="text-xs text-muted-foreground">Dengan suara pengumuman</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {loadingCounters ? (
                  <div className="flex items-center py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="ml-1 text-xs text-muted-foreground">Memuat...</span>
                  </div>
                ) : counters.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Tidak ada loket</span>
                ) : (
                  counters.map((counter) => (
                    <Button
                      key={counter.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => window.open(`/queue-display/counter/${counter.id}`, "_blank")}
                    >
                      {counter.code}
                      <ExternalLink className="h-2.5 w-2.5 ml-1" />
                    </Button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={queues}
        searchPlaceholder="Cari nomor antrean atau nama pasien..."
        pageSize={10}
        tableId="queues"
      />

      <ConfirmDialog
        open={skipId !== null}
        onOpenChange={(open) => !open && setSkipId(null)}
        onConfirm={handleSkip}
        title="Lewati Antrean?"
        description="Antrean akan ditandai sebagai dilewati dan bisa dipanggil lagi nanti."
        confirmText="Ya, Lewati"
        cancelText="Batal"
      />

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        onConfirm={handleCancel}
        title="Batalkan Antrean?"
        description="Apakah Anda yakin ingin membatalkan antrean ini?"
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />

      <RegistrationDialog
        open={registerQueue !== null}
        onOpenChange={(open) => !open && setRegisterQueue(null)}
        queueId={registerQueue?.id || 0}
        queueNumber={registerQueue?.number || ""}
        onSuccess={() => {
          setRegisterQueue(null);
          loadData();
        }}
      />
    </div>
  );
}
