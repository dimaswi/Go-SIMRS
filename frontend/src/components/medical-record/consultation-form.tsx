import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, FileText, CheckCircle2, User, Stethoscope } from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";

interface ConsultationFormProps {
  visitId: number;
  readOnly?: boolean;
}

export function ConsultationForm({ visitId, readOnly = false }: ConsultationFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    recommendation: "",
    notes: "",
  });

  useEffect(() => {
    loadConsultation();
  }, [visitId]);

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const response = await medicalRecordsApi.getConsultation(visitId);
      if (response.data) {
        setExistingData(response.data);
        // If there's consultation data (already answered)
        if (response.data.subjective !== undefined) {
          setFormData({
            subjective: response.data.subjective || "",
            objective: response.data.objective || "",
            assessment: response.data.assessment || "",
            plan: response.data.plan || "",
            recommendation: response.data.recommendation || "",
            notes: response.data.notes || "",
          });
        }
      }
    } catch (error: any) {
      // If 404, it's okay - no existing data
      if (error.response?.status !== 404) {
        console.error("Error loading consultation:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.subjective && !formData.objective && !formData.assessment && !formData.plan) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Minimal isi satu field untuk menyimpan konsultasi",
      });
      return;
    }

    setSaving(true);
    try {
      // Save konsultasi
      await medicalRecordsApi.saveConsultation(visitId, {
        subjective: formData.subjective,
        objective: formData.objective,
        assessment: formData.assessment,
        plan: formData.plan,
        recommendation: formData.recommendation,
        notes: formData.notes,
      });

      toast({
        title: "Berhasil",
        description: "Hasil konsultasi berhasil disimpan",
      });
      
      // Reload data
      await loadConsultation();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil konsultasi",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Form Jawaban Konsultasi
              {existingData?.subjective && (
                <Badge variant="default" className="ml-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Sudah Dijawab
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Jawaban konsultasi dari dokter spesialis untuk kasus yang dikonsultasikan
            </CardDescription>
          </div>
          {!readOnly && !existingData?.subjective && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-6">
        {/* Indikasi Konsultasi - Info from Order - Show always if procedure_order exists */}
        {existingData?.procedure_order && (
          <>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-3">
                <Stethoscope className="h-5 w-5" />
                Indikasi Konsultasi
              </div>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-muted-foreground">No. Order:</div>
                  <div className="col-span-2 font-medium">{existingData.procedure_order.order_number}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-muted-foreground">Dokter Pengirim:</div>
                  <div className="col-span-2 font-medium">{existingData.procedure_order.ordered_by?.nama_lengkap || "-"}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-muted-foreground">Diagnosis:</div>
                  <div className="col-span-2">{existingData.procedure_order.diagnosis || "-"}</div>
                </div>
                {existingData.procedure_order.clinical_notes && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-muted-foreground">Alasan Konsultasi:</div>
                    <div className="col-span-2 font-medium bg-blue-100 dark:bg-blue-900 p-2 rounded whitespace-pre-wrap">
                      {existingData.procedure_order.clinical_notes}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-muted-foreground">Prioritas:</div>
                  <div className="col-span-2">
                    <Badge variant={existingData.procedure_order.priority === "urgent" || existingData.procedure_order.priority === "cito" ? "destructive" : "outline"}>
                      {existingData.procedure_order.priority === "urgent" || existingData.procedure_order.priority === "cito" ? existingData.procedure_order.priority.toUpperCase() : "Normal"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <Separator className="my-4" />
          </>
        )}
        
        {/* Show this badge only if consultation has been answered (has subjective field) */}
        {existingData?.subjective && (
          <>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                <CheckCircle2 className="h-5 w-5" />
                Konsultasi Telah Dijawab
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {existingData.consultant && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Konsultan: {existingData.consultant.nama_lengkap}</span>
                  </div>
                )}
                <div className="text-muted-foreground">
                  Tanggal: {new Date(existingData.created_at).toLocaleString("id-ID")}
                </div>
              </div>
            </div>
            <Separator className="my-4" />
          </>
        )}
        <div className="space-y-6">
          {/* Subjective */}
          <div className="space-y-2">
            <Label htmlFor="subjective" className="text-sm font-semibold">
              S (Subjective) - Keluhan Pasien
            </Label>
            <Textarea
              id="subjective"
              placeholder="Keluhan atau anamnesis pasien yang dikonsultasikan..."
              value={formData.subjective}
              onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <Label htmlFor="objective" className="text-sm font-semibold">
              O (Objective) - Pemeriksaan & Temuan
            </Label>
            <Textarea
              id="objective"
              placeholder="Hasil pemeriksaan objektif, tanda vital, pemeriksaan penunjang yang relevan..."
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Assessment */}
          <div className="space-y-2">
            <Label htmlFor="assessment" className="text-sm font-semibold">
              A (Assessment) - Penilaian & Diagnosis
            </Label>
            <Textarea
              id="assessment"
              placeholder="Penilaian klinis, diagnosis, interpretasi hasil konsultasi..."
              value={formData.assessment}
              onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Plan */}
          <div className="space-y-2">
            <Label htmlFor="plan" className="text-sm font-semibold">
              P (Plan) - Rencana Tindak Lanjut
            </Label>
            <Textarea
              id="plan"
              placeholder="Rencana terapi, tindakan, atau anjuran dari hasil konsultasi..."
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label htmlFor="recommendation" className="text-sm font-semibold">
              Rekomendasi Khusus <span className="text-muted-foreground text-xs font-normal">(Opsional)</span>
            </Label>
            <Textarea
              id="recommendation"
              placeholder="Rekomendasi atau saran khusus dari konsultan..."
              value={formData.recommendation}
              onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold">
              Catatan Tambahan <span className="text-muted-foreground text-xs font-normal">(Opsional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Catatan tambahan jika diperlukan..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={readOnly || !!existingData?.subjective}
              rows={2}
              className="resize-none"
            />
          </div>

          {(readOnly || existingData?.subjective) && (
            <div className="bg-muted/50 border border-muted rounded-md p-3 text-sm text-muted-foreground">
              <p>Mode baca saja - Hasil konsultasi tidak dapat diubah</p>
            </div>
          )}
        </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
