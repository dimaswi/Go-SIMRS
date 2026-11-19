import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roomsApi, settingsApi, type Room } from "@/lib/api";
import { DisplayRunningTextTicker } from "@/components/queue-display/display-media-panel";
import {
  BedDouble,
  Building2,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();
const ROOMS_PER_SLIDE = 4;
const SLIDE_INTERVAL_MS = 12000;

const PUBLIC_BED_STATUS: Record<
  string,
  {
    label: string;
    cardClass: string;
    iconWrapClass: string;
    dotClass: string;
  }
> = {
  available: {
    label: "Tersedia",
    cardClass: "border-emerald-300 bg-emerald-50/90 text-emerald-900",
    iconWrapClass: "bg-emerald-500 text-white",
    dotClass: "bg-emerald-500",
  },
  occupied: {
    label: "Terisi",
    cardClass: "border-sky-300 bg-sky-50/90 text-sky-900",
    iconWrapClass: "bg-sky-600 text-white",
    dotClass: "bg-sky-600",
  },
  reserved: {
    label: "Dipesan",
    cardClass: "border-amber-300 bg-amber-50/90 text-amber-900",
    iconWrapClass: "bg-amber-500 text-white",
    dotClass: "bg-amber-500",
  },
  cleaning: {
    label: "Cleaning",
    cardClass: "border-purple-300 bg-purple-50/90 text-purple-900",
    iconWrapClass: "bg-purple-500 text-white",
    dotClass: "bg-purple-500",
  },
  maintenance: {
    label: "Maintenance",
    cardClass: "border-slate-300 bg-slate-100 text-slate-700",
    iconWrapClass: "bg-slate-500 text-white",
    dotClass: "bg-slate-400",
  },
};

const getPublicBedMeta = (status: string) =>
  PUBLIC_BED_STATUS[status] || {
    label: status || "-",
    cardClass: "border-slate-200 bg-white text-slate-800",
    iconWrapClass: "bg-slate-600 text-white",
    dotClass: "bg-slate-400",
  };

export default function PublicRoomMonitoring() {
  const { id: roomId } = useParams<{ id?: string }>();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [masterData, setMasterData] = useState<Record<string, Array<{ code: string; name: string }>>>({});
  const [loading, setLoading] = useState(true);

  const [hospitalName, setHospitalName] = useState("KLINIK / RUMAH SAKIT");
  const [hospitalSubtitle, setHospitalSubtitle] = useState("");
  const [appLogo, setAppLogo] = useState("");
  const [displayRunningText, setDisplayRunningText] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const res = await roomsApi.getPublicBedMonitoring(roomId);
      setRooms(res.data.data || []);
      setMasterData(res.data.master_data || {});
    } catch (error) {
      console.error("Failed to load public bed monitoring:", error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
        if (settings.app_name) setHospitalName(settings.app_name);
        if (settings.app_subtitle) setHospitalSubtitle(settings.app_subtitle);
        if (settings.app_logo) setAppLogo(settings.app_logo);
        if (settings.display_running_text !== undefined) {
          setDisplayRunningText(settings.display_running_text);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    void loadSettings();
    const settingsInterval = setInterval(loadSettings, 30000);
    return () => clearInterval(settingsInterval);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadData();
    const dataInterval = setInterval(() => void loadData(), 15000);
    return () => clearInterval(dataInterval);
  }, [loadData]);

  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const totalSlides = Math.max(1, Math.ceil(rooms.length / ROOMS_PER_SLIDE));

  useEffect(() => {
    setSlideIndex((prev) => (prev >= totalSlides ? 0 : prev));
  }, [totalSlides]);

  useEffect(() => {
    if (totalSlides <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % totalSlides);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [totalSlides]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const getMasterName = (category: string, code?: string) => {
    if (!code) return "-";
    const list = masterData[category] || [];
    return list.find((item) => item.code === code)?.name || code;
  };

  const visibleRooms = useMemo(() => {
    const start = slideIndex * ROOMS_PER_SLIDE;
    return rooms.slice(start, start + ROOMS_PER_SLIDE);
  }, [rooms, slideIndex]);

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let other = 0;

    rooms.forEach((room) => {
      (room.units || []).forEach((unit) => {
        (unit.beds || []).forEach((bed) => {
          total++;
          if (bed.status === "available") available++;
          else if (bed.status === "occupied") occupied++;
          else if (bed.status === "reserved") reserved++;
          else other++;
        });
      });
    });

    const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, available, occupied, reserved, other, occupancyPct };
  }, [rooms]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-50">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
      </div>
    );
  }

  const isMultiRoom = visibleRooms.length > 1;
  const isDenseMultiRoom = visibleRooms.length > 2;

  return (
    <div className="flex h-screen w-screen max-w-full flex-col overflow-hidden bg-slate-50 text-slate-900 select-none">
      {/* Compact Light Clinic Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {appLogo ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1">
                <img
                  src={`${BASE_URL}${appLogo}`}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <BedDouble className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">
                  {hospitalName}
                </h1>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Bed Rawat Inap
                </span>
                {totalSlides > 1 && (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                    Slide {slideIndex + 1}/{totalSlides}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {hospitalSubtitle ? `${hospitalSubtitle} • ` : ""}
                {roomId && rooms[0]
                  ? `Ketersediaan Tempat Tidur: ${rooms[0].name}`
                  : "Informasi Ketersediaan Tempat Tidur Rawat Inap"}
              </p>
            </div>
          </div>

          {/* Inline Live Stats + Clock */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total</div>
                <div className="font-mono text-sm font-black leading-tight text-slate-900">{stats.total}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Tersedia</div>
                <div className="font-mono text-sm font-black leading-tight text-emerald-700">{stats.available}</div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-sky-700">Terisi</div>
                <div className="font-mono text-sm font-black leading-tight text-sky-700">{stats.occupied}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Okupansi</div>
                <div className="font-mono text-sm font-black leading-tight text-amber-700">{stats.occupancyPct}%</div>
              </div>
            </div>

            <div className="text-right tabular-nums pl-2.5 border-l border-slate-200">
              <div className="font-mono text-lg font-extrabold leading-none tracking-tight text-slate-900">
                {format(currentTime, "HH:mm:ss")}
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                {format(currentTime, "EEEE, dd MMM yyyy", { locale: idLocale })}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Non-Scrollable Multi-Ward Adaptive Bed Grid Canvas */}
      <main className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 py-2.5">
        {rooms.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
            <Building2 className="mb-2 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              {roomId
                ? "Ruangan rawat inap tidak ditemukan"
                : "Belum ada ruangan rawat inap aktif dengan tempat tidur"}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "grid flex-1 min-h-0 gap-3 overflow-hidden",
              visibleRooms.length === 1 && "grid-cols-1",
              visibleRooms.length === 2 && "grid-cols-1 lg:grid-cols-2",
              visibleRooms.length >= 3 && "grid-cols-1 md:grid-cols-2 md:grid-rows-2"
            )}
          >
            {visibleRooms.map((room) => {
              const units = room.units || [];
              const roomTotal = units.reduce((acc, u) => acc + (u.beds?.length || 0), 0);
              const roomAvail = units.reduce(
                (acc, u) => acc + (u.beds?.filter((b) => b.status === "available").length || 0),
                0
              );
              const roomOcc = units.reduce(
                (acc, u) => acc + (u.beds?.filter((b) => b.status === "occupied").length || 0),
                0
              );

              return (
                <section
                  key={room.id}
                  className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Compact Room Banner Header */}
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3.5 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="truncate text-xs font-extrabold uppercase tracking-tight text-slate-900 sm:text-sm">
                            {room.name}
                          </h2>
                          {room.room_class && (
                            <Badge variant="outline" className="h-4 rounded border-slate-300 bg-white px-1.5 text-[9px] text-slate-700">
                              {getMasterName("room_class", room.room_class)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-[11px] font-mono">
                      <span className="font-bold text-emerald-700">{roomAvail} Kosong</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-sky-700">{roomOcc} Terisi</span>
                      <span className="text-slate-400">/ {roomTotal}</span>
                    </div>
                  </div>

                  {/* Dense Multi-Column Kamar/Units Grid inside Room */}
                  <div className="flex-1 min-h-0 overflow-hidden p-2.5">
                    {units.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        Belum ada kamar pada ruangan ini.
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "grid h-full content-start gap-2 overflow-hidden",
                          !isMultiRoom
                            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4"
                            : isDenseMultiRoom
                            ? "grid-cols-2 xl:grid-cols-3"
                            : "grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                        )}
                      >
                        {units.map((unit) => {
                          const unitBeds = unit.beds || [];
                          const unitAvailable = unitBeds.filter((b) => b.status === "available").length;

                          return (
                            <div
                              key={unit.id}
                              className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-2"
                            >
                              <div className="mb-1.5 flex items-center justify-between gap-1 border-b border-slate-200/80 pb-1">
                                <div className="flex min-w-0 items-center gap-1">
                                  <span className="truncate text-[11px] font-bold text-slate-800">
                                    {unit.name}
                                  </span>
                                  <span className="shrink-0 rounded bg-white px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-500 border border-slate-200">
                                    Lt.{unit.floor}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                                    unitAvailable > 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-sky-100 text-sky-800"
                                  )}
                                >
                                  {unitAvailable}/{unitBeds.length}
                                </span>
                              </div>

                              {/* Compact Bed Logo Tiles inside Kamar */}
                              <div className="flex flex-wrap gap-1.5">
                                {unitBeds.map((bed) => {
                                  const meta = getPublicBedMeta(bed.status);
                                  return (
                                    <div
                                      key={bed.id}
                                      className={cn(
                                        "flex min-w-[44px] flex-1 max-w-[68px] flex-col items-center justify-center rounded-lg border px-1.5 py-1 text-center",
                                        meta.cardClass
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "flex h-5 w-7 items-center justify-center rounded",
                                          meta.iconWrapClass
                                        )}
                                      >
                                        <BedDouble className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="mt-0.5 w-full truncate font-mono text-[10px] font-black leading-none">
                                        {bed.bed_number}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Compact Legend Strip */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-1.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-700">
          <span className="uppercase tracking-wider text-slate-400">Status Bed:</span>
          {Object.entries(PUBLIC_BED_STATUS).map(([key, item]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", item.dotClass)} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="shrink-0 font-medium text-slate-400">
          Update otomatis 15 detik • Rawat Inap
        </div>
      </div>

      {/* Running Text Ticker */}
      <DisplayRunningTextTicker text={displayRunningText} hospitalName={hospitalName} />
    </div>
  );
}
