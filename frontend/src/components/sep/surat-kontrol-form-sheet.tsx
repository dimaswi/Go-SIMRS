import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  ClipboardList,
  Calendar,
  HeartPulse,
  Smartphone,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type SuratKontrolResponse,
  type PRBStatusOption,
  type PRBFormData,
} from "@/lib/api/vclaim";
import { PoliDokterSelector } from "./poli-dokter-selector";
import {
  BPJS_FIELD_CLASS,
  BPJS_FOOTER_CLASS,
  BPJSInfoGrid,
  BPJS_MUTED_PANEL_CLASS,
  BPJS_PANEL_CLASS,
  BPJS_SECTION_CLASS,
  BPJSSectionHeader,
  BPJSSheetHero,
  BPJSStatePanel,
  BPJS_SHEET_MONO_FAMILY,
} from "./bpjs-sheet-chrome";

interface SuratKontrolFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSEP: SEPLocal;
  patient: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  };
  visitId: number;
  onSuratKontrolCreated?: (data: SuratKontrolResponse) => void;
}

// PRB field definitions per status
const PRB_FIELDS: Record<string, { field: keyof PRBFormData; label: string; type: "number" | "boolean"; min?: number; max?: number }[]> = {
  "01": [ // Diabetes Melitus
    { field: "HBA1C", label: "HbA1C", type: "number", min: 0.1, max: 15 },
    { field: "GDP", label: "GDP (mg/dL)", type: "number", min: 10, max: 500 },
    { field: "GD2JPP", label: "GD 2 Jam PP (mg/dL)", type: "number", min: 10, max: 500 },
    { field: "eGFR", label: "eGFR", type: "number", min: 5, max: 150 },
    { field: "TD_Sistolik", label: "TD Sistolik", type: "number", min: 20, max: 200 },
    { field: "TD_Diastolik", label: "TD Diastolik", type: "number", min: 20, max: 200 },
    { field: "LDL", label: "LDL (mg/dL)", type: "number", min: 20, max: 500 },
  ],
  "02": [ // Hipertensi
    { field: "eGFR", label: "eGFR", type: "number", min: 5, max: 150 },
    { field: "Rata_TD_Sistolik", label: "Rata-rata TD Sistolik", type: "number", min: 20, max: 200 },
    { field: "Rata_TD_Diastolik", label: "Rata-rata TD Diastolik", type: "number", min: 20, max: 200 },
    { field: "JantungKoroner", label: "Penyakit Jantung Koroner", type: "boolean" },
    { field: "Stroke", label: "Stroke", type: "boolean" },
    { field: "VaskularPerifer", label: "Penyakit Vaskular Perifer", type: "boolean" },
    { field: "Aritmia", label: "Aritmia", type: "boolean" },
    { field: "AtrialFibrilasi", label: "Atrial Fibrilasi", type: "boolean" },
  ],
  "03": [ // Asma
    { field: "Terkontrol", label: "Terkontrol", type: "boolean" },
    { field: "Gejala2xMinggu", label: "Gejala > 2x/Minggu", type: "boolean" },
    { field: "BangunMalam", label: "Bangun Malam", type: "boolean" },
    { field: "KeterbatasanFisik", label: "Keterbatasan Fisik", type: "boolean" },
    { field: "FungsiParu", label: "Fungsi Paru (%)", type: "number", min: 0, max: 100 },
  ],
  "04": [ // Penyakit Jantung
    { field: "Rata_TD_Sistolik", label: "Rata-rata TD Sistolik", type: "number", min: 20, max: 200 },
    { field: "Rata_TD_Diastolik", label: "Rata-rata TD Diastolik", type: "number", min: 20, max: 200 },
    { field: "Aritmia", label: "Aritmia", type: "boolean" },
    { field: "NadiIstirahat", label: "Nadi Istirahat", type: "number", min: 20, max: 200 },
    { field: "SesakNapas3Bulan", label: "Sesak Napas 3 Bulan Terakhir", type: "boolean" },
    { field: "NyeriDada3Bulan", label: "Nyeri Dada 3 Bulan Terakhir", type: "boolean" },
    { field: "SesakNapasAktivitas", label: "Sesak Napas saat Aktivitas", type: "boolean" },
    { field: "NyeriDadaAktivitas", label: "Nyeri Dada saat Aktivitas", type: "boolean" },
  ],
  "05": [ // PPOK
    { field: "SkorMMRC", label: "Skor mMRC", type: "number", min: 0, max: 40 },
    { field: "Eksaserbasi1Tahun", label: "Eksaserbasi 1 Tahun Terakhir", type: "boolean" },
    { field: "MampuAktivitas", label: "Mampu Aktivitas", type: "boolean" },
  ],
  "06": [ // Skizofrenia
    { field: "Remisi", label: "Remisi (%)", type: "number", min: 0, max: 100 },
    { field: "TerapiRumatan", label: "Terapi Rumatan", type: "boolean" },
    { field: "Usia", label: "Usia (tahun)", type: "number", min: 1, max: 100 },
  ],
  "07": [ // Stroke
    { field: "GDP", label: "GDP (mg/dL)", type: "number", min: 10, max: 500 },
    { field: "TD_Sistolik", label: "TD Sistolik", type: "number", min: 20, max: 200 },
    { field: "TD_Diastolik", label: "TD Diastolik", type: "number", min: 20, max: 200 },
    { field: "LDL", label: "LDL (mg/dL)", type: "number", min: 20, max: 500 },
    { field: "AsamUrat", label: "Asam Urat (mg/dL)", type: "number", min: 0.1, max: 20 },
  ],
  "08": [ // Epilepsi
    { field: "Epileptik6Bulan", label: "Serangan Epileptik 6 Bulan Terakhir", type: "boolean" },
    { field: "EfekSampingOAB", label: "Efek Samping OAB", type: "boolean" },
    { field: "HamilMenyusui", label: "Hamil/Menyusui", type: "boolean" },
  ],
  "09": [ // SLE
    { field: "RemisiSLE", label: "Remisi SLE (%)", type: "number", min: 0, max: 100 },
    { field: "Hamil", label: "Hamil", type: "boolean" },
  ],
};

export function SuratKontrolFormSheet({
  open,
  onOpenChange,
  activeSEP,
  patient,
  visitId,
  onSuratKontrolCreated,
}: SuratKontrolFormSheetProps) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  // Loading states
  const [loadingPeserta, setLoadingPeserta] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Peserta state
  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);

  // Modal states (managed by PoliDokterSelector now)

  // Form fields
  const [tglRencanaKontrol, setTglRencanaKontrol] = useState("");
  const [kodePoli, setKodePoli] = useState("");
  const [namaPoli, setNamaPoli] = useState("");
  const [kodeDokter, setKodeDokter] = useState("");
  const [namaDokter, setNamaDokter] = useState("");

  // Antrean MJKN
  const [buatkanAntrean, setBuatkanAntrean] = useState(false);

  // PRB fields
  const [isPRB, setIsPRB] = useState(false);
  const [prbOptions, setPrbOptions] = useState<PRBStatusOption[]>([]);
  const [kdStatusPRB, setKdStatusPRB] = useState("");
  const [dataPRB, setDataPRB] = useState<PRBFormData>({});

  // Track apakah sudah fetch kepesertaan untuk mencegah loop
  const hasFetchedRef = useRef(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      hasFetchedRef.current = false;
      // Reset semua state
      setPeserta(null);
      setPesertaError(null);
      setTglRencanaKontrol("");
      setKodePoli("");
      setNamaPoli("");
      setKodeDokter("");
      setNamaDokter("");
      setBuatkanAntrean(false);
      setIsPRB(false);
      setKdStatusPRB("");
      setDataPRB({});
      // Fetch PRB options
      fetchPRBOptions();
    } else {
      hasFetchedRef.current = false;
    }
  }, [open]);

  // Auto fetch kepesertaan saat drawer buka (sekali saja)
  useEffect(() => {
    if (open && activeSEP?.no_kartu && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchKepesertaan(activeSEP.no_kartu, today);
    }
  }, [open, activeSEP?.no_kartu]);

  // Fetch PRB options
  const fetchPRBOptions = async () => {
    try {
      const res = await vclaimApi.getPRBOptions();
      setPrbOptions(res.data.data || []);
    } catch {
      // Use default options
      setPrbOptions([
        { kode: "01", nama: "Diabetes Melitus" },
        { kode: "02", nama: "Hipertensi" },
        { kode: "03", nama: "Asma" },
        { kode: "04", nama: "Penyakit Jantung" },
        { kode: "05", nama: "PPOK" },
        { kode: "06", nama: "Skizofrenia" },
        { kode: "07", nama: "Stroke" },
        { kode: "08", nama: "Epilepsi" },
        { kode: "09", nama: "SLE" },
      ]);
    }
  };

  // Function untuk fetch kepesertaan
  const fetchKepesertaan = async (kartuBpjs: string, tglPelayanan: string) => {
    setLoadingPeserta(true);
    setPesertaError(null);
    try {
      const res = await vclaimApi.getPesertaByNoKartu(kartuBpjs, tglPelayanan);
      const data = res.data.data;
      if (!data) throw new Error("Data peserta tidak ditemukan");

      setPeserta(data);

      toast({
        title: "Peserta Ditemukan",
        description: `${data.nama || 'N/A'} - ${data.statusPeserta?.keterangan || 'N/A'} - Kelas ${data.hakKelas?.keterangan || 'N/A'}`,
      });
    } catch (error: unknown) {
      setPeserta(null);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setPesertaError(err.response?.data?.error || err.message || "Gagal mengambil data peserta");
    } finally {
      setLoadingPeserta(false);
    }
  };

  // Handler untuk tombol cek peserta manual
  const handleCekPeserta = () => {
    if (!activeSEP?.no_kartu) {
      toast({ variant: "destructive", title: "Error", description: "Data SEP tidak valid" });
      return;
    }
    fetchKepesertaan(activeSEP.no_kartu, today);
  };

  // Search Poli untuk Surat Kontrol (rawat jalan)
  const handleSearchPoli = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoliSuratKontrol(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  // Search Dokter untuk Surat Kontrol
  const handleSearchDokter = async (keyword: string) => {
    if (!kodePoli || !tglRencanaKontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli dan tanggal kontrol terlebih dahulu" });
      return [];
    }
    try {
      const res = await vclaimApi.searchDokterSuratKontrol(kodePoli, tglRencanaKontrol);
      // Filter by keyword if needed
      const doctors = res.data.data || [];
      if (keyword) {
        return doctors.filter((d) =>
          d.nama.toLowerCase().includes(keyword.toLowerCase())
        );
      }
      return doctors;
    } catch {
      return [];
    }
  };

  // Handle PRB data change
  const handlePRBDataChange = (field: keyof PRBFormData, value: number | null) => {
    setDataPRB(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Submit Surat Kontrol
  const handleSubmitSuratKontrol = async () => {
    // Validasi
    if (!peserta) {
      toast({ variant: "destructive", title: "Error", description: "Data peserta BPJS tidak valid" });
      return;
    }
    if (!tglRencanaKontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih tanggal rencana kontrol" });
      return;
    }
    if (!kodePoli) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli kontrol" });
      return;
    }
    if (!kodeDokter) {
      toast({ variant: "destructive", title: "Error", description: "Pilih dokter kontrol" });
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await vclaimApi.createSuratKontrol({
        no_sep: activeSEP.no_sep,
        patient_id: patient.id,
        visit_id: visitId,
        registration_id: activeSEP.registration_id,
        sep_id: activeSEP.id,
        tgl_rencana_kontrol: tglRencanaKontrol,
        kode_poli: kodePoli,
        nama_poli: namaPoli,
        kode_dokter: kodeDokter,
        nama_dokter: namaDokter,
        is_prb: isPRB,
        kd_status_prb: isPRB ? kdStatusPRB : undefined,
        data_prb: isPRB && kdStatusPRB ? dataPRB : undefined,
        buatkan_antrean: buatkanAntrean,
      });

      const data = res.data.data;
      const antrean = res.data.antrean;

      // Build description with antrean info if available
      let toastDesc = `No. Surat Kontrol: ${data.noSuratKontrol}`;
      if (antrean) {
        if (antrean.success) {
          toastDesc += `\nAntrean MJKN: ${antrean.kode_booking} (No. ${antrean.nomor_antrean})`;
        } else {
          toastDesc += `\nAntrean MJKN gagal: ${antrean.message}`;
        }
      }

      toast({
        title: "Surat Kontrol Berhasil Dibuat",
        description: toastDesc,
        duration: antrean ? 8000 : 5000,
      });

      if (onSuratKontrolCreated) {
        onSuratKontrolCreated(data);
      }

      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      toast({
        variant: "destructive",
        title: "Gagal Membuat Surat Kontrol",
        description: err.response?.data?.error || err.message || "Terjadi kesalahan",
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    return format(new Date(), "yyyy-MM-dd");
  };

  // Get PRB fields for current status
  const currentPRBFields = kdStatusPRB ? PRB_FIELDS[kdStatusPRB] || [] : [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-[760px]">
          <BPJSSheetHero
            eyebrow="Bridging BPJS"
            title="Form Surat Kontrol"
            description={<><strong>{patient.nama_lengkap}</strong> • RM {patient.no_rm}</>}
            icon={FileCheck}
            meta={
              <Badge variant="outline" className="rounded-none px-2 py-1 text-[10px] uppercase tracking-[0.24em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                SKDP
              </Badge>
            }
          />

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-6">
              {/* === SEP AKTIF === */}
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Context" title="SEP Aktif" />
                <BPJSInfoGrid
                  items={[
                    { label: "No. SEP", value: activeSEP.no_sep, mono: true },
                    { label: "No. Kartu BPJS", value: activeSEP.no_kartu, mono: true },
                    { label: "Tanggal SEP", value: activeSEP.tgl_sep },
                    { label: "Poli Asal", value: activeSEP.nama_poli || activeSEP.kode_poli || "-" },
                    { label: "Diagnosa Awal", value: activeSEP.nama_diagnosa || activeSEP.diag_awal || "-", span: 2 },
                  ]}
                />
              </div>

              {/* === KEPESERTAAN === */}
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Verification" title="Kepesertaan BPJS" action={
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleCekPeserta} 
                    disabled={loadingPeserta}
                    className="h-8 rounded-none border-border/70 px-3"
                  >
                    {loadingPeserta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    Cek Ulang
                  </Button>
                } />

                {loadingPeserta && (
                  <BPJSStatePanel
                    icon={<Loader2 className="h-4 w-4 animate-spin" />}
                    title="Mengecek kepesertaan..."
                    description="Hak kelas dan status peserta sedang diverifikasi dari BPJS."
                  />
                )}

                {/* Status Peserta */}
                {peserta && !loadingPeserta && (
                  <BPJSStatePanel
                    tone="success"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{peserta.nama}</span>
                        <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.18em]">{peserta.statusPeserta?.keterangan}</Badge>
                      </div>
                    }
                    extra={
                      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>NIK: {peserta.nik}</span>
                        <span>Kelas Hak: {peserta.hakKelas?.keterangan}</span>
                        <span>Jenis: {peserta.jenisPeserta?.keterangan}</span>
                        <span>Faskes: {peserta.provUmum?.nmProvider || "-"}</span>
                      </div>
                    }
                  />
                )}
                {pesertaError && !loadingPeserta && (
                  <BPJSStatePanel tone="danger" icon={<XCircle className="h-4 w-4" />} title="Data peserta tidak dapat diverifikasi" description={pesertaError} />
                )}
              </div>

              {/* === FORM SURAT KONTROL === */}
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Planning" title="Rencana Kontrol" />
                
                {/* Tanggal Rencana Kontrol */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2 uppercase tracking-[0.14em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Tanggal Rencana Kontrol <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={tglRencanaKontrol}
                    onChange={(e) => {
                      setTglRencanaKontrol(e.target.value);
                      // Reset dokter when date changes
                      setKodeDokter("");
                      setNamaDokter("");
                    }}
                    min={getMinDate()}
                    className={BPJS_FIELD_CLASS}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tanggal kontrol bisa hari ini atau hari berikutnya
                  </p>
                </div>

                {/* Poli & Dokter Selector with Tabs */}
                <div className={`${BPJS_PANEL_CLASS} p-4`}>
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
                    poliModalTitle="Cari Poli Surat Kontrol BPJS"
                    dokterModalTitle="Cari Dokter Surat Kontrol BPJS"
                  />
                </div>
              </div>

              {/* === PRB (Program Rujuk Balik) === */}
              <div className={BPJS_SECTION_CLASS}>
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-[0.18em] text-foreground/80 flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <HeartPulse className="h-4 w-4" />
                    Program Rujuk Balik
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="is-prb" className="text-sm">Aktifkan PRB</Label>
                    <Switch
                      id="is-prb"
                      checked={isPRB}
                      onCheckedChange={(checked) => {
                        setIsPRB(checked);
                        if (!checked) {
                          setKdStatusPRB("");
                          setDataPRB({});
                        }
                      }}
                    />
                  </div>
                </div>

                {isPRB && (
                  <div className={`${BPJS_MUTED_PANEL_CLASS} space-y-4 p-4`}>
                    {/* Status PRB */}
                    <div className="space-y-2">
                      <Label className="text-sm">Jenis Penyakit PRB <span className="text-destructive">*</span></Label>
                      <Select value={kdStatusPRB} onValueChange={(value) => {
                        setKdStatusPRB(value);
                        setDataPRB({}); // Reset data when status changes
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Pilih jenis penyakit PRB" />
                        </SelectTrigger>
                        <SelectContent>
                          {prbOptions.map((opt) => (
                            <SelectItem key={opt.kode} value={opt.kode}>
                              {opt.kode} - {opt.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* PRB Data Fields */}
                    {kdStatusPRB && currentPRBFields.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Data Klinis</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {currentPRBFields.map((field) => (
                            <div key={field.field} className="space-y-1">
                              <Label className="text-xs">{field.label}</Label>
                              {field.type === "boolean" ? (
                                <Select
                                  value={dataPRB[field.field]?.toString() || ""}
                                  onValueChange={(value) => handlePRBDataChange(field.field, value === "" ? null : parseInt(value))}
                                >
                                  <SelectTrigger className="h-9 rounded-none border-border/70">
                                    <SelectValue placeholder="Pilih" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Tidak</SelectItem>
                                    <SelectItem value="1">Ya</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step="0.1"
                                  value={dataPRB[field.field] ?? ""}
                                  onChange={(e) => handlePRBDataChange(field.field, e.target.value === "" ? null : parseFloat(e.target.value))}
                                  placeholder={`${field.min} - ${field.max}`}
                                  className="h-9 rounded-none border-border/70"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* === ANTREAN MJKN (Optional) === */}
              <div className={BPJS_SECTION_CLASS}>
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-[0.18em] text-foreground/80 flex items-center gap-2" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <Smartphone className="h-4 w-4" />
                    Antrean Mobile JKN
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="buatkan-antrean" className="text-sm">Buatkan Antrean</Label>
                    <Switch
                      id="buatkan-antrean"
                      checked={buatkanAntrean}
                      onCheckedChange={setBuatkanAntrean}
                    />
                  </div>
                </div>
                {buatkanAntrean && (
                  <BPJSStatePanel
                    icon={<Smartphone className="h-4 w-4" />}
                    title="Antrean Mobile JKN akan dibuat"
                    description={
                      <>
                      Antrean akan didaftarkan ke BPJS Antrian Online sehingga pasien dapat melihat jadwal kontrol di aplikasi Mobile JKN.
                      Pastikan mapping poli dan dokter BPJS sudah dikonfigurasi.
                      </>
                    }
                  />
                )}
              </div>

              {/* === INFO RINGKASAN === */}
              {tglRencanaKontrol && kodePoli && kodeDokter && (
                <BPJSStatePanel
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Ringkasan Surat Kontrol"
                  extra={
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>Tanggal Kontrol: <strong>{tglRencanaKontrol}</strong></div>
                      <div>Poli: <strong>{namaPoli || kodePoli}</strong></div>
                      <div className="col-span-2">Dokter: <strong>{namaDokter || kodeDokter}</strong></div>
                      {isPRB && kdStatusPRB && (
                        <div className="col-span-2">
                          PRB: <strong>{prbOptions.find(p => p.kode === kdStatusPRB)?.nama || kdStatusPRB}</strong>
                        </div>
                      )}
                      <div className="col-span-2">
                        Antrean MJKN: <strong>{buatkanAntrean ? "Ya, buatkan antrean" : "Tidak"}</strong>
                      </div>
                    </div>
                  }
                />
              )}
            </div>
          </ScrollArea>

          <SheetFooter className={BPJS_FOOTER_CLASS}>
            <Button variant="outline" className="rounded-none border-border/70" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitSuratKontrol}
              disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter || (isPRB && !kdStatusPRB)}
              className="rounded-none"
            >
              {loadingSubmit ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Buat Surat Kontrol
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Search modals are now managed inside PoliDokterSelector */}
    </>
  );
}
