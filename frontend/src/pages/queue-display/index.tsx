import { useEffect, useState, useCallback } from "react";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomQueuesApi, type RoomQueue } from "@/lib/api/room-queues";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import { Users, Clock, CheckCircle, Building2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

function InlineStat({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
      <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
      <span>{label}</span>
      <span className="text-sm font-bold text-slate-100 tabular-nums">{value}</span>
    </div>
  );
}

export default function QueueDisplay() {
  const [registrationQueues, setRegistrationQueues] = useState<Queue[]>([]);
  const [allRegistrationQueues, setAllRegistrationQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [roomQueues, setRoomQueues] = useState<RoomQueue[]>([]);
  const [allRoomQueues, setAllRoomQueues] = useState<RoomQueue[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [selectedCounterIds, setSelectedCounterIds] = useState<number[]>([]);
  const [appName, setAppName] = useState("SIMRS");
  const [hospitalName, setHospitalName] = useState("Rumah Sakit");
  const [appLogo, setAppLogo] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const savedRooms = localStorage.getItem("queueDisplay_selectedRooms");
      const savedCounters = localStorage.getItem("queueDisplay_selectedCounters");
      if (savedRooms) setSelectedRoomIds(JSON.parse(savedRooms));
      if (savedCounters) setSelectedCounterIds(JSON.parse(savedCounters));
    } catch (error) {
      console.error("Failed to load selections:", error);
    }
  }, []);

  const loadRegistrationQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({ date: today });
      const allData = response.data.data || [];
      setRegistrationQueues(
        allData.filter((q) => q.status === "called" || q.status === "serving")
      );
      setAllRegistrationQueues(allData);
    } catch (error) {
      console.error("Failed to load registration queues:", error);
    }
  }, []);

  const loadRoomQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await roomQueuesApi.getAll({ date: today });
      const allData = response.data || [];
      setRoomQueues(
        allData.filter((q) => q.status === "called" || q.status === "serving")
      );
      setAllRoomQueues(allData);
    } catch (error) {
      console.error("Failed to load room queues:", error);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_logo) setAppLogo(settings.app_logo);
        if (settings.app_subtitle) setHospitalName(settings.app_subtitle);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({ is_active: "true", limit: 100 });
        setRooms(response.data.data || []);
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };

    void loadSettings();
    void loadRooms();
  }, []);

  useEffect(() => {
    const loadCounters = async () => {
      try {
        const data = await counterApi.getOpenCounters();
        const savedCounters = localStorage.getItem("queueDisplay_selectedCounters");
        if (savedCounters) {
          const selectedIds = JSON.parse(savedCounters) as number[];
          setCounters(selectedIds.length > 0 ? data.filter((c) => selectedIds.includes(c.id)) : data);
        } else {
          setCounters(data);
        }
      } catch (error) {
        console.error("Failed to load counters:", error);
      }
    };

    void loadCounters();
    const counterInterval = setInterval(loadCounters, 3000);
    return () => clearInterval(counterInterval);
  }, []);

  useEffect(() => {
    void loadRegistrationQueues();
    void loadRoomQueues();

    const interval = setInterval(() => {
      void loadRegistrationQueues();
      void loadRoomQueues();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadRegistrationQueues, loadRoomQueues]);

  const filteredRegQueues =
    selectedCounterIds.length > 0
      ? allRegistrationQueues.filter((q) => selectedCounterIds.includes(q.counter_id || 0))
      : allRegistrationQueues;
  const regTotalQueues = filteredRegQueues.length;
  const regWaitingQueues = filteredRegQueues.filter((q) => q.status === "waiting").length;
  const regServingQueues = filteredRegQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const regCompletedQueues = filteredRegQueues.filter((q) => q.status === "completed").length;

  const filteredRoomQueues =
    selectedRoomIds.length > 0
      ? allRoomQueues.filter((q) => selectedRoomIds.includes(q.room_id))
      : allRoomQueues;
  const roomTotalQueues = filteredRoomQueues.length;
  const roomWaitingQueues = filteredRoomQueues.filter((q) => q.status === "waiting").length;
  const roomServingQueues = filteredRoomQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const roomCompletedQueues = filteredRoomQueues.filter((q) => q.status === "completed").length;

  const activeRoomIds = [...new Set(filteredRoomQueues.map((q) => q.room_id))];
  const displayRooms =
    selectedRoomIds.length > 0
      ? rooms.filter((r) => selectedRoomIds.includes(r.id))
      : activeRoomIds.length > 0
        ? rooms.filter((r) => activeRoomIds.includes(r.id))
        : rooms.slice(0, 20);

  const showRooms = selectedRoomIds.length > 0 || rooms.length > 0;
  const showCounters = selectedCounterIds.length > 0 || counters.length > 0;

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
            <div className="truncate text-sm text-slate-400">{hospitalName}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">
            {currentTime.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {showRooms && (
          <div className={cn("flex min-w-0 flex-col border border-slate-800 bg-slate-900", showCounters ? "w-1/2" : "w-full")}>
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-cyan-400" />
                <span className="text-lg font-bold">Antrean Poli</span>
              </div>
              <div className="hidden xl:flex items-center gap-5">
                <InlineStat icon={Users} label="Total" value={roomTotalQueues} />
                <InlineStat icon={Clock} label="Tunggu" value={roomWaitingQueues} iconClassName="text-amber-400" />
                <InlineStat icon={Building2} label="Layani" value={roomServingQueues} iconClassName="text-cyan-400" />
                <InlineStat icon={CheckCircle} label="Selesai" value={roomCompletedQueues} iconClassName="text-emerald-400" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {displayRooms.map((room) => {
                  const roomQueueList = roomQueues
                    .filter((q) => q.room_id === room.id)
                    .sort((a, b) => {
                      if (!a.called_at || !b.called_at) return 0;
                      return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
                    });
                  const latestQueue = roomQueueList[0];
                  const roomAllQueues = allRoomQueues.filter((q) => q.room_id === room.id);
                  const roomWaiting = roomAllQueues.filter((q) => q.status === "waiting").length;

                  return (
                    <div key={room.id} className="flex min-h-[156px] flex-col border border-slate-800 bg-slate-950">
                      <div className="flex items-start justify-between border-b border-slate-800 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{room.name}</div>
                          <div className="text-xs text-slate-400">{room.queue_code || room.code}</div>
                        </div>
                        {latestQueue?.is_mjkn && (
                          <div className="ml-2 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                            MJKN
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
                        {latestQueue ? (
                          <>
                            <div className="text-5xl font-black leading-none tracking-[0.08em]">
                              {latestQueue.queue_number}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {latestQueue.called_at &&
                                new Date(latestQueue.called_at).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">Belum ada panggilan</div>
                        )}
                      </div>

                      <div className="border-t border-slate-800 px-3 py-2 text-center text-xs text-slate-300">
                        {roomWaiting > 0 ? `${roomWaiting} menunggu` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showCounters && (
          <div className={cn("flex min-w-0 flex-col border border-slate-800 bg-slate-900", showRooms ? "w-1/2" : "w-full")}>
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-emerald-400" />
                <span className="text-lg font-bold">Antrean Pendaftaran</span>
              </div>
              <div className="hidden xl:flex items-center gap-5">
                <InlineStat icon={Users} label="Total" value={regTotalQueues} />
                <InlineStat icon={Clock} label="Tunggu" value={regWaitingQueues} iconClassName="text-amber-400" />
                <InlineStat icon={ClipboardList} label="Layani" value={regServingQueues} iconClassName="text-emerald-400" />
                <InlineStat icon={CheckCircle} label="Selesai" value={regCompletedQueues} iconClassName="text-emerald-400" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {counters.map((counter) => {
                  const counterQueues = registrationQueues
                    .filter((q) => q.counter_id === counter.id)
                    .sort((a, b) => {
                      if (!a.called_at || !b.called_at) return 0;
                      return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
                    });
                  const latestQueue = counterQueues[0];
                  const counterAllQueues = allRegistrationQueues.filter((q) => q.counter_id === counter.id);
                  const counterWaiting = counterAllQueues.filter((q) => q.status === "waiting").length;

                  return (
                    <div key={counter.id} className="flex min-h-[156px] flex-col border border-slate-800 bg-slate-950">
                      <div className="flex items-start justify-between border-b border-slate-800 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{counter.name}</div>
                          <div className="text-xs text-slate-400">{counter.code}</div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
                        {latestQueue ? (
                          <>
                            <div className="text-5xl font-black leading-none tracking-[0.08em]">
                              {latestQueue.queue_number}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {latestQueue.called_at &&
                                new Date(latestQueue.called_at).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">Belum ada panggilan</div>
                        )}
                      </div>

                      <div className="border-t border-slate-800 px-3 py-2 text-center text-xs text-slate-300">
                        {counterWaiting > 0 ? `${counterWaiting} menunggu` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
