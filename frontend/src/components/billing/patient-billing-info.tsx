import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User,
  Calendar,
  Phone,
  MapPinned,
  ChevronDown,
  ArrowLeft,
  Droplet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface PatientBillingInfoProps {
  visit: any;
  billing?: any;
  actionButtons?: React.ReactNode;
}

const visitStatusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const billingStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
};

export function PatientBillingInfo({ visit, billing, actionButtons }: PatientBillingInfoProps) {
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
    <Card className="border-none shadow-none">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors hover:bg-muted/40 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); navigate("/billing"); }}
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
              <span>#{visit?.visit_number}</span>
              {billing && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    {billingStatusLabels[billing?.status] || billing?.status}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actionButtons && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {actionButtons}
            </div>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {visitStatusLabels[visit?.status] || visit?.status}
          </Badge>
          <div className="flex items-center justify-center h-7 w-7 rounded-md border text-muted-foreground transition-transform duration-200">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pt-3 border-t">
            {/* Column 1: Demographic Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                <p className="text-xs font-medium mt-0.5">
                  {visitStatusLabels[visit?.status] || visit?.status}
                </p>
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                <p className="text-xs font-medium mt-0.5">
                  {visit?.registration?.payment_method === "bpjs"
                    ? "BPJS"
                    : visit?.registration?.payment_method === "insurance"
                    ? "Asuransi"
                    : visit?.registration?.payment_method === "cash"
                    ? "Tunai"
                    : "-"}
                </p>
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                    <p className="text-xs font-medium mt-0.5">
                      {billingStatusLabels[billing?.status] || billing?.status}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Total Tagihan
                    </label>
                    <p className="text-xs font-bold mt-0.5">
                      {formatCurrency(billing.final_amount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Terbayar
                    </label>
                    <p className="text-xs font-medium mt-0.5">
                      {formatCurrency(billing.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Sisa
                    </label>
                    <p className="text-xs font-bold mt-0.5">
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
