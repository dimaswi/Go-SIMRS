import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  registrationStatusLabels,
  paymentMethodLabels,
  registrationTypeLabels,
} from "@/lib/api/queue";

export default function RegistrationShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle("Detail Pendaftaran");
    loadRegistration();
  }, [id]);

  const loadRegistration = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await registrationApi.getById(parseInt(id));
      setRegistration(response.data.data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data pendaftaran",
      });
      navigate("/registrations");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return null;
  }

  const statusColors: Record<string, string> = {
    registered: "default",
    in_queue: "secondary",
    in_progress: "outline",
    completed: "default",
    cancelled: "destructive",
  };

  const getStatusVariant = (status: string) => {
    return statusColors[status] || "outline";
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/registrations")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {registration.patient?.nama_lengkap || registration.patient?.name || "-"}
                </CardTitle>
                <CardDescription>
                  No. RM: {registration.patient?.no_rm || registration.patient?.medical_record_number || "-"} • 
                  No. Pendaftaran: {registration.registration_number}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(registration.status) as any}>
                {registrationStatusLabels[registration.status]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Informasi Pasien */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              INFORMASI PASIEN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">{registration.patient?.nama_lengkap || registration.patient?.name || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. Rekam Medis</label>
                <p className="font-medium text-sm font-mono">{registration.patient?.no_rm || registration.patient?.medical_record_number || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm font-mono">{registration.patient?.nik || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                <p className="font-medium text-sm">
                  {(registration.patient?.jenis_kelamin || registration.patient?.gender) === "L" ? "Laki-laki" : "Perempuan"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Lahir</label>
                <p className="font-medium text-sm">
                  {(registration.patient?.tanggal_lahir || registration.patient?.date_of_birth)
                    ? format(new Date(registration.patient.tanggal_lahir || registration.patient.date_of_birth!), "dd MMMM yyyy", {
                        locale: localeId,
                      })
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Pendaftaran */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              INFORMASI PENDAFTARAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nomor Pendaftaran</label>
                <p className="font-medium text-sm font-mono">{registration.registration_number}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Pendaftaran</label>
                <p className="font-medium text-sm">
                  {format(new Date(registration.registration_date), "dd MMMM yyyy HH:mm", { locale: localeId })}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Pendaftaran</label>
                <p className="font-medium text-sm">{registrationTypeLabels[registration.registration_type]}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Didaftarkan Oleh</label>
                <p className="font-medium text-sm">{registration.registered_by?.full_name || registration.registered_by?.name || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={getStatusVariant(registration.status) as any}>
                    {registrationStatusLabels[registration.status]}
                  </Badge>
                </div>
              </div>
              {registration.queue?.queue_number && (
                <div>
                  <label className="text-xs text-muted-foreground">Nomor Antrian Loket</label>
                  <p className="font-medium text-sm">{registration.queue.queue_number}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Layanan */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              INFORMASI LAYANAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Poli/Ruangan Tujuan</label>
                {registration.destination_room ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-primary hover:underline"
                    onClick={() => navigate(`/rooms/show/${registration.destination_room?.id || registration.destination_room?.ID}`)}
                  >
                    {registration.destination_room.name}
                  </Button>
                ) : (
                  <p className="font-medium text-sm">-</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kode Ruangan</label>
                <p className="font-medium text-sm font-mono">{registration.destination_room?.code || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dokter</label>
                <p className="font-medium text-sm">{registration.doctor?.nama_lengkap || registration.doctor?.nama || registration.doctor?.name || "-"}</p>
                {(registration.doctor?.spesialisasi || registration.doctor?.specialization) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {registration.doctor.spesialisasi || registration.doctor.specialization}
                  </p>
                )}
              </div>
              {registration.visit?.room_queue && (
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs text-muted-foreground">Nomor Antrian Ruangan</label>
                  <p className="font-mono font-bold text-2xl text-primary mt-1">
                    {registration.visit.room_queue.queue_number}
                  </p>
                  <Badge className="mt-1" variant="outline">
                    {registration.visit.room_queue.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Informasi Pembayaran */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              INFORMASI PEMBAYARAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Metode Pembayaran</label>
                <div className="mt-1">
                  <Badge variant={registration.payment_method === "cash" ? "default" : "secondary"}>
                    {paymentMethodLabels[registration.payment_method]}
                  </Badge>
                </div>
              </div>
              {registration.payment_method === "bpjs" && registration.bpjs_number && (
                <div>
                  <label className="text-xs text-muted-foreground">Nomor BPJS</label>
                  <p className="font-medium text-sm font-mono">{registration.bpjs_number}</p>
                </div>
              )}
              {registration.payment_method === "insurance" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Nama Asuransi</label>
                    <p className="font-medium text-sm">{registration.insurance_name || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Polis</label>
                    <p className="font-medium text-sm font-mono">{registration.insurance_number || "-"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {(registration.complaint || registration.notes || registration.visit) && (
            <>
              <div className="border-t my-6" />

              {/* Informasi Tambahan */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  INFORMASI TAMBAHAN
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {registration.complaint && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Keluhan</label>
                      <p className="font-medium text-sm">{registration.complaint}</p>
                    </div>
                  )}
                  {registration.notes && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Catatan</label>
                      <p className="font-medium text-sm">{registration.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {registration.visit && (
            <>
              <div className="border-t my-6" />

              {/* Informasi Kunjungan */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  INFORMASI KUNJUNGAN
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="text-xs text-muted-foreground">Nomor Kunjungan</label>
                    <p className="font-medium text-sm font-mono">{registration.visit.visit_number}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jenis Kunjungan</label>
                    <p className="font-medium text-sm capitalize">{registration.visit.visit_type}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status Kunjungan</label>
                    <div className="mt-1">
                      <Badge variant="outline">{registration.visit.status}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
