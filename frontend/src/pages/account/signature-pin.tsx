import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signatureApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Loader2, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export default function SignaturePINSetupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();

  const [mode, setMode] = useState<"setup" | "change">("setup");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Setup mode states
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);

  // Change mode states
  const [oldPin, setOldPin] = useState(["", "", "", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", "", "", ""]);
  const [confirmNewPin, setConfirmNewPin] = useState(["", "", "", "", "", ""]);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const oldPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmNewPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    document.title = "Pengaturan PIN Tanda Tangan";

    // Check if user already has PIN set
    if (user?.has_signature_pin) {
      setMode("change");
    }
  }, []);

  const handlePinChange = (
    index: number,
    value: string,
    stateSetter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (value && !/^\d$/.test(value)) return;

    stateSetter(prev => {
      const newPin = [...prev];
      newPin[index] = value;
      return newPin;
    });

    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    state: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === "Backspace" && !state[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const renderPinInputs = (
    state: string[],
    stateSetter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    label: string
  ) => (
    <div className="space-y-2">
      <Label className="flex justify-center">{label}</Label>
      <div className="flex justify-center gap-2 sm:gap-4 flex-wrap">
        {state.map((digit, index) => (
          <Input
            key={index}
            ref={(el) => { refs.current[index] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handlePinChange(index, e.target.value, stateSetter, refs)}
            onKeyDown={(e) => handleKeyDown(index, e, state, refs)}
            className="w-12 h-12 text-center text-xl font-mono"
            disabled={loading}
          />
        ))}
      </div>
    </div>
  );

  const handleSetup = async () => {
    const pinValue = pin.join("");
    const confirmPinValue = confirmPin.join("");

    if (pinValue.length !== 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN harus 6 digit",
      });
      return;
    }

    if (pinValue !== confirmPinValue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN dan konfirmasi PIN tidak sama",
      });
      return;
    }

    if (!password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Masukkan password akun Anda",
      });
      return;
    }

    setLoading(true);
    try {
      await signatureApi.setupPIN({
        pin: pinValue,
        confirm_pin: confirmPinValue,
        password: password,
      });

      // Update global user data
      if (user) {
        setUser({ ...user, has_signature_pin: true });
      }

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "PIN tanda tangan berhasil diatur",
      });

      navigate(-1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.error || "Gagal mengatur PIN",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async () => {
    const oldPinValue = oldPin.join("");
    const newPinValue = newPin.join("");
    const confirmNewPinValue = confirmNewPin.join("");

    if (oldPinValue.length !== 6 || newPinValue.length !== 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN harus 6 digit",
      });
      return;
    }

    if (newPinValue !== confirmNewPinValue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN baru dan konfirmasi tidak sama",
      });
      return;
    }

    if (oldPinValue === newPinValue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN baru harus berbeda dengan PIN lama",
      });
      return;
    }

    setLoading(true);
    try {
      await signatureApi.changePIN({
        old_pin: oldPinValue,
        new_pin: newPinValue,
        confirm_pin: confirmNewPinValue,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "PIN tanda tangan berhasil diubah",
      });

      navigate(-1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.error || "Gagal mengubah PIN",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={ShieldCheck}
        title={mode === "setup" ? "Atur PIN Tanda Tangan" : "Ubah PIN Tanda Tangan"}
        description={mode === "setup"
          ? "PIN 6 digit ini akan digunakan untuk menandatangani dokumen secara digital"
          : "Ubah PIN tanda tangan Anda untuk keamanan akun"
        }
        onBack={() => navigate(-1)}
      />

      <PageContent>
        <section className="w-full max-w-xl space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {mode === "setup" ? "Setup PIN" : "Ubah PIN"}
            </h3>
          </div>
          <div className="space-y-6">
            {mode === "setup" ? (
              <>
                {/* Password verification */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Password Akun (untuk verifikasi)
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password akun Anda"
                      className="rounded-none"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full rounded-none"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* New PIN */}
                {renderPinInputs(pin, setPin, pinRefs, "PIN Baru (6 digit)")}

                {/* Confirm PIN */}
                {renderPinInputs(confirmPin, setConfirmPin, confirmPinRefs, "Konfirmasi PIN")}

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="rounded-none h-8 px-4 text-xs font-medium shadow-none"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSetup}
                    disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d) || !password}
                    className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-4 text-xs font-semibold shadow-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Simpan PIN
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Old PIN */}
                {renderPinInputs(oldPin, setOldPin, oldPinRefs, "PIN Lama")}

                {/* New PIN */}
                {renderPinInputs(newPin, setNewPin, newPinRefs, "PIN Baru")}

                {/* Confirm New PIN */}
                {renderPinInputs(confirmNewPin, setConfirmNewPin, confirmNewPinRefs, "Konfirmasi PIN Baru")}

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="rounded-none h-8 px-4 text-xs font-medium shadow-none"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleChange}
                    disabled={loading || oldPin.some(d => !d) || newPin.some(d => !d) || confirmNewPin.some(d => !d)}
                    className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-4 text-xs font-semibold shadow-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Ubah PIN
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {mode === "setup" && (
              <Button
                variant="link"
                onClick={() => setMode("change")}
                className="w-full text-sm"
              >
                Sudah punya PIN? Ubah PIN
              </Button>
            )}
            {mode === "change" && (
              <Button
                variant="link"
                onClick={() => setMode("setup")}
                className="w-full text-sm"
              >
                Belum punya PIN? Atur PIN baru
              </Button>
            )}
          </div>
        </section>
      </PageContent>
    </PageShell>
  );
}
