import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Stethoscope,
  Building2,
  HeartPulse,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type SuratKontrolResponse,
  type PRBStatusOption,
  type PRBFormData,
} from "@/lib/api/vclaim";
import { SearchModal } from "./search-modal";

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

  // Modal states
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [dokterModalOpen, setDokterModalOpen] = useState(false);

  // Form fields
  const [tglRencanaKontrol, setTglRencanaKontrol] = useState("");
  const [kodePoli, setKodePoli] = useState("");
  const [namaPoli, setNamaPoli] = useState("");
  const [kodeDokter, setKodeDokter] = useState("");
  const [namaDokter, setNamaDokter] = useState("");

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
      });

      const data = res.data.data;

      toast({
        title: "Surat Kontrol Berhasil Dibuat",
        description: `No. Surat Kontrol: ${data.noSuratKontrol}`,
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
        <SheetContent className="w-[50%] sm:max-w-[50%] flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b bg-green-50/50">
            <SheetTitle className="flex items-center gap-2 text-green-800">
              <FileCheck className="h-5 w-5" />
              Buat Surat Kontrol (SKDP)
            </SheetTitle>
            <SheetDescription>
              Surat kontrol untuk pasien <strong>{patient.nama_lengkap}</strong> (RM: {patient.no_rm})
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {/* === SEP AKTIF === */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Data SEP Aktif</h3>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-green-600 font-medium">No. SEP</span>
                      <p className="font-bold text-green-800">{activeSEP.no_sep}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600 font-medium">No. Kartu BPJS</span>
                      <p className="font-bold text-green-800">{activeSEP.no_kartu}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600 font-medium">Tanggal SEP</span>
                      <p className="font-medium">{activeSEP.tgl_sep}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600 font-medium">Poli Asal</span>
                      <p className="font-medium">{activeSEP.nama_poli || activeSEP.kode_poli || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-green-600 font-medium">Diagnosa Awal</span>
                      <p className="font-medium">{activeSEP.nama_diagnosa || activeSEP.diag_awal || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* === KEPESERTAAN === */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Kepesertaan BPJS</h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleCekPeserta} 
                    disabled={loadingPeserta}
                    className="h-8 px-3"
                  >
                    {loadingPeserta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    Cek Ulang
                  </Button>
                </div>

                {loadingPeserta && (
                  <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Mengecek kepesertaan...</span>
                  </div>
                )}

                {/* Status Peserta */}
                {peserta && !loadingPeserta && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">{peserta.nama}</span>
                      <Badge variant="default" className="text-xs bg-green-600">{peserta.statusPeserta?.keterangan}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-700">
                      <span>NIK: {peserta.nik}</span>
                      <span>Kelas Hak: {peserta.hakKelas?.keterangan}</span>
                      <span>Jenis: {peserta.jenisPeserta?.keterangan}</span>
                      <span>Faskes: {peserta.provUmum?.nmProvider || "-"}</span>
                    </div>
                  </div>
                )}
                {pesertaError && !loadingPeserta && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700">{pesertaError}</span>
                  </div>
                )}
              </div>

              {/* === FORM SURAT KONTROL === */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Data Rencana Kontrol</h3>
                
                {/* Tanggal Rencana Kontrol */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
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
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tanggal kontrol bisa hari ini atau hari berikutnya
                  </p>
                </div>

                {/* Poli Kontrol */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Poli Kontrol <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={namaPoli ? `${kodePoli} - ${namaPoli}` : ""}
                      placeholder="Pilih poli kontrol"
                      readOnly
                      className="h-10 bg-muted/50 cursor-pointer"
                      onClick={() => setPoliModalOpen(true)}
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setPoliModalOpen(true)}
                      className="h-10 px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Dokter Kontrol */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Dokter Kontrol <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={namaDokter ? `${kodeDokter} - ${namaDokter}` : ""}
                      placeholder={kodePoli && tglRencanaKontrol ? "Pilih dokter kontrol" : "Pilih poli & tanggal dulu"}
                      readOnly
                      className="h-10 bg-muted/50 cursor-pointer"
                      onClick={() => kodePoli && tglRencanaKontrol && setDokterModalOpen(true)}
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setDokterModalOpen(true)}
                      disabled={!kodePoli || !tglRencanaKontrol}
                      className="h-10 px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {(!kodePoli || !tglRencanaKontrol) && (
                    <p className="text-xs text-amber-600">
                      Pilih poli dan tanggal kontrol terlebih dahulu untuk mencari dokter
                    </p>
                  )}
                </div>
              </div>

              {/* === PRB (Program Rujuk Balik) === */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <HeartPulse className="h-4 w-4" />
                    Program Rujuk Balik (PRB)
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
                  <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
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
                                  <SelectTrigger className="h-9">
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
                                  className="h-9"
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

              {/* === INFO RINGKASAN === */}
              {tglRencanaKontrol && kodePoli && kodeDokter && (
                <Alert className="bg-green-50 border-green-200">
                  <ClipboardList className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700">Ringkasan Surat Kontrol</AlertTitle>
                  <AlertDescription className="text-green-700 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Tanggal Kontrol: <strong>{tglRencanaKontrol}</strong></div>
                      <div>Poli: <strong>{namaPoli || kodePoli}</strong></div>
                      <div className="col-span-2">Dokter: <strong>{namaDokter || kodeDokter}</strong></div>
                      {isPRB && kdStatusPRB && (
                        <div className="col-span-2">
                          PRB: <strong>{prbOptions.find(p => p.kode === kdStatusPRB)?.nama || kdStatusPRB}</strong>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitSuratKontrol}
              disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter || (isPRB && !kdStatusPRB)}
              className="bg-green-600 hover:bg-green-700"
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

      {/* Modal Search Poli */}
      <SearchModal
        open={poliModalOpen}
        onOpenChange={setPoliModalOpen}
        title="Cari Poli Kontrol"
        placeholder="Ketik nama poli..."
        columns={[
          { key: "kode", label: "Kode", width: "120px" },
          { key: "nama", label: "Nama Poli" },
        ]}
        onSearch={handleSearchPoli}
        onSelect={(item) => {
          setKodePoli(item.kode);
          setNamaPoli(item.nama);
          // Reset dokter when poli changes
          setKodeDokter("");
          setNamaDokter("");
        }}
      />

      {/* Modal Search Dokter */}
      <SearchModal
        open={dokterModalOpen}
        onOpenChange={setDokterModalOpen}
        title="Cari Dokter Kontrol"
        placeholder="Ketik nama dokter..."
        columns={[
          { key: "kode", label: "Kode", width: "120px" },
          { key: "nama", label: "Nama Dokter" },
        ]}
        onSearch={handleSearchDokter}
        onSelect={(item) => {
          setKodeDokter(item.kode);
          setNamaDokter(item.nama);
        }}
      />
    </>
  );
}
