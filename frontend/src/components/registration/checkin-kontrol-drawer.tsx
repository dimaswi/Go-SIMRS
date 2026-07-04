import { useState, useEffect, useMemo, type ReactNode } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, FileText, User, Building2, Send, AlertCircle, RefreshCw } from "lucide-react";
import {
  vclaimApi,
  type VClaimListRencanaKontrolItem,
  type VClaimSuratKontrolDetail,
} from "@/lib/api/vclaim";
import { registrationApi, type AntreanStatus } from "@/lib/api/queue";
import { api } from "@/lib/api";
import { formatPatientName } from "@/lib/print-utils";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface KontrolInfoResponse {
  registration: {
    id: number;
    registration_number: string;
    registration_date: string;
    payment_method: string;
    status: string;
    scheduled_date?: string;
    bpjs_number?: string;
    destination_room_id: number;
    doctor_id?: number;
  };
  patient: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    no_bpjs?: string;
    no_telepon?: string;
    nik?: string;
    kelas_bpjs?: string;
  };
  destinationRoom?: {
    id: number;
    name: string;
    kode_bpjs?: string;
  };
  doctor?: {
    id: number;
    nama: string;
    kode_bpjs?: string;
  };
  sourceRegistration?: {
    id: number;
    registration_number: string;
    registration_date: string;
  };
  sourceVisit?: {
    id: number;
    visit_number: number;
    status: string;
  };
  suratKontrol?: {
    id: number;
    no_surat_kontrol: string;
    no_sep: string;
    tgl_rencana_kontrol: string;
    kode_poli: string;
    nama_poli: string;
    kode_dokter: string;
    nama_dokter: string;
    nama_diagnosa?: string;
  };
  sepAsal?: {
    noSEP: string;
    tglSEP?: string;
    diagAwal?: string;
  };
  existingSEP?: {
    noSEP: string;
    tglSEP: string;
    jnsPelayanan: string;
    diagAwal: string;
    namaDiagnosa?: string;
    klsRawat: string;
    noKartu: string;
    noSuratKontrol?: string;
    poliTujuan?: string;
    namaPoliTujuan?: string;
    kodeDPJP?: string;
    namaDPJP?: string;
  };
  antreanStatus?: AntreanStatus;
  isBPJS: boolean;
  pesertaInfo?: {
    noKartu: string;
    nama: string;
    nik: string;
    hakKelas: {
      kode: string;
      keterangan: string;
    };
    statusPeserta: {
      kode: string;
      keterangan: string;
    };
  };
}

type Step = "loading" | "send_antrean" | "antrean_success" | "sep_form" | "existing_sep";

interface CheckInKontrolDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: number | null;
  onSuccess?: () => void;
}

type DetailRowProps = {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  rightClassName?: string;
};

function DetailRow({ label, value, mono, rightClassName }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium text-foreground",
          mono && "font-mono text-[13px]",
          rightClassName
        )}
      >
        {value ?? "-"}
      </span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
  className,
  titleClassName,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      <CardHeader className="px-4 py-3">
        <CardTitle className={cn("flex items-center gap-2 text-sm", titleClassName)}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function CheckInKontrolDrawer({
  open,
  onOpenChange,
  registrationId,
  onSuccess,
}: CheckInKontrolDrawerProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("loading");
  const [loading, setLoading] = useState(false);
  const [sendingAntrean, setSendingAntrean] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const [kontrolInfo, setKontrolInfo] = useState<KontrolInfoResponse | null>(null);
  const [antreanStatus, setAntreanStatus] = useState<AntreanStatus | null>(null);
  const [suratKontrolList, setSuratKontrolList] = useState<VClaimListRencanaKontrolItem[]>([]);
  const [selectedSuratKontrol, setSelectedSuratKontrol] = useState<VClaimSuratKontrolDetail | null>(null);

  // Merge data from list to fill missing fields in detail
  const mergedSuratKontrol = useMemo(() => {
    if (!selectedSuratKontrol) return null;
    const listItem = suratKontrolList.find(
      (sk) => sk.noSuratKontrol === selectedSuratKontrol.noSuratKontrol
    );
    if (!listItem) return selectedSuratKontrol;
    return {
      ...selectedSuratKontrol,
      poli: selectedSuratKontrol.poli?.nama
        ? selectedSuratKontrol.poli
        : { kode: listItem.poliTujuan, nama: listItem.namaPoliTujuan },
      dokter: selectedSuratKontrol.dokter?.nama
        ? selectedSuratKontrol.dokter
        : { kode: listItem.kodeDokter, nama: listItem.namaDokter },
      sep: selectedSuratKontrol.sep?.noSep
        ? selectedSuratKontrol.sep
        : { noSep: listItem.noSepAsalKontrol, tglSep: listItem.tglSEP },
      namaPoliTujuan: selectedSuratKontrol.namaPoliTujuan || listItem.namaPoliTujuan,
    };
  }, [selectedSuratKontrol, suratKontrolList]);

  // Build SEP initial values from surat kontrol
  const sepInitialValues = useMemo(() => {
    const sourceSuratKontrol = mergedSuratKontrol || (kontrolInfo?.suratKontrol
      ? {
          noSuratKontrol: kontrolInfo.suratKontrol.no_surat_kontrol,
          noSepAsalKontrol: kontrolInfo.suratKontrol.no_sep,
          tglSEP: kontrolInfo.suratKontrol.tgl_rencana_kontrol,
          poli: {
            kode: kontrolInfo.suratKontrol.kode_poli,
            nama: kontrolInfo.suratKontrol.nama_poli,
          },
          dokter: {
            kode: kontrolInfo.suratKontrol.kode_dokter,
            nama: kontrolInfo.suratKontrol.nama_dokter,
          },
          namaDiagnosa: kontrolInfo.suratKontrol.nama_diagnosa || "",
        }
      : null);

    if (!sourceSuratKontrol && !kontrolInfo) return undefined;

    const listItem = suratKontrolList.find(
      (sk) => sk.noSuratKontrol === sourceSuratKontrol?.noSuratKontrol
    );

    let diagAwal = sourceSuratKontrol?.namaDiagnosa || "";
    if (diagAwal.includes(" - ")) {
      diagAwal = diagAwal.split(" - ")[0].trim();
    }
    if (!diagAwal) diagAwal = "Z00.0";

    const noSepAsal =
      (sourceSuratKontrol as any)?.sep?.noSep ||
      listItem?.noSepAsalKontrol ||
      kontrolInfo?.suratKontrol?.no_sep ||
      kontrolInfo?.sepAsal?.noSEP ||
      "";
    const tglSepAsal =
      (sourceSuratKontrol as any)?.sep?.tglSep ||
      listItem?.tglSEP ||
      kontrolInfo?.suratKontrol?.tgl_rencana_kontrol ||
      kontrolInfo?.sepAsal?.tglSEP ||
      format(new Date(), "yyyy-MM-dd");
    const jenisPelayananFromList = listItem?.jnsPelayanan || "";
    const jnsPelayanan = jenisPelayananFromList === "Rawat Inap" ? "1" : "2";

    return {
      kodePoli:
        sourceSuratKontrol?.poli?.kode ||
        listItem?.poliTujuan ||
        kontrolInfo?.suratKontrol?.kode_poli ||
        kontrolInfo?.destinationRoom?.kode_bpjs ||
        "",
      namaPoli:
        sourceSuratKontrol?.poli?.nama ||
        listItem?.namaPoliTujuan ||
        kontrolInfo?.suratKontrol?.nama_poli ||
        kontrolInfo?.destinationRoom?.name ||
        "",
      kodeDokter:
        sourceSuratKontrol?.dokter?.kode ||
        listItem?.kodeDokter ||
        kontrolInfo?.suratKontrol?.kode_dokter ||
        kontrolInfo?.doctor?.kode_bpjs ||
        "",
      namaDokter:
        sourceSuratKontrol?.dokter?.nama ||
        listItem?.namaDokter ||
        kontrolInfo?.suratKontrol?.nama_dokter ||
        kontrolInfo?.doctor?.nama ||
        "",
      jenisPelayanan: jnsPelayanan,
      noSuratKontrol: sourceSuratKontrol?.noSuratKontrol || kontrolInfo?.suratKontrol?.no_surat_kontrol || "",
      noRujukan: noSepAsal,
      tglRujukan: tglSepAsal,
      diagAwal: diagAwal,
      namaDiagnosa: sourceSuratKontrol?.namaDiagnosa || "",
      asalRujukan: "2",
    };
  }, [mergedSuratKontrol, suratKontrolList, kontrolInfo]);

  // Load kontrol info when opened
  useEffect(() => {
    if (open && registrationId) {
      loadKontrolInfo();
    } else {
      setKontrolInfo(null);
      setAntreanStatus(null);
      setSuratKontrolList([]);
      setSelectedSuratKontrol(null);
      setStep("loading");
    }
  }, [open, registrationId]);

  // Determine step based on loaded data
  useEffect(() => {
    if (!kontrolInfo) return;

    // Non-BPJS: auto check-in
    if (!kontrolInfo.isBPJS) {
      handleDirectCheckIn();
      return;
    }

    // Has existing SEP → show existing SEP view
    if (kontrolInfo.existingSEP) {
      setStep("existing_sep");
      return;
    }

    // Check antrean status
    const as = kontrolInfo.antreanStatus;
    if (as && as.addAntreanCode === 200) {
      // AddAntrean already success → show result, user proceeds manually
      setAntreanStatus(as);
      setStep("antrean_success");
    } else {
      // Need to send AddAntrean first
      setAntreanStatus(as || null);
      setStep("send_antrean");
    }
  }, [kontrolInfo]);

  // Auto-load surat kontrol list when entering SEP form step
  useEffect(() => {
    if (step === "sep_form" && kontrolInfo?.isBPJS && kontrolInfo.patient?.no_bpjs) {
      loadSuratKontrolList(kontrolInfo.patient.no_bpjs);
    }
  }, [step, kontrolInfo]);

  // Auto-select matching surat kontrol
  useEffect(() => {
    if (kontrolInfo?.suratKontrol && suratKontrolList.length > 0) {
      const matching = suratKontrolList.find(
        (sk) => sk.noSuratKontrol === kontrolInfo.suratKontrol?.no_surat_kontrol
      );
      if (matching && matching.terbitSEP !== "Sudah") {
        handleSelectSuratKontrol(matching.noSuratKontrol);
      }
    }
  }, [kontrolInfo, suratKontrolList]);

  const loadKontrolInfo = async () => {
    if (!registrationId) return;
    setLoading(true);
    setStep("loading");
    try {
      const response = await api.get(`/registrations/${registrationId}/kontrol-info`);
      setKontrolInfo(response.data.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat info kontrol",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSuratKontrolList = async (noKartu: string) => {
    try {
      const now = new Date();
      const response = await vclaimApi.searchSuratKontrolByNoKartu(noKartu, {
        bulan: String(now.getMonth() + 1).padStart(2, "0"),
        tahun: String(now.getFullYear()),
        filter: "2",
      });
      setSuratKontrolList(response.data.data || []);
    } catch (error) {
      console.error("Failed to load surat kontrol list:", error);
    }
  };

  const handleSelectSuratKontrol = async (noSuratKontrol: string) => {
    try {
      const response = await vclaimApi.getSuratKontrolDetail(noSuratKontrol);
      setSelectedSuratKontrol(response.data.data);
    } catch (error: any) {
      console.error("Failed to get surat kontrol detail:", error);
    }
  };

  // === STEP 1: Send AddAntrean ===
  const handleSendAntrean = async () => {
    if (!registrationId) return;
    setSendingAntrean(true);
    try {
      const response = await registrationApi.sendAntrean(registrationId);
      const status = response.data.antreanStatus;
      setAntreanStatus(status);

      toast({
        title: "Berhasil",
        description: response.data.message || "Antrean berhasil dikirim ke BPJS",
      });

      // Move to antrean success view
      setStep("antrean_success");
    } catch (error: any) {
      const status = error.response?.data?.antreanStatus;
      if (status) setAntreanStatus(status);

      toast({
        title: "Gagal Kirim Antrean",
        description: error.response?.data?.error || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSendingAntrean(false);
    }
  };

  // === STEP 2: SEP Created → done ===
  const handleSEPCreated = async () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const handleBPJSSubmitOverride = async (sepRequest: Record<string, any>): Promise<{ noSep: string }> => {
    if (!registrationId) throw new Error("Registration ID tidak tersedia");
    const response = await registrationApi.bpjsCheckinWithSEP(registrationId, sepRequest);
    const noSep = response.data.no_sep;
    toast({
      title: "Berhasil",
      description: response.data.message || `SEP (${noSep}) dan check-in berhasil`,
    });
    return { noSep };
  };

  // Direct check-in (existing SEP / non-BPJS)
  const handleDirectCheckIn = async () => {
    if (!registrationId) return;
    setCheckingIn(true);
    try {
      const response = await registrationApi.checkIn(registrationId);
      toast({
        title: "Berhasil",
        description: response.data.message || "Check-in berhasil",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Gagal Check-in",
        description: error.response?.data?.error || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  // Don't render anything if drawer is not open
  if (!open) return null;

  // === RENDER: Loading ===
  if (step === "loading" || loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-[640px] p-0 sm:w-[640px] sm:max-w-[640px]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!kontrolInfo || !kontrolInfo.patient) return null;

  // === RENDER: Step 1 - Send Antrean ===
  if (step === "send_antrean") {
    const hasFailedBefore = antreanStatus && antreanStatus.syncStatus === "failed";

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-[640px] p-0 sm:w-[640px] sm:max-w-[640px]">
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4 sm:px-5">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Send className="h-4 w-4 text-blue-600" />
                  Step 1: Kirim Antrean BPJS
                </SheetTitle>
              </SheetHeader>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              <SectionCard
                icon={<User className="h-4 w-4" />}
                title="Data Pasien"
                className="bg-card"
              >
                <DetailRow
                  label="Nama"
                  value={formatPatientName(
                    kontrolInfo.patient.nama_lengkap,
                    kontrolInfo.patient.jenis_kelamin,
                    undefined,
                    kontrolInfo.patient.tanggal_lahir
                  )}
                />
                <DetailRow label="No. RM" value={kontrolInfo.patient.no_rm} mono />
                <DetailRow label="No. BPJS" value={kontrolInfo.patient.no_bpjs} mono />
              </SectionCard>

              {/* Surat Kontrol Info */}
            {kontrolInfo.suratKontrol && (
              <SectionCard
                icon={<FileText className="h-4 w-4 text-blue-600" />}
                title="Data Surat Kontrol"
                className="border-blue-200 bg-blue-50/60"
                titleClassName="text-blue-700"
              >
                <DetailRow label="No. Surat Kontrol" value={kontrolInfo.suratKontrol.no_surat_kontrol} mono />
                <DetailRow label="Poli Tujuan" value={kontrolInfo.suratKontrol.nama_poli} />
                <DetailRow label="Dokter" value={kontrolInfo.suratKontrol.nama_dokter} />
                <DetailRow label="Tgl. Kontrol" value={kontrolInfo.suratKontrol.tgl_rencana_kontrol} />
              </SectionCard>
            )}

              {/* Antrean Status (jika sebelumnya gagal) */}
              {hasFailedBefore && (
                <Card className="border-red-200 bg-red-50/70 shadow-sm">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div className="text-sm">
                        <p className="font-medium text-red-700">Pengiriman sebelumnya gagal</p>
                        <p className="mt-1 text-xs text-red-600">
                          Code: {antreanStatus?.addAntreanCode} - {antreanStatus?.addAntreanMsg || "Unknown error"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  Antrean akan didaftarkan ke BPJS Antrian Online. Setelah berhasil, form SEP akan ditampilkan untuk membuat SEP dan melakukan check-in.
                </p>
              </div>
            </div>

            <div className="border-t bg-background px-4 py-4 sm:px-5">
              <Button
                onClick={handleSendAntrean}
                disabled={sendingAntrean}
                className="w-full"
                size="lg"
              >
                {sendingAntrean ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengirim Antrean...
                  </>
                ) : hasFailedBefore ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Kirim Ulang Antrean
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Kirim Antrean ke BPJS
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // === RENDER: Step 1b - Antrean Success → Lanjut ke SEP ===
  if (step === "antrean_success") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-[640px] p-0 sm:w-[640px] sm:max-w-[640px]">
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4 sm:px-5">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Antrean BPJS Berhasil
                </SheetTitle>
              </SheetHeader>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              <Card className="border-green-200 bg-green-50/70 shadow-sm">
                <CardContent className="px-4 py-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-green-800">Antrean Terdaftar di BPJS</p>
                      <p className="text-xs text-green-600">
                        Code: {antreanStatus?.addAntreanCode} - {antreanStatus?.addAntreanMsg || "Berhasil"}
                      </p>
                    </div>
                  </div>

                  <DetailRow label="Kode Booking" value={antreanStatus?.kodeBooking} mono />
                  <DetailRow label="No. Antrean" value={antreanStatus?.nomorAntrean} mono />
                  <DetailRow label="Poli" value={antreanStatus?.namaPoli} />
                  <DetailRow label="Dokter" value={antreanStatus?.namaDokter} />
                </CardContent>
              </Card>

              <SectionCard icon={<User className="h-4 w-4" />} title="Data Pasien">
                <DetailRow
                  label="Nama"
                  value={formatPatientName(
                    kontrolInfo.patient.nama_lengkap,
                    kontrolInfo.patient.jenis_kelamin,
                    undefined,
                    kontrolInfo.patient.tanggal_lahir
                  )}
                />
                <DetailRow label="No. BPJS" value={kontrolInfo.patient.no_bpjs} mono />
              </SectionCard>

              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <p>Antrean berhasil terdaftar. Lanjutkan untuk membuat SEP dan check-in pasien.</p>
              </div>
            </div>

            <div className="border-t bg-background px-4 py-4 sm:px-5">
              <Button
                onClick={() => setStep("sep_form")}
                className="w-full"
                size="lg"
              >
                <FileText className="mr-2 h-4 w-4" />
                Lanjut ke Pembuatan SEP
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // === RENDER: Step 2 - SEP Form ===
  if (step === "sep_form") {
    return (
      <SEPFormSheet
        open={open}
        onOpenChange={onOpenChange}
        sourceContext="kontrol"
        patient={{
          id: kontrolInfo.patient.id,
          no_rm: kontrolInfo.patient.no_rm,
          nama_lengkap: kontrolInfo.patient.nama_lengkap,
          nik: kontrolInfo.patient.nik,
          no_bpjs: kontrolInfo.patient.no_bpjs,
          tanggal_lahir: kontrolInfo.patient.tanggal_lahir,
          jenis_kelamin: kontrolInfo.patient.jenis_kelamin,
          no_telepon: kontrolInfo.patient.no_telepon,
          kelas_bpjs: kontrolInfo.patient.kelas_bpjs,
        }}
        registrationId={registrationId || undefined}
        initialValues={sepInitialValues}
        onSubmitOverride={handleBPJSSubmitOverride}
        onSEPCreated={handleSEPCreated}
      />
    );
  }

  // === RENDER: Existing SEP - just check-in ===
  if (step === "existing_sep" && kontrolInfo.existingSEP) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-[640px] p-0 sm:w-[640px] sm:max-w-[640px]">
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-4 sm:px-5">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  SEP Sudah Dibuat
                </SheetTitle>
              </SheetHeader>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              <SectionCard icon={<User className="h-4 w-4" />} title="Data Pasien">
                <DetailRow
                  label="Nama"
                  value={formatPatientName(
                    kontrolInfo.patient.nama_lengkap,
                    kontrolInfo.patient.jenis_kelamin,
                    undefined,
                    kontrolInfo.patient.tanggal_lahir
                  )}
                />
                <DetailRow label="No. RM" value={kontrolInfo.patient.no_rm} mono />
                <DetailRow label="No. BPJS" value={kontrolInfo.patient.no_bpjs} mono />
              </SectionCard>

              <SectionCard
                icon={<FileText className="h-4 w-4 text-green-600" />}
                title="SEP"
                className="border-green-200 bg-green-50/70"
                titleClassName="text-green-700"
              >
                <div className="mb-2 flex justify-end">
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    Sudah Terbit
                  </Badge>
                </div>
                <DetailRow label="No. SEP" value={kontrolInfo.existingSEP.noSEP} mono />
                <DetailRow label="Tanggal SEP" value={kontrolInfo.existingSEP.tglSEP} />
                <DetailRow label="Jenis Pelayanan" value={kontrolInfo.existingSEP.jnsPelayanan === "1" ? "Rawat Inap" : "Rawat Jalan"} />
                <DetailRow label="Kelas Rawat" value={`Kelas ${kontrolInfo.existingSEP.klsRawat}`} />
                <DetailRow
                  label="Diagnosa"
                  value={`${kontrolInfo.existingSEP.diagAwal} - ${kontrolInfo.existingSEP.namaDiagnosa}`}
                  rightClassName="max-w-[240px] truncate"
                />
              </SectionCard>

              <SectionCard icon={<Building2 className="h-4 w-4" />} title="Tujuan Pelayanan">
                <DetailRow label="Poli" value={kontrolInfo.existingSEP.namaPoliTujuan || kontrolInfo.destinationRoom?.name} />
                <DetailRow label="Dokter DPJP" value={kontrolInfo.existingSEP.namaDPJP || kontrolInfo.doctor?.nama || "-"} />
                {kontrolInfo.existingSEP.noSuratKontrol && (
                  <DetailRow label="No. Surat Kontrol" value={kontrolInfo.existingSEP.noSuratKontrol} mono />
                )}
              </SectionCard>
            </div>

            <div className="border-t bg-background px-4 py-4 sm:px-5">
              <Button
                onClick={handleDirectCheckIn}
                disabled={checkingIn}
                className="w-full"
                size="lg"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Check-in & Aktifkan Kunjungan
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // For non-BPJS, nothing to render (auto check-in happens in useEffect)
  return null;
}
