import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { signatureApi, DOCUMENT_TYPE_LABELS } from "@/lib/api";
import { Loader2, ShieldX, KeyRound, AlertTriangle } from "lucide-react";

interface RevokePINDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  documentTitle?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RevokePINDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentTitle,
  onSuccess,
  onCancel,
}: RevokePINDialogProps) {
  const { toast } = useToast();
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [pinRequired, setPinRequired] = useState(true);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setPin(["", "", "", "", "", ""]);
      setReason("");
      setInitLoading(true);

      signatureApi.checkPINRequired()
        .then((res) => {
          setPinRequired(res.data.signature_pin_required);
        })
        .catch(() => {
          setPinRequired(true);
        })
        .finally(() => {
          setInitLoading(false);
          if (pinRequired) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }
        });
    }
  }, [open, pinRequired]);

  const handlePinChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && pin.every(d => d)) {
      handleRevoke();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      setPin(pastedData.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleRevoke = async () => {
    const pinValue = pin.join("");

    if (pinRequired && pinValue.length !== 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Masukkan PIN 6 digit",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await signatureApi.revokeSignature({
        document_type: documentType,
        document_id: documentId,
        pin: pinRequired ? pinValue : "000000",
        reason: reason || undefined,
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: response.data.message || "Tanda tangan berhasil dibatalkan",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; code?: string } } };
      const errorMessage = err.response?.data?.error || "Gagal membatalkan tanda tangan";
      const errorCode = err.response?.data?.code;

      if (errorCode === "PIN_NOT_SET") {
        toast({
          variant: "destructive",
          title: "PIN Belum Diatur",
          description: "Silakan atur PIN tanda tangan terlebih dahulu",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const docTypeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldX className="h-5 w-5" />
            Batalkan Tanda Tangan Digital
          </DialogTitle>
          <DialogDescription>
            Tanda tangan digital pada dokumen ini akan dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Pembatalan tanda tangan akan dicatat dalam audit log.
                Dokumen harus ditandatangani ulang setelah pembatalan.
              </p>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-2 rounded-md bg-slate-50 p-3 text-sm border">
              <div className="text-slate-500">Jenis Dokumen:</div>
              <div className="font-medium">{docTypeLabel}</div>
              <div className="text-slate-500">Dokumen:</div>
              <div className="font-medium">{documentTitle || `${docTypeLabel} #${documentId}`}</div>
            </div>

            <div className="space-y-2">
              <Label>Alasan Pembatalan (opsional)</Label>
              <Textarea
                placeholder="Contoh: Salah tanda tangan, data perlu dikoreksi..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none"
                rows={2}
                disabled={loading}
              />
            </div>

            {initLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pinRequired ? (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Masukkan PIN Tanda Tangan (6 digit)
                </Label>
                <div className="flex gap-2">
                  {pin.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="h-12 w-12 text-center text-lg sm:h-14 sm:w-14"
                      disabled={loading}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  PIN diperlukan untuk verifikasi pembatalan
                </p>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Kembali
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={loading || pin.some(d => !d)}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <ShieldX className="mr-2 h-4 w-4" />
                  Batalkan TTD
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
