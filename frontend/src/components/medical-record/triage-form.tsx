import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { useMultipleMasterData } from "@/hooks/useMasterData";
import { medicalRecordsApi, masterDataApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
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
  externalData?: Partial<Triage>;
  useExternalData?: boolean;
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
  rujukan_dari: "",
  triage_complaint: "",
  triage_level: "",
  airway: "",
  airway_note: "",
  breathing: "",
  breathing_note: "",
  circulation: "",
  circulation_note: "",
  blood_pressure: "",
  heart_rate: "",
  respiratory_rate: "",
  temperature: "",
  oxygen_saturation: "",
  pain_scale: "0",
  pain_method: "nrs",
  pain_location: "Tidak ada nyeri",
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

export function TriageForm({
  visitId,
  onSave,
  readOnly = false,
  isPatientDischarged = false,
  externalData,
  useExternalData = false,
}: TriageFormProps) {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(defaultFormData);
  const [triageId, setTriageId] = useState<number | undefined>();

  // Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [, setSignatureStatus] = useState<{ is_signed: boolean; signer_name?: string } | null>(null);

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
  const isFormDisabled = readOnly || (!useExternalData && isPatientDischarged && !isEditing);

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

  // Referral sources suggestions
  const [referralSources, setReferralSources] = useState<string[]>([]);

  useEffect(() => {
    masterDataApi.getReferralSources()
      .then((res) => {
        if (res.data?.data) {
          setReferralSources(res.data.data);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat daftar rujukan:", err);
      });
  }, []);

  const referralSourceOptions = useMemo(() => {
    const list = [...referralSources];
    if (formData.rujukan_dari && !list.some(s => s.toLowerCase() === formData.rujukan_dari.toLowerCase())) {
      list.unshift(formData.rujukan_dari);
    }
    return list.map((source) => ({
      value: source,
      label: source,
    }));
  }, [referralSources, formData.rujukan_dari]);


  // Load existing data on mount
  useEffect(() => {
    if (useExternalData) {
      const d = externalData || {};
      setFormData({
        arrival_mode: (d as any).arrival_mode || "",
        rujukan_dari: (d as any).rujukan_dari || "",
        triage_complaint: (d as any).triage_complaint || "",
        triage_level: (d as any).triage_level || "",
        airway: (d as any).airway || "",
        airway_note: (d as any).airway_note || "",
        breathing: (d as any).breathing || "",
        breathing_note: (d as any).breathing_note || "",
        circulation: (d as any).circulation || "",
        circulation_note: (d as any).circulation_note || "",
        blood_pressure: (d as any).blood_pressure || "",
        heart_rate: (d as any).heart_rate !== undefined ? (d as any).heart_rate : "",
        respiratory_rate: (d as any).respiratory_rate !== undefined ? (d as any).respiratory_rate : ((d as any).breathing_rate !== undefined ? (d as any).breathing_rate : ""),
        temperature: (d as any).temperature !== undefined ? (d as any).temperature : "",
        oxygen_saturation: (d as any).oxygen_saturation !== undefined ? (d as any).oxygen_saturation : "",
        pain_scale: (d as any).pain_scale !== undefined ? (d as any).pain_scale : "",
        pain_method: (d as any).pain_method || "nrs",
        pain_location: (d as any).pain_location || "",
        gcs_e: Number((d as any).gcs_e) || 4,
        gcs_v: Number((d as any).gcs_v) || 5,
        gcs_m: Number((d as any).gcs_m) || 6,
        triage_assessment: (d as any).triage_assessment || "",
        immediate_actions: (d as any).immediate_actions || "",
      });
      setLoading(false);
      return;
    }

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
            rujukan_dari: data.rujukan_dari || "",
            triage_complaint: data.triage_complaint || "",
            triage_level: data.triage_level || "",
            airway: data.airway || "",
            airway_note: data.airway_note || "",
            breathing: data.breathing || "",
            breathing_note: data.breathing_note || "",
            circulation: data.circulation || "",
            circulation_note: data.circulation_note || "",
            blood_pressure: data.blood_pressure || "",
            heart_rate: heartRate !== 0 ? String(heartRate) : "",
            respiratory_rate: respRate !== 0 ? String(respRate) : "",
            temperature: temp !== 0 ? String(temp) : "",
            oxygen_saturation: spo2 !== 0 ? String(spo2) : "",
            pain_scale: data.pain_scale !== undefined && data.pain_scale !== null ? String(data.pain_scale) : "0",
            pain_method: data.pain_method || "nrs",
            pain_location: data.pain_location || "Tidak ada nyeri",
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
          if (!draft.pain_location) draft.pain_location = "Tidak ada nyeri";
          setFormData(draft);
          emitMedicalRecordTabSaved("triage", false);
        }
      }
    };

    loadTriage();
  }, [visitId, useExternalData, externalData]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    emitMedicalRecordTabSaved("triage", false);
  };

  // Count filled fields for tab indicator
  const isNoPain = formData.pain_location === "Tidak ada nyeri";
  const painMethodFilled = isNoPain || Boolean(formData.pain_method && formData.pain_method.trim() !== "");
  const painLocationFilled = Boolean(formData.pain_location && formData.pain_location.trim() !== "");
  const painScaleFilled = isNoPain || (formData.pain_scale !== "" && formData.pain_scale !== undefined && formData.pain_scale !== null && Number(formData.pain_scale) >= 0);

  const airwayFilled = Boolean(formData.airway && formData.airway.trim() !== "");
  const airwayNoteFilled = airwayFilled || Boolean(formData.airway_note && formData.airway_note.trim() !== "");
  const breathingFilled = Boolean(formData.breathing && formData.breathing.trim() !== "");
  const breathingNoteFilled = breathingFilled || Boolean(formData.breathing_note && formData.breathing_note.trim() !== "");
  const circulationFilled = Boolean(formData.circulation && formData.circulation.trim() !== "");
  const circulationNoteFilled = circulationFilled || Boolean(formData.circulation_note && formData.circulation_note.trim() !== "");

  const triageTextFilled = [
    formData.arrival_mode,
    formData.triage_complaint,
    formData.triage_level,
    formData.blood_pressure,
    formData.triage_assessment,
    formData.immediate_actions,
  ].filter(v => v && v.trim() !== "").length;

  const triageSurveyFilled = (airwayFilled ? 1 : 0) + (airwayNoteFilled ? 1 : 0) +
    (breathingFilled ? 1 : 0) + (breathingNoteFilled ? 1 : 0) +
    (circulationFilled ? 1 : 0) + (circulationNoteFilled ? 1 : 0);

  const triagePainFilled = (painMethodFilled ? 1 : 0) + (painLocationFilled ? 1 : 0) + (painScaleFilled ? 1 : 0);

  const triageNumericFilled = [
    formData.heart_rate,
    formData.respiratory_rate,
    formData.temperature,
    formData.oxygen_saturation,
  ].filter(v => Number(v) > 0).length;

  const triageGCSFilled = (formData.gcs_e ? 1 : 0) + (formData.gcs_v ? 1 : 0) + (formData.gcs_m ? 1 : 0);

  const filledTriage = triageTextFilled + triageSurveyFilled + triagePainFilled + triageNumericFilled + triageGCSFilled;
  const totalTriage = 22;

  useEffect(() => {
    if (loading) return;
    emitMedicalRecordTabIndicator("triage", `${filledTriage}/${totalTriage}`);
  }, [filledTriage, loading]);

  // Auto-save draft to localStorage on state change
  useEffect(() => {
    if (useExternalData) return;
    if (loading) return;
    saveFormDraft(`mr-draft-triage-${visitId}`, formData);
  }, [formData, loading, visitId, useExternalData]);

  // Clear draft when save is confirmed by show.tsx
  useEffect(() => {
    if (useExternalData) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabId: string; saved: boolean }>;
      if (ev.detail?.tabId === "triage" && ev.detail.saved === true) {
        clearFormDraft(`mr-draft-triage-${visitId}`);
      }
    };
    window.addEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
    return () => window.removeEventListener(MEDICAL_RECORD_TAB_SAVED_EVENT, handler as EventListener);
  }, [visitId, useExternalData]);

  const doSave = async () => {
    // Parse numeric fields to numbers to prevent JSON unmarshal errors when empty
    const payload = {
      ...formData,
      pain_scale: formData.pain_scale ? Number(formData.pain_scale) : 0,
      gcs_e: formData.gcs_e ? Number(formData.gcs_e) : 0,
      gcs_v: formData.gcs_v ? Number(formData.gcs_v) : 0,
      gcs_m: formData.gcs_m ? Number(formData.gcs_m) : 0,
      breathing_rate: formData.respiratory_rate ? String(formData.respiratory_rate) : "0",
      respiratory_rate: formData.respiratory_rate ? Number(formData.respiratory_rate) : 0,
      heart_rate: formData.heart_rate ? Number(formData.heart_rate) : 0,
      temperature: formData.temperature ? Number(formData.temperature) : 0,
      oxygen_saturation: formData.oxygen_saturation ? Number(formData.oxygen_saturation) : 0,
    };

    if (useExternalData) {
      onSave?.(payload);
      return;
    }

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
    
    onSave?.(payload);
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
  const heartRateStatus = getVitalStatus(Number(formData.heart_rate), 60, 100, 50, 110);
  const respiratoryStatus = getVitalStatus(Number(formData.respiratory_rate), 12, 20, 10, 24);
  const temperatureStatus = getVitalStatus(Number(formData.temperature), 36.1, 37.2, 35.5, 37.9);
  const spo2Status = getVitalStatus(Number(formData.oxygen_saturation), 95, 100, 90, 100);

  // Get options from master data
  const arrivalModeOptions = getOptions('arrival_mode');
  const triageLevelOptions = getOptions('triage_level').filter(opt => opt.value !== "3" && opt.value !== "5");
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
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px] gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Memuat data...</span>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      <div>
        {/* Edit Mode Banner for discharged patients */}
        {!useExternalData && (
          <div className="px-4 sm:px-5 pt-3 empty:hidden">
            <EditModeBanner
              isPatientDischarged={isPatientDischarged}
              isEditing={isEditing}
              onRequestEdit={handleRequestEdit}
              recordTypeLabel="Triase"
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={isFormDisabled}
            className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs"
          >
            {/* Section 1: Informasi Kedatangan */}
            <section className="px-4 sm:px-5 py-4 space-y-4">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Informasi Kedatangan
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="arrival_mode" className="text-xs font-medium">
                    Moda Kedatangan <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    allowCustomValue
                    options={arrivalModeOptions}
                    value={formData.arrival_mode}
                    onValueChange={(value) => handleChange("arrival_mode", value)}
                    placeholder="Pilih moda kedatangan"
                    searchPlaceholder="Cari moda kedatangan..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="triage_rujukan" className="text-xs font-medium">
                    Rujukan Dari
                  </Label>
                  <Combobox
                    allowCustomValue
                    options={referralSourceOptions}
                    value={formData.rujukan_dari || ""}
                    onValueChange={(value) => handleChange("rujukan_dari", value || "")}
                    placeholder="Pilih atau ketik nama faskes / dokter..."
                    searchPlaceholder="Cari faskes/dokter atau ketik baru..."
                    emptyText="Belum ada faskes tercatat. Ketik untuk menambahkan baru."
                    disabled={isFormDisabled}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="triage_complaint" className="text-xs font-medium">
                    Keluhan Utama <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="triage_complaint"
                    placeholder="Keluhan utama pasien..."
                    value={formData.triage_complaint || ""}
                    onChange={(e) => handleChange("triage_complaint", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Triage Level */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Level Triase <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Level Triase">
                  {triageLevelOptions.map((level) => {
                    const isSelected = formData.triage_level === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => handleChange("triage_level", level.value)}
                        role="radio"
                        aria-checked={isSelected}
                        className={cn(
                          "rounded-none border p-3 text-left transition-all",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100",
                          isSelected
                            ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/[0.04] dark:bg-white/[0.06] ring-1 ring-neutral-900 dark:ring-neutral-100"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-900 dark:hover:border-neutral-100 hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full shrink-0",
                              triageLevelColors[level.value] || "bg-gray-500"
                            )}
                          />
                          <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                            Level {level.value}
                          </span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                          {triageLevelMeta[level.value]?.title || level.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                          {triageLevelMeta[level.value]?.description || "Pilih sesuai kondisi klinis pasien"}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {selectedTriageMeta && (
                  <div
                    className={cn(
                      "border border-l-4 px-3.5 py-2",
                      selectedTriagePalette?.container || "border-border"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", selectedTriagePalette?.title || "")}>
                      Level dipilih: {selectedTriageMeta.title}
                    </p>
                    <p className={cn("text-[11px] mt-0.5", selectedTriagePalette?.subtitle || "text-muted-foreground")}>
                      {selectedTriageMeta.response}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Section 2: Primary Survey (ABC) */}
            <section className="px-4 sm:px-5 py-4 space-y-4">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Primary Survey ABC
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="airway" className="text-xs font-medium">Airway (Jalan Napas)</Label>
                  <Combobox
                    allowCustomValue
                    options={airwayOptions}
                    value={formData.airway}
                    onValueChange={(value) => handleChange("airway", value)}
                    placeholder="Pilih kondisi jalan napas"
                    searchPlaceholder="Cari kondisi airway..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="airway_note" className="text-xs font-medium">Catatan Airway</Label>
                  <Input
                    id="airway_note"
                    placeholder="Catatan tambahan..."
                    value={formData.airway_note}
                    onChange={(e) => handleChange("airway_note", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="breathing" className="text-xs font-medium">Breathing (Pernapasan)</Label>
                  <Combobox
                    allowCustomValue
                    options={breathingOptions}
                    value={formData.breathing}
                    onValueChange={(value) => handleChange("breathing", value)}
                    placeholder="Pilih kondisi pernapasan"
                    searchPlaceholder="Cari kondisi breathing..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="breathing_note" className="text-xs font-medium">Catatan Breathing</Label>
                  <Input
                    id="breathing_note"
                    placeholder="Catatan tambahan..."
                    value={formData.breathing_note}
                    onChange={(e) => handleChange("breathing_note", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="circulation" className="text-xs font-medium">Circulation (Sirkulasi)</Label>
                  <Combobox
                    allowCustomValue
                    options={circulationOptions}
                    value={formData.circulation}
                    onValueChange={(value) => handleChange("circulation", value)}
                    placeholder="Pilih kondisi sirkulasi"
                    searchPlaceholder="Cari kondisi sirkulasi..."
                    emptyText="Tidak ditemukan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="circulation_note" className="text-xs font-medium">Catatan Circulation</Label>
                  <Input
                    id="circulation_note"
                    placeholder="Catatan tambahan..."
                    value={formData.circulation_note}
                    onChange={(e) => handleChange("circulation_note", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Tanda Vital & Nyeri */}
            <section className="px-4 sm:px-5 py-4 space-y-4">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Tanda Vital dan Nyeri
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 min-h-[20px]">
                    <Label htmlFor="blood_pressure" className="text-xs font-medium">Tekanan Darah</Label>
                    {getVitalStatusLabel(bpStatus) && (
                      <Badge variant="outline" className={cn("rounded-none text-[9px] px-1 py-0 h-4", getVitalStatusBadgeClass(bpStatus))}>
                        {getVitalStatusLabel(bpStatus)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="blood_pressure"
                    placeholder="120/80 mmHg"
                    value={formData.blood_pressure}
                    onChange={(e) => handleChange("blood_pressure", e.target.value)}
                    className={getVitalStatusInputClass(bpStatus)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 min-h-[20px]">
                    <Label htmlFor="heart_rate" className="text-xs font-medium">Nadi (x/menit)</Label>
                    {getVitalStatusLabel(heartRateStatus) && (
                      <Badge variant="outline" className={cn("rounded-none text-[9px] px-1 py-0 h-4", getVitalStatusBadgeClass(heartRateStatus))}>
                        {getVitalStatusLabel(heartRateStatus)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="heart_rate"
                    type="number"
                    placeholder="80"
                    value={formData.heart_rate === "" ? "" : formData.heart_rate}
                    onChange={(e) => handleChange("heart_rate", e.target.value === "" ? "" : Number(e.target.value))}
                    className={getVitalStatusInputClass(heartRateStatus as any)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 min-h-[20px]">
                    <Label htmlFor="respiratory_rate" className="text-xs font-medium">Frekuensi Napas</Label>
                    {getVitalStatusLabel(respiratoryStatus) && (
                      <Badge variant="outline" className={cn("rounded-none text-[9px] px-1 py-0 h-4", getVitalStatusBadgeClass(respiratoryStatus))}>
                        {getVitalStatusLabel(respiratoryStatus)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="respiratory_rate"
                    type="number"
                    placeholder="20 x/menit"
                    value={formData.respiratory_rate === "" ? "" : formData.respiratory_rate}
                    onChange={(e) => handleChange("respiratory_rate", e.target.value === "" ? "" : Number(e.target.value))}
                    className={getVitalStatusInputClass(respiratoryStatus as any)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 min-h-[20px]">
                    <Label htmlFor="temperature" className="text-xs font-medium">Suhu (°C)</Label>
                    {getVitalStatusLabel(temperatureStatus) && (
                      <Badge variant="outline" className={cn("rounded-none text-[9px] px-1 py-0 h-4", getVitalStatusBadgeClass(temperatureStatus))}>
                        {getVitalStatusLabel(temperatureStatus)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={formData.temperature === "" ? "" : formData.temperature}
                    onChange={(e) => handleChange("temperature", e.target.value === "" ? "" : Number(e.target.value))}
                    className={getVitalStatusInputClass(temperatureStatus as any)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 min-h-[20px]">
                    <Label htmlFor="oxygen_saturation" className="text-xs font-medium">SpO2 (%)</Label>
                    {getVitalStatusLabel(spo2Status) && (
                      <Badge variant="outline" className={cn("rounded-none text-[9px] px-1 py-0 h-4", getVitalStatusBadgeClass(spo2Status))}>
                        {getVitalStatusLabel(spo2Status)}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="oxygen_saturation"
                    type="number"
                    placeholder="98"
                    value={formData.oxygen_saturation === "" ? "" : formData.oxygen_saturation}
                    onChange={(e) => handleChange("oxygen_saturation", e.target.value === "" ? "" : Number(e.target.value))}
                    className={getVitalStatusInputClass(spo2Status as any)}
                    required
                  />
                </div>
              </div>

              {/* Nyeri Sub-block */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-900/30 px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-800">
                  <div className="space-y-0.5">
                    <Label htmlFor="no_pain" className="text-xs font-semibold cursor-pointer">
                      Tidak Ada Nyeri
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Aktifkan jika pasien tidak mengalami nyeri
                    </p>
                  </div>
                  <Switch
                    id="no_pain"
                    checked={formData.pain_location === "Tidak ada nyeri"}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleChange("pain_location", "Tidak ada nyeri");
                        handleChange("pain_scale", "0");
                      } else {
                        handleChange("pain_location", "");
                      }
                    }}
                    disabled={isFormDisabled}
                  />
                </div>

                {formData.pain_location !== "Tidak ada nyeri" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pain_method" className="text-xs font-medium">Metode Penilaian Nyeri</Label>
                      <Select
                        value={formData.pain_method}
                        onValueChange={(value) => handleChange("pain_method", value)}
                        disabled={isFormDisabled}
                      >
                        <SelectTrigger id="pain_method" className="h-9 rounded-none text-xs">
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="nrs" className="text-xs">NRS (Numeric Rating Scale)</SelectItem>
                          <SelectItem value="wong_baker" className="text-xs">Wong-Baker FACES</SelectItem>
                          <SelectItem value="vas" className="text-xs">VAS (Visual Analog Scale)</SelectItem>
                          <SelectItem value="flacc" className="text-xs">FLACC (bayi/anak non-verbal)</SelectItem>
                          <SelectItem value="bps" className="text-xs">BPS (pasien ICU/ventilator)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pain_location" className="text-xs font-medium">Lokasi Nyeri</Label>
                      <Combobox
                        allowCustomValue
                        options={painLocationOptions}
                        value={formData.pain_location || ""}
                        onValueChange={(value) => handleChange("pain_location", value)}
                        placeholder="Pilih lokasi nyeri"
                        searchPlaceholder="Cari lokasi nyeri..."
                        emptyText="Lokasi tidak ditemukan"
                        disabled={isFormDisabled}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pain_scale" className="text-xs font-medium">Skala Nyeri (0-10)</Label>
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
                                    onClick={() => handleChange("pain_scale", String(v))}
                                    className={cn(
                                      "text-xl cursor-pointer rounded-none p-1 transition-all border",
                                      formData.pain_scale === String(v)
                                        ? "bg-neutral-900/10 border-neutral-900 dark:border-neutral-100"
                                        : "border-transparent hover:bg-muted"
                                    )}
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
                      {/* NRS / VAS / FLACC / BPS numeric bar */}
                      {(formData.pain_method === "nrs" || formData.pain_method === "vas" || formData.pain_method === "flacc" || formData.pain_method === "bps") && (
                        <div className="flex items-center gap-1 pb-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={isFormDisabled}
                              onClick={() => handleChange("pain_scale", String(v))}
                              className={cn(
                                "flex-1 h-8 text-xs font-mono font-medium rounded-none transition-all",
                                formData.pain_scale === String(v)
                                  ? "ring-2 ring-neutral-900 dark:ring-white text-white " + (v <= 3 ? "bg-green-600" : v <= 6 ? "bg-yellow-600" : "bg-red-600")
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
                      <p className="text-[11px] text-muted-foreground">
                        {formData.pain_method === "flacc" ? "FLACC: Face, Legs, Activity, Cry, Consolability — untuk bayi/anak yang belum bisa bicara"
                        : formData.pain_method === "bps" ? "BPS: Behavioral Pain Scale — untuk pasien di bawah sedasi/ventilator"
                        : formData.pain_method === "wong_baker" ? "Pilih wajah yang paling sesuai dengan kondisi nyeri pasien"
                        : "0 = Tidak nyeri, 1-3 = Ringan, 4-6 = Sedang, 7-10 = Berat"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Section 4: GCS & Tindakan Awal */}
            <section className="px-4 sm:px-5 py-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  GCS dan Tindakan Awal
                </div>
                <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">Total GCS:</span>
                  <Badge variant="default" className="rounded-none font-mono text-[11px] h-5 px-1.5">
                    {gcsTotal}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    (E{formData.gcs_e}V{formData.gcs_v}M{formData.gcs_m})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gcs_e" className="text-xs font-medium">Eye Opening (E) [1-4]</Label>
                  <Input
                    id="gcs_e"
                    type="number"
                    min="1"
                    max="4"
                    value={formData.gcs_e}
                    onChange={(e) => handleChange("gcs_e", parseInt(e.target.value) || 1)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gcs_v" className="text-xs font-medium">Verbal Response (V) [1-5]</Label>
                  <Input
                    id="gcs_v"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.gcs_v}
                    onChange={(e) => handleChange("gcs_v", parseInt(e.target.value) || 1)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gcs_m" className="text-xs font-medium">Motor Response (M) [1-6]</Label>
                  <Input
                    id="gcs_m"
                    type="number"
                    min="1"
                    max="6"
                    value={formData.gcs_m}
                    onChange={(e) => handleChange("gcs_m", parseInt(e.target.value) || 1)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="triage_assessment" className="text-xs font-medium">
                    Penilaian Awal
                  </Label>
                  <Textarea
                    id="triage_assessment"
                    placeholder="Penilaian awal kondisi pasien..."
                    value={formData.triage_assessment}
                    onChange={(e) => handleChange("triage_assessment", e.target.value)}
                    className="min-h-[110px] resize-none text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="immediate_actions" className="text-xs font-medium">
                    Tindakan Segera
                  </Label>
                  <Textarea
                    id="immediate_actions"
                    placeholder="Tindakan segera yang telah/akan dilakukan..."
                    value={formData.immediate_actions}
                    onChange={(e) => handleChange("immediate_actions", e.target.value)}
                    className="min-h-[110px] resize-none text-xs"
                  />
                </div>
              </div>
            </section>
          </fieldset>
        </form>
      </div>
      
      {/* Edit Confirmation Dialog */}
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
        </>
      )}
    </div>
  );
}

