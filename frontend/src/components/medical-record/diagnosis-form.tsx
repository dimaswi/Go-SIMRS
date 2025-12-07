import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Save, Plus, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi } from "@/lib/api";
import type { Diagnosis as DiagnosisData, DiagnosisItem } from "@/lib/api";

interface DiagnosisFormItem {
  id?: number;
  icd10_code: string;
  icd10_name: string;
  diagnosis_type: "primary" | "secondary" | "differential";
  clinical_status?: string;
  verification_status?: string;
  severity?: string;
  body_site?: string;
  onset_date?: string;
  note?: string;
}

interface DiagnosisFormProps {
  visitId: number;
  onSave?: (data: any) => void;
}

// Mock ICD-10 data - in real app, this would come from API
const mockICD10 = [
  { code: "A00.0", name: "Kolera akibat Vibrio cholerae 01, biotipe cholerae" },
  { code: "A00.1", name: "Kolera akibat Vibrio cholerae 01, biotipe el tor" },
  { code: "A00.9", name: "Kolera, tidak spesifik" },
  { code: "J00", name: "Nasofaringitis akut (common cold)" },
  { code: "J01.0", name: "Sinusitis maksila akut" },
  { code: "J02.0", name: "Faringitis streptokokal" },
  { code: "J03.0", name: "Tonsilitis streptokokal" },
  { code: "K29.0", name: "Gastritis hemoragik akut" },
  { code: "K29.1", name: "Gastritis akut lainnya" },
  { code: "I10", name: "Hipertensi esensial (primer)" },
  { code: "E11.9", name: "Diabetes mellitus tipe 2 tanpa komplikasi" },
  { code: "R50.9", name: "Demam, tidak spesifik" },
];

export function DiagnosisForm({ visitId, onSave }: DiagnosisFormProps) {
  const [loading, setLoading] = useState(true);
  const [clinicalImpression, setClinicalImpression] = useState("");
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState("");

  // Fetch master data for diagnosis fields
  const { getOptions, loading: masterDataLoading } = useMultipleMasterData([
    'clinical_status',
    'verification_status',
    'severity_level',
  ]);

  const clinicalStatusOptions = getOptions('clinical_status');
  const verificationStatusOptions = getOptions('verification_status');
  const severityOptions = getOptions('severity_level');

  const [diagnoses, setDiagnoses] = useState<DiagnosisFormItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [addingType, setAddingType] = useState<"primary" | "secondary" | "differential">("primary");
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);

  // Load existing data on mount
  useEffect(() => {
    const loadDiagnosis = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getDiagnosis(visitId);
        const data = response.data as DiagnosisData;
        if (data) {
          setClinicalImpression(data.clinical_impression || "");
          setDifferentialDiagnosis(data.differential_diagnosis || "");
          if (data.items && data.items.length > 0) {
            setDiagnoses(data.items.map((item: DiagnosisItem) => ({
              id: item.id,
              icd10_code: item.icd10_code,
              icd10_name: item.icd10_name,
              diagnosis_type: item.diagnosis_type || "secondary",
              clinical_status: item.clinical_status || "active",
              verification_status: item.verification_status || "confirmed",
              severity: item.severity || "",
              body_site: item.body_site || "",
              onset_date: item.onset_date || "",
              note: item.note || "",
            })));
          }
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
      }
    };

    loadDiagnosis();
  }, [visitId]);

  const handleAddDiagnosis = (code: string, name: string) => {
    const newDiagnosis: DiagnosisFormItem = {
      icd10_code: code,
      icd10_name: name,
      diagnosis_type: addingType,
      clinical_status: "active",
      verification_status: "confirmed",
      severity: "",
      body_site: "",
      onset_date: "",
      note: "",
    };
    setDiagnoses([...diagnoses, newDiagnosis]);
    setSearchOpen(false);
    setSearchValue("");
  };

  const handleRemoveDiagnosis = (index: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
    if (expandedDiagnosis === index) setExpandedDiagnosis(null);
  };

  const handleUpdateDiagnosis = (index: number, field: keyof DiagnosisFormItem, value: string) => {
    const updated = [...diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    setDiagnoses(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.({ 
      clinical_impression: clinicalImpression,
      differential_diagnosis: differentialDiagnosis,
      items: diagnoses 
    });
  };

  const filteredICD10 = mockICD10.filter(
    (item) =>
      item.code.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const primaryDiagnoses = diagnoses.filter((d) => d.diagnosis_type === "primary");
  const secondaryDiagnoses = diagnoses.filter((d) => d.diagnosis_type === "secondary");

  if (loading || masterDataLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Diagnosis (ICD-10)</CardTitle>
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

  // Render diagnosis card with expandable FHIR details
  const renderDiagnosisCard = (diagnosis: DiagnosisFormItem, actualIndex: number, isPrimary: boolean = false) => (
    <div
      key={actualIndex}
      className={`p-3 border rounded-lg ${isPrimary ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={isPrimary ? "default" : "outline"} className="font-mono text-xs">
              {diagnosis.icd10_code}
            </Badge>
            {diagnosis.severity && (
              <Badge variant="secondary" className="text-xs">
                {severityOptions.find(s => s.value === diagnosis.severity)?.label}
              </Badge>
            )}
            {diagnosis.clinical_status && (
              <Badge variant="outline" className="text-xs">
                {clinicalStatusOptions.find(s => s.value === diagnosis.clinical_status)?.label}
              </Badge>
            )}
          </div>
          <p className="text-sm">{diagnosis.icd10_name}</p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpandedDiagnosis(expandedDiagnosis === actualIndex ? null : actualIndex)}
          >
            {expandedDiagnosis === actualIndex ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveDiagnosis(actualIndex)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Expanded FHIR details */}
      {expandedDiagnosis === actualIndex && (
        <div className="mt-4 pt-4 border-t space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Status Klinis</Label>
              <Combobox
                options={clinicalStatusOptions}
                value={diagnosis.clinical_status || "active"}
                onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "clinical_status", value)}
                placeholder="Pilih status klinis"
                searchPlaceholder="Cari status klinis..."
                loading={masterDataLoading}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status Verifikasi</Label>
              <Combobox
                options={verificationStatusOptions}
                value={diagnosis.verification_status || "confirmed"}
                onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "verification_status", value)}
                placeholder="Pilih status verifikasi"
                searchPlaceholder="Cari status verifikasi..."
                loading={masterDataLoading}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Keparahan</Label>
              <Combobox
                options={severityOptions}
                value={diagnosis.severity || ""}
                onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "severity", value)}
                placeholder="Pilih keparahan"
                searchPlaceholder="Cari keparahan..."
                loading={masterDataLoading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Lokasi Anatomi</Label>
              <Input
                placeholder="Contoh: Lengan kanan"
                value={diagnosis.body_site || ""}
                onChange={(e) => handleUpdateDiagnosis(actualIndex, "body_site", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tanggal Onset</Label>
              <Input
                type="date"
                value={diagnosis.onset_date || ""}
                onChange={(e) => handleUpdateDiagnosis(actualIndex, "onset_date", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Catatan Tambahan</Label>
            <Textarea
              placeholder="Catatan tambahan untuk diagnosis..."
              value={diagnosis.note || ""}
              onChange={(e) => handleUpdateDiagnosis(actualIndex, "note", e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/50">
        <CardTitle className="text-lg">Diagnosis (ICD-10)</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Primary Diagnosis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Diagnosis Primer <span className="text-destructive">*</span>
              </Label>
              <Popover open={searchOpen && addingType === "primary"} onOpenChange={(open) => {
                setSearchOpen(open);
                if (open) setAddingType("primary");
              }}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Diagnosis Primer
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Cari kode ICD-10 atau nama penyakit..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>Diagnosis tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {filteredICD10.map((item) => (
                          <CommandItem
                            key={item.code}
                            value={`${item.code} ${item.name}`}
                            onSelect={() => handleAddDiagnosis(item.code, item.name)}
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-sm font-semibold">{item.code}</span>
                              <span className="text-xs text-muted-foreground">{item.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {primaryDiagnoses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <p className="text-sm">Belum ada diagnosis primer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {primaryDiagnoses.map((diagnosis) => {
                  const actualIndex = diagnoses.findIndex(d => d === diagnosis);
                  return renderDiagnosisCard(diagnosis, actualIndex, true);
                })}
              </div>
            )}
          </div>

          {/* Secondary Diagnosis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Diagnosis Sekunder</Label>
              <Popover open={searchOpen && addingType === "secondary"} onOpenChange={(open) => {
                setSearchOpen(open);
                if (open) setAddingType("secondary");
              }}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Diagnosis Sekunder
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Cari kode ICD-10 atau nama penyakit..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>Diagnosis tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {filteredICD10.map((item) => (
                          <CommandItem
                            key={item.code}
                            value={`${item.code} ${item.name}`}
                            onSelect={() => handleAddDiagnosis(item.code, item.name)}
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-sm font-semibold">{item.code}</span>
                              <span className="text-xs text-muted-foreground">{item.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {secondaryDiagnoses.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <p className="text-sm">Tidak ada diagnosis sekunder</p>
              </div>
            ) : (
              <div className="space-y-2">
                {secondaryDiagnoses.map((diagnosis) => {
                  const actualIndex = diagnoses.findIndex(d => d === diagnosis);
                  return renderDiagnosisCard(diagnosis, actualIndex, false);
                })}
              </div>
            )}
          </div>

          {/* Clinical Impression */}
          <div className="space-y-2">
            <Label htmlFor="clinical_impression" className="text-sm font-semibold">
              Kesan Klinis
            </Label>
            <Textarea
              id="clinical_impression"
              placeholder="Masukkan kesan klinis berdasarkan pemeriksaan..."
              value={clinicalImpression}
              onChange={(e) => setClinicalImpression(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Differential Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="differential_diagnosis" className="text-sm font-semibold">
              Diagnosis Banding
            </Label>
            <Textarea
              id="differential_diagnosis"
              placeholder="Masukkan diagnosis banding yang dipertimbangkan..."
              value={differentialDiagnosis}
              onChange={(e) => setDifferentialDiagnosis(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" className="gap-2" disabled={primaryDiagnoses.length === 0}>
              <Save className="h-4 w-4" />
              Simpan Diagnosis
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
