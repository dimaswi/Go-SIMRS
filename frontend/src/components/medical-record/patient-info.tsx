import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
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

  const renderRow = (label: React.ReactNode, value: React.ReactNode, isMono = false) => (
    <div className="flex items-start py-2.5 border-b border-border/30 last:border-0">
      <span className="w-1/3 text-xs text-muted-foreground font-medium pt-0.5">{label}</span>
      <span className={cn("w-2/3 text-sm text-foreground", isMono && "font-mono text-[13px]")}>{value ? value : <span className="text-muted-foreground/40">-</span>}</span>
    </div>
  );

  const patientDetailContent = (
    <div className="flex flex-col bg-background h-full overflow-y-auto">
      {loadingPatientDetail && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 bg-muted/30 text-sm text-muted-foreground border-b">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data lengkap pasien...
        </div>
      )}

      {/* Header Info */}
      <div className="px-6 py-5 border-b bg-muted/10 grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">No. Visit</p>
          <p className="font-mono text-sm font-semibold">{visit.visit_number || "-"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">No. Daftar</p>
          <p className="font-mono text-sm font-semibold">{visit.registration?.registration_number || "-"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Kategori</p>
          <p className="text-sm font-semibold">{getVisitCategoryLabel(visit)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Status</p>
          <div className="mt-0.5">{getStatusBadge(visit.status, true)}</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x flex-1">
        {/* Left Column */}
        <div className="flex-1 p-6 space-y-8">

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[13px] uppercase tracking-wider text-foreground border-l-2 border-primary pl-2">
                Identitas Pasien
              </h3>
              {patientId && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patientId}/edit`); }}>
                  <SquarePen className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              )}
            </div>
            <div>
              {renderRow("NIK", formatFieldValue(modalPatient?.nik), true)}
              {renderRow("Tempat, Tanggal Lahir", modalPatient?.tanggal_lahir ? `${formatFieldValue(modalPatient?.tempat_lahir)}, ${formatDateValue(modalPatient.tanggal_lahir)} (${calculateAge(modalPatient.tanggal_lahir)} tahun)` : "-")}
              {renderRow("Golongan Darah", modalPatient?.golongan_darah ? `Gol. ${modalPatient.golongan_darah} ${modalPatient?.rhesus ? `(${modalPatient.rhesus})` : ""}` : "-")}
              {renderRow("Agama", formatFieldValue(modalPatient?.agama))}
              {renderRow("Pendidikan", formatFieldValue(modalPatient?.pendidikan_terakhir))}
              {renderRow("Pekerjaan", formatFieldValue(modalPatient?.pekerjaan))}
              {renderRow("Kewarganegaraan", formatFieldValue(modalPatient?.kewarganegaraan))}
              {renderRow("Suku / Bahasa", `${formatFieldValue(modalPatient?.suku)} / ${formatFieldValue(modalPatient?.bahasa)}`)}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-[13px] uppercase tracking-wider text-foreground border-l-2 border-primary pl-2 mb-4">
              Kontak & Alamat
            </h3>
            <div>
              {renderRow("No. HP", formatFieldValue(modalPatient?.no_hp), true)}
              {renderRow("Telepon Rumah", formatFieldValue(modalPatient?.no_telepon), true)}
              {renderRow("HP Alternatif", formatFieldValue(modalPatient?.no_hp_alternatif), true)}
              {renderRow("Email", formatFieldValue(modalPatient?.email))}
              {renderRow("Alamat KTP", formatFullAddress(modalPatient?.alamat_ktp, modalPatient?.kelurahan_ktp, modalPatient?.kecamatan_ktp, modalPatient?.kota_ktp, modalPatient?.provinsi_ktp, modalPatient?.kode_pos_ktp, modalPatient?.rt_ktp, modalPatient?.rw_ktp))}
              {renderRow("Alamat Domisili", formatFullAddress(modalPatient?.alamat_domisili, modalPatient?.kelurahan_domisili, modalPatient?.kecamatan_domisili, modalPatient?.kota_domisili, modalPatient?.provinsi_domisili, modalPatient?.kode_pos_domisili, modalPatient?.rt_domisili, modalPatient?.rw_domisili))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-[13px] uppercase tracking-wider text-foreground border-l-2 border-primary pl-2 mb-4">
              Penanggung Jawab & Jaminan
            </h3>
            <div>
              {renderRow("Nama Penanggung Jawab", formatFieldValue(modalPatient?.nama_penanggung_jawab))}
              {renderRow("Hubungan", formatFieldValue(modalPatient?.hubungan_penanggung_jawab))}
              {renderRow("NIK PJ", formatFieldValue(modalPatient?.nik_penanggung_jawab), true)}
              {renderRow("Telepon PJ", formatFieldValue(modalPatient?.telepon_penanggung_jawab), true)}
              {renderRow("Jenis Jaminan", formatFieldValue(modalPatient?.jenis_jaminan))}
              {renderRow("No BPJS", formatFieldValue(modalPatient?.no_bpjs || visit.registration?.bpjs_number), true)}
              {renderRow("Kelas / Faskes 1", `${formatFieldValue(modalPatient?.kelas_bpjs)} / ${formatFieldValue(modalPatient?.faskes_tingkat_1)}`)}
              {renderRow("Asuransi / Polis", `${formatFieldValue(modalPatient?.nama_asuransi || visit.registration?.insurance_name)} / ${formatFieldValue(modalPatient?.no_polis_asuransi)}`)}
            </div>
          </section>

        </div>

        {/* Right Column */}
        <div className="flex-1 p-6 space-y-8 bg-muted/10">

          <section>
            <h3 className="font-semibold text-[13px] uppercase tracking-wider text-foreground border-l-2 border-primary pl-2 mb-4">
              Kunjungan dan Layanan
            </h3>
            <div>
              {renderRow("Ruangan", visit.room?.name)}
              {renderRow("DPJP", (
                <button type="button" className="font-medium text-primary hover:underline underline-offset-2" onClick={handleOpenDpjpEditor}>
                  {visit.doctor?.nama_lengkap || "Pilih DPJP"}
                </button>
              ))}
              {renderRow("Pembayaran", paymentLabel)}
              {visit.room_queue?.queue_number && renderRow("No. Antrian", visit.room_queue.queue_number, true)}
              {renderRow("Waktu Check-in", formatDateTimeValue(visit.check_in_time))}
              {renderRow("Waktu Masuk", formatDateTimeValue(visit.admission_time))}
              {renderRow("Waktu Pulang", formatDateTimeValue(visit.discharge_time))}

              {sepInfo && (
                <>
                  <div className="my-4 border-t border-border/50" />
                  {renderRow("No. SEP", sepInfo.no_sep, true)}
                  {renderRow("Poli SEP", sepInfo.nama_poli)}
                  {renderRow("DPJP SEP", sepInfo.nama_dpjp)}
                </>
              )}

              {visit.registration?.complaint && (
                <div className="mt-5 p-4 rounded-md bg-background border shadow-sm">
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Keluhan Pasien</p>
                  <p className="text-sm leading-relaxed">{visit.registration.complaint}</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-[13px] uppercase tracking-wider text-foreground border-l-2 border-primary pl-2">
                Riwayat Medis Penting
              </h3>
              {loadingAllergies && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />}
            </div>

            {hasAllergies && (
              <div className="mb-5">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Alergi Terdaftar</p>
                <div className="space-y-2">
                  {hasAllergyRecords && patientAllergies.map((allergy) => (
                    <div key={allergy.id} className="flex gap-2 items-start text-sm bg-background border shadow-sm p-2.5 rounded-md">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4.5 rounded-sm font-medium border-none", allergy.criticality === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30")}>
                        {ALLERGY_CRITICALITY_LABELS[allergy.criticality]}
                      </Badge>
                      <span className="flex-1 leading-snug">
                        <span className="text-muted-foreground">{ALLERGY_CATEGORY_LABELS[allergy.category]}:</span>{" "}
                        <span className="font-medium">{allergy.snomed_display}</span>
                        {allergy.notes && <span className="text-muted-foreground ml-1">({allergy.notes})</span>}
                      </span>
                    </div>
                  ))}
                  {!hasAllergyRecords && hasLegacyAllergies && (
                    <div className="space-y-1.5 text-sm bg-background border shadow-sm p-3 rounded-md">
                      {modalPatient?.alergi_obat && <div className="flex gap-2"><AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /><span><span className="text-muted-foreground">Obat:</span> <span className="font-medium">{modalPatient.alergi_obat}</span></span></div>}
                      {modalPatient?.alergi_makanan && <div className="flex gap-2"><AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /><span><span className="text-muted-foreground">Makanan:</span> <span className="font-medium">{modalPatient.alergi_makanan}</span></span></div>}
                      {modalPatient?.alergi_lainnya && <div className="flex gap-2"><AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /><span><span className="text-muted-foreground">Lainnya:</span> <span className="font-medium">{modalPatient.alergi_lainnya}</span></span></div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              {renderRow("Penyakit Kronis", formatFieldValue(modalPatient?.penyakit_kronis))}
              {renderRow("Riwayat Operasi", formatFieldValue(modalPatient?.riwayat_operasi))}
              {renderRow("Obat Rutin", formatFieldValue(modalPatient?.obat_rutin))}
              {renderRow("Disabilitas", formatFieldValue(modalPatient?.disabilitas))}
              {renderRow("Catatan Khusus", formatFieldValue(modalPatient?.catatan_khusus))}
            </div>
          </section>

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
            <div className="flex items-start gap-2.5 py-2">
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
