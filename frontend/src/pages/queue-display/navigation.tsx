import { useEffect, useState } from "react";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import {
  Monitor,
  Tv,
  ArrowRight,
  Loader2,
  Volume2,
  VolumeX,
  Building2,
  ClipboardList,
  Check,
  Settings2,
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

  // Selection state
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
    loadSettings();

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
        const response = await roomsApi.getAll({
          is_active: "true",
          limit: 100,
        });
        const roomsData = response.data.data || [];
        setRooms(roomsData);
        setSelectedRooms(roomsData.map((r: Room) => r.id));
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };

    Promise.all([loadCounters(), loadRooms()]).finally(() => setLoading(false));
  }, []);

  const toggleRoom = (roomId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
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
    if (selectedRooms.length === rooms.length) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(rooms.map((r) => r.id));
    }
  };

  const toggleAllCounters = () => {
    if (selectedCounters.length === counters.length) {
      setSelectedCounters([]);
    } else {
      setSelectedCounters(counters.map((c) => c.id));
    }
  };

  const openMainDisplay = () => {
    localStorage.setItem(
      "queueDisplay_selectedRooms",
      JSON.stringify(selectedRooms)
    );
    localStorage.setItem(
      "queueDisplay_selectedCounters",
      JSON.stringify(selectedCounters)
    );
    window.open("/queue-display/main", "_blank");
  };

  const openCounterDisplay = (counterId: number) => {
    window.open(`/queue-display/counter/${counterId}`, "_blank");
  };

  const allRoomsSelected =
    rooms.length > 0 && selectedRooms.length === rooms.length;
  const someRoomsSelected =
    selectedRooms.length > 0 && selectedRooms.length < rooms.length;
  const allCountersSelected =
    counters.length > 0 && selectedCounters.length === counters.length;
  const someCountersSelected =
    selectedCounters.length > 0 &&
    selectedCounters.length < counters.length;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-100 to-gray-50 flex flex-col select-none">
      {/* Header */}
      <div className="bg-white shadow-sm py-3 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {appLogo && (
              <img
                src={`${BASE_URL}${appLogo}`}
                alt="Logo"
                className="h-10 w-10 object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{appName}</h1>
              {appSubtitle && (
                <p className="text-gray-400 text-xs">{appSubtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                Pengaturan Display Antrean
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-900 leading-tight">
                {currentTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-gray-400 text-xs">
                {currentTime.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            <span className="ml-3 text-gray-400">Memuat data...</span>
          </div>
        ) : (
          <>
            {/* Two Column Selection */}
            <div className="flex-1 flex gap-3 overflow-hidden">
              {/* Left - Room Selection */}
              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <h2 className="font-bold text-gray-900">Ruangan Poli</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {selectedRooms.length}/{rooms.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllRooms}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all",
                      allRoomsSelected
                        ? "bg-gray-900 text-white"
                        : someRoomsSelected
                          ? "bg-gray-200 text-gray-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center",
                        allRoomsSelected
                          ? "bg-white border-white"
                          : someRoomsSelected
                            ? "bg-gray-500 border-gray-500"
                            : "border-gray-300"
                      )}
                    >
                      {(allRoomsSelected || someRoomsSelected) && (
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            allRoomsSelected ? "text-gray-900" : "text-white"
                          )}
                        />
                      )}
                    </div>
                    Pilih Semua
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-auto">
                  {rooms.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400 text-sm">
                        Tidak ada ruangan tersedia
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {rooms.map((room) => {
                        const isSelected = selectedRooms.includes(room.id);
                        return (
                          <button
                            key={room.id}
                            onClick={() => toggleRoom(room.id)}
                            className={cn(
                              "rounded-lg border p-2.5 text-left transition-all relative",
                              isSelected
                                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-2 right-2 h-4 w-4 rounded border flex items-center justify-center",
                                isSelected
                                  ? "bg-blue-500 border-blue-500"
                                  : "border-gray-300"
                              )}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div
                              className={cn(
                                "text-sm font-bold pr-5",
                                isSelected ? "text-blue-700" : "text-gray-900"
                              )}
                            >
                              {room.queue_code || room.code}
                            </div>
                            <div
                              className={cn(
                                "text-xs truncate mt-0.5",
                                isSelected ? "text-blue-500" : "text-gray-400"
                              )}
                            >
                              {room.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right - Counter Selection */}
              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-emerald-500" />
                    <h2 className="font-bold text-gray-900">
                      Loket Pendaftaran
                    </h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {selectedCounters.length}/{counters.length}
                    </span>
                  </div>
                  <button
                    onClick={toggleAllCounters}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all",
                      allCountersSelected
                        ? "bg-gray-900 text-white"
                        : someCountersSelected
                          ? "bg-gray-200 text-gray-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center",
                        allCountersSelected
                          ? "bg-white border-white"
                          : someCountersSelected
                            ? "bg-gray-500 border-gray-500"
                            : "border-gray-300"
                      )}
                    >
                      {(allCountersSelected || someCountersSelected) && (
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            allCountersSelected
                              ? "text-gray-900"
                              : "text-white"
                          )}
                        />
                      )}
                    </div>
                    Pilih Semua
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-auto">
                  {counters.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400 text-sm">
                        Tidak ada loket tersedia
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {counters.map((counter) => {
                        const isSelected = selectedCounters.includes(
                          counter.id
                        );
                        return (
                          <button
                            key={counter.id}
                            onClick={() => toggleCounter(counter.id)}
                            className={cn(
                              "rounded-lg border p-2.5 text-left transition-all relative",
                              isSelected
                                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-2 right-2 h-4 w-4 rounded border flex items-center justify-center",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "border-gray-300"
                              )}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div
                              className={cn(
                                "text-sm font-bold pr-5",
                                isSelected
                                  ? "text-emerald-700"
                                  : "text-gray-900"
                              )}
                            >
                              {counter.code}
                            </div>
                            <div
                              className={cn(
                                "text-xs truncate mt-0.5",
                                isSelected
                                  ? "text-emerald-500"
                                  : "text-gray-400"
                              )}
                            >
                              {counter.name}
                            </div>
                            {counter.location && (
                              <div
                                className={cn(
                                  "text-[10px] truncate",
                                  isSelected
                                    ? "text-emerald-400"
                                    : "text-gray-300"
                                )}
                              >
                                {counter.location}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 flex gap-3">
              {/* Main Display Button */}
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
                      <Tv className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        Display Utama (Lobby)
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <VolumeX className="h-3 w-3" />
                          Tanpa suara
                        </span>
                        <span>
                          {selectedRooms.length} ruangan &bull;{" "}
                          {selectedCounters.length} loket
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={openMainDisplay}
                    disabled={
                      selectedRooms.length === 0 &&
                      selectedCounters.length === 0
                    }
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all text-sm",
                      selectedRooms.length === 0 &&
                        selectedCounters.length === 0
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-700 active:scale-95"
                    )}
                  >
                    Buka Display
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Per-Room & Per-Counter Displays */}
            <div className="flex-shrink-0 flex gap-3">
              {/* Per-Room Displays */}
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <h2 className="font-bold text-sm text-gray-900">
                      Display Per Ruangan
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Volume2 className="h-3 w-3" />
                    <span>Dengan suara pengumuman</span>
                  </div>
                </div>
                <div className="p-3 overflow-auto max-h-24">
                  {rooms.length === 0 ? (
                    <p className="text-gray-400 text-xs text-center py-1">
                      Tidak ada ruangan
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() =>
                            window.open(
                              `/room-queue/display/${room.id}`,
                              "_blank"
                            )
                          }
                          className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:shadow-sm transition-all group"
                        >
                          <span className="font-bold text-sm text-gray-900 group-hover:text-blue-700">
                            {room.queue_code || room.code}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[120px]">
                            {room.name}
                          </span>
                          <Volume2 className="h-3 w-3 text-gray-300 group-hover:text-blue-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-Counter Displays */}
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-emerald-500" />
                    <h2 className="font-bold text-sm text-gray-900">
                      Display Per Loket
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Volume2 className="h-3 w-3" />
                    <span>Dengan suara pengumuman</span>
                  </div>
                </div>
                <div className="p-3 overflow-auto max-h-24">
                  {counters.length === 0 ? (
                    <p className="text-gray-400 text-xs text-center py-1">
                      Tidak ada loket
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {counters.map((counter) => (
                        <button
                          key={counter.id}
                          onClick={() => openCounterDisplay(counter.id)}
                          className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-emerald-400 hover:shadow-sm transition-all group"
                        >
                          <span className="font-bold text-sm text-gray-900 group-hover:text-emerald-700">
                            {counter.code}
                          </span>
                          <span className="text-xs text-gray-400">
                            {counter.name}
                          </span>
                          <Volume2 className="h-3 w-3 text-gray-300 group-hover:text-emerald-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="py-2.5 px-6 text-center bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Tv className="h-3 w-3" />
            Display Utama = Tanpa suara, untuk lobby
          </span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="flex items-center gap-1.5">
            <Volume2 className="h-3 w-3" />
            Display Per Ruangan / Loket = Dengan suara pengumuman
          </span>
        </div>
      </div>
    </div>
  );
}
