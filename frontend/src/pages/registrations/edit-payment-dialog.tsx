import { useState, useEffect } from "react";
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
import { registrationApi } from "@/lib/api/queue";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: number;
  currentPaymentMethod: string;
  currentBpjsNumber?: string;
  currentInsuranceName?: string;
  currentInsuranceNumber?: string;
  patientBpjsNumber?: string;
  onSuccess?: () => void;
}

export function EditPaymentDialog({
  open,
  onOpenChange,
  registrationId,
  currentPaymentMethod,
  currentBpjsNumber,
  currentInsuranceName,
  currentInsuranceNumber,
  patientBpjsNumber,
  onSuccess,
}: EditPaymentDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payment_method: "cash",
    bpjs_number: "",
    insurance_name: "",
    insurance_number: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        payment_method: currentPaymentMethod || "cash",
        bpjs_number: currentBpjsNumber || patientBpjsNumber || "",
        insurance_name: currentInsuranceName || "",
        insurance_number: currentInsuranceNumber || "",
      });
    }
  }, [open, currentPaymentMethod, currentBpjsNumber, currentInsuranceName, currentInsuranceNumber, patientBpjsNumber]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await registrationApi.update(registrationId, {
        payment_method: form.payment_method,
        bpjs_number: form.payment_method === "bpjs" ? form.bpjs_number : undefined,
        insurance_name: form.payment_method === "insurance" ? form.insurance_name : undefined,
        insurance_number: form.payment_method === "insurance" ? form.insurance_number : undefined,
      });
      toast({
        title: "Berhasil",
        description: "Metode pembayaran berhasil diubah",
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal mengubah metode pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ubah Metode Pembayaran</DialogTitle>
          <DialogDescription>
            Ubah penjamin / asuransi untuk pendaftaran ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Metode Pembayaran</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "cash", label: "Umum / Cash" },
                { value: "bpjs", label: "BPJS" },
                { value: "insurance", label: "Asuransi" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, payment_method: opt.value }))}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    form.payment_method === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.payment_method === "bpjs" && (
            <div className="space-y-2">
              <Label htmlFor="bpjs_number">Nomor BPJS</Label>
              <Input
                id="bpjs_number"
                placeholder="Masukkan nomor kartu BPJS"
                value={form.bpjs_number}
                onChange={(e) => setForm((prev) => ({ ...prev, bpjs_number: e.target.value }))}
              />
            </div>
          )}

          {form.payment_method === "insurance" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="insurance_name">Nama Asuransi</Label>
                <Input
                  id="insurance_name"
                  placeholder="Masukkan nama asuransi"
                  value={form.insurance_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, insurance_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance_number">Nomor Polis</Label>
                <Input
                  id="insurance_number"
                  placeholder="Masukkan nomor polis asuransi"
                  value={form.insurance_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, insurance_number: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
