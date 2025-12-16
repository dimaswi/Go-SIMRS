import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Combobox } from "@/components/ui/combobox";
import { Save, Plus, X, Loader2, ChevronDown, ChevronUp, FileText, Stethoscope, AlertCircle, Search } from "lucide-react";
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
import { icd10Api, type ICD10 } from "@/lib/api/icd";
import { useDebounce } from "@/hooks/use-debounce";
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
  readOnly?: boolean;
}

export function DiagnosisForm({ visitId, onSave, readOnly = false }: DiagnosisFormProps) {
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
  
  // ICD-10 search state
  const [icdResults, setIcdResults] = useState<ICD10[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const debouncedSearch = useDebounce(searchValue, 300);
  
  // Search ICD-10 when debounced search changes
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setIcdLoading(true);
      icd10Api
        .search({ search: debouncedSearch, limit: 30, valid_only: true })
        .then((data) => {
          setIcdResults(data);
        })
        .catch((error) => {
          console.error("Failed to search ICD-10:", error);
          setIcdResults([]);
        })
        .finally(() => {
          setIcdLoading(false);
        });
    } else {
      setIcdResults([]);
    }
  }, [debouncedSearch]);

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
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Diagnosis (ICD-10)
            </CardTitle>
            <CardDescription>
              Diagnosis primer, sekunder, dan diferensial dengan kode ICD-10
            </CardDescription>
          </div>
          <Badge variant={diagnoses.length > 0 ? "default" : "secondary"}>
            {primaryDiagnoses.length} Primer | {secondaryDiagnoses.length} Sekunder
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
        <fieldset disabled={readOnly}>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
            
            {/* Section 1: Diagnosis Primer */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                      <Stethoscope className="h-5 w-5 text-green-500" />
                    </div>
                    <CardTitle className="text-base font-semibold">
                      Diagnosis Primer <span className="text-destructive">*</span>
                    </CardTitle>
                    <Badge variant={primaryDiagnoses.length > 0 ? "default" : "outline"}>
                      {primaryDiagnoses.length}
                    </Badge>
                  </div>
                  <Popover open={searchOpen && addingType === "primary"} onOpenChange={(open) => {
                    setSearchOpen(open);
                    if (open) {
                      setAddingType("primary");
                      setSearchValue("");
                      setIcdResults([]);
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[550px] p-0" align="end">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Ketik minimal 2 karakter untuk mencari ICD-10..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList>
                          {icdLoading && (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm text-muted-foreground">Mencari...</span>
                            </div>
                          )}
                          {!icdLoading && searchValue.length < 2 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              Ketik minimal 2 karakter untuk mencari
                            </div>
                          )}
                          {!icdLoading && searchValue.length >= 2 && icdResults.length === 0 && (
                            <CommandEmpty>Tidak ditemukan kode ICD-10</CommandEmpty>
                          )}
                          {!icdLoading && icdResults.length > 0 && (
                            <CommandGroup heading={`${icdResults.length} hasil ditemukan`}>
                              {icdResults.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={item.code}
                                  onSelect={() => handleAddDiagnosis(item.code, item.display)}
                                  className="flex items-start gap-2 py-2"
                                >
                                  <div className="flex flex-col gap-0.5 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                                        {item.code}
                                      </Badge>
                                      {item.asterisk && (
                                        <Badge variant="secondary" className="text-xs">*</Badge>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {item.display}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {primaryDiagnoses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Belum ada diagnosis primer</p>
                    <p className="text-xs mt-1">Klik "Tambah" untuk menambahkan diagnosis utama</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {primaryDiagnoses.map((diagnosis) => {
                      const actualIndex = diagnoses.findIndex(d => d === diagnosis);
                      return renderDiagnosisCard(diagnosis, actualIndex, true);
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 2: Diagnosis Sekunder */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <CardTitle className="text-base font-semibold">Diagnosis Sekunder</CardTitle>
                    <Badge variant={secondaryDiagnoses.length > 0 ? "default" : "outline"}>
                      {secondaryDiagnoses.length}
                    </Badge>
                  </div>
                  <Popover open={searchOpen && addingType === "secondary"} onOpenChange={(open) => {
                    setSearchOpen(open);
                    if (open) {
                      setAddingType("secondary");
                      setSearchValue("");
                      setIcdResults([]);
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="end" sideOffset={5}>
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Cari kode/nama penyakit..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList className="max-h-[300px]">
                          {icdLoading && (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm text-muted-foreground">Mencari...</span>
                            </div>
                          )}
                          {!icdLoading && searchValue.length < 2 && (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              Ketik minimal 2 karakter
                            </div>
                          )}
                          {!icdLoading && searchValue.length >= 2 && icdResults.length === 0 && (
                            <CommandEmpty>Tidak ditemukan</CommandEmpty>
                          )}
                          {!icdLoading && icdResults.length > 0 && (
                            <CommandGroup heading={`${icdResults.length} hasil`}>
                              {icdResults.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={item.code}
                                  onSelect={() => handleAddDiagnosis(item.code, item.display)}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {item.code}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground line-clamp-2">
                                      {item.display}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="p-4">
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
              </CardContent>
            </Card>

            {/* Section 3: Kesan Klinis & Diagnosis Banding */}
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>
                  <CardTitle className="text-base font-semibold">Kesan Klinis & Diagnosis Banding</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Clinical Impression */}
                <div className="space-y-2">
                  <Label htmlFor="clinical_impression" className="text-sm font-semibold">
                    Kesan Klinis
                  </Label>
                  <Textarea
                    id="clinical_impression"
                    placeholder="Kesan klinis berdasarkan anamnesis, pemeriksaan fisik, dan penunjang..."
                    value={clinicalImpression}
                    onChange={(e) => setClinicalImpression(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ringkasan interpretasi klinis dari semua temuan pemeriksaan
                  </p>
                </div>

                {/* Differential Diagnosis */}
                <div className="space-y-2">
                  <Label htmlFor="differential_diagnosis" className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-purple-500" />
                    Diagnosis Banding
                  </Label>
                  <Textarea
                    id="differential_diagnosis"
                    placeholder="Diagnosis banding yang dipertimbangkan dan perlu disingkirkan..."
                    value={differentialDiagnosis}
                    onChange={(e) => setDifferentialDiagnosis(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Daftar diagnosis alternatif yang perlu dipertimbangkan
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2" disabled={primaryDiagnoses.length === 0}>
                <Save className="h-4 w-4" />
                Simpan Diagnosis
              </Button>
            </div>
            </div>
          </form>
        </fieldset>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
