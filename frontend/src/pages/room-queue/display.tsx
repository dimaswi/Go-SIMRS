import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { roomQueuesApi, roomsApi, settingsApi } from "@/lib/api";
import type { RoomQueue } from "@/lib/api/room-queues";
import {
  disableSharedAnnouncementAudio,
  enableSharedAnnouncementAudio,
  queueSharedAnnouncement,
  subscribeSharedAnnouncementState,
} from "@/lib/shared-queue-announcer";
import { Volume2, Users, Clock, CheckCircle, Megaphone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

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

const spellQueueNumberForSpeech = (value: string) =>
  value
    .trim()
    .split("")
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || "")
    .filter(Boolean)
    .join(" ");

const getRoomQueueAnnouncementVersion = (queue: RoomQueue) =>
  queue.called_at || queue.updated_at || queue.created_at || new Date().toISOString();

export default function RoomQueueDisplay() {
  const { roomId } = useParams<{ roomId: string }>();
  const [queues, setQueues] = useState<RoomQueue[]>([]);
  const [allQueues, setAllQueues] = useState<RoomQueue[]>([]);
  const [room, setRoom] = useState<{ id: number; name: string } | null>(null);
  const [currentQueue, setCurrentQueue] = useState<RoomQueue | null>(null);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [hospitalSubtitle, setHospitalSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const announcementRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const enableAudio = useCallback(async () => {
    const result = await enableSharedAnnouncementAudio();
    setAudioReady(result.audioReady);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSharedAnnouncementState((state) => {
      setIsAnnouncing(state.isAnnouncing);
    });

    return unsubscribe;
  }, []);

  const buildRoomAnnouncementText = useCallback((queue: RoomQueue) => {
    const queueText = spellQueueNumberForSpeech(queue.queue_number);
    const roomName = room?.name || "ruangan";
    return `Nomor antrean ${queueText}. Silakan menuju ${roomName}.`;
  }, [room]);

  const loadQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await roomQueuesApi.getAll({
        room_id: parseInt(roomId!, 10),
        date: today,
      });
      const allData = response.data || [];
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
        const uniqueId = `${latest.id}-${getRoomQueueAnnouncementVersion(latest)}`;
        if (uniqueId !== announcementRef.current) {
          announcementRef.current = uniqueId;
          setCurrentQueue(latest);

          if (!isInitialLoad) {
            queueSharedAnnouncement({
              id: uniqueId,
              kind: "room",
              speechText: buildRoomAnnouncementText(latest),
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
  }, [buildRoomAnnouncementText, isInitialLoad, roomId]);

  const loadAllQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await roomQueuesApi.getAll({
        room_id: parseInt(roomId!, 10),
        date: today,
      });
      setAllQueues(response.data || []);
    } catch (error) {
      console.error("Failed to load all queues:", error);
    }
  }, [roomId]);

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

    const loadRoom = async () => {
      try {
        const response = await roomsApi.getById(parseInt(roomId!, 10));
        if (response.data.data) setRoom(response.data.data);
      } catch (error) {
        console.error("Failed to load room:", error);
      }
    };

    void loadSettings();
    void loadRoom();
  }, [roomId]);

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

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "emergency":
        return { label: "DARURAT", className: "text-red-400" };
      case "urgent":
        return { label: "PRIORITAS", className: "text-amber-400" };
      default:
        return null;
    }
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
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Ruangan</div>
          <div className="mt-1 text-2xl font-bold">{room?.name || "Memuat..."}</div>
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
        <button
          onClick={() => {
            if (audioReady) {
              disableSharedAnnouncementAudio();
              setAudioReady(false);
              setIsAnnouncing(false);
              return;
            }

            void enableAudio();
          }}
          className={cn(
            "ml-auto inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-bold tracking-[0.16em]",
            audioReady
              ? "border-emerald-500 text-emerald-300"
              : "border-amber-500 text-amber-300"
          )}
        >
          <Volume2 className="h-3.5 w-3.5" />
          {audioReady ? "Nonaktifkan Suara" : "Aktifkan Suara"}
        </button>
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
                {currentQueue.priority && getPriorityLabel(currentQueue.priority) && (
                  <div className={cn("mb-4 text-sm font-bold uppercase tracking-[0.2em]", getPriorityLabel(currentQueue.priority)?.className)}>
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {getPriorityLabel(currentQueue.priority)?.label}
                    </span>
                  </div>
                )}
                <div className="border border-slate-700 bg-white px-10 py-10 text-slate-950">
                  <div className="text-[11rem] font-black leading-none tracking-[0.08em]">
                    {currentQueue.queue_number}
                  </div>
                </div>
                <div className="mt-6 text-3xl font-bold text-slate-100">
                  {room?.name || "ruangan"}
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
                  {queue.priority && queue.priority !== "normal" && (
                    <div
                      className={cn(
                        "mt-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                        queue.priority === "emergency" ? "text-red-400" : "text-amber-400"
                      )}
                    >
                      {queue.priority === "emergency" ? "Darurat" : "Prioritas"}
                    </div>
                  )}
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
    </div>
  );
}
