import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";
import type { PhysicalExam } from "@/lib/api";

interface PhysicalExamFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  isEmergency?: boolean;
}

// Helper function to calculate BMI
const calculateBMI = (weight: number, height: number): number => {
  const h = height / 100; // convert cm to m
  if (weight > 0 && h > 0) {
    return Math.round((weight / (h * h)) * 10) / 10;
  }
  return 0;
};

const defaultFormData = {
  general_condition: "",
  consciousness: "",
  blood_pressure_systolic: 0,
  blood_pressure_diastolic: 0,
  heart_rate: 0,
  respiratory_rate: 0,
  temperature: 0,
  oxygen_saturation: 0,
  weight: 0,
  height: 0,
  bmi: 0,
  head: "",
  eyes: "",
  ears: "",
  nose: "",
  throat: "",
  neck: "",
  chest: "",
  heart: "",
  lungs: "",
  abdomen: "",
  extremities: "",
  skin: "",
  neurological: "",
  other_findings: "",
};

export function PhysicalExamForm({ visitId, onSave, isEmergency = false }: PhysicalExamFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);

  // Load existing data on mount
  useEffect(() => {
    const loadPhysicalExam = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getPhysicalExam(visitId);
        const data = response.data as PhysicalExam;
        if (data && data.id) {
          // Helper to parse number from string or number
          const parseNum = (val: string | number | undefined): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val) || 0;
            return 0;
          };
          
          setFormData({
            general_condition: data.general_condition || "",
            consciousness: data.consciousness || "",
            blood_pressure_systolic: data.systolic || data.blood_pressure_systolic || 0,
            blood_pressure_diastolic: data.diastolic || data.blood_pressure_diastolic || 0,
            heart_rate: parseNum(data.heart_rate),
            respiratory_rate: parseNum(data.respiratory_rate),
            temperature: parseNum(data.temperature),
            oxygen_saturation: parseNum(data.oxygen_saturation),
            weight: parseNum(data.weight),
            height: parseNum(data.height),
            bmi: data.bmi || 0,
            head: data.head || "",
            eyes: data.eyes || "",
            ears: data.ears || "",
            nose: data.nose || "",
            throat: data.throat || "",
            neck: data.neck || "",
            chest: data.chest || data.thorax || "",
            heart: data.heart || data.cardiac || "",
            lungs: data.lungs || data.pulmonary || "",
            abdomen: data.abdomen || "",
            extremities: data.extremities || "",
            skin: data.skin || "",
            neurological: data.neurological || "",
            other_findings: data.other_findings || "",
          });
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
      }
    };

    loadPhysicalExam();
  }, [visitId]);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate BMI when weight or height changes
      if (field === "weight" || field === "height") {
        const weight = field === "weight" ? Number(value) : prev.weight;
        const height = field === "height" ? Number(value) : prev.height;
        updated.bmi = calculateBMI(weight, height);
      }
      
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Pemeriksaan Fisik</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
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
        <CardTitle className="text-lg">Pemeriksaan Fisik</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Condition */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Kondisi Umum</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="general_condition" className="text-sm">Keadaan Umum</Label>
                <Input
                  id="general_condition"
                  placeholder="Baik / Sedang / Buruk"
                  value={formData.general_condition}
                  onChange={(e) => handleChange("general_condition", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consciousness" className="text-sm">Kesadaran</Label>
                <Input
                  id="consciousness"
                  placeholder="Compos Mentis"
                  value={formData.consciousness}
                  onChange={(e) => handleChange("consciousness", e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* Vital Signs Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Tanda Vital {isEmergency && <span className="text-destructive">*</span>}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="blood_pressure_systolic" className="text-sm">
                  Sistolik (mmHg) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="blood_pressure_systolic"
                  type="number"
                  placeholder="120"
                  value={formData.blood_pressure_systolic || ""}
                  onChange={(e) => handleChange("blood_pressure_systolic", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blood_pressure_diastolic" className="text-sm">
                  Diastolik (mmHg) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="blood_pressure_diastolic"
                  type="number"
                  placeholder="80"
                  value={formData.blood_pressure_diastolic || ""}
                  onChange={(e) => handleChange("blood_pressure_diastolic", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heart_rate" className="text-sm">
                  Nadi (x/menit) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="heart_rate"
                  type="number"
                  placeholder="80"
                  value={formData.heart_rate || ""}
                  onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratory_rate" className="text-sm">
                  Pernapasan (x/menit) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="respiratory_rate"
                  type="number"
                  placeholder="20"
                  value={formData.respiratory_rate || ""}
                  onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-sm">
                  Suhu (°C) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="36.5"
                  value={formData.temperature || ""}
                  onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oxygen_saturation" className="text-sm">
                  SpO2 (%) {isEmergency && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="oxygen_saturation"
                  type="number"
                  placeholder="98"
                  value={formData.oxygen_saturation || ""}
                  onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required={isEmergency}
                />
              </div>
            </div>
          </div>

          {/* Anthropometry */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Antropometri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm">Berat Badan (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="70"
                  value={formData.weight || ""}
                  onChange={(e) => handleChange("weight", parseFloat(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm">Tinggi Badan (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="170"
                  value={formData.height || ""}
                  onChange={(e) => handleChange("height", parseFloat(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bmi" className="text-sm">BMI (kg/m²)</Label>
                <Input
                  id="bmi"
                  placeholder="Auto"
                  value={formData.bmi || ""}
                  readOnly
                  className="h-11 bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Physical Examination by System */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Pemeriksaan Fisik per Sistem</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="head" className="text-sm">Kepala</Label>
                <Textarea
                  id="head"
                  placeholder="Normocephal, deformitas (-)..."
                  value={formData.head}
                  onChange={(e) => handleChange("head", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eyes" className="text-sm">Mata</Label>
                <Textarea
                  id="eyes"
                  placeholder="Konjungtiva anemis (-/-), sklera ikterik (-/-), pupil isokor..."
                  value={formData.eyes}
                  onChange={(e) => handleChange("eyes", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ears" className="text-sm">Telinga</Label>
                <Textarea
                  id="ears"
                  placeholder="Serumen minimal, membran timpani intak..."
                  value={formData.ears}
                  onChange={(e) => handleChange("ears", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nose" className="text-sm">Hidung</Label>
                <Textarea
                  id="nose"
                  placeholder="Septum simetris, sekret (-)..."
                  value={formData.nose}
                  onChange={(e) => handleChange("nose", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="throat" className="text-sm">Tenggorokan</Label>
                <Textarea
                  id="throat"
                  placeholder="Faring tidak hiperemis, tonsil T1/T1..."
                  value={formData.throat}
                  onChange={(e) => handleChange("throat", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neck" className="text-sm">Leher</Label>
                <Textarea
                  id="neck"
                  placeholder="JVP tidak meningkat, pembesaran KGB (-)..."
                  value={formData.neck}
                  onChange={(e) => handleChange("neck", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chest" className="text-sm">Dada</Label>
                <Textarea
                  id="chest"
                  placeholder="Simetris, retraksi (-), pergerakan dada simetris..."
                  value={formData.chest}
                  onChange={(e) => handleChange("chest", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heart" className="text-sm">Jantung</Label>
                <Textarea
                  id="heart"
                  placeholder="BJ I-II reguler, murmur (-), gallop (-)..."
                  value={formData.heart}
                  onChange={(e) => handleChange("heart", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lungs" className="text-sm">Paru</Label>
                <Textarea
                  id="lungs"
                  placeholder="Vesikuler +/+, ronkhi -/-, wheezing -/-..."
                  value={formData.lungs}
                  onChange={(e) => handleChange("lungs", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abdomen" className="text-sm">Abdomen</Label>
                <Textarea
                  id="abdomen"
                  placeholder="Datar, supel, bising usus (+) normal, nyeri tekan (-)..."
                  value={formData.abdomen}
                  onChange={(e) => handleChange("abdomen", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extremities" className="text-sm">Ekstremitas</Label>
                <Textarea
                  id="extremities"
                  placeholder="Akral hangat, CRT <2 detik, edema (-)..."
                  value={formData.extremities}
                  onChange={(e) => handleChange("extremities", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skin" className="text-sm">Kulit</Label>
                <Textarea
                  id="skin"
                  placeholder="Turgor baik, tidak pucat, tidak ikterik..."
                  value={formData.skin}
                  onChange={(e) => handleChange("skin", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neurological" className="text-sm">Neurologis</Label>
                <Textarea
                  id="neurological"
                  placeholder="GCS E4V5M6, refleks fisiologis (+) normal..."
                  value={formData.neurological}
                  onChange={(e) => handleChange("neurological", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_findings" className="text-sm">Temuan Lain</Label>
              <Textarea
                id="other_findings"
                placeholder="Temuan pemeriksaan fisik lainnya..."
                value={formData.other_findings}
                onChange={(e) => handleChange("other_findings", e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Simpan Pemeriksaan Fisik
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
