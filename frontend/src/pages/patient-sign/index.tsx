import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import Webcam from "react-webcam";
import { jwtDecode } from "jwt-decode";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PenTool, CheckCircle2, RotateCcw, FileText, ChevronRight } from "lucide-react";

export default function PatientSignPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Step management: preview -> signature -> face -> submit
  const [step, setStep] = useState<"preview" | "signature" | "face">("preview");
  const [agreedToDocument, setAgreedToDocument] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const sigPad = useRef<SignatureCanvas>(null);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Link tanda tangan tidak valid (Token tidak ditemukan).");
      return;
    }

    try {
      // Decode the JWT to find out what document we are signing
      const decoded = jwtDecode<any>(token);
      const docType = decoded.doc_type;
      const docId = decoded.doc_id;

      if (!docType || !docId) {
        throw new Error("Token tidak memuat informasi dokumen yang valid.");
      }

      // Map doc_type to print endpoints
      const typeToRouteMap: Record<string, string> = {
        "visit_resume": "outpatient-resume",
        "prescription": "prescription",
        "lab_result": "lab-result",
        "sick_letter": "sick-letter",
        "health_certificate": "health-certificate",
        "birth_certificate": "birth-certificate",
        "leave_certificate": "leave-certificate",
        "mcu_certificate": "mcu-certificate",
        "death_certificate": "death-certificate",
        "referral_letter": "referral-letter",
        "informed_consent": "informed-consent",
        "general_consent_inpatient": "general-consent-inpatient",
        "cppt": "cppt",
        "nursing_care": "nursing-care",
        "fluid_balance": "fluid-balance",
        "bed_transfer": "bed-transfer",
        "vital_sign": "vital-sign-chart",
        "triage": "triage",
        "emergency_summary": "emergency-summary",
        "inpatient_cert": "inpatient-certificate",
        "registration": "registration-receipt",
        "spri": "spri",
        "surat_kontrol": "surat-kontrol",
        "bersalin": "bersalin",
        "rm_dup_lab_result": "rm-duplicate/lab-result",
        "rm_dup_radiology_result": "rm-duplicate/radiology-result",
        "rm_dup_prescription": "rm-duplicate/prescription",
        "rm_dup_billing": "rm-duplicate/billing",
        "rm_dup_bersalin": "rm-duplicate/bersalin",
        "rm_dup_surgery_report": "rm-duplicate/procedure-result",
        "rm_dup_consultation": "rm-duplicate/procedure-result",
      };

      const routeName = typeToRouteMap[docType] || docType.replace(/_/g, "-");

      // Use the standard backend URL to display the document PDF
      const baseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8080/api`;
      setPreviewUrl(`${baseUrl}/print/${routeName}/${docId}?token=${token}`);

    } catch (error) {
      console.error("Invalid token format:", error);
      // Fallback: If decode fails (e.g. not a real JWT during dev, or malformed), skip preview
      setStep("signature");
    }
  }, [token]);

  const clearSignature = () => {
    sigPad.current?.clear();
    setSignatureImage("");
  };

  const handleNextFromPreview = () => {
    if (!agreedToDocument) return;
    setStep("signature");
  };

  const handleNextFromSignature = () => {
    if (sigPad.current?.isEmpty()) {
      alert("Harap gambar tanda tangan Anda terlebih dahulu.");
      return;
    }

    const rawCanvas = sigPad.current?.getCanvas();
    if (!rawCanvas) {
      alert("Gagal memproses gambar kanvas.");
      return;
    }

    setSignatureImage(rawCanvas.toDataURL("image/png"));
    setStep("face");
  };

  const handleSubmit = async () => {
    try {
      if (!signatureImage) {
        alert("Harap gambar tanda tangan Anda terlebih dahulu.");
        return;
      }

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

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (step !== "signature") return;
    if (!wrapperRef.current) return;

    const updateCanvasSize = () => {
      if (!wrapperRef.current) return;
      const nextWidth = wrapperRef.current.clientWidth;
      const nextHeight = wrapperRef.current.clientHeight;
      if (nextWidth > 0 && nextHeight > 0) {
        setCanvasSize({ width: nextWidth, height: nextHeight });
      }
    };

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });
    observer.observe(wrapperRef.current);
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [step]);

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
    <div className="flex min-h-[100dvh] flex-col bg-gray-100 sm:bg-gray-100">
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          {step === "preview" ? (
            <FileText className="h-5 w-5 text-primary" />
          ) : (
            <PenTool className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-gray-900">
            {step === "preview" ? "Preview Dokumen" : "Tanda Tangan Pasien"}
          </h1>
          <p className="text-xs text-gray-500">
            {step === "preview"
              ? "Silakan baca dan setujui dokumen di bawah"
              : "Silakan gambar tanda tangan Anda di bawah"}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-0 sm:p-4 md:p-6">
        <div className="flex-1 min-h-0 w-full overflow-hidden bg-white sm:mx-auto sm:max-w-2xl sm:rounded-xl sm:shadow-sm sm:ring-1 sm:ring-black/5 flex flex-col">

          {/* Preview Step */}
          <div className={`flex-1 flex flex-col ${step !== "preview" ? 'hidden' : ''}`}>
            <div className="flex-1 relative w-full bg-gray-50">
              {previewUrl ? (
                <iframe
                  src={`${previewUrl}&view=true`}
                  title="Document Preview"
                  className="absolute inset-0 w-full h-full border-0 bg-white"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  Preview dokumen tidak tersedia
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 border-t border-gray-100 bg-white p-4 sm:p-5 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agree"
                  checked={agreedToDocument}
                  onCheckedChange={(checked) => setAgreedToDocument(!!checked)}
                />
                <label
                  htmlFor="agree"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Saya telah membaca dan menyetujui isi dokumen ini
                </label>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleNextFromPreview} disabled={!agreedToDocument} className="min-w-[120px]">
                  Lanjut Tanda Tangan <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Signature Step */}
          {step === "signature" && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div ref={wrapperRef} className="flex-1 min-h-0 w-full bg-gray-50">
                {canvasSize.width > 0 && canvasSize.height > 0 && (
                  <SignatureCanvas
                    ref={sigPad}
                    penColor="black"
                    canvasProps={{
                      width: canvasSize.width,
                      height: canvasSize.height,
                      className: "cursor-crosshair touch-none bg-white block",
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 p-4 shrink-0">
                <Button variant="outline" onClick={clearSignature} className="bg-white" type="button">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Ulangi
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep("preview")} type="button">
                    Kembali
                  </Button>
                  <Button onClick={handleNextFromSignature} className="min-w-[120px]">
                    Lanjut <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Face Validation Step */}
          {step === "face" && (
            <div className="flex-1 flex flex-col">
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
                <Button variant="outline" onClick={() => setStep("signature")} type="button">
                  Kembali
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="min-w-[120px]">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan TTD & Wajah"}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
