import { useEffect, useState } from "react";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import {
  Monitor,
  ArrowRight,
  Loader2,
  Volume2,
  VolumeX,
  Building2,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function QueueDisplayNavigation() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState("RUMAH SAKIT");
  const [appSubtitle, setAppSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<number[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) setAppName(settings.app_name);
        if (settings.app_subtitle) setAppSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
        setSelectedCounters(data.map((c) => c.id));
      } catch (error) {
        console.error("Failed to load counters:", error);
      }
    };

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({ is_active: "true", limit: 100 });
        const roomsData = response.data.data || [];
        setRooms(roomsData);
        setSelectedRooms(roomsData.map((r: Room) => r.id));
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };

    void loadSettings();
    Promise.all([loadCounters(), loadRooms()]).finally(() => setLoading(false));
  }, []);

  const toggleRoom = (roomId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const toggleCounter = (counterId: number) => {
    setSelectedCounters((prev) =>
      prev.includes(counterId)
        ? prev.filter((id) => id !== counterId)
        : [...prev, counterId]
    );
  };

  const toggleAllRooms = () => {
    setSelectedRooms((prev) => (prev.length === rooms.length ? [] : rooms.map((r) => r.id)));
  };

  const toggleAllCounters = () => {
    setSelectedCounters((prev) =>
      prev.length === counters.length ? [] : counters.map((c) => c.id)
    );
  };

  const openMainDisplay = () => {
    localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify(selectedRooms));
    localStorage.setItem(
      "queueDisplay_selectedCounters",
      JSON.stringify(selectedCounters)
    );
    window.open("/queue-display/main", "_blank");
  };

  const openCounterDisplay = (counterId: number) => {
    window.open(`/queue-display/counter/${counterId}`, "_blank");
  };

  const allRoomsSelected = rooms.length > 0 && selectedRooms.length === rooms.length;
  const someRoomsSelected = selectedRooms.length > 0 && selectedRooms.length < rooms.length;
  const allCountersSelected = counters.length > 0 && selectedCounters.length === counters.length;
  const someCountersSelected =
    selectedCounters.length > 0 && selectedCounters.length < counters.length;

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
            {appSubtitle && (
              <div className="truncate text-sm text-slate-400">{appSubtitle}</div>
            )}
          </div>
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
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 px-6 py-3 text-sm text-slate-300">
        Pengaturan Display Antrean
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <span className="text-slate-400">Memuat data...</span>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
              <div className="flex w-1/2 min-w-0 flex-col border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-cyan-400" />
                    <span className="text-lg font-bold">Ruangan Poli</span>
                    <span className="text-xs text-slate-400">
                      {selectedRooms.length}/{rooms.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllRooms}
                    className={cn(
                      "border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      allRoomsSelected || someRoomsSelected
                        ? "border-cyan-500 text-cyan-300"
                        : "border-slate-700 text-slate-300"
                    )}
                  >
                    Pilih Semua
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {rooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      return (
                        <button
                          key={room.id}
                          onClick={() => toggleRoom(room.id)}
                          className={cn(
                            "flex min-h-[92px] flex-col justify-between border p-3 text-left transition-colors",
                            isSelected
                              ? "border-cyan-500 bg-slate-950"
                              : "border-slate-800 bg-slate-950 hover:bg-slate-900"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-bold">
                              {room.queue_code || room.code}
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-400" />}
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-2">{room.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex w-1/2 min-w-0 flex-col border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-emerald-400" />
                    <span className="text-lg font-bold">Loket Pendaftaran</span>
                    <span className="text-xs text-slate-400">
                      {selectedCounters.length}/{counters.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllCounters}
                    className={cn(
                      "border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      allCountersSelected || someCountersSelected
                        ? "border-emerald-500 text-emerald-300"
                        : "border-slate-700 text-slate-300"
                    )}
                  >
                    Pilih Semua
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {counters.map((counter) => {
                      const isSelected = selectedCounters.includes(counter.id);
                      return (
                        <button
                          key={counter.id}
                          onClick={() => toggleCounter(counter.id)}
                          className={cn(
                            "flex min-h-[92px] flex-col justify-between border p-3 text-left transition-colors",
                            isSelected
                              ? "border-emerald-500 bg-slate-950"
                              : "border-slate-800 bg-slate-950 hover:bg-slate-900"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-bold">{counter.code}</div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-2">
                            {counter.name}
                            {counter.location ? ` - ${counter.location}` : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="flex items-center justify-between border border-slate-800 bg-slate-900 px-4 py-4">
                <div>
                  <div className="text-lg font-bold">Display Utama</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedRooms.length} ruangan, {selectedCounters.length} loket
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <VolumeX className="h-4 w-4" />
                    Tanpa Suara
                  </span>
                  <button
                    onClick={openMainDisplay}
                    disabled={selectedRooms.length === 0 && selectedCounters.length === 0}
                    className={cn(
                      "inline-flex items-center gap-2 border px-4 py-3 text-sm font-bold",
                      selectedRooms.length === 0 && selectedCounters.length === 0
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-600 text-slate-100 hover:bg-slate-800"
                    )}
                  >
                    Buka Display
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-slate-800 bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-cyan-400" />
                      <span className="font-bold">Display Per Ruangan</span>
                    </div>
                    <Volume2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="max-h-28 overflow-auto p-3">
                    <div className="flex flex-wrap gap-2">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => window.open(`/room-queue/display/${room.id}`, "_blank")}
                          className="border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
                        >
                          {room.queue_code || room.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-800 bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold">Display Per Loket</span>
                    </div>
                    <Volume2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="max-h-28 overflow-auto p-3">
                    <div className="flex flex-wrap gap-2">
                      {counters.map((counter) => (
                        <button
                          key={counter.id}
                          onClick={() => openCounterDisplay(counter.id)}
                          className="border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
                        >
                          {counter.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
