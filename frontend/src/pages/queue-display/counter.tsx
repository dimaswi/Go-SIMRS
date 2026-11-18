import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
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
} from "@/components/queue-display/display-media-panel";
import { Volume2, Users, Clock, CheckCircle, Megaphone, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

const INDONESIAN_VOICE_NAME_PRIORITY = [
  "Google Bahasa Indonesia",
  "Microsoft Gadis Online (Natural) - Indonesian (Indonesia)",
  "Microsoft Gadis",
  "Bahasa Indonesia",
  "Indonesian",
  "id-ID",
];

const INDONESIAN_SPEECH_MAP: Record<string, string> = {
  A: "a",
  B: "be",
  C: "ce",
  D: "de",
  E: "e",
  F: "ef",
  G: "ge",
  H: "ha",
  I: "i",
  J: "je",
  K: "ka",
  L: "el",
  M: "em",
  N: "en",
  O: "o",
  P: "pe",
  Q: "kiu",
  R: "er",
  S: "es",
  T: "te",
  U: "u",
  V: "ve",
  W: "we",
  X: "eks",
  Y: "ye",
  Z: "zet",
  "0": "nol",
  "1": "satu",
  "2": "dua",
  "3": "tiga",
  "4": "empat",
  "5": "lima",
  "6": "enam",
  "7": "tujuh",
  "8": "delapan",
  "9": "sembilan",
};

const getPreferredIndonesianVoice = () => {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const indonesianVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("id")
  );

  if (indonesianVoices.length === 0) {
    return null;
  }

  const sortedVoices = [...indonesianVoices].sort((left, right) => {
    const leftIndex = INDONESIAN_VOICE_NAME_PRIORITY.findIndex((keyword) =>
      left.name.toLowerCase().includes(keyword.toLowerCase()) ||
      left.voiceURI.toLowerCase().includes(keyword.toLowerCase())
    );
    const rightIndex = INDONESIAN_VOICE_NAME_PRIORITY.findIndex((keyword) =>
      right.name.toLowerCase().includes(keyword.toLowerCase()) ||
      right.voiceURI.toLowerCase().includes(keyword.toLowerCase())
    );

    const leftScore = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const rightScore = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    if (left.default !== right.default) {
      return left.default ? -1 : 1;
    }

    if (left.localService !== right.localService) {
      return left.localService ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  return sortedVoices[0] || null;
};

const spellQueueNumberForSpeech = (value: string) =>
  value
    .trim()
    .split("")
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || "")
    .filter(Boolean)
    .join(" ");

const getQueueAnnouncementVersion = (queue: Queue) =>
  queue.called_at || queue.updated_at || queue.created_at || new Date().toISOString();

export default function CounterQueueDisplay() {
  const { counterId } = useParams<{ counterId: string }>();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [hospitalSubtitle, setHospitalSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [displayVideoUrl, setDisplayVideoUrl] = useState("");
  const [displayAdsRaw, setDisplayAdsRaw] = useState("");
  const [displayRunningText, setDisplayRunningText] = useState("");
  const isInitialLoadRef = useRef(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const [hasIndonesianVoice, setHasIndonesianVoice] = useState(false);
  const announcementRef = useRef<string | null>(null);
  const isEnablingSpeechRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setHasIndonesianVoice(Boolean(getPreferredIndonesianVoice()));
    };

    updateVoices();
    synth.onvoiceschanged = updateVoices;

    return () => {
      if (synth.onvoiceschanged === updateVoices) {
        synth.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSharedAnnouncementState((state) => {
      setIsAnnouncing(state.isAnnouncing);
    });

    return unsubscribe;
  }, []);

  const buildCounterAnnouncementText = useCallback((queue: Queue) => {
    const queueText = spellQueueNumberForSpeech(queue.queue_number);
    const counterName = queue.counter?.name || counter?.name || `Loket ${counterId}`;
    return `Nomor antrean ${queueText}. Silakan menuju ${counterName}.`;
  }, [counter, counterId]);

  const enableSpeech = useCallback(async () => {
    if (isEnablingSpeechRef.current) return false;
    isEnablingSpeechRef.current = true;

    try {
      const result = await enableSharedAnnouncementAudio();
      setSpeechReady(result.audioReady && result.speechReady);
      setHasIndonesianVoice(result.hasIndonesianVoice);
      return result.audioReady && result.speechReady;
    } catch (error) {
      if (error !== "not-allowed") {
        console.error("Failed to enable speech:", error);
      }
      setSpeechReady(false);
      return false;
    } finally {
      isEnablingSpeechRef.current = false;
    }
  }, []);

  const loadQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({
        date: today,
        counter_id: parseInt(counterId!, 10),
      });
      const allData = response.data.data || [];
      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );

      const calledQueues = filteredData
        .filter((q) => q.status === "called" && q.called_at)
        .sort((a, b) => {
          if (!a.called_at || !b.called_at) return 0;
          return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
        });

      const servingQueues = filteredData
        .filter((q) => q.status === "serving" && q.called_at)
        .sort((a, b) => {
          if (!a.called_at || !b.called_at) return 0;
          return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
        });

      setQueues(filteredData);

      const latest = calledQueues.length > 0 ? calledQueues[0] : servingQueues[0];

      if (latest && latest.status === "called" && latest.called_at) {
        const uniqueId = `${latest.id}-${getQueueAnnouncementVersion(latest)}`;
        if (uniqueId !== announcementRef.current) {
          announcementRef.current = uniqueId;
          setCurrentQueue(latest);

          if (!isInitialLoadRef.current) {
            queueSharedAnnouncement({
              id: uniqueId,
              kind: "counter",
              speechText: buildCounterAnnouncementText(latest),
            });
          } else {
            isInitialLoadRef.current = false;
          }
          return;
        }
      }

      isInitialLoadRef.current = false;
      setCurrentQueue(latest || null);
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }, [buildCounterAnnouncementText, counterId]);

  const loadAllQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({
        date: today,
        counter_id: parseInt(counterId!, 10),
      });
      setAllQueues(response.data.data || []);
    } catch (error) {
      console.error("Failed to load all queues:", error);
    }
  }, [counterId]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
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

    const loadCounter = async () => {
      try {
        const data = await counterApi.getCounter(parseInt(counterId!, 10));
        setCounter(data);
      } catch (error) {
        console.error("Failed to load counter:", error);
      }
    };

    void loadSettings();
    void loadCounter();
  }, [counterId]);

  useEffect(() => {
    void loadQueues();
    void loadAllQueues();
    const interval = setInterval(() => {
      void loadQueues();
      void loadAllQueues();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadQueues, loadAllQueues]);

  const totalQueues = allQueues.length;
  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const completedQueues = allQueues.filter((q) => q.status === "completed").length;
  const handleAudioActivation = () => {
    if (speechReady) {
      disableSharedAnnouncementAudio();
      setSpeechReady(false);
      setIsAnnouncing(false);
      return;
    }

    void enableSpeech();
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
            <ClipboardList className="h-3.5 w-3.5" />
            {counter?.name || `Loket ${counterId}`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Loket Pendaftaran • Kode {counter?.code || "-"}
          </div>
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

      {/* Stats + Audio Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-2.5 text-xs uppercase tracking-[0.16em] text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <span className="inline-flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-slate-500" /> Total <strong className="font-mono text-sm text-slate-900">{totalQueues}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> Menunggu <strong className="font-mono text-sm text-amber-700">{waitingQueues}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-sky-600" /> Dilayani <strong className="font-mono text-sm text-sky-700">{servingQueues}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Selesai <strong className="font-mono text-sm text-emerald-700">{completedQueues}</strong>
          </span>
        </div>

        <button
          type="button"
          onPointerUp={handleAudioActivation}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors pointer-events-auto touch-manipulation",
            speechReady
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : hasIndonesianVoice
                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          )}
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0" />
          {speechReady
            ? "NONAKTIFKAN SUARA"
            : hasIndonesianVoice
              ? "AKTIFKAN SUARA"
              : "VOICE ID TIDAK ADA"}
        </button>
      </div>

      {/* Main Content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-7">
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
              <div>
                {isAnnouncing ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800 animate-pulse">
                    <Megaphone className="h-3.5 w-3.5" /> Memanggil Antrean
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Nomor Antrean Dipanggil
                  </span>
                )}
              </div>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">
                {counter?.code || `L${counterId}`}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50/60 px-6 py-6 text-center">
              {currentQueue ? (
                <>
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 px-12 py-7 text-white shadow-xl shadow-emerald-600/25">
                    <div className="font-mono text-[7.5rem] xl:text-[9rem] font-black leading-none tracking-[0.06em]">
                      {currentQueue.queue_number}
                    </div>
                  </div>
                  <div className="mt-5 text-2xl xl:text-3xl font-extrabold tracking-tight text-slate-900">
                    {counter?.name || `Loket ${counterId}`}
                  </div>
                  <div className="mt-1.5 text-sm text-slate-500">
                    Dipanggil pukul{" "}
                    {currentQueue.called_at
                      ? new Date(currentQueue.called_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "-"}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
                  <div className="text-xl font-semibold text-slate-500">
                    Belum ada antrean yang dipanggil
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Call History */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Riwayat Panggilan Terakhir
            </div>
            <div className="grid max-h-[156px] grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 md:grid-cols-5">
              {queues.slice(0, 10).map((queue, idx) => (
                <div
                  key={queue.id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    queue.status === "called" || idx === 0
                      ? "border-emerald-300 bg-emerald-50/70"
                      : "border-slate-200 bg-slate-50/50"
                  )}
                >
                  <div className="font-mono text-xl font-black leading-none tracking-[0.06em] text-slate-900">
                    {queue.queue_number}
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-500">
                    {queue.called_at &&
                      new Date(queue.called_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </div>
                </div>
              ))}
              {queues.length === 0 && (
                <div className="col-span-full py-5 text-center text-xs text-slate-400">
                  Belum ada riwayat panggilan
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Slot: Video & Iklan */}
        <DisplayMediaPanel
          videoUrl={displayVideoUrl}
          adsRaw={displayAdsRaw}
          hospitalName={hospitalName}
          hospitalSubtitle={hospitalSubtitle}
          appLogo={appLogo}
          baseUrl={BASE_URL}
          className="lg:col-span-5"
        />
      </div>

      {/* Bottom Running Ticker */}
      <DisplayRunningTextTicker text={displayRunningText} hospitalName={hospitalName} />
    </div>
  );
}
