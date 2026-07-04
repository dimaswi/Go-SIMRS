import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Webcam from "react-webcam";
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
import { Loader2, ShieldCheck, Check, CheckCircle2, ChevronsUpDown, MonitorSmartphone, QrCode, PenTool, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import SignatureCanvas from "react-signature-canvas";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api/client";

interface SignOnBehalfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: number;
  visitId?: number;
  signerHint: string;
  signerTypeFilter?: "Dokter" | "Perawat";
  signatureSlot?: string;
  slotLabels?: {
    left?: string;
    right?: string;
  };
  fixedRoles?: {
    left?: "dpjp" | "perawat" | "pasien" | "wali" | "kosong";
    right?: "dpjp" | "perawat" | "pasien" | "wali" | "kosong";
  };
  requiredSignatures?: number;
  documentTitle: string;
  visitDoctor?: { id: number; nama_lengkap: string; spesialisasi?: string; no_sip?: string; no_str?: string };
  onSuccess?: () => void;
  needEmployee?: boolean;
}

export function SignOnBehalfDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  visitId,
  signerTypeFilter: _signerTypeFilter,
  signatureSlot,
  slotLabels,
  fixedRoles,
  requiredSignatures,
  documentTitle,
  visitDoctor,
  onSuccess,
  needEmployee: propNeedEmployee,
}: SignOnBehalfDialogProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [slot, setSlot] = useState<"left" | "right">("left");
  const [step, setStep] = useState<"pick" | "form" | "pin" | "patient_mode" | "patient_qr" | "patient_direct">("pick");
  const [isFaceValidation, setIsFaceValidation] = useState(false);
  const [role, setRole] = useState<"dpjp" | "perawat" | "pasien" | "wali" | "kosong">("kosong");
  const [signatureName, setSignatureName] = useState("");
  const [location, setLocation] = useState("");
  const [signatureDate, setSignatureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [signedSlots, setSignedSlots] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [slotDetails, setSlotDetails] = useState<Record<string, any>>({});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sigPad = useRef<SignatureCanvas>(null);
  const webcamRef = useRef<Webcam>(null);
  const [patientToken, setPatientToken] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEmployeeId("");
    setSearchQuery("");
    setDropdownOpen(false);
    setPin(["", "", "", "", "", ""]);
    const initialSlot = (signatureSlot || "left") === "right" || signatureSlot === "2" ? "right" : "left";
    setSlot(initialSlot);
    setStep("pick");
    setRole((fixedRoles && fixedRoles[initialSlot]) ? fixedRoles[initialSlot] as any : "dpjp");
    setSignatureName("");
    setLocation("");
    setPatientToken("");
    setSignatureDate(new Date().toISOString().slice(0, 10));
    setSignedSlots({ left: false, right: false });

    const loadStatus = async () => {
      setLoadingStatus(true);
      try {
        const res = await signatureApi.getDocumentSignature(documentType, documentId);
        const slots = res.data?.signed_slots || {};
        setSlotDetails(res.data?.slot_details || {});
        setSignedSlots({
          left: !!slots.left,
          right: !!slots.right,
        });
      } catch {
        setSignedSlots({ left: false, right: false });
        setSlotDetails({});
      } finally {
        setLoadingStatus(false);
      }
    };
    loadStatus();

    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await employeesApi.getAll({ limit: 1000 });
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
  }, [open, visitDoctor?.id, signatureSlot, documentType, documentId]);

  useEffect(() => {
    if (visitDoctor && employees.length > 0 && !selectedEmployeeId) {
      const found = employees.find((e) => e.id === visitDoctor.id);
      if (found) {
        setSelectedEmployeeId(found.id.toString());
      }
    }
  }, [visitDoctor?.id, employees, selectedEmployeeId]);

  useEffect(() => {
    if (step === "pin") {
      setTimeout(() => {
        const focusIndex = pin.findIndex(d => !d) === -1 ? 5 : Math.max(0, pin.findIndex(d => !d));
        inputRefs.current[focusIndex]?.focus();
      }, 100);
    }
  }, [step]);

  // Polling for signature completion
  useEffect(() => {
    let intervalId: any;
    if (open) {
      intervalId = setInterval(async () => {
        try {
          const res = await signatureApi.getDocumentSignature(documentType, documentId);
          const slots = res.data?.signed_slots || {};
          const details = res.data?.slot_details || {};

          setSlotDetails(details);

          setSignedSlots((prev) => {
            let changed = false;
            const next = { ...prev };

            if (slots.left && !prev.left) {
              changed = true;
              next.left = true;
            }
            if (slots.right && !prev.right) {
              changed = true;
              next.right = true;
            }

            // Side-effects inside updater are generally discouraged in StrictMode,
            // but for a polling interval that fires once per change, this is safe enough
            // since we guard it with the `!prev.x` check.
            if (changed) {
              setTimeout(() => {
                toast({
                  variant: "success",
                  title: "Berhasil ditandatangani",
                  description: `Tanda tangan berhasil diterima`,
                });
                if (step === "patient_qr" || step === "patient_direct") {
                  setStep("pick");
                }
                onSuccess?.();
              }, 0);
            }

            return changed ? next : prev;
          });

        } catch { }
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [open, step, documentType, documentId, onSuccess, toast]);

  useEffect(() => {
    if (step === "form" && signedSlots[slot] && slotDetails[slot]) {
      const detail = slotDetails[slot];
      if (detail.signer_role) {
        const roleLower = detail.signer_role.toLowerCase();
        if (roleLower.includes("dpjp") || roleLower.includes("dokter")) setRole("dpjp");
        else if (roleLower.includes("perawat") || roleLower.includes("nurse")) setRole("perawat");
        else if (roleLower.includes("pasien") || roleLower.includes("patient")) setRole("pasien");
        else setRole("kosong");
      }
      if (detail.signed_at) {
        setSignatureDate(detail.signed_at.substring(0, 10));
      }
      if (detail.notes) {
        const match = detail.notes.match(/label=([^;]+)/);
        if (match) {
          setSignatureName(match[1]);
        }
      }
      if (detail.signer_name && !detail.signer_role?.toLowerCase().includes("pasien")) {
        const emp = employees.find(e => e.nama_lengkap.toLowerCase() === detail.signer_name.toLowerCase());
        if (emp) setSelectedEmployeeId(emp.id.toString());
      }
    }
  }, [step, slot, signedSlots, slotDetails, employees]);

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

  const leftSlotLabel = slotLabels?.left || "Slot 1 (Kiri)";
  const rightSlotLabel = slotLabels?.right || "Slot 2 (Kanan)";

  const handleSelectEmployee = useCallback((emp: Employee) => {
    setSelectedEmployeeId(emp.id.toString());
    setSearchQuery("");
    setDropdownOpen(false);
  }, []);

  const handlePinChange = useCallback((index: number, value: string) => {
    const rawValue = value.replace(/\D/g, "");

    if (rawValue.length > 2) {
      const digits = rawValue.slice(0, 6);
      setPin((prev) => {
        const newPin = [...prev];
        for (let i = 0; i < digits.length; i++) {
          newPin[i] = digits[i];
        }
        return newPin;
      });
      const focusIdx = Math.min(digits.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const digit = rawValue.slice(-1);
    setPin((prev) => {
      const newPin = [...prev];
      newPin[index] = digit;
      return newPin;
    });

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && pin.join("").length === 6) {
      handleSign();
    }
  }, [pin]);

  useEffect(() => {
    setIsFaceValidation(false);
  }, [step]);

  const handleNext = () => {
    const needEmployee = role !== "pasien" && role !== "wali" && role !== "kosong";
    if (needEmployee && !selectedEmployeeId) {
      toast({ variant: "destructive", title: "Pilih penandatangan terlebih dahulu" });
      return;
    }
    if ((role === "pasien" || role === "wali") && signatureName.trim() === "") {
      return;
    }
    if (role === "pasien" || role === "wali") {
      if (sigPad.current?.isEmpty()) {
        toast({ variant: "destructive", title: "Peringatan", description: "Harap gambar tanda tangan terlebih dahulu." });
        return;
      }
      setIsFaceValidation(true);
    } else if (role === "kosong") {
      handleSign();
    } else {
      setStep("pin");
    }
  };

  const handlePatientModeSelect = async (mode: "qr" | "direct") => {
    setLoading(true);
    try {
      const res = await signatureApi.getPatientLink(documentType, documentId, signatureName, slot);
      setPatientToken(res.data.token);
      setStep(mode === "qr" ? "patient_qr" : "patient_direct");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat link tanda tangan" });
    } finally {
      setLoading(false);
    }
  };

  const handleDirectSubmit = async () => {
    if (sigPad.current?.isEmpty()) {
      toast({ variant: "destructive", title: "Peringatan", description: "Harap gambar tanda tangan terlebih dahulu." });
      return;
    }

    const photoImage = webcamRef.current?.getScreenshot();
    if (!photoImage) {
      toast({ variant: "destructive", title: "Peringatan", description: "Pastikan kamera menyala untuk validasi wajah." });
      return;
    }

    setLoading(true);
    try {
      const signatureImage = sigPad.current?.getCanvas().toDataURL("image/png");
      await api.post("/signature/submit", {
        token: patientToken,
        signature_image: signatureImage,
        photo_image: photoImage,
      });
      toast({
        variant: "success",
        title: "Berhasil ditandatangani",
        description: `Tanda tangan pasien berhasil disimpan`,
      });
      setSignedSlots((prev) => ({ ...prev, [slot]: true }));
      setStep("pick");
      onSuccess?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.response?.data?.error || "Gagal menyimpan tanda tangan" });
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    const pinValue = pin.join("");

    if (isRevoking) {
      if (pinValue.length !== 6) {
        toast({ variant: "destructive", title: "PIN harus 6 digit" });
        return;
      }
      setLoading(true);
      try {
        await signatureApi.revokeSignature({
          pin: pinValue,
          document_type: documentType,
          document_id: documentId,
          slot: slot,
          reason: "Dihapus oleh pengguna",
        });
        toast({
          variant: "success",
          title: "Berhasil",
          description: "Tanda tangan berhasil dihapus",
        });
        setSignedSlots((prev) => ({ ...prev, [slot]: false }));
        setPin(["", "", "", "", "", ""]);
        setStep("pick");
        setIsRevoking(false);
        onSuccess?.();
      } catch (err: any) {
        toast({ variant: "destructive", title: "Gagal", description: err?.response?.data?.error || "Gagal menghapus tanda tangan" });
      } finally {
        setLoading(false);
      }
      return;
    }

    const needEmployee = role !== "pasien" && role !== "wali" && role !== "kosong";
    const needPin = role !== "pasien" && role !== "wali" && role !== "kosong";
    if (needPin && pinValue.length !== 6) {
      toast({ variant: "destructive", title: "PIN harus 6 digit" });
      return;
    }
    if (needEmployee && !selectedEmployeeId) {
      toast({ variant: "destructive", title: "Pilih penandatangan terlebih dahulu" });
      return;
    }

    setLoading(true);
    try {
      await signatureApi.signDocument({
        pin: needPin ? pinValue : "",
        document_type: documentType,
        document_id: documentId,
        visit_id: visitId,
        signer_employee_id: needEmployee ? parseInt(selectedEmployeeId) : undefined,
        required_signatures: requiredSignatures,
        signature_slot: slot,
        signature_role: role,
        signature_location: location,
        signature_date: signatureDate,
        signature_name: (role === "pasien" || role === "wali") ? signatureName : "",
      });

      const emp = employees.find((e) => e.id.toString() === selectedEmployeeId);
      toast({
        variant: "success",
        title: "Berhasil ditandatangani",
        description: `Dokumen ditandatangani atas nama ${role === "pasien" ? signatureName : (emp?.nama_lengkap || "")}`,
      });
      setSignedSlots((prev) => ({ ...prev, [slot]: true }));
      setSelectedEmployeeId("");
      setPin(["", "", "", "", "", ""]);
      setPatientToken("");
      setIsRevoking(false);
      setStep("pick");
      onSuccess?.();
    } catch (err: any) {
      const emp = employees.find((e) => e.id.toString() === selectedEmployeeId);
      const namaPenandatangan = emp?.nama_lengkap ? `Penandatangan (${emp.nama_lengkap})` : "Anda";

      const msg = err?.response?.data?.error || "Gagal menandatangani dokumen";
      const code = err?.response?.data?.code;
      if (code === "PIN_NOT_SET") {
        toast({
          variant: "destructive",
          title: "PIN Belum Diatur",
          description: `${namaPenandatangan} belum mengatur PIN tanda tangan. Silakan atur di Pengaturan.`,
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
            {step === "pin" ? (isRevoking ? "Konfirmasi PIN Keamanan (Hapus)" : "Konfirmasi PIN Keamanan") : documentTitle}
          </DialogTitle>
        </DialogHeader>

        {(step === "pick" || step === "form") && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Pilih Slot TTD</Label>
              <div className="rounded-md border-2 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-28 justify-center border-2 text-base font-semibold transition-all",
                      slot === "left" && "border-primary bg-primary/5",
                      signedSlots.left && "border-green-600 bg-green-50 hover:bg-green-100"
                    )}
                    disabled={loading || loadingStatus}
                    onClick={() => {
                      setSlot("left");
                      if (fixedRoles?.left) setRole(fixedRoles.left);
                      setStep("form");
                    }}
                  >
                    <span className="flex flex-col items-center gap-2">
                      {signedSlots.left ? (
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                      ) : (
                        <>
                          <ShieldCheck className="h-7 w-7" />
                          <span>{leftSlotLabel}</span>
                        </>
                      )}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-28 justify-center border-2 text-base font-semibold transition-all",
                      slot === "right" && "border-primary bg-primary/5",
                      signedSlots.right && "border-green-600 bg-green-50 hover:bg-green-100"
                    )}
                    disabled={loading || loadingStatus}
                    onClick={() => {
                      setSlot("right");
                      if (fixedRoles?.right) setRole(fixedRoles.right);
                      setStep("form");
                    }}
                  >
                    <span className="flex flex-col items-center gap-2">
                      {signedSlots.right ? (
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                      ) : (
                        <>
                          <ShieldCheck className="h-7 w-7" />
                          <span>{rightSlotLabel}</span>
                        </>
                      )}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            {step === "form" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {!fixedRoles?.[slot] && (
                    <div className="space-y-1">
                      <Label className="text-xs">Peran</Label>
                      <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as any)}>
                        <option value="dpjp">DPJP</option>
                        <option value="perawat">Perawat</option>
                        <option value="pasien">Pasien</option>
                        <option value="wali">Wali</option>
                        <option value="kosong">Kosong</option>
                      </select>
                    </div>
                  )}
                  <div className={cn("space-y-1", fixedRoles?.[slot] ? "col-span-2" : "")}>
                    <Label className="text-xs">Tanggal</Label>
                    <Input type="date" value={signatureDate} onChange={(e) => setSignatureDate(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lokasi</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Contoh: Bojonegoro" className="h-9" />
                </div>
                {(role === "pasien" || role === "wali") && (
                  <div className="space-y-1">
                    <Label className="text-xs">{role === "wali" ? "Nama Wali" : "Nama Pasien"}</Label>
                    <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder={`Masukkan nama ${role}`} className="h-9" />
                  </div>
                )}
              </>
            )}

            {step === "form" && (propNeedEmployee ?? (role !== "pasien" && role !== "wali" && role !== "kosong")) && (
              <div className="space-y-1">
                <Label className="text-xs">Penandatangan</Label>
                {loadingEmployees ? (
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                ) : (
                  <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={dropdownOpen}
                        className="w-full justify-between font-normal h-9 px-3"
                      >
                        <span className="truncate">
                          {selectedEmployee
                            ? `${selectedEmployee.nama_lengkap}${selectedEmployee.spesialisasi ? ` - ${selectedEmployee.spesialisasi}` : ""}`
                            : <span className="text-muted-foreground">Pilih penandatangan...</span>}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Ketik nama penandatangan..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          {filteredEmployees.length === 0 ? (
                            <CommandEmpty>Tidak ditemukan</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {filteredEmployees.map((emp) => (
                                <CommandItem
                                  key={emp.id}
                                  value={emp.id.toString()}
                                  onSelect={() => {
                                    handleSelectEmployee(emp);
                                    setDropdownOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      selectedEmployeeId === emp.id.toString() ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{emp.nama_lengkap}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {emp.spesialisasi ? emp.spesialisasi : emp.tipe_karyawan}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
            {/* Actions for Form Step */}
            {step === "form" && (
              <div className="flex items-center justify-between pt-4">
                {signedSlots[slot as keyof typeof signedSlots] ? (
                  <Button variant="destructive" size="sm" onClick={() => { setIsRevoking(true); setStep("pin"); }} type="button" disabled={loading}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus TTD
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={
                      loading ||
                      loadingStatus ||
                      (role !== "pasien" && role !== "wali" && role !== "kosong" && !selectedEmployeeId) ||
                      ((role === "pasien" || role === "wali") && signatureName.trim() === "")
                    }
                  >
                    {signedSlots[slot as keyof typeof signedSlots] ? "Ganti TTD" : "Lanjut"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PIN Step */}
        {step === "pin" && (
          <>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-medium">
                  {isRevoking ? "Masukkan 6 digit PIN untuk membatalkan tanda tangan ini." : "Masukkan 6 digit PIN keamanan Anda untuk menandatangani dokumen ini."}
                </p>
              </div>
              <div className="space-y-3">
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
                      className="w-12 h-12 text-center text-xl font-mono p-0"
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setStep("form"); setIsRevoking(false); }}>
                Batal
              </Button>
              <Button onClick={handleSign} disabled={loading || pin.join("").length !== 6} variant={isRevoking ? "destructive" : "default"}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isRevoking ? "Hapus TTD" : "Tandatangani")}
              </Button>
            </div>
          </>
        )}

        {/* Patient Mode Selection */}
        {step === "patient_mode" && (
          <div className="space-y-4 py-4">
            <Label className="text-sm font-semibold">Metode Tanda Tangan Pasien</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Button variant="outline" className="h-28 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary/50" onClick={() => handlePatientModeSelect("direct")} disabled={loading}>
                <MonitorSmartphone className="h-8 w-8 text-primary" />
                <span className="font-semibold text-sm">Gunakan Layar Ini</span>
              </Button>
              <Button variant="outline" className="h-28 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary/50" onClick={() => handlePatientModeSelect("qr")} disabled={loading}>
                <QrCode className="h-8 w-8 text-primary" />
                <span className="font-semibold text-sm">Scan QR via HP</span>
              </Button>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" size="sm" onClick={() => setStep("form")} disabled={loading}>Kembali</Button>
            </div>
          </div>
        )}

        {/* Patient QR Mode */}
        {step === "patient_qr" && (
          <div className="space-y-4 py-4 text-center flex flex-col items-center">
            <h3 className="font-semibold">Scan QR Code Berikut</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Minta pasien untuk men-scan QR code ini dengan kamera HP mereka. Layar ini akan otomatis tertutup jika pasien sudah menekan Simpan di HP.
            </p>
            <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
              <QRCodeSVG value={`${window.location.origin}/patient-sign?token=${patientToken}`} size={220} />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-primary mt-4 bg-primary/5 px-4 py-2 rounded-full">
              <Loader2 className="h-4 w-4 animate-spin" />
              Menunggu respon dari HP pasien...
            </div>
            <div className="flex gap-2 justify-end pt-6 w-full">
              <Button variant="outline" size="sm" onClick={() => setStep("patient_mode")} disabled={loading}>Batal</Button>
            </div>
          </div>
        )}

        {/* Patient Direct Mode */}
        {step === "patient_direct" && (
          <div className="space-y-4 py-2">
            
            {/* Signature Step */}
            <div className={`flex flex-col ${isFaceValidation ? 'hidden' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <PenTool className="h-5 w-5 text-primary" />
                <Label className="text-sm font-medium">Silakan gambar tanda tangan di bawah:</Label>
              </div>
              <div className="border border-gray-300 rounded-xl overflow-hidden bg-white w-full h-[220px] shadow-inner relative mb-4">
                <SignatureCanvas
                  ref={sigPad}
                  penColor="black"
                  canvasProps={{ className: "w-full h-full cursor-crosshair touch-none absolute inset-0 bg-white" }}
                />
                <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-gray-200 pointer-events-none opacity-50" />
              </div>
              
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 p-4 shrink-0 -mx-4 -mb-4">
                {signedSlots[slot as keyof typeof signedSlots] ? (
                  <Button variant="destructive" onClick={() => { setIsRevoking(true); setStep("pin"); }} type="button">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus TTD
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => sigPad.current?.clear()} className="bg-white" type="button">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Ulangi
                  </Button>
                )}
                <Button onClick={handleNext} className="min-w-[120px]">
                  Lanjut Validasi Wajah
                </Button>
              </div>
            </div>

            {/* Face Validation Step */}
            <div className={`flex flex-col ${!isFaceValidation ? 'hidden' : ''}`}>
              <div className="flex flex-col items-center justify-center p-4 bg-blue-50/50 rounded-xl mb-4 border border-blue-100">
                <div className="w-[180px] h-[180px] shrink-0 bg-black rounded-full overflow-hidden border-4 border-primary/20 mb-4 shadow-md">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center text-blue-900">
                  <p className="font-bold text-lg mb-1">Validasi Wajah</p>
                  <p className="text-sm">Posisikan wajah pasien di kamera. Wajah akan difoto otomatis saat menekan Simpan.</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 p-4 shrink-0 -mx-4 -mb-4">
                <Button variant="outline" onClick={() => setIsFaceValidation(false)} className="bg-white" type="button">
                  Kembali
                </Button>
                <Button onClick={handleDirectSubmit} disabled={loading} className="min-w-[120px]">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (signedSlots[slot as keyof typeof signedSlots] ? "Simpan Perubahan" : "Simpan TTD & Wajah")}
                </Button>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
