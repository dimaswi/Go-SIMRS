import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  FileCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Stethoscope,
  Building2,
  Hospital,
  UserCheck,
  Pill,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type VClaimSPRIResponse,
  type SuratKontrolResponse,
  type VClaimRefPoli,
  type VClaimRefDokter,
  type PRBFormData,
} from "@/lib/api/vclaim";
import { SearchModal } from "@/components/sep/search-modal";

// PRB status options
const PRB_STATUS_OPTIONS = [
  { kode: "01", nama: "Diabetes Melitus" },
  { kode: "02", nama: "Hipertensi" },
  { kode: "03", nama: "Asma" },
  { kode: "04", nama: "Penyakit Jantung" },
  { kode: "05", nama: "PPOK" },
  { kode: "06", nama: "Skizofrenia" },
  { kode: "07", nama: "Stroke" },
  { kode: "08", nama: "Epilepsi" },
  { kode: "09", nama: "SLE" },
];

// PRB Fields definition per status
const PRB_FIELDS: Record<string, { key: keyof PRBFormData; label: string; type: 'number' | 'boolean'; min?: number; max?: number }[]> = {
  "01": [ // Diabetes Melitus
    { key: "HBA1C", label: "HBA1C", type: "number", min: 0.1, max: 15 },
    { key: "GDP", label: "GDP", type: "number", min: 10, max: 500 },
    { key: "GD2JPP", label: "GD2JPP", type: "number", min: 10, max: 500 },
    { key: "eGFR", label: "eGFR", type: "number", min: 5, max: 150 },
    { key: "TD_Sistolik", label: "TD Sistolik", type: "number", min: 20, max: 200 },
    { key: "TD_Diastolik", label: "TD Diastolik", type: "number", min: 20, max: 200 },
    { key: "LDL", label: "LDL", type: "number", min: 20, max: 500 },
  ],
  "02": [ // Hipertensi
    { key: "Rata_TD_Sistolik", label: "Rata-rata TD Sistolik", type: "number", min: 20, max: 200 },
    { key: "Rata_TD_Diastolik", label: "Rata-rata TD Diastolik", type: "number", min: 20, max: 200 },
    { key: "JantungKoroner", label: "Jantung Koroner", type: "boolean" },
    { key: "Stroke", label: "Stroke", type: "boolean" },
    { key: "VaskularPerifer", label: "Vaskular Perifer", type: "boolean" },
    { key: "LDL", label: "LDL", type: "number", min: 20, max: 500 },
    { key: "eGFR", label: "eGFR", type: "number", min: 5, max: 150 },
  ],
  "03": [ // Asma
    { key: "Terkontrol", label: "Terkontrol", type: "boolean" },
    { key: "Gejala2xMinggu", label: "Gejala > 2x/Minggu", type: "boolean" },
    { key: "BangunMalam", label: "Bangun Malam", type: "boolean" },
    { key: "KeterbatasanFisik", label: "Keterbatasan Fisik", type: "boolean" },
    { key: "FungsiParu", label: "Fungsi Paru (%)", type: "number", min: 0, max: 100 },
  ],
  "04": [ // Penyakit Jantung
    { key: "Rata_TD_Sistolik", label: "Rata-rata TD Sistolik", type: "number", min: 20, max: 200 },
    { key: "Rata_TD_Diastolik", label: "Rata-rata TD Diastolik", type: "number", min: 20, max: 200 },
    { key: "NadiIstirahat", label: "Nadi Istirahat", type: "number", min: 20, max: 200 },
    { key: "Aritmia", label: "Aritmia", type: "boolean" },
    { key: "AtrialFibrilasi", label: "Atrial Fibrilasi", type: "boolean" },
    { key: "SesakNapas3Bulan", label: "Sesak Napas 3 Bulan Terakhir", type: "boolean" },
    { key: "NyeriDada3Bulan", label: "Nyeri Dada 3 Bulan Terakhir", type: "boolean" },
    { key: "SesakNapasAktivitas", label: "Sesak Napas saat Aktivitas", type: "boolean" },
    { key: "NyeriDadaAktivitas", label: "Nyeri Dada saat Aktivitas", type: "boolean" },
  ],
  "05": [ // PPOK
    { key: "SkorMMRC", label: "Skor MMRC", type: "number", min: 0, max: 40 },
    { key: "Eksaserbasi1Tahun", label: "Eksaserbasi 1 Tahun Terakhir", type: "boolean" },
    { key: "MampuAktivitas", label: "Mampu Aktivitas", type: "boolean" },
  ],
  "06": [ // Skizofrenia
    { key: "Remisi", label: "Remisi (%)", type: "number", min: 0, max: 100 },
    { key: "TerapiRumatan", label: "Terapi Rumatan", type: "boolean" },
    { key: "Usia", label: "Usia", type: "number", min: 1, max: 100 },
  ],
  "07": [ // Stroke
    { key: "TD_Sistolik", label: "TD Sistolik", type: "number", min: 20, max: 200 },
    { key: "TD_Diastolik", label: "TD Diastolik", type: "number", min: 20, max: 200 },
    { key: "LDL", label: "LDL", type: "number", min: 20, max: 500 },
    { key: "GDP", label: "GDP", type: "number", min: 10, max: 500 },
    { key: "HBA1C", label: "HBA1C", type: "number", min: 0.1, max: 15 },
    { key: "AsamUrat", label: "Asam Urat", type: "number", min: 0.1, max: 20 },
  ],
  "08": [ // Epilepsi
    { key: "Epileptik6Bulan", label: "Epileptik 6 Bulan Terakhir", type: "boolean" },
    { key: "EfekSampingOAB", label: "Efek Samping OAB", type: "boolean" },
    { key: "HamilMenyusui", label: "Hamil/Menyusui", type: "boolean" },
  ],
  "09": [ // SLE
    { key: "RemisiSLE", label: "Remisi SLE (%)", type: "number", min: 0, max: 100 },
    { key: "Hamil", label: "Hamil", type: "boolean" },
  ],
};

interface BPJSControlSectionProps {
  dispositionType: "pulang" | "aps" | "rawat_inap";
  activeSEP: SEPLocal | null;
  patient: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  } | null;
  visitId: number;
  isDisabled?: boolean;
  // SPRI specific
  existingSPRI?: VClaimSPRIResponse | null;
  onSPRICreated?: (spriData: VClaimSPRIResponse) => void;
  // Surat Kontrol specific
  existingSuratKontrol?: SuratKontrolResponse | null;
  onSuratKontrolCreated?: (skData: SuratKontrolResponse) => void;
}

export function BPJSControlSection({
  dispositionType,
  activeSEP,
  patient,
  visitId,
  isDisabled = false,
  existingSPRI,
  onSPRICreated,
  existingSuratKontrol,
  onSuratKontrolCreated,
}: BPJSControlSectionProps) {
  const { toast } = useToast();

  // Common state
  const [loading, setLoading] = useState(false);
  const [checkingPeserta, setCheckingPeserta] = useState(false);
  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);
  
  // Toggle state - apakah user ingin membuat BPJS control
  const [wantsBPJSControl, setWantsBPJSControl] = useState(false);

  // Form state - untuk SPRI dan Surat Kontrol
  const [tglRencanaKontrol, setTglRencanaKontrol] = useState(
    format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [kodePoli, setKodePoli] = useState("");
  const [namaPoli, setNamaPoli] = useState("");
  const [kodeDokter, setKodeDokter] = useState("");
  const [namaDokter, setNamaDokter] = useState("");

  // Surat Kontrol specific - version and PRB
  const [version, setVersion] = useState<"v1" | "v2">("v1");
  const [isPRB, setIsPRB] = useState(false);
  const [kdStatusPRB, setKdStatusPRB] = useState("");
  const [dataPRB, setDataPRB] = useState<PRBFormData>({});

  // Modal state
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [dokterModalOpen, setDokterModalOpen] = useState(false);

  // Result state
  const [spriResult, setSPRIResult] = useState<VClaimSPRIResponse | null>(existingSPRI || null);
  const [suratKontrolResult, setSuratKontrolResult] = useState<SuratKontrolResponse | null>(existingSuratKontrol || null);

  // Determine type: SPRI untuk rawat_inap, Surat Kontrol untuk pulang/aps
  const controlType = dispositionType === "rawat_inap" ? "spri" : "surat_kontrol";
  const isRawatInap = controlType === "spri";

  // Check peserta saat pertama kali toggle on
  // For SPRI, we can check peserta even without SEP
  useEffect(() => {
    if (wantsBPJSControl && patient?.no_bpjs && !peserta && !pesertaError) {
      checkPeserta();
    }
  }, [wantsBPJSControl]);

  const checkPeserta = async () => {
    // For SPRI, we can use patient's no_bpjs instead of SEP's no_kartu
    const noKartu = activeSEP?.no_kartu || patient?.no_bpjs;
    if (!noKartu) return;

    setCheckingPeserta(true);
    setPesertaError(null);
    try {
      const tglSEP = format(new Date(), "yyyy-MM-dd");
      const res = await vclaimApi.getPesertaByNoKartu(noKartu, tglSEP);
      if (res.data.data) {
        setPeserta(res.data.data);
      }
    } catch (err: any) {
      setPesertaError(err?.response?.data?.error || "Gagal mengecek kepesertaan");
    } finally {
      setCheckingPeserta(false);
    }
  };

  // Search functions
  const handleSearchPoli = async (keyword: string) => {
    if (isRawatInap) {
      // SPRI: search poli SPRI
      const res = await vclaimApi.searchPoliSPRI(keyword);
      return res.data.data || [];
    } else {
      // Surat Kontrol: search poli surat kontrol
      const res = await vclaimApi.searchPoliSuratKontrol(keyword);
      return res.data.data || [];
    }
  };

  const handleSearchDokter = async (_keyword: string) => {
    if (!kodePoli) {
      toast({
        title: "Pilih poli terlebih dahulu",
        variant: "destructive",
      });
      return [];
    }
    // Note: BPJS API dokter tidak support search keyword, hanya return semua dokter di poli
    // tglPelayanan diambil dari tglRencanaKontrol yang sudah dipilih
    if (isRawatInap) {
      // SPRI: search dokter SPRI
      const res = await vclaimApi.searchDokterSPRI(kodePoli, tglRencanaKontrol);
      return res.data.data || [];
    } else {
      // Surat Kontrol: search dokter surat kontrol
      const res = await vclaimApi.searchDokterSuratKontrol(kodePoli, tglRencanaKontrol);
      return res.data.data || [];
    }
  };

  // Handle PRB field change
  const handlePRBFieldChange = (key: keyof PRBFormData, value: number | boolean) => {
    setDataPRB(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Submit function
  const handleSubmit = async () => {
    // For SPRI, we only need patient with no_bpjs (SEP is optional)
    // For Surat Kontrol, we need both patient and SEP
    if (isRawatInap) {
      if (!patient?.no_bpjs) {
        toast({
          title: "Data tidak lengkap",
          description: "Data BPJS pasien tidak tersedia",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!activeSEP || !patient) {
        toast({
          title: "Data tidak lengkap",
          description: "Data SEP atau pasien tidak tersedia",
          variant: "destructive",
        });
        return;
      }
    }

    if (!kodePoli || !kodeDokter || !tglRencanaKontrol) {
      toast({
        title: "Data tidak lengkap",
        description: "Silakan lengkapi poli, dokter, dan tanggal kontrol",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isRawatInap) {
        // Create SPRI - use patient's no_bpjs if SEP not available
        const noKartu = activeSEP?.no_kartu || patient!.no_bpjs!;
        const res = await vclaimApi.createSPRI({
          no_kartu: noKartu,
          visit_id: visitId,
          sep_id: activeSEP?.id,
          tgl_rencana_kontrol: tglRencanaKontrol,
          poli_kontrol: kodePoli,
          nama_poli: namaPoli,
          kode_dokter: kodeDokter,
          nama_dokter: namaDokter,
        });

        if (res.data.data) {
          setSPRIResult(res.data.data);
          onSPRICreated?.(res.data.data);
          toast({
            title: "SPRI Berhasil Dibuat",
            description: `No. SPRI: ${res.data.data.noSPRI}`,
          });
        }
      } else {
        // Create Surat Kontrol - requires SEP
        const res = await vclaimApi.createSuratKontrol({
          no_sep: activeSEP!.no_sep,
          visit_id: visitId,
          patient_id: patient!.id,
          sep_id: activeSEP!.id,
          tgl_rencana_kontrol: tglRencanaKontrol,
          kode_poli: kodePoli,
          nama_poli: namaPoli,
          kode_dokter: kodeDokter,
          nama_dokter: namaDokter,
          version: version,
          is_prb: version === "v2" && isPRB,
          kd_status_prb: version === "v2" && isPRB ? kdStatusPRB : undefined,
          data_prb: version === "v2" && isPRB ? dataPRB : undefined,
        });

        if (res.data.data) {
          setSuratKontrolResult(res.data.data);
          onSuratKontrolCreated?.(res.data.data);
          toast({
            title: "Surat Kontrol Berhasil Dibuat",
            description: `No. Surat Kontrol: ${res.data.data.noSuratKontrol}`,
          });
        }
      }
    } catch (err: any) {
      toast({
        title: `Gagal membuat ${isRawatInap ? "SPRI" : "Surat Kontrol"}`,
        description: err?.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no BPJS data
  // For SPRI (rawat_inap), SEP is NOT required
  // For Surat Kontrol (pulang/aps), SEP is required
  if (!patient?.no_bpjs) {
    return null;
  }
  if (!isRawatInap && !activeSEP) {
    // Surat Kontrol requires SEP
    return null;
  }

  // Already has result
  const hasResult = isRawatInap ? !!spriResult : !!suratKontrolResult;

  return (
    <div className={`rounded-lg border-2 p-4 space-y-4 ${
      isRawatInap 
        ? "border-blue-300 bg-blue-50" 
        : "border-green-300 bg-green-50"
    }`}>
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 ${isRawatInap ? "text-blue-700" : "text-green-700"}`}>
          {isRawatInap ? <Hospital className="h-5 w-5" /> : <FileCheck className="h-5 w-5" />}
          <span className="font-semibold">
            {isRawatInap ? "SPRI (Surat Perintah Rawat Inap)" : "Surat Kontrol BPJS"}
          </span>
        </div>
        
        {hasResult ? (
          <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium ${
            isRawatInap ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
          }`}>
            <CheckCircle2 className="h-3 w-3" />
            {isRawatInap ? spriResult?.noSPRI : suratKontrolResult?.noSuratKontrol}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Label htmlFor="wants-bpjs" className="text-sm text-muted-foreground">
              {wantsBPJSControl ? "Ya" : "Tidak"}
            </Label>
            <Switch
              id="wants-bpjs"
              checked={wantsBPJSControl}
              onCheckedChange={setWantsBPJSControl}
              disabled={isDisabled}
            />
          </div>
        )}
      </div>

      {/* SEP Info - show SEP data if available, otherwise show BPJS number for SPRI */}
      <div className={`rounded-lg p-3 border ${
        isRawatInap ? "bg-white/60 border-blue-200" : "bg-white/60 border-green-200"
      }`}>
        <div className={`text-xs font-medium mb-2 ${isRawatInap ? "text-blue-600" : "text-green-600"}`}>
          {activeSEP ? "Data SEP Aktif" : "Data BPJS Pasien"}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {activeSEP ? (
            <>
              <div>
                <span className="text-xs text-muted-foreground">No. SEP</span>
                <p className="font-medium">{activeSEP.no_sep}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">No. Kartu</span>
                <p className="font-medium">{activeSEP.no_kartu}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-xs text-muted-foreground">Nama Pasien</span>
                <p className="font-medium">{patient?.nama_lengkap}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">No. Kartu BPJS</span>
                <p className="font-medium">{patient?.no_bpjs}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Result Display */}
      {hasResult && (
        <Alert className={isRawatInap ? "bg-blue-100 border-blue-300" : "bg-green-100 border-green-300"}>
          <CheckCircle2 className={`h-4 w-4 ${isRawatInap ? "text-blue-600" : "text-green-600"}`} />
          <AlertTitle className={isRawatInap ? "text-blue-700" : "text-green-700"}>
            {isRawatInap ? "SPRI" : "Surat Kontrol"} Berhasil Dibuat
          </AlertTitle>
          <AlertDescription className={isRawatInap ? "text-blue-700" : "text-green-700"}>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              {isRawatInap && spriResult ? (
                <>
                  <div>No. SPRI: <strong>{spriResult.noSPRI}</strong></div>
                  <div>Tanggal Kontrol: <strong>{spriResult.tglRencanaKontrol}</strong></div>
                  <div>Dokter: <strong>{spriResult.namaDokter}</strong></div>
                  <div>Diagnosa: <strong>{spriResult.namaDiagnosa || "-"}</strong></div>
                </>
              ) : suratKontrolResult ? (
                <>
                  <div>No. Surat Kontrol: <strong>{suratKontrolResult.noSuratKontrol}</strong></div>
                  <div>Tanggal Kontrol: <strong>{suratKontrolResult.tglRencanaKontrol}</strong></div>
                  <div>Dokter: <strong>{suratKontrolResult.namaDokter}</strong></div>
                  <div>Diagnosa: <strong>{suratKontrolResult.namaDiagnosa || "-"}</strong></div>
                </>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Form - only show if toggle is on and no result yet */}
      {wantsBPJSControl && !hasResult && (
        <div className="space-y-4">
          {/* Kepesertaan Check */}
          {checkingPeserta ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Mengecek kepesertaan...</span>
            </div>
          ) : pesertaError ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{pesertaError}</AlertDescription>
            </Alert>
          ) : peserta ? (
            <Alert className={isRawatInap ? "bg-blue-100 border-blue-200" : "bg-green-100 border-green-200"}>
              <UserCheck className={`h-4 w-4 ${isRawatInap ? "text-blue-600" : "text-green-600"}`} />
              <AlertDescription className={isRawatInap ? "text-blue-700" : "text-green-700"}>
                <div className="flex items-center justify-between">
                  <span>
                    <strong>{peserta.nama}</strong> - {peserta.noKartu}
                  </span>
                  <Badge variant="default" className={`text-xs ${isRawatInap ? "bg-blue-600" : "bg-green-600"}`}>
                    {peserta.statusPeserta?.keterangan}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Version Switch - Only for Surat Kontrol */}
          {!isRawatInap && (
            <div className="flex items-center gap-4 p-3 bg-white/60 rounded-lg border border-green-200">
              <Label className="text-sm font-medium">Versi API:</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setVersion("v1"); setIsPRB(false); }}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    version === "v1" 
                      ? "bg-green-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  disabled={isDisabled}
                >
                  V1 (Standar)
                </button>
                <button
                  type="button"
                  onClick={() => setVersion("v2")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    version === "v2" 
                      ? "bg-green-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  disabled={isDisabled}
                >
                  V2 (dengan PRB)
                </button>
              </div>
            </div>
          )}

          {/* Date, Poli, Dokter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tanggal Kontrol */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Tanggal {isRawatInap ? "Kontrol" : "Rencana Kontrol"}
              </Label>
              <Input
                type="date"
                value={tglRencanaKontrol}
                onChange={(e) => setTglRencanaKontrol(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                disabled={isDisabled}
                className="bg-white"
              />
            </div>

            {/* Poli */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Poli Tujuan
              </Label>
              <div className="flex gap-2">
                <Input
                  value={namaPoli || kodePoli}
                  placeholder="Pilih poli..."
                  readOnly
                  className="bg-white flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPoliModalOpen(true)}
                  disabled={isDisabled}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Dokter */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5" />
                Dokter
              </Label>
              <div className="flex gap-2">
                <Input
                  value={namaDokter || kodeDokter}
                  placeholder="Pilih dokter..."
                  readOnly
                  className="bg-white flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setDokterModalOpen(true)}
                  disabled={isDisabled || !kodePoli}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {!kodePoli && (
                <p className="text-xs text-muted-foreground">Pilih poli terlebih dahulu</p>
              )}
            </div>
          </div>

          {/* PRB Section - Only for Surat Kontrol v2 */}
          {!isRawatInap && version === "v2" && (
            <div className="space-y-4 p-4 bg-white/60 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-green-600" />
                  <Label className="text-sm font-medium">Program Rujuk Balik (PRB)</Label>
                </div>
                <Switch
                  checked={isPRB}
                  onCheckedChange={setIsPRB}
                  disabled={isDisabled}
                />
              </div>

              {isPRB && (
                <div className="space-y-4">
                  {/* Status PRB */}
                  <div className="space-y-2">
                    <Label className="text-sm">Jenis Penyakit PRB</Label>
                    <Select value={kdStatusPRB} onValueChange={setKdStatusPRB} disabled={isDisabled}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Pilih jenis penyakit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRB_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.kode} value={opt.kode}>
                            {opt.kode} - {opt.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* PRB Fields based on selected status */}
                  {kdStatusPRB && PRB_FIELDS[kdStatusPRB] && (
                    <div className="grid grid-cols-2 gap-3">
                      {PRB_FIELDS[kdStatusPRB].map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          {field.type === "boolean" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!!dataPRB[field.key]}
                                onCheckedChange={(val) => handlePRBFieldChange(field.key, val ? 1 : 0)}
                                disabled={isDisabled}
                              />
                              <span className="text-xs text-muted-foreground">
                                {dataPRB[field.key] ? "Ya" : "Tidak"}
                              </span>
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min={field.min}
                              max={field.max}
                              step="0.1"
                              value={(dataPRB[field.key] as number) || ""}
                              onChange={(e) => handlePRBFieldChange(field.key, parseFloat(e.target.value))}
                              placeholder={`${field.min} - ${field.max}`}
                              className="bg-white h-8 text-sm"
                              disabled={isDisabled}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || isDisabled || !kodePoli || !kodeDokter}
            className={`w-full ${isRawatInap ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Buat {isRawatInap ? "SPRI" : "Surat Kontrol"}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info text when toggle is off */}
      {!wantsBPJSControl && !hasResult && (
        <p className={`text-sm ${isRawatInap ? "text-blue-600" : "text-green-600"}`}>
          {isRawatInap 
            ? "Aktifkan untuk membuat SPRI (wajib untuk rawat inap BPJS)"
            : "Aktifkan jika ingin membuat surat kontrol BPJS untuk kunjungan ulang"
          }
        </p>
      )}

      {/* Search Modals */}
      <SearchModal
        open={poliModalOpen}
        onOpenChange={setPoliModalOpen}
        title={`Cari Poli ${isRawatInap ? "SPRI" : "Kontrol"}`}
        placeholder="Ketik nama poli..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Poli" },
        ]}
        onSearch={handleSearchPoli}
        onSelect={(item: VClaimRefPoli) => {
          setKodePoli(item.kode);
          setNamaPoli(item.nama);
          // Reset dokter
          setKodeDokter("");
          setNamaDokter("");
        }}
      />

      <SearchModal
        open={dokterModalOpen}
        onOpenChange={setDokterModalOpen}
        title={`Cari Dokter ${isRawatInap ? "SPRI" : "Kontrol"}`}
        placeholder="Ketik nama dokter..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Dokter" },
        ]}
        onSearch={handleSearchDokter}
        onSelect={(item: VClaimRefDokter) => {
          setKodeDokter(item.kode);
          setNamaDokter(item.nama);
        }}
      />
    </div>
  );
}
