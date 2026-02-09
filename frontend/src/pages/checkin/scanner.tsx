import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";

interface ScanResult {
  type: string;
  reg_id: number;
  reg_no: string;
}

export default function CheckInScannerPage() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    registration?: Registration;
    queueNumber?: string;
    message: string;
  } | null>(null);

  // Set page title on mount
  useEffect(() => {
    setPageTitle("Check-In Scanner");
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setScanning(true);
      // Start scanning loop
      requestAnimationFrame(scanQRCode);
    } catch (error) {
      console.error("Camera access denied:", error);
      toast({
        variant: "destructive",
        title: "Akses Kamera Ditolak",
        description: "Izinkan akses kamera untuk scan QR code, atau gunakan input manual.",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setScanning(false);
  };

  const scanQRCode = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // For actual QR scanning, we would use a library like jsQR or html5-qrcode
    // For now, this is a placeholder - in production, integrate with a QR library
    // Example with jsQR:
    // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // const code = jsQR(imageData.data, imageData.width, imageData.height);
    // if (code) { handleScanResult(code.data); }

    if (scanning) {
      requestAnimationFrame(scanQRCode);
    }
  };

  // Handler for QR scan results - to be used with QR library integration
  const handleScanResult = async (data: string) => {
    stopCamera();
    
    try {
      const result: ScanResult = JSON.parse(data);
      if (result.type === "checkin" && result.reg_id) {
        await processCheckIn(result.reg_id);
      } else {
        toast({
          variant: "destructive",
          title: "QR Code Tidak Valid",
          description: "QR code ini bukan untuk check-in.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "QR Code Tidak Valid",
        description: "Format QR code tidak dikenali.",
      });
    }
  };
  
  // Export for future QR library usage
  void handleScanResult;

  const handleManualCheckIn = async () => {
    if (!manualInput.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Masukkan nomor registrasi.",
      });
      return;
    }

    setLoading(true);
    try {
      // Search for registration by exact registration number
      const searchResult = await registrationApi.getAll({ 
        registration_number: manualInput.trim(),
        limit: 1
      } as any);
      
      // Validate exact match
      const registrations = searchResult.data.data || [];
      const exactMatch = registrations.find(
        (reg: any) => reg.registration_number === manualInput.trim()
      );
      
      if (exactMatch) {
        await processCheckIn(exactMatch.id || exactMatch.ID || 0);
      } else {
        setLoading(false);
        toast({
          variant: "destructive",
          title: "Tidak Ditemukan",
          description: "Nomor registrasi tidak ditemukan. Pastikan nomor yang dimasukkan benar.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencari registrasi.",
      });
    } finally {
      setLoading(false);
    }
  };

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
      });

      toast({
        variant: "success",
        title: "Check-In Berhasil!",
        description: `Nomor antrian: ${queueNum}`,
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Gagal melakukan check-in.";
      setCheckInResult({
        success: false,
        message: errorMsg,
      });

      toast({
        variant: "destructive",
        title: "Check-In Gagal",
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setCheckInResult(null);
    setManualInput("");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 h-full overflow-hidden">
      <div className="rounded-lg border flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0 p-6">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Check-In Pasien
              </h1>
              <p className="text-sm text-muted-foreground">
                Scan QR code atau masukkan nomor registrasi untuk check-in
              </p>
            </div>
        </div>
        <div className="flex-1 overflow-auto py-4 px-6">
          {/* Check-in Result */}
          {checkInResult ? (
            <div className="max-w-lg mx-auto">
              <div className={`rounded-lg border p-4 ${checkInResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
                <div className="flex items-center gap-2 mb-4">
                  {checkInResult.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-700">Check-In Berhasil</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-700">Check-In Gagal</span>
                    </>
                  )}
                </div>

                {checkInResult.success && checkInResult.registration ? (
                  <div className="space-y-4">
                    {/* Queue Number Display */}
                    <div className="text-center py-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">Nomor Antrian</p>
                      <p className="text-4xl font-bold text-primary">{checkInResult.queueNumber}</p>
                    </div>

                    <Separator />

                    {/* Patient Info */}
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{checkInResult.registration.patient?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span>{checkInResult.registration.registration_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(checkInResult.registration.registration_date).toLocaleDateString("id-ID", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
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
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{checkInResult.message}</AlertDescription>
                    </Alert>
                    <Button className="w-full" onClick={resetScanner}>
                      Coba Lagi
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Scanner Section */
            <div className="grid lg:grid-cols-2 gap-4 h-full">
              {/* Camera Scanner */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4" />
                  <span className="font-medium text-sm">Scan QR Code</span>
                </div>
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex-1 min-h-[200px]">
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
                        <div className="w-32 h-32 border-2 border-primary rounded-lg animate-pulse" />
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <CameraOff className="h-10 w-10 mb-2" />
                      <p className="text-sm">Kamera tidak aktif</p>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  {scanning ? (
                    <Button variant="destructive" size="sm" className="w-full" onClick={stopCamera}>
                      <CameraOff className="h-4 w-4 mr-2" />
                      Matikan Kamera
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={startCamera}>
                      <Camera className="h-4 w-4 mr-2" />
                      Aktifkan Kamera
                    </Button>
                  )}
                </div>
              </div>

              {/* Manual Input */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4" />
                  <span className="font-medium text-sm">Input Manual</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Masukkan nomor registrasi jika tidak dapat scan QR code
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nomor Registrasi (contoh: REG202601050001)"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
                    className="flex-1"
                  />
                  <Button onClick={handleManualCheckIn} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
