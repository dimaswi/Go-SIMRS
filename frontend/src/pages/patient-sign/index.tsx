import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import Webcam from "react-webcam";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Loader2, PenTool, CheckCircle2, RotateCcw } from "lucide-react";

export default function PatientSignPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const sigPad = useRef<SignatureCanvas>(null);
  const webcamRef = useRef<Webcam>(null);
  const [isFaceValidation, setIsFaceValidation] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Link tanda tangan tidak valid (Token tidak ditemukan).");
    }
  }, [token]);

  const clearSignature = () => {
    sigPad.current?.clear();
  };

  const handleNext = () => {
    if (sigPad.current?.isEmpty()) {
      alert("Harap gambar tanda tangan Anda terlebih dahulu.");
      return;
    }
    setIsFaceValidation(true);
  };

  const handleSubmit = async () => {
    try {
      if (sigPad.current?.isEmpty()) {
        alert("Harap gambar tanda tangan Anda terlebih dahulu.");
        return;
      }

      const rawCanvas = sigPad.current?.getCanvas();
      if (!rawCanvas) {
        alert("Gagal memproses gambar kanvas.");
        return;
      }
      const signatureImage = rawCanvas.toDataURL("image/png");

      const photoImage = webcamRef.current?.getScreenshot();
      if (!photoImage) {
        alert("Gagal mengambil foto wajah. Pastikan kamera diizinkan dan menyala.");
        return;
      }

      setLoading(true);
      await api.post("/signature/submit", {
        token,
        signature_image: signatureImage,
        photo_image: photoImage,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || err.message || "Gagal menyimpan tanda tangan. Pastikan koneksi lancar.");
      setErrorMsg(err.response?.data?.error || err.message || "Gagal menyimpan tanda tangan.");
    } finally {
      setLoading(false);
    }
  };

  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrapperRef.current) {
      setCanvasSize({
        width: wrapperRef.current.offsetWidth,
        height: wrapperRef.current.offsetHeight,
      });
    }
    
    // Optional: handle resize
    const handleResize = () => {
      if (wrapperRef.current) {
        setCanvasSize({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (errorMsg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl font-bold text-red-600">!</span>
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Akses Ditolak</h2>
          <p className="mt-2 text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Terima Kasih!</h2>
          <p className="mt-2 text-gray-600">Tanda tangan Anda berhasil disimpan ke dalam sistem.</p>
          <p className="mt-6 text-sm font-medium text-gray-400">Silakan tutup halaman ini dan kembali ke petugas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-100">
      <div className="flex items-center gap-3 bg-white p-4 py-5 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <PenTool className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900">Tanda Tangan Pasien</h1>
          <p className="text-xs text-gray-500">Silakan gambar tanda tangan Anda di bawah</p>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col">
        <div className="mx-auto flex-1 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 flex flex-col">
          
          {/* Signature Step */}
          <div className={`flex-1 flex flex-col ${isFaceValidation ? 'hidden' : ''}`}>
            <div ref={wrapperRef} className="flex-1 min-h-[300px] w-full items-center justify-center bg-gray-50">
              <SignatureCanvas
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  className: "cursor-crosshair touch-none bg-white",
                }}
              />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 p-4 shrink-0">
              <Button variant="outline" onClick={clearSignature} className="bg-white" type="button">
                <RotateCcw className="mr-2 h-4 w-4" />
                Ulangi
              </Button>
              <Button onClick={handleNext} className="min-w-[120px]">
                Lanjut Validasi Wajah
              </Button>
            </div>
          </div>

          {/* Face Validation Step */}
          <div className={`flex-1 flex flex-col ${!isFaceValidation ? 'hidden' : ''}`}>
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-blue-50/50">
              <div className="w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] shrink-0 bg-black rounded-full overflow-hidden border-4 border-primary/20 mb-6 shadow-lg">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center text-blue-900 max-w-md">
                <p className="font-bold text-lg mb-2">Validasi Wajah</p>
                <p className="text-sm">Silakan posisikan wajah Anda di dalam lingkaran kamera. Foto akan diambil secara otomatis saat Anda menekan tombol Simpan.</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-blue-100 bg-white p-4 shrink-0">
              <Button variant="outline" onClick={() => setIsFaceValidation(false)} type="button">
                Kembali
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="min-w-[120px]">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan TTD & Wajah"}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
