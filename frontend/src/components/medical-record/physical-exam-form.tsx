import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Save, 
  Loader2, 
  Heart,
  Activity,
  FileText,
  Thermometer,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { medicalRecordsApi } from "@/lib/api";
import type { PhysicalExam } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PhysicalExamFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  isEmergency?: boolean;
  readOnly?: boolean;
}

// Physical exam sections
const physicalExamSections = [
  { id: "head", label: "Kepala", defaultNormal: "Normocephal, tidak ada deformitas, rambut distribusi merata" },
  { id: "eyes", label: "Mata", defaultNormal: "Konjungtiva anemis (-/-), sklera ikterik (-/-), pupil isokor 3mm/3mm, refleks cahaya (+/+)" },
  { id: "ears", label: "Telinga", defaultNormal: "Serumen minimal, membran timpani intak bilateral, nyeri tekan tragus (-/-)" },
  { id: "nose", label: "Hidung", defaultNormal: "Septum deviasi (-), sekret (-/-), pernapasan cuping hidung (-)" },
  { id: "throat", label: "Tenggorokan", defaultNormal: "Faring tidak hiperemis, tonsil T1/T1, uvula di tengah" },
  { id: "neck", label: "Leher", defaultNormal: "JVP tidak meningkat, pembesaran KGB (-), kaku kuduk (-), tiroid tidak teraba membesar" },
  { id: "chest", label: "Dada/Thorax", defaultNormal: "Bentuk dan pergerakan simetris, retraksi (-), fremitus taktil simetris" },
  { id: "heart", label: "Jantung", defaultNormal: "BJ I-II reguler, murmur (-), gallop (-), batas jantung dalam batas normal" },
  { id: "lungs", label: "Paru", defaultNormal: "Suara napas vesikuler (+/+), ronkhi (-/-), wheezing (-/-)" },
  { id: "abdomen", label: "Abdomen", defaultNormal: "Datar, supel, bising usus (+) normal, hepar/lien tidak teraba, nyeri tekan (-)" },
  { id: "extremities", label: "Ekstremitas", defaultNormal: "Akral hangat, CRT <2 detik, edema (-/-), kekuatan motorik 5/5" },
  { id: "skin", label: "Kulit", defaultNormal: "Warna sawo matang, turgor baik, tidak pucat, tidak ikterik, ruam (-)" },
  { id: "neurological", label: "Neurologis", defaultNormal: "GCS E4V5M6 (15), refleks fisiologis (+) normal, refleks patologis (-), meningeal sign (-)" },
];

const calculateBMI = (weight: number, height: number): number => {
  const h = height / 100;
  if (weight > 0 && h > 0) {
    return Math.round((weight / (h * h)) * 10) / 10;
  }
  return 0;
};

const getBMICategory = (bmi: number): { label: string; color: string } => {
  if (bmi === 0) return { label: "-", color: "text-muted-foreground" };
  if (bmi < 18.5) return { label: "Underweight", color: "text-yellow-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-orange-600" };
  return { label: "Obese", color: "text-red-600" };
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
  ecg_performed: false,
  ecg_result: "",
  ecg_interpretation: "",
  ecg_notes: "",
};

export function PhysicalExamForm({ visitId, onSave, isEmergency = false, readOnly = false }: PhysicalExamFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [checkedSections, setCheckedSections] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadPhysicalExam = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getPhysicalExam(visitId);
        const data = response.data as PhysicalExam & {
          ecg_performed?: boolean;
          ecg_result?: string;
          ecg_interpretation?: string;
          ecg_notes?: string;
        };
        if (data && data.id) {
          const parseNum = (val: string | number | undefined): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val) || 0;
            return 0;
          };
          
          const loadedData = {
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
            ecg_performed: data.ecg_performed || false,
            ecg_result: data.ecg_result || "",
            ecg_interpretation: data.ecg_interpretation || "",
            ecg_notes: data.ecg_notes || "",
          };
          
          setFormData(loadedData);
          
          // Set checked state for sections that have data
          const checked: Record<string, boolean> = {};
          physicalExamSections.forEach(section => {
            const value = loadedData[section.id as keyof typeof loadedData];
            if (value && typeof value === 'string' && value.trim() !== '') {
              checked[section.id] = true;
            }
          });
          setCheckedSections(checked);
        }
      } catch {
        // No existing data
      } finally {
        setLoading(false);
      }
    };

    loadPhysicalExam();
  }, [visitId]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "weight" || field === "height") {
        const weight = field === "weight" ? Number(value) : prev.weight;
        const height = field === "height" ? Number(value) : prev.height;
        updated.bmi = calculateBMI(weight, height);
      }
      return updated;
    });
  };

  const handleCheckSection = (sectionId: string, checked: boolean) => {
    setCheckedSections(prev => ({ ...prev, [sectionId]: checked }));
    
    if (checked) {
      // When checked, set normal value and expand row
      const section = physicalExamSections.find(s => s.id === sectionId);
      if (section) {
        handleChange(sectionId, section.defaultNormal);
      }
      setExpandedRows(prev => ({ ...prev, [sectionId]: true }));
    } else {
      // When unchecked, clear value and collapse
      handleChange(sectionId, "");
      setExpandedRows(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const toggleRowExpand = (sectionId: string) => {
    setExpandedRows(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSetAllNormal = () => {
    const allChecked = physicalExamSections.every(s => checkedSections[s.id]);
    
    if (allChecked) {
      // Uncheck all
      setCheckedSections({});
      setExpandedRows({});
      physicalExamSections.forEach(section => {
        handleChange(section.id, "");
      });
    } else {
      // Check all with normal values
      const newChecked: Record<string, boolean> = {};
      physicalExamSections.forEach(section => {
        newChecked[section.id] = true;
        handleChange(section.id, section.defaultNormal);
      });
      setCheckedSections(newChecked);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  const bmiCategory = getBMICategory(formData.bmi);
  const filledPhysicalExam = Object.keys(checkedSections).filter(k => checkedSections[k]).length;
  const allPhysicalChecked = filledPhysicalExam === physicalExamSections.length;

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
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Pemeriksaan Fisik
        </CardTitle>
        <CardDescription>
          Tanda vital dan pemeriksaan fisik head to toe
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
            <form onSubmit={handleSubmit}>
              <fieldset disabled={readOnly} className="space-y-6">
            
            {/* Section 1: Kondisi Umum & Tanda Vital */}
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                    <Thermometer className="h-5 w-5 text-red-500" />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    Kondisi Umum & Tanda Vital {isEmergency && <span className="text-destructive">(Wajib)</span>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* Kondisi Umum */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Kondisi Umum</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="general_condition" className="text-sm">Keadaan Umum</Label>
                      <Input
                        id="general_condition"
                        placeholder="Baik / Sedang / Buruk"
                        value={formData.general_condition}
                        onChange={(e) => handleChange("general_condition", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consciousness" className="text-sm">Kesadaran</Label>
                      <Input
                        id="consciousness"
                        placeholder="Compos Mentis / Apatis / Somnolen"
                        value={formData.consciousness}
                        onChange={(e) => handleChange("consciousness", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Tanda Vital */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Tanda Vital {isEmergency && <span className="text-destructive">*</span>}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="blood_pressure_systolic" className="text-xs flex items-center gap-1.5">
                        Sistolik {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="blood_pressure_systolic"
                          type="number"
                          placeholder="120"
                          value={formData.blood_pressure_systolic || ""}
                          onChange={(e) => handleChange("blood_pressure_systolic", parseInt(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-12"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mmHg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="blood_pressure_diastolic" className="text-xs flex items-center gap-1.5">
                        Diastolik {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="blood_pressure_diastolic"
                          type="number"
                          placeholder="80"
                          value={formData.blood_pressure_diastolic || ""}
                          onChange={(e) => handleChange("blood_pressure_diastolic", parseInt(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-12"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mmHg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="heart_rate" className="text-xs flex items-center gap-1.5">
                        Nadi {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="heart_rate"
                          type="number"
                          placeholder="80"
                          value={formData.heart_rate || ""}
                          onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-10"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">x/m</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="respiratory_rate" className="text-xs flex items-center gap-1.5">
                        Napas {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="respiratory_rate"
                          type="number"
                          placeholder="20"
                          value={formData.respiratory_rate || ""}
                          onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-10"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">x/m</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="temperature" className="text-xs flex items-center gap-1.5">
                        Suhu {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          placeholder="36.5"
                          value={formData.temperature || ""}
                          onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">°C</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oxygen_saturation" className="text-xs flex items-center gap-1.5">
                        SpO2 {isEmergency && <span className="text-destructive">*</span>}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="oxygen_saturation"
                          type="number"
                          placeholder="98"
                          value={formData.oxygen_saturation || ""}
                          onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                          required={isEmergency}
                          className="pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Antropometri */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Antropometri</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="weight" className="text-xs flex items-center gap-1.5">
                        Berat Badan
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          placeholder="70"
                          value={formData.weight || ""}
                          onChange={(e) => handleChange("weight", parseFloat(e.target.value) || 0)}
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="height" className="text-xs flex items-center gap-1.5">
                        Tinggi Badan
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">SatuSehat</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          placeholder="170"
                          value={formData.height || ""}
                          onChange={(e) => handleChange("height", parseFloat(e.target.value) || 0)}
                          className="pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">BMI</Label>
                      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
                        <span className="font-medium">{formData.bmi || "-"}</span>
                        <span className="text-xs text-muted-foreground">kg/m²</span>
                        {formData.bmi > 0 && (
                          <Badge variant="outline" className={cn("ml-auto text-xs", bmiCategory.color)}>
                            {bmiCategory.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Pemeriksaan Fisik - Table with Checkbox Column */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <Activity className="h-5 w-5 text-blue-500" />
                    </div>
                    <CardTitle className="text-base font-semibold">Pemeriksaan Fisik</CardTitle>
                    <Badge variant={filledPhysicalExam > 0 ? "default" : "secondary"}>
                      {filledPhysicalExam}/{physicalExamSections.length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllNormal}
                    disabled={readOnly}
                    className="gap-2"
                  >
                    {allPhysicalChecked ? (
                      <>
                        <X className="h-4 w-4" />
                        Hapus Semua
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Semua Normal
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="bg-muted/50 border-b">
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px] text-center">✓</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[130px]">Bagian</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Hasil Pemeriksaan</th>
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {physicalExamSections.map((section) => {
                        const isChecked = checkedSections[section.id] || false;
                        const isExpanded = expandedRows[section.id] || false;
                        const value = formData[section.id as keyof typeof formData] as string;
                        
                        return (
                          <Collapsible key={section.id} open={isExpanded} asChild>
                            <>
                              <tr 
                                className={cn(
                                  "border-b transition-colors hover:bg-muted/50",
                                  isChecked && "bg-green-50/50 dark:bg-green-950/10",
                                  isChecked && "cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-950/20"
                                )}
                                onClick={() => isChecked && toggleRowExpand(section.id)}
                              >
                                <td className="p-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    id={`check-${section.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleCheckSection(section.id, checked as boolean)}
                                    disabled={readOnly}
                                  />
                                </td>
                                <td className="p-4 align-middle font-medium">{section.label}</td>
                                <td className="p-4 align-middle">
                                  {isChecked ? (
                                    <span className="text-sm text-muted-foreground line-clamp-1">
                                      {value || "-"}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground/50 italic">
                                      Belum diperiksa
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 align-middle">
                                  {isChecked && (
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleRowExpand(section.id);
                                        }}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  )}
                                </td>
                              </tr>
                              <CollapsibleContent asChild>
                                <tr>
                                  <td colSpan={4} className="p-0">
                                    <div className="px-4 py-3 bg-muted/30 border-t">
                                      <Textarea
                                        id={section.id}
                                        placeholder={`Hasil pemeriksaan ${section.label.toLowerCase()}...`}
                                        value={value || ""}
                                        onChange={(e) => handleChange(section.id, e.target.value)}
                                        className="min-h-[80px] resize-none text-sm"
                                        disabled={readOnly}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Temuan Lain */}
                <div className="p-4 border-t">
                  <Label htmlFor="other_findings" className="text-sm font-medium">Temuan Lain</Label>
                  <Textarea
                    id="other_findings"
                    placeholder="Temuan pemeriksaan fisik lainnya..."
                    value={formData.other_findings}
                    onChange={(e) => handleChange("other_findings", e.target.value)}
                    className="mt-2 min-h-[60px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Pemeriksaan Penunjang - Table with Checkbox Column */}
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                    <Heart className="h-5 w-5 text-purple-500" />
                  </div>
                  <CardTitle className="text-base font-semibold">Pemeriksaan Penunjang</CardTitle>
                  <Badge variant={formData.ecg_performed ? "default" : "secondary"}>
                    {formData.ecg_performed ? 1 : 0}/1
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="bg-muted/50 border-b">
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px] text-center">✓</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[180px]">Pemeriksaan</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Hasil Pemeriksaan</th>
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {/* ECG Row */}
                      <Collapsible open={expandedRows.ecg} asChild>
                        <>
                          <tr 
                            className={cn(
                              "border-b transition-colors hover:bg-muted/50",
                              formData.ecg_performed && "bg-purple-50/50 dark:bg-purple-950/10",
                              formData.ecg_performed && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-950/20"
                            )}
                            onClick={() => formData.ecg_performed && setExpandedRows(prev => ({ ...prev, ecg: !prev.ecg }))}
                          >
                            <td className="p-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                id="ecg_performed"
                                checked={formData.ecg_performed}
                                onCheckedChange={(checked) => {
                                  handleChange("ecg_performed", checked as boolean);
                                  if (checked) {
                                    setExpandedRows(prev => ({ ...prev, ecg: true }));
                                  } else {
                                    setExpandedRows(prev => ({ ...prev, ecg: false }));
                                    handleChange("ecg_result", "");
                                    handleChange("ecg_interpretation", "");
                                    handleChange("ecg_notes", "");
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td className="p-4 align-middle">
                              <div className="flex items-center gap-2">
                                <Heart className={cn(
                                  "h-4 w-4",
                                  formData.ecg_performed ? "text-red-500" : "text-muted-foreground"
                                )} />
                                <div>
                                  <span className="font-medium">EKG / ECG</span>
                                  <p className="text-xs text-muted-foreground">Elektrokardiogram</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              {formData.ecg_performed ? (
                                <div className="text-sm">
                                  {formData.ecg_result || formData.ecg_interpretation ? (
                                    <div className="space-y-0.5">
                                      {formData.ecg_result && (
                                        <p className="text-muted-foreground line-clamp-1">
                                          <span className="font-medium">Hasil:</span> {formData.ecg_result}
                                        </p>
                                      )}
                                      {formData.ecg_interpretation && (
                                        <p className="text-muted-foreground line-clamp-1">
                                          <span className="font-medium">Interpretasi:</span> {formData.ecg_interpretation}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/50 italic">Klik untuk mengisi detail</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground/50 italic">Belum dilakukan</span>
                              )}
                            </td>
                            <td className="p-2 align-middle">
                              {formData.ecg_performed && (
                                <CollapsibleTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedRows(prev => ({ ...prev, ecg: !prev.ecg }));
                                    }}
                                  >
                                    {expandedRows.ecg ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </td>
                          </tr>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={4} className="p-0">
                                <div className="px-4 py-3 bg-purple-50/30 dark:bg-purple-950/10 border-t space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="ecg_result" className="text-sm font-medium">Hasil EKG</Label>
                                    <Input
                                      id="ecg_result"
                                      placeholder="Sinus rhythm, HR 80x/menit..."
                                      value={formData.ecg_result}
                                      onChange={(e) => handleChange("ecg_result", e.target.value)}
                                      disabled={readOnly}
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="ecg_interpretation" className="text-sm font-medium">Interpretasi</Label>
                                    <Input
                                      id="ecg_interpretation"
                                      placeholder="Normal / Abnormal"
                                      value={formData.ecg_interpretation}
                                      onChange={(e) => handleChange("ecg_interpretation", e.target.value)}
                                      disabled={readOnly}
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="ecg_notes" className="text-sm font-medium flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Catatan Detail EKG
                                    </Label>
                                    <Textarea
                                      id="ecg_notes"
                                      placeholder={`Irama: Sinus rhythm
Rate: 80x/menit
Axis: Normal
Gelombang P: Normal
Interval PR: 0.16 detik
Kompleks QRS: 0.08 detik
Segmen ST: Isoelektrik
Gelombang T: Normal
Kesimpulan: EKG dalam batas normal`}
                                      value={formData.ecg_notes}
                                      onChange={(e) => handleChange("ecg_notes", e.target.value)}
                                      className="min-h-[120px] resize-none font-mono text-sm"
                                      disabled={readOnly}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 border-t">
                  <p className="text-xs text-muted-foreground italic">
                    * Pemeriksaan penunjang lainnya (EEG, USG, dll) akan ditambahkan kemudian
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Simpan Pemeriksaan Fisik
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
