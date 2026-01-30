import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import { Volume2, Users, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CounterQueueDisplay() {
  const { counterId } = useParams<{ counterId: string }>();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const announcementRef = useRef<string | null>(null);

  // Update time every second
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

      // Filter untuk status called dan serving saja
      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );

      // Sort by called_at DESC to get the most recently called
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

      // Prioritas: called terbaru, kalau tidak ada baru serving terbaru
      const latest =
        calledQueues.length > 0 ? calledQueues[0] : servingQueues[0];

      if (latest && latest.status === "called" && latest.called_at) {
        const uniqueId = `${latest.id}-${latest.called_at}`;

        // Track by both queue ID and called_at to prevent re-announcements
        if (uniqueId !== announcementRef.current) {
          announcementRef.current = uniqueId;
          setCurrentQueue(latest);

          // Only play sound if not initial load
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
      const data = response.data.data || [];
      setAllQueues(data);
    } catch (error) {
      console.error("Failed to load all queues:", error);
    }
  }, [counterId]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) {
          setHospitalName(settings.app_name);
        }
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

      window.speechSynthesis.speak(utterance);
    }
  };

  // Calculate statistics
  const totalQueues = allQueues.length;
  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const completedQueues = allQueues.filter(
    (q) => q.status === "completed"
  ).length;

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-black text-white py-6 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-wide">{hospitalName}</h1>
            <p className="text-gray-400 text-sm uppercase tracking-wider">
              Sistem Antrean Pendaftaran
            </p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold bg-white text-black px-6 py-2">
              {counter?.code || "---"}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {counter?.name || `Loket ${counterId}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-gray-400 text-sm">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="border-b-2 border-gray-200 py-3 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-12">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-2xl font-bold">{totalQueues}</span>
          </div>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-gray-500 text-sm">Menunggu</span>
            <span className="text-2xl font-bold">{waitingQueues}</span>
          </div>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-gray-400" />
            <span className="text-gray-500 text-sm">Dilayani</span>
            <span className="text-2xl font-bold">{servingQueues}</span>
          </div>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-gray-400" />
            <span className="text-gray-500 text-sm">Selesai</span>
            <span className="text-2xl font-bold">{completedQueues}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Current Queue Being Called */}
        {currentQueue ? (
          <div className="text-center">
            {/* Label */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Volume2 className="h-8 w-8 text-black animate-pulse" />
              <span className="text-2xl font-medium text-gray-600 uppercase tracking-wider">
                Nomor Antrean
              </span>
              <Volume2 className="h-8 w-8 text-black animate-pulse" />
            </div>

            {/* Queue Number */}
            <div className="border-4 border-black inline-block px-20 py-12 mb-6">
              <div className="text-[12rem] font-black leading-none tracking-wider">
                {currentQueue.queue_number}
              </div>
            </div>

            {/* Counter Info */}
            <div className="text-3xl font-semibold text-gray-700 mb-4">
              Silakan menuju {counter?.name || `Loket ${counterId}`}
            </div>

            {/* Called Time */}
            <div className="text-xl text-gray-500">
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
            <div className="text-6xl text-gray-300 mb-4">---</div>
            <p className="text-2xl text-gray-400">
              Belum ada antrean yang dipanggil
            </p>
          </div>
        )}
      </div>

      {/* Recent Calls */}
      <div className="border-t-2 border-gray-200 py-4 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Riwayat Panggilan
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {queues.slice(0, 10).map((queue) => (
              <div
                key={queue.id}
                className={cn(
                  "flex-shrink-0 px-6 py-3 border-2 text-center min-w-[120px]",
                  queue.status === "called"
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white"
                )}
              >
                <div className="text-2xl font-bold">{queue.queue_number}</div>
                <div
                  className={cn(
                    "text-xs",
                    queue.status === "called" ? "text-gray-400" : "text-gray-500"
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
              <p className="text-gray-400 text-sm">Belum ada riwayat panggilan</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
