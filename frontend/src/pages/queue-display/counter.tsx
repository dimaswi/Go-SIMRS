import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import { Volume2, Users, Clock, CheckCircle, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};
const BASE_URL = getBaseUrl();

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
  const announcementRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({
        date: today,
        counter_id: parseInt(counterId!),
      });
      const allData = response.data.data || [];

      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );

      const calledQueues = filteredData.filter(
        (q) => q.status === "called" && q.called_at
      );
      calledQueues.sort((a, b) => {
        if (!a.called_at || !b.called_at) return 0;
        return (
          new Date(b.called_at).getTime() - new Date(a.called_at).getTime()
        );
      });

      const servingQueues = filteredData.filter(
        (q) => q.status === "serving" && q.called_at
      );
      servingQueues.sort((a, b) => {
        if (!a.called_at || !b.called_at) return 0;
        return (
          new Date(b.called_at).getTime() - new Date(a.called_at).getTime()
        );
      });

      setQueues(filteredData);

      const latest =
        calledQueues.length > 0 ? calledQueues[0] : servingQueues[0];

      if (latest && latest.status === "called" && latest.called_at) {
        const uniqueId = `${latest.id}-${latest.called_at}`;

        if (uniqueId !== announcementRef.current) {
          announcementRef.current = uniqueId;
          setCurrentQueue(latest);

          if (!isInitialLoad) {
            setTimeout(() => {
              speakQueue(latest);
            }, 100);
          } else {
            setIsInitialLoad(false);
          }
          return;
        }
      }

      if (latest) {
        setCurrentQueue(latest);
      } else {
        setCurrentQueue(null);
      }
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }, [counterId, isInitialLoad]);

  const loadAllQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({
        date: today,
        counter_id: parseInt(counterId!),
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
    loadSettings();

    const loadCounter = async () => {
      try {
        const data = await counterApi.getCounter(parseInt(counterId!));
        setCounter(data);
      } catch (error) {
        console.error("Failed to load counter:", error);
      }
    };
    loadCounter();
  }, [counterId]);

  useEffect(() => {
    loadQueues();
    loadAllQueues();
    const interval = setInterval(() => {
      loadQueues();
      loadAllQueues();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadQueues, loadAllQueues]);

  const speakQueue = (queue: Queue) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const counterName = queue.counter?.name || counter?.name || "loket";
      const text = `Nomor antrean ${queue.queue_number
        .split("")
        .join(" ")}, silakan menuju ${counterName}`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      setIsAnnouncing(true);
      utterance.onend = () => setIsAnnouncing(false);
      utterance.onerror = () => setIsAnnouncing(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  // Statistics
  const totalQueues = allQueues.length;
  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const completedQueues = allQueues.filter(
    (q) => q.status === "completed"
  ).length;

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col select-none">
      {/* Header */}
      <div className="bg-white shadow-sm py-4 px-8 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {appLogo && (
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-14 w-14 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {hospitalName}
              </h1>
              {hospitalSubtitle && (
                <p className="text-gray-400 text-xs">{hospitalSubtitle}</p>
              )}
            </div>
          </div>

          {/* Counter Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right mr-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                Loket
              </div>
              <div className="text-lg font-bold text-gray-900">
                {counter?.name || `Loket ${counterId}`}
              </div>
            </div>
            <div className="bg-gray-900 text-white px-6 py-3 rounded-xl">
              <div className="text-2xl font-black tracking-wider leading-none">
                {counter?.code || "---"}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-gray-900 leading-tight">
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

      {/* Stats Bar */}
      <div className="bg-white shadow-sm mt-3 mx-8 rounded-xl px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-10">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-xl font-bold text-gray-900">
              {totalQueues}
            </span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-gray-400 text-sm">Menunggu</span>
            <span className="text-xl font-bold text-amber-600">
              {waitingQueues}
            </span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-blue-400" />
            <span className="text-gray-400 text-sm">Dilayani</span>
            <span className="text-xl font-bold text-blue-600">
              {servingQueues}
            </span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-gray-400 text-sm">Selesai</span>
            <span className="text-xl font-bold text-emerald-600">
              {completedQueues}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {currentQueue ? (
          <div className="text-center">
            {/* Announcing indicator */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {isAnnouncing ? (
                <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full animate-pulse">
                  <Megaphone className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    Memanggil...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 px-4 py-2">
                  <span className="text-lg uppercase tracking-widest font-medium">
                    Nomor Antrean
                  </span>
                </div>
              )}
            </div>

            {/* Queue Number Card */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-900/10 inline-block px-20 py-12 mb-8">
              <div className="text-[10rem] font-black leading-none tracking-wider text-gray-900">
                {currentQueue.queue_number}
              </div>
            </div>

            {/* Direction */}
            <div className="text-2xl font-semibold text-gray-600 mb-3">
              Silakan menuju{" "}
              <span className="text-gray-900 font-bold">
                {counter?.name || `Loket ${counterId}`}
              </span>
            </div>

            {/* Called Time */}
            <div className="text-base text-gray-400">
              Dipanggil pukul{" "}
              {currentQueue.called_at
                ? new Date(currentQueue.called_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "-"}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-white rounded-3xl shadow-lg inline-block px-16 py-10 mb-6">
              <div className="text-8xl font-black text-gray-200">---</div>
            </div>
            <p className="text-xl text-gray-400">
              Belum ada antrean yang dipanggil
            </p>
          </div>
        )}
      </div>

      {/* Recent Calls */}
      <div className="bg-white shadow-sm py-4 px-8 flex-shrink-0">
        <div className="flex items-center gap-4 mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Riwayat Panggilan
          </h3>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {queues.slice(0, 10).map((queue) => (
            <div
              key={queue.id}
              className={cn(
                "flex-shrink-0 px-5 py-2.5 rounded-xl text-center min-w-[100px] transition-all",
                queue.status === "called"
                  ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20"
                  : "bg-gray-100 text-gray-900"
              )}
            >
              <div className="text-xl font-bold">{queue.queue_number}</div>
              <div
                className={cn(
                  "text-[10px]",
                  queue.status === "called" ? "text-gray-400" : "text-gray-400"
                )}
              >
                {queue.called_at &&
                  new Date(queue.called_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </div>
            </div>
          ))}
          {queues.length === 0 && (
            <p className="text-gray-300 text-sm py-2">
              Belum ada riwayat panggilan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
