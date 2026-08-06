import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api/client";
import { signatureApi } from "@/lib/api/signature";
import { EmployeeSelect } from "@/components/employee/employee-select";
import { Loader2, CheckCircle2, ShieldCheck, PenTool } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignatureCanvas from "react-signature-canvas";

export type SignerRole = "pasien" | "dokter" | "perawat" | "saksi1" | "saksi2" | "petugas" | "left" | "right";

export interface StepConfig {
  role: SignerRole;
  title: string;
  type: "employee" | "patient_or_family";
}

interface SequentialSignatureWizardProps {
  documentId: number;
  documentType: string;
  documentTitle?: string;
  visitId: number;
  steps: StepConfig[];
  onSuccess?: () => void;
  onCancel?: () => void;
  onStepSuccess?: (role: string, name: string) => void;
  renderCustomPatientModal?: (props: { open: boolean; onClose: (name?: string) => void }) => React.ReactNode;
}

export function SequentialSignatureWizard({
  visitId,
  documentId,
  documentType,
  steps,
  onSuccess,
  onCancel,
  onStepSuccess,
  renderCustomPatientModal,
}: SequentialSignatureWizardProps) {
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [signerName, setSignerName] = useState("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showNameModal, setShowNameModal] = useState(false);

  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sigPad = useRef<SignatureCanvas>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (wrapperRef.current) {
        setCanvasSize({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    const timer = setTimeout(updateSize, 100);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [currentStepIndex]);

  useEffect(() => {
    setCurrentStepIndex(0);
    resetStepState();
  }, []);

  const resetStepState = () => {
    setSignerName("");
    setEmployeeId("");
    setPin(["", "", "", "", "", ""]);
    setShowNameModal(false);
    if (sigPad.current) {
      sigPad.current.clear();
    }
  };

  const currentStep = steps[currentStepIndex];

  if (!currentStep) return null;

  const handlePINChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePINKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const saveSignatureData = async (base64Signature?: string) => {
    try {
      setLoading(true);

      if (currentStep.type === "employee") {
        setIsVerifying(true);
        const pinString = pin.join("");
        let finalPin = pinString;

        // Cek pengaturan PIN di backend jika tidak dimasukkan
        if (!pinString || pinString.length < 6) {
          const empRes = await api.get(`/employees/${employeeId}`);
          if (empRes.data?.data?.pin_is_set) {
            toast({
              variant: "destructive",
              title: "PIN diperlukan",
              description: "Pegawai ini telah mengatur PIN. Silakan masukkan PIN.",
            });
            setIsVerifying(false);
            setLoading(false);
            return;
          } else {
            finalPin = "000000"; // Dummy pin for verification bypass
          }
        }

        // Submit employee signature
        await signatureApi.signDocument({
          pin: finalPin,
          document_type: documentType,
          document_id: documentId,
          visit_id: visitId,
          signer_employee_id: parseInt(employeeId),
          signature_role: currentStep.role,
          signature_slot: currentStep.role,
        });
      } else {
        if (!base64Signature) {
          toast({ variant: "destructive", title: "Tanda tangan kosong" });
          setLoading(false);
          return;
        }

        // Use token-based direct submit for patient/family
        const linkRes = await signatureApi.getPatientLink(documentType, documentId, signerName, currentStep.role);
        const dummyPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        await api.post("/signature/submit", {
          token: linkRes.data.token,
          signature_image: base64Signature,
          photo_image: dummyPhoto,
        });
      }

      if (onStepSuccess) {
        onStepSuccess(currentStep.role, signerName);
      }

      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        resetStepState();
      } else {
        toast({ title: "Berhasil", description: "Tanda tangan lengkap" });
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      setIsVerifying(false);
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.response?.data?.error || error.message || "Terjadi kesalahan",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSign = () => {
    if (currentStep.type === "employee" && !employeeId) {
      setShowNameModal(true);
      return;
    }
    if (currentStep.type === "patient_or_family" && !signerName.trim()) {
      setShowNameModal(true);
      return;
    }

    if (currentStep.type === "employee") {
      saveSignatureData();
    } else {
      if (sigPad.current?.isEmpty()) {
        toast({ variant: "destructive", title: "Silakan tanda tangan terlebih dahulu" });
        return;
      }
      saveSignatureData(sigPad.current?.toDataURL());
    }
  };

  const handleSkip = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      resetStepState();
    } else {
      if (onSuccess) onSuccess();
    }
  };

  return (
    <div className="w-full flex flex-col h-full relative bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-0">
        <div className="space-y-6 flex-1 flex flex-col min-h-0 justify-center">
          <div className="space-y-6 w-full flex flex-col flex-1 min-h-0 mx-auto">
            {currentStep.type === "employee" ? (
              <div className="space-y-4 bg-slate-50 p-6 rounded-lg border relative">
                {!employeeId && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] cursor-pointer rounded-lg"
                    onClick={() => setShowNameModal(true)}
                  >
                    <div className="bg-white px-4 py-2 rounded-full shadow-md text-primary font-medium flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Pilih Pegawai terlebih dahulu
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center gap-2 mb-6">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                  <span className="font-semibold text-lg">Verifikasi PIN</span>
                </div>
                <div className="flex justify-center gap-2">
                  {pin.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => { pinInputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePINChange(index, e.target.value)}
                      onKeyDown={(e) => handlePINKeyDown(index, e)}
                      className="w-12 h-12 text-center text-xl font-mono shadow-sm"
                      disabled={isVerifying || loading}
                    />
                  ))}
                </div>
                <p className="text-sm text-center text-muted-foreground mt-4">
                  Masukkan PIN jika ada. Jika Anda belum mengatur PIN, Anda dapat langsung menekan Simpan.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between text-primary shrink-0">
                  <div className="flex items-center gap-2">

                  </div>
                  {signerName && (
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-200" onClick={() => setShowNameModal(true)}>
                      {signerName} ✎
                    </span>
                  )}
                </div>
                <div ref={wrapperRef} className="border-2 border-dashed border-primary/30 rounded-lg bg-slate-50 relative shadow-inner flex-1 min-h-0 w-full">
                  {!signerName && (
                    <div
                      className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] cursor-pointer rounded-lg"
                      onClick={() => setShowNameModal(true)}
                    >
                      <div className="bg-white px-4 py-2 rounded-full shadow-md text-primary font-medium flex items-center gap-2">
                        <PenTool className="w-4 h-4" />
                        Sentuh untuk mengisi nama
                      </div>
                    </div>
                  )}
                  {canvasSize.width > 0 && canvasSize.height > 0 && (
                    <SignatureCanvas
                      ref={sigPad}
                      canvasProps={{
                        width: canvasSize.width,
                        height: canvasSize.height,
                        className: "absolute inset-0 rounded-lg",
                      }}
                      backgroundColor="transparent"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute bottom-3 right-3 h-8 text-xs bg-white"
                    onClick={() => sigPad.current?.clear()}
                  >
                    Ulangi
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50/80 p-4 sm:px-8 border-t flex justify-between items-center mt-auto">
        <Button
          variant="outline"
          onClick={() => {
            if (onCancel) onCancel();
          }}
          disabled={loading}
        >
          Kembali
        </Button>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={loading}>
            Lewati
          </Button>
          <Button onClick={handleSign} disabled={loading} size="lg" className="min-w-[140px]">
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
            ) : currentStepIndex === steps.length - 1 ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Selesai</>
            ) : (
              "Simpan & Lanjut"
            )}
          </Button>
        </div>
      </div>

      {currentStep.type === "patient_or_family" && renderCustomPatientModal ? (
        renderCustomPatientModal({
          open: showNameModal,
          onClose: (name?: string) => {
            if (name) {
              setSignerName(name);
            }
            setShowNameModal(false);
          },
        })
      ) : (
        <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
          <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{currentStep.type === "employee" ? "Pilih Pegawai" : "Nama Penandatangan"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {currentStep.type === "employee" ? (
              <EmployeeSelect
                value={employeeId}
                onChange={(val, name) => {
                  setEmployeeId(val.toString());
                  setSignerName(name || ("Pegawai #" + val));
                }}
                role={currentStep.role === "dokter" ? "dokter" : "perawat"}
              />
            ) : (
              <Input
                placeholder="Ketik nama lengkap..."
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNameModal(false)}>Batal</Button>
            <Button onClick={() => {
              if (currentStep.type === "employee" && !employeeId) {
                toast({ variant: "destructive", title: "Pilih pegawai" });
                return;
              }
              if (currentStep.type === "patient_or_family" && !signerName.trim()) {
                toast({ variant: "destructive", title: "Masukkan nama" });
                return;
              }
              setShowNameModal(false);
            }}>
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
