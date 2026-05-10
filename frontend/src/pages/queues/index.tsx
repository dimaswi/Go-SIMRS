import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { createQueueColumns } from "./columns";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RegistrationDialog } from "./registration-dialog";
import { setPageTitle } from "@/lib/page-title";
import { DatePickerDropdown } from "@/components/ui/date-picker-dropdown";
import {
  Loader2,
  RefreshCcw,
  Monitor,
  Tv,
  ExternalLink,
  DoorOpen,
  DoorClosed,
  ScreenShare,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";


export default function QueueIndex() {
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCounters, setLoadingCounters] = useState(true);
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

  const counterOptions = [
    { value: "all", label: "Semua Loket" },
    ...counters.map((counter) => ({
      value: counter.id.toString(),
      label: counter.name,
    })),
  ];
  const statusOptions = [
    { value: "all", label: "Semua Status" },
    { value: "waiting", label: "Menunggu" },
    { value: "called", label: "Dipanggil" },
    { value: "serving", label: "Dilayani" },
    { value: "completed", label: "Selesai" },
    { value: "skipped", label: "Dilewati" },
    { value: "cancelled", label: "Dibatalkan" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Antrean Pasien"
        description="Kelola antrean pasien untuk pendaftaran"
        count={queues.length}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open("/kiosk", "_blank")}>
              <Monitor className="mr-1 h-3.5 w-3.5" />
              KIOSK
              <ExternalLink className="ml-1 h-3 w-3 text-muted-foreground" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open("/queue-display", "_blank")}>
              <Tv className="mr-1 h-3.5 w-3.5" />
              Display
              <ExternalLink className="ml-1 h-3 w-3 text-muted-foreground" />
            </Button>
            <Button
              variant={counterPanelOpen ? "secondary" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setCounterPanelOpen((value) => !value)}
              title="Panel Loket"
            >
              {counterPanelOpen ? <DoorOpen className="h-4 w-4" /> : <DoorClosed className="h-4 w-4" />}
            </Button>
            <Button
              variant={displayPanelOpen ? "secondary" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setDisplayPanelOpen((value) => !value)}
              title="Panel Display"
            >
              <ScreenShare className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadData} title="Refresh">
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {counterPanelOpen && (
        <div className="border-b border-border px-6 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Status Loket</h3>
              <p className="text-xs text-muted-foreground">Buka atau tutup loket aktif.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleOpenAll}>
                <DoorOpen className="mr-1 h-3 w-3" />
                Buka Semua
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCloseAll}>
                <DoorClosed className="mr-1 h-3 w-3" />
                Tutup Semua
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {loadingCounters ? (
              <div className="col-span-full flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat loket...
              </div>
            ) : counters.length === 0 ? (
              <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
                Tidak ada loket aktif
              </div>
            ) : (
              counters.map((counter) => (
                <div
                  key={counter.id}
                  className={
                    counter.is_open
                      ? "flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3"
                      : "flex items-center justify-between rounded-md border border-border bg-background p-3"
                  }
                >
                  <div className="mr-2 min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{counter.name}</div>
                    <Badge
                      variant={counter.is_open ? "default" : "secondary"}
                      className={counter.is_open ? "mt-1 bg-green-600 text-[10px] hover:bg-green-600" : "mt-1 text-[10px]"}
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

      {displayPanelOpen && (
        <div className="border-b border-border px-6 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Display Antrean</h3>
              <p className="text-xs text-muted-foreground">Buka display utama atau per loket.</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open("/queue-display", "_blank")}>
              <Tv className="mr-1 h-3 w-3" />
              Pengaturan Lengkap
              <ExternalLink className="ml-1 h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Display Utama</div>
                  <div className="text-xs text-muted-foreground">Menampilkan seluruh ruangan dan loket.</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify([]));
                    localStorage.setItem("queueDisplay_selectedCounters", JSON.stringify([]));
                    window.open("/queue-display/main", "_blank");
                  }}
                >
                  Buka
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 text-sm font-medium">Display Per Loket</div>
              <div className="flex flex-wrap gap-1.5">
                {loadingCounters ? (
                  <div className="flex items-center py-1 text-xs text-muted-foreground">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Memuat...
                  </div>
                ) : counters.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Tidak ada loket</span>
                ) : (
                  counters.map((counter) => (
                    <Button
                      key={counter.id}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => window.open(`/queue-display/counter/${counter.id}`, "_blank")}
                    >
                      {counter.code}
                      <ExternalLink className="ml-1 h-2.5 w-2.5" />
                    </Button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <PageContent className="py-3">
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Daftar Antrean
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:justify-end">
                <DatePickerDropdown
                  value={selectedDate || undefined}
                  onChange={(value) => setSelectedDate(value || "")}
                  size="sm"
                  className="w-full sm:w-auto"
                />
                <Combobox
                  options={counterOptions}
                  value={selectedCounter}
                  onValueChange={(value) => setSelectedCounter(value || "all")}
                  placeholder="Semua Loket"
                  searchPlaceholder="Cari loket..."
                  emptyText="Loket tidak ditemukan"
                  loading={loadingCounters}
                  className="h-8 w-full rounded-none border-border/70 bg-background text-xs sm:w-[170px]"
                />
                <Combobox
                  options={statusOptions}
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value || "all")}
                  placeholder="Semua Status"
                  searchPlaceholder="Cari status..."
                  emptyText="Status tidak ditemukan"
                  className="h-8 w-full rounded-none border-border/70 bg-background text-xs sm:w-[170px]"
                />
                {(selectedDate || selectedCounter !== "all" || selectedStatus !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-none px-3 text-xs"
                    onClick={() => {
                      setSelectedDate("");
                      setSelectedCounter("all");
                      setSelectedStatus("all");
                    }}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={queues}
                searchPlaceholder="Cari nomor antrean atau nama pasien..."
                pageSize={10}
                tableId="queues"
              />
            )}
          </div>
        </div>
      </PageContent>

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
    </PageShell>
  );
}
