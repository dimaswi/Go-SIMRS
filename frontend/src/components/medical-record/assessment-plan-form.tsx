import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, ClipboardList, Loader2 } from "lucide-react";
import { medicalRecordsApi, type AssessmentPlan } from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";

interface AssessmentPlanFormProps {
  visitId: number;
  initialData?: AssessmentPlan;
  onSave?: (data: AssessmentPlan) => void;
}

export function AssessmentPlanForm({ visitId, initialData, onSave }: AssessmentPlanFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    clinical_assessment: initialData?.clinical_assessment || "",
    prognosis: initialData?.prognosis || "",
    treatment_plan: initialData?.treatment_plan || "",
    medication_plan: initialData?.medication_plan || "",
    diet_plan: initialData?.diet_plan || "",
    activity_plan: initialData?.activity_plan || "",
    education_plan: initialData?.education_plan || "",
    monitoring_plan: initialData?.monitoring_plan || "",
    procedure_plan: initialData?.procedure_plan || "",
    consultation_plan: initialData?.consultation_plan || "",
  });

  // Load existing data
  useEffect(() => {
    const loadData = async () => {
      if (!visitId) return;
      setLoading(true);
      try {
        const response = await medicalRecordsApi.getAssessmentPlan(visitId);
        if (response.data) {
          setFormData({
            clinical_assessment: response.data.clinical_assessment || "",
            prognosis: response.data.prognosis || "",
            treatment_plan: response.data.treatment_plan || "",
            medication_plan: response.data.medication_plan || "",
            diet_plan: response.data.diet_plan || "",
            activity_plan: response.data.activity_plan || "",
            education_plan: response.data.education_plan || "",
            monitoring_plan: response.data.monitoring_plan || "",
            procedure_plan: response.data.procedure_plan || "",
            consultation_plan: response.data.consultation_plan || "",
          });
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [visitId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await medicalRecordsApi.saveAssessmentPlan(visitId, formData);
      toast({
        title: "Berhasil",
        description: "Assessment & Plan berhasil disimpan",
      });
      onSave?.(response.data);
    } catch {
      toast({
        title: "Gagal",
        description: "Gagal menyimpan Assessment & Plan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Assessment & Plan</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Clinical Assessment / Clinical Impression */}
          <div className="space-y-2">
            <Label htmlFor="clinical_assessment" className="text-sm font-semibold">
              Kesan Klinis (Clinical Impression) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="clinical_assessment"
              placeholder="Ringkasan kesan klinis berdasarkan anamnesis dan pemeriksaan fisik. Contoh: Pasien dengan gejala dispepsia fungsional, tidak ditemukan tanda bahaya (red flags)..."
              value={formData.clinical_assessment}
              onChange={(e) => handleChange("clinical_assessment", e.target.value)}
              className="min-h-[150px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Jelaskan interpretasi klinis dari temuan pemeriksaan dan diagnosis kerja
            </p>
          </div>

          {/* Treatment Plan */}
          <div className="space-y-2">
            <Label htmlFor="treatment_plan" className="text-sm font-semibold">
              Rencana Terapi <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="treatment_plan"
              placeholder="Rencana penatalaksanaan yang akan dilakukan:
• Farmakologi: Obat-obatan yang akan diberikan
• Non-farmakologi: Diet, edukasi, modifikasi gaya hidup
• Pemeriksaan penunjang: Lab, radiologi yang diperlukan
• Konsultasi: Rujukan ke spesialis jika diperlukan
• Monitoring: Parameter yang perlu dipantau"
              value={formData.treatment_plan}
              onChange={(e) => handleChange("treatment_plan", e.target.value)}
              className="min-h-[180px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tuliskan rencana penatalaksanaan lengkap termasuk terapi farmakologi dan non-farmakologi
            </p>
          </div>

          {/* Prognosis */}
          <div className="space-y-2">
            <Label htmlFor="prognosis" className="text-sm font-semibold">
              Prognosis
            </Label>
            <Textarea
              id="prognosis"
              placeholder="Perkiraan outcome penyakit pasien berdasarkan kondisi klinis..."
              value={formData.prognosis}
              onChange={(e) => handleChange("prognosis", e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Detailed Plans Grid */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Rencana Detail</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medication_plan" className="text-sm">
                  Rencana Obat
                </Label>
                <Textarea
                  id="medication_plan"
                  placeholder="Obat-obatan yang akan diberikan..."
                  value={formData.medication_plan}
                  onChange={(e) => handleChange("medication_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet_plan" className="text-sm">
                  Rencana Diet
                </Label>
                <Textarea
                  id="diet_plan"
                  placeholder="Diet khusus yang direkomendasikan..."
                  value={formData.diet_plan}
                  onChange={(e) => handleChange("diet_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity_plan" className="text-sm">
                  Rencana Aktivitas
                </Label>
                <Textarea
                  id="activity_plan"
                  placeholder="Anjuran aktivitas fisik..."
                  value={formData.activity_plan}
                  onChange={(e) => handleChange("activity_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education_plan" className="text-sm">
                  Rencana Edukasi
                </Label>
                <Textarea
                  id="education_plan"
                  placeholder="Edukasi kesehatan untuk pasien..."
                  value={formData.education_plan}
                  onChange={(e) => handleChange("education_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="procedure_plan" className="text-sm">
                  Rencana Tindakan
                </Label>
                <Textarea
                  id="procedure_plan"
                  placeholder="Prosedur/tindakan yang akan dilakukan..."
                  value={formData.procedure_plan}
                  onChange={(e) => handleChange("procedure_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultation_plan" className="text-sm">
                  Rencana Konsultasi
                </Label>
                <Textarea
                  id="consultation_plan"
                  placeholder="Konsultasi ke spesialis yang diperlukan..."
                  value={formData.consultation_plan}
                  onChange={(e) => handleChange("consultation_plan", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Monitoring Plan */}
          <div className="space-y-2">
            <Label htmlFor="monitoring_plan" className="text-sm font-semibold">
              Rencana Monitoring
            </Label>
            <Textarea
              id="monitoring_plan"
              placeholder="Parameter yang perlu dipantau dan jadwal monitoring..."
              value={formData.monitoring_plan}
              onChange={(e) => handleChange("monitoring_plan", e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Assessment & Plan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
