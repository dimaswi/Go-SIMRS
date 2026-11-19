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
  User,
} from "lucide-react";
import { patientAllergyApi, ALLERGY_CATEGORY_LABELS, api, bpjsApi, patientsApi } from "@/lib/api";
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
  variant?: "default" | "compact" | "header-trigger";
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

  const renderCompactRow = (label: string, value: React.ReactNode, isMono = false) => (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800/80 py-1 text-[11px] last:border-b-0">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right font-medium text-neutral-900 dark:text-neutral-100 break-words",
          isMono && "font-mono"
        )}
      >
        {value ? value : <span className="text-neutral-400">-</span>}
      </span>
    </div>
  );

  const formattedModalName =
    formatPatientName(
      modalPatient?.nama_lengkap,
      modalPatient?.jenis_kelamin,
      modalPatient?.status_perkawinan,
      modalPatient?.tanggal_lahir
    ) || "-";
  const modalGenderLabel =
    modalPatient?.jenis_kelamin === "L"
      ? "Laki-laki"
      : modalPatient?.jenis_kelamin === "P"
      ? "Perempuan"
      : "-";
  const modalAgeLabel = modalPatient?.tanggal_lahir
    ? `${calculateAge(modalPatient.tanggal_lahir)} thn`
    : "";

  const alamatKtpText = formatFullAddress(
    modalPatient?.alamat_ktp,
    modalPatient?.kelurahan_ktp,
    modalPatient?.kecamatan_ktp,
    modalPatient?.kota_ktp,
    modalPatient?.provinsi_ktp,
    modalPatient?.kode_pos_ktp,
    modalPatient?.rt_ktp,
    modalPatient?.rw_ktp
  );
  const alamatDomisiliText = formatFullAddress(
    modalPatient?.alamat_domisili,
    modalPatient?.kelurahan_domisili,
    modalPatient?.kecamatan_domisili,
    modalPatient?.kota_domisili,
    modalPatient?.provinsi_domisili,
    modalPatient?.kode_pos_domisili,
    modalPatient?.rt_domisili,
    modalPatient?.rw_domisili
  );

  const patientDetailContent = (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-neutral-950 overflow-hidden">
      {loadingPatientDetail && (
        <div className="shrink-0 flex items-center justify-center gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 py-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Memuat data lengkap pasien...
        </div>
      )}

      {/* Top Compact Metadata Strip */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2">
        <div className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-2.5 first:border-l-0 first:pl-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">No. Kunjungan</p>
          <p className="font-mono text-xs font-bold text-foreground">{visit.visit_number || "-"}</p>
        </div>
        <div className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">No. Pendaftaran</p>
          <p className="font-mono text-xs font-bold text-foreground">{visit.registration?.registration_number || "-"}</p>
        </div>
        <div className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Kategori / Pembayaran</p>
          <p className="text-xs font-semibold text-foreground">
            {getVisitCategoryLabel(visit)} • {paymentLabel}
            {visit.room_queue?.queue_number ? ` • ${visit.room_queue.queue_number}` : ""}
          </p>
        </div>
        <div className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Status Kunjungan</p>
          <div>{getStatusBadge(visit.status, true)}</div>
        </div>
      </div>

      {/* Zero-Scroll Dense 3-Column Body on Desktop */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Column 1: Identitas & Kontak */}
          <div className="flex flex-col gap-3.5 border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/20 dark:bg-neutral-900/10">
            <section className="space-y-1">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Identitas Pasien
                </h3>
                {patientId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 rounded-none px-2 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/patients/${patientId}/edit`);
                    }}
                  >
                    <SquarePen className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              {renderCompactRow("NIK", formatFieldValue(modalPatient?.nik), true)}
              {renderCompactRow(
                "TTL / Usia",
                modalPatient?.tanggal_lahir
                  ? `${formatFieldValue(modalPatient?.tempat_lahir)}, ${formatDateValue(modalPatient.tanggal_lahir)} (${calculateAge(modalPatient.tanggal_lahir)} thn)`
                  : "-"
              )}
              {renderCompactRow(
                "Gol. Darah",
                modalPatient?.golongan_darah
                  ? `${modalPatient.golongan_darah}${modalPatient?.rhesus ? ` (${modalPatient.rhesus})` : ""}`
                  : "-"
              )}
              {renderCompactRow("Agama", formatFieldValue(modalPatient?.agama))}
              {renderCompactRow("Pendidikan", formatFieldValue(modalPatient?.pendidikan_terakhir))}
              {renderCompactRow("Pekerjaan", formatFieldValue(modalPatient?.pekerjaan))}
              {renderCompactRow("Kewarganegaraan", formatFieldValue(modalPatient?.kewarganegaraan))}
              {renderCompactRow(
                "Suku / Bahasa",
                `${formatFieldValue(modalPatient?.suku)} / ${formatFieldValue(modalPatient?.bahasa)}`
              )}
            </section>

            <section className="space-y-1">
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Kontak
                </h3>
              </div>
              {renderCompactRow("No. HP", formatFieldValue(modalPatient?.no_hp), true)}
              {renderCompactRow("Telepon Rumah", formatFieldValue(modalPatient?.no_telepon), true)}
              {renderCompactRow("HP Alternatif", formatFieldValue(modalPatient?.no_hp_alternatif), true)}
              {renderCompactRow("Email", formatFieldValue(modalPatient?.email))}
            </section>
          </div>

          {/* Column 2: Alamat, Penanggung Jawab & Jaminan */}
          <div className="flex flex-col gap-3.5 border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/20 dark:bg-neutral-900/10">
            <section className="space-y-1.5">
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Alamat
                </h3>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Alamat KTP</div>
                  <div className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
                    {alamatKtpText.replace(/\n+/g, ", ")}
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Alamat Domisili</div>
                  <div className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
                    {alamatDomisiliText.replace(/\n+/g, ", ")}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-1">
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Penanggung Jawab
                </h3>
              </div>
              {renderCompactRow("Nama PJ", formatFieldValue(modalPatient?.nama_penanggung_jawab))}
              {renderCompactRow("Hubungan", formatFieldValue(modalPatient?.hubungan_penanggung_jawab))}
              {renderCompactRow("NIK PJ", formatFieldValue(modalPatient?.nik_penanggung_jawab), true)}
              {renderCompactRow("Telepon PJ", formatFieldValue(modalPatient?.telepon_penanggung_jawab), true)}
            </section>

            <section className="space-y-1">
              <div className="border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Jaminan
                </h3>
              </div>
              {renderCompactRow("Jenis Jaminan", formatFieldValue(modalPatient?.jenis_jaminan))}
              {renderCompactRow("No. BPJS", formatFieldValue(modalPatient?.no_bpjs || visit.registration?.bpjs_number), true)}
              {renderCompactRow(
                "Kelas / Faskes 1",
                `${formatFieldValue(modalPatient?.kelas_bpjs)} / ${formatFieldValue(modalPatient?.faskes_tingkat_1)}`
              )}
              {renderCompactRow(
                "Asuransi / Polis",
                `${formatFieldValue(modalPatient?.nama_asuransi || visit.registration?.insurance_name)} / ${formatFieldValue(modalPatient?.no_polis_asuransi)}`
              )}
            </section>
          </div>

          {/* Column 3: Kunjungan, Layanan & Riwayat Medis Penting */}
          <div className="flex flex-col gap-3.5 border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/20 dark:bg-neutral-900/10">
            <section className="space-y-1">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Kunjungan &amp; Layanan
                </h3>
                {currentRoomId > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 rounded-none px-2 text-[10px]"
                    onClick={handleOpenDpjpEditor}
                  >
                    <SquarePen className="h-3 w-3 mr-1" />
                    Ubah DPJP
                  </Button>
                )}
              </div>
              {renderCompactRow("Ruangan", visit.room?.name)}
              {renderCompactRow(
                "Dokter DPJP",
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline underline-offset-2 text-right"
                  onClick={handleOpenDpjpEditor}
                >
                  {visit.doctor?.nama_lengkap || "Pilih DPJP"}
                </button>
              )}
              {renderCompactRow("Waktu Check-in", formatDateTimeValue(visit.check_in_time), true)}
              {renderCompactRow("Waktu Masuk", formatDateTimeValue(visit.admission_time), true)}
              {visit.discharge_time && renderCompactRow("Waktu Pulang", formatDateTimeValue(visit.discharge_time), true)}
              {sepInfo && (
                <>
                  {renderCompactRow("No. SEP", sepInfo.no_sep, true)}
                  {renderCompactRow("Poli / DPJP SEP", `${sepInfo.nama_poli || "-"} • ${sepInfo.nama_dpjp || "-"}`)}
                </>
              )}
              {visit.registration?.complaint && (
                <div className="mt-1.5 border-l-2 border-neutral-900 dark:border-white bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground mr-1.5">Keluhan:</span>
                  <span className="text-foreground">{visit.registration.complaint}</span>
                </div>
              )}
            </section>

            <section className="space-y-1">
              <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-1.5 mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Riwayat Medis Penting
                </h3>
                {loadingAllergies && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>

              {hasAllergies && (
                <div className="flex flex-wrap gap-1 pb-1">
                  {hasAllergyRecords &&
                    patientAllergies.map((allergy) => (
                      <Badge
                        key={allergy.id}
                        variant="outline"
                        className={cn(
                          "rounded-none h-5 px-1.5 text-[10px] font-medium border",
                          allergy.criticality === "high"
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                        )}
                      >
                        {ALLERGY_CATEGORY_LABELS[allergy.category]}: {allergy.snomed_display}
                      </Badge>
                    ))}
                  {!hasAllergyRecords && hasLegacyAllergies && (
                    <Badge variant="outline" className="rounded-none h-5 px-1.5 text-[10px] border-amber-300 bg-amber-50 text-amber-800">
                      {[modalPatient?.alergi_obat, modalPatient?.alergi_makanan, modalPatient?.alergi_lainnya].filter(Boolean).join(", ")}
                    </Badge>
                  )}
                </div>
              )}

              {renderCompactRow("Penyakit Kronis", formatFieldValue(modalPatient?.penyakit_kronis))}
              {renderCompactRow("Riwayat Operasi", formatFieldValue(modalPatient?.riwayat_operasi))}
              {renderCompactRow("Obat Rutin", formatFieldValue(modalPatient?.obat_rutin))}
              {renderCompactRow("Disabilitas", formatFieldValue(modalPatient?.disabilitas))}
              {renderCompactRow("Catatan Khusus", formatFieldValue(modalPatient?.catatan_khusus))}
            </section>
          </div>
        </div>
      </div>

      {/* Pinned Footer */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5">
        <div className="text-[11px] font-mono text-muted-foreground">
          No. RM: {modalPatient?.no_rm || "-"}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-none px-5 text-xs font-semibold"
          onClick={() => setPatientDetailOpen(false)}
        >
          Tutup
        </Button>
      </div>
    </div>
  );

  const modalsBlock = (
    <>
      <Dialog open={patientDetailOpen} onOpenChange={setPatientDetailOpen}>
        <DialogContent className="w-[95vw] max-w-7xl max-h-[92vh] overflow-hidden rounded-none p-0 flex flex-col gap-0">
          <DialogHeader className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
                {getInitials(modalPatient?.nama_lengkap)}
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight truncate">
                  {formattedModalName}
                </DialogTitle>
                <p className="text-[11px] font-mono text-muted-foreground">
                  No. RM: {modalPatient?.no_rm || "-"} • {modalGenderLabel}
                  {modalAgeLabel ? ` • ${modalAgeLabel}` : ""}
                </p>
              </div>
            </div>
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
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 gap-0 rounded-none">
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

  if (variant === "header-trigger") {
    return (
      <>
        <div className="flex items-center gap-1.5">
          {hasAllergies && (
            <Badge
              variant="destructive"
              className="h-8 w-8 justify-center rounded-none p-0"
              title="Pasien memiliki riwayat alergi"
              aria-label="Pasien memiliki riwayat alergi"
            >
              <AlertTriangle className="h-4 w-4" />
            </Badge>
          )}
          {sepInfo && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={handleICareOpen}
              disabled={icareLoading}
              title="BPJS I-Care"
              aria-label="BPJS I-Care"
            >
              {icareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={() => setPatientDetailOpen(true)}
            title="Detail Pasien"
            aria-label="Detail Pasien"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
        {modalsBlock}
      </>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <div className="flex flex-col bg-transparent">
          <div
            className="cursor-pointer px-3 py-2.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-900/50"
            onClick={() => setPatientDetailOpen(true)}
            title="Klik untuk melihat detail pasien & kunjungan"
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-neutral-900 dark:bg-white text-xs font-bold text-white dark:text-neutral-900">
                {getInitials(patient?.nama_lengkap)}
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="line-clamp-2 text-xs font-bold leading-tight text-neutral-900 dark:text-white">
                  {formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, patient?.status_perkawinan, patient?.tanggal_lahir)}
                </h3>
                <p className="font-mono text-[11px] text-muted-foreground">{patient?.no_rm || "-"}</p>
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

            <div className="mt-2.5 grid grid-cols-[62px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 border-t border-neutral-200 dark:border-neutral-800 pt-2 text-[11px]">
              <span className="text-muted-foreground">Ruangan</span>
              <span className="truncate text-right font-medium">{visit.room?.name || "-"}</span>
              <span className="text-muted-foreground">Dokter</span>
              <span className="truncate text-right font-medium">{visit.doctor?.nama_lengkap || "-"}</span>
              <span className="text-muted-foreground">Status</span>
              <div className="flex justify-end">{getStatusBadge(visit.status, true)}</div>
            </div>

            {(hasAllergies || sepInfo || isPatientDischarged) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {hasAllergies && (
                  <Badge variant="destructive" className="h-5 gap-1 rounded-none px-1.5 py-0 text-[10px]">
                    <AlertTriangle className="h-3 w-3" />
                    Alergi
                  </Badge>
                )}
                {sepInfo && (
                  <Badge variant="outline" className="h-5 gap-1 rounded-none px-1.5 py-0 text-[10px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    SEP
                  </Badge>
                )}
                {isPatientDischarged && (
                  <Badge variant="secondary" className="h-5 rounded-none px-1.5 py-0 text-[10px]">Selesai</Badge>
                )}
              </div>
            )}
          </div>
        </div>
        {modalsBlock}
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
