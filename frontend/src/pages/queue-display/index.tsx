import { useEffect, useState, useCallback } from "react";
import type { Queue } from "@/lib/api/queue";
import type { Counter } from "@/lib/api/counters";
import type { RoomQueue } from "@/lib/api/room-queues";
import type { Room } from "@/lib/api/rooms";
import { api, settingsApi } from "@/lib/api";
import { billingApi, type CashierDisplayQueueItem } from "@/lib/api/billing";
import {
  DisplayMediaPanel,
  DisplayRunningTextTicker,
} from "@/components/queue-display/display-media-panel";
import { Users, Clock, CheckCircle, Building2, ClipboardList, Receipt } from "lucide-react";
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
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
      <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
      <span>{label}</span>
      <span className="text-sm font-bold text-slate-900 tabular-nums">{value}</span>
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
  const [displayVideoUrl, setDisplayVideoUrl] = useState("");
  const [displayAdsRaw, setDisplayAdsRaw] = useState("");
  const [displayRunningText, setDisplayRunningText] = useState("");
  const [cashierCurrent, setCashierCurrent] = useState<CashierDisplayQueueItem | null>(null);
  const [cashierWaitingCount, setCashierWaitingCount] = useState(0);
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
      const response = await api.get<{ data: Queue[] }>("/public/queues", {
        params: { date: today },
      });
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
      const [roomRes, cashierRes] = await Promise.all([
        api.get<RoomQueue[]>("/public/room-queues", {
          params: { date: today },
        }),
        billingApi.getCashierDisplay(today).catch(() => null),
      ]);
      const allData = Array.isArray(roomRes.data) ? roomRes.data : [];
      setRoomQueues(
        allData.filter((q) => q.status === "called" || q.status === "serving")
      );
      setAllRoomQueues(allData);

      if (cashierRes?.data) {
        setCashierCurrent(cashierRes.data.current || null);
        setCashierWaitingCount(cashierRes.data.stats?.waiting || 0);
      }
    } catch (error) {
      console.error("Failed to load room queues:", error);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_logo) setAppLogo(settings.app_logo);
        if (settings.app_subtitle) setHospitalName(settings.app_subtitle);
        if (settings.display_video_url !== undefined) setDisplayVideoUrl(settings.display_video_url);
        if (settings.display_ads !== undefined) setDisplayAdsRaw(settings.display_ads);
        if (settings.display_running_text !== undefined) setDisplayRunningText(settings.display_running_text);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    const loadRooms = async () => {
      try {
        const response = await api.get<{ data: Room[] }>("/public/rooms", {
          params: { is_active: "true", limit: 100 },
        });
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
        const response = await api.get<{ data: Counter[] }>("/public/counters/open");
        const data = response.data.data || [];
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
            <div className="truncate text-2xl font-extrabold tracking-tight text-slate-900">{appName}</div>
            <div className="truncate text-xs font-medium text-slate-500">{hospitalName}</div>
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

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex min-w-0 flex-1 gap-4">
          {showRooms && (
            <div
              className={cn(
                "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                showCounters ? "w-1/2" : "w-full"
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-5 w-5 text-sky-600" />
                  <span className="text-base font-extrabold uppercase tracking-wider text-slate-900">
                    Antrean Poli
                  </span>
                </div>
                <div className="hidden xl:flex items-center gap-4">
                  <InlineStat icon={Users} label="Total" value={roomTotalQueues} />
                  <InlineStat icon={Clock} label="Tunggu" value={roomWaitingQueues} iconClassName="text-amber-600" />
                  <InlineStat icon={Building2} label="Layani" value={roomServingQueues} iconClassName="text-sky-600" />
                  <InlineStat icon={CheckCircle} label="Selesai" value={roomCompletedQueues} iconClassName="text-emerald-600" />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
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
                      <div
                        key={room.id}
                        className={cn(
                          "flex h-[176px] flex-col overflow-hidden rounded-xl border transition-colors",
                          latestQueue
                            ? "border-sky-300 bg-sky-50/40"
                            : "border-slate-200 bg-slate-50/50"
                        )}
                      >
                        <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-slate-900">{room.name}</div>
                          </div>
                          {latestQueue?.is_mjkn && (
                            <div className="ml-2 shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                              MJKN
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
                          {latestQueue ? (
                            <>
                              <div className="font-mono text-4xl xl:text-5xl font-black leading-none tracking-[0.06em] text-sky-700">
                                {latestQueue.queue_number}
                              </div>
                              <div className="mt-2 font-mono text-[11px] text-slate-500">
                                {latestQueue.called_at &&
                                  new Date(latestQueue.called_at).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-400">Belum ada panggilan</div>
                          )}
                        </div>

                        <div className="border-t border-slate-200 bg-white/70 px-3 py-1.5 text-center text-[11px] font-medium text-slate-600">
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
            <div
              className={cn(
                "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                showRooms ? "w-1/2" : "w-full"
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                  <span className="text-base font-extrabold uppercase tracking-wider text-slate-900">
                    Antrean Pendaftaran
                  </span>
                </div>
                <div className="hidden xl:flex items-center gap-4">
                  <InlineStat icon={Users} label="Total" value={regTotalQueues} />
                  <InlineStat icon={Clock} label="Tunggu" value={regWaitingQueues} iconClassName="text-amber-600" />
                  <InlineStat icon={ClipboardList} label="Layani" value={regServingQueues} iconClassName="text-emerald-600" />
                  <InlineStat icon={CheckCircle} label="Selesai" value={regCompletedQueues} iconClassName="text-emerald-600" />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
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
                      <div
                        key={counter.id}
                        className={cn(
                          "flex h-[176px] flex-col overflow-hidden rounded-xl border transition-colors",
                          latestQueue
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-slate-200 bg-slate-50/50"
                        )}
                      >
                        <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-slate-900">{counter.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{counter.code}</div>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
                          {latestQueue ? (
                            <>
                              <div className="font-mono text-4xl xl:text-5xl font-black leading-none tracking-[0.06em] text-emerald-700">
                                {latestQueue.queue_number}
                              </div>
                              <div className="mt-2 font-mono text-[11px] text-slate-500">
                                {latestQueue.called_at &&
                                  new Date(latestQueue.called_at).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-400">Belum ada panggilan</div>
                          )}
                        </div>

                        <div className="border-t border-slate-200 bg-white/70 px-3 py-1.5 text-center text-[11px] font-medium text-slate-600">
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

        {/* Right Column: Live Kasir Call + Video & Ads */}
        <div className="hidden lg:flex w-[330px] xl:w-[370px] shrink-0 flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between overflow-hidden rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                <Receipt className="h-3.5 w-3.5" />
                <span>Panggilan Kasir</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-slate-700">
                {cashierCurrent ? cashierCurrent.patient_name : "Belum ada panggilan"}
              </div>
              <div className="text-[10px] text-slate-500">
                {cashierWaitingCount > 0 ? `${cashierWaitingCount} menunggu bayar` : "Kasir siap melayani"}
              </div>
            </div>
            <div className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 px-3.5 py-2 font-mono text-2xl font-black text-white shadow">
              {cashierCurrent ? cashierCurrent.queue_number : "-"}
            </div>
          </div>

          <DisplayMediaPanel
            videoUrl={displayVideoUrl}
            adsRaw={displayAdsRaw}
            hospitalName={appName}
            hospitalSubtitle={hospitalName}
            appLogo={appLogo}
            baseUrl={BASE_URL}
            compact
            className="flex-1 min-h-0"
          />
        </div>
      </div>

      <DisplayRunningTextTicker text={displayRunningText} hospitalName={appName} />
    </div>
  );
}
