import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signatureApi } from "@/lib/api/signature";
import { employeesApi, type Employee } from "@/lib/api/employees";
import { Loader2, ShieldCheck, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignOnBehalfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  visitId?: number;
  signerHint: string;
  documentTitle: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedEmployeeId("");
    setSearchQuery("");
    setDropdownOpen(false);
    setPin(["", "", "", "", "", ""]);

    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await employeesApi.getAll({});
        const allEmployees: Employee[] = res.data.data || [];
        allEmployees.sort((a, b) => {
          const aIsDoc = a.tipe_karyawan === "Dokter" ? 0 : 1;
          const bIsDoc = b.tipe_karyawan === "Dokter" ? 0 : 1;
          if (aIsDoc !== bIsDoc) return aIsDoc - bIsDoc;
          return a.nama_lengkap.localeCompare(b.nama_lengkap);
        });
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

  useEffect(() => {
    if (visitDoctor && employees.length > 0 && !selectedEmployeeId) {
      const found = employees.find((e) => e.id === visitDoctor.id);
      if (found) {
        setSelectedEmployeeId(found.id.toString());
      }
    }
  }, [visitDoctor, employees, selectedEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [selectedEmployeeId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter((e) =>
      e.nama_lengkap.toLowerCase().includes(q) ||
      (e.spesialisasi && e.spesialisasi.toLowerCase().includes(q)) ||
      (e.tipe_karyawan && e.tipe_karyawan.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id.toString() === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const handleSelectEmployee = useCallback((emp: Employee) => {
    setSelectedEmployeeId(emp.id.toString());
    setSearchQuery("");
    setDropdownOpen(false);
  }, []);

  const handlePinChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
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
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            Tanda Tangan Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded bg-muted/50 px-3 py-2 text-sm font-medium truncate">
            {documentTitle}
          </div>

          <p className="text-xs text-muted-foreground">
            Rekomendasi: <strong>{signerHint}</strong>
          </p>

          {/* Searchable employee dropdown — no portal, inline */}
          <div className="space-y-1">
            <Label className="text-xs">Penandatangan</Label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data...
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* Selected display / search input */}
                {dropdownOpen ? (
                  <div className="flex items-center border rounded-md px-2 h-9 gap-1.5">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ketik nama dokter..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
                    className="flex items-center w-full border rounded-md px-3 h-9 text-sm text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="truncate flex-1">
                      {selectedEmployee
                        ? `${selectedEmployee.nama_lengkap}${selectedEmployee.spesialisasi ? ` - ${selectedEmployee.spesialisasi}` : ""}`
                        : <span className="text-muted-foreground">Pilih dokter/petugas...</span>}
                    </span>
                  </button>
                )}

                {/* Dropdown list */}
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-10 border rounded-md bg-popover shadow-lg max-h-[200px] overflow-y-auto z-10">
                    {filteredEmployees.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                        Tidak ditemukan
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className={cn(
                            "flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors gap-2",
                            selectedEmployeeId === emp.id.toString() && "bg-accent"
                          )}
                        >
                          {selectedEmployeeId === emp.id.toString() && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span className="truncate">
                            {emp.nama_lengkap}
                            {emp.spesialisasi ? ` - ${emp.spesialisasi}` : emp.tipe_karyawan ? ` (${emp.tipe_karyawan})` : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PIN input */}
          {selectedEmployeeId && !dropdownOpen && (
            <div className="space-y-1">
              <Label className="text-xs">PIN Anda (6 digit)</Label>
              <div className="flex gap-1.5 justify-center">
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
                    className="w-9 h-9 text-center text-base font-mono p-0"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSign}
              disabled={loading || !selectedEmployeeId || pin.join("").length !== 6}
            >
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Tandatangani
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
