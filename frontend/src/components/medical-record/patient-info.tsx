import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Calendar,
  Phone,
  MapPin,
  Droplet,
  AlertTriangle,
  Pill,
  ChevronDown,
  MessageSquare,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { patientAllergyApi, ALLERGY_CATEGORY_LABELS, ALLERGY_CRITICALITY_LABELS, api } from "@/lib/api";
import type { PatientAllergy } from "@/lib/api";
import { MedicalRecordPrintSelect } from "./print-select";

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
    check_in_time?: string;
    admission_time?: string;
    discharge_time?: string;
    referral_from?: number; // For consultation orders
    registration?: {
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
      };
    };
    room?: {
      code: string;
      name: string;
      type?: string;
      service_type?: string;
    };
    doctor?: {
      nama_lengkap: string;
    };
    room_queue?: {
      queue_number: string;
      priority: string;
    };
  };
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

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; label: string }> = {
    waiting: { variant: "secondary", label: "Menunggu" },
    in_queue: { variant: "default", label: "Dalam Antrian" },
    in_progress: { variant: "default", label: "Sedang Dilayani" },
    completed: { variant: "outline", label: "Selesai" },
    cancelled: { variant: "destructive", label: "Dibatalkan" },
  };
  const config = variants[status] || { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getPriorityBadge = (priority?: string) => {
  if (!priority) return null;
  const variants: Record<string, { variant: any; label: string }> = {
    normal: { variant: "outline", label: "Normal" },
    urgent: { variant: "default", label: "Mendesak" },
    emergency: { variant: "destructive", label: "Darurat" },
  };
  const config = variants[priority] || { variant: "outline", label: priority };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

// Get visit category label based on visit_type and service_type
const getVisitCategoryLabel = (visit: PatientInfoProps["visit"]) => {
  const serviceType = visit.room?.service_type;
  const visitType = visit.visit_type;
  const hasReferral = !!visit.referral_from;

  if (visitType === "pharmacy") return "Farmasi";
  if (visitType === "radiology") return "Radiologi";
  if (visitType === "lab") return "Laboratorium";
  if (visitType === "consultation" && hasReferral) return "Konsultasi";
  if (visitType === "surgery") return "Operasi";
  if (serviceType === "gawat_darurat" || visitType === "emergency") return "UGD";
  if (serviceType === "rawat_inap" || visitType === "inpatient") return "Rawat Inap";
  if (serviceType === "rawat_jalan" || visitType === "outpatient") return "Rawat Jalan";
  if (visitType === "consultation") return "Konsultasi";
  return visitType || "Kunjungan";
};

export function PatientInfo({ visit }: PatientInfoProps) {
  const navigate = useNavigate();
  
  const patient = visit.registration?.patient;
  const patientId = patient?.id;
  
  // Patient allergies from dedicated allergy table
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergy[]>([]);
  const [loadingAllergies, setLoadingAllergies] = useState(false);
  
  // SEP Info
  const [sepInfo, setSepInfo] = useState<SEPInfo | null>(null);
  
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
  const hasLegacyAllergies = patient?.alergi_obat || patient?.alergi_makanan || patient?.alergi_lainnya;
  const hasAllergies = hasAllergyRecords || hasLegacyAllergies;
  
  const [isOpen, setIsOpen] = useState(false);
  
  // Check if this is inpatient visit
  const isInpatient = visit.room?.service_type === "rawat_inap" || visit.visit_type === "inpatient";
  
  // Check if this is emergency (UGD) visit
  const isEmergency = visit.room?.service_type === "igd" || 
                      visit.room?.type === "igd" || 
                      visit.room?.type === "emergency" ||
                      visit.visit_type === "emergency";
  
  // Check if patient is discharged
  const isPatientDischarged = visit.registration?.status === "completed" || 
                              visit.registration?.status === "discharged" ||
                              visit.status === "completed";

  return (
    <Card className="border-none shadow-none">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors hover:bg-muted/40 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); navigate("/visits"); }}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted flex-shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">
                {patient?.nama_lengkap || "-"}
              </h3>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                {patient?.no_rm || "-"}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
              <span>{patient?.jenis_kelamin === "L" ? "L" : patient?.jenis_kelamin === "P" ? "P" : "-"}</span>
              {patient?.tanggal_lahir && (
                <><span className="text-muted-foreground/50">·</span><span>{calculateAge(patient.tanggal_lahir)} thn</span></>
              )}
              <span className="text-muted-foreground/50">·</span>
              <span>#{visit.visit_number}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{getVisitCategoryLabel(visit)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* SEP Badge */}
          {sepInfo && (
            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5">
              <ShieldCheck className="h-3 w-3" />
              SEP
            </Badge>
          )}
          {isPatientDischarged && (
            <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0 h-5">
              Selesai
            </Badge>
          )}
          {hasAllergies && (
            <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0 h-5">
              <AlertTriangle className="h-3 w-3" />
              Alergi
            </Badge>
          )}
          {/* Print Select Dropdown */}
          <div onClick={(e) => e.stopPropagation()}>
            <MedicalRecordPrintSelect
              visitId={visit.id}
              isInpatient={isInpatient}
              isEmergency={isEmergency}
            />
          </div>
          <div className="flex items-center justify-center h-7 w-7 rounded-md border text-muted-foreground transition-transform duration-200">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0">
          {/* Allergy Alert Section */}
          {loadingAllergies ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground mb-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Memuat data alergi...</span>
            </div>
          ) : hasAllergies && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="font-semibold mb-1">
                  Perhatian: Pasien Memiliki Alergi
                </div>
                <div className="space-y-1.5 text-xs">
                  {/* Allergies from database (SNOMED CT coded) */}
                  {hasAllergyRecords && (
                    <div className="space-y-1">
                      {patientAllergies.map((allergy) => (
                        <div key={allergy.id} className="flex gap-1.5 items-start">
                          <Badge 
                            variant={allergy.criticality === 'high' ? 'destructive' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                          >
                            {ALLERGY_CRITICALITY_LABELS[allergy.criticality]}
                          </Badge>
                          <span>
                            <strong>{ALLERGY_CATEGORY_LABELS[allergy.category]}:</strong>{" "}
                            {allergy.snomed_display}
                            {allergy.notes && <span className="text-muted-foreground"> ({allergy.notes})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Legacy allergies from master data (fallback, show only if no records from DB) */}
                  {!hasAllergyRecords && hasLegacyAllergies && (
                    <>
                      {patient?.alergi_obat && (
                        <div className="flex gap-1.5">
                          <Pill className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Obat:</strong> {patient.alergi_obat}
                          </span>
                        </div>
                      )}
                      {patient?.alergi_makanan && (
                        <div className="flex gap-1.5">
                          <span className="text-sm mt-0.5">🍽️</span>
                          <span>
                            <strong>Makanan:</strong> {patient.alergi_makanan}
                          </span>
                        </div>
                      )}
                      {patient?.alergi_lainnya && (
                        <div className="flex gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Lainnya:</strong> {patient.alergi_lainnya}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Column 1: Demographic Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Data Demografis
              </h4>
              {patient?.tanggal_lahir && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Tanggal Lahir / Usia
                  </label>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {new Date(patient.tanggal_lahir).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}{" "}
                      ({calculateAge(patient.tanggal_lahir)} tahun)
                    </span>
                  </div>
                </div>
              )}
              {(patient?.golongan_darah || patient?.rhesus) && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Golongan Darah
                  </label>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Droplet className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {patient?.golongan_darah || "-"}{" "}
                      {patient?.rhesus ? `(${patient.rhesus})` : ""}
                    </span>
                  </div>
                </div>
              )}
              {(patient?.no_hp || patient?.no_telepon) && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Kontak
                  </label>
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {patient?.no_hp || patient?.no_telepon}
                    </span>
                  </div>
                </div>
              )}
              {patient?.alamat_ktp && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Alamat
                  </label>
                  <div className="flex items-start gap-1.5 text-muted-foreground mt-0.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="text-xs line-clamp-3">
                      {patient.alamat_ktp}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Visit Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Informasi Kunjungan
              </h4>
              <div>
                <label className="text-xs text-muted-foreground">
                  No. Kunjungan
                </label>
                <p className="font-mono text-xs font-medium mt-0.5">
                  {visit.visit_number}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  No. Pendaftaran
                </label>
                <p className="font-mono text-xs font-medium mt-0.5">
                  {visit.registration?.registration_number || "-"}
                </p>
              </div>
              {visit.room_queue?.queue_number && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    No. Antrian
                  </label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-mono text-xs font-medium">
                      {visit.room_queue.queue_number}
                    </p>
                    {getPriorityBadge(visit.room_queue.priority)}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-0.5">{getStatusBadge(visit.status)}</div>
              </div>
              {!isInpatient && visit.check_in_time && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Check-in
                  </label>
                  <p className="text-xs font-medium mt-0.5">
                    {new Date(visit.check_in_time).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {(isInpatient && visit.admission_time) && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Tanggal Masuk Rawat Inap
                  </label>
                  <p className="text-xs font-medium mt-0.5">
                    {new Date(visit.admission_time).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {(isInpatient && visit.discharge_time) && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Tanggal Keluar Rawat Inap
                  </label>
                  <p className="text-xs font-medium mt-0.5 text-green-600 dark:text-green-400">
                    {new Date(visit.discharge_time).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Column 3: Medical Service Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Layanan Medis
              </h4>
              <div>
                <label className="text-xs text-muted-foreground">Ruangan</label>
                <p className="text-xs font-medium mt-0.5">
                  {visit.room?.code} - {visit.room?.name || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dokter</label>
                <p className="text-xs font-medium mt-0.5">
                  {visit.doctor?.nama_lengkap || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Metode Pembayaran
                </label>
                <p className="text-xs font-medium mt-0.5">
                  {visit.registration?.payment_method === "bpjs"
                    ? "BPJS"
                    : visit.registration?.payment_method === "insurance"
                    ? "Asuransi"
                    : visit.registration?.payment_method === "cash"
                    ? "Tunai"
                    : "-"}
                </p>
              </div>
              {visit.registration?.payment_method === "bpjs" &&
                visit.registration?.bpjs_number && (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      No. BPJS
                    </label>
                    <p className="font-mono text-xs font-medium mt-0.5">
                      {visit.registration.bpjs_number}
                    </p>
                  </div>
                )}
              {/* SEP Info */}
              {sepInfo && (
                <div className="mt-2 p-2 rounded-md bg-muted/50 border">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">SEP</span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <label className="text-[10px] text-muted-foreground">No. SEP</label>
                      <p className="font-mono text-xs font-bold">
                        {sepInfo.no_sep}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Poli</label>
                        <p className="text-[11px] font-medium">{sepInfo.nama_poli || '-'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">DPJP</label>
                        <p className="text-[11px] font-medium">{sepInfo.nama_dpjp || '-'}</p>
                      </div>
                    </div>
                    {sepInfo.nama_diagnosa && (
                      <div>
                        <label className="text-[10px] text-muted-foreground">Diagnosa</label>
                        <p className="text-[11px] font-medium">{sepInfo.nama_diagnosa}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {visit.registration?.payment_method === "insurance" &&
                visit.registration?.insurance_name && (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Nama Asuransi
                    </label>
                    <p className="text-xs font-medium mt-0.5">
                      {visit.registration.insurance_name}
                    </p>
                  </div>
                )}
            </div>

            {/* Column 4: Medical History */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Riwayat Medis
              </h4>
              {visit.registration?.complaint && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Keluhan Utama
                  </label>
                  <div className="flex items-start gap-1.5 mt-0.5">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      {visit.registration.complaint}
                    </span>
                  </div>
                </div>
              )}
              {!visit.registration?.complaint && (
                <p className="text-xs text-muted-foreground italic">
                  Tidak ada keluhan yang dicatat
                </p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
