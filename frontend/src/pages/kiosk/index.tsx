import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { queueApi, type Queue } from "@/lib/api/queue";
import { counterApi, type Counter } from "@/lib/api/counters";
import {
  settingsApi,
  roomsApi,
  schedulesApi,
  patientsApi,
  type Room,
  type RoomStaff,
  type Patient,
} from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  Printer,
  Loader2,
  Clock,
  Users,
  ArrowLeft,
  ArrowRight,
  Stethoscope,
  FlaskConical,
  ScanLine,
  ShieldCheck,
  QrCode,
  Maximize2,
  Minimize2,
  Ticket,
  Sparkles,
  Building2,
  UserCheck,
  Delete,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type KioskCategory = "rawat_jalan" | "laboratory" | "radiology";

interface CategoryOption {
  key: KioskCategory;
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  icon: typeof Stethoscope;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  softBg: string;
  ctaBg: string;
}

interface ScheduledAssignedDoctor {
  employee_id: number;
  employee_name: string;
  start_time: string;
  end_time: string;
  max_patients?: number;
  is_scheduled_today: boolean;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: "rawat_jalan",
    title: "Poliklinik / Rawat Jalan",
    subtitle: "Pemeriksaan Poli",
    description:
      "Untuk pasien yang ingin berobat ke Poliklinik (Poli Umum & Spesialis).",
    ctaLabel: "Pilih Poliklinik",
    icon: Stethoscope,
    accentBg: "bg-emerald-600",
    accentText: "text-emerald-700",
    accentBorder: "border-emerald-200 hover:border-emerald-500",
    softBg: "bg-emerald-50",
    ctaBg: "bg-emerald-600 group-hover:bg-emerald-700",
  },
  {
    key: "laboratory",
    title: "Laboratorium Saja",
    subtitle: "Penunjang Lab",
    description:
      "Untuk pasien yang datang khusus pemeriksaan Laboratorium tanpa poli.",
    ctaLabel: "Pilih Laboratorium",
    icon: FlaskConical,
    accentBg: "bg-blue-600",
    accentText: "text-blue-700",
    accentBorder: "border-blue-200 hover:border-blue-500",
    softBg: "bg-blue-50",
    ctaBg: "bg-blue-600 group-hover:bg-blue-700",
  },
  {
    key: "radiology",
    title: "Radiologi Saja",
    subtitle: "Penunjang Radiologi",
    description:
      "Untuk pasien yang datang khusus pemeriksaan Radiologi (Rontgen / USG).",
    ctaLabel: "Pilih Radiologi",
    icon: ScanLine,
    accentBg: "bg-amber-600",
    accentText: "text-amber-700",
    accentBorder: "border-amber-200 hover:border-amber-500",
    softBg: "bg-amber-50",
    ctaBg: "bg-amber-600 group-hover:bg-amber-700",
  },
];

const AUTO_RESET_SECONDS = 12;

const normalizeStr = (val?: string) => (val || "").trim().toLowerCase();

const isLabRoom = (room: Room) =>
  ["laboratorium", "laboratorium_pk", "laboratorium_pa", "lab"].includes(
    normalizeStr(room.room_type)
  );

const isRadiologyRoom = (room: Room) =>
  ["radiologi", "radiology"].includes(normalizeStr(room.room_type));

const filterRoomsByCategory = (rooms: Room[], category: KioskCategory): Room[] => {
  const activeRooms = rooms.filter((r) => r.is_active);
  if (category === "rawat_jalan") {
    return activeRooms.filter((r) => normalizeStr(r.service_type) === "rawat_jalan");
  }
  if (category === "laboratory") {
    return activeRooms.filter(isLabRoom);
  }
  return activeRooms.filter(isRadiologyRoom);
};

const getLocalDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

export default function KioskIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Global & Master data
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [appName, setAppName] = useState(() => localStorage.getItem("appName") || "SIMRS");
  const [appSubtitle, setAppSubtitle] = useState(() => localStorage.getItem("appSubtitle") || "");
  const [appLogo, setAppLogo] = useState(() => localStorage.getItem("appLogo") || "");
  const [brandingReady, setBrandingReady] = useState(() => Boolean(localStorage.getItem("appLogo")));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Flow state: 1. Category -> 2. Room -> 3. NIK + Doctor + Patient Type -> 4. Receipt
  const [step, setStep] = useState<"category" | "room" | "details" | "success">("category");
  const [selectedCategory, setSelectedCategory] = useState<KioskCategory | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);
  const [bpjsWarningOpen, setBpjsWarningOpen] = useState(false);

  // Patient NIK lookup state
  const [nikInput, setNikInput] = useState("");
  const [searchingNik, setSearchingNik] = useState(false);
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [nikChecked, setNikChecked] = useState(false);

  // Room-assigned + scheduled doctors
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorOptions, setDoctorOptions] = useState<ScheduledAssignedDoctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<ScheduledAssignedDoctor | null>(null);
  const [roomClosedToday, setRoomClosedToday] = useState(false);

  // Submission & Ticket Receipt
  const [submitting, setSubmitting] = useState(false);
  const [queueNumber, setQueueNumber] = useState("");
  const [queueId, setQueueId] = useState<number | null>(null);
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_RESET_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore unsupported fullscreen browsers
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data || {};
        if (settings.app_name) {
          setAppName(settings.app_name);
          localStorage.setItem("appName", settings.app_name);
        }
        if (settings.app_subtitle) {
          setAppSubtitle(settings.app_subtitle);
          localStorage.setItem("appSubtitle", settings.app_subtitle);
        }
        if (settings.app_logo) {
          setAppLogo(settings.app_logo);
          localStorage.setItem("appLogo", settings.app_logo);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setBrandingReady(true);
      }
    };

    const loadRooms = async () => {
      try {
        const response = await roomsApi.getAll({ limit: 500, is_active: "true" });
        setAllRooms(response.data.data || []);
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
        setCounters(data);
        setSelectedCounterId((prev) => {
          if (prev && data.some((c) => c.id === prev)) return prev;
          return data.length > 0 ? data[0].id : null;
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal memuat data loket.",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadCounters();
    const interval = setInterval(loadCounters, 5000);
    return () => clearInterval(interval);
  }, [toast]);

  const loadQueues = useCallback(async () => {
    try {
      const today = getLocalDateString();
      const response = await queueApi.getAll({ date: today });
      setAllQueues(response.data.data || []);
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }, []);

  useEffect(() => {
    void loadQueues();
    const interval = setInterval(loadQueues, 5000);
    return () => clearInterval(interval);
  }, [loadQueues]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => clearCountdown, [clearCountdown]);

  const handleReset = useCallback(() => {
    clearCountdown();
    setStep("category");
    setSelectedCategory(null);
    setSelectedRoom(null);
    setNikInput("");
    setFoundPatient(null);
    setNikChecked(false);
    setDoctorOptions([]);
    setSelectedDoctor(null);
    setRoomClosedToday(false);
    setQueueNumber("");
    setQueueId(null);
    setIssuedAt(null);
    setCountdown(AUTO_RESET_SECONDS);
  }, [clearCountdown]);

  const startCountdown = useCallback(() => {
    clearCountdown();
    setCountdown(AUTO_RESET_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown, handleReset]);

  const filteredRooms = useMemo(() => {
    if (!selectedCategory) return [];
    return filterRoomsByCategory(allRooms, selectedCategory);
  }, [allRooms, selectedCategory]);

  const loadRoomDoctors = useCallback(async (room: Room) => {
    setLoadingDoctors(true);
    setDoctorOptions([]);
    setSelectedDoctor(null);
    setRoomClosedToday(false);

    try {
      const today = getLocalDateString();
      const [staffRes, schedRes] = await Promise.all([
        roomsApi.getStaff(room.id),
        schedulesApi.getAvailableDoctorsByDate(room.id, today),
      ]);

      const now = new Date();
      const assignedDoctors = (staffRes.data.data || []).filter((s: RoomStaff) => {
        const isDoctor = normalizeStr(s.employee?.tipe_karyawan) === "dokter";
        const notEnded = !s.end_date || new Date(s.end_date) >= now;
        return isDoctor && notEnded;
      });

      const assignedIdSet = new Set(assignedDoctors.map((s) => s.employee_id));
      const scheduledList = schedRes.data.data || [];
      const isClosed = Boolean(schedRes.data.room_closed);
      setRoomClosedToday(isClosed);

      if (isClosed) {
        setDoctorOptions([]);
        return;
      }

      // Prioritaskan dokter yang TER-ASSIGN ke ruangan DAN MEMILIKI JADWAL hari ini
      let merged: ScheduledAssignedDoctor[] = [];
      if (room.has_schedule) {
        const filteredScheduled =
          assignedIdSet.size > 0
            ? scheduledList.filter((d) => assignedIdSet.has(d.employee_id))
            : scheduledList;

        merged = filteredScheduled.map((d) => ({
          employee_id: d.employee_id,
          employee_name: d.employee_name,
          start_time: d.start_time,
          end_time: d.end_time,
          max_patients: d.max_patients,
          is_scheduled_today: true,
        }));
      } else {
        // Jika ruangan (mis. Lab / Radiologi) tidak memakai jadwal harian, tampilkan dokter yang ter-assign ke ruangan tersebut
        merged = assignedDoctors.map((s) => ({
          employee_id: s.employee_id,
          employee_name: s.employee?.nama_lengkap || `Dokter #${s.employee_id}`,
          start_time: "00:00",
          end_time: "23:59",
          is_scheduled_today: false,
        }));
      }

      // Deduplikasi berdasarkan employee_id bila ada jadwal ganda, tetap mempertahankan semua slot jam jika berbeda
      setDoctorOptions(merged);
      if (merged.length === 1) {
        setSelectedDoctor(merged[0]);
      }
    } catch (error) {
      console.error("Failed to load room doctors/schedules:", error);
      toast({
        variant: "destructive",
        title: "Gagal Memuat Dokter",
        description: "Tidak dapat mengambil jadwal dokter ruangan.",
      });
    } finally {
      setLoadingDoctors(false);
    }
  }, [toast]);

  const handleSelectCategory = (category: KioskCategory) => {
    setSelectedCategory(category);
    setSelectedRoom(null);
    setStep("room");
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setStep("details");
    void loadRoomDoctors(room);
  };

  const lookupPatientByNik = useCallback(async (nik: string) => {
    if (nik.length < 16) {
      setFoundPatient(null);
      setNikChecked(false);
      return;
    }

    setSearchingNik(true);
    try {
      const res = await patientsApi.search(nik, 5);
      const list: Patient[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];
      const exactMatch =
        list.find((p) => (p.nik || "").trim() === nik.trim()) ||
        (list.length > 0 ? list[0] : null);
      setFoundPatient(exactMatch);
      setNikChecked(true);
    } catch {
      setFoundPatient(null);
      setNikChecked(true);
    } finally {
      setSearchingNik(false);
    }
  }, []);

  const handleNikChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    setNikInput(digits);
    if (digits.length === 16) {
      void lookupPatientByNik(digits);
    } else {
      setFoundPatient(null);
      setNikChecked(false);
    }
  };

  const handleNumpadPress = (digit: string) => {
    if (nikInput.length >= 16) return;
    handleNikChange(nikInput + digit);
  };

  const handleNumpadBackspace = () => {
    if (nikInput.length === 0) return;
    handleNikChange(nikInput.slice(0, -1));
  };

  const handleNumpadClear = () => {
    handleNikChange("");
  };

  const handleSubmitQueue = async () => {
    if (submitting || !selectedRoom) return;

    const targetCounterId = selectedCounterId || counters[0]?.id;
    if (!targetCounterId) {
      toast({
        variant: "destructive",
        title: "Loket Tidak Tersedia",
        description: "Belum ada loket pendaftaran yang buka.",
      });
      return;
    }

    if (nikInput.length !== 16) {
      toast({
        variant: "destructive",
        title: "NIK Belum Lengkap",
        description: "Mohon masukkan 16 digit NIK pasien terlebih dahulu.",
      });
      return;
    }

    if (selectedCategory === "rawat_jalan" && doctorOptions.length > 0 && !selectedDoctor) {
      toast({
        variant: "destructive",
        title: "Pilih Dokter",
        description: "Silakan pilih dokter yang sedang bertugas sesuai jadwal.",
      });
      return;
    }

    const noteParts = [
      `Layanan: ${selectedCategoryMeta?.subtitle || selectedCategory}`,
      `Ruangan: ${selectedRoom.name}`,
      selectedDoctor
        ? `Dokter: ${selectedDoctor.employee_name}${selectedDoctor.is_scheduled_today
          ? ` (${selectedDoctor.start_time}-${selectedDoctor.end_time})`
          : ""
        }`
        : null,
      `NIK: ${nikInput}`,
      foundPatient ? `Pasien: ${foundPatient.nama_lengkap} (${foundPatient.no_rm})` : "Status: Pasien Baru / Belum Terverifikasi",
    ].filter(Boolean);

    setSubmitting(true);
    try {
      const response = await queueApi.create({
        queue_type: "general",
        counter_id: targetCounterId,
        notes: noteParts.join(" | "),
      });

      setSelectedCounterId(targetCounterId);
      setQueueNumber(response.data.data.queue_number);
      setQueueId(response.data.data.id);
      setIssuedAt(new Date());
      setStep("success");
      startCountdown();
      void loadQueues();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Mengambil Nomor",
        description:
          error.response?.data?.error || "Terjadi kendala saat membuat nomor antrian.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!queueId) return;
    const apiUrl =
      import.meta.env.VITE_API_URL ||
      `${window.location.protocol}//${window.location.hostname}:8080/api`;
    window.open(`${apiUrl}/print-public/kiosk-ticket/${queueId}`, "_blank");
  };

  const waitingQueues = allQueues.filter((q) => q.status === "waiting").length;
  const servingQueues = allQueues.filter(
    (q) => q.status === "serving" || q.status === "called"
  ).length;
  const activeCalledList = allQueues.filter(
    (q) => q.status === "called" || q.status === "serving"
  );

  const selectedCategoryMeta = CATEGORY_OPTIONS.find(
    (item) => item.key === selectedCategory
  );
  const selectedCounterMeta = counters.find((c) => c.id === selectedCounterId);
  const activeStepNumber =
    step === "category" ? 1 : step === "room" ? 2 : step === "details" ? 3 : 4;

  const canSubmit =
    !submitting &&
    counters.length > 0 &&
    nikInput.length === 16 &&
    !(selectedCategory === "rawat_jalan" && doctorOptions.length > 0 && !selectedDoctor);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-100 text-slate-900 select-none">
      {/* Top Brand Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          {appLogo ? (
            <img
              src={appLogo.startsWith("http") ? appLogo : `${BASE_URL}${appLogo}`}
              alt="Logo"
              className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
            />
          ) : brandingReady ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
              <Ticket className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-slate-100" />
          )}
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold tracking-tight text-slate-900 md:text-lg">
              {appName}
            </div>
            {appSubtitle && (
              <div className="truncate text-[11px] font-medium text-slate-500 md:text-xs">
                {appSubtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Menunggu
              </span>
              <span className="text-sm font-black tabular-nums text-amber-900">
                {waitingQueues}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                Dilayani
              </span>
              <span className="text-sm font-black tabular-nums text-emerald-900">
                {servingQueues}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-black tabular-nums leading-none text-slate-900 md:text-xl">
              {currentTime.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Keluar Fullscreen" : "Layar Penuh"}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-200"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Progress Step Bar */}
      <div className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-1.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
            {[
              { num: 1, label: "Jenis Antrian" },
              { num: 2, label: "Pilih Ruangan" },
              { num: 3, label: "NIK & Dokter" },
              { num: 4, label: "Tiket" },
            ].map((item, idx) => {
              const isActive = activeStepNumber === item.num;
              const isDone = activeStepNumber > item.num;
              return (
                <div key={item.num} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black transition-colors",
                      isActive
                        ? "bg-red-600 text-white shadow-xs"
                        : isDone
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {isDone ? "✓" : item.num}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider sm:text-xs",
                      isActive
                        ? "text-slate-900"
                        : isDone
                          ? "text-emerald-700"
                          : "text-slate-400"
                    )}
                  >
                    {item.label}
                  </span>
                  {idx < 3 && (
                    <span className="hidden text-slate-300 sm:inline">•</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area (Tuned for 17" Touchscreen, scrollable if needed) */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
            <div className="text-base font-bold text-slate-700">
              Menyiapkan layanan kiosk...
            </div>
          </div>
        ) : counters.length === 0 ? (
          <div className="m-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertCircle className="h-9 w-9" />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Loket Pendaftaran Belum Dibuka
            </h2>
            <p className="text-sm text-slate-500">
              Saat ini belum ada loket pendaftaran yang aktif. Silakan hubungi petugas kami.
            </p>
          </div>
        ) : step === "success" ? (
          /* STEP 4: RECEIPT SCREEN */
          <div className="mx-auto my-auto flex w-full max-w-5xl items-center justify-center py-2">
            <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between bg-emerald-600 px-6 py-4 text-white">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-7 w-7" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-90">
                        Nomor Antrian Terbit
                      </div>
                      <div className="text-lg font-black">
                        {selectedCategoryMeta?.title || "Pasien Umum / Asuransi"}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-xl bg-white/20 px-3.5 py-1 text-sm font-black">
                    {selectedCategoryMeta?.subtitle}
                  </span>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center px-5 py-5 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">
                    Nomor Antrian Anda
                  </div>
                  <div className="my-2 font-mono text-6xl font-black leading-none tracking-wider text-slate-950 lg:text-7xl">
                    {queueNumber}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold md:text-sm">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-slate-800">
                      Loket: <strong className="text-red-600">{selectedCounterMeta?.name || "Pendaftaran"}</strong>
                    </span>
                    {selectedRoom && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-emerald-900">
                        Ruangan: {selectedRoom.name}
                      </span>
                    )}
                    {selectedDoctor && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-blue-900">
                        {selectedDoctor.employee_name}
                        {selectedDoctor.is_scheduled_today
                          ? ` (${selectedDoctor.start_time}-${selectedDoctor.end_time})`
                          : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-medium text-slate-500">
                    NIK: <span className="font-mono font-bold text-slate-700">{nikInput}</span>
                    {foundPatient && (
                      <span> — {foundPatient.nama_lengkap} ({foundPatient.no_rm})</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 bg-slate-50 px-6 py-3 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      1 nomor ini berlaku mulai Pendaftaran, Poli, Lab/Radiologi, hingga Farmasi.
                    </span>
                  </div>
                  {issuedAt && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {issuedAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      • {issuedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                      Langkah Selanjutnya
                    </div>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-amber-950 md:text-sm">
                      Silakan cetak tiket dan menunggu panggilan di{" "}
                      <span className="font-bold">
                        {selectedCounterMeta?.name || "Loket Pendaftaran"}
                      </span>{" "}
                      untuk verifikasi data menuju{" "}
                      <span className="font-bold">{selectedRoom?.name}</span>.
                    </p>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>Kembali ke beranda otomatis</span>
                      <span className="font-mono text-sm text-red-600">
                        {countdown} detik
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-red-600 transition-all duration-1000 ease-linear"
                        style={{
                          width: `${(countdown / AUTO_RESET_SECONDS) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-red-600 px-5 py-3.5 text-base font-black text-white shadow-md transition-all hover:bg-red-700 active:scale-[0.98]"
                  >
                    <Printer className="h-5 w-5" />
                    CETAK TIKET SEKARANG
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3 text-sm font-extrabold text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.98]"
                  >
                    SELESAI / AMBIL ANTRIAN BARU
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : step === "details" && selectedRoom ? (
          /* STEP 3: INPUT NIK + PILIH DOKTER TERASSIGN BERDASARKAN JADWAL */
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3.5">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-xs">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setStep("room")}
                  className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-50 px-5 py-3 text-base font-extrabold text-slate-700 hover:bg-slate-200 active:scale-95"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Ganti Ruangan
                </button>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {selectedCategoryMeta?.title}
                  </div>
                  <h1 className="text-xl font-black text-slate-900 md:text-2xl">
                    {selectedRoom.name}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batalkan
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[0.95fr_1.15fr]">
              {/* Left Column: NIK Form + Large Touch Numpad */}
              <div className="flex min-h-0 flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <label className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
                    1. Masukkan NIK Pasien (16 Digit)
                  </label>
                  <div className="mt-1.5 flex gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={nikInput}
                      onChange={(e) => handleNikChange(e.target.value)}
                      placeholder="Masukkan 16 digit NIK..."
                      className="h-14 flex-1 rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 font-mono text-xl font-black tracking-wider text-slate-900 placeholder:text-base placeholder:font-semibold focus:border-red-600 focus:bg-white focus:outline-none md:text-2xl"
                    />
                    <button
                      type="button"
                      disabled={nikInput.length < 16 || searchingNik}
                      onClick={() => void lookupPatientByNik(nikInput)}
                      className="flex h-14 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white disabled:opacity-40 hover:bg-slate-800 active:scale-95 md:text-base"
                    >
                      {searchingNik ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                      Cek NIK
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs md:text-sm">
                    <span className="font-mono font-bold text-slate-500">
                      {nikInput.length}/16 digit
                    </span>
                    {searchingNik ? (
                      <span className="font-bold text-blue-600">Mencari data pasien...</span>
                    ) : foundPatient ? (
                      <span className="font-extrabold text-emerald-700">
                        Pasien Terdaftar: {foundPatient.nama_lengkap} ({foundPatient.no_rm})
                      </span>
                    ) : nikChecked ? (
                      <span className="font-bold text-amber-700">
                        NIK belum terdaftar — dilengkapi di Loket
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Large Touch Numpad (Adapts cleanly between 768p and 1024p) */}
                <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleNumpadPress(digit)}
                      className="min-h-[48px] rounded-2xl border border-slate-200 bg-white text-2xl font-black text-slate-900 shadow-xs transition-transform hover:bg-slate-100 active:scale-95 md:text-3xl"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleNumpadClear}
                    className="min-h-[48px] rounded-2xl border border-slate-200 bg-slate-200 text-sm font-black uppercase tracking-wider text-slate-800 active:scale-95 md:text-base"
                  >
                    Ulang
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadPress("0")}
                    className="min-h-[48px] rounded-2xl border border-slate-200 bg-white text-2xl font-black text-slate-900 shadow-xs transition-transform hover:bg-slate-100 active:scale-95 md:text-3xl"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleNumpadBackspace}
                    className="flex min-h-[48px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 active:scale-95"
                  >
                    <Delete className="h-6 w-6 md:h-7 md:w-7" />
                  </button>
                </div>
              </div>

              {/* Right Column: Doctor Selection by Room Assignment & Today's Schedule + Submit */}
              <div className="flex min-h-0 flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
                      2. Pilih Dokter (Sesuai Tugas &amp; Jadwal Hari Ini)
                    </label>
                    <span className="rounded-full bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-600">
                      {currentTime.toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {loadingDoctors ? (
                    <div className="my-auto flex flex-col items-center justify-center gap-3 py-10">
                      <Loader2 className="h-9 w-9 animate-spin text-red-600" />
                      <span className="text-base font-bold text-slate-500">
                        Memeriksa jadwal dokter ruangan...
                      </span>
                    </div>
                  ) : roomClosedToday ? (
                    <div className="my-auto rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                      <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
                      <div className="mt-2 text-lg font-black text-rose-900">
                        Ruangan Sedang Tutup / Libur Hari Ini
                      </div>
                      <p className="mt-1 text-sm text-rose-700">
                        Silakan pilih ruangan lain atau hubungi petugas pendaftaran.
                      </p>
                    </div>
                  ) : doctorOptions.length === 0 ? (
                    <div className="my-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                      <UserCheck className="mx-auto h-10 w-10 text-amber-600" />
                      <div className="mt-2 text-base font-extrabold text-amber-900">
                        {selectedCategory === "rawat_jalan"
                          ? "Belum ada dokter yang terjadwal & ter-assign ke poli ini hari ini"
                          : "Pemeriksaan penunjang dapat diproses tanpa pilih dokter"}
                      </div>
                      <p className="mt-1.5 text-sm text-amber-800">
                        {selectedCategory === "rawat_jalan"
                          ? "Anda masih dapat melanjutkan ambil nomor untuk konfirmasi ke petugas loket."
                          : "Lanjutkan dengan menekan tombol Ambil Nomor Antrian di bawah."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 grid flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto pr-1">
                      {doctorOptions.map((doc, idx) => {
                        const isPicked =
                          selectedDoctor?.employee_id === doc.employee_id &&
                          selectedDoctor?.start_time === doc.start_time;
                        return (
                          <button
                            key={`${doc.employee_id}-${doc.start_time}-${idx}`}
                            type="button"
                            onClick={() => setSelectedDoctor(doc)}
                            className={cn(
                              "flex items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all active:scale-99",
                              isPicked
                                ? "border-red-600 bg-red-50/70 shadow-sm"
                                : "border-slate-200 bg-slate-50 hover:border-red-300 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className={cn(
                                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                                  isPicked
                                    ? "bg-red-600 text-white"
                                    : "bg-white text-slate-600 border border-slate-200"
                                )}
                              >
                                <UserCheck className="h-7 w-7" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-lg font-black text-slate-900 md:text-xl">
                                  {doc.employee_name}
                                </div>
                                <div className="mt-0.5 text-sm font-semibold text-slate-500">
                                  {doc.is_scheduled_today
                                    ? `Jadwal Praktek: ${doc.start_time} - ${doc.end_time}`
                                    : "Dokter Ditugaskan di Ruangan"}
                                </div>
                              </div>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-4 py-1.5 text-sm font-extrabold",
                                isPicked
                                  ? "bg-red-600 text-white"
                                  : "bg-white text-slate-500 border border-slate-200"
                              )}
                            >
                              {isPicked ? "Dipilih" : "Pilih"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Counter selector if more than 1 counter is open */}
                {counters.length > 1 && (
                  <div>
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Loket Pendaftaran
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {counters.map((counter) => (
                        <button
                          key={counter.id}
                          type="button"
                          onClick={() => setSelectedCounterId(counter.id)}
                          className={cn(
                            "rounded-xl border-2 px-4 py-2 text-sm font-bold transition-colors",
                            selectedCounterId === counter.id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {counter.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canSubmit || roomClosedToday}
                  onClick={handleSubmitQueue}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-6 py-5 text-xl font-black text-white shadow-md transition-all hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Menerbitkan Nomor...
                    </>
                  ) : (
                    <>
                      <Ticket className="h-6 w-6" />
                      AMBIL NOMOR ANTRIAN SEKARANG
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : step === "room" && selectedCategoryMeta ? (
          /* STEP 2: CHOOSE ROOM FROM MASTER RUANGAN */
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("category")}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 md:text-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Langkah 2 • Master Ruangan
                  </div>
                  <h1 className="text-base font-black text-slate-900 md:text-lg">
                    Pilih Ruangan ({selectedCategoryMeta.title})
                  </h1>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {filteredRooms.length} ruangan tersedia
              </span>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="m-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <div className="text-lg font-black text-slate-900">
                  Belum Ada Ruangan Aktif untuk Kategori Ini
                </div>
                <p className="text-sm text-slate-500">
                  Pastikan ruangan aktif tersedia pada Master Ruangan.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleSelectRoom(room)}
                    className="group flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-red-500 hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                        <Building2 className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="my-4">
                      <h2 className="text-lg font-black leading-snug text-slate-900 md:text-xl">
                        {room.name}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">
                        {room.description || "Ruangan Aktif"}
                        {room.has_schedule ? " • Jadwal Dokter" : ""}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-extrabold text-white transition-colors",
                        selectedCategoryMeta.ctaBg
                      )}
                    >
                      <span>Pilih Ruangan Ini</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* STEP 1: CHOOSE QUEUE SERVICE CATEGORY (TUNED FOR 17" TOUCHSCREEN) */
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between gap-2.5">
            {/* Compact Hero Banner */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-red-600 to-rose-600 px-5 py-3 text-white shadow-sm">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-100">
                  Self-Service Kiosk Pendaftaran
                </div>
                <h1 className="mt-0.5 text-lg font-black tracking-tight md:text-xl">
                  Silakan Pilih Jenis Layanan Antrian Anda
                </h1>
              </div>
              <div className="rounded-xl bg-white/15 px-3.5 py-1.5 backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-100">
                  1 Tiket Berlaku Terpadu
                </div>
                <div className="text-xs font-bold text-white">
                  Pendaftaran • Poli • Penunjang • Farmasi
                </div>
              </div>
            </div>

            {/* 4 Cards in 1 Clean Horizontal Row (Fits 768p laptops AND 1280x1024 without clipping) */}
            <div className="my-auto grid min-h-0 w-full flex-1 max-h-[480px] grid-cols-2 gap-3.5 lg:grid-cols-4">
              {CATEGORY_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                const roomCount = filterRoomsByCategory(allRooms, cat.key).length;

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleSelectCategory(cat.key)}
                    className={cn(
                      "group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]",
                      cat.accentBorder
                    )}
                  >
                    <div
                      className={cn("absolute inset-x-0 top-0 h-2", cat.accentBg)}
                    />

                    <div className="mt-1 flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-2xl",
                          cat.softBg,
                          cat.accentText
                        )}
                      >
                        <Icon className="h-7 w-7" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {roomCount} ruangan
                      </span>
                    </div>

                    <div className="my-auto py-2">
                      <div
                        className={cn(
                          "text-xs font-extrabold uppercase tracking-widest",
                          cat.accentText
                        )}
                      >
                        {cat.subtitle}
                      </div>
                      <h2 className="mt-1 text-xl font-black leading-snug text-slate-900 xl:text-2xl">
                        {cat.title}
                      </h2>
                      <p className="mt-1.5 text-sm font-medium leading-snug text-slate-500">
                        {cat.description}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-black text-white shadow-xs transition-colors",
                        cat.ctaBg
                      )}
                    >
                      <span>{cat.ctaLabel}</span>
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                );
              })}

              {/* 4th Card: BPJS Kesehatan -> Triggers Mobile JKN Warning Modal */}
              <button
                type="button"
                onClick={() => setBpjsWarningOpen(true)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-indigo-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-500 hover:shadow-lg active:scale-[0.98]"
              >
                <div className="absolute inset-x-0 top-0 h-2 bg-indigo-600" />

                <div className="mt-1 flex items-start justify-between gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
                    Mobile JKN
                  </span>
                </div>

                <div className="my-auto py-2">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">
                    Peserta JKN-KIS
                  </div>
                  <h2 className="mt-1 text-xl font-black leading-snug text-slate-900 xl:text-2xl">
                    Pasien BPJS Kesehatan
                  </h2>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-slate-500">
                    Peserta BPJS Kesehatan wajib / dianjurkan mengambil antrian via aplikasi Mobile JKN.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-indigo-600 px-4 py-3.5 text-base font-black text-white shadow-xs transition-colors group-hover:bg-indigo-700">
                  <span>Info Mobile JKN</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>

            {/* Bottom Bar: Live Counter Calls + Online Check-In */}
            <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 shadow-2xs">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sedang Dipanggil di Loket Pendaftaran
                  </div>
                  {activeCalledList.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {activeCalledList.slice(0, 3).map((q) => (
                        <span
                          key={q.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-900"
                        >
                          <span className="font-mono text-base font-black">
                            {q.queue_number}
                          </span>
                          <span className="text-emerald-700">
                            • {q.counter?.name || "Loket"}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-sm font-semibold text-slate-600">
                      {counters.length === 1
                        ? `${counters[0].name} siap melayani — pilih jenis antrian di atas`
                        : "Belum ada nomor yang sedang dipanggil saat ini"}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/checkin")}
                className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-800 bg-slate-900 px-5 py-2.5 text-left text-white shadow-2xs transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black uppercase tracking-wide">
                      Check-In MJKN / Scan QR
                    </div>
                    <div className="text-xs font-medium text-slate-300">
                      Sudah daftar online atau punya QR Surat Kontrol?
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-amber-400 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Warning Pasien BPJS -> Cukup Informasi Mobile JKN (ringkas tanpa tombol ramai) */}
      <Dialog open={bpjsWarningOpen} onOpenChange={setBpjsWarningOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-9 w-9" />
          </div>

          <DialogTitle className="mt-4 text-center text-2xl font-black text-slate-900">
            Ambil Antrian di Mobile JKN
          </DialogTitle>

          <DialogDescription className="mt-2 text-center text-base font-medium leading-relaxed text-slate-600">
            Untuk pasien peserta{" "}
            <strong className="font-bold text-slate-900">BPJS Kesehatan</strong>,
            pengambilan nomor antrian silakan dilakukan melalui aplikasi{" "}
            <strong className="font-bold text-blue-700">Mobile JKN</strong> di
            smartphone Anda.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
