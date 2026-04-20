import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Plus, X, Loader2, ChevronDown, ChevronUp, AlertCircle, Search, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi } from "@/lib/api";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { useEditMode, EditModeBanner, EditConfirmDialog, PINVerificationDialog } from "./edit-mode-controller";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved, MEDICAL_RECORD_TAB_SAVED_EVENT } from "./tab-indicator";
import { COPY_FROM_HISTORY_EVENT } from "./copy-from-history-drawer";
import { saveFormDraft, loadFormDraft, clearFormDraft, loadPendingCopy, clearPendingCopy } from "@/lib/form-persistence";
import { icd10Api, icd9cmApi, type ICD10, type ICD9CM } from "@/lib/api/icd";
import { useDebounce } from "@/hooks/use-debounce";
import type { Diagnosis as DiagnosisData, DiagnosisItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
  differential_diagnosis?: string;
  note?: string;
}

interface DiagnosisFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
  externalData?: Partial<DiagnosisData>;
  useExternalData?: boolean;
}

type UnifiedICDResult = {
  id: string;
  code: string;
  display: string;
  source: "icd10" | "icd9cm";
  asterisk?: boolean;
};

export function DiagnosisForm({
  visitId,
  onSave,
  readOnly = false,
  isPatientDischarged = false,
  externalData,
  useExternalData = false,
}: DiagnosisFormProps) {
	const { toast } = useToast();
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
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);
  
  const [searchResults, setSearchResults] = useState<UnifiedICDResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearch = useDebounce(searchValue, 300);
  const [diagnosisId, setDiagnosisId] = useState<number | undefined>();

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
    recordType: "diagnosis",
  });

  // Determine if form should be disabled
  const isFormDisabled = readOnly || (!useExternalData && isPatientDischarged && !isEditing);
  
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setSearchLoading(true);
      Promise.allSettled([
        icd10Api.search({ search: debouncedSearch, limit: 20, valid_only: true }),
        icd9cmApi.search({ search: debouncedSearch, limit: 20, valid_only: true }),
      ])
        .then(([icd10Response, icd9Response]) => {
          const icd10Results = icd10Response.status === "fulfilled" ? icd10Response.value : [];
          const icd9cmResults = icd9Response.status === "fulfilled" ? icd9Response.value : [];

          const mergedResults: UnifiedICDResult[] = [
            ...icd10Results.map((item: ICD10) => ({
              id: `icd10-${item.id}`,
              code: item.code,
              display: item.display,
              source: "icd10" as const,
              asterisk: item.asterisk,
            })),
            ...icd9cmResults.map((item: ICD9CM) => ({
              id: `icd9cm-${item.id}`,
              code: item.code,
              display: item.display,
              source: "icd9cm" as const,
              asterisk: item.asterisk,
            })),
          ];

          setSearchResults(mergedResults);
        })
        .catch((error) => {
          console.error("Failed to search ICD:", error);
          setSearchResults([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  // Load existing data on mount
  useEffect(() => {
    if (useExternalData) {
      const d = externalData || {};
      setClinicalImpression((d as any).clinical_impression || "");
      setDifferentialDiagnosis((d as any).differential_diagnosis || "");
      const items = Array.isArray((d as any).items) ? (d as any).items : [];
      setDiagnoses(
        items.map((item: any) => ({
          id: item.id,
          icd10_code: item.icd10_code || "",
          icd10_name: item.icd10_name || "",
          diagnosis_type: item.diagnosis_type || "secondary",
          clinical_status: item.clinical_status || "active",
          verification_status: item.verification_status || "confirmed",
          severity: item.severity || "",
          body_site: item.body_site || "",
          onset_date: item.onset_date || "",
          differential_diagnosis: item.differential_diagnosis || "",
          note: item.note || "",
        })),
      );
      setLoading(false);
      return;
    }

    const loadDiagnosis = async () => {
      let serverDataLoaded = false;
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
              differential_diagnosis: item.differential_diagnosis || "",
              note: item.note || "",
            })));
            // If there are diagnoses, use the first one's ID for edit log tracking
            if (data.items[0].id) {
              setDiagnosisId(data.items[0].id);
            }
          }
          if ((data.items && data.items.length > 0) || data.clinical_impression || data.differential_diagnosis) {
            serverDataLoaded = true;
            emitMedicalRecordTabSaved("diagnosis", true);
          }
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
        // Apply local draft only if server had no saved data (prevents overriding saved data)
        if (!serverDataLoaded) {
          const draft = loadFormDraft<{ diagnoses: typeof diagnoses; clinicalImpression: string; differentialDiagnosis: string }>(`mr-draft-diagnosis-${visitId}`);
          if (draft) {
            setDiagnoses(draft.diagnoses);
            setClinicalImpression(draft.clinicalImpression);
            setDifferentialDiagnosis(draft.differentialDiagnosis);
            emitMedicalRecordTabSaved("diagnosis", false);
          }
        } else {
          // Server data loaded successfully — discard any stale draft
          clearFormDraft(`mr-draft-diagnosis-${visitId}`);
        }
        // Check for pending copy from history (takes priority over draft)
        const pendingCopy = loadPendingCopy<any>("diagnosis");
        if (pendingCopy) {
          if (pendingCopy.items && pendingCopy.items.length > 0) {
            setDiagnoses(pendingCopy.items.map((item: any) => ({
              icd10_code: item.icd10_code || "",
              icd10_name: item.icd10_name || "",
              diagnosis_type: item.diagnosis_type || "secondary",
              clinical_status: item.clinical_status || "active",
              verification_status: item.verification_status || "confirmed",
              severity: item.severity || "",
              body_site: item.body_site || "",
              onset_date: item.onset_date || "",
              differential_diagnosis: item.differential_diagnosis || "",
              note: item.note || "",
            })));
          }
          setClinicalImpression(pendingCopy.clinical_impression || "");
          setDifferentialDiagnosis(pendingCopy.differential_diagnosis || "");
          emitMedicalRecordTabSaved("diagnosis", false);
        }
      }
    };

    loadDiagnosis();
  }, [visitId, useExternalData, externalData]);

  const handleAddDiagnosis = (code: string, name: string, diagnosisType: "primary" | "secondary") => {
    if (diagnosisType === "primary" && diagnoses.some((item) => item.diagnosis_type === "primary")) {
      toast({
        variant: "destructive",
        title: "Diagnosis primer sudah ada",
        description: "Ubah diagnosis primer yang ada atau tambahkan sebagai diagnosis sekunder.",
      });
      return;
    }

    const newDiagnosis: DiagnosisFormItem = {
      icd10_code: code,
      icd10_name: name,
      diagnosis_type: diagnosisType,
      clinical_status: "active",
      verification_status: "confirmed",
      severity: "",
      body_site: "",
      onset_date: "",
      differential_diagnosis: "",
      note: "",
    };
    setDiagnoses([...diagnoses, newDiagnosis]);
    setSelectorOpen(false);
    setSearchValue("");
    emitMedicalRecordTabSaved("diagnosis", false);
  };

  const openSelector = () => {
    setSelectorOpen(true);
    setSearchValue("");
    setSearchResults([]);
  };

  const handleCopyICD9Code = async (item: ICD9CM) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.code);
      }
      toast({
        title: "ICD-9-CM disalin",
        description: `${item.code} disalin. Gunakan sebagai referensi prosedur/tindakan.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal menyalin kode",
        description: "Silakan salin kode ICD-9-CM secara manual.",
      });
    }
  };

  const renderAddDiagnosisCard = () => (
    <button
      type="button"
      onClick={openSelector}
      className="w-full border-y border-dashed border-muted-foreground/50 py-4 text-left transition-colors hover:border-primary/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Plus className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Tambah Diagnosis ICD</p>
            <p className="text-xs text-muted-foreground">
              Cari ICD-10 dan ICD-9-CM dalam satu daftar. Primer atau sekunder dipilih saat Anda memilih item.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">ICD</Badge>
      </div>
    </button>
  );

  const handleRemoveDiagnosis = (index: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
    if (expandedDiagnosis === index) setExpandedDiagnosis(null);
    emitMedicalRecordTabSaved("diagnosis", false);
  };

  const handleUpdateDiagnosis = (index: number, field: keyof DiagnosisFormItem, value: string) => {
    const updated = [...diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    setDiagnoses(updated);
    emitMedicalRecordTabSaved("diagnosis", false);
  };

  const doSave = async () => {
    if (useExternalData) {
      onSave?.({
        clinical_impression: clinicalImpression,
        differential_diagnosis: differentialDiagnosis,
        items: diagnoses,
      });
      return;
    }

    // Log edit if patient is discharged
    if (isPatientDischarged && diagnosisId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "diagnosis",
          record_id: diagnosisId,
          action: "edit",
          reason: editReason || "Edit setelah pasien pulang",
        });
      } catch (error) {
        console.error("Failed to log edit:", error);
      }
    }
    
    onSave?.({ 
      clinical_impression: clinicalImpression,
      differential_diagnosis: differentialDiagnosis,
      items: diagnoses 
    });
    resetEditMode();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If patient is discharged, verify PIN before saving
    if (!useExternalData && isPatientDischarged) {
      requestPINVerification(doSave);
      return;
    }
    
    doSave();
  };

  const primaryDiagnoses = diagnoses.filter((d) => d.diagnosis_type === "primary");
  const secondaryDiagnoses = diagnoses.filter((d) => d.diagnosis_type === "secondary");
  const hasPrimaryDiagnosis = primaryDiagnoses.length > 0;
  const filledDiagnosisFields =
    diagnoses.length +
    diagnoses.filter((item) => item.differential_diagnosis?.trim()).length +
    (differentialDiagnosis.trim() ? 1 : 0);

  useEffect(() => {
    if (loading || masterDataLoading) return;
    emitMedicalRecordTabIndicator("diagnosis", `${filledDiagnosisFields}`);
  }, [filledDiagnosisFields, loading, masterDataLoading]);

  // Auto-save draft to localStorage on every state change
  useEffect(() => {
    if (useExternalData) return;
    if (loading) return;
    saveFormDraft(`mr-draft-diagnosis-${visitId}`, { diagnoses, clinicalImpression, differentialDiagnosis });
  }, [diagnoses, clinicalImpression, differentialDiagnosis, loading, visitId, useExternalData]);

  // Clear draft when save is confirmed by server
  useEffect(() => {
    if (useExternalData) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "diagnosis" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-diagnosis-${visitId}`);
      }
    };
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
    return () => window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
  }, [visitId, useExternalData]);

  // Listen for copy-from-history events
  useEffect(() => {
    if (useExternalData) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ section: string; data: any }>;
      if (ev.detail?.section !== "diagnosis" || !ev.detail.data) return;
      clearPendingCopy("diagnosis");
      const d = ev.detail.data;
      if (d.items && d.items.length > 0) {
        setDiagnoses(d.items.map((item: any) => ({
          icd10_code: item.icd10_code || "",
          icd10_name: item.icd10_name || "",
          diagnosis_type: item.diagnosis_type || "secondary",
          clinical_status: item.clinical_status || "active",
          verification_status: item.verification_status || "confirmed",
          severity: item.severity || "",
          body_site: item.body_site || "",
          onset_date: item.onset_date || "",
          differential_diagnosis: item.differential_diagnosis || "",
          note: item.note || "",
        })));
      }
      setClinicalImpression(d.clinical_impression || "");
      setDifferentialDiagnosis(d.differential_diagnosis || "");
      emitMedicalRecordTabSaved("diagnosis", false);
    };
    window.addEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
    return () => window.removeEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
  }, [useExternalData]);

  if (loading || masterDataLoading) {
    return (
      <div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render diagnosis card with expandable FHIR details
  const renderDiagnosisCard = (diagnosis: DiagnosisFormItem, actualIndex: number, isPrimary: boolean = false) => (
    <div
      key={actualIndex}
      className={`px-3 py-3 border-l-4 ${isPrimary ? "border-primary/60 bg-primary/5" : "border-border"}`}
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
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Diagnosa Banding
            </Label>
            <Textarea
              placeholder="Diagnosis banding untuk ICD ini..."
              value={diagnosis.differential_diagnosis || ""}
              onChange={(e) => handleUpdateDiagnosis(actualIndex, "differential_diagnosis", e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div>
            {!useExternalData && (
              <EditModeBanner
                isPatientDischarged={isPatientDischarged}
                isEditing={isEditing}
                onRequestEdit={handleRequestEdit}
                recordTypeLabel="Diagnosis"
              />
            )}
        <fieldset disabled={isFormDisabled}>
          <form onSubmit={handleSubmit} className="space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
            <div className="space-y-6">
            
            <div className="border border-border/70">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Penetapan Diagnosis
              </div>
              <div className="space-y-6 p-3 sm:p-4">
              {renderAddDiagnosisCard()}
              <div className="flex flex-wrap gap-2">
                <Badge variant={primaryDiagnoses.length > 0 ? "default" : "outline"}>Primer: {primaryDiagnoses.length}</Badge>
                <Badge variant={secondaryDiagnoses.length > 0 ? "default" : "outline"}>Sekunder: {secondaryDiagnoses.length}</Badge>
                <Badge variant="outline">Total: {diagnoses.length}</Badge>
              </div>
              <div className="space-y-7">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Diagnosis Primer</Badge>
                  </div>
                  {primaryDiagnoses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada diagnosis primer.</p>
                  ) : (
                    <div className="space-y-2">
                      {primaryDiagnoses.map((diagnosis) => {
                        const actualIndex = diagnoses.findIndex(d => d === diagnosis);
                        return renderDiagnosisCard(diagnosis, actualIndex, true);
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Diagnosis Sekunder</Badge>
                  </div>
                  {secondaryDiagnoses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada diagnosis sekunder.</p>
                  ) : (
                    <div className="space-y-2">
                      {secondaryDiagnoses.map((diagnosis) => {
                        const actualIndex = diagnoses.findIndex(d => d === diagnosis);
                        return renderDiagnosisCard(diagnosis, actualIndex, false);
                      })}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>

            </div>
          </form>
        </fieldset>
      </div>
          <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
            <DialogTitle>Pilih Diagnosis ICD</DialogTitle>
            <DialogDescription>
              Hasil ICD-10 dan ICD-9-CM ditampilkan dalam satu daftar. Untuk ICD-10, pilih primer atau sekunder langsung dari item yang dipilih.
            </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
              <Label htmlFor="diagnosis-selector-search">Cari ICD</Label>
              <Input id="diagnosis-selector-search" placeholder="Ketik minimal 2 karakter untuk mencari ICD-10 atau ICD-9-CM..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
              </div>
              <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {searchLoading && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mencari ICD...
                </div>
              )}
              {!searchLoading && searchValue.length < 2 && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                <Search className="mx-auto mb-3 h-8 w-8 opacity-50" />
                Ketik minimal 2 karakter untuk mulai mencari ICD.
                </div>
              )}
              {!searchLoading && searchValue.length >= 2 && searchResults.length === 0 && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Tidak ditemukan kode ICD.
                </div>
              )}
              {searchResults.map((item) => (
                <div key={item.id} className="space-y-3 border-b pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{item.code}</Badge>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.display}</p>
                            <Badge variant={item.source === "icd10" ? "default" : "secondary"} className="text-[10px] uppercase">
                              {item.source === "icd10" ? "ICD-10" : "ICD-9-CM"}
                            </Badge>
                            {item.asterisk && <Badge variant="secondary" className="text-[10px]">*</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.source === "icd10"
                              ? "Pilih tipe diagnosis dari item ini."
                              : "ICD-9-CM dipakai sebagai referensi tindakan atau prosedur."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {item.source === "icd10" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddDiagnosis(item.code, item.display, "primary")}
                          disabled={hasPrimaryDiagnosis}
                        >
                          Pilih Sebagai Primer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddDiagnosis(item.code, item.display, "secondary")}
                        >
                          Pilih Sebagai Sekunder
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleCopyICD9Code({ id: Number(item.id.replace("icd9cm-", "")), code: item.code, code2: "", display: item.display, valid_code: true, acc_pdx: false, asterisk: !!item.asterisk, im: false, is_active: true })}>
                          <Copy className="mr-2 h-4 w-4" />
                          Salin Kode ICD-9-CM
                        </Button>
                      </div>
                    )}
                </div>
              ))}
              </div>
            </div>
          </DialogContent>
          </Dialog>
      {!useExternalData && (
        <>
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
        </>
      )}
    </div>
  );
}
