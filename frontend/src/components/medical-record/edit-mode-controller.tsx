import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Pencil, 
  Lock, 
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signatureApi } from "@/lib/api";

interface UseEditModeOptions {
  isPatientDischarged: boolean;
  recordType: string;
  onEditConfirmed?: (reason: string) => void;
}

export function useEditMode({ 
  isPatientDischarged, 
  recordType: _recordType,
  onEditConfirmed 
}: UseEditModeOptions) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!isPatientDischarged);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [pinRequired, setPinRequired] = useState(true);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [verifyingPIN, setVerifyingPIN] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Callback to execute after PIN verification succeeds
  const onPINVerifiedCallback = useRef<(() => void) | null>(null);

  // Check if PIN is required
  useEffect(() => {
    const checkPINRequired = async () => {
      try {
        const response = await signatureApi.checkPINRequired();
        setPinRequired(response.data.signature_pin_required);
      } catch {
        setPinRequired(true);
      }
    };
    checkPINRequired();
  }, []);

  const handleRequestEdit = () => {
    if (!isPatientDischarged) {
      setIsEditing(true);
      return;
    }
    setEditReason("");
    setShowEditDialog(true);
  };

  const handleConfirmEdit = () => {
    if (!editReason.trim()) {
      toast({
        title: "Alasan diperlukan",
        description: "Mohon isi alasan untuk mengedit rekam medis setelah pasien pulang",
        variant: "destructive",
      });
      return;
    }

    // Proceed directly to edit mode - PIN will be required on save
    proceedWithEdit();
  };

  const handlePINChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

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
    if (e.key === "Enter" && pin.every(d => d)) {
      handleVerifyPIN();
    }
  };

  const handleVerifyPIN = async () => {
    const pinValue = pin.join("");
    if (pinValue.length !== 6) {
      toast({
        variant: "destructive",
        title: "PIN tidak lengkap",
        description: "Masukkan 6 digit PIN",
      });
      return;
    }

    setVerifyingPIN(true);
    try {
      await signatureApi.verifyPIN({ pin: pinValue });
      setShowPINDialog(false);
      // Execute the callback (save function)
      if (onPINVerifiedCallback.current) {
        onPINVerifiedCallback.current();
        onPINVerifiedCallback.current = null;
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Verifikasi gagal",
        description: err.response?.data?.error || "PIN tidak valid",
      });
      setPin(["", "", "", "", "", ""]);
      pinInputRefs.current[0]?.focus();
    } finally {
      setVerifyingPIN(false);
    }
  };

  // Request PIN verification before saving - call this before saving discharged patient records
  const requestPINVerification = useCallback((onVerified: () => void) => {
    if (!isPatientDischarged || !pinRequired) {
      // No PIN needed, execute directly
      onVerified();
      return;
    }
    
    // Store callback and show PIN dialog
    onPINVerifiedCallback.current = onVerified;
    setPin(["", "", "", "", "", ""]);
    setShowPINDialog(true);
    setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
  }, [isPatientDischarged, pinRequired]);

  const proceedWithEdit = () => {
    setIsEditing(true);
    setShowEditDialog(false);
    onEditConfirmed?.(editReason);
    toast({
      title: "Mode edit aktif",
      description: "Anda dapat mengedit rekam medis. Simpan untuk menyimpan perubahan.",
    });
  };

  const resetEditMode = () => {
    if (isPatientDischarged) {
      setIsEditing(false);
      setEditReason("");
    }
  };

  return {
    isEditing,
    editReason,
    showEditDialog,
    showPINDialog,
    pinRequired,
    setShowEditDialog,
    setShowPINDialog,
    setEditReason,
    handleRequestEdit,
    handleConfirmEdit,
    resetEditMode,
    requestPINVerification,
    // PIN related
    pin,
    verifyingPIN,
    pinInputRefs,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
  };
}

interface EditModeBannerProps {
  isPatientDischarged: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  recordTypeLabel: string;
}

export function EditModeBanner({
  isPatientDischarged,
  isEditing,
  onRequestEdit,
  recordTypeLabel,
}: EditModeBannerProps) {
  if (!isPatientDischarged) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-amber-800 dark:text-amber-200">
          {isEditing 
            ? "Mode edit aktif - perubahan akan dicatat dalam log" 
            : "Pasien sudah pulang - klik tombol Edit untuk mengubah data"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isEditing ? (
          <Button
            size="sm"
            onClick={onRequestEdit}
            className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 sm:w-auto"
          >
            <Pencil className="h-4 w-4" />
            Edit {recordTypeLabel}
          </Button>
        ) : (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Mode Edit Aktif
          </Badge>
        )}
      </div>
    </div>
  );
}

interface EditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editReason: string;
  onEditReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function EditConfirmDialog({
  open,
  onOpenChange,
  editReason,
  onEditReasonChange,
  onConfirm,
}: EditConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Konfirmasi Edit Rekam Medis
          </DialogTitle>
          <DialogDescription>
            Pasien sudah pulang. Perubahan pada rekam medis akan dicatat dalam log audit 
            beserta username, waktu, dan IP address Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-reason" className="text-sm font-medium">
              Alasan Edit <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="edit-reason"
              placeholder="Jelaskan alasan mengapa rekam medis perlu diedit setelah pasien pulang..."
              value={editReason}
              onChange={(e) => onEditReasonChange(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Contoh: Koreksi data yang salah input, tambahan informasi dari hasil lab, dll.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={!editReason.trim()} className="w-full sm:w-auto">
            Lanjutkan Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PINVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pin: string[];
  verifying: boolean;
  pinInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onPINChange: (index: number, value: string) => void;
  onPINKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onVerify: () => void;
}

export function PINVerificationDialog({
  open,
  onOpenChange,
  pin,
  verifying,
  pinInputRefs,
  onPINChange,
  onPINKeyDown,
  onVerify,
}: PINVerificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-sm p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verifikasi PIN
          </DialogTitle>
          <DialogDescription>
            Masukkan PIN tanda tangan 6 digit untuk mengonfirmasi identitas Anda
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">PIN (6 digit)</Label>
            <div className="flex justify-center gap-1.5 sm:gap-2">
              {pin.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { pinInputRefs.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => onPINChange(index, e.target.value)}
                  onKeyDown={(e) => onPINKeyDown(index, e)}
                  className="h-10 w-9 text-center text-base font-mono sm:w-10 sm:text-lg"
                  disabled={verifying}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            PIN digunakan untuk memverifikasi bahwa Anda yang melakukan perubahan rekam medis
          </p>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verifying} className="w-full sm:w-auto">
            Batal
          </Button>
          <Button onClick={onVerify} disabled={verifying || pin.some(d => !d)} className="w-full sm:w-auto">
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              "Verifikasi"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Standalone PIN Verification Hook (for order forms and other components)
// ===========================================================================

interface UsePINVerificationOptions {
  /** Whether PIN is mandatory (e.g., for discharged patients). If false, callback executes directly */
  isRequired?: boolean;
  /** Override the setting check - if true, always require PIN when isRequired is true */
  skipSettingCheck?: boolean;
}

export function usePINVerification(options: UsePINVerificationOptions = {}) {
  const { isRequired = true, skipSettingCheck = false } = options;
  const { toast } = useToast();
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [verifyingPIN, setVerifyingPIN] = useState(false);
  const [pinRequired, setPinRequired] = useState(true);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const onVerifiedCallback = useRef<(() => void) | null>(null);

  // Check if PIN is required from settings
  useEffect(() => {
    if (skipSettingCheck) {
      setPinRequired(true);
      return;
    }
    const checkPINRequired = async () => {
      try {
        const response = await signatureApi.checkPINRequired();
        setPinRequired(response.data.signature_pin_required);
      } catch {
        setPinRequired(true);
      }
    };
    checkPINRequired();
  }, [skipSettingCheck]);

  const handlePINChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
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
    if (e.key === "Enter" && pin.every(d => d)) {
      handleVerifyPIN();
    }
  };

  const handleVerifyPIN = async () => {
    const pinValue = pin.join("");
    if (pinValue.length !== 6) {
      toast({
        variant: "destructive",
        title: "PIN tidak lengkap",
        description: "Masukkan 6 digit PIN",
      });
      return;
    }

    setVerifyingPIN(true);
    try {
      await signatureApi.verifyPIN({ pin: pinValue });
      setShowPINDialog(false);
      if (onVerifiedCallback.current) {
        onVerifiedCallback.current();
        onVerifiedCallback.current = null;
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Verifikasi gagal",
        description: err.response?.data?.error || "PIN tidak valid",
      });
      setPin(["", "", "", "", "", ""]);
      pinInputRefs.current[0]?.focus();
    } finally {
      setVerifyingPIN(false);
    }
  };

  /** Request PIN verification. If PIN not required or disabled, executes callback directly. */
  const requestPINVerification = useCallback((onVerified: () => void) => {
    if (!isRequired || !pinRequired) {
      onVerified();
      return;
    }
    onVerifiedCallback.current = onVerified;
    setPin(["", "", "", "", "", ""]);
    setShowPINDialog(true);
    setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
  }, [isRequired, pinRequired]);

  return {
    showPINDialog,
    setShowPINDialog,
    pin,
    verifyingPIN,
    pinInputRefs,
    pinRequired,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
    requestPINVerification,
  };
}
