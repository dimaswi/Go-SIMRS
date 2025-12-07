import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import { Volume2, Users, Clock, CheckCircle, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CounterQueueDisplay() {
  const { counterId } = useParams<{ counterId: string }>();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);
  const [lastCalledTime, setLastCalledTime] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
      const calledQueues = filteredData.filter((q) => q.status === "called" && q.called_at);
      calledQueues.sort((a, b) => {
        if (!a.called_at || !b.called_at) return 0;
        return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
      });
      
      const servingQueues = filteredData.filter((q) => q.status === "serving" && q.called_at);
      servingQueues.sort((a, b) => {
        if (!a.called_at || !b.called_at) return 0;
        return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
      });
      
      setQueues(filteredData);
      
      // Prioritas: called terbaru, kalau tidak ada baru serving terbaru
      const latest = calledQueues.length > 0 ? calledQueues[0] : servingQueues[0];
      
      if (latest && latest.status === "called" && latest.called_at) {
        const newCalledTime = latest.called_at;
        if (lastCalledTime !== newCalledTime) {
          console.log("New call detected:", latest.queue_number, "at", newCalledTime);
          setLastCalledTime(newCalledTime);
          setCurrentQueue(latest);
          
          // Only play sound if not initial load
          if (!isInitialLoad) {
            console.log("Playing sound for:", latest.queue_number);
            setTimeout(() => {
              speakQueue(latest);
            }, 100);
          } else {
            console.log("Initial load - skipping sound");
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
  }, [counterId, lastCalledTime]);

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
    console.log("speakQueue called for:", queue.queue_number);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const counterName = queue.counter?.name || counter?.name || "loket";
      const text = `Nomor antrean ${queue.queue_number.split("").join(" ")}, silakan menuju ${counterName}`;

      console.log("Speaking:", text);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => console.log("Speech started");
      utterance.onend = () => console.log("Speech ended");
      utterance.onerror = (e) => console.error("Speech error:", e);

      window.speechSynthesis.speak(utterance);
    } else {
      console.error("speechSynthesis not supported");
    }
  };

  // Calculate statistics
  const totalQueues = allQueues.length;
  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter((q) => q.status === "serving").length;
  const completedQueues = allQueues.filter((q) => q.status === "completed").length;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2">
            {hospitalName}
          </h1>
          <p className="text-xl text-center text-blue-100">
            SISTEM ANTREAN PENDAFTARAN
          </p>
          <p className="text-2xl text-center text-white font-bold mt-2">
            {counter?.name || `Loket ${counterId}`}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold">{totalQueues}</div>
                <div className="text-sm text-blue-100">Total Antrean</div>
              </div>
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <Hourglass className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold">{waitingQueues}</div>
                <div className="text-sm text-yellow-100">Menunggu</div>
              </div>
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold">{servingQueues}</div>
                <div className="text-sm text-purple-100">Sedang Dilayani</div>
              </div>
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold">{completedQueues}</div>
                <div className="text-sm text-green-100">Selesai</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Current Queue Being Called */}
        {currentQueue ? (
          <Card className="bg-white text-gray-900 p-12 shadow-2xl border-4 border-yellow-400">
            <div className="flex items-center justify-center gap-8">
              <Volume2 className="h-24 w-24 text-yellow-500 animate-bounce" />
              <div className="text-center">
                <p className="text-3xl font-semibold text-gray-600 mb-4">
                  Sedang Dipanggil
                </p>
                <div className="text-9xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent mb-4">
                  {currentQueue.queue_number}
                </div>
                <div className="text-2xl text-gray-600">
                  {currentQueue.called_at
                    ? new Date(currentQueue.called_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-white/10 backdrop-blur-sm p-12 text-center">
            <p className="text-3xl text-gray-400">
              Belum ada antrean yang dipanggil
            </p>
          </Card>
        )}

        {/* Recent Calls List */}
        <Card className="bg-white/10 backdrop-blur-sm p-6">
          <h2 className="text-2xl font-bold mb-4 text-white">
            Riwayat Panggilan {counter?.name || `Loket ${counterId}`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queues.slice(0, 8).map((queue) => (
              <div
                key={queue.id}
                className={cn(
                  "flex items-center justify-between rounded-lg p-3",
                  queue.status === "called" 
                    ? "bg-blue-500/30 border-2 border-blue-400"
                    : "bg-white/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-white">
                    {queue.queue_number}
                  </div>
                  <div>
                    <div className="text-xs text-gray-300">
                      {queue.called_at && new Date(queue.called_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {queue.status === "called" ? "Dipanggil" : "Dilayani"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-center">
        <p className="text-lg text-gray-400">
          Harap perhatikan nomor antrean Anda - Terima kasih atas kesabaran Anda
        </p>
      </div>
    </div>
  );
}
