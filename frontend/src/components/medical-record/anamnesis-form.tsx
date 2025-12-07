import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";
import type { Anamnesis } from "@/lib/api";

interface AnamnesisFormProps {
  visitId: number;
  onSave?: (data: any) => void;
}

const defaultFormData = {
  chief_complaint: "",
  history_of_present_illness: "",
  past_medical_history: "",
  family_history: "",
  social_history: "",
  allergies: "",
  current_medications: "",
};

export function AnamnesisForm({ visitId, onSave }: AnamnesisFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);

  // Load existing data on mount
  useEffect(() => {
    const loadAnamnesis = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getAnamnesis(visitId);
        const data = response.data as Anamnesis;
        if (data && data.id) {
          setFormData({
            chief_complaint: data.chief_complaint || "",
            history_of_present_illness: data.history_of_present_illness || "",
            past_medical_history: data.past_medical_history || "",
            family_history: data.family_history || "",
            social_history: data.social_history || "",
            allergies: data.allergies || "",
            current_medications: data.current_medications || "",
          });
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
      }
    };

    loadAnamnesis();
  }, [visitId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Anamnesis</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/50">
        <CardTitle className="text-lg">Anamnesis</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Keluhan Utama */}
          <div className="space-y-2">
            <Label htmlFor="chief_complaint" className="text-sm font-semibold">
              Keluhan Utama <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="chief_complaint"
              placeholder="Masukkan keluhan utama pasien..."
              value={formData.chief_complaint}
              onChange={(e) => handleChange("chief_complaint", e.target.value)}
              className="min-h-[80px] resize-none"
              required
            />
          </div>

          {/* Riwayat Penyakit Sekarang */}
          <div className="space-y-2">
            <Label htmlFor="history_of_present_illness" className="text-sm font-semibold">
              Riwayat Penyakit Sekarang <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="history_of_present_illness"
              placeholder="Jelaskan riwayat penyakit yang sedang dialami (onset, durasi, karakteristik, dll)..."
              value={formData.history_of_present_illness}
              onChange={(e) => handleChange("history_of_present_illness", e.target.value)}
              className="min-h-[120px] resize-none"
              required
            />
          </div>

          {/* Riwayat Penyakit Dahulu */}
          <div className="space-y-2">
            <Label htmlFor="past_medical_history" className="text-sm font-semibold">
              Riwayat Penyakit Dahulu
            </Label>
            <Textarea
              id="past_medical_history"
              placeholder="Riwayat penyakit yang pernah diderita sebelumnya..."
              value={formData.past_medical_history}
              onChange={(e) => handleChange("past_medical_history", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Riwayat Penyakit Keluarga */}
          <div className="space-y-2">
            <Label htmlFor="family_history" className="text-sm font-semibold">
              Riwayat Penyakit Keluarga
            </Label>
            <Textarea
              id="family_history"
              placeholder="Riwayat penyakit dalam keluarga (hipertensi, diabetes, dll)..."
              value={formData.family_history}
              onChange={(e) => handleChange("family_history", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Riwayat Sosial */}
          <div className="space-y-2">
            <Label htmlFor="social_history" className="text-sm font-semibold">
              Riwayat Sosial
            </Label>
            <Textarea
              id="social_history"
              placeholder="Kebiasaan merokok, konsumsi alkohol, pekerjaan, dll..."
              value={formData.social_history}
              onChange={(e) => handleChange("social_history", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Alergi */}
          <div className="space-y-2">
            <Label htmlFor="allergies" className="text-sm font-semibold">
              Alergi
            </Label>
            <Input
              id="allergies"
              placeholder="Alergi obat, makanan, atau lainnya (pisahkan dengan koma)"
              value={formData.allergies}
              onChange={(e) => handleChange("allergies", e.target.value)}
              className="h-11"
            />
          </div>

          {/* Obat yang Sedang Dikonsumsi */}
          <div className="space-y-2">
            <Label htmlFor="current_medications" className="text-sm font-semibold">
              Obat yang Sedang Dikonsumsi
            </Label>
            <Textarea
              id="current_medications"
              placeholder="Daftar obat yang sedang dikonsumsi pasien saat ini..."
              value={formData.current_medications}
              onChange={(e) => handleChange("current_medications", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-4">
            <Button type="submit" size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Simpan Anamnesis
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
