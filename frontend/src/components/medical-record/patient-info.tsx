import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ChevronUp,
  MessageSquare,
} from "lucide-react";

interface PatientInfoProps {
  visit: {
    id: number;
    visit_number: string;
    visit_type: string;
    status: string;
    check_in_time?: string;
    registration?: {
      registration_number: string;
      payment_method?: string;
      bpjs_number?: string;
      insurance_name?: string;
      complaint?: string;
      patient?: {
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

export function PatientInfo({ visit }: PatientInfoProps) {
  const patient = visit.registration?.patient;
  const hasAllergies =
    patient?.alergi_obat || patient?.alergi_makanan || patient?.alergi_lainnya;
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader
        className="border-b bg-muted/30 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {patient?.nama_lengkap || "-"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {patient?.no_rm || "-"}
                </Badge>
                <Badge
                  variant={
                    patient?.jenis_kelamin === "L" ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {patient?.jenis_kelamin === "L"
                    ? "Laki-laki"
                    : patient?.jenis_kelamin === "P"
                    ? "Perempuan"
                    : "-"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAllergies && (
              <Badge variant="destructive" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alergi
              </Badge>
            )}
            <div className="flex items-center justify-center h-8 w-8">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="p-3">
          {hasAllergies && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="font-semibold mb-1">
                  Perhatian: Pasien Memiliki Alergi
                </div>
                <div className="space-y-0.5 text-xs">
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
              {visit.check_in_time && (
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
