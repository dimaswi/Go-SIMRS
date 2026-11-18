import { useEffect, useState, useCallback, useRef } from "react";
import { billingApi, type CashierDisplayQueueItem } from "@/lib/api/billing";
import { settingsApi } from "@/lib/api";
import {
  disableSharedAnnouncementAudio,
  enableSharedAnnouncementAudio,
  queueSharedAnnouncement,
  subscribeSharedAnnouncementState,
} from "@/lib/shared-queue-announcer";
import {
  DisplayMediaPanel,
  DisplayRunningTextTicker,
  spellQueueNumberForSpeech,
} from "@/components/queue-display/display-media-panel";
import { Volume2, Users, Clock, CheckCircle, Megaphone, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function CashierQueueDisplay() {
  const [currentQueue, setCurrentQueue] = useState<CashierDisplayQueueItem | null>(null);
  const [calledHistory, setCalledHistory] = useState<CashierDisplayQueueItem[]>([]);
  const [waitingList, setWaitingList] = useState<CashierDisplayQueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, called: 0, paid: 0 });

  const [hospitalName, setHospitalName] = useState("KLINIK / RUMAH SAKIT");
  const [hospitalSubtitle, setHospitalSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [displayVideoUrl, setDisplayVideoUrl] = useState("");
  const [displayAdsRaw, setDisplayAdsRaw] = useState("");
  const [displayRunningText, setDisplayRunningText] = useState("");

  const isInitialLoadRef = useRef(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const announcementRef = useRef<string | null>(null);
  const isEnablingAudioRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSharedAnnouncementState((state) => {
      setIsAnnouncing(state.isAnnouncing);
    });
    return unsubscribe;
  }, []);

  const buildCashierAnnouncementText = useCallback((item: CashierDisplayQueueItem) => {
    const queueText = spellQueueNumberForSpeech(item.queue_number);
    return `Nomor antrean ${queueText}. Silakan menuju Kasir.`;
  }, []);

  const enableAudio = useCallback(async () => {
    if (isEnablingAudioRef.current) return false;
    isEnablingAudioRef.current = true;
    try {
      const result = await enableSharedAnnouncementAudio();
      const ready = result.audioReady || result.speechReady;
      setAudioReady(ready);
      return ready;
    } catch (error) {
      if (error !== "not-allowed") {
        console.error("Failed to enable cashier display audio:", error);
      }
      setAudioReady(false);
      return false;
    } finally {
      isEnablingAudioRef.current = false;
    }
  }, []);

  const loadDisplayData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await billingApi.getCashierDisplay(today);
      const payload = res.data;

      setCalledHistory(payload.called_history || []);
      setWaitingList(payload.waiting || []);
      setStats(payload.stats || { total: 0, waiting: 0, called: 0, paid: 0 });

      const latest = payload.current || null;
      if (latest && latest.called_at) {
        const uniqueId = `cashier-${latest.id}-${latest.called_at}`;
        if (uniqueId !== announcementRef.current) {
          announcementRef.current = uniqueId;
          setCurrentQueue(latest);

          if (!isInitialLoadRef.current) {
            queueSharedAnnouncement({
              id: uniqueId,
              kind: "counter",
              speechText: buildCashierAnnouncementText(latest),
            });
          } else {
            isInitialLoadRef.current = false;
          }
          return;
        }
      }

      isInitialLoadRef.current = false;
      setCurrentQueue(latest);
    } catch (error) {
      console.error("Failed to load cashier display:", error);
    }
  }, [buildCashierAnnouncementText]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
        if (settings.app_name) setHospitalName(settings.app_name);
        if (settings.app_subtitle) setHospitalSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
        if (settings.display_video_url !== undefined) setDisplayVideoUrl(settings.display_video_url);
        if (settings.display_ads !== undefined) setDisplayAdsRaw(settings.display_ads);
        if (settings.display_running_text !== undefined) setDisplayRunningText(settings.display_running_text);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    void loadSettings();
    const settingsInterval = setInterval(loadSettings, 30000);
    return () => clearInterval(settingsInterval);
  }, []);

  useEffect(() => {
    void loadDisplayData();
    const interval = setInterval(() => {
      void loadDisplayData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  const handleAudioToggle = () => {
    if (audioReady) {
      disableSharedAnnouncementAudio();
      setAudioReady(false);
      setIsAnnouncing(false);
      return;
    }
    void enableAudio();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 select-none">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          {appLogo && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-xl font-extrabold tracking-tight text-slate-900">{hospitalName}</div>
            {hospitalSubtitle && (
              <div className="truncate text-xs font-medium text-slate-500">{hospitalSubtitle}</div>
            )}
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            <Receipt className="h-3.5 w-3.5" />
            Display Panggilan Kasir
          </div>
          <div className="mt-1 text-xs text-slate-500">Loket Pembayaran &amp; Administrasi</div>
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {currentTime.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </header>

      {/* Stats Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-2.5 text-xs uppercase tracking-[0.16em] text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <span className="inline-flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-slate-500" />
            Total <strong className="font-mono text-sm text-slate-900">{stats.total}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Menunggu <strong className="font-mono text-sm text-amber-700">{stats.waiting}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-sky-600" />
            Dipanggil <strong className="font-mono text-sm text-sky-700">{stats.called}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            Lunas <strong className="font-mono text-sm text-emerald-700">{stats.paid}</strong>
          </span>
        </div>

        <button
          type="button"
          onPointerUp={handleAudioToggle}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors touch-manipulation",
            audioReady
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          )}
        >
          <Volume2 className="h-3.5 w-3.5" />
          {audioReady ? "NONAKTIFKAN SUARA" : "AKTIFKAN SUARA"}
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        {/* Left/Center Column: Active Call + Waiting & History */}
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-7 xl:col-span-7">
          {/* Active Call Hero Card */}
          <div
            className={cn(
              "relative flex flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all",
              isAnnouncing
                ? "border-amber-400 ring-4 ring-amber-200/70"
                : "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
              <div className="flex items-center gap-2.5">
                {isAnnouncing ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800 animate-pulse">
                    <Megaphone className="h-3.5 w-3.5" />
                    Sedang Memanggil ke Kasir
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Nomor Antrean Dipanggil
                  </span>
                )}
              </div>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">
                Kasir
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50/60 px-6 py-6 text-center">
              {currentQueue ? (
                <>
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 px-12 py-7 text-white shadow-xl shadow-emerald-600/25">
                    <div className="font-mono text-[7rem] xl:text-[8.5rem] font-black leading-none tracking-[0.06em]">
                      {currentQueue.queue_number}
                    </div>
                  </div>
                  <div className="mt-5 text-2xl xl:text-3xl font-extrabold tracking-tight text-slate-900">
                    {currentQueue.patient_name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
                    {currentQueue.main_room_name && <span>Unit: {currentQueue.main_room_name}</span>}
                    {currentQueue.main_room_name && <span>•</span>}
                    <span>
                      Dipanggil pukul{" "}
                      {currentQueue.called_at
                        ? new Date(currentQueue.called_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "-"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Receipt className="mx-auto h-12 w-12 text-slate-300" />
                  <div className="text-xl font-semibold text-slate-500">
                    Belum ada antrean kasir yang dipanggil
                  </div>
                  <div className="text-xs text-slate-400">
                    Tekan tombol Panggil di halaman Kasir untuk memanggil pasien
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Split: Call History & Next Waiting */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Riwayat Panggilan Kasir
              </div>
              <div className="grid max-h-[168px] grid-cols-2 gap-2 overflow-auto p-3">
                {calledHistory.slice(0, 6).map((item, idx) => (
                  <div
                    key={`${item.id}-${item.called_at}`}
                    className={cn(
                      "rounded-xl border px-3 py-2",
                      idx === 0
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-slate-200 bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xl font-black text-slate-900">{item.queue_number}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {item.called_at
                          ? new Date(item.called_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">{item.patient_name}</div>
                  </div>
                ))}
                {calledHistory.length === 0 && (
                  <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                    Belum ada riwayat panggilan
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Antrean Menunggu di Kasir
              </div>
              <div className="grid max-h-[168px] grid-cols-2 gap-2 overflow-auto p-3">
                {waitingList.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-lg font-extrabold text-amber-700">
                        {item.queue_number}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        {item.billing_status || "menunggu"}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">{item.patient_name}</div>
                  </div>
                ))}
                {waitingList.length === 0 && (
                  <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                    Tidak ada antrean menunggu pembayaran
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Video & Ad Slot */}
        <DisplayMediaPanel
          videoUrl={displayVideoUrl}
          adsRaw={displayAdsRaw}
          hospitalName={hospitalName}
          hospitalSubtitle={hospitalSubtitle}
          appLogo={appLogo}
          baseUrl={BASE_URL}
          className="lg:col-span-5 xl:col-span-5"
        />
      </div>

      {/* Bottom Running Ticker */}
      <DisplayRunningTextTicker text={displayRunningText} hospitalName={hospitalName} />
    </div>
  );
}
