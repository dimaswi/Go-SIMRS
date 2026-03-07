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
  ChevronDown,
  MessageSquare,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Pencil,
  Stethoscope,
  SquarePen,
} from "lucide-react";
import { patientAllergyApi, ALLERGY_CATEGORY_LABELS, ALLERGY_CRITICALITY_LABELS, api, bpjsApi, visitsApi } from "@/lib/api";
import type { PatientAllergy } from "@/lib/api";
import { MedicalRecordPrintSelect } from "./print-select";
import { EditDoctorDialog } from "./edit-doctor-dialog";
import { useToast } from "@/hooks/use-toast";

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
  
  const { toast } = useToast();
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

  // Load all visits for this registration
  const registrationId = visit.registration_id || (visit.registration as any)?.id;
  
  const loadAllVisits = useCallback(async () => {
    if (!registrationId) return;
    setLoadingVisits(true);
    try {
      const response = await visitsApi.getAll({ registration_id: registrationId });
      const visits = response.data?.data || [];
      setAllVisits(Array.isArray(visits) ? visits : []);
    } catch (error) {
      console.error("Failed to load visits:", error);
    } finally {
      setLoadingVisits(false);
    }
  }, [registrationId]);

  useEffect(() => {
    loadAllVisits();
  }, [loadAllVisits]);
  
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

  // I-Care state
  const [icareOpen, setIcareOpen] = useState(false);
  const [icareUrl, setIcareUrl] = useState<string | null>(null);
  const [icareLoading, setIcareLoading] = useState(false);

  // All visits for this registration (for DPJP management)
  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [editDoctorOpen, setEditDoctorOpen] = useState(false);
  const [selectedVisitForEdit, setSelectedVisitForEdit] = useState<{ id: number; roomId: number; doctorId?: number | null } | null>(null);

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

  return (
    <div>
      {/* Header Bar */}
      <div
        className="flex items-center justify-between py-2 cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 min-w-0">
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">
                {patient?.nama_lengkap || "-"}
              </h3>
              <span className="font-mono text-[11px] text-muted-foreground flex-shrink-0">
                {patient?.no_rm || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
              <span>{patient?.jenis_kelamin === "L" ? "Laki-laki" : patient?.jenis_kelamin === "P" ? "Perempuan" : "-"}</span>
              {patient?.tanggal_lahir && (
                <><span className="text-muted-foreground/40">·</span><span>{calculateAge(patient.tanggal_lahir)} thn</span></>
              )}
              <span className="text-muted-foreground/40">·</span>
              <span>{getVisitCategoryLabel(visit)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Quick badges */}
          {hasAllergies && (
            <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0 h-5">
              <AlertTriangle className="h-3 w-3" />
              Alergi
            </Badge>
          )}
          {sepInfo && (
            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              SEP
            </Badge>
          )}
          {isPatientDischarged && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              Selesai
            </Badge>
          )}
          {/* I-Care Button (only for BPJS patients with SEP) */}
          {sepInfo && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleICareOpen}
                disabled={icareLoading}
              >
                {icareLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
                I-Care
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
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {isOpen && (
        <div className="border-t pt-4 pb-2 mt-1">
          {/* Allergy Alert */}
          {loadingAllergies ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground mb-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Memuat data alergi...</span>
            </div>
          ) : hasAllergies && (
            <div className="mb-4 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Alergi Pasien</span>
              </div>
              <div className="space-y-1 text-xs">
                {hasAllergyRecords && patientAllergies.map((allergy) => (
                  <div key={allergy.id} className="flex gap-1.5 items-start">
                    <Badge 
                      variant={allergy.criticality === 'high' ? 'destructive' : 'secondary'}
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
                    {patient?.alergi_obat && (
                      <div className="flex gap-1.5 text-foreground">
                        <Pill className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive/70" />
                        <span><strong>Obat:</strong> {patient.alergi_obat}</span>
                      </div>
                    )}
                    {patient?.alergi_makanan && (
                      <div className="flex gap-1.5 text-foreground">
                        <span className="text-sm mt-0.5">🍽️</span>
                        <span><strong>Makanan:</strong> {patient.alergi_makanan}</span>
                      </div>
                    )}
                    {patient?.alergi_lainnya && (
                      <div className="flex gap-1.5 text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive/70" />
                        <span><strong>Lainnya:</strong> {patient.alergi_lainnya}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-6 gap-y-4">
            {/* Column 1: Demographic */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Demografis
                </h4>
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
              <div className="space-y-2">
                {patient?.tanggal_lahir && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="text-xs">
                      {new Date(patient.tanggal_lahir).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} ({calculateAge(patient.tanggal_lahir)} tahun)
                    </span>
                  </div>
                )}
                {(patient?.golongan_darah || patient?.rhesus) && (
                  <div className="flex items-center gap-2">
                    <Droplet className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="text-xs">
                      Gol. {patient?.golongan_darah || "-"} {patient?.rhesus ? `(${patient.rhesus})` : ""}
                    </span>
                  </div>
                )}
                {(patient?.no_hp || patient?.no_telepon) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="text-xs">{patient?.no_hp || patient?.no_telepon}</span>
                  </div>
                )}
                {patient?.alamat_ktp && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
                    <span className="text-xs line-clamp-2">{patient.alamat_ktp}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Visit Info */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Kunjungan
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">No. Visit</span>
                  <span className="font-mono text-xs font-medium">{visit.visit_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">No. Daftar</span>
                  <span className="font-mono text-xs font-medium">{visit.registration?.registration_number || "-"}</span>
                </div>
                {visit.room_queue?.queue_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Antrian</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium">{visit.room_queue.queue_number}</span>
                      {getPriorityBadge(visit.room_queue.priority)}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  {getStatusBadge(visit.status)}
                </div>
                {!isInpatient && visit.check_in_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Check-in</span>
                    <span className="text-xs font-medium">
                      {new Date(visit.check_in_time).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {isInpatient && visit.admission_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Masuk RI</span>
                    <span className="text-xs font-medium">
                      {new Date(visit.admission_time).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {isInpatient && visit.discharge_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Keluar RI</span>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      {new Date(visit.discharge_time).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Medical Service */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Layanan
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ruangan</span>
                  <span className="text-xs font-medium">{visit.room?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Dokter</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate max-w-[120px]">{visit.doctor?.nama_lengkap || "-"}</span>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVisitForEdit({
                                id: visit.id,
                                roomId: (visit as any).room_id,
                                doctorId: (visit as any).doctor_id,
                              });
                              setEditDoctorOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ganti DPJP</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pembayaran</span>
                  <span className="text-xs font-medium">
                    {visit.registration?.payment_method === "bpjs" ? "BPJS"
                      : visit.registration?.payment_method === "insurance" ? "Asuransi"
                      : visit.registration?.payment_method === "cash" ? "Tunai"
                      : "-"}
                  </span>
                </div>
                {visit.registration?.payment_method === "bpjs" && visit.registration?.bpjs_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">No. BPJS</span>
                    <span className="font-mono text-xs font-medium">{visit.registration.bpjs_number}</span>
                  </div>
                )}
                {visit.registration?.payment_method === "insurance" && visit.registration?.insurance_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Asuransi</span>
                    <span className="text-xs font-medium">{visit.registration.insurance_name}</span>
                  </div>
                )}
                {/* SEP Info */}
                {sepInfo && (
                  <div className="mt-2 p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold">SEP</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">No. SEP</span>
                        <span className="font-mono text-[11px] font-bold">{sepInfo.no_sep}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Poli</span>
                        <span className="text-[11px] font-medium">{sepInfo.nama_poli || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">DPJP</span>
                        <span className="text-[11px] font-medium">{sepInfo.nama_dpjp || '-'}</span>
                      </div>
                      {sepInfo.nama_diagnosa && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Diagnosa</span>
                          <span className="text-[11px] font-medium">{sepInfo.nama_diagnosa}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 4: Complaint */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Keluhan
              </h4>
              {visit.registration?.complaint ? (
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary/70" />
                  <span className="text-xs leading-relaxed">
                    {visit.registration.complaint}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">
                  Tidak ada keluhan
                </p>
              )}
            </div>
          </div>

          {/* All Visits / DPJP Management */}
          {allVisits.length > 1 && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Kunjungan & DPJP
              </h4>
              {loadingVisits ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Memuat kunjungan...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allVisits.map((v) => {
                    const visitLabel = getVisitCategoryLabel(v);
                    const isCurrentVisit = v.id === visit.id;
                    const doctorName = v.doctor?.nama_lengkap || "-";
                    const roomName = v.room?.name || "-";
                    const visitStatus = v.status;
                    const statusLabel = visitStatus === "completed" ? "Selesai" : visitStatus === "in_progress" ? "Berlangsung" : visitStatus === "waiting" ? "Menunggu" : visitStatus === "in_queue" ? "Antrian" : visitStatus === "cancelled" ? "Dibatalkan" : visitStatus;

                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs ${
                          isCurrentVisit
                            ? "bg-primary/5 border border-primary/20"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{visitLabel}</span>
                              <span className="text-muted-foreground">—</span>
                              <span className="text-muted-foreground truncate">{roomName}</span>
                              {isCurrentVisit && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Saat ini</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                              <span>DPJP: <span className="text-foreground font-medium">{doctorName}</span></span>
                              <span className="text-muted-foreground/40">·</span>
                              <span>{statusLabel}</span>
                            </div>
                          </div>
                        </div>
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVisitForEdit({
                                    id: v.id,
                                    roomId: v.room_id,
                                    doctorId: v.doctor_id,
                                  });
                                  setEditDoctorOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ganti DPJP</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


        </div>
      )}

      {/* Edit Doctor Dialog */}
      {selectedVisitForEdit && (
        <EditDoctorDialog
          open={editDoctorOpen}
          onOpenChange={setEditDoctorOpen}
          visitId={selectedVisitForEdit.id}
          roomId={selectedVisitForEdit.roomId}
          currentDoctorId={selectedVisitForEdit.doctorId}
          onSuccess={() => {
            loadAllVisits();
            // Dispatch event to refresh visit data in parent
            window.dispatchEvent(new CustomEvent("refresh-visit-data"));
          }}
        />
      )}

      {/* I-Care Modal */}
      <Dialog open={icareOpen} onOpenChange={setIcareOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              BPJS I-Care — {patient?.nama_lengkap || "-"}
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
