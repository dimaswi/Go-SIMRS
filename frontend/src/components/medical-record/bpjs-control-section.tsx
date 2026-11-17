import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
  FileCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  UserCheck,
  Pill,
  Pencil,
  Trash2,
  Unlink2,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type VClaimSPRIResponse,
  type SuratKontrolResponse,
  type PRBFormData,
} from "@/lib/api/vclaim";
import { PoliDokterSelector } from "@/components/sep/poli-dokter-selector";

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
  onSuratKontrolCleared?: () => void;
  className?: string;
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
  onSuratKontrolCleared,
  className,
}: BPJSControlSectionProps) {
  const { toast } = useToast();
  const isRawatInap = dispositionType === "rawat_inap";
  const defaultTanggalKontrol = isRawatInap
    ? format(new Date(), "yyyy-MM-dd")
    : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  // Common state
  const [loading, setLoading] = useState(false);
  const [checkingPeserta, setCheckingPeserta] = useState(false);
  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);

  // Toggle state - apakah user ingin membuat BPJS control
  const [wantsBPJSControl, setWantsBPJSControl] = useState(false);

  // Form state - untuk SPRI dan Surat Kontrol
  const [tglRencanaKontrol, setTglRencanaKontrol] = useState(defaultTanggalKontrol);
  const [kodePoli, setKodePoli] = useState("");
  const [namaPoli, setNamaPoli] = useState("");
  const [kodeDokter, setKodeDokter] = useState("");
  const [namaDokter, setNamaDokter] = useState("");

  // Surat Kontrol specific - version and PRB
  const [version, setVersion] = useState<"v1" | "v2">("v1");
  const [isPRB, setIsPRB] = useState(false);
  const [kdStatusPRB, setKdStatusPRB] = useState("");
  const [dataPRB, setDataPRB] = useState<PRBFormData>({});

  // Modal state (managed by PoliDokterSelector now)

  // Result state
  const [spriResult, setSPRIResult] = useState<VClaimSPRIResponse | null>(existingSPRI || null);
  const [suratKontrolResult, setSuratKontrolResult] = useState<SuratKontrolResponse | null>(existingSuratKontrol || null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [deletingExisting, setDeletingExisting] = useState(false);
  const [unlinkingExisting, setUnlinkingExisting] = useState(false);

  useEffect(() => {
    setSPRIResult(existingSPRI || null);
  }, [existingSPRI]);

  useEffect(() => {
    setSuratKontrolResult(existingSuratKontrol || null);
  }, [existingSuratKontrol]);

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

  const startEditSuratKontrol = async () => {
    if (!suratKontrolResult) return;
    try {
      const localRes = await vclaimApi.getSuratKontrolLocal(suratKontrolResult.noSuratKontrol);
      const local = localRes.data.data;
      setTglRencanaKontrol(local.tgl_rencana_kontrol || suratKontrolResult.tglRencanaKontrol || defaultTanggalKontrol);
      setKodePoli(local.kode_poli || "");
      setNamaPoli(local.nama_poli || "");
      setKodeDokter(local.kode_dokter || "");
      setNamaDokter(local.nama_dokter || suratKontrolResult.namaDokter || "");
      setWantsBPJSControl(true);
      setIsEditingExisting(true);
    } catch (err: any) {
      toast({
        title: "Gagal membuka mode edit",
        description: err?.response?.data?.error || err?.message || "Detail Surat Kontrol lokal tidak ditemukan.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSuratKontrol = async () => {
    if (!suratKontrolResult?.noSuratKontrol) return;
    if (!window.confirm(`Hapus Surat Kontrol BPJS ${suratKontrolResult.noSuratKontrol}?`)) return;

    setDeletingExisting(true);
    try {
      await vclaimApi.deleteSuratKontrol(suratKontrolResult.noSuratKontrol);
      setSuratKontrolResult(null);
      setIsEditingExisting(false);
      setWantsBPJSControl(true);
      onSuratKontrolCleared?.();
      toast({
        title: "Berhasil",
        description: "Surat Kontrol BPJS berhasil dihapus.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal menghapus Surat Kontrol",
        description: err?.response?.data?.error || err?.message || "Terjadi kesalahan saat menghapus Surat Kontrol.",
        variant: "destructive",
      });
    } finally {
      setDeletingExisting(false);
    }
  };

  const handleUnlinkSuratKontrol = async () => {
    if (!suratKontrolResult?.noSuratKontrol) return;
    if (!window.confirm(`Unlink Surat Kontrol lokal ${suratKontrolResult.noSuratKontrol}? Data BPJS tidak akan dihapus.`)) return;

    setUnlinkingExisting(true);
    try {
      await vclaimApi.deleteSuratKontrolLocal(suratKontrolResult.noSuratKontrol);
      setSuratKontrolResult(null);
      setIsEditingExisting(false);
      setWantsBPJSControl(true);
      onSuratKontrolCleared?.();
      toast({
        title: "Berhasil",
        description: "Surat Kontrol berhasil di-unlink dari sistem lokal.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal unlink Surat Kontrol",
        description: err?.response?.data?.error || err?.message || "Terjadi kesalahan saat unlink Surat Kontrol.",
        variant: "destructive",
      });
    } finally {
      setUnlinkingExisting(false);
    }
  };

  // Submit function
  const handleSubmit = async () => {
    const isLocalOnly = !patient?.no_bpjs || (!isRawatInap && !activeSEP);

    if (isRawatInap) {
      // For SPRI, we only need patient with no_bpjs (SEP is optional) for BPJS SPRI
      // But now we allow local SPRI for non-BPJS
    } else {
      // For Surat Kontrol BPJS we need both patient and SEP.
      // Now we allow local Surat Kontrol for non-BPJS.
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
        const noKartu = activeSEP?.no_kartu || patient?.no_bpjs || "";

        if (isLocalOnly) {
          const res = await vclaimApi.createLocalSPRI({
            no_kartu: noKartu,
            nama: patient?.nama_lengkap || "",
            kelamin: patient?.jenis_kelamin || "",
            tgl_lahir: patient?.tanggal_lahir || "",
            visit_id: visitId,
            registration_id: activeSEP?.registration_id || 0,
            sep_id: activeSEP?.id || 0,
            tgl_rencana_kontrol: tglRencanaKontrol,
            poli_kontrol: kodePoli,
            nama_poli: namaPoli,
            kode_dokter: kodeDokter,
            nama_dokter: namaDokter,
            nama_diagnosa: "", // Can be filled if needed
          });

          if (res.data.data) {
            const localSPRI = res.data.data;
            const mappedResult: VClaimSPRIResponse = {
              noSPRI: localSPRI.no_spri,
              tglRencanaKontrol: localSPRI.tgl_rencana_kontrol,
              namaDokter: localSPRI.nama_dokter,
              noKartu: localSPRI.no_kartu,
              nama: localSPRI.nama,
              kelamin: localSPRI.kelamin,
              tglLahir: localSPRI.tgl_lahir,
              namaDiagnosa: localSPRI.nama_diagnosa,
            };
            setSPRIResult(mappedResult);
            onSPRICreated?.(mappedResult);
            toast({
              title: "SPRI Lokal Berhasil Dibuat",
              description: `No. SPRI: ${mappedResult.noSPRI}`,
            });
          }
        } else {
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
              title: "SPRI BPJS Berhasil Dibuat",
              description: `No. SPRI: ${res.data.data.noSPRI}`,
            });
          }
        }
      } else {
        if (suratKontrolResult && isEditingExisting && !isLocalOnly) {
          const res = await vclaimApi.updateSuratKontrol(suratKontrolResult.noSuratKontrol, {
            kode_dokter: kodeDokter,
            nama_dokter: namaDokter,
            poli_kontrol: kodePoli,
            nama_poli: namaPoli,
            tgl_rencana_kontrol: tglRencanaKontrol,
          });

          if (res.data.data) {
            setSuratKontrolResult(res.data.data);
            onSuratKontrolCreated?.(res.data.data);
            setIsEditingExisting(false);
            toast({
              title: "Surat Kontrol Berhasil Diperbarui",
              description: `No. Surat Kontrol: ${res.data.data.noSuratKontrol}`,
            });
          }
          return;
        }

        if (isLocalOnly) {
          const noKartu = activeSEP?.no_kartu || patient?.no_bpjs || "";
          const res = await vclaimApi.createLocalSuratKontrol({
            no_kartu: noKartu,
            nama: patient?.nama_lengkap || "",
            kelamin: patient?.jenis_kelamin || "",
            tgl_lahir: patient?.tanggal_lahir || "",
            visit_id: visitId,
            registration_id: activeSEP?.registration_id || 0,
            sep_id: activeSEP?.id || 0,
            tgl_rencana_kontrol: tglRencanaKontrol,
            poli_kontrol: kodePoli,
            nama_poli: namaPoli,
            kode_dokter: kodeDokter,
            nama_dokter: namaDokter,
            nama_diagnosa: "",
          });

          if (res.data.data) {
            const localSK = res.data.data;
            const mappedSK: SuratKontrolResponse = {
              noSuratKontrol: localSK.no_surat_kontrol,
              tglRencanaKontrol: localSK.tgl_rencana_kontrol,
              namaDokter: localSK.nama_dokter,
              noKartu: localSK.no_kartu,
              nama: localSK.nama,
              kelamin: localSK.kelamin,
              tglLahir: localSK.tgl_lahir,
              namaDiagnosa: localSK.nama_diagnosa,
            };
            setSuratKontrolResult(mappedSK);
            onSuratKontrolCreated?.(mappedSK);
            toast({
              title: "Surat Kontrol Lokal Berhasil Dibuat",
              description: `No. Surat Kontrol: ${mappedSK.noSuratKontrol}`,
            });
          }
        } else {
          // Create Surat Kontrol BPJS - requires SEP
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
              title: "Surat Kontrol BPJS Berhasil Dibuat",
              description: `No. Surat Kontrol: ${res.data.data.noSuratKontrol}`,
            });
          }
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

  // Already has result
  const hasResult = isRawatInap ? !!spriResult : !!suratKontrolResult;

  return (
    <div className={className || "space-y-3"}>
      {hasResult ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-foreground">
                {isRawatInap ? "SPRI" : "Surat Kontrol"} BPJS Terbit
              </span>
              <Badge variant="outline" className="h-5 px-2 font-mono text-[10px]">
                {isRawatInap ? spriResult?.noSPRI : suratKontrolResult?.noSuratKontrol}
              </Badge>
            </div>

            {!isRawatInap && suratKontrolResult && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={startEditSuratKontrol}
                  disabled={isDisabled || deletingExisting || unlinkingExisting}
                  title="Edit Surat Kontrol"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={handleDeleteSuratKontrol}
                  disabled={isDisabled || deletingExisting || unlinkingExisting}
                  title="Hapus Surat Kontrol"
                >
                  {deletingExisting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleUnlinkSuratKontrol}
                  disabled={isDisabled || deletingExisting || unlinkingExisting}
                  title="Putuskan Tautan"
                >
                  {unlinkingExisting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-l-2 border-emerald-500 bg-emerald-50/40 px-3 py-2 text-xs md:grid-cols-4">
            {activeSEP ? (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No. SEP</span>
                  <div className="font-mono font-medium text-foreground">{activeSEP.no_sep || "-"}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No. Kartu</span>
                  <div className="font-mono font-medium text-foreground">{activeSEP.no_kartu || "-"}</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pasien</span>
                  <div className="font-medium text-foreground">{patient?.nama_lengkap || "-"}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No. Kartu</span>
                  <div className="font-mono font-medium text-foreground">{patient?.no_bpjs || "-"}</div>
                </div>
              </>
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tgl Kontrol</span>
              <div className="font-medium text-foreground">
                {(isRawatInap ? spriResult?.tglRencanaKontrol : suratKontrolResult?.tglRencanaKontrol) || "-"}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Dokter</span>
              <div className="font-medium text-foreground truncate">
                {(isRawatInap ? spriResult?.namaDokter : suratKontrolResult?.namaDokter) || "-"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Switch
              id="wants-bpjs"
              checked={wantsBPJSControl}
              onCheckedChange={setWantsBPJSControl}
              disabled={isDisabled}
            />
            <Label htmlFor="wants-bpjs" className="text-xs font-medium text-foreground cursor-pointer">
              {isRawatInap ? "Buat SPRI BPJS" : "Buat Surat Kontrol BPJS"}
            </Label>

            {wantsBPJSControl && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">•</span>
                {checkingPeserta ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Mengecek kepesertaan...
                  </span>
                ) : pesertaError ? (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    {pesertaError}
                  </span>
                ) : peserta ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <UserCheck className="h-3.5 w-3.5" />
                    {peserta.nama} ({peserta.statusPeserta?.keterangan || "Aktif"})
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {wantsBPJSControl && !isRawatInap && (
            <div className="inline-flex items-center rounded-md border border-border/60 bg-muted p-0.5">
              <button
                type="button"
                onClick={() => { setVersion("v1"); setIsPRB(false); }}
                disabled={isDisabled}
                className={cn(
                  "h-6 rounded-sm px-2.5 text-xs font-medium transition-colors",
                  version === "v1"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                V1 (Standar)
              </button>
              <button
                type="button"
                onClick={() => setVersion("v2")}
                disabled={isDisabled}
                className={cn(
                  "h-6 rounded-sm px-2.5 text-xs font-medium transition-colors",
                  version === "v2"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                V2 (PRB)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form - only show if toggle is on and no result yet */}
      {wantsBPJSControl && (!hasResult || isEditingExisting) && (
        <div className="space-y-2.5 pt-1">
          <div className="space-y-1">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Tanggal {isRawatInap ? "Rawat Inap" : "Rencana Kontrol"}
            </Label>
            <Input
              type="date"
              value={tglRencanaKontrol}
              onChange={(e) => setTglRencanaKontrol(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              disabled={isDisabled}
              className="h-8 w-full text-xs rounded-md"
            />
          </div>

          {/* Poli & Dokter Selector with Tabs */}
          <PoliDokterSelector
            kodePoli={kodePoli}
            namaPoli={namaPoli}
            kodeDokter={kodeDokter}
            namaDokter={namaDokter}
            tglRencanaKontrol={tglRencanaKontrol}
            onPoliChange={(kode, nama) => {
              setKodePoli(kode);
              setNamaPoli(nama);
              setKodeDokter("");
              setNamaDokter("");
            }}
            onDokterChange={(kode, nama) => {
              setKodeDokter(kode);
              setNamaDokter(nama);
            }}
            searchPoliBPJS={handleSearchPoli}
            searchDokterBPJS={handleSearchDokter}
            poliModalTitle={`Cari Poli ${isRawatInap ? "SPRI" : "Kontrol"} BPJS`}
            dokterModalTitle={`Cari Dokter ${isRawatInap ? "SPRI" : "Kontrol"} BPJS`}
            disabled={isDisabled}
            compact
          />

          {/* PRB Section - Only for Surat Kontrol v2 */}
          {!isRawatInap && version === "v2" && (
            <div className="border-t border-border/60 pt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium">Program Rujuk Balik (PRB)</Label>
                </div>
                <Switch
                  checked={isPRB}
                  onCheckedChange={setIsPRB}
                  disabled={isDisabled}
                />
              </div>

              {isPRB && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Jenis Penyakit PRB</Label>
                      <Select value={kdStatusPRB} onValueChange={setKdStatusPRB} disabled={isDisabled}>
                        <SelectTrigger className="h-8 text-xs rounded-md">
                          <SelectValue placeholder="Pilih jenis penyakit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PRB_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.kode} value={opt.kode} className="text-xs">
                              {opt.kode} - {opt.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {kdStatusPRB && PRB_FIELDS[kdStatusPRB] && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                      {PRB_FIELDS[kdStatusPRB].map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          {field.type === "boolean" ? (
                            <div className="flex items-center gap-2 h-8">
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
                              className="h-8 text-xs rounded-md"
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
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={loading || isDisabled || !kodePoli || !kodeDokter}
              className="h-8 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                  Buat {isRawatInap ? "SPRI" : "Surat Kontrol"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Info text when toggle is off */}
      {!wantsBPJSControl && !hasResult && (
        <p className="text-xs text-muted-foreground">
          {isRawatInap
            ? "Aktifkan bridging untuk membuat SPRI (wajib pada rawat inap BPJS)."
            : "Aktifkan bridging jika ingin membuat surat kontrol BPJS untuk kunjungan ulang."}
        </p>
      )}
    </div>
  );
}
