import { useEffect, useState } from "react";
import { counterApi, type Counter } from "@/lib/api/counters";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { settingsApi } from "@/lib/api";
import { Monitor, Tv, ArrowRight, Loader2, Volume2, VolumeX, Building2, ClipboardList, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QueueDisplayNavigation() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Selection state
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<number[]>([]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
        // Select all by default
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
        // Select all by default
        setSelectedRooms(roomsData.map((r) => r.id));
      } catch (error) {
        console.error("Failed to load rooms:", error);
      }
    };

    Promise.all([loadCounters(), loadRooms()]).finally(() => setLoading(false));
  }, []);

  // Toggle room selection
  const toggleRoom = (roomId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  // Toggle counter selection
  const toggleCounter = (counterId: number) => {
    setSelectedCounters((prev) =>
      prev.includes(counterId) ? prev.filter((id) => id !== counterId) : [...prev, counterId]
    );
  };

  // Toggle all rooms
  const toggleAllRooms = () => {
    if (selectedRooms.length === rooms.length) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(rooms.map((r) => r.id));
    }
  };

  // Toggle all counters
  const toggleAllCounters = () => {
    if (selectedCounters.length === counters.length) {
      setSelectedCounters([]);
    } else {
      setSelectedCounters(counters.map((c) => c.id));
    }
  };

  const openMainDisplay = () => {
    // Save selections to localStorage before opening
    localStorage.setItem("queueDisplay_selectedRooms", JSON.stringify(selectedRooms));
    localStorage.setItem("queueDisplay_selectedCounters", JSON.stringify(selectedCounters));
    window.open("/queue-display/main", "_blank");
  };

  const openCounterDisplay = (counterId: number) => {
    window.open(`/queue-display/counter/${counterId}`, "_blank");
  };

  const allRoomsSelected = rooms.length > 0 && selectedRooms.length === rooms.length;
  const someRoomsSelected = selectedRooms.length > 0 && selectedRooms.length < rooms.length;
  const allCountersSelected = counters.length > 0 && selectedCounters.length === counters.length;
  const someCountersSelected = selectedCounters.length > 0 && selectedCounters.length < counters.length;

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-black text-white py-4 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{hospitalName}</h1>
            <p className="text-gray-400 text-sm uppercase tracking-wider">
              Navigasi Display Antrean
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="text-gray-400 text-sm">
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
      <div className="flex-1 flex flex-col p-6 overflow-hidden gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Memuat data...</span>
          </div>
        ) : (
          <>
            {/* Two Column Layout for Selection */}
            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Left Column - Room Selection */}
              <div className="w-1/2 flex flex-col border-2 border-gray-300 overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 flex items-center justify-between border-b border-gray-300 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">Pilih Ruangan Poli</h2>
                    <span className="text-sm text-gray-500">({selectedRooms.length}/{rooms.length})</span>
                  </div>
                  <button
                    onClick={toggleAllRooms}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-2 transition-all",
                      allRoomsSelected
                        ? "bg-black text-white border-black"
                        : someRoomsSelected
                        ? "bg-gray-200 text-gray-700 border-gray-400"
                        : "bg-white text-gray-700 border-gray-300 hover:border-black"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 border-2 flex items-center justify-center",
                        allRoomsSelected
                          ? "bg-white border-white"
                          : someRoomsSelected
                          ? "bg-gray-600 border-gray-600"
                          : "border-gray-400"
                      )}
                    >
                      {(allRoomsSelected || someRoomsSelected) && (
                        <Check className={cn("h-3 w-3", allRoomsSelected ? "text-black" : "text-white")} />
                      )}
                    </div>
                    Pilih Semua
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-auto">
                  {rooms.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">Tidak ada ruangan yang tersedia</p>
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
                              "border-2 p-3 text-left transition-all relative",
                              isSelected
                                ? "border-black bg-black text-white"
                                : "border-gray-200 bg-white hover:border-gray-400"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-2 right-2 h-5 w-5 border-2 flex items-center justify-center",
                                isSelected ? "bg-white border-white" : "border-gray-300"
                              )}
                            >
                              {isSelected && <Check className="h-4 w-4 text-black" />}
                            </div>
                            <div
                              className={cn(
                                "text-lg font-black pr-6",
                                isSelected ? "text-white" : "text-gray-900"
                              )}
                            >
                              {room.queue_code || room.code}
                            </div>
                            <div
                              className={cn(
                                "text-xs truncate mt-1",
                                isSelected ? "text-gray-300" : "text-gray-500"
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

              {/* Right Column - Counter Selection */}
              <div className="w-1/2 flex flex-col border-2 border-gray-300 overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 flex items-center justify-between border-b border-gray-300 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">Pilih Loket Pendaftaran</h2>
                    <span className="text-sm text-gray-500">({selectedCounters.length}/{counters.length})</span>
                  </div>
                  <button
                    onClick={toggleAllCounters}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-2 transition-all",
                      allCountersSelected
                        ? "bg-black text-white border-black"
                        : someCountersSelected
                        ? "bg-gray-200 text-gray-700 border-gray-400"
                        : "bg-white text-gray-700 border-gray-300 hover:border-black"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 border-2 flex items-center justify-center",
                        allCountersSelected
                          ? "bg-white border-white"
                          : someCountersSelected
                          ? "bg-gray-600 border-gray-600"
                          : "border-gray-400"
                      )}
                    >
                      {(allCountersSelected || someCountersSelected) && (
                        <Check className={cn("h-3 w-3", allCountersSelected ? "text-black" : "text-white")} />
                      )}
                    </div>
                    Pilih Semua
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-auto">
                  {counters.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">Tidak ada loket yang tersedia</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {counters.map((counter) => {
                        const isSelected = selectedCounters.includes(counter.id);
                        return (
                          <button
                            key={counter.id}
                            onClick={() => toggleCounter(counter.id)}
                            className={cn(
                              "border-2 p-3 text-left transition-all relative",
                              isSelected
                                ? "border-black bg-black text-white"
                                : "border-gray-200 bg-white hover:border-gray-400"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-2 right-2 h-5 w-5 border-2 flex items-center justify-center",
                                isSelected ? "bg-white border-white" : "border-gray-300"
                              )}
                            >
                              {isSelected && <Check className="h-4 w-4 text-black" />}
                            </div>
                            <div
                              className={cn(
                                "text-lg font-black pr-6",
                                isSelected ? "text-white" : "text-gray-900"
                              )}
                            >
                              {counter.code}
                            </div>
                            <div
                              className={cn(
                                "text-xs truncate mt-1",
                                isSelected ? "text-gray-300" : "text-gray-500"
                              )}
                            >
                              {counter.name}
                            </div>
                            {counter.location && (
                              <div
                                className={cn(
                                  "text-[10px] truncate",
                                  isSelected ? "text-gray-400" : "text-gray-400"
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

            {/* Action Button */}
            <div className="flex-shrink-0 border-2 border-black">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Tv className="h-5 w-5 text-gray-600" />
                    <span className="font-medium">Display Utama (Lobby)</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <VolumeX className="h-4 w-4" />
                      <span>Tanpa Suara</span>
                    </div>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>Ruangan: {selectedRooms.length} dipilih</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>Loket: {selectedCounters.length} dipilih</span>
                  </div>
                </div>
                <button
                  onClick={openMainDisplay}
                  disabled={selectedRooms.length === 0 && selectedCounters.length === 0}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 font-medium transition-colors",
                    selectedRooms.length === 0 && selectedCounters.length === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-black text-white hover:bg-gray-800"
                  )}
                >
                  Buka Display Utama
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Counter Display Section */}
            <div className="flex-shrink-0 border-2 border-gray-300">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b border-gray-300">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-gray-700" />
                  <h2 className="font-bold text-gray-900">Display Per Loket (Dengan Suara)</h2>
                </div>
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Volume2 className="h-4 w-4" />
                  <span>Dengan Suara Pengumuman</span>
                </div>
              </div>
              <div className="p-3 overflow-auto max-h-32">
                {counters.length === 0 ? (
                  <p className="text-gray-400 text-center py-2">Tidak ada loket</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {counters.map((counter) => (
                      <button
                        key={counter.id}
                        onClick={() => openCounterDisplay(counter.id)}
                        className="flex items-center gap-2 border-2 border-gray-200 px-3 py-2 hover:border-black transition-all group"
                      >
                        <span className="font-black text-gray-900 group-hover:text-black">
                          {counter.code}
                        </span>
                        <span className="text-sm text-gray-500">{counter.name}</span>
                        <Volume2 className="h-3 w-3 text-gray-300 group-hover:text-black" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-gray-200 py-3 px-6 text-center bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Tv className="h-4 w-4" />
            <span>Display Utama = Tanpa suara, untuk lobby</span>
          </div>
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span>Display Per Loket = Dengan suara pengumuman</span>
          </div>
        </div>
      </div>
    </div>
  );
}
