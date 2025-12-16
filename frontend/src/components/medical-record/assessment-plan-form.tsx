import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Save, 
  ClipboardList, 
  Loader2, 
  FileText, 
  Heart, 
  Utensils,
  Activity,
  GraduationCap,
  Stethoscope,
  Users,
  Eye
} from "lucide-react";
import { medicalRecordsApi, type AssessmentPlan } from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AssessmentPlanFormProps {
  visitId: number;
  initialData?: AssessmentPlan;
  onSave?: (data: AssessmentPlan) => void;
  readOnly?: boolean;
}

export function AssessmentPlanForm({ visitId, initialData, onSave, readOnly = false }: AssessmentPlanFormProps) {
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

  const filledMainFields = [
    formData.clinical_assessment,
    formData.treatment_plan,
    formData.prognosis
  ].filter(v => v && v.trim() !== "").length;

  const filledDetailFields = [
    formData.medication_plan,
    formData.diet_plan,
    formData.activity_plan,
    formData.education_plan,
    formData.procedure_plan,
    formData.consultation_plan,
    formData.monitoring_plan
  ].filter(v => v && v.trim() !== "").length;

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
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Assessment & Plan
            </CardTitle>
            <CardDescription>
              Penilaian klinis dan rencana tatalaksana pasien
            </CardDescription>
          </div>
          <Badge variant={filledMainFields > 0 ? "default" : "secondary"}>
            {filledMainFields}/3 Utama | {filledDetailFields}/7 Detail
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
        <form onSubmit={handleSubmit}>
          <fieldset disabled={readOnly} className="space-y-6">
          
          {/* Section 1: Asesmen Klinis */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <CardTitle className="text-base font-semibold">Asesmen Klinis</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
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

              {/* Prognosis */}
              <div className="space-y-2">
                <Label htmlFor="prognosis" className="text-sm font-semibold">
                  Prognosis
                </Label>
                <Textarea
                  id="prognosis"
                  placeholder="Perkiraan outcome penyakit pasien berdasarkan kondisi klinis (baik/buruk, ad bonam/dubia ad bonam/dubia ad malam)..."
                  value={formData.prognosis}
                  onChange={(e) => handleChange("prognosis", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Quo ad vitam, quo ad functionam, quo ad sanationam
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Rencana Terapi */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Heart className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle className="text-base font-semibold">Rencana Terapi</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Treatment Plan */}
              <div className="space-y-2">
                <Label htmlFor="treatment_plan" className="text-sm font-semibold">
                  Rencana Penatalaksanaan <span className="text-destructive">*</span>
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

              {/* Monitoring Plan */}
              <div className="space-y-2">
                <Label htmlFor="monitoring_plan" className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  Rencana Monitoring
                </Label>
                <Textarea
                  id="monitoring_plan"
                  placeholder="Parameter yang perlu dipantau dan jadwal monitoring..."
                  value={formData.monitoring_plan}
                  onChange={(e) => handleChange("monitoring_plan", e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Vital sign, lab, imaging, atau parameter klinis lain yang perlu dipantau
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Rencana Detail */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                    <ClipboardList className="h-5 w-5 text-green-500" />
                  </div>
                  <CardTitle className="text-base font-semibold">Rencana Detail</CardTitle>
                </div>
                <Badge variant={filledDetailFields > 0 ? "default" : "outline"}>
                  {filledDetailFields}/6
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medication_plan" className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4 text-green-500" />
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
                  <Label htmlFor="diet_plan" className="text-sm flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-green-500" />
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
                  <Label htmlFor="activity_plan" className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
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
                  <Label htmlFor="education_plan" className="text-sm flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-green-500" />
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
                  <Label htmlFor="procedure_plan" className="text-sm flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-green-500" />
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
                  <Label htmlFor="consultation_plan" className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
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
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Assessment & Plan
            </Button>
          </div>
          </fieldset>
        </form>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
