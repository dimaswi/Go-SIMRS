import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  FileText,
  ShieldCheck,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimListRencanaKontrolItem,
  type VClaimSuratKontrolDetail,
  type VClaimSEPKontrolRequest,
} from "@/lib/api/vclaim";
import { registrationApi } from "@/lib/api/queue";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

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

interface CheckInKontrolDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: number | null;
  onSuccess?: () => void;
}

export function CheckInKontrolDrawer({
  open,
  onOpenChange,
  registrationId,
  onSuccess,
}: CheckInKontrolDrawerProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data states
  const [kontrolInfo, setKontrolInfo] = useState<KontrolInfoResponse | null>(null);
  const [suratKontrolList, setSuratKontrolList] = useState<VClaimListRencanaKontrolItem[]>([]);
  const [selectedSuratKontrol, setSelectedSuratKontrol] = useState<VClaimSuratKontrolDetail | null>(null);

  // Form states
  const [searchNoSuratKontrol, setSearchNoSuratKontrol] = useState("");
  const [catatan, setCatatan] = useState("");

  // Merge data from list to fill missing fields in detail
  const mergedSuratKontrol = useMemo(() => {
    if (!selectedSuratKontrol) return null;
    
    // Find matching item from list
    const listItem = suratKontrolList.find(
      (sk) => sk.noSuratKontrol === selectedSuratKontrol.noSuratKontrol
    );
    
    if (!listItem) return selectedSuratKontrol;
    
    // Merge: use detail data, fallback to list data
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

  // Load kontrol info when opened
  useEffect(() => {
    if (open && registrationId) {
      loadKontrolInfo();
    } else {
      // Reset state when closed
      setKontrolInfo(null);
      setSuratKontrolList([]);
      setSelectedSuratKontrol(null);
      setSearchNoSuratKontrol("");
      setCatatan("");
    }
  }, [open, registrationId]);

  // Auto-load surat kontrol list for BPJS patients
  useEffect(() => {
    if (kontrolInfo?.isBPJS && kontrolInfo.patient?.no_bpjs) {
      loadSuratKontrolList(kontrolInfo.patient.no_bpjs);
    }
  }, [kontrolInfo]);

  // Auto-select if there's a matching surat kontrol from source visit
  useEffect(() => {
    if (kontrolInfo?.suratKontrol && suratKontrolList.length > 0) {
      const matching = suratKontrolList.find(
        sk => sk.noSuratKontrol === kontrolInfo.suratKontrol?.no_surat_kontrol
      );
      if (matching && matching.terbitSEP !== "Sudah") {
        handleSelectSuratKontrol(matching.noSuratKontrol);
      }
    }
  }, [kontrolInfo, suratKontrolList]);

  const loadKontrolInfo = async () => {
    if (!registrationId) return;
    setLoading(true);
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
        filter: "2", // Belum terbit SEP
      });
      setSuratKontrolList(response.data.data || []);
    } catch (error) {
      console.error("Failed to load surat kontrol list:", error);
    }
  };

  const handleSelectSuratKontrol = async (noSuratKontrol: string) => {
    setLoadingSearch(true);
    try {
      const response = await vclaimApi.getSuratKontrolDetail(noSuratKontrol);
      setSelectedSuratKontrol(response.data.data);
      setSearchNoSuratKontrol(noSuratKontrol);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat detail surat kontrol",
        variant: "destructive",
      });
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearchSuratKontrol = async () => {
    if (!searchNoSuratKontrol.trim()) {
      toast({
        title: "Validasi",
        description: "Masukkan nomor surat kontrol",
        variant: "destructive",
      });
      return;
    }
    await handleSelectSuratKontrol(searchNoSuratKontrol.trim());
  };

  const handleCheckIn = async () => {
    if (!kontrolInfo || !registrationId) return;

    // For BPJS, must have selected surat kontrol and create SEP first
    if (kontrolInfo.isBPJS) {
      if (!mergedSuratKontrol) {
        toast({
          title: "Validasi",
          description: "Pilih surat kontrol terlebih dahulu",
          variant: "destructive",
        });
        return;
      }
      await handleCreateSEPAndCheckIn();
    } else {
      // For non-BPJS, just check-in directly
      await handleDirectCheckIn();
    }
  };

  const handleCreateSEPAndCheckIn = async () => {
    if (!kontrolInfo || !mergedSuratKontrol || !registrationId) return;

    // Also get the list item for additional data
    const listItem = suratKontrolList.find(
      (sk) => sk.noSuratKontrol === mergedSuratKontrol.noSuratKontrol
    );

    setSubmitting(true);
    try {
      // Build SEP Kontrol request using merged data + list item fallback
      const noSEPAsal = mergedSuratKontrol.sep?.noSep || listItem?.noSepAsalKontrol || "";
      const tglSEPAsal = mergedSuratKontrol.sep?.tglSep || listItem?.tglSEP || format(new Date(), "yyyy-MM-dd");
      const kodePoli = mergedSuratKontrol.poli?.kode || listItem?.poliTujuan || kontrolInfo.destinationRoom?.kode_bpjs || "";
      const kodeDokter = mergedSuratKontrol.dokter?.kode || listItem?.kodeDokter || kontrolInfo.doctor?.kode_bpjs || "";
      
      // Extract ICD code from diagnosis (format: "A00.0 - Diagnosis Name" or just "A00.0")
      let diagAwal = mergedSuratKontrol.namaDiagnosa || "";
      if (diagAwal.includes(" - ")) {
        diagAwal = diagAwal.split(" - ")[0].trim();
      }
      // If still empty, use default
      if (!diagAwal) {
        diagAwal = "Z00.0"; // Default general examination
      }

      const sepRequest: VClaimSEPKontrolRequest = {
        noKartu: kontrolInfo.patient?.no_bpjs || "",
        tglSep: format(new Date(), "yyyy-MM-dd"),
        noSuratKontrol: mergedSuratKontrol.noSuratKontrol || "",
        noSEPAsal: noSEPAsal,
        tglSEPAsal: tglSEPAsal,
        kodePoli: kodePoli,
        kodeDokter: kodeDokter,
        jnsPelayanan: "2", // Default rawat jalan
        catatan: catatan || "",
        diagAwal: diagAwal,
        klsRawatHak: mergedSuratKontrol.sep?.klsRawat || kontrolInfo.pesertaInfo?.hakKelas?.kode || "3",
        noTelp: kontrolInfo.patient?.no_telepon || "000000000000",
        userBuat: user?.username || "SIMRS",
        registrationId: registrationId,
      };

      console.log("SEP Request:", sepRequest); // Debug

      // Create SEP
      const sepResponse = await vclaimApi.createSEPKontrol(sepRequest);
      const noSEP = sepResponse.data.data?.noSep;

      if (!noSEP) {
        throw new Error("No SEP tidak didapatkan dari BPJS");
      }

      toast({
        title: "SEP Berhasil Dibuat",
        description: `No SEP: ${noSEP}`,
      });

      // Now check-in
      await handleDirectCheckIn();

    } catch (error: any) {
      toast({
        title: "Gagal Membuat SEP",
        description: error.response?.data?.error || error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectCheckIn = async () => {
    if (!registrationId) return;

    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Don't render content if no kontrolInfo (e.g., after error)
  if (!kontrolInfo) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Check-in Kontrol</h2>
                <p className="text-white/80 text-sm">Memuat data...</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Check-in Kontrol</h2>
              <p className="text-white/80 text-sm">
                {kontrolInfo.isBPJS ? "BPJS Kesehatan" : "Pasien Umum"}
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Patient Card - Hero Style */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{kontrolInfo?.patient?.nama_lengkap}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs font-mono">
                      {kontrolInfo?.patient?.no_rm}
                    </Badge>
                    <Badge variant={kontrolInfo?.isBPJS ? "default" : "secondary"} className="text-xs">
                      {kontrolInfo?.isBPJS ? "BPJS" : "Umum"}
                    </Badge>
                  </div>
                  {kontrolInfo?.isBPJS && kontrolInfo.patient?.no_bpjs && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      BPJS: {kontrolInfo.patient.no_bpjs}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Jadwal Kontrol - Visual Timeline */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950 px-4 py-2 border-b">
                <h4 className="font-medium text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Calendar className="h-4 w-4" />
                  Jadwal Kontrol Hari Ini
                </h4>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tanggal</p>
                  <p className="font-semibold">
                    {kontrolInfo?.registration?.scheduled_date 
                      ? format(new Date(kontrolInfo.registration.scheduled_date), "dd MMM yyyy")
                      : "-"
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">No. Registrasi</p>
                  <p className="font-mono text-sm">{kontrolInfo?.registration?.registration_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Poli Tujuan</p>
                  <p className="font-medium">{kontrolInfo?.destinationRoom?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Dokter</p>
                  <p className="font-medium">{kontrolInfo?.doctor?.nama || "-"}</p>
                </div>
              </div>
            </div>

            {/* BPJS Section */}
            {kontrolInfo?.isBPJS && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-emerald-50 dark:bg-emerald-950 px-4 py-2 border-b">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    Surat Kontrol BPJS
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  {/* Search */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cari nomor surat kontrol..."
                      value={searchNoSuratKontrol}
                      onChange={(e) => setSearchNoSuratKontrol(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchSuratKontrol()}
                      className="h-9"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSearchSuratKontrol}
                      disabled={loadingSearch}
                      className="h-9 w-9 shrink-0"
                    >
                      {loadingSearch ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Surat Kontrol List */}
                  {suratKontrolList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Pilih surat kontrol ({suratKontrolList.length} tersedia)
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {suratKontrolList.map((sk) => (
                          <div
                            key={sk.noSuratKontrol}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedSuratKontrol?.noSuratKontrol === sk.noSuratKontrol
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                                : "border-transparent bg-muted/50 hover:border-emerald-300"
                            } ${sk.terbitSEP === "Sudah" ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => {
                              if (sk.terbitSEP !== "Sudah") {
                                handleSelectSuratKontrol(sk.noSuratKontrol);
                              }
                            }}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm font-medium">{sk.noSuratKontrol}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {sk.namaPoliTujuan} • {sk.tglRencanaKontrol ? format(new Date(sk.tglRencanaKontrol), "dd/MM/yyyy") : "-"}
                                </p>
                              </div>
                              {sk.terbitSEP === "Sudah" ? (
                                <Badge variant="secondary" className="shrink-0">SEP Terbit</Badge>
                              ) : selectedSuratKontrol?.noSuratKontrol === sk.noSuratKontrol ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Detail */}
                  {mergedSuratKontrol && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-sm text-emerald-700 dark:text-emerald-300">Detail Surat Kontrol</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Poli Tujuan</p>
                          <p className="font-medium">{mergedSuratKontrol.poli?.nama || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Dokter</p>
                          <p className="font-medium">{mergedSuratKontrol.dokter?.nama || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">SEP Asal</p>
                          <p className="font-mono text-xs">{mergedSuratKontrol.sep?.noSep || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Diagnosa</p>
                          <p className="text-xs truncate">{mergedSuratKontrol.namaDiagnosa || "-"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Catatan */}
                  <div>
                    <Label htmlFor="catatan" className="text-sm">Catatan SEP</Label>
                    <Textarea
                      id="catatan"
                      placeholder="Catatan tambahan (opsional)..."
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>

                  {!selectedSuratKontrol && suratKontrolList.length === 0 && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Tidak ada surat kontrol</AlertTitle>
                      <AlertDescription>
                        Surat kontrol tidak ditemukan. Pastikan sudah dibuat pada kunjungan sebelumnya.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            {/* Non-BPJS Ready */}
            {!kontrolInfo?.isBPJS && (
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-emerald-700 dark:text-emerald-300">Siap Check-in</h4>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      Pasien umum dapat langsung check-in
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleCheckIn}
            disabled={submitting || (kontrolInfo?.isBPJS && !mergedSuratKontrol)}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {kontrolInfo?.isBPJS ? "Terbitkan SEP & Check-in" : "Check-in Sekarang"}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}