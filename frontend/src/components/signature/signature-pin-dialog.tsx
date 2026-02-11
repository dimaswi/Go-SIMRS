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
import { useToast } from "@/hooks/use-toast";
import { signatureApi, DOCUMENT_TYPE_LABELS } from "@/lib/api";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";

interface SignaturePINDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  visitId?: number;
  documentTitle?: string;
  patientName?: string;
  onSuccess?: (signatureHash: string) => void;
  onCancel?: () => void;
}

export function SignaturePINDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  visitId,
  documentTitle,
  patientName,
  onSuccess,
  onCancel,
}: SignaturePINDialogProps) {
  const { toast } = useToast();
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [pinRequired, setPinRequired] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if PIN is required
    const checkPINRequired = async () => {
      try {
        const response = await signatureApi.checkPINRequired();
        setPinRequired(response.data.signature_pin_required);
      } catch {
        // Default to required if check fails
        setPinRequired(true);
      }
    };
    checkPINRequired();
  }, []);

  useEffect(() => {
    // Reset PIN when dialog opens
    if (open) {
      setPin(["", "", "", "", "", ""]);
      // Focus first input after a short delay
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && pin.every(d => d)) {
      handleSign();
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

  const handleSign = async () => {
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
      const response = await signatureApi.signDocument({
        pin: pinValue || "000000", // Fallback if PIN not required
        document_type: documentType,
        document_id: documentId,
        visit_id: visitId,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "Dokumen berhasil ditandatangani",
      });

      onSuccess?.(response.data.signature_hash || "");
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; code?: string; redirect?: string } } };
      const errorMessage = err.response?.data?.error || "Gagal menandatangani dokumen";
      const errorCode = err.response?.data?.code;

      if (errorCode === "PIN_NOT_SET") {
        toast({
          variant: "destructive",
          title: "PIN Belum Diatur",
          description: "Silakan atur PIN tanda tangan terlebih dahulu di pengaturan akun",
        });
        // Could redirect to PIN setup page here
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
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Konfirmasi Tanda Tangan Digital
          </DialogTitle>
          <DialogDescription>
            Anda akan menandatangani dokumen berikut:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jenis Dokumen:</span>
              <span className="font-medium">{docTypeLabel}</span>
            </div>
            {documentTitle && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nomor:</span>
                <span className="font-medium">{documentTitle}</span>
              </div>
            )}
            {patientName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pasien:</span>
                <span className="font-medium">{patientName}</span>
              </div>
            )}
          </div>

          {/* PIN Input */}
          {pinRequired && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Masukkan PIN Tanda Tangan (6 digit)
              </Label>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {pin.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-xl font-mono"
                    disabled={loading}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                PIN ini membuktikan bahwa Anda yang menandatangani dokumen
              </p>
            </div>
          )}

          {!pinRequired && (
            <p className="text-sm text-center text-muted-foreground">
              Klik "Tanda Tangani" untuk menandatangani dokumen ini
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSign}
              disabled={loading || (pinRequired && pin.some(d => !d))}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Tanda Tangani
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
