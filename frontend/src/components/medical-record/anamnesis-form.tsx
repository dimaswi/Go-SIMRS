import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle, Search, X, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { medicalRecordsApi, patientAllergyApi, ALLERGY_CATEGORY_LABELS, ALLERGY_CRITICALITY_LABELS, ALLERGY_CRITICALITY_COLORS } from "@/lib/api";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { useEditMode, EditModeBanner, EditConfirmDialog, PINVerificationDialog } from "./edit-mode-controller";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved, MEDICAL_RECORD_TAB_SAVED_EVENT } from "./tab-indicator";
import { COPY_FROM_HISTORY_EVENT } from "./copy-from-history-drawer";
import { saveFormDraft, loadFormDraft, clearFormDraft, loadPendingCopy, clearPendingCopy } from "@/lib/form-persistence";
import type { Anamnesis, PatientAllergy, AllergyCategory, AllergyCriticality } from "@/lib/api";
import type { SnomedMaster } from "@/lib/api/loinc";
import { useDebounce } from "@/hooks/use-debounce";

interface AnamnesisFormProps {
  visitId: number;
  patientId?: number;
  onSave?: (data: any) => void;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
  externalData?: Partial<Anamnesis>;
  useExternalData?: boolean;
}

interface NewAllergyInput {
  snomed_code: string;
  snomed_display: string;
  category: AllergyCategory;
  criticality: AllergyCriticality;
  notes: string;
}

const defaultFormData = {
  anamnesis_source: "autoanamnesis",
  functional_status: "",
  chief_complaint: "",
  history_of_present_illness: "",
  past_medical_history: "",
  family_history: "",
  social_history: "",
  allergies: "Tidak ada alergi", // Legacy field - will still save as summary
  current_medications: "",
};

const FUNCTIONAL_STATUS_OPTIONS = [
  { value: "mandiri", label: "Mandiri", description: "Pasien mampu melakukan aktivitas sehari-hari tanpa bantuan" },
  { value: "bantuan_sebagian", label: "Perlu Bantuan Sebagian", description: "Pasien membutuhkan bantuan untuk sebagian aktivitas" },
  { value: "bantuan_total", label: "Perlu Bantuan Total", description: "Pasien membutuhkan bantuan penuh untuk semua aktivitas" },
];

const defaultNewAllergy: NewAllergyInput = {
  snomed_code: "",
  snomed_display: "",
  category: "medication",
  criticality: "low",
  notes: "",
};

// const isMeaningfulAllergySummary = (value?: string) => {
//   const normalized = (value || "").trim().toLowerCase().replace(/\s+/g, " ");
//   if (!normalized) return false;
//   return !/^(none|no known allergies|nkda|nka|nihil|\-|tidak ada|tidak ada alergi)$/.test(normalized);
// };

export function AnamnesisForm({
  visitId,
  patientId,
  onSave,
  readOnly = false,
  isPatientDischarged = false,
  externalData,
  useExternalData = false,
}: AnamnesisFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [anamnesisId, setAnamnesisId] = useState<number | undefined>();

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
    recordType: "anamnesis",
  });

  // Determine if form should be disabled
  const isFormDisabled = readOnly || (isPatientDischarged && !isEditing);

  // Allergy states
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergy[]>([]);
  const [loadingAllergies, setLoadingAllergies] = useState(true);
  const [newAllergy, setNewAllergy] = useState<NewAllergyInput>(defaultNewAllergy);
  const [showAllergyForm, setShowAllergyForm] = useState(false);

  // SNOMED search states
  const [snomedQuery, setSnomedQuery] = useState("");
  const [snomedResults, setSnomedResults] = useState<SnomedMaster[]>([]);
  const [searchingSnomed, setSearchingSnomed] = useState(false);
  const debouncedSnomedQuery = useDebounce(snomedQuery, 300);

  // Saving states
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [deletingAllergyId, setDeletingAllergyId] = useState<number | null>(null);
  const [duplicateAllergyAlert, setDuplicateAllergyAlert] = useState(false);
  const [deleteAllergyConfirm, setDeleteAllergyConfirm] = useState<number | null>(null);

  // Load existing anamnesis data
  useEffect(() => {
    if (useExternalData) {
      const d = externalData || {};
      setFormData({
        anamnesis_source: d.anamnesis_source || "autoanamnesis",
        functional_status: d.functional_status || "",
        chief_complaint: d.chief_complaint || "",
        history_of_present_illness: d.history_of_present_illness || "",
        past_medical_history: d.past_medical_history || "",
        family_history: d.family_history || "",
        social_history: d.social_history || "",
        allergies: d.allergies || "Tidak ada alergi",
        current_medications: d.current_medications || "",
      });
      setLoading(false);
      return;
    }

    const loadAnamnesis = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getAnamnesis(visitId);
        const data = response.data as Anamnesis;
        if (data && data.id) {
          setFormData({
            anamnesis_source: data.anamnesis_source || "autoanamnesis",
            functional_status: data.functional_status || "",
            chief_complaint: data.chief_complaint || "",
            history_of_present_illness: data.history_of_present_illness || "",
            past_medical_history: data.past_medical_history || "",
            family_history: data.family_history || "",
            social_history: data.social_history || "",
            allergies: data.allergies || "Tidak ada alergi",
            current_medications: data.current_medications || "",
          });
          setAnamnesisId(data.id);
          emitMedicalRecordTabSaved("anamnesis", true);
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
        // Apply local draft if exists — overrides server data if user had unsaved changes
        const draft = loadFormDraft<typeof defaultFormData>(`mr-draft-anamnesis-${visitId}`);
        if (draft) {
          if (!draft.allergies) draft.allergies = "Tidak ada alergi";
          setFormData(draft);
          emitMedicalRecordTabSaved("anamnesis", false);
        }
        // Check for pending copy from history (takes priority over draft)
        const pendingCopy = loadPendingCopy<any>("anamnesis");
        if (pendingCopy) {
          setFormData(prev => ({
            ...prev,
            anamnesis_source: pendingCopy.anamnesis_source || "autoanamnesis",
            functional_status: pendingCopy.functional_status || "",
            chief_complaint: pendingCopy.chief_complaint || "",
            history_of_present_illness: pendingCopy.history_of_present_illness || "",
            past_medical_history: pendingCopy.past_medical_history || "",
            family_history: pendingCopy.family_history || "",
            social_history: pendingCopy.social_history || "",
            allergies: pendingCopy.allergies || "",
            current_medications: pendingCopy.current_medications || "",
          }));
          emitMedicalRecordTabSaved("anamnesis", false);
        }
      }
    };

    loadAnamnesis();
  }, [visitId, useExternalData, externalData]);

  // Load patient allergies
  const loadAllergies = useCallback(async () => {
    if (useExternalData || !patientId) {
      setLoadingAllergies(false);
      return;
    }
    try {
      setLoadingAllergies(true);
      const response = await patientAllergyApi.getByPatient(patientId);
      setPatientAllergies(response.data.data || []);
    } catch (error) {
      console.error("Failed to load allergies:", error);
    } finally {
      setLoadingAllergies(false);
    }
  }, [patientId, useExternalData]);

  useEffect(() => {
    loadAllergies();
  }, [loadAllergies]);

  // Reload allergies when copy creates new structured records
  useEffect(() => {
    const handler = () => { loadAllergies(); };
    window.addEventListener("reload-patient-allergies", handler);
    return () => window.removeEventListener("reload-patient-allergies", handler);
  }, [loadAllergies]);

  // Search SNOMED CT when query changes
  useEffect(() => {
    const searchSnomed = async () => {
      if (debouncedSnomedQuery.length < 3) {
        setSnomedResults([]);
        return;
      }

      setSearchingSnomed(true);
      try {
        const response = await patientAllergyApi.searchSnomed(debouncedSnomedQuery, 20);
        setSnomedResults(response.data.data || []);
      } catch (error) {
        console.error("Failed to search SNOMED:", error);
        setSnomedResults([]);
      } finally {
        setSearchingSnomed(false);
      }
    };

    searchSnomed();
  }, [debouncedSnomedQuery]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    emitMedicalRecordTabSaved("anamnesis", false);
  };

  const handleSelectSnomed = (snomed: SnomedMaster) => {
    setNewAllergy({
      ...newAllergy,
      snomed_code: snomed.conceptId,
      snomed_display: snomed.term,
    });
    setSnomedQuery(snomed.term);
    setSnomedResults([]);
  };

  const handleAddAllergy = async () => {
    if (!patientId || !newAllergy.snomed_code || !newAllergy.snomed_display) {
      return;
    }

    setSavingAllergy(true);
    try {
      const response = await patientAllergyApi.create({
        patient_id: patientId,
        visit_id: visitId,
        snomed_code: newAllergy.snomed_code,
        snomed_display: newAllergy.snomed_display,
        category: newAllergy.category,
        criticality: newAllergy.criticality,
        notes: newAllergy.notes,
      });

      // Add to list
      const updatedAllergies = [response.data.data, ...patientAllergies];
      setPatientAllergies(updatedAllergies);

      // Reset form
      setNewAllergy(defaultNewAllergy);
      setSnomedQuery("");
      setShowAllergyForm(false);

      // Update legacy allergies field summary
      updateAllergiesSummary(updatedAllergies);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setDuplicateAllergyAlert(true);
      } else {
        console.error("Failed to add allergy:", error);
      }
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleDeleteAllergy = async (allergyId: number) => {
    setDeleteAllergyConfirm(allergyId);
  };

  const handleConfirmDeleteAllergy = async () => {
    const allergyId = deleteAllergyConfirm;
    if (!allergyId) return;
    setDeleteAllergyConfirm(null);

    setDeletingAllergyId(allergyId);
    try {
      await patientAllergyApi.delete(allergyId);
      const updated = patientAllergies.filter(a => a.id !== allergyId);
      setPatientAllergies(updated);
      updateAllergiesSummary(updated);
    } catch (error) {
      console.error("Failed to delete allergy:", error);
    } finally {
      setDeletingAllergyId(null);
    }
  };

  // Update the legacy allergies text field with summary
  const updateAllergiesSummary = useCallback((allergies: PatientAllergy[]) => {
    const summary = allergies
      .map(a => `${a.snomed_display} (${ALLERGY_CATEGORY_LABELS[a.category]})`)
      .join(", ");
    setFormData(prev => ({ ...prev, allergies: summary }));
  }, []);

  const doSave = async () => {
    // Log edit if patient is discharged
    if (isPatientDischarged && anamnesisId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "anamnesis",
          record_id: anamnesisId,
          action: "edit",
          reason: editReason || "Edit setelah pasien pulang",
        });
      } catch (error) {
        console.error("Failed to log edit:", error);
      }
    }

    onSave?.(formData);
    resetEditMode();
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

  // Count filled fields: 6 text fields + allergies (structured OR legacy text)
  const filledTextFields = Object.entries(formData).filter(([k, v]) => k !== "allergies" && v && v.trim() !== "").length;
  const isAllergyFilled = patientAllergies.length > 0 || (typeof formData.allergies === 'string' && formData.allergies.trim() !== "");
  const filledFields = filledTextFields + (isAllergyFilled ? 1 : 0);
  const totalFields = 9;

  useEffect(() => {
    if (loading || loadingAllergies) return;
    emitMedicalRecordTabIndicator("anamnesis", `${filledFields}/${totalFields}`);
  }, [filledFields, loading, loadingAllergies, totalFields]);

  // Auto-save draft to localStorage on every form change
  useEffect(() => {
    if (loading) return;
    saveFormDraft(`mr-draft-anamnesis-${visitId}`, formData);
  }, [formData, loading, visitId]);

  // Clear draft when save is confirmed by server
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "anamnesis" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-anamnesis-${visitId}`);
      }
    };
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
    return () => window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
  }, [visitId]);

  // Listen for copy-from-history events
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ section: string; data: any }>;
      if (ev.detail?.section !== "anamnesis" || !ev.detail.data) return;
      clearPendingCopy("anamnesis");
      const d = ev.detail.data;
      setFormData(prev => ({
        ...prev,
        anamnesis_source: d.anamnesis_source || "autoanamnesis",
        functional_status: d.functional_status || "",
        chief_complaint: d.chief_complaint || "",
        history_of_present_illness: d.history_of_present_illness || "",
        past_medical_history: d.past_medical_history || "",
        family_history: d.family_history || "",
        social_history: d.social_history || "",
        allergies: d.allergies || "",
        current_medications: d.current_medications || "",
      }));
      emitMedicalRecordTabSaved("anamnesis", false);
    };
    window.addEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
    return () => window.removeEventListener(COPY_FROM_HISTORY_EVENT, handler as EventListener);
  }, []);

  if (loading) {
    return (
      <div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      <div>
        {/* Edit Mode Banner for discharged patients */}
        <div className="px-4 sm:px-5 pt-3 empty:hidden">
          <EditModeBanner
            isPatientDischarged={isPatientDischarged}
            isEditing={isEditing}
            onRequestEdit={handleRequestEdit}
            recordTypeLabel="Anamnesis"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={isFormDisabled}
            className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none"
          >
            {/* Section 1: Sumber Anamnesis & Status Fungsional */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Sumber dan Status Fungsional
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="anamnesis_source" className="text-xs font-medium">
                    Sumber Anamnesis
                  </Label>
                  <Select
                    value={formData.anamnesis_source}
                    onValueChange={(value) => handleChange("anamnesis_source", value)}
                  >
                    <SelectTrigger id="anamnesis_source" className="h-9 text-xs rounded-none">
                      <SelectValue placeholder="Pilih sumber" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="autoanamnesis" className="text-xs">Autoanamnesis (langsung dari pasien)</SelectItem>
                      <SelectItem value="alloanamnesis" className="text-xs">Alloanamnesis (dari keluarga/pengantar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="functional_status" className="text-xs font-medium">
                    Status Fungsional
                  </Label>
                  <Select
                    value={formData.functional_status}
                    onValueChange={(value) => handleChange("functional_status", value)}
                  >
                    <SelectTrigger id="functional_status" className="h-9 text-xs rounded-none">
                      <SelectValue placeholder="Pilih status fungsional" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNCTIONAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Section 2: Keluhan Utama & Riwayat Penyakit Sekarang */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Keluhan dan Riwayat Penyakit Sekarang
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="chief_complaint" className="text-xs font-medium">
                    Keluhan Utama <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="chief_complaint"
                    placeholder="Masukkan keluhan utama yang mendorong pasien mencari pertolongan medis..."
                    value={formData.chief_complaint}
                    onChange={(e) => handleChange("chief_complaint", e.target.value)}
                    className="min-h-[84px] resize-none text-xs rounded-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="history_of_present_illness" className="text-xs font-medium">
                    Riwayat Penyakit Sekarang <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="history_of_present_illness"
                    placeholder="Jelaskan riwayat penyakit yang sedang dialami (onset, lokasi, durasi, karakteristik, faktor memperberat/meringankan)..."
                    value={formData.history_of_present_illness}
                    onChange={(e) => handleChange("history_of_present_illness", e.target.value)}
                    className="min-h-[84px] resize-none text-xs rounded-none"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Riwayat Medis & Sosial */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Riwayat Medis &amp; Sosial
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="past_medical_history" className="text-xs font-medium">
                    Riwayat Penyakit Dahulu
                  </Label>
                  <Textarea
                    id="past_medical_history"
                    placeholder="Riwayat penyakit yang pernah diderita sebelumnya..."
                    value={formData.past_medical_history}
                    onChange={(e) => handleChange("past_medical_history", e.target.value)}
                    className="min-h-[76px] resize-none text-xs rounded-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="family_history" className="text-xs font-medium">
                    Riwayat Penyakit Keluarga
                  </Label>
                  <Textarea
                    id="family_history"
                    placeholder="Riwayat penyakit dalam keluarga (hipertensi, diabetes, dll)..."
                    value={formData.family_history}
                    onChange={(e) => handleChange("family_history", e.target.value)}
                    className="min-h-[76px] resize-none text-xs rounded-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="social_history" className="text-xs font-medium">
                    Riwayat Sosial
                  </Label>
                  <Textarea
                    id="social_history"
                    placeholder="Kebiasaan merokok, konsumsi alkohol, pekerjaan, aktivitas fisik, dll..."
                    value={formData.social_history}
                    onChange={(e) => handleChange("social_history", e.target.value)}
                    className="min-h-[76px] resize-none text-xs rounded-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Riwayat Alergi Pasien (1 Column Full Width) */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Riwayat Alergi Pasien
                  </div>
                  {formData.allergies !== "Tidak ada alergi" && patientAllergies.length > 0 && (
                    <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px] font-mono">
                      {patientAllergies.length} Tercatat
                    </Badge>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="no_allergies"
                      className="flex items-center gap-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 px-2.5 h-8 cursor-pointer select-none"
                    >
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Konfirmasi Tidak Ada Alergi
                      </span>
                      <Switch
                        id="no_allergies"
                        checked={formData.allergies === "Tidak ada alergi"}
                        onCheckedChange={(checked) => {
                          if (checked) setShowAllergyForm(false);
                          setFormData((prev) => ({
                            ...prev,
                            allergies: checked ? "Tidak ada alergi" : "",
                          }));
                        }}
                      />
                    </label>

                    {formData.allergies !== "Tidak ada alergi" && (
                      <Button
                        type="button"
                        variant={showAllergyForm ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowAllergyForm(!showAllergyForm)}
                        className="h-8 rounded-none px-3 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Tambah Alergi
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {formData.allergies === "Tidak ada alergi" ? (
                <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Pasien dikonfirmasi <strong className="text-foreground">tidak memiliki riwayat alergi</strong> obat, makanan, maupun lingkungan.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Add Allergy Form (Full Width Horizontal Grid) */}
                  {showAllergyForm && !readOnly && (
                    <div className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-900/20 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                          Tambah Alergi Baru (SNOMED CT)
                        </p>
                        <span className="text-[11px] text-muted-foreground">
                          Ketik minimal 3 karakter (Bahasa Inggris / SNOMED Concept ID)
                        </span>
                      </div>

                      {snomedQuery.length >= 3 && snomedResults.length === 0 && !searchingSnomed && (
                        <div className="p-2 bg-muted/50 border border-neutral-200 dark:border-neutral-800 text-xs">
                          <p className="text-muted-foreground">
                            Tidak menemukan? Cari referensi di Google:{" "}
                            <a
                              href={`https://www.google.com/search?q=snomed+ct+allergy+${encodeURIComponent(snomedQuery)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-medium hover:text-foreground"
                            >
                              "snomed ct allergy {snomedQuery}"
                            </a>
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                        <div className="lg:col-span-5 space-y-1.5">
                          <Label className="text-xs font-medium">Cari Alergi (SNOMED CT)</Label>
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Cari: penicillin, aspirin, seafood..."
                                value={snomedQuery}
                                onChange={(e) => setSnomedQuery(e.target.value)}
                                className="pl-8 text-xs"
                              />
                              {searchingSnomed && (
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {snomedResults.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 border border-neutral-200 dark:border-neutral-800 bg-popover shadow-md">
                                <div className="max-h-48 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted sticky top-0">
                                      <tr className="border-b">
                                        <th className="text-left p-2 font-medium w-28">Kode</th>
                                        <th className="text-left p-2 font-medium">Term (English)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {snomedResults.map((snomed) => (
                                        <tr
                                          key={snomed.pk_id}
                                          onClick={() => handleSelectSnomed(snomed)}
                                          className="border-b hover:bg-accent cursor-pointer"
                                        >
                                          <td className="p-2 font-mono text-[11px] text-muted-foreground">
                                            {snomed.conceptId}
                                          </td>
                                          <td className="p-2">{snomed.term}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-1.5">
                          <Label className="text-xs font-medium">Kategori</Label>
                          <Select
                            value={newAllergy.category}
                            onValueChange={(value) => setNewAllergy({ ...newAllergy, category: value as AllergyCategory })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="medication" className="text-xs">Obat</SelectItem>
                              <SelectItem value="food" className="text-xs">Makanan</SelectItem>
                              <SelectItem value="environment" className="text-xs">Lingkungan</SelectItem>
                              <SelectItem value="biologic" className="text-xs">Biologis</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="lg:col-span-2 space-y-1.5">
                          <Label className="text-xs font-medium">Keparahan</Label>
                          <Select
                            value={newAllergy.criticality}
                            onValueChange={(value) => setNewAllergy({ ...newAllergy, criticality: value as AllergyCriticality })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low" className="text-xs">Rendah</SelectItem>
                              <SelectItem value="high" className="text-xs">Tinggi</SelectItem>
                              <SelectItem value="unable-to-assess" className="text-xs">Tidak Dapat Dinilai</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="lg:col-span-3 space-y-1.5">
                          <Label className="text-xs font-medium">Catatan Reaksi (Opsional)</Label>
                          <Input
                            placeholder="Misal: gatal, sesak, ruam..."
                            value={newAllergy.notes}
                            onChange={(e) => setNewAllergy({ ...newAllergy, notes: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          {newAllergy.snomed_code ? (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-muted/70 border border-neutral-200 dark:border-neutral-800 text-xs">
                              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-mono text-[11px]">{newAllergy.snomed_code}</span>
                              <span>-</span>
                              <span className="font-medium truncate">{newAllergy.snomed_display}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Pilih salah satu item alergi dari hasil pencarian SNOMED CT di atas.
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-none text-xs"
                            onClick={() => {
                              setShowAllergyForm(false);
                              setNewAllergy(defaultNewAllergy);
                              setSnomedQuery("");
                            }}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-none text-xs"
                            onClick={handleAddAllergy}
                            disabled={!newAllergy.snomed_code || savingAllergy}
                          >
                            {savingAllergy ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Menyimpan...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Simpan Alergi
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Allergy List */}
                  {loadingAllergies ? (
                    <div className="flex items-center gap-2 py-3 px-3.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">Memuat data alergi pasien...</span>
                    </div>
                  ) : patientAllergies.length === 0 ? (
                    <div className="flex items-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      <span>Belum ada data alergi pasien yang tercatat.</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                      {patientAllergies.map((allergy) => (
                        <div
                          key={allergy.id}
                          className={`px-3.5 py-2.5 border-l-4 ${ALLERGY_CRITICALITY_COLORS[allergy.criticality]}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span className="font-semibold text-xs text-foreground">
                                {allergy.snomed_display}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                ({allergy.snomed_code})
                              </span>
                              <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5">
                                {ALLERGY_CATEGORY_LABELS[allergy.category]}
                              </Badge>
                              <Badge
                                variant={allergy.criticality === "high" ? "destructive" : "secondary"}
                                className="rounded-none text-[10px] h-5 px-1.5"
                              >
                                {ALLERGY_CRITICALITY_LABELS[allergy.criticality]}
                              </Badge>
                              {allergy.notes && (
                                <span className="text-xs text-muted-foreground">
                                  • Reaksi: {allergy.notes}
                                </span>
                              )}
                            </div>
                            {!readOnly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 rounded-none text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => handleDeleteAllergy(allergy.id)}
                                disabled={deletingAllergyId === allergy.id}
                              >
                                {deletingAllergyId === allergy.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 5: Obat yang Sedang Dikonsumsi (1 Column Full Width) */}
            <section className="px-4 sm:px-5 py-4 space-y-3">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Obat yang Sedang Dikonsumsi
              </div>
              <div className="space-y-1.5">
                <Textarea
                  id="current_medications"
                  placeholder="Daftar obat yang sedang dikonsumsi pasien saat ini beserta dosis dan frekuensi untuk menghindari interaksi obat..."
                  value={formData.current_medications}
                  onChange={(e) => handleChange("current_medications", e.target.value)}
                  className="min-h-[76px] resize-none text-xs rounded-none"
                />
              </div>
            </section>
          </fieldset>
        </form>
      </div>

      {/* Edit Confirmation Dialog */}
      <EditConfirmDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editReason={editReason}
        onEditReasonChange={setEditReason}
        onConfirm={handleConfirmEdit}
      />

      {/* PIN Verification Dialog */}
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

      {/* Duplicate Allergy Alert Dialog */}
      <AlertDialog open={duplicateAllergyAlert} onOpenChange={setDuplicateAllergyAlert}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Alergi Duplikat</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Alergi ini sudah tercatat untuk pasien.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-8 text-xs">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Allergy Confirmation Dialog */}
      <AlertDialog open={!!deleteAllergyConfirm} onOpenChange={(open) => !open && setDeleteAllergyConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Hapus Alergi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin menghapus data alergi ini dari pasien?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteAllergy}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
