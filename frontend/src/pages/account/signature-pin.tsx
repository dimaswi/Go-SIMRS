import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signatureApi } from "@/lib/api";
import { Loader2, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";

export default function SignaturePINSetupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.has_signature_pin) {
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
      <Label>{label}</Label>
      <div className="flex justify-center gap-2">
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

      // Update local user data
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.has_signature_pin = true;
      localStorage.setItem("user", JSON.stringify(user));

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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {mode === "setup" ? "Atur PIN Tanda Tangan" : "Ubah PIN Tanda Tangan"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "setup" 
              ? "PIN 6 digit ini akan digunakan untuk menandatangani dokumen secara digital"
              : "Ubah PIN tanda tangan Anda untuk keamanan akun"
            }
          </p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {mode === "setup" ? "Setup PIN" : "Ubah PIN"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
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

              <Button
                onClick={handleSetup}
                disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d) || !password}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Simpan PIN
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Old PIN */}
              {renderPinInputs(oldPin, setOldPin, oldPinRefs, "PIN Lama")}
              
              {/* New PIN */}
              {renderPinInputs(newPin, setNewPin, newPinRefs, "PIN Baru")}
              
              {/* Confirm New PIN */}
              {renderPinInputs(confirmNewPin, setConfirmNewPin, confirmNewPinRefs, "Konfirmasi PIN Baru")}

              <Button
                onClick={handleChange}
                disabled={loading || oldPin.some(d => !d) || newPin.some(d => !d) || confirmNewPin.some(d => !d)}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Ubah PIN
                  </>
                )}
              </Button>
            </>
          )}

          {/* Info */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">Penting:</p>
            <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1">
              <li>PIN tanda tangan berbeda dengan password login</li>
              <li>Jangan bagikan PIN Anda kepada siapapun</li>
              <li>PIN digunakan sebagai bukti Anda yang menandatangani dokumen</li>
              <li>Hubungi administrator jika Anda lupa PIN</li>
            </ul>
          </div>

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
        </CardContent>
      </Card>
    </div>
  );
}
