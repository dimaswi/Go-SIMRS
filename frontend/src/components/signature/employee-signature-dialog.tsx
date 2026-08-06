import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api/client";
import { signatureApi } from "@/lib/api/signature";
import { EmployeeSelect } from "@/components/employee/employee-select";
import { Loader2, ShieldCheck } from "lucide-react";

interface EmployeeSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  visitId?: number;
  role: "dokter" | "perawat";
  title: string;
  onSuccess?: () => void;
}

export function EmployeeSignatureDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  visitId,
  role,
  title,
  onSuccess,
}: EmployeeSignatureDialogProps) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setEmployeeId("");
      setPin(["", "", "", "", "", ""]);
    }
  }, [open]);

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
    if (e.key === "Enter" && employeeId && pin.every(d => d)) {
      handleSign();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      setPin(pastedData.split(""));
      pinInputRefs.current[5]?.focus();
    }
  };

  const handleSign = async () => {
    if (!employeeId) {
      toast({ variant: "destructive", title: "Pilih Pegawai terlebih dahulu" });
      return;
    }

    try {
      setLoading(true);
      const pinString = pin.join("");
      let finalPin = pinString;

      // Check PIN configuration in backend if not full 6 digits entered
      if (!pinString || pinString.length < 6) {
        const empRes = await api.get(`/employees/${employeeId}`);
        if (empRes.data?.data?.pin_is_set) {
          toast({
            variant: "destructive",
            title: "PIN diperlukan",
            description: "Pegawai ini telah mengatur PIN. Silakan masukkan PIN.",
          });
          setLoading(false);
          return;
        } else {
          finalPin = "000000"; // Dummy pin for verification bypass
        }
      }

      await signatureApi.signDocument({
        pin: finalPin,
        document_type: documentType,
        document_id: documentId,
        visit_id: visitId,
        signer_employee_id: parseInt(employeeId),
        signature_role: role,
        signature_slot: role,
      });

      toast({ title: "Berhasil", description: "Tanda tangan lengkap" });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.response?.data?.error || error.message || "Terjadi kesalahan",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pegawai ({role === 'dokter' ? 'Dokter' : 'Perawat'})</label>
            <EmployeeSelect
              value={employeeId}
              onChange={(val) => setEmployeeId(val.toString())}
              role={role}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex flex-col items-center gap-2 mb-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <span className="font-semibold">Verifikasi PIN</span>
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
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 focus-visible:border-primary focus-visible:ring-0 shadow-sm"
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSign}
              disabled={loading || !employeeId}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Selesai"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
