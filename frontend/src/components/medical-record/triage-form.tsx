import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Save, Loader2, ShieldCheck } from "lucide-react";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import { medicalRecordEditLogApi } from "@/lib/api/visits";
import { useEditMode, EditModeBanner, EditConfirmDialog, PINVerificationDialog } from "./edit-mode-controller";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved, MEDICAL_RECORD_TAB_SAVED_EVENT } from "./tab-indicator";
import { saveFormDraft, loadFormDraft, clearFormDraft } from "@/lib/form-persistence";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import { cn } from "@/lib/utils";
import type { Triage } from "@/lib/api";

interface TriageFormProps {
  visitId: number;
  onSave?: (data: any) => void;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
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

const triageLevelMeta: Record<string, { title: string; description: string; response: string }> = {
  "0": {
    title: "DOA",
    description: "Datang dalam kondisi meninggal",
    response: "Penanganan sesuai protokol verifikasi DOA",
  },
  "1": {
    title: "Resusitasi",
    description: "Ancaman nyawa, butuh tindakan segera",
    response: "Respon: segera (0 menit)",
  },
  "2": {
    title: "Emergent",
    description: "Gawat darurat, tidak stabil",
    response: "Respon: sangat cepat",
  },
  "3": {
    title: "Urgent",
    description: "Mendesak namun relatif stabil",
    response: "Respon: cepat",
  },
  "4": {
    title: "Less Urgent",
    description: "Keluhan ringan-menengah",
    response: "Respon: dapat menunggu",
  },
  "5": {
    title: "Non-Urgent",
    description: "Tidak gawat darurat",
    response: "Respon: menunggu sesuai antrean",
  },
};

const triageLevelSummaryPalette: Record<string, { container: string; title: string; subtitle: string }> = {
  "0": {
    container: "border-zinc-700 bg-zinc-100",
    title: "text-zinc-900",
    subtitle: "text-zinc-700",
  },
  "1": {
    container: "border-red-300 bg-red-50",
    title: "text-red-800",
    subtitle: "text-red-700",
  },
  "2": {
    container: "border-orange-300 bg-orange-50",
    title: "text-orange-800",
    subtitle: "text-orange-700",
  },
  "3": {
    container: "border-yellow-300 bg-yellow-50",
    title: "text-yellow-800",
    subtitle: "text-yellow-700",
  },
  "4": {
    container: "border-green-300 bg-green-50",
    title: "text-green-800",
    subtitle: "text-green-700",
  },
  "5": {
    container: "border-blue-300 bg-blue-50",
    title: "text-blue-800",
    subtitle: "text-blue-700",
  },
};

// Vital sign status helpers (same as physical-exam)
type VitalStatus = "none" | "low" | "high" | "borderline" | "normal";

const getVitalStatus = (
  value: number,
  normalMin: number,
  normalMax: number,
  warningMin?: number,
  warningMax?: number
): VitalStatus => {
  if (!value || value <= 0) return "none";
  if (value < normalMin) {
    if (warningMin !== undefined && value >= warningMin) return "borderline";
    return "low";
  }
  if (value > normalMax) {
    if (warningMax !== undefined && value <= warningMax) return "borderline";
    return "high";
  }
  return "normal";
};

const getVitalStatusLabel = (status: VitalStatus) => {
  switch (status) {
    case "low": return "Di bawah";
    case "high": return "Di atas";
    case "borderline": return "Batas";
    case "normal": return "Normal";
    default: return null;
  }
};

const getVitalStatusBadgeClass = (status: VitalStatus) => {
  switch (status) {
    case "normal": return "bg-green-50 text-green-700 border-green-200";
    case "borderline": return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "low":
    case "high": return "bg-red-50 text-red-700 border-red-200";
    default: return "";
  }
};

const getVitalStatusInputClass = (status: VitalStatus) => {
  switch (status) {
    case "normal": return "border-green-300 focus-visible:ring-green-500";
    case "borderline": return "border-yellow-300 focus-visible:ring-yellow-500";
    case "low":
    case "high": return "border-red-300 focus-visible:ring-red-500";
    default: return "";
  }
};

const parseBP = (bp: string): { systolic: number; diastolic: number } => {
  const parts = bp.split("/").map(s => parseInt(s.trim()));
  return { systolic: parts[0] || 0, diastolic: parts[1] || 0 };
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
  pain_method: "nrs",
  pain_location: "",
  gcs_e: 4,
  gcs_v: 5,
  gcs_m: 6,
  triage_assessment: "",
  immediate_actions: "",
};

const painLocationOptionsBase = [
  { value: "kepala", label: "Kepala" },
  { value: "wajah", label: "Wajah" },
  { value: "mata", label: "Mata" },
  { value: "telinga", label: "Telinga" },
  { value: "hidung", label: "Hidung" },
  { value: "mulut", label: "Mulut" },
  { value: "gigi", label: "Gigi" },
  { value: "rahang", label: "Rahang" },
  { value: "leher", label: "Leher" },
  { value: "bahu_kanan", label: "Bahu Kanan" },
  { value: "bahu_kiri", label: "Bahu Kiri" },
  { value: "lengan_atas_kanan", label: "Lengan Atas Kanan" },
  { value: "lengan_atas_kiri", label: "Lengan Atas Kiri" },
  { value: "siku_kanan", label: "Siku Kanan" },
  { value: "siku_kiri", label: "Siku Kiri" },
  { value: "lengan_bawah_kanan", label: "Lengan Bawah Kanan" },
  { value: "lengan_bawah_kiri", label: "Lengan Bawah Kiri" },
  { value: "pergelangan_tangan_kanan", label: "Pergelangan Tangan Kanan" },
  { value: "pergelangan_tangan_kiri", label: "Pergelangan Tangan Kiri" },
  { value: "tangan_kanan", label: "Tangan Kanan" },
  { value: "tangan_kiri", label: "Tangan Kiri" },
  { value: "jari_tangan", label: "Jari Tangan" },
  { value: "dada", label: "Dada" },
  { value: "payudara", label: "Payudara" },
  { value: "ulu_hati", label: "Ulu Hati / Epigastrium" },
  { value: "perut_atas", label: "Perut Atas" },
  { value: "perut_bawah", label: "Perut Bawah" },
  { value: "perut_kanan_atas", label: "Perut Kanan Atas" },
  { value: "perut_kiri_atas", label: "Perut Kiri Atas" },
  { value: "perut_kanan_bawah", label: "Perut Kanan Bawah" },
  { value: "perut_kiri_bawah", label: "Perut Kiri Bawah" },
  { value: "pinggang_kanan", label: "Pinggang Kanan" },
  { value: "pinggang_kiri", label: "Pinggang Kiri" },
  { value: "punggung_atas", label: "Punggung Atas" },
  { value: "punggung_tengah", label: "Punggung Tengah" },
  { value: "punggung_bawah", label: "Punggung Bawah" },
  { value: "bokong", label: "Bokong" },
  { value: "selangkangan", label: "Selangkangan" },
  { value: "genital", label: "Area Genital" },
  { value: "panggul", label: "Panggul" },
  { value: "paha_kanan", label: "Paha Kanan" },
  { value: "paha_kiri", label: "Paha Kiri" },
  { value: "lutut_kanan", label: "Lutut Kanan" },
  { value: "lutut_kiri", label: "Lutut Kiri" },
  { value: "betis_kanan", label: "Betis Kanan" },
  { value: "betis_kiri", label: "Betis Kiri" },
  { value: "tulang_kering", label: "Tulang Kering" },
  { value: "pergelangan_kaki_kanan", label: "Pergelangan Kaki Kanan" },
  { value: "pergelangan_kaki_kiri", label: "Pergelangan Kaki Kiri" },
  { value: "kaki_kanan", label: "Kaki Kanan" },
  { value: "kaki_kiri", label: "Kaki Kiri" },
  { value: "jari_kaki", label: "Jari Kaki" },
  { value: "seluruh_tubuh", label: "Seluruh Tubuh" },
  { value: "multi_lokasi", label: "Multi Lokasi" },
];

export function TriageForm({ visitId, onSave, readOnly = false, isPatientDischarged = false }: TriageFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [triageId, setTriageId] = useState<number | undefined>();

  // Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{ is_signed: boolean; signer_name?: string } | null>(null);

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
    recordType: "triage",
  });

  // Determine if form should be disabled
  const isFormDisabled = readOnly || (isPatientDischarged && !isEditing);

  // Fetch master data untuk semua kategori yang dibutuhkan
  const { getOptions, loading: masterDataLoading } = useMultipleMasterData([
    'arrival_mode',
    'triage_level',
    'airway_status',
    'breathing_status',
    'circulation_status',
  ]);

  // Check signature status when triageId changes
  useEffect(() => {
    if (triageId) {
      checkSignatureStatus(triageId);
    }
  }, [triageId]);

  const checkSignatureStatus = async (id: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.TRIAGE, id);
      setSignatureStatus(res.data);
    } catch {
      setSignatureStatus({ is_signed: false });
    }
  };

  const handleSignatureSuccess = () => {
    if (triageId) {
      checkSignatureStatus(triageId);
    }
  };

  // Load existing data on mount
  useEffect(() => {
    const loadTriage = async () => {
      try {
        setLoading(true);
        const response = await medicalRecordsApi.getTriage(visitId);
        const data = response.data as Triage;
        if (data && data.id) {
          // Parse breathing_rate from backend (string) to number for respiratory_rate
          const respRate = data.breathing_rate ? parseInt(String(data.breathing_rate)) : (data.respiratory_rate || 0);
          const heartRate = typeof data.heart_rate === 'string' ? parseInt(data.heart_rate) : (data.heart_rate || 0);
          const temp = typeof data.temperature === 'string' ? parseFloat(data.temperature) : (data.temperature || 0);
          const spo2 = typeof data.oxygen_saturation === 'string' ? parseInt(data.oxygen_saturation) : (data.oxygen_saturation || 0);
          
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
            heart_rate: heartRate,
            respiratory_rate: respRate,
            temperature: temp,
            oxygen_saturation: spo2,
            pain_scale: data.pain_scale || 0,
            pain_method: data.pain_method || "nrs",
            pain_location: data.pain_location || "",
            gcs_e: data.gcs_e || 4,
            gcs_v: data.gcs_v || 5,
            gcs_m: data.gcs_m || 6,
            triage_assessment: data.triage_assessment || "",
            immediate_actions: data.immediate_actions || "",
          });
          setTriageId(data.id);
          emitMedicalRecordTabSaved("triage", true);
        }
      } catch {
        // No existing data, use defaults
      } finally {
        setLoading(false);
        // Apply local draft if exists — overrides server data if user had unsaved changes
        const draft = loadFormDraft<typeof defaultFormData>(`mr-draft-triage-${visitId}`);
        if (draft) {
          setFormData(draft);
          emitMedicalRecordTabSaved("triage", false);
        }
      }
    };

    loadTriage();
  }, [visitId]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    emitMedicalRecordTabSaved("triage", false);
  };

  // Count filled fields for tab indicator
  const triageTextFilled = [formData.arrival_mode, formData.triage_complaint, formData.triage_level, formData.airway, formData.airway_note, formData.breathing, formData.breathing_note, formData.circulation, formData.circulation_note, formData.blood_pressure, formData.triage_assessment, formData.immediate_actions, formData.pain_method, formData.pain_location].filter(v => v && v.trim() !== "").length;
  const triageNumericFilled = [formData.heart_rate, formData.respiratory_rate, formData.temperature, formData.oxygen_saturation, formData.pain_scale].filter(v => v > 0).length;
  const triageGCSFilled = (formData.gcs_e ? 1 : 0) + (formData.gcs_v ? 1 : 0) + (formData.gcs_m ? 1 : 0);
  const filledTriage = triageTextFilled + triageNumericFilled + triageGCSFilled;
  const totalTriage = 22;

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator("triage", `${filledTriage}/${totalTriage}`);
  }, [filledTriage, loading]);

  // Auto-save draft to localStorage on state change
  useEffect(() => {
    if (loading) return;
    saveFormDraft(`mr-draft-triage-${visitId}`, formData);
  }, [formData, loading, visitId]);

  // Clear draft when save is confirmed by show.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "triage" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-triage-${visitId}`);
      }
    };
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
    return () => window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
  }, [visitId]);

  const doSave = async () => {
    // Log edit if patient is discharged
    if (isPatientDischarged && triageId) {
      try {
        await medicalRecordEditLogApi.create(visitId, {
          record_type: "triage",
          record_id: triageId,
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

  const gcsTotal = formData.gcs_e + formData.gcs_v + formData.gcs_m;

  // Vital sign status indicators
  const bp = parseBP(formData.blood_pressure);
  const systolicStatus = getVitalStatus(bp.systolic, 90, 120, 80, 129);
  const diastolicStatus = getVitalStatus(bp.diastolic, 60, 80, 50, 89);
  const bpStatus: VitalStatus = bp.systolic > 0 || bp.diastolic > 0
    ? ([systolicStatus, diastolicStatus].includes("high") || [systolicStatus, diastolicStatus].includes("low")
      ? ([systolicStatus, diastolicStatus].includes("high") ? "high" : "low")
      : [systolicStatus, diastolicStatus].includes("borderline") ? "borderline" : "normal")
    : "none";
  const heartRateStatus = getVitalStatus(formData.heart_rate, 60, 100, 50, 110);
  const respiratoryStatus = getVitalStatus(formData.respiratory_rate, 12, 20, 10, 24);
  const temperatureStatus = getVitalStatus(formData.temperature, 36.1, 37.2, 35.5, 37.9);
  const spo2Status = getVitalStatus(formData.oxygen_saturation, 95, 100, 90, 100);

  // Get options from master data
  const arrivalModeOptions = getOptions('arrival_mode');
  const triageLevelOptions = getOptions('triage_level');
  const airwayOptions = getOptions('airway_status');
  const breathingOptions = getOptions('breathing_status');
  const circulationOptions = getOptions('circulation_status');
  const selectedTriageMeta = triageLevelMeta[formData.triage_level];
  const selectedTriagePalette = triageLevelSummaryPalette[formData.triage_level];
  const painLocationOptions = useMemo(() => {
    const selected = (formData.pain_location || "").trim();
    if (!selected) return painLocationOptionsBase;
    if (painLocationOptionsBase.some((option) => option.value === selected)) return painLocationOptionsBase;
    return [{ value: selected, label: `${selected} (custom)` }, ...painLocationOptionsBase];
  }, [formData.pain_location]);

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

  return (
    <div>
      <div>
          {/* Edit Mode Banner for discharged patients */}
          <EditModeBanner
            isPatientDischarged={isPatientDischarged}
            isEditing={isEditing}
            onRequestEdit={handleRequestEdit}
            recordTypeLabel="Triase"
          />
          
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <fieldset disabled={isFormDisabled} className="space-y-4 sm:space-y-6">
          
          {/* Section 1: Informasi Kedatangan */}
          <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="arrival_mode" className="text-sm font-semibold">
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
                  <Label htmlFor="triage_complaint" className="text-sm font-semibold">
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

              {/* Triage Level */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Level Triase <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Level Triase">
                  {triageLevelOptions.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => handleChange("triage_level", level.value)}
                      role="radio"
                      aria-checked={formData.triage_level === level.value}
                      className={cn(
                        "rounded-lg border-2 p-3 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        formData.triage_level === level.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={cn(
                            "h-3 w-3 rounded-full border border-white/20",
                            triageLevelColors[level.value] || "bg-gray-500"
                          )}
                        />
                        <span className="text-xs font-semibold text-muted-foreground">Level {level.value}</span>
                      </div>
                      <p className="text-sm font-semibold leading-tight">{triageLevelMeta[level.value]?.title || level.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {triageLevelMeta[level.value]?.description || "Pilih sesuai kondisi klinis pasien"}
                      </p>
                    </button>
                  ))}
                </div>
                {selectedTriageMeta && (
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      selectedTriagePalette?.container || "border-border bg-muted/30"
                    )}
                  >
                    <p className={cn("text-sm font-semibold", selectedTriagePalette?.title || "") }>
                      Level dipilih: {selectedTriageMeta.title}
                    </p>
                    <p className={cn("text-xs mt-1", selectedTriagePalette?.subtitle || "text-muted-foreground") }>
                      {selectedTriageMeta.response}
                    </p>
                  </div>
                )}
              </div>
          </div>

          {/* Section 2: Primary Survey (ABC) */}
          <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="airway" className="text-sm font-semibold">Airway (Jalan Napas)</Label>
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
                  <Label htmlFor="airway_note" className="text-sm font-semibold">Catatan Airway</Label>
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
                  <Label htmlFor="breathing" className="text-sm font-semibold">Breathing (Pernapasan)</Label>
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
                  <Label htmlFor="breathing_note" className="text-sm font-semibold">Catatan Breathing</Label>
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
                  <Label htmlFor="circulation" className="text-sm font-semibold">Circulation (Sirkulasi)</Label>
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
                  <Label htmlFor="circulation_note" className="text-sm font-semibold">Catatan Circulation</Label>
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

          {/* Section 3: Tanda Vital */}
          <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="blood_pressure" className="text-sm font-semibold flex items-center gap-1.5">
                    Tekanan Darah
                    {getVitalStatusLabel(bpStatus) && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", getVitalStatusBadgeClass(bpStatus))}>
                        {getVitalStatusLabel(bpStatus)}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="blood_pressure"
                    placeholder="120/80 mmHg"
                    value={formData.blood_pressure}
                    onChange={(e) => handleChange("blood_pressure", e.target.value)}
                    className={cn("h-11", getVitalStatusInputClass(bpStatus))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heart_rate" className="text-sm font-semibold flex items-center gap-1.5">
                    Nadi (x/menit)
                    {getVitalStatusLabel(heartRateStatus) && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", getVitalStatusBadgeClass(heartRateStatus))}>
                        {getVitalStatusLabel(heartRateStatus)}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="heart_rate"
                    type="number"
                    placeholder="80"
                    value={formData.heart_rate || ""}
                    onChange={(e) => handleChange("heart_rate", parseInt(e.target.value) || 0)}
                    className={cn("h-11", getVitalStatusInputClass(heartRateStatus))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="respiratory_rate" className="text-sm font-semibold flex items-center gap-1.5">
                    Frekuensi Napas (x/menit)
                    {getVitalStatusLabel(respiratoryStatus) && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", getVitalStatusBadgeClass(respiratoryStatus))}>
                        {getVitalStatusLabel(respiratoryStatus)}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="respiratory_rate"
                    type="number"
                    placeholder="20"
                    value={formData.respiratory_rate || ""}
                    onChange={(e) => handleChange("respiratory_rate", parseInt(e.target.value) || 0)}
                    className={cn("h-11", getVitalStatusInputClass(respiratoryStatus))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature" className="text-sm font-semibold flex items-center gap-1.5">
                    Suhu (°C)
                    {getVitalStatusLabel(temperatureStatus) && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", getVitalStatusBadgeClass(temperatureStatus))}>
                        {getVitalStatusLabel(temperatureStatus)}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={formData.temperature || ""}
                    onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                    className={cn("h-11", getVitalStatusInputClass(temperatureStatus))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oxygen_saturation" className="text-sm font-semibold flex items-center gap-1.5">
                    SpO2 (%)
                    {getVitalStatusLabel(spo2Status) && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", getVitalStatusBadgeClass(spo2Status))}>
                        {getVitalStatusLabel(spo2Status)}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="oxygen_saturation"
                    type="number"
                    placeholder="98"
                    value={formData.oxygen_saturation || ""}
                    onChange={(e) => handleChange("oxygen_saturation", parseInt(e.target.value) || 0)}
                    className={cn("h-11", getVitalStatusInputClass(spo2Status))}
                    required
                  />
                </div>
                <div className="space-y-4 md:col-span-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Skala Nyeri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pain_method" className="text-xs">Metode Penilaian Nyeri</Label>
                      <Select
                        value={formData.pain_method}
                        onValueChange={(value) => handleChange("pain_method", value)}
                        disabled={isFormDisabled}
                      >
                        <SelectTrigger id="pain_method">
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nrs">NRS (Numeric Rating Scale)</SelectItem>
                          <SelectItem value="wong_baker">Wong-Baker FACES</SelectItem>
                          <SelectItem value="vas">VAS (Visual Analog Scale)</SelectItem>
                          <SelectItem value="flacc">FLACC (bayi/anak non-verbal)</SelectItem>
                          <SelectItem value="bps">BPS (pasien ICU/ventilator)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pain_location" className="text-xs">Lokasi Nyeri</Label>
                      <Combobox
                        options={painLocationOptions}
                        value={formData.pain_location || ""}
                        onValueChange={(value) => handleChange("pain_location", value)}
                        placeholder="Pilih lokasi nyeri"
                        searchPlaceholder="Cari lokasi nyeri..."
                        emptyText="Lokasi tidak ditemukan"
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pain_scale" className="text-xs">Skala Nyeri (0-10)</Label>
                      {/* Wong-Baker FACES visual */}
                      {formData.pain_method === "wong_baker" && (
                        <div className="flex items-center justify-between gap-1 pb-1">
                          {[0, 2, 4, 6, 8, 10].map((v) => (
                            <TooltipProvider key={v}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isFormDisabled}
                                    onClick={() => handleChange("pain_scale", v)}
                                    className={cn("text-2xl cursor-pointer rounded-lg p-1 transition-all", formData.pain_scale === v ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted")}
                                  >
                                    {v === 0 ? "😊" : v === 2 ? "🙂" : v === 4 ? "😐" : v === 6 ? "🙁" : v === 8 ? "😢" : "😭"}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{v === 0 ? "Tidak nyeri" : v === 2 ? "Nyeri ringan" : v === 4 ? "Nyeri sedang" : v === 6 ? "Nyeri cukup berat" : v === 8 ? "Nyeri berat" : "Nyeri sangat berat"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      )}
                      {/* NRS / VAS numeric bar */}
                      {(formData.pain_method === "nrs" || formData.pain_method === "vas") && (
                        <div className="flex items-center gap-1 pb-1">
                          {[0,1,2,3,4,5,6,7,8,9,10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={isFormDisabled}
                              onClick={() => handleChange("pain_scale", v)}
                              className={cn("flex-1 h-8 text-xs font-medium rounded transition-all",
                                formData.pain_scale === v
                                  ? "ring-2 ring-primary text-primary-foreground " + (v <= 3 ? "bg-green-500" : v <= 6 ? "bg-yellow-500" : "bg-red-500")
                                  : v <= 3 ? "bg-green-100 hover:bg-green-200 text-green-800"
                                  : v <= 6 ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                                  : "bg-red-100 hover:bg-red-200 text-red-800"
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* FLACC / BPS numeric bar */}
                      {(formData.pain_method === "flacc" || formData.pain_method === "bps") && (
                        <div className="flex items-center gap-1 pb-1">
                          {[0,1,2,3,4,5,6,7,8,9,10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={isFormDisabled}
                              onClick={() => handleChange("pain_scale", v)}
                              className={cn("flex-1 h-8 text-xs font-medium rounded transition-all",
                                formData.pain_scale === v
                                  ? "ring-2 ring-primary text-primary-foreground " + (v <= 3 ? "bg-green-500" : v <= 6 ? "bg-yellow-500" : "bg-red-500")
                                  : v <= 3 ? "bg-green-100 hover:bg-green-200 text-green-800"
                                  : v <= 6 ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                                  : "bg-red-100 hover:bg-red-200 text-red-800"
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formData.pain_method === "flacc" ? "FLACC: Face, Legs, Activity, Cry, Consolability — untuk bayi/anak yang belum bisa bicara"
                        : formData.pain_method === "bps" ? "BPS: Behavioral Pain Scale — untuk pasien di bawah sedasi/ventilator"
                        : formData.pain_method === "wong_baker" ? "Pilih wajah yang paling sesuai dengan kondisi nyeri pasien"
                        : "0 = Tidak nyeri, 1-3 = Ringan, 4-6 = Sedang, 7-10 = Berat"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
          </div>

          {/* Section 4: GCS & Penilaian */}
          <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gcs_e" className="text-sm font-semibold">Eye Opening (E) [1-4]</Label>
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
                  <Label htmlFor="gcs_v" className="text-sm font-semibold">Verbal Response (V) [1-5]</Label>
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
                  <Label htmlFor="gcs_m" className="text-sm font-semibold">Motor Response (M) [1-6]</Label>
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
              
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span>Total GCS:</span>
                  <Badge variant="default">{gcsTotal}</Badge>
                  <span className="text-muted-foreground text-xs">
                    (E{formData.gcs_e}V{formData.gcs_v}M{formData.gcs_m})
                  </span>
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
          </div>

          {/* Submit Button - only show when can edit */}
          {!isFormDisabled && (
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
              <Button type="submit" className="gap-2 w-full sm:w-auto">
                <Save className="h-4 w-4" />
                Simpan Triase
              </Button>
              {triageId && !signatureStatus?.is_signed && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => setShowSignatureDialog(true)}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Tanda Tangan
                </Button>
              )}
              {signatureStatus?.is_signed && (
                <Badge variant="default" className="gap-1 bg-green-600 h-9 px-3">
                  <ShieldCheck className="h-4 w-4" />
                  Sudah Ditandatangani
                </Badge>
              )}
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

      {/* Signature Dialog */}
      {triageId && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.TRIAGE}
          documentId={triageId}
          visitId={visitId}
          documentTitle="Form Triage"
          onSuccess={handleSignatureSuccess}
        />
      )}
    </div>
  );
}
