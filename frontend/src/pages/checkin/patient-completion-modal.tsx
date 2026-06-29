import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { patientsApi, type Patient, type PatientRequest } from "@/lib/api/patients";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PatientCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onSuccess: () => void;
}

export function PatientCompletionModal({ isOpen, onClose, patient, onSuccess }: PatientCompletionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    agama: patient.agama || "",
    golongan_darah: patient.golongan_darah || "",
    status_perkawinan: patient.status_perkawinan || "",
    pekerjaan: patient.pekerjaan || "",
    nama_penanggung_jawab: patient.nama_penanggung_jawab || "",
    hubungan_penanggung_jawab: patient.hubungan_penanggung_jawab || "",
    telepon_penanggung_jawab: patient.telepon_penanggung_jawab || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.agama || !formData.golongan_darah || !formData.status_perkawinan || !formData.pekerjaan || !formData.nama_penanggung_jawab || !formData.hubungan_penanggung_jawab || !formData.telepon_penanggung_jawab) {
      toast({
        variant: "destructive",
        title: "Data Belum Lengkap",
        description: "Harap isi semua field yang tersedia.",
      });
      return;
    }

    setLoading(true);
    try {
      // Prepare update payload
      const payload: Partial<PatientRequest> = {
        ...patient,
        ...formData,
      } as any;

      // Update patient
      await patientsApi.update(patient.id, payload as PatientRequest);

      // Finalize patient so this doesn't pop up again
      await patientsApi.finalize(patient.id);

      toast({
        variant: "success",
        title: "Data Berhasil Dilengkapi",
        description: "Terima kasih telah melengkapi data master.",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan Data",
        description: error.response?.data?.error || "Terjadi kesalahan sistem.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lengkapi Data Master Pasien</DialogTitle>
          <DialogDescription>
            Karena Anda adalah pasien baru via Mobile JKN, harap lengkapi data krusial berikut agar tidak perlu antre di Loket Pendaftaran.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agama *</Label>
              <Select value={formData.agama} onValueChange={(val) => handleChange("agama", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Agama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Islam">Islam</SelectItem>
                  <SelectItem value="Kristen">Kristen</SelectItem>
                  <SelectItem value="Katolik">Katolik</SelectItem>
                  <SelectItem value="Hindu">Hindu</SelectItem>
                  <SelectItem value="Buddha">Buddha</SelectItem>
                  <SelectItem value="Konghucu">Konghucu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Golongan Darah *</Label>
              <Select value={formData.golongan_darah} onValueChange={(val) => handleChange("golongan_darah", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Gol. Darah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="AB">AB</SelectItem>
                  <SelectItem value="O">O</SelectItem>
                  <SelectItem value="Tidak Diketahui">Tidak Diketahui</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Perkawinan *</Label>
              <Select value={formData.status_perkawinan} onValueChange={(val) => handleChange("status_perkawinan", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belum Kawin">Belum Kawin</SelectItem>
                  <SelectItem value="Kawin">Kawin</SelectItem>
                  <SelectItem value="Cerai Hidup">Cerai Hidup</SelectItem>
                  <SelectItem value="Cerai Mati">Cerai Mati</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pekerjaan *</Label>
              <Input
                placeholder="Misal: Wiraswasta"
                value={formData.pekerjaan}
                onChange={(e) => handleChange("pekerjaan", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t mt-2">
            <h4 className="text-sm font-medium">Kontak Darurat / Penanggung Jawab</h4>
          </div>

          <div className="grid gap-2">
            <Label>Nama Penanggung Jawab *</Label>
            <Input
              placeholder="Nama Lengkap"
              value={formData.nama_penanggung_jawab}
              onChange={(e) => handleChange("nama_penanggung_jawab", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hubungan *</Label>
              <Input
                placeholder="Misal: Suami/Istri/Anak"
                value={formData.hubungan_penanggung_jawab}
                onChange={(e) => handleChange("hubungan_penanggung_jawab", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>No. Telepon *</Label>
              <Input
                placeholder="08123..."
                type="tel"
                value={formData.telepon_penanggung_jawab}
                onChange={(e) => handleChange("telepon_penanggung_jawab", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Simpan & Lanjutkan ke Poli
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
