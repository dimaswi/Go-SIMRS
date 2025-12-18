import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User,
  Calendar,
  Phone,
  MapPinned,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Droplet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface PatientBillingInfoProps {
  visit: any;
  billing?: any;
}

const visitStatusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const visitStatusColors: Record<string, string> = {
  waiting: 'bg-yellow-500 text-black',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const billingStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
};

const billingStatusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending: 'bg-yellow-500 text-black',
  partial: 'bg-blue-500',
  paid: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export function PatientBillingInfo({ visit, billing }: PatientBillingInfoProps) {
  const navigate = useNavigate();
  const patient = visit?.registration?.patient;
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy', { locale: id });
    } catch {
      return '-';
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    try {
      const birth = parseISO(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="border-none shadow-none relative">
      <CardHeader className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate("/billing")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <User className="h-5 w-5 text-primary" />
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity flex-1"
              onClick={() => setIsOpen(!isOpen)}
            >
              <h3 className="text-base font-semibold">
                {patient?.nama_lengkap || "-"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">Kunjungan #{visit?.visit_number}</span>
                <span className="text-muted-foreground">•</span>
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
                {billing && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <Badge className={`text-xs ${billingStatusColors[billing?.status] || ''}`}>
                      {billingStatusLabels[billing?.status] || billing?.status}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${visitStatusColors[visit?.status] || ''}`}>
              {visitStatusLabels[visit?.status] || visit?.status}
            </Badge>
            <div 
              className="flex items-center justify-center h-8 w-8 cursor-pointer hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
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
        <CardContent className="p-3 absolute left-0 right-0 top-full z-50 bg-background border-b shadow-lg">
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
                      {formatDate(patient.tanggal_lahir)}{" "}
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
              {(patient?.alamat_ktp || patient?.alamat) && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Alamat
                  </label>
                  <div className="flex items-start gap-1.5 text-muted-foreground mt-0.5">
                    <MapPinned className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="text-xs line-clamp-3">
                      {patient?.alamat_ktp || patient?.alamat}
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
                  {visit?.visit_number}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  No. Pendaftaran
                </label>
                <p className="font-mono text-xs font-medium mt-0.5">
                  {visit?.registration?.registration_number || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status Kunjungan</label>
                <div className="mt-0.5">
                  <Badge className={visitStatusColors[visit?.status] || ''}>
                    {visitStatusLabels[visit?.status] || visit?.status}
                  </Badge>
                </div>
              </div>
              {visit?.start_time && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Waktu Masuk
                  </label>
                  <p className="text-xs font-medium mt-0.5">
                    {new Date(visit.start_time).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {visit?.end_time && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Waktu Keluar
                  </label>
                  <p className="text-xs font-medium mt-0.5">
                    {new Date(visit.end_time).toLocaleString("id-ID", {
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
                  {visit?.room?.code} - {visit?.room?.name || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dokter</label>
                <p className="text-xs font-medium mt-0.5">
                  {visit?.doctor?.nama_lengkap || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Metode Pembayaran
                </label>
                <div className="mt-0.5">
                  <Badge variant={visit?.registration?.payment_method === 'bpjs' ? 'default' : 'secondary'}>
                    {visit?.registration?.payment_method === "bpjs"
                      ? "BPJS"
                      : visit?.registration?.payment_method === "insurance"
                      ? "Asuransi"
                      : visit?.registration?.payment_method === "cash"
                      ? "Tunai"
                      : "-"}
                  </Badge>
                </div>
              </div>
              {visit?.registration?.payment_method === "bpjs" &&
                visit?.registration?.bpjs_number && (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      No. BPJS
                    </label>
                    <p className="font-mono text-xs font-medium mt-0.5">
                      {visit.registration.bpjs_number}
                    </p>
                  </div>
                )}
              {visit?.registration?.payment_method === "insurance" &&
                visit?.registration?.insurance_name && (
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

            {/* Column 4: Billing Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Informasi Tagihan
              </h4>
              {billing ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      No. Tagihan
                    </label>
                    <p className="font-mono text-xs font-medium mt-0.5">
                      {billing.billing_number}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Status Tagihan
                    </label>
                    <div className="mt-0.5">
                      <Badge className={billingStatusColors[billing?.status] || ''}>
                        {billingStatusLabels[billing?.status] || billing?.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Total Tagihan
                    </label>
                    <p className="text-xs font-bold mt-0.5 text-primary">
                      {formatCurrency(billing.final_amount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Terbayar
                    </label>
                    <p className="text-xs font-medium mt-0.5 text-green-600 dark:text-green-400">
                      {formatCurrency(billing.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Sisa
                    </label>
                    <p className="text-xs font-bold mt-0.5 text-orange-600 dark:text-orange-400">
                      {formatCurrency(billing.remaining_amount)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Tagihan belum dibuat
                </p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
