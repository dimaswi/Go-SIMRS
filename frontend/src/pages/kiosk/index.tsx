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
  HandMetal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Get base URL without /api suffix
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
  const [queueNumber, setQueueNumber] = useState<string>("");
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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check scroll position
  const checkScrollPosition = useCallback(() => {
    const container = gridContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
    }
  }, []);

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, [counters, checkScrollPosition]);

  const scrollUp = () => {
    gridContainerRef.current?.scrollBy({ top: -300, behavior: "smooth" });
  };

  const scrollDown = () => {
    gridContainerRef.current?.scrollBy({ top: 300, behavior: "smooth" });
  };

  // Load settings
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
    loadSettings();
  }, []);

  // Load open counters
  useEffect(() => {
    const loadCounters = async () => {
      try {
        const data = await counterApi.getOpenCounters();
        setCounters(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Gagal!",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadCounters();
    const interval = setInterval(loadCounters, 3000);
    return () => clearInterval(interval);
  }, [toast]);

  // Load queue statistics
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
    loadQueues();
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
      setShowSuccess(true);
      setCountdown(8);

      // Start countdown
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
        title: "Gagal!",
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
    setCountdown(8);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `<!DOCTYPE html>
<html>
<head>
  <title>Cetak Antrean - ${queueNumber}</title>
  <style>
    @page { margin: 0; }
    body { margin: 0; padding: 15px; font-family: 'Arial', sans-serif; width: 80mm; background: white; }
    .ticket { text-align: center; border: 3px solid #000; padding: 15px; }
    .header { font-size: 14px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .queue-number { font-size: 64px; font-weight: 900; margin: 20px 0; letter-spacing: 4px; }
    .counter { font-size: 18px; font-weight: bold; margin: 15px 0; padding: 10px; border: 2px solid #000; }
    .datetime { font-size: 11px; color: #333; margin: 10px 0; }
    .footer { font-size: 10px; margin-top: 15px; padding-top: 10px; border-top: 2px dashed #000; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">${appName}<br/>NOMOR ANTREAN</div>
    <div class="queue-number">${queueNumber}</div>
    <div class="counter">${counters.find((c) => c.id === selectedCounter)?.name || "Loket"}</div>
    <div class="datetime">${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}<br/>${new Date().toLocaleTimeString("id-ID")}</div>
    <div class="footer">Mohon menunggu hingga nomor Anda dipanggil<br/>Terima kasih</div>
  </div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},100);}</script>
</body>
</html>`;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  // Calculate statistics
  const waitingQueues = (allQueues || []).filter(
    (q) => q.status === "waiting"
  ).length;
  const servingQueues = (allQueues || []).filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;

  // Determine grid columns based on counter count for optimal 19" layout
  const getGridCols = (count: number) => {
    if (count <= 2) return "grid-cols-2";
    if (count <= 3) return "grid-cols-3";
    if (count <= 4) return "grid-cols-2 lg:grid-cols-4";
    if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-3 lg:grid-cols-4";
  };

  // ============================================
  // SUCCESS SCREEN
  // ============================================
  if (showSuccess) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-white flex flex-col select-none">
        {/* Compact Header */}
        <div className="bg-white border-b border-gray-200 py-3 px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {appLogo && (
                <img
                  src={`${BASE_URL}${appLogo}`}
                  alt="Logo"
                  className="h-10 w-10 object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">{appName}</h1>
                {appSubtitle && (
                  <p className="text-gray-500 text-xs">{appSubtitle}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-900">
                {currentTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-gray-400 text-xs">
                {currentTime.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Success Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-lg mx-auto">
            {/* Animated Success Icon */}
            <div className="mb-5 animate-[bounce_1s_ease-in-out]">
              <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
            </div>

            <p className="text-base text-gray-400 mb-3 uppercase tracking-[0.2em] font-medium">
              Nomor Antrean Anda
            </p>

            {/* Queue Number - Bold & Clear */}
            <div className="relative inline-block mb-4">
              <div className="border-4 border-gray-900 rounded-2xl px-14 py-6 bg-white shadow-xl">
                <div className="text-[5.5rem] leading-none font-black tracking-wider text-gray-900">
                  {queueNumber}
                </div>
              </div>
            </div>

            {/* Counter Name */}
            <div className="mb-4">
              <span className="inline-block bg-gray-900 text-white text-xl font-bold px-8 py-2.5 rounded-full">
                {counters.find((c) => c.id === selectedCounter)?.name || "Loket"}
              </span>
            </div>

            {/* Instructions */}
            <p className="text-base text-gray-500 mb-6">
              Silakan menunggu hingga nomor Anda dipanggil
            </p>

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-8 py-4 text-lg font-semibold border-2 border-gray-900 rounded-xl bg-white hover:bg-gray-900 hover:text-white transition-all duration-200 active:scale-95"
              >
                <Printer className="h-5 w-5" />
                Cetak Tiket
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-all duration-200 active:scale-95"
              >
                Selesai
              </button>
            </div>

            {/* Countdown */}
            <p className="text-sm text-gray-400 mt-5">
              Kembali otomatis dalam{" "}
              <span className="font-mono font-bold text-gray-600">{countdown}</span> detik
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN KIOSK SCREEN
  // ============================================
  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-100 to-gray-50 text-gray-900 flex flex-col select-none">
      {/* Header - Compact with branding */}
      <div className="bg-white shadow-sm py-3 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {appLogo && (
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-wide text-gray-900">
                {appName}
              </h1>
              {appSubtitle && (
                <p className="text-gray-400 text-xs tracking-wider">
                  {appSubtitle}
                </p>
              )}
            </div>
          </div>

          {/* Clock & Stats inline */}
          <div className="flex items-center gap-6">
            {/* Mini Stats */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-700 font-semibold">{waitingQueues}</span>
                <span className="text-amber-500 text-xs">antri</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-700 font-semibold">{servingQueues}</span>
                <span className="text-emerald-500 text-xs">dilayani</span>
              </div>
            </div>

            {/* Clock */}
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-gray-900 leading-tight">
                {currentTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-gray-400 text-xs">
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
      </div>

      {/* CTA Title */}
      <div className="py-4 px-6 text-center flex-shrink-0">
        <div className="flex items-center justify-center gap-3">
          <HandMetal className="h-7 w-7 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-800">
            Sentuh Loket Tujuan Anda
          </h2>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Pilih loket untuk mengambil nomor antrean
        </p>
      </div>

      {/* Main Content - Counter Grid */}
      <div className="flex-1 flex overflow-hidden relative px-4 pb-3">
        {/* Scroll Up */}
        {canScrollUp && (
          <button
            onClick={scrollUp}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 text-white px-6 py-1.5 rounded-full flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg backdrop-blur-sm"
          >
            <ChevronUp className="h-4 w-4" />
            <span className="text-sm font-medium">Geser Atas</span>
          </button>
        )}

        {/* Grid Container */}
        <div
          ref={gridContainerRef}
          onScroll={checkScrollPosition}
          className="flex-1 overflow-auto"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-gray-300" />
              <span className="text-lg text-gray-400">Memuat loket...</span>
            </div>
          ) : counters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-xl font-semibold text-gray-400">
                Tidak ada loket yang buka
              </p>
              <p className="text-sm text-gray-400">
                Silakan hubungi petugas pendaftaran
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-4 h-full auto-rows-fr",
                getGridCols(counters.length)
              )}
            >
              {counters.map((counter) => {
                const isSelected = selectedCounter === counter.id;

                // Statistics per counter
                const counterQueues = (allQueues || []).filter(
                  (q) => q.counter_id === counter.id
                );
                const counterWaiting = counterQueues.filter(
                  (q) => q.status === "waiting"
                ).length;

                // Get current serving queue
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
                      "relative rounded-2xl transition-all duration-200 flex flex-col overflow-hidden",
                      "active:scale-[0.97] disabled:opacity-70",
                      "min-h-[140px]",
                      isSelected
                        ? "bg-gray-900 text-white ring-4 ring-gray-900/30 shadow-2xl scale-[0.97]"
                        : "bg-white text-gray-900 shadow-md hover:shadow-xl border border-gray-200 hover:border-gray-400"
                    )}
                  >
                    {/* Counter Name - Top Section */}
                    <div
                      className={cn(
                        "px-4 py-3 flex items-center justify-between flex-shrink-0",
                        isSelected
                          ? "bg-gray-800"
                          : "bg-gray-50 border-b border-gray-100"
                      )}
                    >
                      <div className="text-left">
                        <div className="text-xl font-extrabold leading-tight">
                          {counter.name}
                        </div>
                        {counter.location && (
                          <div
                            className={cn(
                              "text-xs mt-0.5",
                              isSelected ? "text-gray-400" : "text-gray-400"
                            )}
                          >
                            {counter.location}
                          </div>
                        )}
                      </div>
                      <div
                        className={cn(
                          "text-sm font-bold px-3 py-1 rounded-full",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-gray-600"
                        )}
                      >
                        {counter.code}
                      </div>
                    </div>

                    {/* Current Queue - Center Section */}
                    <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
                      {currentQueue ? (
                        <>
                          <div
                            className={cn(
                              "text-xs font-medium uppercase tracking-wider mb-1",
                              isSelected ? "text-gray-400" : "text-gray-400"
                            )}
                          >
                            Sedang Dilayani
                          </div>
                          <div className="text-5xl font-black tracking-wider leading-none">
                            {currentQueue.queue_number}
                          </div>
                        </>
                      ) : counterWaiting > 0 ? (
                        <>
                          <div
                            className={cn(
                              "text-4xl font-black leading-none",
                              isSelected ? "text-white" : "text-amber-500"
                            )}
                          >
                            {counterWaiting}
                          </div>
                          <div
                            className={cn(
                              "text-sm font-medium mt-1",
                              isSelected ? "text-gray-400" : "text-amber-400"
                            )}
                          >
                            orang menunggu
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-gray-500" : "text-gray-300"
                            )}
                          >
                            Belum ada antrian
                          </div>
                        </>
                      )}
                    </div>

                    {/* Waiting Info - Bottom */}
                    <div
                      className={cn(
                        "px-4 py-2.5 flex items-center justify-center gap-2 flex-shrink-0",
                        isSelected
                          ? "bg-gray-800"
                          : counterWaiting > 0
                            ? "bg-amber-50 border-t border-amber-100"
                            : "bg-gray-50 border-t border-gray-100"
                      )}
                    >
                      {currentQueue ? (
                        <>
                          <Clock
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "text-gray-400" : "text-amber-400"
                            )}
                          />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-gray-300" : "text-amber-600"
                            )}
                          >
                            {counterWaiting > 0
                              ? `${counterWaiting} orang menunggu`
                              : "Tidak ada yang menunggu"}
                          </span>
                        </>
                      ) : (
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-gray-400" : "text-gray-400"
                          )}
                        >
                          Sentuh untuk ambil nomor
                        </span>
                      )}
                    </div>

                    {/* Loading overlay when submitting this counter */}
                    {isSelected && submitting && (
                      <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scroll Down */}
        {canScrollDown && (
          <button
            onClick={scrollDown}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 text-white px-6 py-1.5 rounded-full flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg backdrop-blur-sm"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="text-sm font-medium">Geser Bawah</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="py-2.5 px-6 text-center flex-shrink-0 bg-white border-t border-gray-200">
        <p className="text-gray-400 text-xs tracking-wide">
          Sentuh loket yang dituju untuk mendapatkan nomor antrean
        </p>
      </div>
    </div>
  );
}
