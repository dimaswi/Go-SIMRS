import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Loader2 } from "lucide-react";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi } from "@/lib/api";
import type { Triage } from "@/lib/api";

interface TriageFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  readOnly?: boolean;
}

// Triage level dengan warna khusus (tidak dari master data karena butuh warna)
const triageLevelColors: Record<string, string> = {
  "0": "bg-black",      // DOA - Hitam
  "1": "bg-red-500",    // Resusitasi - Merah
  "2": "bg-orange-500", // Emergent - Oranye
  "3": "bg-yellow-500", // Urgent - Kuning
  "4": "bg-green-500",  // Less Urgent - Hijau
  "5": "bg-blue-500",   // Non-Urgent - Biru
};

const defaultFormData = {
  arrival_mode: "",
  triage_complaint: "",
  triage_level: "",
  airway: "",
  airway_note: "",
  breathing: "",
  breathing_note: "",
  circulation: "",
  circulation_note: "",
  blood_pressure: "",
  heart_rate: 0,
  respiratory_rate: 0,
  temperature: 0,
  oxygen_saturation: 0,
  pain_scale: 0,
  gcs_e: 4,
  gcs_v: 5,
  gcs_m: 6,
  triage_assessment: "",
  immediate_actions: "",
};

export function TriageForm({ visitId, onSave, readOnly = false }: TriageFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);

  // Fetch master data untuk semua kategori yang dibutuhkan
  const { getOptions, loading: masterDataLoading } = useMultipleMasterData([
    'arrival_mode',
    'triage_level',
    'airway_status',
    'breathing_status',
    'circulation_status',
  ]);

  // Load existing data on mount
  useEffect(() => {
    const loadTriage = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getTriage(visitId);
        const data = response.data as Triage;
        if (data && data.id) {
          setFormData({
            arrival_mode: data.arrival_mode || "",
            triage_complaint: data.triage_complaint || "",
            triage_level: data.triage_level || "",
            airway: data.airway || "",
            airway_note: data.airway_note || "",
            breathing: data.breathing || "",
            breathing_note: data.breathing_note || "",
            circulation: data.circulation || "",
            circulation_note: data.circulation_note || "",
            blood_pressure: data.blood_pressure || "",
            heart_rate: data.heart_rate || 0,
            respiratory_rate: data.respiratory_rate || 0,
            temperature: data.temperature || 0,
            oxygen_saturation: data.oxygen_saturation || 0,
            pain_scale: data.pain_scale || 0,
            gcs_e: data.gcs_e || 4,
            gcs_v: data.gcs_v || 5,
            gcs_m: data.gcs_m || 6,
            triage_assessment: data.triage_assessment || "",
            immediate_actions: data.immediate_actions || "",
          });
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
      }
    };

    loadTriage();
  }, [visitId]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  const gcsTotal = formData.gcs_e + formData.gcs_v + formData.gcs_m;

  // Get options from master data
  const arrivalModeOptions = getOptions('arrival_mode');
  const triageLevelOptions = getOptions('triage_level');
  const airwayOptions = getOptions('airway_status');
  const breathingOptions = getOptions('breathing_status');
  const circulationOptions = getOptions('circulation_status');

  if (loading || masterDataLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Triase UGD</CardTitle>
          </div>
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
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">Triase UGD</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={readOnly}>
          {/* Arrival Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Informasi Kedatangan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrival_mode" className="text-sm">
                  Moda Kedatangan <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  options={arrivalModeOptions}
                  value={formData.arrival_mode}
                  onValueChange={(value) => handleChange("arrival_mode", value)}
                  placeholder="Pilih moda kedatangan"
                  searchPlaceholder="Cari moda kedatangan..."
                  emptyText="Tidak ditemukan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="triage_complaint" className="text-sm">
                  Keluhan Utama <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="triage_complaint"
                  placeholder="Keluhan utama pasien..."
                  value={formData.triage_complaint}
                  onChange={(e) => handleChange("triage_complaint", e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>
          </div>

          {/* Triage Level */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Level Triase <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {triageLevelOptions.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => handleChange("triage_level", level.value)}
                  className={`p-3 rounded-lg border-2 text-white font-medium text-sm transition-all ${
                    formData.triage_level === level.value
                      ? `${triageLevelColors[level.value] || "bg-gray-500"} border-white scale-105`
                      : `${triageLevelColors[level.value] || "bg-gray-500"} opacity-60 border-transparent hover:opacity-80`
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Survey (ABC) */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">
              Primary Survey (ABC) <span className="text-destructive">*</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="airway" className="text-sm">Airway (Jalan Napas)</Label>
                <Combobox
                  options={airwayOptions}
                  value={formData.airway}
                  onValueChange={(value) => handleChange("airway", value)}
                  placeholder="Pilih kondisi jalan napas"
                  searchPlaceholder="Cari kondisi airway..."
                  emptyText="Tidak ditemukan"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="airway_note" className="text-sm">Catatan Airway</Label>
                <Input
                  id="airway_note"
                  placeholder="Catatan tambahan..."
                  value={formData.airway_note}
                  onChange={(e) => handleChange("airway_note", e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breathing" className="text-sm">Breathing (Pernapasan)</Label>
                <Combobox
                  options={breathingOptions}
                  value={formData.breathing}
                  onValueChange={(value) => handleChange("breathing", value)}
                  placeholder="Pilih kondisi pernapasan"
                  searchPlaceholder="Cari kondisi breathing..."
                  emptyText="Tidak ditemukan"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="breathing_note" className="text-sm">Catatan Breathing</Label>
                <Input
                  id="breathing_note"
                  placeholder="Catatan tambahan..."
                  value={formData.breathing_note}
                  onChange={(e) => handleChange("breathing_note", e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="circulation" className="text-sm">Circulation (Sirkulasi)</Label>
                <Combobox
                  options={circulationOptions}
                  value={formData.circulation}
                  onValueChange={(value) => handleChange("circulation", value)}
                  placeholder="Pilih kondisi sirkulasi"
                  searchPlaceholder="Cari kondisi sirkulasi..."
                  emptyText="Tidak ditemukan"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="circulation_note" className="text-sm">Catatan Circulation</Label>
                <Input
                  id="circulation_note"
                  placeholder="Catatan tambahan..."
                  value={formData.circulation_note}
                  onChange={(e) => handleChange("circulation_note", e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">
              Tanda Vital <span className="text-destructive">*</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="blood_pressure" className="text-sm">Tekanan Darah</Label>
                <Input
                  id="blood_pressure"
                  placeholder="120/80 mmHg"
                  value={formData.blood_pressure}
                  onChange={(e) => handleChange("blood_pressure", e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heart_rate" className="text-sm">Nadi (x/menit)</Label>
                <Input
                  id="heart_rate"
                  type="number"
                  placeholder="80"
                  value={formData.heart_rate || ""}
                  onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratory_rate" className="text-sm">Frekuensi Napas (x/menit)</Label>
                <Input
                  id="respiratory_rate"
                  type="number"
                  placeholder="20"
                  value={formData.respiratory_rate || ""}
                  onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-sm">Suhu (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="36.5"
                  value={formData.temperature || ""}
                  onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oxygen_saturation" className="text-sm">SpO2 (%)</Label>
                <Input
                  id="oxygen_saturation"
                  type="number"
                  placeholder="98"
                  value={formData.oxygen_saturation || ""}
                  onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pain_scale" className="text-sm">Skala Nyeri (0-10)</Label>
                <Input
                  id="pain_scale"
                  type="number"
                  min="0"
                  max="10"
                  placeholder="0"
                  value={formData.pain_scale || ""}
                  onChange={(e) => handleChange("pain_scale", parseInt(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* GCS Score */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary">Glasgow Coma Scale (GCS)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gcs_e" className="text-sm">Eye Opening (E) [1-4]</Label>
                <Input
                  id="gcs_e"
                  type="number"
                  min="1"
                  max="4"
                  value={formData.gcs_e}
                  onChange={(e) => handleChange("gcs_e", parseInt(e.target.value) || 1)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcs_v" className="text-sm">Verbal Response (V) [1-5]</Label>
                <Input
                  id="gcs_v"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.gcs_v}
                  onChange={(e) => handleChange("gcs_v", parseInt(e.target.value) || 1)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcs_m" className="text-sm">Motor Response (M) [1-6]</Label>
                <Input
                  id="gcs_m"
                  type="number"
                  min="1"
                  max="6"
                  value={formData.gcs_m}
                  onChange={(e) => handleChange("gcs_m", parseInt(e.target.value) || 1)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>Total GCS:</span>
                <Badge variant="default">{gcsTotal}</Badge>
                <span className="text-muted-foreground text-xs">
                  (E{formData.gcs_e}V{formData.gcs_v}M{formData.gcs_m})
                </span>
              </div>
            </div>
          </div>

          {/* Assessment */}
          <div className="space-y-2">
            <Label htmlFor="triage_assessment" className="text-sm font-semibold">
              Penilaian Awal
            </Label>
            <Textarea
              id="triage_assessment"
              placeholder="Penilaian awal kondisi pasien..."
              value={formData.triage_assessment}
              onChange={(e) => handleChange("triage_assessment", e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Immediate Actions */}
          <div className="space-y-2">
            <Label htmlFor="immediate_actions" className="text-sm font-semibold">
              Tindakan Segera
            </Label>
            <Textarea
              id="immediate_actions"
              placeholder="Tindakan segera yang telah/akan dilakukan..."
              value={formData.immediate_actions}
              onChange={(e) => handleChange("immediate_actions", e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Simpan Triase
            </Button>
          </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
