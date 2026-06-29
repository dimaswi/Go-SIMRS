import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { PatientCompletionModal } from "./patient-completion-modal";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

interface ScanResult {
  type: string;
  reg_id?: number;
  reg_no?: string;
  no_surat_kontrol?: string;
}

export default function CheckInScannerPage() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanActive, setScanActive] = useState(true); // debounce berulang scan

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
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      setScanning(true);
      setScanActive(true);

      // We need to wait for the next render for videoRef to be available
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
        description: "Izinkan akses kamera untuk scan QR code, atau gunakan input manual.",
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
      setScanActive(false); // Cegah scan berulang
      handleScanResult(code.data);
      return;
    }

    animFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [scanActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start scan loop ketika scanning aktif
  useEffect(() => {
    if (scanning && videoRef.current) {
      // Tunggu video siap
      const onPlaying = () => {
        animFrameRef.current = requestAnimationFrame(scanQRCode);
      };
      videoRef.current.addEventListener("playing", onPlaying, { once: true });
      return () => {
        videoRef.current?.removeEventListener("playing", onPlaying);
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
        // Alur BPJS SKDP: check-in via nomor surat kontrol
        await processCheckInBySK(result.no_surat_kontrol);
      } else if (result.reg_id || result.reg_no) {
        // Alur SIMRS: check-in via registration ID
        if (result.reg_id) {
          await processCheckIn(result.reg_id);
        } else if (result.reg_no) {
          // Cari berdasarkan reg_no
          await processCheckInByRegNo(result.reg_no);
        }
      } else {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Valid",
          description: "QR code tidak mengandung data yang dikenali.",
        });
        setScanActive(true);
      }
    } catch {
      // Jika bukan JSON, asumsikan ini adalah teks murni (Kode Booking MJKN atau Reg No)
      const rawText = data.trim();
      if (rawText.length >= 5) {
        await processCheckInByRegNo(rawText);
      } else {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Dikenali",
          description: "Format QR code tidak valid. Pastikan QR code dari sistem SIMRS atau MJKN.",
        });
        setScanActive(true);
      }
    }
  };

  // Check-in via Registration ID (SIMRS Surat Kontrol)
  const processCheckIn = async (registrationId: number) => {
    setLoading(true);
    setCheckInResult(null);
    try {
      const response = await registrationApi.checkIn(registrationId);
      const queueNum = (response.data.data as any).visit?.room_queue?.queue_number || "-";
      setCheckInResult({
        success: true,
        registration: response.data.data as unknown as Registration,
        queueNumber: queueNum,
        message: response.data.message || "Check-in berhasil!",
        requiresAdmission: response.data.requires_admission,
      });
      if (response.data.requires_admission) setIsModalOpen(true);
      toast({ variant: "success", title: "Check-In Berhasil!", description: `Nomor antrian: ${queueNum}` });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Gagal melakukan check-in.";
      setCheckInResult({ success: false, message: errorMsg });
      toast({ variant: "destructive", title: "Check-In Gagal", description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Check-in via Registration Number or Kode Booking MJKN (fallback)
  const processCheckInByRegNo = async (regNo: string) => {
    setLoading(true);
    try {
      // 1. Coba cari berdasarkan Nomor Registrasi SIMRS
      let searchResult = await registrationApi.getAll({ registration_number: regNo, limit: 1 } as any);
      let regs = searchResult.data.data || [];
      let match = regs.find((r: any) => r.registration_number === regNo);

      // 2. Jika tidak ketemu, coba cari berdasarkan Kode Booking MJKN
      if (!match) {
        searchResult = await registrationApi.getAll({ kode_booking: regNo, limit: 1 } as any);
        regs = searchResult.data.data || [];
        if (regs.length > 0) match = regs[0];
      }

      if (match) {
        await processCheckIn(match.id || match.ID || 0);
      } else {
        setCheckInResult({ success: false, message: `Pendaftaran atau Kode Booking "${regNo}" tidak ditemukan.` });
        setLoading(false);
      }
    } catch (error: any) {
      setCheckInResult({ success: false, message: error.response?.data?.error || "Gagal mencari registrasi." });
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
      toast({ variant: "success", title: "Check-In BPJS Berhasil!", description: `Nomor antrian: ${queueNum}` });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Gagal melakukan check-in via Surat Kontrol.";
      setCheckInResult({ success: false, message: errorMsg });
      toast({ variant: "destructive", title: "Check-In Gagal", description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Input manual: bisa Nomor Registrasi atau Nomor Surat Kontrol
  const handleManualCheckIn = async () => {
    const input = manualInput.trim();
    if (!input) {
      toast({ variant: "destructive", title: "Error", description: "Masukkan nomor registrasi atau nomor surat kontrol." });
      return;
    }

    setLoading(true);
    try {
      // Deteksi tipe: SKDP format = 0202S... atau mengandung "K000"
      const isSK = /^\d{4}S\d+K\d+$/.test(input) || input.toUpperCase().includes("S00");
      if (isSK) {
        await processCheckInBySK(input);
      } else {
        // Cari sebagai nomor registrasi
        const searchResult = await registrationApi.getAll({ registration_number: input, limit: 1 } as any);
        const regs = searchResult.data.data || [];
        const match = regs.find((r: any) => r.registration_number === input);
        if (match) {
          await processCheckIn(match.id || match.ID || 0);
        } else {
          setCheckInResult({ success: false, message: `Data dengan nomor '${input}' tidak ditemukan.` });
          setLoading(false);
        }
      }
    } catch (error: any) {
      setCheckInResult({ success: false, message: error.response?.data?.error || "Gagal melakukan check-in." });
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setCheckInResult(null);
    setManualInput("");
    setScanActive(true);
  };

  const patientName =
    checkInResult?.registration?.patient?.nama_lengkap ||
    checkInResult?.registration?.patient?.name ||
    "-";

  return (
    <PageShell>
      <PageHeader
        title="Check-In Pasien"
        description="Scan QR code dari Surat Kontrol, atau masukkan nomor registrasi / surat kontrol secara manual"
      />
      <PageContent>
        <div className="flex-1 w-full flex flex-col min-h-0">
          {loading && !checkInResult ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memproses check-in...</p>
            </div>
          ) : checkInResult ? (
            <div className="max-w-lg mx-auto">
              <div
                className={`rounded-lg border p-5 ${checkInResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  }`}
              >
                {checkInResult.success && (
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-700">Check-In Berhasil</span>
                    {checkInResult.noSuratKontrol && (
                      <Badge variant="outline" className="ml-auto text-xs">BPJS SKDP</Badge>
                    )}
                  </div>
                )}

                {checkInResult.success && checkInResult.registration ? (
                  <div className="space-y-4">
                    {/* Queue Number Display */}
                    <div className="text-center py-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">Nomor Antrian</p>
                      <p className="text-5xl font-bold text-primary">{checkInResult.queueNumber}</p>
                    </div>

                    {checkInResult.requiresAdmission && (
                      <Alert className="bg-yellow-50 border-yellow-400 text-yellow-800">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm font-medium">
                          Anda tercatat sebagai Pasien Baru. Silakan menuju <strong className="font-bold">Loket Pendaftaran (Admisi)</strong> terlebih dahulu untuk melengkapi administrasi sebelum ke ruang Poli.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator />

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{patientName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span>{checkInResult.registration.registration_number}</span>
                      </div>
                      {checkInResult.noSuratKontrol && (
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">SK: {checkInResult.noSuratKontrol}</span>
                        </div>
                      )}
                      {checkInResult.registration.scheduled_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {new Date(checkInResult.registration.scheduled_date).toLocaleDateString("id-ID", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      {checkInResult.registration.destination_room && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{checkInResult.registration.destination_room.name}</span>
                        </div>
                      )}
                      {checkInResult.registration.doctor && (
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" />
                          <span>{checkInResult.registration.doctor.nama_lengkap}</span>
                        </div>
                      )}
                    </div>

                    <Button className="w-full" onClick={resetScanner}>
                      Scan Pasien Berikutnya
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-200 rounded-full animate-ping opacity-75" />
                      <div className="relative bg-red-100 p-5 rounded-full ring-8 ring-white/50 shadow-sm">
                        <AlertTriangle className="h-12 w-12 text-red-600" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 w-full px-2">
                      <h3 className="text-2xl font-bold text-red-700 tracking-tight">Check-In Gagal</h3>
                      <div className="bg-white/60 p-4 rounded-xl border border-red-100 shadow-inner">
                        <p className="text-base font-medium text-red-800">
                          {checkInResult.message}
                        </p>
                      </div>
                    </div>

                    <Button 
                      variant="destructive" 
                      size="lg" 
                      className="w-full h-14 text-lg font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all mt-4" 
                      onClick={resetScanner}
                    >
                      Coba Pindai Ulang
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto w-full h-full flex flex-col pb-4">
              <Tabs defaultValue="scan" orientation="vertical" className="w-full h-full flex flex-row gap-8">
                <TabsList className="flex flex-col h-auto bg-transparent border-0 p-0 shadow-none gap-3 w-64 shrink-0 justify-start mt-0">
                  <TabsTrigger value="scan" onClick={() => setManualInput("")} className="w-full justify-start text-left px-5 py-4 text-base font-semibold rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all border border-transparent data-[state=inactive]:border-border/50 data-[state=inactive]:bg-muted/30 hover:bg-muted/50">
                    <QrCode className="w-6 h-6 mr-3 shrink-0" />
                    Pindai QR Code
                  </TabsTrigger>
                  <TabsTrigger value="manual" onClick={stopCamera} className="w-full justify-start text-left px-5 py-4 text-base font-semibold rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all border border-transparent data-[state=inactive]:border-border/50 data-[state=inactive]:bg-muted/30 hover:bg-muted/50">
                    <Search className="w-6 h-6 mr-3 shrink-0" />
                    Input Manual
                  </TabsTrigger>

                  <div className="mt-8 p-5 rounded-2xl bg-muted/30 border border-border/50 text-sm text-muted-foreground space-y-3">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      Panduan:
                    </p>
                    <ul className="space-y-2 list-disc list-outside ml-4">
                      <li>
                        <strong>SKDP BPJS</strong>: Pindai QR di pojok kanan atas surat
                      </li>
                      <li>
                        <strong>SK SIMRS</strong>: Pindai QR di bagian bawah surat
                      </li>
                      <li>Check-in hanya di hari H</li>
                    </ul>
                  </div>
                </TabsList>

                <div className="flex-1 min-w-0 h-full border rounded-3xl bg-background p-6 lg:p-8 shadow-sm flex flex-col">
                  <TabsContent value="scan" className="flex-1 mt-0 data-[state=active]:flex flex-col min-h-0">
                    <div className="flex flex-col h-full gap-4">
                      <div className="flex items-center gap-2 px-2 shrink-0">
                        <Camera className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">Arahkan QR Code ke Kamera</span>
                        {scanning && (
                          <Badge variant="secondary" className="ml-auto animate-pulse flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20">
                            <ScanLine className="h-3 w-3" />
                            Kamera Aktif
                          </Badge>
                        )}
                      </div>

                      <div className="relative flex-1 bg-black/5 rounded-2xl overflow-hidden border shadow-inner min-h-[240px]">
                        {scanning ? (
                          <>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary/70 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(var(--primary),0.5)]" />
                              </div>
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                            <div className="p-4 bg-background/50 rounded-full shadow-sm">
                              <CameraOff className="h-10 w-10 text-muted-foreground/70" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-foreground/80">Kamera tidak aktif</p>
                              <p className="text-sm mt-1">Klik tombol di bawah untuk mulai memindai</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 mt-2">
                        {scanning ? (
                          <Button variant="destructive" size="lg" className="w-full text-base h-14 rounded-xl shadow-sm" onClick={stopCamera}>
                            <CameraOff className="h-5 w-5 mr-2" />
                            Matikan Kamera
                          </Button>
                        ) : (
                          <Button size="lg" className="w-full text-base h-14 rounded-xl shadow-sm" onClick={startCamera}>
                            <Camera className="h-5 w-5 mr-2" />
                            Aktifkan Kamera &amp; Mulai Pindai
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="flex-1 mt-0 data-[state=active]:flex flex-col min-h-0">
                    <div className="flex flex-col h-full gap-6">
                      <div className="flex items-center gap-2">
                        <Search className="h-6 w-6 text-muted-foreground" />
                        <span className="text-lg font-medium text-muted-foreground">Pencarian Manual</span>
                      </div>

                      <div className="space-y-4 flex-1">
                        <p className="text-sm text-muted-foreground">
                          Masukkan <strong>Nomor Registrasi</strong> (contoh: REG202601050001) atau{" "}
                          <strong>Nomor Surat Kontrol BPJS</strong> (contoh: 0202S0010626K000003)
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            placeholder="Ketik Nomor Registrasi / Surat Kontrol..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
                            className="flex-1 h-14 text-lg px-4 rounded-xl"
                          />
                          <Button onClick={handleManualCheckIn} disabled={loading} size="lg" className="h-14 px-8 text-base rounded-xl">
                            {loading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 mr-2" />
                            )}
                            {!loading && "Cari"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </PageContent>

      {checkInResult?.registration?.patient && (
        <PatientCompletionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patient={checkInResult.registration.patient as any}
          onSuccess={() => {
            setIsModalOpen(false);
            setCheckInResult((prev) => prev ? { ...prev, requiresAdmission: false } : null);
          }}
        />
      )}
    </PageShell>
  );
}
