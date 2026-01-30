import { useEffect, useState, useCallback } from "react";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomQueuesApi, type RoomQueue } from "@/lib/api/room-queues";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import { Users, Clock, CheckCircle, Volume2, Building2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QueueDisplay() {
  // Registration Queue State
  const [registrationQueues, setRegistrationQueues] = useState<Queue[]>([]);
  const [allRegistrationQueues, setAllRegistrationQueues] = useState<Queue[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);

  // Room Queue State
  const [roomQueues, setRoomQueues] = useState<RoomQueue[]>([]);
  const [allRoomQueues, setAllRoomQueues] = useState<RoomQueue[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Selection filters from localStorage
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [selectedCounterIds, setSelectedCounterIds] = useState<number[]>([]);

  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load selections from localStorage
  useEffect(() => {
    try {
      const savedRooms = localStorage.getItem("queueDisplay_selectedRooms");
      const savedCounters = localStorage.getItem("queueDisplay_selectedCounters");
      
      if (savedRooms) {
        setSelectedRoomIds(JSON.parse(savedRooms));
      }
      if (savedCounters) {
        setSelectedCounterIds(JSON.parse(savedCounters));
      }
    } catch (error) {
      console.error("Failed to load selections from localStorage:", error);
    }
  }, []);

  // Load Registration Queues
  const loadRegistrationQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await queueApi.getAll({ date: today });
      const allData = response.data.data || [];

      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );
      setRegistrationQueues(filteredData);
      setAllRegistrationQueues(allData);
    } catch (error) {
      console.error("Failed to load registration queues:", error);
    }
  }, []);

  // Load Room Queues
  const loadRoomQueues = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await roomQueuesApi.getAll({ date: today });
      const allData = response.data || [];

      const filteredData = allData.filter(
        (q) => q.status === "called" || q.status === "serving"
      );
      setRoomQueues(filteredData);
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
        // Filter counters based on selection from localStorage
        const savedCounters = localStorage.getItem("queueDisplay_selectedCounters");
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

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({ is_active: "true", limit: 100 });
        const allRoomsData = response.data.data || [];
        // Keep all rooms in state, filtering will be done during display
        setRooms(allRoomsData);
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };
    loadRooms();
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

  // Calculate Registration Statistics (filtered by selected counters)
  const filteredRegQueues = selectedCounterIds.length > 0
    ? allRegistrationQueues.filter((q) => selectedCounterIds.includes(q.counter_id || 0))
    : allRegistrationQueues;
  const regTotalQueues = filteredRegQueues.length;
  const regWaitingQueues = filteredRegQueues.filter((q) => q.status === "waiting").length;
  const regServingQueues = filteredRegQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const regCompletedQueues = filteredRegQueues.filter(
    (q) => q.status === "completed"
  ).length;

  // Calculate Room Statistics (filtered by selected rooms)
  const filteredRoomQueues = selectedRoomIds.length > 0
    ? allRoomQueues.filter((q) => selectedRoomIds.includes(q.room_id))
    : allRoomQueues;
  const roomTotalQueues = filteredRoomQueues.length;
  const roomWaitingQueues = filteredRoomQueues.filter((q) => q.status === "waiting").length;
  const roomServingQueues = filteredRoomQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const roomCompletedQueues = filteredRoomQueues.filter(
    (q) => q.status === "completed"
  ).length;

  // Get unique rooms that have queues today (filtered)
  const activeRoomIds = [...new Set(filteredRoomQueues.map((q) => q.room_id))];
  
  // Determine which rooms to display:
  // 1. If specific rooms are selected, show those
  // 2. Otherwise, show rooms with active queues
  // 3. Fallback to all rooms (limited)
  const displayRooms = selectedRoomIds.length > 0
    ? rooms.filter((r) => selectedRoomIds.includes(r.id))
    : activeRoomIds.length > 0
    ? rooms.filter((r) => activeRoomIds.includes(r.id))
    : rooms.slice(0, 20);

  // Determine layout based on what's selected
  const showRooms = selectedRoomIds.length > 0 || rooms.length > 0;
  const showCounters = selectedCounterIds.length > 0 || counters.length > 0;

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-black text-white py-3 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{hospitalName}</h1>
            <p className="text-gray-400 text-xs uppercase tracking-wider">
              Sistem Antrean Universal
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Room Queue */}
        {showRooms && (
        <div className={cn("flex flex-col border-r-2 border-gray-300", showCounters ? "w-1/2" : "w-full")}>
          {/* Room Queue Header */}
          <div className="bg-gray-100 px-4 py-2 border-b-2 border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Antrean Poli</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold">{roomTotalQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Tunggu</span>
                  <span className="font-bold">{roomWaitingQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Layani</span>
                  <span className="font-bold">{roomServingQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Selesai</span>
                  <span className="font-bold">{roomCompletedQueues}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Room Queue Grid */}
          <div className="flex-1 overflow-auto p-3">
            {displayRooms.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Tidak ada ruangan yang tersedia</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {displayRooms.map((room) => {
                  const roomQueueList = roomQueues.filter((q) => q.room_id === room.id);

                  roomQueueList.sort((a, b) => {
                    if (!a.called_at || !b.called_at) return 0;
                    return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
                  });

                  const latestQueue = roomQueueList[0];

                  const roomAllQueues = allRoomQueues.filter((q) => q.room_id === room.id);
                  const roomWaiting = roomAllQueues.filter((q) => q.status === "waiting").length;
                  const roomServing = roomAllQueues.filter(
                    (q) => q.status === "serving" || q.status === "called"
                  ).length;

                  const isActive = !!latestQueue;

                  return (
                    <div
                      key={room.id}
                      className={cn(
                        "border-2 transition-all duration-300 h-[160px] flex flex-col",
                        isActive
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-gray-50"
                      )}
                    >
                      {/* Room Header */}
                      <div
                        className={cn(
                          "px-2 py-1.5 border-b flex-shrink-0",
                          isActive ? "border-gray-700" : "border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              "text-sm font-bold truncate",
                              isActive ? "text-white" : "text-gray-900"
                            )}
                          >
                            {room.name}
                          </div>
                          {isActive && (
                            <Volume2 className="h-3 w-3 text-white animate-pulse flex-shrink-0" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "text-xs truncate",
                            isActive ? "text-gray-400" : "text-gray-500"
                          )}
                          >
                          {room.queue_code || room.code}
                        </div>
                      </div>

                      {/* Queue Number Display */}
                      <div className="flex-1 flex flex-col items-center justify-center px-2">
                        {latestQueue ? (
                          <>
                            <div className="text-3xl font-black tracking-wide">
                              {latestQueue.queue_number}
                            </div>
                            <div
                              className={cn(
                                "text-xs",
                                isActive ? "text-gray-400" : "text-gray-500"
                              )}
                            >
                              {latestQueue.called_at &&
                                new Date(latestQueue.called_at).toLocaleTimeString(
                                  "id-ID",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl text-gray-300">---</div>
                        )}
                      </div>

                      {/* Room Statistics */}
                      <div
                        className={cn(
                          "px-2 py-1.5 border-t flex-shrink-0",
                          isActive ? "border-gray-700" : "border-gray-200"
                        )}
                      >
                        <div className="flex justify-between text-xs">
                          <div className="text-center">
                            <div
                              className={cn(
                                "font-bold",
                                isActive ? "text-white" : "text-gray-900"
                              )}
                            >
                              {roomWaiting}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                isActive ? "text-gray-500" : "text-gray-400"
                              )}
                            >
                              Tunggu
                            </div>
                          </div>
                          <div className="text-center">
                            <div
                              className={cn(
                                "font-bold",
                                isActive ? "text-white" : "text-gray-900"
                              )}
                            >
                              {roomServing}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                isActive ? "text-gray-500" : "text-gray-400"
                              )}
                            >
                              Layani
                            </div>
                          </div>
                        </div>
                      </div>
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
        <div className={cn("flex flex-col", showRooms ? "w-1/2" : "w-full")}>
          {/* Registration Queue Header */}
          <div className="bg-gray-100 px-4 py-2 border-b-2 border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Antrean Pendaftaran</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold">{regTotalQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Tunggu</span>
                  <span className="font-bold">{regWaitingQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Layani</span>
                  <span className="font-bold">{regServingQueues}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">Selesai</span>
                  <span className="font-bold">{regCompletedQueues}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Queue Grid */}
          <div className="flex-1 overflow-auto p-3">
            {counters.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Tidak ada loket yang tersedia</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {counters.map((counter) => {
                  const counterQueues = registrationQueues.filter(
                    (q) => q.counter_id === counter.id
                  );

                  counterQueues.sort((a, b) => {
                    if (!a.called_at || !b.called_at) return 0;
                    return new Date(b.called_at).getTime() - new Date(a.called_at).getTime();
                  });

                  const latestQueue = counterQueues[0];

                  const counterAllQueues = allRegistrationQueues.filter(
                    (q) => q.counter_id === counter.id
                  );
                  const counterWaiting = counterAllQueues.filter(
                    (q) => q.status === "waiting"
                  ).length;
                  const counterServing = counterAllQueues.filter(
                    (q) => q.status === "serving" || q.status === "called"
                  ).length;

                  const isActive = !!latestQueue;

                  return (
                    <div
                      key={counter.id}
                      className={cn(
                        "border-2 transition-all duration-300 h-[160px] flex flex-col",
                        isActive
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-gray-50"
                      )}
                    >
                      {/* Counter Header */}
                      <div
                        className={cn(
                          "px-2 py-1.5 border-b flex-shrink-0",
                          isActive ? "border-gray-700" : "border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              "text-sm font-bold",
                              isActive ? "text-white" : "text-gray-900"
                            )}
                          >
                            {counter.name}
                          </div>
                          {isActive && (
                            <Volume2 className="h-3 w-3 text-white animate-pulse" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "text-xs truncate",
                            isActive ? "text-gray-400" : "text-gray-500"
                          )}
                        >
                          {counter.code}
                        </div>
                      </div>

                      {/* Queue Number Display */}
                      <div className="flex-1 flex flex-col items-center justify-center px-2">
                        {latestQueue ? (
                          <>
                            <div className="text-3xl font-black tracking-wide">
                              {latestQueue.queue_number}
                            </div>
                            <div
                              className={cn(
                                "text-xs",
                                isActive ? "text-gray-400" : "text-gray-500"
                              )}
                            >
                              {latestQueue.called_at &&
                                new Date(latestQueue.called_at).toLocaleTimeString(
                                  "id-ID",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl text-gray-300">---</div>
                        )}
                      </div>

                      {/* Counter Statistics */}
                      <div
                        className={cn(
                          "px-2 py-1.5 border-t flex-shrink-0",
                          isActive ? "border-gray-700" : "border-gray-200"
                        )}
                      >
                        <div className="flex justify-between text-xs">
                          <div className="text-center">
                            <div
                              className={cn(
                                "font-bold",
                                isActive ? "text-white" : "text-gray-900"
                              )}
                            >
                              {counterWaiting}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                isActive ? "text-gray-500" : "text-gray-400"
                              )}
                            >
                              Tunggu
                            </div>
                          </div>
                          <div className="text-center">
                            <div
                              className={cn(
                                "font-bold",
                                isActive ? "text-white" : "text-gray-900"
                              )}
                            >
                              {counterServing}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                isActive ? "text-gray-500" : "text-gray-400"
                              )}
                            >
                              Layani
                            </div>
                          </div>
                        </div>
                      </div>
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
      <div className="border-t-2 border-gray-200 py-2 px-6 text-center bg-gray-50 flex-shrink-0">
        <p className="text-gray-500 text-xs">
          Perhatikan nomor antrean Anda pada layar di atas
        </p>
      </div>
    </div>
  );
}
