import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { formatPatientName } from "@/lib/print-utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  User,
  Calendar,
  MapPin,
  DollarSign,
  Smartphone,
  CheckCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  Printer,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  registrationStatusLabels,
  paymentMethodLabels,
  registrationTypeLabels,
} from "@/lib/api/queue";
import type { SEPLocal } from "@/lib/api/vclaim";

interface RegistrationDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: number | null;
  onViewSEP?: (sep: SEPLocal) => void;
}

export function RegistrationDetailSheet({
  open,
  onOpenChange,
  registrationId,
  onViewSEP,
}: RegistrationDetailSheetProps) {
  const { toast } = useToast();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [bpjsQueue, setBpjsQueue] = useState<BPJSQueue | null>(null);
  const [sepData, setSepData] = useState<SEPLocal | null>(null);
  const [loading, setLoading] = useState(false);
  const [activatingCheckin, setActivatingCheckin] = useState(false);

  useEffect(() => {
    if (open && registrationId) {
      loadRegistration();
    }
  }, [open, registrationId]);

  useEffect(() => {
    if (!open) {
      setRegistration(null);
      setBpjsQueue(null);
      setSepData(null);
    }
  }, [open]);

  const loadRegistration = async () => {
    if (!registrationId) return;

    setLoading(true);
    try {
      const response = await registrationApi.getById(registrationId);
      const regData = response.data.data;
      setRegistration(regData);

      // Try to load BPJS Queue if payment method is BPJS
      if (regData.payment_method === "bpjs") {
        try {
          const bpjsResponse = await bpjsApi.getQueueByRegistration(registrationId);
          setBpjsQueue(bpjsResponse.data.data);
        } catch {
          setBpjsQueue(null);
        }

        // Load SEP data
        try {
          const sepResponse = await api.get(`/bpjs/vclaim/sep/registration/${registrationId}`);
          if (sepResponse.data.data) {
            setSepData(sepResponse.data.data);
          }
        } catch {
          if (regData.sep_number) {
            try {
              const sepByNoResponse = await api.get(`/bpjs/vclaim/sep/list?no_sep=${regData.sep_number}`);
              if (sepByNoResponse.data.data && sepByNoResponse.data.data.length > 0) {
                setSepData(sepByNoResponse.data.data[0]);
              }
            } catch {
              setSepData(null);
            }
          } else {
            setSepData(null);
          }
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data pendaftaran",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateCheckin = async () => {
    if (!bpjsQueue) return;

    setActivatingCheckin(true);
    try {
      const response = await bpjsApi.activateQueueCheckin(bpjsQueue.id);
      toast({
        title: "Berhasil",
        description: response.data.message,
      });
      await loadRegistration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengaktifkan check-in",
      });
    } finally {
      setActivatingCheckin(false);
    }
  };

  const handlePrintQueue = () => {
    if (!registration) return;
    const regId = registration.ID || registration.id;
    window.open(`/print/queue/${regId}`, "_blank");
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      registered: "default",
      in_queue: "secondary",
      in_progress: "outline",
      completed: "default",
      cancelled: "destructive",
    };
    return statusColors[status] || "outline";
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%] overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Memuat data pendaftaran...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!registration) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%]">
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Data tidak ditemukan</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[50%] sm:max-w-[50%] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detail Pendaftaran
              </SheetTitle>
              <SheetDescription>
                {registration.registration_number}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {bpjsQueue && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Smartphone className="h-3 w-3 mr-1" />
                  MJKN
                </Badge>
              )}
              <Badge variant={getStatusVariant(registration.status)}>
                {registrationStatusLabels[registration.status]}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Nomor Antrian Besar */}
          {registration.visit?.room_queue && (
            <div className="rounded-lg border bg-primary/5 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Nomor Antrian</p>
              <p className="font-mono font-bold text-4xl text-primary">
                {registration.visit.room_queue.queue_number}
              </p>
              <Badge className="mt-2" variant="outline">
                {registration.visit.room_queue.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={handlePrintQueue}
              >
                <Printer className="h-4 w-4 mr-2" />
                Cetak Antrian
              </Button>
            </div>
          )}

          {/* Informasi Pasien */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              INFORMASI PASIEN
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">
                  {formatPatientName(registration.patient?.nama_lengkap || registration.patient?.name, registration.patient?.jenis_kelamin, registration.patient?.status_perkawinan, registration.patient?.tanggal_lahir)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. Rekam Medis</label>
                <p className="font-medium text-sm font-mono">
                  {registration.patient?.no_rm || registration.patient?.medical_record_number || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm font-mono">
                  {registration.patient?.nik || "-"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                <p className="font-medium text-sm">
                  {(registration.patient?.jenis_kelamin || registration.patient?.gender) === "L"
                    ? "Laki-laki"
                    : "Perempuan"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Informasi Pendaftaran */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              INFORMASI PENDAFTARAN
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">No. Pendaftaran</label>
                <p className="font-medium text-sm font-mono">{registration.registration_number}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal</label>
                <p className="font-medium text-sm">
                  {format(new Date(registration.registration_date), "dd MMMM yyyy HH:mm", {
                    locale: localeId,
                  })}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis</label>
                <p className="font-medium text-sm">
                  {registrationTypeLabels[registration.registration_type]}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Didaftarkan Oleh</label>
                <p className="font-medium text-sm">
                  {registration.registered_by?.full_name || registration.registered_by?.name || "-"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Informasi Layanan */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              INFORMASI LAYANAN
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Poli/Ruangan</label>
                <p className="font-medium text-sm">{registration.destination_room?.name || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kode Ruangan</label>
                <p className="font-medium text-sm font-mono">
                  {registration.destination_room?.code || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dokter</label>
                <p className="font-medium text-sm">
                  {registration.doctor?.nama_lengkap ||
                    registration.doctor?.nama ||
                    registration.doctor?.name ||
                    "-"}
                </p>
                {(registration.doctor?.spesialisasi || registration.doctor?.specialization) && (
                  <p className="text-xs text-muted-foreground">
                    {registration.doctor.spesialisasi || registration.doctor.specialization}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Informasi Pembayaran */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              INFORMASI PEMBAYARAN
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                    <p className="font-medium text-sm font-mono">
                      {registration.insurance_number || "-"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* SEP Info */}
            {registration.payment_method === "bpjs" && sepData && (
              <div className="mt-4 p-3 rounded-lg border bg-blue-50/50 border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">No. SEP:</span>
                        <span className="font-mono font-bold text-blue-700">{sepData.no_sep}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-100 text-blue-700 border-blue-300"
                        >
                          {sepData.status === "active" ? "Aktif" : sepData.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          Poli: <strong className="text-foreground">{sepData.nama_poli}</strong>
                        </span>
                        <span>
                          DPJP: <strong className="text-foreground">{sepData.nama_dpjp}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  {onViewSEP && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewSEP(sepData)}
                    >
                      Lihat Detail
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BPJS MJKN Queue */}
          {bpjsQueue && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  ANTRIAN BPJS (MJKN)
                </h3>

                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          bpjsQueue.status === "booking"
                            ? "bg-yellow-100"
                            : bpjsQueue.status === "checkin"
                            ? "bg-green-100"
                            : bpjsQueue.status === "batal"
                            ? "bg-red-100"
                            : "bg-blue-100"
                        }`}
                      >
                        {bpjsQueue.status === "booking" && (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        {bpjsQueue.status === "checkin" && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {bpjsQueue.status === "batal" && (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        {!["booking", "checkin", "batal"].includes(bpjsQueue.status) && (
                          <Smartphone className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {bpjsQueue.status === "booking" && "Menunggu Check-in"}
                          {bpjsQueue.status === "checkin" && "Sudah Check-in"}
                          {bpjsQueue.status === "batal" && "Dibatalkan"}
                          {!["booking", "checkin", "batal"].includes(bpjsQueue.status) &&
                            bpjsQueue.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kode Booking: {bpjsQueue.kode_booking}
                        </p>
                      </div>
                    </div>
                    {bpjsQueue.status === "booking" && (
                      <Button
                        size="sm"
                        onClick={handleActivateCheckin}
                        disabled={activatingCheckin}
                      >
                        {activatingCheckin ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Aktifkan Check-in
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Nomor Antrean</label>
                      <p className="font-mono font-bold text-lg">{bpjsQueue.nomor_antrean}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Estimasi Dilayani</label>
                      <p className="font-medium text-sm">{bpjsQueue.estimasi_dilayani ? `${bpjsQueue.estimasi_dilayani} menit` : "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Keluhan */}
          {registration.complaint && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Keluhan</h3>
                <p className="text-sm">{registration.complaint}</p>
              </div>
            </>
          )}

          {/* Notes */}
          {registration.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Catatan</h3>
                <p className="text-sm">{registration.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
