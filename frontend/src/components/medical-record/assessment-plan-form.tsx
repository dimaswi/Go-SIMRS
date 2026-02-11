import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Save, 
  ClipboardList, 
  Loader2, 
  Heart, 
  Utensils,
  Activity,
  GraduationCap,
  Stethoscope,
  Users,
  Eye
} from "lucide-react";
import { medicalRecordsApi, type AssessmentPlan } from "@/lib/api/medical-records";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { useEditMode, EditModeBanner, EditConfirmDialog, PINVerificationDialog } from "./edit-mode-controller";
import { useToast } from "@/hooks/use-toast";

interface AssessmentPlanFormProps {
  visitId: number;
  initialData?: AssessmentPlan;
  onSave?: (data: AssessmentPlan) => void;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
}

export function AssessmentPlanForm({ visitId, initialData, onSave, readOnly = false, isPatientDischarged = false }: AssessmentPlanFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assessmentPlanId, setAssessmentPlanId] = useState<number | undefined>();

  // Edit mode controller for post-discharge edits
  const {
    isEditing,
    editReason,
    showEditDialog,
    showPINDialog,
    setShowEditDialog,
    setShowPINDialog,
    setEditReason,
    handleRequestEdit,
    handleConfirmEdit,
    resetEditMode,
    requestPINVerification,
    // PIN related
    pin,
    verifyingPIN,
    pinInputRefs,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
  } = useEditMode({
    isPatientDischarged,
    recordType: "assessment_plan",
  });

  // Determine if form should be disabled
  const isFormDisabled = readOnly || (isPatientDischarged && !isEditing);
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
          if (response.data.id) {
            setAssessmentPlanId(response.data.id);
          }
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

  const doSave = async () => {
    setSaving(true);
    
    // Log edit if patient is discharged
    if (isPatientDischarged && assessmentPlanId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "assessment_plan",
          record_id: assessmentPlanId,
          action: "edit",
          reason: editReason || "Edit setelah pasien pulang",
        });
      } catch (error) {
        console.error("Failed to log edit:", error);
      }
    }
    
    try {
      const response = await medicalRecordsApi.saveAssessmentPlan(visitId, formData);
      toast({
        title: "Berhasil",
        description: "Assessment & Plan berhasil disimpan",
      });
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      onSave?.(response.data);
      resetEditMode();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If patient is discharged, verify PIN before saving
    if (isPatientDischarged) {
      requestPINVerification(doSave);
      return;
    }
    
    doSave();
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
      <Card>
        <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
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
      <CardContent>
            <EditModeBanner
              isPatientDischarged={isPatientDischarged}
              isEditing={isEditing}
              onRequestEdit={handleRequestEdit}
              recordTypeLabel="Assessment & Plan"
            />
        <form onSubmit={handleSubmit}>
          <fieldset disabled={isFormDisabled} className="space-y-6">
          
          {/* Section 1: Asesmen Klinis */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Asesmen Klinis</h3>
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
          </div>

          {/* Section 2: Rencana Terapi */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Rencana Terapi</h3>
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
                  <Eye className="h-4 w-4 text-muted-foreground" />
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
          </div>

          {/* Section 3: Rencana Detail */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Rencana Detail</h3>
              <Badge variant={filledDetailFields > 0 ? "default" : "outline"}>
                {filledDetailFields}/6
              </Badge>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medication_plan" className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
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
                    <Utensils className="h-4 w-4 text-muted-foreground" />
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
                    <Activity className="h-4 w-4 text-muted-foreground" />
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
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
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
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
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
                    <Users className="h-4 w-4 text-muted-foreground" />
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

          {/* Submit Button */}
          {!isFormDisabled && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Assessment & Plan
            </Button>
          </div>
          )}
          </fieldset>
        </form>
      </CardContent>
      <EditConfirmDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editReason={editReason}
        onEditReasonChange={setEditReason}
        onConfirm={handleConfirmEdit}
      />
      <PINVerificationDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        pin={pin}
        verifying={verifyingPIN}
        pinInputRefs={pinInputRefs}
        onPINChange={handlePINChange}
        onPINKeyDown={handlePINKeyDown}
        onVerify={handleVerifyPIN}
      />
    </Card>
  );
}
