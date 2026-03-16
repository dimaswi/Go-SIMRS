import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Save, Loader2, Pill, AlertCircle, Search, X, Plus, AlertTriangle } from "lucide-react";
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
  allergies: "", // Legacy field - will still save as summary
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

const isMeaningfulAllergySummary = (value?: string) => {
  const normalized = (value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  return !/^(none|no known allergies|nkda|nka|nihil|\-|tidak ada|tidak ada alergi)$/.test(normalized);
};

export function AnamnesisForm({ visitId, patientId, onSave, readOnly = false, isPatientDischarged = false }: AnamnesisFormProps) {
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
            allergies: data.allergies || "",
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
  }, [visitId]);

  // Load patient allergies
  const loadAllergies = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoadingAllergies(true);
      const response = await patientAllergyApi.getByPatient(patientId);
      setPatientAllergies(response.data.data || []);
    } catch (error) {
      console.error("Failed to load allergies:", error);
    } finally {
      setLoadingAllergies(false);
    }
  }, [patientId]);

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
  const hasAllergies = patientAllergies.length > 0 || isMeaningfulAllergySummary(formData.allergies);
  const filledFields = filledTextFields + (hasAllergies ? 1 : 0);
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
    <div>
      <div>
          {/* Edit Mode Banner for discharged patients */}
          <EditModeBanner
            isPatientDischarged={isPatientDischarged}
            isEditing={isEditing}
            onRequestEdit={handleRequestEdit}
            recordTypeLabel="Anamnesis"
          />
          
        <form onSubmit={handleSubmit}>
          <fieldset disabled={isFormDisabled} className="space-y-6">
          
          {/* Section 0: Sumber Anamnesis & Status Fungsional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anamnesis_source" className="text-sm font-semibold">
                Sumber Anamnesis
              </Label>
              <p className="text-xs text-muted-foreground">
                Dari siapa informasi riwayat penyakit ini diperoleh?
              </p>
              <Select
                value={formData.anamnesis_source}
                onValueChange={(value) => handleChange("anamnesis_source", value)}
              >
                <SelectTrigger id="anamnesis_source">
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="autoanamnesis">Autoanamnesis (langsung dari pasien)</SelectItem>
                  <SelectItem value="alloanamnesis">Alloanamnesis (dari keluarga/pengantar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="functional_status" className="text-sm font-semibold">
                Status Fungsional
              </Label>
              <p className="text-xs text-muted-foreground">
                Kemampuan pasien dalam melakukan aktivitas sehari-hari (makan, mandi, berpakaian, dll)
              </p>
              <Select
                value={formData.functional_status}
                onValueChange={(value) => handleChange("functional_status", value)}
              >
                <SelectTrigger id="functional_status">
                  <SelectValue placeholder="Pilih status fungsional" />
                </SelectTrigger>
                <SelectContent>
                  {FUNCTIONAL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 1: Keluhan Utama & Riwayat Penyakit Sekarang */}
          <div className="space-y-4"><div className="space-y-2">
                <Label htmlFor="chief_complaint" className="text-sm font-semibold">
                  Keluhan Utama <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="chief_complaint"
                  placeholder="Masukkan keluhan utama pasien..."
                  value={formData.chief_complaint}
                  onChange={(e) => handleChange("chief_complaint", e.target.value)}
                  className="min-h-[80px] resize-none"
                  required
                />
              </div>

              {/* Riwayat Penyakit Sekarang */}
              <div className="space-y-2">
                <Label htmlFor="history_of_present_illness" className="text-sm font-semibold">
                  Riwayat Penyakit Sekarang <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="history_of_present_illness"
                  placeholder="Jelaskan riwayat penyakit yang sedang dialami (onset, durasi, karakteristik, dll)..."
                  value={formData.history_of_present_illness}
                  onChange={(e) => handleChange("history_of_present_illness", e.target.value)}
                  className="min-h-[120px] resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Detail onset, lokasi, durasi, karakteristik, faktor yang memperberat/meringankan
                </p>
              </div>
          </div>

          {/* Section 2: Riwayat Medis */}
          <div className="space-y-4">{/* Riwayat Penyakit Dahulu */}
              <div className="space-y-2">
                <Label htmlFor="past_medical_history" className="text-sm font-semibold">
                  Riwayat Penyakit Dahulu
                </Label>
                <Textarea
                  id="past_medical_history"
                  placeholder="Riwayat penyakit yang pernah diderita sebelumnya..."
                  value={formData.past_medical_history}
                  onChange={(e) => handleChange("past_medical_history", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Riwayat Penyakit Keluarga */}
              <div className="space-y-2">
                <Label htmlFor="family_history" className="text-sm font-semibold">
                  Riwayat Penyakit Keluarga
                </Label>
                <Textarea
                  id="family_history"
                  placeholder="Riwayat penyakit dalam keluarga (hipertensi, diabetes, dll)..."
                  value={formData.family_history}
                  onChange={(e) => handleChange("family_history", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Riwayat Sosial */}
              <div className="space-y-2">
                <Label htmlFor="social_history" className="text-sm font-semibold">
                  Riwayat Sosial
                </Label>
                <Textarea
                  id="social_history"
                  placeholder="Kebiasaan merokok, konsumsi alkohol, pekerjaan, dll..."
                  value={formData.social_history}
                  onChange={(e) => handleChange("social_history", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
          </div>

          {/* Section 3: Alergi & Obat */}
          <div className="space-y-4">{/* Existing Allergies List */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Daftar Alergi Pasien
                  </Label>
                  {!readOnly && (
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAllergyForm(!showAllergyForm)}
                      className="h-8"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Tambah Alergi
                    </Button>
                  )}
                </div>

                {/* Loading allergies */}
                {loadingAllergies ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Memuat data alergi...</span>
                  </div>
                ) : patientAllergies.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground bg-muted/30 rounded-lg">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Tidak ada alergi tercatat</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patientAllergies.map((allergy) => (
                      <div 
                        key={allergy.id}
                        className={`p-3 rounded-lg border ${ALLERGY_CRITICALITY_COLORS[allergy.criticality]}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{allergy.snomed_display}</span>
                              <Badge variant="outline" className="text-xs">
                                {ALLERGY_CATEGORY_LABELS[allergy.category]}
                              </Badge>
                              <Badge 
                                variant={allergy.criticality === 'high' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {ALLERGY_CRITICALITY_LABELS[allergy.criticality]}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <span className="font-mono">{allergy.snomed_code}</span>
                              {allergy.notes && <span className="ml-2">• {allergy.notes}</span>}
                            </div>
                          </div>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

              {/* Add Allergy Form */}
              {showAllergyForm && !readOnly && (
                <div className="border-dashed">
                  <div className="p-4 space-y-4">
                    <p className="text-sm font-medium">Tambah Alergi Baru</p>
                    
                    {/* SNOMED Search */}
                    <div className="space-y-2">
                      <Label className="text-sm">Cari Alergi (SNOMED CT)</Label>
                      <p className="text-xs text-muted-foreground">
                        Ketik minimal 3 karakter: nama alergi dalam Bahasa Inggris atau SNOMED Concept ID
                      </p>
                      
                      {/* Google Search Tip */}
                      {snomedQuery.length >= 3 && snomedResults.length === 0 && !searchingSnomed && (
                        <div className="p-2 bg-muted/50 border rounded text-xs">
                          <p className="text-muted-foreground">
                            💡 <strong>Tip:</strong> Tidak menemukan? Cari di Google dengan kata kunci:{" "}
                            <a 
                              href={`https://www.google.com/search?q=snomed+ct+allergy+${encodeURIComponent(snomedQuery)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-medium hover:text-foreground"
                            >
                              "snomed ct allergy {snomedQuery}"
                            </a>
                            , lalu masukkan Concept ID yang ditemukan.
                          </p>
                        </div>
                      )}
                      
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Cari: penicillin, aspirin, seafood..."
                            value={snomedQuery}
                            onChange={(e) => setSnomedQuery(e.target.value)}
                            className="pl-9"
                          />
                          {searchingSnomed && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                        
                        {/* Search Results */}
                        {snomedResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg">
                            <div className="max-h-48 overflow-y-auto">
                              <table className="w-full min-w-[640px] text-sm">
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
                                      <td className="p-2 font-mono text-xs text-muted-foreground">
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
                      
                      {/* Selected SNOMED */}
                      {newAllergy.snomed_code && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 border rounded text-sm">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">{newAllergy.snomed_code}</span>
                          <span>-</span>
                          <span className="font-medium">{newAllergy.snomed_display}</span>
                        </div>
                      )}
                    </div>

                    {/* Category & Criticality */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Kategori</Label>
                        <Select
                          value={newAllergy.category}
                          onValueChange={(value) => setNewAllergy({ ...newAllergy, category: value as AllergyCategory })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="medication">Obat</SelectItem>
                            <SelectItem value="food">Makanan</SelectItem>
                            <SelectItem value="environment">Lingkungan</SelectItem>
                            <SelectItem value="biologic">Biologis</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Tingkat Keparahan</Label>
                        <Select
                          value={newAllergy.criticality}
                          onValueChange={(value) => setNewAllergy({ ...newAllergy, criticality: value as AllergyCriticality })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Rendah</SelectItem>
                            <SelectItem value="high">Tinggi</SelectItem>
                            <SelectItem value="unable-to-assess">Tidak Dapat Dinilai</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-sm">Catatan (Opsional)</Label>
                      <Input
                        placeholder="Reaksi yang muncul, dll..."
                        value={newAllergy.notes}
                        onChange={(e) => setNewAllergy({ ...newAllergy, notes: e.target.value })}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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
                            Tambah
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Obat yang Sedang Dikonsumsi */}
              <div className="space-y-2">
                <Label htmlFor="current_medications" className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  Obat yang Sedang Dikonsumsi
                </Label>
                <Textarea
                  id="current_medications"
                  placeholder="Daftar obat yang sedang dikonsumsi pasien saat ini..."
                  value={formData.current_medications}
                  onChange={(e) => handleChange("current_medications", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Termasuk dosis dan frekuensi untuk menghindari interaksi obat
                </p>
              </div>
          </div>

          {/* Submit Button */}
          {!isFormDisabled && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Simpan Anamnesis
              </Button>
            </div>
          )}
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
