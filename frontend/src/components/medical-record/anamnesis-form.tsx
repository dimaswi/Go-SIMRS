import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Loader2, FileText, History, Pill, AlertCircle } from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";
import type { Anamnesis } from "@/lib/api";

interface AnamnesisFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  readOnly?: boolean;
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

export function AnamnesisForm({ visitId, onSave, readOnly = false }: AnamnesisFormProps) {
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

  const filledFields = Object.values(formData).filter(v => v && v.trim() !== "").length;
  const totalFields = 7;

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
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Anamnesis
            </CardTitle>
            <CardDescription>
              Keluhan utama dan riwayat penyakit pasien
            </CardDescription>
          </div>
          <Badge variant={filledFields > 0 ? "default" : "secondary"}>
            {filledFields}/{totalFields}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
        <form onSubmit={handleSubmit}>
          <fieldset disabled={readOnly} className="space-y-6">
          
          {/* Section 1: Keluhan Utama & Riwayat Penyakit Sekarang */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <CardTitle className="text-base font-semibold">Keluhan & Riwayat Penyakit</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
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
                <p className="text-xs text-muted-foreground">
                  Detail onset, lokasi, durasi, karakteristik, faktor yang memperberat/meringankan
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Riwayat Medis */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <History className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle className="text-base font-semibold">Riwayat Medis</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
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
            </CardContent>
          </Card>

          {/* Section 3: Alergi & Obat */}
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <CardTitle className="text-base font-semibold">Alergi & Obat</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Alergi */}
              <div className="space-y-2">
                <Label htmlFor="allergies" className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Alergi
                </Label>
                <Input
                  id="allergies"
                  placeholder="Alergi obat, makanan, atau lainnya (pisahkan dengan koma)"
                  value={formData.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Penting untuk keamanan pemberian obat
                </p>
              </div>

              {/* Obat yang Sedang Dikonsumsi */}
              <div className="space-y-2">
                <Label htmlFor="current_medications" className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="h-4 w-4 text-amber-500" />
                  Obat yang Sedang Dikonsumsi
                </Label>
                <Textarea
                  id="current_medications"
                  placeholder="Daftar obat yang sedang dikonsumsi pasien saat ini..."
                  value={formData.current_medications}
                  onChange={(e) => handleChange("current_medications", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Termasuk dosis dan frekuensi untuk menghindari interaksi obat
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          {!readOnly && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Simpan Anamnesis
              </Button>
            </div>
          )}
          </fieldset>
        </form>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
