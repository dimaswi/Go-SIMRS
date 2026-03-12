import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar,
  Phone,
  MapPinned,
  ChevronDown,
  ArrowLeft,
  Droplet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { formatPatientName } from "@/lib/print-utils";

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
            onClick={(e) => { e.stopPropagation(); navigate("/billing"); }}
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
                {formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, patient?.status_perkawinan, patient?.tanggal_lahir)}
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
              <span>#{visit?.visit_number}</span>
              {billing && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    {billingStatusLabels[billing?.status] || billing?.status}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actionButtons && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {actionButtons}
            </div>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {visitStatusLabels[visit?.status] || visit?.status}
          </Badge>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {isOpen && (
        <div className="border-t pt-4 pb-2 mt-1">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-6 gap-y-4">
            {/* Column 1: Demographic */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Demografis
              </h4>
              <div className="space-y-2">
                {patient?.tanggal_lahir && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="text-xs">
                      {formatDate(patient.tanggal_lahir)} ({calculateAge(patient.tanggal_lahir)} tahun)
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
                {(patient?.alamat_ktp || patient?.alamat) && (
                  <div className="flex items-start gap-2">
                    <MapPinned className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
                    <span className="text-xs line-clamp-2">{patient?.alamat_ktp || patient?.alamat}</span>
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
                  <span className="font-mono text-xs font-medium">{visit?.visit_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">No. Daftar</span>
                  <span className="font-mono text-xs font-medium">{visit?.registration?.registration_number || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span className="text-xs font-medium">{visitStatusLabels[visit?.status] || visit?.status}</span>
                </div>
                {visit?.start_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Masuk</span>
                    <span className="text-xs font-medium">
                      {new Date(visit.start_time).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {visit?.end_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Keluar</span>
                    <span className="text-xs font-medium">
                      {new Date(visit.end_time).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                  <span className="text-xs font-medium">{visit?.room?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Dokter</span>
                  <span className="text-xs font-medium truncate max-w-[140px]">{visit?.doctor?.nama_lengkap || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pembayaran</span>
                  <span className="text-xs font-medium">
                    {visit?.registration?.payment_method === "bpjs" ? "BPJS"
                      : visit?.registration?.payment_method === "insurance" ? "Asuransi"
                      : visit?.registration?.payment_method === "cash" ? "Tunai"
                      : "-"}
                  </span>
                </div>
                {visit?.registration?.payment_method === "bpjs" && visit?.registration?.bpjs_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">No. BPJS</span>
                    <span className="font-mono text-xs font-medium">{visit.registration.bpjs_number}</span>
                  </div>
                )}
                {visit?.registration?.payment_method === "insurance" && visit?.registration?.insurance_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Asuransi</span>
                    <span className="text-xs font-medium">{visit.registration.insurance_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 4: Billing */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Tagihan
              </h4>
              {billing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">No. Tagihan</span>
                    <span className="font-mono text-xs font-medium">{billing.billing_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <span className="text-xs font-medium">{billingStatusLabels[billing?.status] || billing?.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-xs font-bold">{formatCurrency(billing.final_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Terbayar</span>
                    <span className="text-xs font-medium">{formatCurrency(billing.paid_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sisa</span>
                    <span className="text-xs font-bold">{formatCurrency(billing.remaining_amount)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">
                  Tagihan belum dibuat
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
