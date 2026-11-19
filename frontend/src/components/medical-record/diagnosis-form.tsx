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
  const [selectorTargetType, setSelectorTargetType] = useState<"primary" | "secondary">("primary");
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

  const handleAddDiagnosis = (code: string, name: string, diagnosisType: "primary" | "secondary" = selectorTargetType) => {
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

    if (diagnosisType === "primary") {
      const existingPrimaryIndex = diagnoses.findIndex((item) => item.diagnosis_type === "primary");
      if (existingPrimaryIndex >= 0) {
        const updated = [...diagnoses];
        updated[existingPrimaryIndex] = {
          ...updated[existingPrimaryIndex],
          icd10_code: code,
          icd10_name: name,
          diagnosis_type: "primary",
        };
        setDiagnoses(updated);
      } else {
        setDiagnoses([newDiagnosis, ...diagnoses]);
      }
    } else {
      setDiagnoses([...diagnoses, newDiagnosis]);
    }

    setSelectorOpen(false);
    setSearchValue("");
    emitMedicalRecordTabSaved("diagnosis", false);
  };

  const openSelector = (targetType: "primary" | "secondary") => {
    setSelectorTargetType(targetType);
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

  // Render diagnosis row with expandable FHIR details
  const renderDiagnosisCard = (diagnosis: DiagnosisFormItem, actualIndex: number, isPrimary: boolean = false) => {
    const severityLabel = severityOptions.find((s) => s.value === diagnosis.severity)?.label;
    const clinicalLabel = clinicalStatusOptions.find((s) => s.value === diagnosis.clinical_status)?.label;
    const verificationLabel = verificationStatusOptions.find((s) => s.value === diagnosis.verification_status)?.label;

    return (
      <div
        key={actualIndex}
        className={`border-l-4 ${
          isPrimary
            ? "border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/40 dark:bg-neutral-900/20"
            : "border-l-neutral-400 dark:border-l-neutral-600 bg-white dark:bg-neutral-950"
        }`}
      >
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpandedDiagnosis(expandedDiagnosis === actualIndex ? null : actualIndex)}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <Badge
              variant={isPrimary ? "default" : "outline"}
              className="rounded-none font-mono text-xs h-5 px-1.5 shrink-0"
            >
              {diagnosis.icd10_code}
            </Badge>
            <span className="text-xs font-semibold text-foreground break-words">
              {diagnosis.icd10_name}
            </span>
            {clinicalLabel && (
              <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5">
                {clinicalLabel}
              </Badge>
            )}
            {verificationLabel && (
              <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5">
                {verificationLabel}
              </Badge>
            )}
            {severityLabel && (
              <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5">
                {severityLabel}
              </Badge>
            )}
            {diagnosis.body_site && (
              <span className="text-[11px] text-muted-foreground">
                • Lokasi: {diagnosis.body_site}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-none"
              onClick={() => setExpandedDiagnosis(expandedDiagnosis === actualIndex ? null : actualIndex)}
              title="Detail Diagnosis"
            >
              {expandedDiagnosis === actualIndex ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
            {!isFormDisabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-none text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveDiagnosis(actualIndex)}
                title="Hapus Diagnosis"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Expanded FHIR details */}
        {expandedDiagnosis === actualIndex && (
          <div className="px-3.5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status Klinis</Label>
                <Combobox
                  allowCustomValue
                  options={clinicalStatusOptions}
                  value={diagnosis.clinical_status || "active"}
                  onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "clinical_status", value)}
                  placeholder="Pilih status klinis"
                  searchPlaceholder="Cari status klinis..."
                  loading={masterDataLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status Verifikasi</Label>
                <Combobox
                  allowCustomValue
                  options={verificationStatusOptions}
                  value={diagnosis.verification_status || "confirmed"}
                  onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "verification_status", value)}
                  placeholder="Pilih status verifikasi"
                  searchPlaceholder="Cari status verifikasi..."
                  loading={masterDataLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tingkat Keparahan</Label>
                <Combobox
                  allowCustomValue
                  options={severityOptions}
                  value={diagnosis.severity || ""}
                  onValueChange={(value) => handleUpdateDiagnosis(actualIndex, "severity", value)}
                  placeholder="Pilih keparahan"
                  searchPlaceholder="Cari keparahan..."
                  loading={masterDataLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lokasi Anatomi</Label>
                <Input
                  placeholder="Contoh: Lengan kanan"
                  value={diagnosis.body_site || ""}
                  onChange={(e) => handleUpdateDiagnosis(actualIndex, "body_site", e.target.value)}
                  className="bg-white dark:bg-neutral-950"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tanggal Onset</Label>
                <Input
                  type="date"
                  value={diagnosis.onset_date || ""}
                  onChange={(e) => handleUpdateDiagnosis(actualIndex, "onset_date", e.target.value)}
                  className="bg-white dark:bg-neutral-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catatan Tambahan</Label>
                <Textarea
                  placeholder="Catatan klinis tambahan untuk diagnosis ini..."
                  value={diagnosis.note || ""}
                  onChange={(e) => handleUpdateDiagnosis(actualIndex, "note", e.target.value)}
                  className="min-h-[68px] resize-none text-xs rounded-none bg-white dark:bg-neutral-950"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Diagnosis Banding
                </Label>
                <Textarea
                  placeholder="Diagnosis banding untuk kode ICD ini..."
                  value={diagnosis.differential_diagnosis || ""}
                  onChange={(e) => handleUpdateDiagnosis(actualIndex, "differential_diagnosis", e.target.value)}
                  className="min-h-[68px] resize-none text-xs rounded-none bg-white dark:bg-neutral-950"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      <div>
        {!useExternalData && (
          <div className="px-4 sm:px-5 pt-3 empty:hidden">
            <EditModeBanner
              isPatientDischarged={isPatientDischarged}
              isEditing={isEditing}
              onRequestEdit={handleRequestEdit}
              recordTypeLabel="Diagnosis"
            />
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={isFormDisabled}
            className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs"
          >
            {/* Section 1: Diagnosis Primer (Utama) */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Diagnosis Primer (Utama)
                  </div>
                  <Badge
                    variant={primaryDiagnoses.length > 0 ? "default" : "secondary"}
                    className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                  >
                    {primaryDiagnoses.length}
                  </Badge>
                </div>

                {!isFormDisabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openSelector("primary")}
                    className="h-8 rounded-none px-3 text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {hasPrimaryDiagnosis ? "Ubah Diagnosis Primer" : "Pilih Diagnosis Primer"}
                  </Button>
                )}
              </div>

              {primaryDiagnoses.length === 0 ? (
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Belum ada diagnosis primer (utama) yang dipilih.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                  {primaryDiagnoses.map((diagnosis) => {
                    const actualIndex = diagnoses.findIndex((d) => d === diagnosis);
                    return renderDiagnosisCard(diagnosis, actualIndex, true);
                  })}
                </div>
              )}
            </section>

            {/* Section 2: Diagnosis Sekunder (Penyerta / Komplikasi) */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Diagnosis Sekunder
                  </div>
                  <Badge
                    variant={secondaryDiagnoses.length > 0 ? "default" : "secondary"}
                    className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                  >
                    {secondaryDiagnoses.length}
                  </Badge>
                </div>

                {!isFormDisabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openSelector("secondary")}
                    className="h-8 rounded-none px-3 text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Diagnosis Sekunder
                  </Button>
                )}
              </div>

              {secondaryDiagnoses.length === 0 ? (
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Belum ada diagnosis sekunder / penyerta yang tercatat.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                  {secondaryDiagnoses.map((diagnosis) => {
                    const actualIndex = diagnoses.findIndex((d) => d === diagnosis);
                    return renderDiagnosisCard(diagnosis, actualIndex, false);
                  })}
                </div>
              )}
            </section>
          </fieldset>
        </form>
      </div>

      {/* Modal Pilih Diagnosis ICD */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-3xl rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Search className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {selectorTargetType === "primary"
                    ? "Pilih Diagnosis Primer (Utama)"
                    : "Tambah Diagnosis Sekunder"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {selectorTargetType === "primary"
                    ? "Cari dan pilih kode penyakit ICD-10 untuk ditetapkan sebagai Diagnosis Primer."
                    : "Cari dan pilih kode penyakit ICD-10 untuk ditambahkan ke daftar Diagnosis Sekunder."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="diagnosis-selector-search"
                placeholder="Ketik minimal 2 karakter (kode atau nama ICD-10 / ICD-9-CM)..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-9 pl-8 text-xs rounded-none bg-white dark:bg-neutral-950"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
            {searchLoading && (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mencari kode ICD...
              </div>
            )}
            {!searchLoading && searchValue.length < 2 && (
              <div className="py-10 px-4 text-center text-xs text-muted-foreground">
                <Search className="mx-auto mb-2 h-6 w-6 opacity-40" />
                Ketik minimal 2 karakter untuk mulai mencari ICD-10 atau ICD-9-CM.
              </div>
            )}
            {!searchLoading && searchValue.length >= 2 && searchResults.length === 0 && (
              <div className="py-10 px-4 text-center text-xs text-muted-foreground">
                Tidak ditemukan kode ICD yang cocok dengan pencarian Anda.
              </div>
            )}
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.source === "icd10") {
                    handleAddDiagnosis(item.code, item.display, selectorTargetType);
                  }
                }}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors ${
                  item.source === "icd10" ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Badge variant="outline" className="rounded-none font-mono text-xs h-5 px-1.5 shrink-0 mt-0.5">
                    {item.code}
                  </Badge>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{item.display}</span>
                      <Badge
                        variant={item.source === "icd10" ? "default" : "secondary"}
                        className="rounded-none text-[9px] h-4 px-1 uppercase"
                      >
                        {item.source === "icd10" ? "ICD-10" : "ICD-9-CM"}
                      </Badge>
                      {item.asterisk && (
                        <Badge variant="secondary" className="rounded-none text-[9px] h-4 px-1">
                          *
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {item.source === "icd10" ? (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 rounded-none px-3 text-xs"
                      onClick={() => handleAddDiagnosis(item.code, item.display, selectorTargetType)}
                    >
                      Pilih
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-none px-2.5 text-xs"
                      onClick={() =>
                        handleCopyICD9Code({
                          id: Number(item.id.replace("icd9cm-", "")),
                          code: item.code,
                          code2: "",
                          display: item.display,
                          valid_code: true,
                          acc_pdx: false,
                          asterisk: !!item.asterisk,
                          im: false,
                          is_active: true,
                        })
                      }
                    >
                      <Copy className="mr-1.5 h-3 w-3" />
                      Salin ICD-9-CM
                    </Button>
                  </div>
                )}
              </div>
            ))}
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

