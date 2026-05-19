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
import { Volume2, Users, Clock, CheckCircle, Megaphone } from "lucide-react";
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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

          if (!isInitialLoad) {
            queueSharedAnnouncement({
              id: uniqueId,
              kind: "counter",
              speechText: buildCounterAnnouncementText(latest),
            });
          } else {
            setIsInitialLoad(false);
          }
          return;
        }
      }

      setCurrentQueue(latest || null);
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }, [buildCounterAnnouncementText, counterId, isInitialLoad]);

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
            <div className="truncate text-2xl font-bold">{hospitalName}</div>
            {hospitalSubtitle && (
              <div className="truncate text-sm text-slate-400">{hospitalSubtitle}</div>
            )}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Loket</div>
          <div className="mt-1 text-2xl font-bold">{counter?.name || `Loket ${counterId}`}</div>
          <div className="text-sm text-slate-400">{counter?.code || "-"}</div>
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

      <div className="flex items-center gap-8 border-b border-slate-800 px-6 py-3 text-xs uppercase tracking-[0.18em] text-slate-400">
        <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> Total {totalQueues}</span>
        <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-amber-400" /> Menunggu {waitingQueues}</span>
        <span className="inline-flex items-center gap-2"><Volume2 className="h-4 w-4 text-cyan-400" /> Dilayani {servingQueues}</span>
        <span className="inline-flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Selesai {completedQueues}</span>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex flex-1 flex-col border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-400">
            {isAnnouncing ? (
              <span className="inline-flex items-center gap-2 text-amber-400">
                <Megaphone className="h-4 w-4" /> Memanggil
              </span>
            ) : (
              "Nomor Antrean"
            )}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
            {currentQueue ? (
              <>
                <div className="border border-slate-700 bg-white px-10 py-10 text-slate-950">
                  <div className="text-[11rem] font-black leading-none tracking-[0.08em]">
                    {currentQueue.queue_number}
                  </div>
                </div>
                <div className="mt-6 text-3xl font-bold text-slate-100">
                  {counter?.name || `Loket ${counterId}`}
                </div>
                <div className="mt-2 text-base text-slate-400">
                  Dipanggil pukul {currentQueue.called_at
                    ? new Date(currentQueue.called_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "-"}
                </div>
              </>
            ) : (
              <div className="text-xl text-slate-500">Belum ada antrean yang dipanggil</div>
            )}
          </div>
        </div>

        <div className="flex w-[320px] flex-col border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-400">
            Riwayat Panggilan
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="space-y-2">
              {queues.slice(0, 10).map((queue) => (
                <div
                  key={queue.id}
                  className={cn(
                    "border px-3 py-3",
                    queue.status === "called"
                      ? "border-cyan-500 bg-slate-950"
                      : "border-slate-800 bg-slate-950"
                  )}
                >
                  <div className="text-2xl font-black leading-none tracking-[0.08em]">
                    {queue.queue_number}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {queue.called_at &&
                      new Date(queue.called_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </div>
                </div>
              ))}
              {queues.length === 0 && (
                <div className="py-6 text-center text-sm text-slate-500">
                  Belum ada riwayat panggilan
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onPointerUp={handleAudioActivation}
        className={cn(
          "fixed bottom-4 right-4 z-50 inline-flex min-h-12 items-center gap-3 border bg-slate-950 px-5 py-3 text-sm font-bold tracking-[0.16em] shadow-[0_0_0_1px_rgba(15,23,42,0.4)] pointer-events-auto touch-manipulation",
          speechReady
            ? "border-emerald-500 text-emerald-300"
            : hasIndonesianVoice
              ? "border-amber-500 text-amber-300"
              : "border-rose-500 text-rose-300"
        )}
      >
        <Volume2 className="h-4 w-4 shrink-0" />
        {speechReady
          ? "NONAKTIFKAN SUARA"
          : hasIndonesianVoice
            ? "AKTIFKAN SUARA"
            : "VOICE ID TIDAK ADA"}
      </button>
    </div>
  );
}
