import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Phone,
  MapPin,
  Droplet,
  AlertTriangle,
  Pill,
  MessageSquare,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ExternalLink,
  SquarePen,
  History,
  Expand,
} from "lucide-react";
import { patientAllergyApi, ALLERGY_CATEGORY_LABELS, ALLERGY_CRITICALITY_LABELS, api, bpjsApi, patientsApi } from "@/lib/api";
import type { Patient, PatientAllergy } from "@/lib/api";
import { MedicalRecordPrintSelect } from "./print-select";
import { EditDoctorDialog } from "./edit-doctor-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatPatientName } from "@/lib/print-utils";

interface SEPInfo {
  no_sep: string;
  tgl_sep: string;
  nama_poli: string;
  nama_dpjp: string;
  diag_awal: string;
  nama_diagnosa: string;
  status: string;
}

interface PatientInfoProps {
  visit: {
    id: number;
    visit_number: string;
    visit_type: string;
    status: string;
    room_id?: number;
    doctor_id?: number;
    registration_id?: number;
    check_in_time?: string;
    admission_time?: string;
    discharge_time?: string;
    referral_from?: number; // For consultation orders
    registration?: {
      id?: number;
      registration_number: string;
      status?: string;
      payment_method?: string;
      bpjs_number?: string;
      insurance_name?: string;
      complaint?: string;
      patient?: {
        id: number;
        no_rm: string;
        nama_lengkap: string;
        jenis_kelamin: string;
        tanggal_lahir?: string;
        no_telepon?: string;
        no_hp?: string;
        alamat_ktp?: string;
        golongan_darah?: string;
        rhesus?: string;
        alergi_obat?: string;
        alergi_makanan?: string;
        alergi_lainnya?: string;
        penyakit_kronis?: string;
        obat_rutin?: string;
        status_perkawinan?: string;
      };
    };
    room?: {
      code: string;
      name: string;
      type?: string;
      service_type?: string;
    };
    doctor?: {
      id?: number;
      nama_lengkap: string;
    };
    room_queue?: {
      queue_number: string;
      priority: string;
    };
  };
  onVisitRefresh?: () => void;
  variant?: "default" | "compact";
}

const calculateAge = (birthDate: string) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const formatDateValue = (value?: string) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const formatDateTimeValue = (value?: string) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const formatFieldValue = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  const normalized = String(value).trim();
  return normalized ? normalized : "-";
};

const formatFullAddress = (
  mainAddress?: string,
  kelurahan?: string,
  kecamatan?: string,
  kota?: string,
  provinsi?: string,
  kodePos?: string,
  rt?: string,
  rw?: string,
) => {
  const firstLine = (mainAddress || "").trim();
  const areaParts = [kelurahan, kecamatan, kota, provinsi]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  const areaLine = areaParts.join(", ");
  const rtRw = [rt, rw]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  const rtRwLine = rtRw.length > 0 ? `RT/RW ${rtRw.join("/")}` : "";
  const kodePosLine = (kodePos || "").trim() ? `Kode Pos ${String(kodePos).trim()}` : "";
  const result = [firstLine, areaLine, rtRwLine, kodePosLine].filter(Boolean).join("\n");
  return result || "-";
};

const getStatusBadge = (status: string, compact = false) => {
  const variants: Record<string, { variant: any; label: string }> = {
    waiting: { variant: "secondary", label: "Menunggu" },
    in_queue: { variant: "default", label: "Dalam Antrian" },
    in_progress: { variant: "default", label: "Sedang Dilayani" },
    completed: { variant: "outline", label: "Selesai" },
    cancelled: { variant: "destructive", label: "Dibatalkan" },
  };
  const config = variants[status] || { variant: "secondary", label: status };
  return (
    <Badge
      variant={config.variant}
      className={compact ? "h-5 px-1.5 text-[10px]" : undefined}
    >
      {config.label}
    </Badge>
  );
};

// Get visit category label based on visit_type and service_type
const getVisitCategoryLabel = (visit: PatientInfoProps["visit"]) => {
  const serviceType = visit.room?.service_type;
  const visitType = visit.visit_type;
  const hasReferral = !!visit.referral_from;

  if (visitType === "pharmacy") return "Order Farmasi";
  if (visitType === "radiology") return "Order Radiologi";
  if (visitType === "lab") return "Order Laboratorium";
  if (visitType === "consultation" && hasReferral) return "Konsultasi";
  if (visitType === "surgery") return "Operasi";
  if (serviceType === "gawat_darurat" || visitType === "emergency") return "UGD";
  if (serviceType === "rawat_inap" || visitType === "inpatient") return "Rawat Inap";
  if (serviceType === "rawat_jalan" || visitType === "outpatient") return "Rawat Jalan";
  if (visitType === "consultation") return "Konsultasi";
  return visitType || "Kunjungan";
};

export function PatientInfo({ visit, onCopyHistoryOpen, onVisitRefresh, variant = "default" }: PatientInfoProps & { onCopyHistoryOpen?: () => void }) {
  const navigate = useNavigate();
  
  const { toast } = useToast();
  const patient = visit.registration?.patient;
  const patientId = patient?.id;
  const [patientDetail, setPatientDetail] = useState<Patient | null>(null);
  const [loadingPatientDetail, setLoadingPatientDetail] = useState(false);
  const modalPatient = (patientDetail || patient) as (Partial<Patient> & NonNullable<typeof patient>) | undefined;
  
  // Patient allergies from dedicated allergy table
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergy[]>([]);
  const [loadingAllergies, setLoadingAllergies] = useState(false);
  
  // SEP Info
  const [sepInfo, setSepInfo] = useState<SEPInfo | null>(null);
  const [editDoctorOpen, setEditDoctorOpen] = useState(false);
  const [patientDetailOpen, setPatientDetailOpen] = useState(false);
  
  // Load patient allergies from database
  useEffect(() => {
    const loadAllergies = async () => {
      if (!patientId) return;
      
      setLoadingAllergies(true);
      try {
        const response = await patientAllergyApi.getByPatient(patientId);
        setPatientAllergies(response.data.data || []);
      } catch (error) {
        console.error("Failed to load patient allergies:", error);
      } finally {
        setLoadingAllergies(false);
      }
    };

    loadAllergies();
  }, [patientId]);

  // Visit payload only contains partial patient fields; fetch full profile for modal details.
  useEffect(() => {
    if (!patientDetailOpen || !patientId) return;
    if (patientDetail?.id === patientId) return;

    let cancelled = false;

    const loadPatientDetail = async () => {
      setLoadingPatientDetail(true);
      try {
        const response = await patientsApi.getById(patientId);
        if (!cancelled) {
          setPatientDetail(response.data || null);
        }
      } catch {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Data pasien belum lengkap",
            description: "Detail lengkap pasien tidak berhasil dimuat, menampilkan data kunjungan yang tersedia.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingPatientDetail(false);
        }
      }
    };

    loadPatientDetail();

    return () => {
      cancelled = true;
    };
  }, [patientDetailOpen, patientId, patientDetail?.id, toast]);

  // Load SEP info if BPJS payment
  useEffect(() => {
    const loadSEP = async () => {
      if (visit.registration?.payment_method !== 'bpjs' || !visit.id) return;
      
      try {
        // Prioritas 1: Cari SEP berdasarkan visit_id
        try {
          const visitSepResponse = await api.get(`/bpjs/vclaim/sep/visit/${visit.id}`);
          if (visitSepResponse.data.data) {
            setSepInfo(visitSepResponse.data.data);
            return; // Found SEP by visit_id, stop here
          }
        } catch (visitError) {
          // SEP not found by visit_id, continue to registration
        }

        // Prioritas 2: Fallback ke registration_id (untuk backward compatibility)
        const regId = (visit as any).registration_id || (visit.registration as any)?.id;
        if (regId) {
          const response = await api.get(`/bpjs/vclaim/sep/registration/${regId}`);
          if (response.data.data) {
            setSepInfo(response.data.data);
          }
        }
      } catch (error) {
        // SEP not found is okay
        setSepInfo(null);
      }
    };

    loadSEP();
  }, [visit.id, visit.registration?.payment_method]);

  // Check if patient has allergies - prefer allergies from database, fallback to master data
  const hasAllergyRecords = patientAllergies.length > 0;
  const hasLegacyAllergies = modalPatient?.alergi_obat || modalPatient?.alergi_makanan || modalPatient?.alergi_lainnya;
  const hasAllergies = hasAllergyRecords || hasLegacyAllergies;
  
  // Check if this is inpatient visit
  const isInpatient = visit.room?.service_type === "rawat_inap" || visit.visit_type === "inpatient";
  
  // Check if this is emergency (UGD) visit
  const isEmergency = visit.room?.service_type === "igd" || 
                      visit.room?.type === "igd" || 
                      visit.room?.type === "emergency" ||
                      visit.visit_type === "emergency";

  // History button is only relevant for main clinical visits (RJ/RI/UGD),
  // not for order visits like consultation/radiology/lab/pharmacy/surgery.
  const canShowHistoryButton = isEmergency || isInpatient || visit.visit_type === "outpatient";
  
  // Check if patient is discharged
  const isPatientDischarged = visit.registration?.status === "completed" || 
                              visit.registration?.status === "discharged" ||
                              visit.status === "completed";

  // I-Care state
  const [icareOpen, setIcareOpen] = useState(false);
  const [icareUrl, setIcareUrl] = useState<string | null>(null);
  const [icareLoading, setIcareLoading] = useState(false);

  const handleICareOpen = useCallback(async () => {
    setIcareLoading(true);
    try {
      const response = await bpjsApi.icareValidate(visit.id);
      const url = response.data.url;
      if (url) {
        setIcareUrl(url);
        setIcareOpen(true);
      } else {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "URL I-Care tidak ditemukan dalam response BPJS",
        });
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Gagal memuat I-Care";
      toast({
        variant: "destructive",
        title: "Gagal",
        description: msg,
      });
    } finally {
      setIcareLoading(false);
    }
  }, [visit.id, toast]);

  // Helper: Get initials from patient name
  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || "?";
  };

  const paymentLabel = visit.registration?.payment_method === "bpjs"
    ? "BPJS"
    : visit.registration?.payment_method === "insurance"
    ? "Asuransi"
    : visit.registration?.payment_method === "cash"
    ? "Tunai"
    : "-";

  const currentRoomId = (visit as any).room_id || (visit.room as any)?.id || 0;
  const currentDoctorId = (visit as any).doctor_id || visit.doctor?.id || null;

  const handleOpenDpjpEditor = () => {
    if (!currentRoomId) {
      toast({
        variant: "destructive",
        title: "Ruangan tidak tersedia",
        description: "Data ruangan belum tersedia untuk ganti DPJP.",
      });
      return;
    }
    setEditDoctorOpen(true);
  };

  const patientDetailContent = (
    <div className="space-y-2 border-t px-4 py-3">
      {loadingPatientDetail && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Memuat data lengkap pasien...
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        <div className="border px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">No. Visit</p>
          <p className="mt-1 truncate font-mono text-xs font-semibold">{visit.visit_number || "-"}</p>
        </div>
        <div className="border px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">No. Daftar</p>
          <p className="mt-1 truncate font-mono text-xs font-semibold">{visit.registration?.registration_number || "-"}</p>
        </div>
        <div className="border px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kategori</p>
          <p className="mt-1 text-xs font-semibold">{getVisitCategoryLabel(visit)}</p>
        </div>
        <div className="border px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
          <div className="mt-1">{getStatusBadge(visit.status, true)}</div>
        </div>
      </div>

      {loadingAllergies ? (
        <div className="flex items-center gap-2 py-2 text-muted-foreground mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Memuat data alergi...</span>
        </div>
      ) : hasAllergies && (
        <div className="border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Alergi Pasien</span>
          </div>
          <div className="space-y-1 text-xs">
            {hasAllergyRecords && patientAllergies.map((allergy) => (
              <div key={allergy.id} className="flex gap-1.5 items-start">
                <Badge
                  variant={allergy.criticality === "high" ? "destructive" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                >
                  {ALLERGY_CRITICALITY_LABELS[allergy.criticality]}
                </Badge>
                <span className="text-foreground">
                  <strong>{ALLERGY_CATEGORY_LABELS[allergy.category]}:</strong>{" "}
                  {allergy.snomed_display}
                  {allergy.notes && <span className="text-muted-foreground"> ({allergy.notes})</span>}
                </span>
              </div>
            ))}
            {!hasAllergyRecords && hasLegacyAllergies && (
              <>
                {modalPatient?.alergi_obat && (
                  <div className="flex gap-1.5 text-foreground">
                    <Pill className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive/70" />
                    <span><strong>Obat:</strong> {modalPatient.alergi_obat}</span>
                  </div>
                )}
                {modalPatient?.alergi_makanan && (
                  <div className="flex gap-1.5 text-foreground">
                    <span className="text-sm mt-0.5">🍽️</span>
                    <span><strong>Makanan:</strong> {modalPatient.alergi_makanan}</span>
                  </div>
                )}
                {modalPatient?.alergi_lainnya && (
                  <div className="flex gap-1.5 text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive/70" />
                    <span><strong>Lainnya:</strong> {modalPatient.alergi_lainnya}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="space-y-1.5 border p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Demografis</h4>
            {patientId && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/patients/${patientId}/edit`);
                      }}
                    >
                      <SquarePen className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Pasien</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="space-y-1.5">
            {modalPatient?.tanggal_lahir && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs">
                  {formatDateValue(modalPatient.tanggal_lahir)} ({calculateAge(modalPatient.tanggal_lahir)} tahun)
                </span>
              </div>
            )}
            {(modalPatient?.golongan_darah || modalPatient?.rhesus) && (
              <div className="flex items-center gap-2">
                <Droplet className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs">
                  Gol. {modalPatient?.golongan_darah || "-"} {modalPatient?.rhesus ? `(${modalPatient.rhesus})` : ""}
                </span>
              </div>
            )}
            {(modalPatient?.no_hp || modalPatient?.no_telepon) && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs">{modalPatient?.no_hp || modalPatient?.no_telepon}</span>
              </div>
            )}
            {modalPatient?.alamat_ktp && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
                <span className="text-xs">{modalPatient.alamat_ktp}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5 border p-2.5">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Kunjungan dan Layanan</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Ruangan</span><span className="font-medium text-right">{visit.room?.name || "-"}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">DPJP</span>
              <button
                type="button"
                className="text-right font-medium text-primary underline-offset-2 hover:underline"
                onClick={handleOpenDpjpEditor}
              >
                {visit.doctor?.nama_lengkap || "Pilih DPJP"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pembayaran</span><span className="font-medium">{paymentLabel}</span></div>
            {visit.room_queue?.queue_number && (
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">No. Antrian</span><span className="font-mono font-medium">{visit.room_queue.queue_number}</span></div>
            )}
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Check-in</span><span>{formatDateTimeValue(visit.check_in_time)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Masuk</span><span>{formatDateTimeValue(visit.admission_time)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pulang</span><span>{formatDateTimeValue(visit.discharge_time)}</span></div>
            {sepInfo && (
              <>
                <div className="my-2 border-t" />
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">No. SEP</span><span className="font-mono font-medium">{sepInfo.no_sep || "-"}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Poli SEP</span><span className="text-right">{sepInfo.nama_poli || "-"}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">DPJP SEP</span><span className="text-right">{sepInfo.nama_dpjp || "-"}</span></div>
              </>
            )}
          </div>
          {visit.registration?.complaint && (
            <div className="border p-2">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary/70" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Keluhan</p>
                  <p className="mt-1 text-xs leading-relaxed">{visit.registration.complaint}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="space-y-1.5 border p-2.5">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Identitas Lengkap</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">NIK</span><span className="font-mono text-right">{formatFieldValue(modalPatient?.nik)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Tempat Lahir</span><span className="text-right">{formatFieldValue(modalPatient?.tempat_lahir)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Agama</span><span className="text-right">{formatFieldValue(modalPatient?.agama)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pendidikan</span><span className="text-right">{formatFieldValue(modalPatient?.pendidikan_terakhir)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pekerjaan</span><span className="text-right">{formatFieldValue(modalPatient?.pekerjaan)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Kewarganegaraan</span><span className="text-right">{formatFieldValue(modalPatient?.kewarganegaraan)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Suku</span><span className="text-right">{formatFieldValue(modalPatient?.suku)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Bahasa</span><span className="text-right">{formatFieldValue(modalPatient?.bahasa)}</span></div>
          </div>
        </div>

        <div className="space-y-1.5 border p-2.5">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Kontak dan Alamat</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">HP</span><span className="text-right">{formatFieldValue(modalPatient?.no_hp)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Telepon</span><span className="text-right">{formatFieldValue(modalPatient?.no_telepon)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">HP Alternatif</span><span className="text-right">{formatFieldValue(modalPatient?.no_hp_alternatif)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Email</span><span className="text-right">{formatFieldValue(modalPatient?.email)}</span></div>
            <div className="pt-0.5">
              <p className="text-muted-foreground mb-1">Alamat KTP</p>
              <p className="whitespace-pre-line leading-relaxed">{formatFullAddress(modalPatient?.alamat_ktp, modalPatient?.kelurahan_ktp, modalPatient?.kecamatan_ktp, modalPatient?.kota_ktp, modalPatient?.provinsi_ktp, modalPatient?.kode_pos_ktp, modalPatient?.rt_ktp, modalPatient?.rw_ktp)}</p>
            </div>
            <div className="pt-0.5">
              <p className="text-muted-foreground mb-1">Alamat Domisili</p>
              <p className="whitespace-pre-line leading-relaxed">{formatFullAddress(modalPatient?.alamat_domisili, modalPatient?.kelurahan_domisili, modalPatient?.kecamatan_domisili, modalPatient?.kota_domisili, modalPatient?.provinsi_domisili, modalPatient?.kode_pos_domisili, modalPatient?.rt_domisili, modalPatient?.rw_domisili)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 border p-2.5">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Penanggung Jawab dan Jaminan</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Nama PJ</span><span className="text-right">{formatFieldValue(modalPatient?.nama_penanggung_jawab)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Hubungan</span><span className="text-right">{formatFieldValue(modalPatient?.hubungan_penanggung_jawab)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">NIK PJ</span><span className="font-mono text-right">{formatFieldValue(modalPatient?.nik_penanggung_jawab)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Telepon PJ</span><span className="text-right">{formatFieldValue(modalPatient?.telepon_penanggung_jawab)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Jenis Jaminan</span><span className="text-right">{formatFieldValue(modalPatient?.jenis_jaminan)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">No BPJS</span><span className="font-mono text-right">{formatFieldValue(modalPatient?.no_bpjs || visit.registration?.bpjs_number)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Kelas BPJS</span><span className="text-right">{formatFieldValue(modalPatient?.kelas_bpjs)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Faskes 1</span><span className="text-right">{formatFieldValue(modalPatient?.faskes_tingkat_1)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Asuransi</span><span className="text-right">{formatFieldValue(modalPatient?.nama_asuransi || visit.registration?.insurance_name)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">No Polis</span><span className="text-right">{formatFieldValue(modalPatient?.no_polis_asuransi)}</span></div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border p-2.5">
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Riwayat Medis Penting</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground mb-1">Penyakit Kronis</p>
            <p className="whitespace-pre-line leading-relaxed">{formatFieldValue(modalPatient?.penyakit_kronis)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Riwayat Operasi</p>
            <p className="whitespace-pre-line leading-relaxed">{formatFieldValue(modalPatient?.riwayat_operasi)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Obat Rutin</p>
            <p className="whitespace-pre-line leading-relaxed">{formatFieldValue(modalPatient?.obat_rutin)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Disabilitas</p>
            <p className="whitespace-pre-line leading-relaxed">{formatFieldValue(modalPatient?.disabilitas)}</p>
          </div>
        </div>
        <div className="pt-1 border-t">
          <p className="text-muted-foreground mb-1 text-xs">Catatan Khusus</p>
          <p className="text-xs whitespace-pre-line leading-relaxed">{formatFieldValue(modalPatient?.catatan_khusus)}</p>
        </div>
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <>
        <div className="flex h-full min-h-[180px] flex-col bg-background">
          <div
            className="cursor-pointer bg-background px-3 py-2 transition-colors hover:bg-muted/20"
            onClick={() => setPatientDetailOpen(true)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="secondary" className="h-5 gap-1 rounded-full px-2 py-0 text-[10px]">
                {getVisitCategoryLabel(visit)}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  window.history.back();
                }}
                className="h-7 w-7 rounded-none"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted text-sm font-semibold text-foreground">
                {getInitials(patient?.nama_lengkap)}
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                  {formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, patient?.status_perkawinan, patient?.tanggal_lahir)}
                </h3>
                <p className="font-mono text-xs text-muted-foreground">{patient?.no_rm || "-"}</p>
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span>{patient?.jenis_kelamin === "L" ? "Laki-laki" : patient?.jenis_kelamin === "P" ? "Perempuan" : "-"}</span>
                  {patient?.tanggal_lahir && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <span>{calculateAge(patient.tanggal_lahir)} thn</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[70px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 border-t pt-2 text-xs">
              <span className="text-muted-foreground">Ruangan</span>
              <span className="truncate text-right font-medium">{visit.room?.name || "-"}</span>
              <span className="text-muted-foreground">Dokter</span>
              <span className="truncate text-right font-medium">{visit.doctor?.nama_lengkap || "-"}</span>
              <span className="text-muted-foreground">Status</span>
              <div className="flex justify-end">{getStatusBadge(visit.status, true)}</div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {hasAllergies && (
                <Badge variant="destructive" className="h-5 gap-1 rounded-full px-1.5 py-0 text-[10px]">
                  <AlertTriangle className="h-3 w-3" />
                  Alergi
                </Badge>
              )}
              {sepInfo && (
                <Badge variant="outline" className="h-5 gap-1 rounded-full px-1.5 py-0 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  SEP
                </Badge>
              )}
              {isPatientDischarged && (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 py-0 text-[10px]">Selesai</Badge>
              )}
            </div>
          </div>
        </div>

        <Dialog open={patientDetailOpen} onOpenChange={setPatientDetailOpen}>
              <DialogContent className="h-[88vh] max-h-[88vh] max-w-6xl overflow-hidden rounded-none p-0">
                <DialogHeader className="border-b px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(modalPatient?.nama_lengkap)}
                </div>
                Detail Pasien dan Kunjungan
              </DialogTitle>
            </DialogHeader>
            {patientDetailContent}
          </DialogContent>
        </Dialog>

        <EditDoctorDialog
          open={editDoctorOpen}
          onOpenChange={setEditDoctorOpen}
          visitId={visit.id}
          roomId={currentRoomId}
          currentDoctorId={currentDoctorId}
          onSuccess={() => {
            onVisitRefresh?.();
          }}
        />

        <Dialog open={icareOpen} onOpenChange={setIcareOpen}>
          <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 gap-0">
            <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                BPJS I-Care — {modalPatient?.nama_lengkap || "-"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {icareUrl ? (
                <iframe
                  src={icareUrl}
                  className="w-full h-full border-0"
                  style={{ minHeight: "calc(85vh - 60px)" }}
                  title="BPJS I-Care"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Memuat I-Care...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div>
      {/* Header Bar */}
      <div
        className="flex items-start sm:items-center justify-between gap-2 py-2 cursor-pointer select-none group rounded-xl border bg-card px-3 sm:px-4"
        onClick={() => setPatientDetailOpen(true)}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); window.history.back(); }}
            className="flex-shrink-0 h-8 w-8 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
            {getInitials(patient?.nama_lengkap)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="text-sm font-semibold truncate">
                {formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, patient?.status_perkawinan, patient?.tanggal_lahir)}
              </h3>
              <span className="font-mono text-[10px] sm:text-[11px] text-muted-foreground flex-shrink-0">
                {patient?.no_rm || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
              <span>{patient?.jenis_kelamin === "L" ? "Laki-laki" : patient?.jenis_kelamin === "P" ? "Perempuan" : "-"}</span>
              {patient?.tanggal_lahir && (
                <><span className="text-muted-foreground/40">·</span><span>{calculateAge(patient.tanggal_lahir)} thn</span></>
              )}
              <span className="text-muted-foreground/40">·</span>
              <span>{getVisitCategoryLabel(visit)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap max-w-[48%] sm:max-w-none">
          {/* Quick badges */}
          {hasAllergies && (
            <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0 h-5">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Alergi</span>
            </Badge>
          )}
          {sepInfo && (
            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              <span className="hidden sm:inline">SEP</span>
            </Badge>
          )}
          {isPatientDischarged && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              <span className="hidden sm:inline">Selesai</span>
              <span className="sm:hidden">OK</span>
            </Badge>
          )}
          {/* I-Care Button (only for BPJS patients with SEP) */}
          {sepInfo && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 sm:w-auto px-0 sm:px-2 text-xs gap-1"
                onClick={handleICareOpen}
                disabled={icareLoading}
              >
                {icareLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">I-Care</span>
              </Button>
            </div>
          )}
          {/* Copy from History */}
          {onCopyHistoryOpen && canShowHistoryButton && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 sm:w-auto px-0 sm:px-2 text-xs gap-1"
                onClick={onCopyHistoryOpen}
              >
                <History className="h-3 w-3" />
                <span className="hidden sm:inline">Riwayat</span>
              </Button>
            </div>
          )}
          {/* Print Select */}
          <div onClick={(e) => e.stopPropagation()}>
            <MedicalRecordPrintSelect
              visitId={visit.id}
              isInpatient={isInpatient}
              isEmergency={isEmergency}
            />
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] sm:text-xs text-muted-foreground">
            <Expand className="h-3 w-3" />
            <span className="hidden sm:inline">Detail Pasien</span>
          </div>
        </div>
      </div>
      <Dialog open={patientDetailOpen} onOpenChange={setPatientDetailOpen}>
        <DialogContent className="h-[88vh] max-h-[88vh] max-w-6xl overflow-hidden rounded-none p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(modalPatient?.nama_lengkap)}
              </div>
              Detail Pasien dan Kunjungan
            </DialogTitle>
          </DialogHeader>
          {patientDetailContent}
        </DialogContent>
      </Dialog>

      <EditDoctorDialog
        open={editDoctorOpen}
        onOpenChange={setEditDoctorOpen}
        visitId={visit.id}
        roomId={currentRoomId}
        currentDoctorId={currentDoctorId}
        onSuccess={() => {
          onVisitRefresh?.();
        }}
      />

      {/* I-Care Modal */}
      <Dialog open={icareOpen} onOpenChange={setIcareOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              BPJS I-Care — {modalPatient?.nama_lengkap || "-"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {icareUrl ? (
              <iframe
                src={icareUrl}
                className="w-full h-full border-0"
                style={{ minHeight: "calc(85vh - 60px)" }}
                title="BPJS I-Care"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Memuat I-Care...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
