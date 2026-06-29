import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle,
  Printer,
  Loader2,
  Clock,
  Users,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function KioskIndex() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState("");
  const [queueId, setQueueId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [appName, setAppName] = useState("RUMAH SAKIT");
  const [appSubtitle, setAppSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkScrollPosition = useCallback(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setCanScrollUp(scrollTop > 0);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, [counters, checkScrollPosition]);

  const scrollUp = () => {
    gridContainerRef.current?.scrollBy({ top: -260, behavior: "smooth" });
  };

  const scrollDown = () => {
    gridContainerRef.current?.scrollBy({ top: 260, behavior: "smooth" });
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_subtitle) setAppSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    const loadCounters = async () => {
      try {
        const data = await counterApi.getOpenCounters();
        setCounters(data);
      } catch {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadCounters();
    const interval = setInterval(loadCounters, 3000);
    return () => clearInterval(interval);
  }, [toast]);

  useEffect(() => {
    const loadQueues = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const response = await queueApi.getAll({ date: today });
        setAllQueues(response.data.data || []);
      } catch (error) {
        console.error("Failed to load queues:", error);
      }
    };

    void loadQueues();
    const interval = setInterval(loadQueues, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCounterSelect = async (counterId: number) => {
    if (submitting) return;

    setSelectedCounter(counterId);
    setSubmitting(true);

    try {
      const response = await queueApi.create({
        queue_type: "general",
        counter_id: counterId,
        notes: "",
      });

      setQueueNumber(response.data.data.queue_number);
      setQueueId(response.data.data.id);
      setShowSuccess(true);
      setCountdown(8);

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleReset();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description:
          error.response?.data?.error || "Gagal mengambil nomor antrean.",
      });
      setSelectedCounter(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    setSelectedCounter(null);
    setShowSuccess(false);
    setQueueNumber("");
    setQueueId(null);
    setCountdown(8);
  };

  const handlePrint = () => {
    if (!queueId) return;
    
    // We need the /api prefix because publicPrint group is under the api router group
    const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8080/api`;
    window.open(`${apiUrl}/print-public/kiosk-ticket/${queueId}`, "_blank");
  };

  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;

  const getGridCols = (count: number) => {
    if (count <= 2) return "grid-cols-2";
    if (count <= 3) return "grid-cols-3";
    if (count <= 4) return "grid-cols-2 lg:grid-cols-4";
    if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-3 lg:grid-cols-4";
  };

  if (showSuccess) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            {appLogo && (
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-12 w-12 shrink-0 object-contain"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-2xl font-bold">{appName}</div>
              {appSubtitle && (
                <div className="truncate text-sm text-slate-400">{appSubtitle}</div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-6">
          <div className="grid w-full max-w-6xl grid-cols-[1.3fr_0.7fr] border border-slate-800 bg-slate-900">
            <div className="border-r border-slate-800 px-8 py-8">
              <div className="mb-4 flex items-center gap-3 text-emerald-400">
                <CheckCircle className="h-7 w-7" />
                <span className="text-base font-semibold uppercase tracking-[0.2em]">
                  Nomor berhasil dibuat
                </span>
              </div>
              <div className="border border-slate-700 bg-white px-8 py-10 text-center text-slate-950">
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Nomor antrean
                </div>
                <div className="mt-4 text-[7rem] font-black leading-none tracking-[0.08em]">
                  {queueNumber}
                </div>
                <div className="mt-6 border-t border-slate-300 pt-4 text-2xl font-bold">
                  {counters.find((c) => c.id === selectedCounter)?.name || "Loket"}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between px-6 py-6">
              <div className="space-y-3 text-sm text-slate-300">
                <div>Silakan menunggu hingga nomor Anda dipanggil.</div>
                <div>Kembali otomatis dalam {countdown} detik.</div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePrint}
                  className="flex w-full items-center justify-center gap-3 border border-amber-500 bg-amber-500 px-4 py-4 text-base font-bold text-slate-950 transition-colors hover:bg-amber-400"
                >
                  <Printer className="h-5 w-5" />
                  Cetak Tiket
                </button>
                <button
                  onClick={handleReset}
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-4 text-base font-bold text-slate-100 transition-colors hover:bg-slate-800"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          {appLogo && (
            <img
              src={`${BASE_URL}${appLogo}`}
              alt="Logo"
              className="h-12 w-12 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-2xl font-bold">{appName}</div>
            {appSubtitle && (
              <div className="truncate text-sm text-slate-400">{appSubtitle}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-slate-400">Menunggu</span>
              <span className="text-xl font-bold tabular-nums">{waitingQueues}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-400">Dilayani</span>
              <span className="text-xl font-bold tabular-nums">{servingQueues}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3 text-sm">
        <div className="font-semibold uppercase tracking-[0.2em] text-slate-300">
          Pilih Loket
        </div>
        <div className="text-slate-400">{counters.length} loket buka</div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden px-4 py-4">
        {canScrollUp && (
          <button
            onClick={scrollUp}
            className="absolute left-1/2 top-2 z-10 -translate-x-1/2 border border-slate-700 bg-slate-950 px-5 py-2 text-sm text-slate-200"
          >
            <span className="inline-flex items-center gap-2">
              <ChevronUp className="h-4 w-4" />
              Geser Atas
            </span>
          </button>
        )}

        <div
          ref={gridContainerRef}
          onScroll={checkScrollPosition}
          className="flex-1 overflow-auto border border-slate-800 bg-slate-900 p-4"
        >
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
              <span className="text-lg text-slate-400">Memuat loket...</span>
            </div>
          ) : counters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <AlertCircle className="h-12 w-12 text-slate-500" />
              <div className="text-xl font-semibold">Tidak ada loket yang buka</div>
              <div className="text-sm text-slate-400">Silakan hubungi petugas</div>
            </div>
          ) : (
            <div className={cn("grid auto-rows-fr gap-4", getGridCols(counters.length))}>
              {counters.map((counter) => {
                const isSelected = selectedCounter === counter.id;
                const counterQueues = allQueues.filter((q) => q.counter_id === counter.id);
                const counterWaiting = counterQueues.filter((q) => q.status === "waiting").length;
                const currentQueue = counterQueues.find(
                  (q) => q.status === "called" || q.status === "serving"
                );

                return (
                  <button
                    key={counter.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleCounterSelect(counter.id)}
                    className={cn(
                      "relative flex min-h-[180px] flex-col border text-left transition-colors",
                      isSelected
                        ? "border-cyan-400 bg-slate-950"
                        : "border-slate-800 bg-slate-950 hover:bg-slate-900",
                      "disabled:opacity-70"
                    )}
                  >
                    <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-2xl font-bold">{counter.name}</div>
                        {counter.location && (
                          <div className="truncate text-sm text-slate-400">{counter.location}</div>
                        )}
                      </div>
                      <div className="ml-4 shrink-0 text-sm font-bold text-slate-400">
                        {counter.code}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
                      {currentQueue ? (
                        <>
                          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                            Sedang Dilayani
                          </div>
                          <div className="text-6xl font-black leading-none tracking-[0.08em] text-white">
                            {currentQueue.queue_number}
                          </div>
                        </>
                      ) : counterWaiting > 0 ? (
                        <>
                          <div className="text-5xl font-black leading-none text-amber-400">
                            {counterWaiting}
                          </div>
                          <div className="mt-2 text-sm text-slate-300">orang menunggu</div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-400">Belum ada antrean</div>
                      )}
                    </div>

                    <div className="border-t border-slate-800 px-4 py-3 text-center text-sm text-slate-300">
                      {currentQueue
                        ? counterWaiting > 0
                          ? `${counterWaiting} orang menunggu`
                          : "Tidak ada yang menunggu"
                        : "Sentuh untuk ambil nomor"}
                    </div>

                    {isSelected && submitting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {canScrollDown && (
          <button
            onClick={scrollDown}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 border border-slate-700 bg-slate-950 px-5 py-2 text-sm text-slate-200"
          >
            <span className="inline-flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              Geser Bawah
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
