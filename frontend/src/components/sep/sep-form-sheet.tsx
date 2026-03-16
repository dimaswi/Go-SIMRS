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
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Calendar,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
} from "@/lib/api/vclaim";
import { SEP_OPTIONS, type SEPOptionItem } from "@/lib/sep-options";
import { formatPatientName } from "@/lib/print-utils";
import { SearchModal } from "./search-modal";
import { RujukanModal, type RujukanData } from "./rujukan-modal";
import { SKDPModal, type SKDPData } from "./skdp-modal";

// Helper to convert options to Combobox format
function toComboOptions(options: SEPOptionItem[]) {
  return options.map((opt) => ({ value: opt.kode, label: opt.nama }));
}

interface SEPFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik?: string;
    no_bpjs?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    no_telepon?: string;
    kelas_bpjs?: string;
    status_perkawinan?: string;
  };
  registrationId?: number;
  visitId?: number;
  onSEPCreated?: (noSEP: string, sepData: any) => void;
  // Override default submit behavior (vclaimApi.createSEP).
  // Receives the sepRequest object, should return { noSep: string } on success or throw on error.
  onSubmitOverride?: (sepRequest: Record<string, any>) => Promise<{ noSep: string }>;
  initialValues?: {
    kodePoli?: string;
    namaPoli?: string;
    kodeDokter?: string;
    namaDokter?: string;
    jenisPelayanan?: string;
    // Kontrol / SKDP fields
    noSuratKontrol?: string;
    noRujukan?: string;
    tglRujukan?: string;
    diagAwal?: string;
    namaDiagnosa?: string;
    asalRujukan?: string;
  };
}

export function SEPFormSheet({
  open,
  onOpenChange,
  patient,
  registrationId,
  visitId,
  onSEPCreated,
  onSubmitOverride,
  initialValues,
}: SEPFormSheetProps) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  // Loading states
  const [loadingPeserta, setLoadingPeserta] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Peserta state
  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);

  // Modal states
  const [rujukanModalOpen, setRujukanModalOpen] = useState(false);
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [dokterModalOpen, setDokterModalOpen] = useState(false);
  const [diagnosaModalOpen, setDiagnosaModalOpen] = useState(false);
  const [skdpModalOpen, setSkdpModalOpen] = useState(false);

  // SKDP state
  const [noSuratKontrol, setNoSuratKontrol] = useState("");
  const [skdpData, setSkdpData] = useState<SKDPData | null>(null);

  // Form fields
  const [noKartu, setNoKartu] = useState(patient.no_bpjs || "");
  const [tglSEP, setTglSEP] = useState(today);
  const [jnsPelayanan, setJnsPelayanan] = useState(initialValues?.jenisPelayanan || "2");
  const [klsRawatHak, setKlsRawatHak] = useState(patient.kelas_bpjs || "3");
  const [klsRawatNaik, setKlsRawatNaik] = useState("");
  const [pembiayaan, setPembiayaan] = useState("");
  const [asalRujukan, setAsalRujukan] = useState("1");
  const [noRujukan, setNoRujukan] = useState("");
  const [tglRujukan, setTglRujukan] = useState("");
  const [ppkRujukan, setPpkRujukan] = useState("");
  const [namaRujukan, setNamaRujukan] = useState("");
  const [kodePoli, setKodePoli] = useState(initialValues?.kodePoli || "");
  const [namaPoli, setNamaPoli] = useState(initialValues?.namaPoli || "");
  const [poliEksekutif, setPoliEksekutif] = useState("0");
  const [kodeDPJP, setKodeDPJP] = useState(initialValues?.kodeDokter || "");
  const [namaDPJP, setNamaDPJP] = useState(initialValues?.namaDokter || "");
  const [diagAwal, setDiagAwal] = useState("");
  const [namaDiagnosa, setNamaDiagnosa] = useState("");
  const [lakaLantas, setLakaLantas] = useState("0");
  const [tujuanKunj, setTujuanKunj] = useState("0");
  const [flagProcedure, setFlagProcedure] = useState("");
  const [kdPenunjang, setKdPenunjang] = useState("");
  const [assesmentPel, setAssesmentPel] = useState("");
  const [catatan, setCatatan] = useState("");
  const [noTelp, setNoTelp] = useState(patient.no_telepon || "");

  // Track apakah sudah fetch kepesertaan untuk mencegah loop
  const hasFetchedRef = useRef(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      hasFetchedRef.current = false;
      // Reset semua state
      setPeserta(null);
      setPesertaError(null);
      setNoKartu(patient.no_bpjs || "");
      setTglSEP(today);
      setNoTelp(patient.no_telepon || "");
      setKlsRawatHak("");
      setKlsRawatNaik("");
      setPembiayaan("");
      setNoRujukan("");
      setTglRujukan("");
      setPpkRujukan("");
      setNamaRujukan("");
      setNoSuratKontrol("");
      setSkdpData(null);
      setDiagAwal("");
      setNamaDiagnosa("");
      setCatatan("");
      setLakaLantas("0");
      setTujuanKunj("0");
      setFlagProcedure("");
      setKdPenunjang("");
      setAssesmentPel("");
      if (initialValues) {
        setKodePoli(initialValues.kodePoli || "");
        setNamaPoli(initialValues.namaPoli || "");
        setKodeDPJP(initialValues.kodeDokter || "");
        setNamaDPJP(initialValues.namaDokter || "");
        setJnsPelayanan(initialValues.jenisPelayanan || "2");
        
        // RAWAT INAP: Auto-generate noRujukan dengan format YYYYMMDDHHIISS
        if (initialValues.jenisPelayanan === "1") {
          const now = new Date();
          const generated = format(now, "yyyyMMddHHmmss");
          setNoRujukan(generated);
          setTglRujukan(format(now, "yyyy-MM-dd"));
          setAsalRujukan("2"); // Faskes 2 (internal RS)
        } else {
          // KONTROL: gunakan SEP asal dari initialValues
          if (initialValues.noSuratKontrol) {
            setNoSuratKontrol(initialValues.noSuratKontrol);
          }
          if (initialValues.noRujukan) {
            setNoRujukan(initialValues.noRujukan);
            setAsalRujukan(initialValues.asalRujukan || "2");
          }
          if (initialValues.tglRujukan) {
            setTglRujukan(initialValues.tglRujukan);
          }
        }
        
        if (initialValues.diagAwal) {
          setDiagAwal(initialValues.diagAwal);
          setNamaDiagnosa(initialValues.namaDiagnosa || "");
        }
      } else {
        setKodePoli("");
        setNamaPoli("");
        setKodeDPJP("");
        setNamaDPJP("");
        setJnsPelayanan("2");
      }
    } else {
      hasFetchedRef.current = false;
    }
  }, [open]);

  // Auto fetch kepesertaan saat drawer buka (sekali saja)
  useEffect(() => {
    if (open && patient.no_bpjs && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchKepesertaan(patient.no_bpjs, today);
    }
  }, [open, patient.no_bpjs]);

  // Function untuk fetch kepesertaan
  const fetchKepesertaan = async (kartuBpjs: string, tglPelayanan: string) => {
    setLoadingPeserta(true);
    setPesertaError(null);
    try {
      const res = await vclaimApi.getPesertaByNoKartu(kartuBpjs, tglPelayanan);
      const data = res.data.data;
      if (!data) throw new Error("Data peserta tidak ditemukan");

      setPeserta(data);
      
      // Auto-fill field dari data peserta
      if (data.hakKelas?.kode) {
        setKlsRawatHak(String(data.hakKelas.kode));
      }
      if (data.mr?.noTelepon) {
        setNoTelp(data.mr.noTelepon);
      }

      toast({
        title: "Peserta Ditemukan",
        description: `${data.nama || 'N/A'} - ${data.statusPeserta?.keterangan || 'N/A'} - Kelas ${data.hakKelas?.keterangan || 'N/A'}`,
      });
    } catch (error: any) {
      setPeserta(null);
      setPesertaError(error.response?.data?.error || error.message || "Gagal mengambil data peserta");
      toast({
        variant: "destructive",
        title: "Peserta Tidak Ditemukan",
        description: error.response?.data?.error || error.message || "Gagal mengambil data peserta",
      });
    } finally {
      setLoadingPeserta(false);
    }
  };

  // Handler untuk tombol cek peserta manual
  const handleCekPeserta = () => {
    if (!noKartu) {
      toast({ variant: "destructive", title: "Error", description: "Masukkan nomor kartu BPJS" });
      return;
    }
    fetchKepesertaan(noKartu, tglSEP);
  };

  // Search Rujukan - langsung hit karena hanya butuh noKartu
  const handleSearchRujukan = async () => {
    if (!noKartu) {
      toast({ variant: "destructive", title: "Error", description: "Cek kepesertaan terlebih dahulu" });
      return [];
    }
    try {
      const res = await vclaimApi.getRujukanByPeserta(noKartu, asalRujukan);
      const rujukanList = res.data.data || [];
      // Unwrap nested rujukan structure
      return rujukanList.map((item) => item.rujukan);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Gagal", 
        description: error.response?.data?.error || "Gagal mengambil data rujukan" 
      });
      return [];
    }
  };

  // Search Poli
  const handleSearchPoli = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoli(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  // Search Dokter - keyword adalah KODE SPESIALIS, bukan nama dokter
  const handleSearchDokter = async (keyword: string) => {
    if (!keyword) {
      toast({ variant: "destructive", title: "Error", description: "Masukkan kode spesialis (contoh: INT, BED, ANA)" });
      return [];
    }
    try {
      // jnsPelayanan, tglPelayanan, spesialis (dari keyword yang diketik user)
      const res = await vclaimApi.searchDokterDPJP(jnsPelayanan, tglSEP, keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  // Search Diagnosa
  const handleSearchDiagnosa = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchDiagnosa(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  // Fetch list SKDP / Rencana Kontrol
  const handleFetchSKDP = async (bulan?: string, tahun?: string): Promise<SKDPData[]> => {
    try {
      const b = bulan || String(new Date().getMonth() + 1).padStart(2, "0");
      const t = tahun || String(new Date().getFullYear());
      const res = await vclaimApi.getListRencanaKontrol(noKartu, { bulan: b, tahun: t });
      const list = res.data.data || [];
      // Map to SKDPData format - sesuai response BPJS
      return list.map((item) => ({
        noSuratKontrol: item.noSuratKontrol || "",
        jnsPelayanan: item.jnsPelayanan || "",
        jnsKontrol: item.jnsKontrol || "",
        namaJnsKontrol: item.namaJnsKontrol || "",
        tglRencanaKontrol: item.tglRencanaKontrol || "",
        tglTerbitKontrol: item.tglTerbitKontrol || "",
        noSepAsalKontrol: item.noSepAsalKontrol || "",
        poliAsal: item.poliAsal || "",
        namaPoliAsal: item.namaPoliAsal || "",
        poliTujuan: item.poliTujuan || "",
        namaPoliTujuan: item.namaPoliTujuan || "",
        kodePoliTujuan: item.poliTujuan || "", // Alias untuk poliTujuan
        tglSEP: item.tglSEP || "",
        kodeDokter: item.kodeDokter || "",
        namaDokter: item.namaDokter || "",
        noKartu: item.noKartu || "",
        nama: item.nama || "",
        terbitSEP: item.terbitSEP || "",
      }));
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Gagal", 
        description: error.response?.data?.error || "Gagal mengambil data surat kontrol" 
      });
      return [];
    }
  };

  // Cek apakah poli IGD/UGD (tidak perlu rujukan)
  const isIGD = kodePoli?.toUpperCase() === "IGD" || kodePoli?.toUpperCase() === "UGD";

  // Submit SEP
  const handleSubmitSEP = async () => {
    // Validasi
    if (!peserta) {
      toast({ variant: "destructive", title: "Error", description: "Cek kepesertaan BPJS terlebih dahulu" });
      return;
    }
    // Poli tidak wajib untuk rawat inap (jnsPelayanan = "1")
    if (!kodePoli && jnsPelayanan !== "1") {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli tujuan" });
      return;
    }
    if (!kodeDPJP && jnsPelayanan === "2") {
      toast({ variant: "destructive", title: "Error", description: "Pilih dokter DPJP" });
      return;
    }
    if (!diagAwal) {
      toast({ variant: "destructive", title: "Error", description: "Pilih diagnosa awal" });
      return;
    }
    // Rujukan tidak wajib untuk IGD/UGD atau jika ada Surat Kontrol (SKDP)
    if (!noRujukan && !isIGD && !noSuratKontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih rujukan atau surat kontrol terlebih dahulu" });
      return;
    }

    setLoadingSubmit(true);
    try {
      // Request sesuai dengan backend SEPInput struct (flat structure)
      const sepRequest = {
        no_kartu: peserta.noKartu,
        no_mr: patient.no_rm,
        no_telp: noTelp,
        registration_id: registrationId || 0,
        visit_id: visitId || 0,
        patient_id: patient.id,
        tgl_sep: tglSEP,
        jns_pelayanan: jnsPelayanan,
        kls_rawat_hak: klsRawatHak,
        kls_rawat_naik: klsRawatNaik || "", // Kosong jika tidak naik kelas
        pembiayaan: klsRawatNaik ? (pembiayaan || "") : "", // Kosong jika tidak naik kelas
        penanggung_jawab: "",
        asal_rujukan: asalRujukan,
        no_rujukan: noRujukan,
        tgl_rujukan: tglRujukan,
        ppk_rujukan: ppkRujukan,
        kode_poli: jnsPelayanan === "1" ? "" : kodePoli, // Kosong untuk rawat inap
        nama_poli: namaPoli, // Kirim nama poli ke backend
        poli_eks: poliEksekutif,
        kode_dpjp: kodeDPJP,
        nama_dpjp: namaDPJP, // Kirim nama dokter ke backend
        diag_awal: diagAwal,
        nama_diagnosa: namaDiagnosa, // Kirim nama diagnosa ke backend
        laka_lantas: lakaLantas,
        no_lp: "",
        tgl_kejadian: "",
        ket_kejadian: "",
        suplesi: "0",
        no_sep_suplesi: "",
        kd_propinsi: "",
        kd_kabupaten: "",
        kd_kecamatan: "",
        cob: "0",
        katarak: "0",
        tujuan_kunj: tujuanKunj,
        flag_procedure: flagProcedure || "",
        kd_penunjang: kdPenunjang || "",
        assesment_pel: assesmentPel || "",
        no_surat_kontrol: noSuratKontrol || "",
        catatan: catatan,
      };

      let noSep: string;
      if (onSubmitOverride) {
        // Use custom submit handler (e.g., BPJS checkin with SEP: AddAntrean → SEP → CheckIn)
        const result = await onSubmitOverride(sepRequest);
        noSep = result.noSep;
      } else {
        const res = await vclaimApi.createSEP(sepRequest as any);
        // Backend returns SEP model with json tag "no_sep"
        noSep = (res.data.data as any)?.no_sep;
      }

      toast({
        title: "SEP Berhasil Dibuat",
        description: `No. SEP: ${noSep}`,
      });

      if (onSEPCreated) {
        onSEPCreated(noSep, {
          ...sepRequest,
          noSep,
          poli: { nama: namaPoli },
          dokter: { nama: namaDPJP },
          diagnosa: { nama: namaDiagnosa },
          namaRujukan,
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Membuat SEP",
        description: error.response?.data?.error || error.message || "Terjadi kesalahan",
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%] flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Buat SEP BPJS
            </SheetTitle>
            <SheetDescription>
              Surat Eligibilitas Peserta untuk <strong>{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</strong> (RM: {patient.no_rm})
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {/* === KEPESERTAAN === */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Kepesertaan</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">No. Kartu BPJS *</Label>
                    <div className="flex gap-2">
                      <Input
                        value={noKartu}
                        onChange={(e) => setNoKartu(e.target.value)}
                        placeholder="13 digit"
                        className="h-9"
                      />
                      <Button 
                        size="sm" 
                        onClick={handleCekPeserta} 
                        disabled={loadingPeserta || !noKartu}
                        className="h-9 px-3"
                      >
                        {loadingPeserta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tanggal SEP *</Label>
                    <Input
                      type="date"
                      value={tglSEP}
                      onChange={(e) => setTglSEP(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Status Peserta */}
                {peserta && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">{peserta.nama}</span>
                      <Badge variant="default" className="text-xs">{peserta.statusPeserta?.keterangan}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-700">
                      <span>NIK: {peserta.nik}</span>
                      <span>Kelas: {peserta.hakKelas?.keterangan}</span>
                      <span>Jenis: {peserta.jenisPeserta?.keterangan}</span>
                      <span>Faskes: {peserta.provUmum?.nmProvider || "-"}</span>
                    </div>
                  </div>
                )}
                {pesertaError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700">{pesertaError}</span>
                  </div>
                )}
              </div>

              {/* === RUJUKAN === */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Rujukan</h3>
                  {isIGD && (
                    <Badge variant="secondary" className="text-xs">Tidak wajib untuk IGD</Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Jenis Pelayanan *</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.jenisPelayanan)}
                      value={jnsPelayanan}
                      onValueChange={setJnsPelayanan}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Asal Rujukan {!isIGD && "*"}</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.asalRujukan)}
                      value={asalRujukan}
                      onValueChange={setAsalRujukan}
                      placeholder="Pilih"
                      className="h-9"
                      disabled={isIGD}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {jnsPelayanan === "1" ? "No. Rujukan" : (noSuratKontrol ? "No. SEP Asal" : "No. Rujukan")} {!isIGD && "*"}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={noRujukan}
                        onChange={(e) => setNoRujukan(e.target.value)}
                        disabled={isIGD || jnsPelayanan === "1"}
                        placeholder={jnsPelayanan === "1" ? "Auto-generated" : (noSuratKontrol ? "No. SEP asal kontrol" : "Nomor rujukan")}
                        className="h-9"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setRujukanModalOpen(true)}
                        disabled={!noKartu || isIGD || jnsPelayanan === "1"}
                        className="h-9 px-3"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{jnsPelayanan === "1" ? "Tanggal Rujukan" : (noSuratKontrol ? "Tanggal SEP Asal" : "Tanggal Rujukan")}</Label>
                    <Input
                      type="date"
                      value={tglRujukan}
                      onChange={(e) => setTglRujukan(e.target.value)}
                      className="h-9"
                      disabled={isIGD || jnsPelayanan === "1"}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">PPK Perujuk</Label>
                  <Input
                    value={jnsPelayanan === "1" ? "(Diisi otomatis dari config)" : namaRujukan}
                    onChange={(e) => setNamaRujukan(e.target.value)}
                    placeholder="Nama faskes perujuk"
                    className="h-9"
                    disabled={isIGD || jnsPelayanan === "1"}
                  />
                </div>

                {/* SKDP / Surat Kontrol - untuk rawat inap dan rawat jalan */}
                {(jnsPelayanan === "1" || jnsPelayanan === "2") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nomor Surat Kontrol / SPRI</Label>
                    <div className="flex gap-2">
                      <Input
                        value={noSuratKontrol}
                        onChange={(e) => setNoSuratKontrol(e.target.value)}
                        placeholder="Nomor surat kontrol"
                        className="h-9"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSkdpModalOpen(true)}
                        disabled={!noKartu}
                        className="h-9 px-3"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </div>
                    {skdpData && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {skdpData.namaPoliTujuan} - {skdpData.namaDokter} | Berlaku: {skdpData.tglRencanaKontrol}
                        {skdpData.noSepAsalKontrol && (
                          <span className="block">SEP Asal: {skdpData.noSepAsalKontrol}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* === PELAYANAN === */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pelayanan</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kelas Rawat Hak *</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.kelasRawat)}
                      value={klsRawatHak}
                      onValueChange={setKlsRawatHak}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Naik Kelas</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.kelasRawatNaik)}
                      value={klsRawatNaik}
                      onValueChange={(val) => {
                        setKlsRawatNaik(val);
                        // Reset pembiayaan jika tidak naik kelas
                        if (!val) setPembiayaan("");
                      }}
                      placeholder="Tidak naik"
                      className="h-9"
                    />
                  </div>
                </div>

                {klsRawatNaik && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pembiayaan Naik Kelas</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.pembiayaanNaikKelas)}
                      value={pembiayaan}
                      onValueChange={setPembiayaan}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                )}

                {/* Poli Tujuan - hanya untuk rawat jalan */}
                {jnsPelayanan !== "1" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Poli Tujuan *</Label>
                      <div className="flex gap-2">
                        <Input
                          value={namaPoli ? `${kodePoli} - ${namaPoli}` : ""}
                          placeholder="Pilih poli"
                          readOnly
                          className="h-9 bg-muted/50"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setPoliModalOpen(true)}
                          className="h-9 px-3"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Poli Eksekutif</Label>
                      <Combobox
                        options={toComboOptions(SEP_OPTIONS.yaTidak)}
                        value={poliEksekutif}
                        onValueChange={setPoliEksekutif}
                        placeholder="Pilih"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Dokter DPJP {jnsPelayanan === "2" ? "*" : ""}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={namaDPJP ? `${kodeDPJP} - ${namaDPJP}` : ""}
                      placeholder={kodePoli ? "Pilih dokter" : "Pilih poli dulu"}
                      readOnly
                      className="h-9 bg-muted/50"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setDokterModalOpen(true)}
                      disabled={!kodePoli}
                      className="h-9 px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Diagnosa Awal (ICD-10) *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={namaDiagnosa ? `${diagAwal} - ${namaDiagnosa}` : ""}
                      placeholder="Pilih diagnosa"
                      readOnly
                      className="h-9 bg-muted/50"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setDiagnosaModalOpen(true)}
                      className="h-9 px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* === JAMINAN === */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Jaminan & Lainnya</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kecelakaan Lalu Lintas</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.lakaLantas)}
                      value={lakaLantas}
                      onValueChange={setLakaLantas}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tujuan Kunjungan</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.tujuanKunjungan)}
                      value={tujuanKunj}
                      onValueChange={setTujuanKunj}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                </div>

                {tujuanKunj === "1" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Flag Procedure</Label>
                      <Combobox
                        options={toComboOptions(SEP_OPTIONS.flagProcedure)}
                        value={flagProcedure}
                        onValueChange={setFlagProcedure}
                        placeholder="Pilih"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Penunjang</Label>
                      <Combobox
                        options={toComboOptions(SEP_OPTIONS.kdPenunjang)}
                        value={kdPenunjang}
                        onValueChange={setKdPenunjang}
                        placeholder="Pilih"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                {(tujuanKunj === "2" || tujuanKunj === "0") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assessment Pelayanan</Label>
                    <Combobox
                      options={toComboOptions(SEP_OPTIONS.assesmentPelayanan)}
                      value={assesmentPel}
                      onValueChange={setAssesmentPel}
                      placeholder="Pilih"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">No. Telepon</Label>
                  <Input
                    value={noTelp}
                    onChange={(e) => setNoTelp(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Catatan</Label>
                  <Textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <SheetFooter className="p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitSEP}
              disabled={loadingSubmit || !peserta || !kodePoli || !diagAwal}
            >
              {loadingSubmit ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Buat SEP
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rujukan Modal - langsung fetch saat dibuka */}
      <RujukanModal
        open={rujukanModalOpen}
        onOpenChange={setRujukanModalOpen}
        noKartu={noKartu}
        onFetch={handleSearchRujukan}
        onSelect={(rujukan: RujukanData) => {
          setNoRujukan(rujukan.noKunjungan);
          setTglRujukan(rujukan.tglKunjungan);
          setPpkRujukan(rujukan.provPerujuk?.kode || "");
          setNamaRujukan(rujukan.provPerujuk?.nama || "");
          if (rujukan.diagnosa?.kode) {
            setDiagAwal(rujukan.diagnosa.kode);
            setNamaDiagnosa(rujukan.diagnosa.nama || "");
          }
          if (rujukan.poliRujukan?.kode) {
            setKodePoli(rujukan.poliRujukan.kode);
            setNamaPoli(rujukan.poliRujukan.nama || "");
          }
        }}
      />

      {/* SKDP Modal - untuk rawat inap */}
      <SKDPModal
        open={skdpModalOpen}
        onOpenChange={setSkdpModalOpen}
        noKartu={noKartu}
        onFetch={handleFetchSKDP}
        onSelect={async (skdp: SKDPData) => {
          setNoSuratKontrol(skdp.noSuratKontrol);
          setSkdpData(skdp);
          
          // Auto-fill DPJP dari SKDP
          if (skdp.kodeDokter) {
            setKodeDPJP(skdp.kodeDokter);
            setNamaDPJP(skdp.namaDokter || "");
          }
          // Auto-fill Poli dari SKDP
          if (skdp.kodePoliTujuan) {
            setKodePoli(skdp.kodePoliTujuan);
            setNamaPoli(skdp.namaPoliTujuan || "");
          }

          // noRujukan = No SEP asal (bukan nomor surat kontrol)
          // Jika noSepAsalKontrol kosong, coba fetch dari detail
          let noSepAsal = skdp.noSepAsalKontrol || "";
          let tglSepAsal = skdp.tglSEP || tglSEP;
          
          if (!noSepAsal && skdp.noSuratKontrol) {
            try {
              const res = await vclaimApi.getSuratKontrolDetail(skdp.noSuratKontrol);
              const detail = res.data.data;
              if (detail?.sep?.noSep) {
                noSepAsal = detail.sep.noSep;
                tglSepAsal = detail.sep.tglSep || tglSepAsal;
              }
            } catch (e) {
              console.error("Failed to fetch SKDP detail for SEP asal:", e);
            }
          }
          
          // Untuk RAWAT INAP: JANGAN ubah noRujukan (sudah auto-generated)
          // Untuk RAWAT JALAN (kontrol): gunakan SEP asal
          if (jnsPelayanan !== "1") {
            setNoRujukan(noSepAsal);
            setTglRujukan(tglSepAsal);
            // Set asalRujukan = 2 (Faskes 2 / Internal RS)
            setAsalRujukan("2");
          }
        }}
      />

      <SearchModal
        open={poliModalOpen}
        onOpenChange={setPoliModalOpen}
        title="Cari Poli"
        placeholder="Ketik nama poli..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Poli" },
        ]}
        onSearch={handleSearchPoli}
        onSelect={(item) => {
          setKodePoli(item.kode);
          setNamaPoli(item.nama);
          setKodeDPJP("");
          setNamaDPJP("");
        }}
      />

      <SearchModal
        open={dokterModalOpen}
        onOpenChange={setDokterModalOpen}
        title="Cari Dokter DPJP"
        placeholder="Ketik kode spesialis (INT, BED, ANA, dll)..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Dokter" },
        ]}
        onSearch={handleSearchDokter}
        onSelect={(item) => {
          setKodeDPJP(item.kode);
          setNamaDPJP(item.nama);
        }}
      />

      <SearchModal
        open={diagnosaModalOpen}
        onOpenChange={setDiagnosaModalOpen}
        title="Cari Diagnosa (ICD-10)"
        placeholder="Ketik kode atau nama diagnosa..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Diagnosa" },
        ]}
        onSearch={handleSearchDiagnosa}
        onSelect={(item) => {
          setDiagAwal(item.kode);
          setNamaDiagnosa(item.nama);
        }}
      />
    </>
  );
}
