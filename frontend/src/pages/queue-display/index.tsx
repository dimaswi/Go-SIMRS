import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import { Users, Clock, CheckCircle, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QueueDisplay() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");

  const loadQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({ date: today });
      const allData = response.data.data || [];
      
      // Filter untuk status called dan serving saja untuk grid
      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );
      setQueues(filteredData);
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }, []);

  const loadAllQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({ date: today });
      const data = response.data.data || [];
      setAllQueues(data);
    } catch (error) {
      console.error("Failed to load all queues:", error);
    }
  }, []);

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

    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
      } catch (error) {
        console.error("Failed to load counters:", error);
      }
    };
    loadCounters();
  }, []);

  useEffect(() => {
    loadQueues();
    loadAllQueues();
    const interval = setInterval(() => {
      loadQueues();
      loadAllQueues();
    }, 3000); // Refresh every 3 seconds - optimal balance between responsiveness and server load
    return () => clearInterval(interval);
  }, [loadQueues, loadAllQueues]);

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
          <p className="text-lg text-center text-blue-200 mt-1">
            Semua Loket
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

        {/* Waiting Queues Grid - Display Utama hanya tampilkan grid loket */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {counters.map((counter) => {
            const counterQueues = queues.filter(
              (q) => q.counter_id === counter.id
            );
            
            // Sort by called_at DESC to get the most recently called
            counterQueues.sort((a, b) => {
              if (!a.called_at || !b.called_at) return 0;
              return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
            });
            
            const latestQueue = counterQueues[0];
            
            // Statistics per counter
            const counterAllQueues = allQueues.filter((q) => q.counter_id === counter.id);
            const counterWaiting = counterAllQueues.filter((q) => q.status === "waiting").length;
            const counterServing = counterAllQueues.filter((q) => q.status === "serving").length;
            const counterCompleted = counterAllQueues.filter((q) => q.status === "completed").length;

            return (
              <Card
                key={counter.id}
                className={cn(
                  "p-6 border-2 transition-all",
                  latestQueue
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-600 mb-2">
                    {counter.name}
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    {counter.code}
                  </div>
                  {latestQueue ? (
                    <>
                      <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                        {latestQueue.queue_number}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(latestQueue.called_at!).toLocaleTimeString(
                          "id-ID",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-3xl text-gray-400 py-4">-</div>
                  )}
                  
                  {/* Counter Statistics */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-yellow-600 font-bold">{counterWaiting}</div>
                        <div className="text-gray-500">Tunggu</div>
                      </div>
                      <div>
                        <div className="text-purple-600 font-bold">{counterServing}</div>
                        <div className="text-gray-500">Layani</div>
                      </div>
                      <div>
                        <div className="text-green-600 font-bold">{counterCompleted}</div>
                        <div className="text-gray-500">Selesai</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-center">
        <p className="text-lg text-gray-400">
          Harap perhatikan nomor antrean Anda - Terima kasih atas kesabaran
          Anda
        </p>
      </div>
    </div>
  );
}
