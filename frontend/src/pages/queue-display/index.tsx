import { useEffect, useState, useCallback } from "react";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomQueuesApi, type RoomQueue } from "@/lib/api/room-queues";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import {
  Users,
  Clock,
  CheckCircle,
  Building2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};
const BASE_URL = getBaseUrl();

export default function QueueDisplay() {
  // Registration Queue State
  const [registrationQueues, setRegistrationQueues] = useState<Queue[]>([]);
  const [allRegistrationQueues, setAllRegistrationQueues] = useState<Queue[]>(
    []
  );
  const [counters, setCounters] = useState<Counter[]>([]);

  // Room Queue State
  const [roomQueues, setRoomQueues] = useState<RoomQueue[]>([]);
  const [allRoomQueues, setAllRoomQueues] = useState<RoomQueue[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Selection filters from localStorage
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
      const savedCounters = localStorage.getItem(
        "queueDisplay_selectedCounters"
      );
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
    loadSettings();

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({
          is_active: "true",
          limit: 100,
        });
        setRooms(response.data.data || []);
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };
    loadRooms();
  }, []);

  // Load open counters with auto-refresh
  useEffect(() => {
    const loadCounters = async () => {
      try {
        const data = await counterApi.getOpenCounters();
        const savedCounters = localStorage.getItem(
          "queueDisplay_selectedCounters"
        );
        if (savedCounters) {
          const selectedIds = JSON.parse(savedCounters) as number[];
          if (selectedIds.length > 0) {
            setCounters(data.filter((c) => selectedIds.includes(c.id)));
          } else {
            setCounters(data);
          }
        } else {
          setCounters(data);
        }
      } catch (error) {
        console.error("Failed to load counters:", error);
      }
    };
    loadCounters();
    const counterInterval = setInterval(loadCounters, 3000);
    return () => clearInterval(counterInterval);
  }, []);

  useEffect(() => {
    loadRegistrationQueues();
    loadRoomQueues();
    const interval = setInterval(() => {
      loadRegistrationQueues();
      loadRoomQueues();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadRegistrationQueues, loadRoomQueues]);

  // Registration Statistics
  const filteredRegQueues =
    selectedCounterIds.length > 0
      ? allRegistrationQueues.filter((q) =>
          selectedCounterIds.includes(q.counter_id || 0)
        )
      : allRegistrationQueues;
  const regTotalQueues = filteredRegQueues.length;
  const regWaitingQueues = filteredRegQueues.filter(
    (q) => q.status === "waiting"
  ).length;
  const regServingQueues = filteredRegQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const regCompletedQueues = filteredRegQueues.filter(
    (q) => q.status === "completed"
  ).length;

  // Room Statistics
  const filteredRoomQueues =
    selectedRoomIds.length > 0
      ? allRoomQueues.filter((q) => selectedRoomIds.includes(q.room_id))
      : allRoomQueues;
  const roomTotalQueues = filteredRoomQueues.length;
  const roomWaitingQueues = filteredRoomQueues.filter(
    (q) => q.status === "waiting"
  ).length;
  const roomServingQueues = filteredRoomQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const roomCompletedQueues = filteredRoomQueues.filter(
    (q) => q.status === "completed"
  ).length;

  // Display rooms logic
  const activeRoomIds = [
    ...new Set(filteredRoomQueues.map((q) => q.room_id)),
  ];
  const displayRooms =
    selectedRoomIds.length > 0
      ? rooms.filter((r) => selectedRoomIds.includes(r.id))
      : activeRoomIds.length > 0
        ? rooms.filter((r) => activeRoomIds.includes(r.id))
        : rooms.slice(0, 20);

  const showRooms = selectedRoomIds.length > 0 || rooms.length > 0;
  const showCounters = selectedCounterIds.length > 0 || counters.length > 0;

  // Stats component
  const StatsPill = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
  }) => (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={cn("h-3 w-3", color)} />
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col select-none">
      {/* Header */}
      <div className="bg-white shadow-sm py-3 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {appLogo && (
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{appName}</h1>
              <p className="text-gray-400 text-xs uppercase tracking-wider">
                {hospitalName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-gray-900 leading-tight">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="text-gray-400 text-xs">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Side - Room Queue */}
        {showRooms && (
          <div
            className={cn(
              "flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden",
              showCounters ? "w-1/2" : "w-full"
            )}
          >
            {/* Room Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Antrean Poli
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <StatsPill
                  icon={Users}
                  label="Total"
                  value={roomTotalQueues}
                  color="text-gray-400"
                />
                <StatsPill
                  icon={Clock}
                  label="Tunggu"
                  value={roomWaitingQueues}
                  color="text-amber-400"
                />
                <StatsPill
                  icon={Building2}
                  label="Layani"
                  value={roomServingQueues}
                  color="text-blue-400"
                />
                <StatsPill
                  icon={CheckCircle}
                  label="Selesai"
                  value={roomCompletedQueues}
                  color="text-emerald-400"
                />
              </div>
            </div>

            {/* Room Queue Grid */}
            <div className="flex-1 overflow-auto p-3">
              {displayRooms.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-300 text-lg">
                    Tidak ada ruangan tersedia
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {displayRooms.map((room) => {
                    const roomQueueList = roomQueues.filter(
                      (q) => q.room_id === room.id
                    );
                    roomQueueList.sort((a, b) => {
                      if (!a.called_at || !b.called_at) return 0;
                      return (
                        new Date(b.called_at).getTime() -
                        new Date(a.called_at).getTime()
                      );
                    });
                    const latestQueue = roomQueueList[0];
                    const roomAllQueues = allRoomQueues.filter(
                      (q) => q.room_id === room.id
                    );
                    const roomWaiting = roomAllQueues.filter(
                      (q) => q.status === "waiting"
                    ).length;
                    const isActive = !!latestQueue;

                    return (
                      <div
                        key={room.id}
                        className={cn(
                          "rounded-xl transition-all duration-300 flex flex-col overflow-hidden",
                          isActive
                            ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/20"
                            : "bg-gray-50 border border-gray-200"
                        )}
                      >
                        {/* Room Header */}
                        <div
                          className={cn(
                            "px-3 py-2 flex-shrink-0",
                            isActive
                              ? "border-b border-gray-700/50"
                              : "border-b border-gray-200"
                          )}
                        >
                          <div
                            className={cn(
                              "text-xs font-bold truncate",
                              isActive ? "text-white" : "text-gray-900"
                            )}
                          >
                            {room.name}
                          </div>
                          <div
                            className={cn(
                              "text-[10px]",
                              isActive ? "text-gray-400" : "text-gray-400"
                            )}
                          >
                            {room.queue_code || room.code}
                          </div>
                        </div>

                        {/* Queue Number */}
                        <div className="flex-1 flex flex-col items-center justify-center py-4 px-2 min-h-[80px]">
                          {latestQueue ? (
                            <>
                              <div
                                className={cn(
                                  "text-3xl font-black tracking-wider",
                                  isActive ? "text-white" : "text-gray-900"
                                )}
                              >
                                {latestQueue.queue_number}
                              </div>
                              {latestQueue.is_mjkn && (
                                <div className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full mt-1 font-semibold">
                                  MJKN
                                </div>
                              )}
                              <div
                                className={cn(
                                  "text-[10px] mt-1",
                                  isActive ? "text-gray-500" : "text-gray-400"
                                )}
                              >
                                {latestQueue.called_at &&
                                  new Date(
                                    latestQueue.called_at
                                  ).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                              </div>
                            </>
                          ) : (
                            <div className="text-2xl font-bold text-gray-200">
                              ---
                            </div>
                          )}
                        </div>

                        {/* Waiting badge */}
                        {roomWaiting > 0 && (
                          <div
                            className={cn(
                              "px-3 py-1.5 text-center flex-shrink-0",
                              isActive
                                ? "bg-amber-500/20 border-t border-gray-700/50"
                                : "bg-amber-50 border-t border-gray-200"
                            )}
                          >
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                isActive ? "text-amber-300" : "text-amber-600"
                              )}
                            >
                              {roomWaiting} menunggu
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Side - Registration Queue */}
        {showCounters && (
          <div
            className={cn(
              "flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden",
              showRooms ? "w-1/2" : "w-full"
            )}
          >
            {/* Registration Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Antrean Pendaftaran
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <StatsPill
                  icon={Users}
                  label="Total"
                  value={regTotalQueues}
                  color="text-gray-400"
                />
                <StatsPill
                  icon={Clock}
                  label="Tunggu"
                  value={regWaitingQueues}
                  color="text-amber-400"
                />
                <StatsPill
                  icon={ClipboardList}
                  label="Layani"
                  value={regServingQueues}
                  color="text-emerald-400"
                />
                <StatsPill
                  icon={CheckCircle}
                  label="Selesai"
                  value={regCompletedQueues}
                  color="text-emerald-400"
                />
              </div>
            </div>

            {/* Registration Queue Grid */}
            <div className="flex-1 overflow-auto p-3">
              {counters.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-300 text-lg">
                    Tidak ada loket tersedia
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {counters.map((counter) => {
                    const counterQueues = registrationQueues.filter(
                      (q) => q.counter_id === counter.id
                    );
                    counterQueues.sort((a, b) => {
                      if (!a.called_at || !b.called_at) return 0;
                      return (
                        new Date(b.called_at).getTime() -
                        new Date(a.called_at).getTime()
                      );
                    });
                    const latestQueue = counterQueues[0];
                    const counterAllQueues = allRegistrationQueues.filter(
                      (q) => q.counter_id === counter.id
                    );
                    const counterWaiting = counterAllQueues.filter(
                      (q) => q.status === "waiting"
                    ).length;
                    const isActive = !!latestQueue;

                    return (
                      <div
                        key={counter.id}
                        className={cn(
                          "rounded-xl transition-all duration-300 flex flex-col overflow-hidden",
                          isActive
                            ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/20"
                            : "bg-gray-50 border border-gray-200"
                        )}
                      >
                        {/* Counter Header */}
                        <div
                          className={cn(
                            "px-3 py-2 flex-shrink-0",
                            isActive
                              ? "border-b border-gray-700/50"
                              : "border-b border-gray-200"
                          )}
                        >
                          <div
                            className={cn(
                              "text-xs font-bold",
                              isActive ? "text-white" : "text-gray-900"
                            )}
                          >
                            {counter.name}
                          </div>
                          <div
                            className={cn(
                              "text-[10px]",
                              isActive ? "text-gray-400" : "text-gray-400"
                            )}
                          >
                            {counter.code}
                          </div>
                        </div>

                        {/* Queue Number */}
                        <div className="flex-1 flex flex-col items-center justify-center py-4 px-2 min-h-[80px]">
                          {latestQueue ? (
                            <>
                              <div
                                className={cn(
                                  "text-3xl font-black tracking-wider",
                                  isActive ? "text-white" : "text-gray-900"
                                )}
                              >
                                {latestQueue.queue_number}
                              </div>
                              <div
                                className={cn(
                                  "text-[10px] mt-1",
                                  isActive ? "text-gray-500" : "text-gray-400"
                                )}
                              >
                                {latestQueue.called_at &&
                                  new Date(
                                    latestQueue.called_at
                                  ).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                              </div>
                            </>
                          ) : (
                            <div className="text-2xl font-bold text-gray-200">
                              ---
                            </div>
                          )}
                        </div>

                        {/* Waiting badge */}
                        {counterWaiting > 0 && (
                          <div
                            className={cn(
                              "px-3 py-1.5 text-center flex-shrink-0",
                              isActive
                                ? "bg-amber-500/20 border-t border-gray-700/50"
                                : "bg-amber-50 border-t border-gray-200"
                            )}
                          >
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                isActive ? "text-amber-300" : "text-amber-600"
                              )}
                            >
                              {counterWaiting} menunggu
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-2 px-6 text-center bg-white shadow-sm flex-shrink-0">
        <p className="text-gray-400 text-xs">
          Perhatikan nomor antrean Anda pada layar di atas
        </p>
      </div>
    </div>
  );
}
