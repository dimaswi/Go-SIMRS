import { useState, useRef, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { signatureApi } from "@/lib/api/signature";
import { employeesApi, type Employee } from "@/lib/api/employees";
import { Loader2, ShieldCheck, UserCheck, Info } from "lucide-react";

interface SignOnBehalfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  visitId?: number;
  signerHint: string;
  documentTitle: string;
  /** DPJP / doctor from visit — always show at top of list even if inactive */
  visitDoctor?: { id: number; nama_lengkap: string; spesialisasi?: string; no_sip?: string; no_str?: string };
  onSuccess?: () => void;
}

export function SignOnBehalfDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  visitId,
  signerHint,
  documentTitle,
  visitDoctor,
  onSuccess,
}: SignOnBehalfDialogProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load employees on open
  useEffect(() => {
    if (!open) return;
    setSelectedEmployeeId("");
    setPin(["", "", "", "", "", ""]);

    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await employeesApi.getAll({});
        const allEmployees: Employee[] = res.data.data || [];
        // Sort: doctors first, then by name
        allEmployees.sort((a, b) => {
          const aIsDoc = a.tipe_karyawan === "Dokter" ? 0 : 1;
          const bIsDoc = b.tipe_karyawan === "Dokter" ? 0 : 1;
          if (aIsDoc !== bIsDoc) return aIsDoc - bIsDoc;
          return a.nama_lengkap.localeCompare(b.nama_lengkap);
        });
        // If visitDoctor provided, ensure it's in the list (even if inactive)
        if (visitDoctor && !allEmployees.find((e) => e.id === visitDoctor.id)) {
          allEmployees.unshift({
            id: visitDoctor.id,
            nama_lengkap: visitDoctor.nama_lengkap,
            spesialisasi: visitDoctor.spesialisasi,
            no_sip: visitDoctor.no_sip,
            no_str: visitDoctor.no_str,
          } as Employee);
        }
        setEmployees(allEmployees);
      } catch {
        // ignore
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, [open, visitDoctor]);

  // Auto-select visit doctor when employees loaded
  useEffect(() => {
    if (visitDoctor && employees.length > 0 && !selectedEmployeeId) {
      const found = employees.find((e) => e.id === visitDoctor.id);
      if (found) {
        setSelectedEmployeeId(found.id.toString());
      }
    }
  }, [visitDoctor, employees, selectedEmployeeId]);

  // Focus first PIN input when employee selected
  useEffect(() => {
    if (selectedEmployeeId && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [selectedEmployeeId]);

  const employeeOptions = employees.map((e) => ({
    value: e.id.toString(),
    label: `${e.nama_lengkap}${e.spesialisasi ? ` - ${e.spesialisasi}` : e.tipe_karyawan ? ` (${e.tipe_karyawan})` : ""}${e.jabatan ? ` · ${e.jabatan}` : ""}`,
  }));

  const handlePinChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6);
      const newPin = ["", "", "", "", "", ""];
      for (let i = 0; i < digits.length; i++) {
        newPin[i] = digits[i];
      }
      setPin(newPin);
      const focusIdx = Math.min(digits.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [pin]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [pin]);

  const handleSign = async () => {
    const pinValue = pin.join("");
    if (pinValue.length !== 6) {
      toast({ variant: "destructive", title: "PIN harus 6 digit" });
      return;
    }
    if (!selectedEmployeeId) {
      toast({ variant: "destructive", title: "Pilih penandatangan terlebih dahulu" });
      return;
    }

    setLoading(true);
    try {
      await signatureApi.signDocument({
        pin: pinValue,
        document_type: documentType,
        document_id: documentId,
        visit_id: visitId,
        signer_employee_id: parseInt(selectedEmployeeId),
      });

      const emp = employees.find((e) => e.id.toString() === selectedEmployeeId);
      toast({
        variant: "success",
        title: "Berhasil ditandatangani",
        description: `Dokumen ditandatangani atas nama ${emp?.nama_lengkap || ""}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Gagal menandatangani dokumen";
      const code = err?.response?.data?.code;
      if (code === "PIN_NOT_SET") {
        toast({
          variant: "destructive",
          title: "PIN Belum Diatur",
          description: "Anda belum mengatur PIN tanda tangan. Silakan atur di Pengaturan.",
        });
      } else {
        toast({ variant: "destructive", title: "Gagal", description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Tanda Tangan Digital
          </DialogTitle>
          <DialogDescription>
            Pilih penandatangan dan masukkan PIN Anda untuk mengotorisasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Document info */}
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <div className="font-medium">{documentTitle}</div>
          </div>

          {/* Signer hint */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
            <span>Rekomendasi penandatangan: <strong>{signerHint}</strong></span>
          </div>

          {/* Employee selector */}
          <div className="space-y-2">
            <Label>Penandatangan</Label>
            <Combobox
              options={employeeOptions}
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              placeholder="Pilih dokter/petugas..."
              searchPlaceholder="Cari nama..."
              loading={loadingEmployees}
            />
            {selectedEmployeeId && (() => {
              const emp = employees.find((e) => e.id.toString() === selectedEmployeeId);
              if (!emp) return null;
              return (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{emp.nama_lengkap}</span>
                  {emp.no_sip && <Badge variant="outline" className="text-[10px]">SIP: {emp.no_sip}</Badge>}
                  {emp.no_str && <Badge variant="outline" className="text-[10px]">STR: {emp.no_str}</Badge>}
                </div>
              );
            })()}
          </div>

          {/* PIN input */}
          {selectedEmployeeId && (
            <div className="space-y-2">
              <Label>PIN Anda (6 digit)</Label>
              <div className="flex gap-2 justify-center">
                {pin.map((digit, idx) => (
                  <Input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-10 h-10 text-center text-lg font-mono"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button
              onClick={handleSign}
              disabled={loading || !selectedEmployeeId || pin.join("").length !== 6}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Tandatangani
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
