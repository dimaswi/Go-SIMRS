import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  User,
  Calendar,
  MapPin,
  Stethoscope,
  Hash,
  ScanLine,
  Printer,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Ticket,
  Sparkles,
  Delete,
} from "lucide-react";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { printApi, settingsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { PatientCompletionModal } from "./patient-completion-modal";
import { cn } from "@/lib/utils";

interface ScanResult {
  type: string;
  reg_id?: number;
  reg_no?: string;
  no_surat_kontrol?: string;
}

const getBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  return apiUrl.replace(/\/api$/, "");
};

const BASE_URL = getBaseUrl();

const MANUAL_KEYBOARD_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "-"],
];
const MANUAL_KEYBOARD_LAST_LETTERS = ["Z", "X", "C", "V", "B", "N", "M"];

export default function CheckInScannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [printingTicket, setPrintingTicket] = useState(false);
  const [scanActive, setScanActive] = useState(true);

  const [appName, setAppName] = useState(() => localStorage.getItem("appName") || "SIMRS");
  const [appSubtitle, setAppSubtitle] = useState(() => localStorage.getItem("appSubtitle") || "");
  const [appLogo, setAppLogo] = useState(() => localStorage.getItem("appLogo") || "");
  const [brandingReady, setBrandingReady] = useState(() => Boolean(localStorage.getItem("appLogo")));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    registration?: Registration;
    queueNumber?: string;
    message: string;
    noSuratKontrol?: string;
    requiresAdmission?: boolean;
  } | null>(null);

  useEffect(() => {
    setPageTitle("Check-In Scanner");
  }, []);

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

    void loadSettings();
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial on unsupported browsers
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      setScanning(true);
      setScanActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      console.error("Camera access denied:", error);
      toast({
        variant: "destructive",
        title: "Akses Kamera Ditolak",
        description:
          "Izinkan akses kamera untuk scan QR code, atau gunakan mode Input Manual.",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setScanning(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, [stream]);

  // QR Scan Loop menggunakan jsQR
  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data && scanActive) {
      setScanActive(false);
      void handleScanResult(code.data);
      return;
    }

    animFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [scanActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scanning && videoRef.current) {
      const videoEl = videoRef.current;
      const onPlaying = () => {
        animFrameRef.current = requestAnimationFrame(scanQRCode);
      };
      videoEl.addEventListener("playing", onPlaying, { once: true });
      return () => {
        videoEl.removeEventListener("playing", onPlaying);
      };
    }
  }, [scanning, scanQRCode]);

  const handleScanResult = async (data: string) => {
    stopCamera();

    try {
      const result: ScanResult = JSON.parse(data);
      if (result.type !== "checkin") {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Valid",
          description: "QR code ini bukan untuk check-in SIMRS.",
        });
        setScanActive(true);
        return;
      }

      if (result.no_surat_kontrol) {
        await processCheckInBySK(result.no_surat_kontrol);
      } else if (result.reg_id) {
        await processCheckIn(result.reg_id);
      } else if (result.reg_no) {
        await processCheckInByRegNo(result.reg_no);
      } else {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Valid",
          description: "QR code tidak mengandung data yang dikenali.",
        });
        setScanActive(true);
      }
    } catch {
      const rawText = data.trim();
      if (rawText.length >= 5) {
        await processCheckInByRegNo(rawText);
      } else {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Dikenali",
          description:
            "Format QR code tidak valid. Pastikan QR code dari sistem SIMRS atau MJKN.",
        });
        setScanActive(true);
      }
    }
  };

  // Check-in via Registration ID
  const processCheckIn = async (registrationId: number) => {
    setLoading(true);
    setCheckInResult(null);
    try {
      const response = await registrationApi.checkIn(registrationId);
      const queueNum =
        (response.data.data as any).visit?.room_queue?.queue_number || "-";
      setCheckInResult({
        success: true,
        registration: response.data.data as unknown as Registration,
        queueNumber: queueNum,
        message: response.data.message || "Check-in berhasil!",
        requiresAdmission: response.data.requires_admission,
      });
      if (response.data.requires_admission) setIsModalOpen(true);
      toast({
        variant: "success",
        title: "Check-In Berhasil!",
        description: `Nomor antrian: ${queueNum}`,
      });
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error || "Gagal melakukan check-in.";
      setCheckInResult({ success: false, message: errorMsg });
      toast({
        variant: "destructive",
        title: "Check-In Gagal",
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // Check-in via Nomor Registrasi SIMRS atau Kode Booking MJKN
  const processCheckInByRegNo = async (regNo: string) => {
    setLoading(true);
    try {
      let searchResult = await registrationApi.getAll({
        registration_number: regNo,
        limit: 1,
      } as any);
      let regs = searchResult.data.data || [];
      let match = regs.find((r: any) => r.registration_number === regNo);

      if (!match) {
        searchResult = await registrationApi.getAll({
          kode_booking: regNo,
          limit: 1,
        } as any);
        regs = searchResult.data.data || [];
        if (regs.length > 0) match = regs[0];
      }

      if (match) {
        await processCheckIn(match.id || match.ID || 0);
      } else {
        setCheckInResult({
          success: false,
          message: `Pendaftaran atau Kode Booking "${regNo}" tidak ditemukan.`,
        });
        setLoading(false);
      }
    } catch (error: any) {
      setCheckInResult({
        success: false,
        message:
          error.response?.data?.error || "Gagal mencari data pendaftaran.",
      });
      setLoading(false);
    }
  };

  // Check-in via Nomor Surat Kontrol BPJS (SKDP)
  const processCheckInBySK = async (noSuratKontrol: string) => {
    setLoading(true);
    setCheckInResult(null);
    try {
      const response = await registrationApi.checkInBySuratKontrol(noSuratKontrol);
      const queueNum = response.data.queue_number || "-";
      setCheckInResult({
        success: true,
        registration: response.data.data as unknown as Registration,
        queueNumber: queueNum,
        noSuratKontrol: response.data.surat_kontrol,
        message: response.data.message || "Check-in berhasil!",
        requiresAdmission: response.data.requires_admission,
      });
      if (response.data.requires_admission) setIsModalOpen(true);
      toast({
        variant: "success",
        title: "Check-In BPJS Berhasil!",
        description: `Nomor antrian: ${queueNum}`,
      });
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        "Gagal melakukan check-in via Surat Kontrol.";
      setCheckInResult({ success: false, message: errorMsg });
      toast({
        variant: "destructive",
        title: "Check-In Gagal",
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async () => {
    const input = manualInput.trim();
    if (!input) {
      toast({
        variant: "destructive",
        title: "Input Kosong",
        description:
          "Masukkan nomor registrasi, kode booking MJKN, atau nomor surat kontrol.",
      });
      return;
    }

    const isSK =
      /^\d{4}S\d+K\d+$/.test(input) || input.toUpperCase().includes("S00");
    if (isSK) {
      await processCheckInBySK(input);
    } else {
      await processCheckInByRegNo(input);
    }
  };

  const resetScanner = () => {
    setCheckInResult(null);
    setManualInput("");
    setScanActive(true);
  };

  const handlePrintCheckInTicket = async () => {
    const reg = checkInResult?.registration as any;
    const roomQueueId = reg?.visit?.room_queue?.id;
    const regId = reg?.ID || reg?.id;
    if (!roomQueueId && !regId) return;

    setPrintingTicket(true);
    try {
      const url = roomQueueId
        ? await printApi.queueTicket(roomQueueId)
        : await printApi.registrationTicket(regId);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal mencetak tiket antrian",
      });
    } finally {
      setPrintingTicket(false);
    }
  };

  const handleBackToKiosk = () => {
    stopCamera();
    navigate("/kiosk");
  };

  const patientName =
    checkInResult?.registration?.patient?.nama_lengkap ||
    checkInResult?.registration?.patient?.name ||
    "-";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-100 text-slate-900 select-none">
      {/* Top Brand Header (Consistent with Kiosk) */}
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

      {/* Main Content (Tuned for 17" Touchscreen) */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2.5">
          {/* Hero Banner */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-red-600 to-rose-600 px-5 py-2.5 text-white shadow-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-100">
                Self-Service Check-In Pasien
              </div>
              <h1 className="mt-0.5 text-lg font-black tracking-tight md:text-xl">
                Scan QR Code atau Masukkan Nomor Booking / Surat Kontrol
              </h1>
            </div>
            <div className="rounded-xl bg-white/15 px-3.5 py-1.5 backdrop-blur-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-100">
                Check-In Hari-H
              </div>
              <div className="text-xs font-bold text-white">
                Mobile JKN • SKDP BPJS • SK SIMRS
              </div>
            </div>
          </div>

          {loading && !checkInResult ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
              <Loader2 className="h-10 w-10 animate-spin text-red-600" />
              <p className="text-base font-bold text-slate-700">
                Memproses check-in pasien...
              </p>
            </div>
          ) : checkInResult ? (
            /* CHECK-IN RESULT SCREEN (Kiosk Receipt Style) */
            <div className="my-auto mx-auto w-full max-w-4xl">
              {checkInResult.success && checkInResult.registration ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* Left: Receipt Card */}
                  <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between bg-emerald-600 px-6 py-4 text-white">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-7 w-7" />
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-90">
                            Check-In Berhasil
                          </div>
                          <div className="text-lg font-black">
                            Antrian Sudah Diaktifkan
                          </div>
                        </div>
                      </div>
                      {checkInResult.noSuratKontrol && (
                        <span className="rounded-xl bg-white/20 px-3 py-1 text-xs font-black">
                          BPJS SKDP
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Nomor Antrian Anda
                      </div>
                      <div className="my-3 font-mono text-7xl font-black leading-none tracking-wider text-slate-950 md:text-8xl">
                        {checkInResult.queueNumber}
                      </div>

                      {checkInResult.requiresAdmission && (
                        <Alert className="mt-3 border-amber-300 bg-amber-50 text-left text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-xs font-semibold leading-relaxed">
                            Pasien tercatat sebagai Pasien Baru. Silakan menuju{" "}
                            <strong>Loket Pendaftaran (Admisi)</strong> terlebih dahulu
                            sebelum ke ruang Poli.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-300 bg-slate-50 px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>
                          1 nomor ini berlaku hingga layanan Penunjang &amp; Farmasi.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Patient Info & Print Actions */}
                  <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                    <div className="space-y-3">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Detail Kunjungan Pasien
                      </div>
                      <Separator />
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-2.5">
                          <User className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="font-bold text-slate-900">{patientName}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Hash className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="font-mono font-semibold text-slate-700">
                            {checkInResult.registration.registration_number}
                          </span>
                        </div>
                        {checkInResult.noSuratKontrol && (
                          <div className="flex items-center gap-2.5">
                            <QrCode className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="font-mono text-xs text-slate-600">
                              SK: {checkInResult.noSuratKontrol}
                            </span>
                          </div>
                        )}
                        {checkInResult.registration.scheduled_date && (
                          <div className="flex items-center gap-2.5">
                            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="text-slate-700">
                              {new Date(
                                checkInResult.registration.scheduled_date
                              ).toLocaleDateString("id-ID", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                        {checkInResult.registration.destination_room && (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="font-semibold text-slate-800">
                              {checkInResult.registration.destination_room.name}
                            </span>
                          </div>
                        )}
                        {checkInResult.registration.doctor && (
                          <div className="flex items-center gap-2.5">
                            <Stethoscope className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="text-slate-700">
                              {checkInResult.registration.doctor.nama_lengkap}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 space-y-2.5">
                      {((checkInResult.registration as any)?.visit?.room_queue?.id ||
                        checkInResult.registration.id ||
                        checkInResult.registration.ID) && (
                        <button
                          type="button"
                          onClick={handlePrintCheckInTicket}
                          disabled={printingTicket}
                          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white shadow-md transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
                        >
                          {printingTicket ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Printer className="h-5 w-5" />
                          )}
                          CETAK TIKET ANTRIAN
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetScanner}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-extrabold text-slate-700 transition-all hover:bg-slate-200"
                      >
                        SCAN / CHECK-IN PASIEN BERIKUTNYA
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Error Card */
                <div className="mx-auto max-w-lg rounded-3xl border-2 border-rose-200 bg-white p-8 text-center shadow-lg">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <AlertTriangle className="h-9 w-9" />
                  </div>
                  <h3 className="mt-4 text-2xl font-black text-rose-700">
                    Check-In Gagal
                  </h3>
                  <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                    {checkInResult.message}
                  </div>
                  <button
                    type="button"
                    onClick={resetScanner}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-4 text-base font-black text-white shadow-sm hover:bg-red-700"
                  >
                    <QrCode className="h-5 w-5" />
                    Coba Pindai / Input Ulang
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* MAIN SCANNER + MANUAL INPUT WORKSPACE */
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[0.75fr_1.25fr]">
              {/* Left Sidebar: Mode Switcher + Guide */}
              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("scan");
                      setManualInput("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all active:scale-[0.98]",
                      mode === "scan"
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                        mode === "scan"
                          ? "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <QrCode className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-lg font-black">Pindai QR Code</div>
                      <div
                        className={cn(
                          "mt-0.5 text-xs font-medium md:text-sm",
                          mode === "scan" ? "text-slate-300" : "text-slate-500"
                        )}
                      >
                        Scan QR Surat Kontrol / Mobile JKN lewat kamera
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setMode("manual");
                    }}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all active:scale-[0.98]",
                      mode === "manual"
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                        mode === "manual"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <Search className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-lg font-black">Input Manual</div>
                      <div
                        className={cn(
                          "mt-0.5 text-xs font-medium md:text-sm",
                          mode === "manual" ? "text-slate-300" : "text-slate-500"
                        )}
                      >
                        Ketik Kode Booking MJKN, No. Registrasi, atau SKDP
                      </div>
                    </div>
                  </button>
                </div>

                {/* Guide Box */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    <QrCode className="h-4 w-4 text-red-600" />
                    Panduan Check-In
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
                    <li>
                      <strong className="text-slate-900">SKDP BPJS:</strong> Pindai QR
                      di pojok kanan atas surat kontrol.
                    </li>
                    <li>
                      <strong className="text-slate-900">SK SIMRS:</strong> Pindai QR di
                      bagian bawah surat kontrol.
                    </li>
                    <li>
                      <strong className="text-slate-900">Mobile JKN:</strong> Scan QR
                      atau ketik Kode Booking pada Input Manual.
                    </li>
                    <li>Check-in hanya berlaku pada hari H kunjungan.</li>
                  </ul>
                </div>
              </div>

              {/* Right Workspace: Camera Scanner OR Manual Entry (17" Touchscreen Friendly) */}
              <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {mode === "scan" ? (
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 md:text-sm">
                        <Camera className="h-4 w-4 text-red-600" />
                        <span>Arahkan QR Code ke Area Kamera</span>
                      </div>
                      {scanning && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 animate-pulse">
                          <ScanLine className="h-3.5 w-3.5" />
                          Kamera Aktif
                        </span>
                      )}
                    </div>

                    <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100">
                      {scanning ? (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative h-48 w-48 md:h-56 md:w-56">
                              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-red-500" />
                              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-red-500" />
                              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-red-500" />
                              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-red-500" />
                              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
                            </div>
                          </div>
                          <canvas ref={canvasRef} className="hidden" />
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs">
                            <CameraOff className="h-8 w-8" />
                          </div>
                          <div>
                            <p className="text-lg font-extrabold text-slate-800">
                              Kamera Belum Aktif
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                              Tekan tombol di bawah untuk mengaktifkan kamera dan memindai QR
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleBackToKiosk}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 px-6 py-4 text-lg font-extrabold text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98]"
                      >
                        <ArrowLeft className="h-5 w-5" />
                        Kembali ke Kiosk
                      </button>

                      {scanning ? (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-slate-900 px-6 py-4 text-lg font-black text-white shadow-sm transition-colors hover:bg-slate-800 active:scale-[0.98]"
                        >
                          <CameraOff className="h-5 w-5" />
                          Matikan Kamera
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-red-600 px-6 py-4 text-lg font-black text-white shadow-md transition-colors hover:bg-red-700 active:scale-[0.98]"
                        >
                          <Camera className="h-5 w-5" />
                          Aktifkan Kamera &amp; Mulai Pindai
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 text-lg font-black text-slate-900">
                        <Search className="h-6 w-6 text-blue-600" />
                        <span>Pencarian &amp; Check-In Manual</span>
                      </div>

                      <p className="text-sm font-medium leading-relaxed text-slate-600">
                        Masukkan <strong className="text-slate-900">Kode Booking MJKN</strong>,{" "}
                        <strong className="text-slate-900">Nomor Registrasi</strong> (mis.{" "}
                        <span className="font-mono text-xs">REG202601050001</span>), atau{" "}
                        <strong className="text-slate-900">Nomor Surat Kontrol BPJS</strong>{" "}
                        (mis. <span className="font-mono text-xs">0202S0010626K000003</span>).
                      </p>

                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleManualCheckIn();
                        }}
                        placeholder="Ketik Kode Booking / No. Registrasi / No. SK..."
                        className="h-16 w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 font-mono text-2xl font-black tracking-wider text-slate-900 placeholder:text-lg placeholder:font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Square-Proportioned Touch Keyboard (No vertical stretching on 1280x1024) */}
                    <div className="my-auto space-y-2.5 rounded-2xl border border-slate-200 bg-slate-100/90 p-3.5">
                      {MANUAL_KEYBOARD_ROWS.map((row, rowIdx) => (
                        <div key={rowIdx} className="grid grid-cols-10 gap-2">
                          {row.map((keyChar) => (
                            <button
                              key={keyChar}
                              type="button"
                              onClick={() => setManualInput((prev) => prev + keyChar)}
                              className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white font-mono text-xl font-black text-slate-900 shadow-xs transition-transform hover:bg-slate-50 active:scale-95"
                            >
                              {keyChar}
                            </button>
                          ))}
                        </div>
                      ))}
                      <div className="grid grid-cols-10 gap-2">
                        {MANUAL_KEYBOARD_LAST_LETTERS.map((keyChar) => (
                          <button
                            key={keyChar}
                            type="button"
                            onClick={() => setManualInput((prev) => prev + keyChar)}
                            className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white font-mono text-xl font-black text-slate-900 shadow-xs transition-transform hover:bg-slate-50 active:scale-95"
                          >
                            {keyChar}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setManualInput((prev) => prev.slice(0, -1))}
                          title="Hapus 1 karakter"
                          className="col-span-2 flex h-14 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-base font-extrabold text-rose-700 transition-transform hover:bg-rose-100 active:scale-95"
                        >
                          <Delete className="h-5 w-5" />
                          <span>Hapus</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualInput("")}
                          title="Kosongkan"
                          className="flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-sm font-extrabold text-slate-800 transition-transform hover:bg-slate-300 active:scale-95"
                        >
                          Ulang
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleBackToKiosk}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 px-6 py-4 text-lg font-extrabold text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98]"
                      >
                        <ArrowLeft className="h-5 w-5" />
                        Kembali ke Kiosk
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleManualCheckIn()}
                        disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-6 py-4 text-lg font-black text-white shadow-md transition-colors hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                        Proses Check-In Sekarang
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {checkInResult?.registration?.patient && (
        <PatientCompletionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patient={checkInResult.registration.patient as any}
          onSuccess={() => {
            setIsModalOpen(false);
            setCheckInResult((prev) =>
              prev ? { ...prev, requiresAdmission: false } : null
            );
          }}
        />
      )}
    </div>
  );
}
