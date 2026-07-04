import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  FileText,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type VClaimSEP,
} from "@/lib/api/vclaim";
import { SEP_OPTIONS, type SEPOptionItem } from "@/lib/sep-options";
import { formatPatientName } from "@/lib/print-utils";
import { cn } from "@/lib/utils";
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
  sourceContext?: "kontrol" | "reguler";
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
  sourceContext = "reguler",
  patient,
  registrationId,
  visitId,
  onSEPCreated,
  onSubmitOverride,
  initialValues,
}: SEPFormSheetProps) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const canAssignExisting = (registrationId || 0) > 0 || (visitId || 0) > 0;

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
  const [searchNoSEP, setSearchNoSEP] = useState("");
  const [searchingSEP, setSearchingSEP] = useState(false);
  const [assigningSEP, setAssigningSEP] = useState(false);
  const [searchSEPError, setSearchSEPError] = useState("");
  const [searchedSEP, setSearchedSEP] = useState<VClaimSEP | null>(null);
  const [entryMode, setEntryMode] = useState<"form" | "search">("form");

  // Track apakah sudah fetch kepesertaan untuk mencegah loop
  const hasFetchedRef = useRef(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      // Reset semua state (hanya dijalankan saat modal baru dibuka)
      setPeserta(null);
      setPesertaError(null);
      setNoKartu(patient.no_bpjs || "");
      setTglSEP(today);
      setNoTelp(patient.no_telepon || "");
      setKlsRawatHak(patient.kelas_bpjs || "3");
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
      setSearchNoSEP("");
      setSearchingSEP(false);
      setAssigningSEP(false);
      setSearchSEPError("");
      setSearchedSEP(null);
      setEntryMode("form");
      setLakaLantas("0");
      setTujuanKunj("0");
      setFlagProcedure("");
      setKdPenunjang("");
      setAssesmentPel("");
      setKodePoli("");
      setNamaPoli("");
      setKodeDPJP("");
      setNamaDPJP("");
      setJnsPelayanan("2");
    } else {
      hasFetchedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Apply initial values
  useEffect(() => {
    if (open && initialValues) {
      if (initialValues.kodePoli) setKodePoli(initialValues.kodePoli);
      if (initialValues.namaPoli) setNamaPoli(initialValues.namaPoli);
      if (initialValues.kodeDokter) setKodeDPJP(initialValues.kodeDokter);
      if (initialValues.namaDokter) setNamaDPJP(initialValues.namaDokter);

      // Jika ini dari surat kontrol → paksa Rawat Jalan ("2")
      const isKontrol = !!initialValues.noSuratKontrol;
      if (isKontrol || initialValues.jenisPelayanan) {
        setJnsPelayanan(isKontrol ? "2" : initialValues.jenisPelayanan!);
      }

      // Assessment pelayanan: default "5" (Tujuan Kontrol) untuk kontrol
      if (isKontrol) {
        setAssesmentPel("5");
      }

      // RAWAT INAP: Auto-generate noRujukan dengan format YYYYMMDDHHIISS
      if (initialValues.jenisPelayanan === "1" && !isKontrol) {
        const now = new Date();
        const generated = format(now, "yyyyMMddHHmmss");
        setNoRujukan(generated);
        setTglRujukan(format(now, "yyyy-MM-dd"));
        setAsalRujukan("2"); // Faskes 2 (internal RS)
      } else {
        // KONTROL / RAWAT JALAN: gunakan SEP asal dari initialValues
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
        if (initialValues.namaDiagnosa) setNamaDiagnosa(initialValues.namaDiagnosa);
      }
    }
  }, [open, initialValues]);

  // Auto fetch kepesertaan saat drawer buka (sekali saja)
  useEffect(() => {
    if (open && patient.no_bpjs && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchKepesertaan(patient.no_bpjs, today);
    }
  }, [open, patient.no_bpjs]);

  // Auto-fetch SKDP detail dari initialValues.noSuratKontrol saat sheet terbuka
  useEffect(() => {
    if (open && initialValues?.noSuratKontrol && noKartu && !skdpData) {
      const fetchSkdpFromInitial = async () => {
        try {
          const res = await vclaimApi.getSuratKontrolDetail(initialValues.noSuratKontrol!);
          const detail = res.data.data;
          if (!detail) return;

          const kodePoliResult = detail.poli?.kode || detail.poliTujuan || "";
          const namaPoliResult = detail.poli?.nama || detail.namaPoliTujuan || "";
          const kodeDokterResult = detail.dokter?.kode || detail.kodeDokter || "";
          const namaDokterResult = detail.dokter?.nama || detail.namaDokter || "";

          const skdp: SKDPData = {
            noSuratKontrol: detail.noSuratKontrol || initialValues.noSuratKontrol!,
            jnsPelayanan: "",
            jnsKontrol: detail.jnsKontrol || "",
            namaJnsKontrol: detail.namaJnsKontrol || "",
            tglRencanaKontrol: detail.tglRencanaKontrol || "",
            tglTerbitKontrol: detail.tglTerbitKontrol || "",
            noSepAsalKontrol: detail.sep?.noSep || "",
            poliAsal: "",
            namaPoliAsal: "",
            poliTujuan: kodePoliResult,
            namaPoliTujuan: namaPoliResult,
            kodePoliTujuan: kodePoliResult,
            tglSEP: detail.sep?.tglSep || "",
            kodeDokter: kodeDokterResult,
            namaDokter: namaDokterResult,
            noKartu: noKartu,
            nama: detail.nama || "",
            terbitSEP: detail.sep?.noSep ? "Sudah" : "Belum",
          };

          setSkdpData(skdp);

          if (skdp.kodePoliTujuan && !initialValues.kodePoli) {
            setKodePoli(skdp.kodePoliTujuan);
            setNamaPoli(skdp.namaPoliTujuan);
          }
          if (skdp.kodeDokter && !initialValues.kodeDokter) {
            setKodeDPJP(skdp.kodeDokter);
            setNamaDPJP(skdp.namaDokter);
          }

          const noSepAsal = skdp.noSepAsalKontrol || initialValues.noRujukan || "";
          const tglSepAsal = skdp.tglSEP || initialValues.tglRujukan || format(new Date(), "yyyy-MM-dd");
          if (noSepAsal) {
            setNoRujukan(noSepAsal);
            setTglRujukan(tglSepAsal);
            setAsalRujukan("2");
          }
        } catch (e) {
          console.warn("Auto-fetch SKDP detail gagal:", e);
        }
      };
      fetchSkdpFromInitial();
    }
  }, [open, initialValues?.noSuratKontrol, noKartu]);

  // Function untuk fetch kepesertaan
  const fetchKepesertaan = async (kartuBpjs: string, tglPelayanan: string) => {
    setLoadingPeserta(true);
    setPesertaError(null);
    try {
      const res = await vclaimApi.getPesertaByNoKartu(kartuBpjs, tglPelayanan);
      const data = res.data.data;
      if (!data) throw new Error("Data peserta tidak ditemukan");

      setPeserta(data);

      // Auto-fill kelas rawat dari hakKelas BPJS (override dari peserta)
      if (data.hakKelas?.kode) {
        setKlsRawatHak(String(data.hakKelas.kode));
      }
      if (data.mr?.noTelepon) {
        setNoTelp(data.mr.noTelepon);
      }

      toast({
        title: "Peserta Ditemukan",
        description: data.nama + " - " + (data.statusPeserta?.keterangan || "N/A") + " - Kelas " + (data.hakKelas?.keterangan || "N/A"),
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

  // Cek apakah poli IGD/UGD
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
        // Use custom submit handler (e.g., BPJS checkin with SEP: AddAntrean â†’ SEP â†’ CheckIn)
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

  const handleSearchSEPForAssign = async () => {
    const noSEP = searchNoSEP.trim();
    if (!noSEP) {
      setSearchSEPError("Nomor SEP wajib diisi");
      setSearchedSEP(null);
      return;
    }

    setSearchingSEP(true);
    setSearchSEPError("");
    setSearchedSEP(null);
    try {
      const res = await vclaimApi.getSEP(noSEP);
      const detail = res.data?.data;
      if (!detail?.noSep) {
        setSearchSEPError("Detail SEP tidak ditemukan");
        return;
      }
      setSearchedSEP(detail);
    } catch (error: any) {
      setSearchSEPError(error.response?.data?.error || "Gagal mencari detail SEP");
    } finally {
      setSearchingSEP(false);
    }
  };

  const handleAssignSEPFromSearch = async () => {
    if (!searchedSEP?.noSep) return;
    if (!registrationId && !visitId) {
      toast({
        variant: "destructive",
        title: "Gagal assign SEP",
        description: "Registration/visit tidak tersedia untuk assignment SEP.",
      });
      return;
    }

    setAssigningSEP(true);
    try {
      const importRes = await vclaimApi.importSEP({
        no_sep: searchedSEP.noSep,
        no_kartu: searchedSEP.peserta?.noKartu || noKartu,
        nama_pasien: searchedSEP.peserta?.nama || patient.nama_lengkap,
        nik: searchedSEP.peserta?.nik || patient.nik || "",
        tgl_lahir: searchedSEP.peserta?.tglLahir || patient.tanggal_lahir || "",
        jenis_kelamin: searchedSEP.peserta?.jnsKelamin || patient.jenis_kelamin || "",
        tgl_sep: searchedSEP.tglSep || tglSEP,
        jns_pelayanan: searchedSEP.jnsPelayanan || "",
        kls_rawat_hak: searchedSEP.peserta?.klsRawat?.klsRawatHak || "",
        no_mr: searchedSEP.peserta?.noMr || patient.no_rm || "",
        kode_poli: searchedSEP.poli || "",
        nama_poli: searchedSEP.poli || "",
        diag_awal: searchedSEP.diagnosa || "",
        nama_diagnosa: searchedSEP.diagnosa || "",
        catatan: searchedSEP.catatan || "",
        patient_id: patient.id,
        registration_id: registrationId || 0,
        visit_id: visitId || 0,
      });

      toast({
        title: "SEP berhasil di-assign",
        description: `Nomor SEP ${searchedSEP.noSep} berhasil ditautkan ke pendaftaran.`,
      });

      onSEPCreated?.(searchedSEP.noSep, {
        ...(importRes.data?.data || {}),
        noSep: searchedSEP.noSep,
        poli: { nama: searchedSEP.poli || "-" },
        dokter: { nama: "-" },
        diagnosa: { nama: searchedSEP.diagnosa || "-" },
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal assign SEP",
        description: error.response?.data?.error || "Terjadi kesalahan saat assign SEP",
      });
    } finally {
      setAssigningSEP(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-[80vw] max-w-[80vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
          <div className="flex flex-col border-b px-4 py-2">
            <SheetHeader className="flex flex-row items-end justify-between pr-8 space-y-0">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-xl font-bold">Form SEP</h4>
                  <Badge variant="outline">SEP</Badge>
                  <Badge variant={peserta ? "default" : pesertaError ? "destructive" : "secondary"}>
                    {loadingPeserta ? "Mengecek..." : peserta ? "Peserta Aktif" : pesertaError ? "Peserta Error" : "Belum Verifikasi"}
                  </Badge>
                  {sourceContext === "kontrol" && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      Dari Jadwal Kontrol
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)} â€¢ RM {patient.no_rm}</p>
              </div>

              {canAssignExisting && (
                <Select value={entryMode} onValueChange={(val: any) => setEntryMode(val)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/50 border-border/70">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form" className="text-xs">Form SEP</SelectItem>
                    <SelectItem value="search" className="text-xs">Cari Berdasarkan SEP</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-4">
              {canAssignExisting && entryMode === "search" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={searchNoSEP}
                        onChange={(e) => {
                          setSearchNoSEP(e.target.value);
                          if (searchSEPError) setSearchSEPError("");
                        }}
                        placeholder="Masukkan nomor SEP"
                        className="h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearchSEPForAssign();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 px-0"
                        onClick={handleSearchSEPForAssign}
                        disabled={searchingSEP || !searchNoSEP.trim()}
                      >
                        {searchingSEP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>

                    {searchSEPError && (
                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">Pencarian SEP gagal: {searchSEPError}</div>
                    )}

                    {searchedSEP && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 border rounded-md bg-background p-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">No. SEP</span>
                            <p className="font-mono font-medium text-foreground">{searchedSEP.noSep || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tanggal SEP</span>
                            <p className="font-medium text-foreground">{searchedSEP.tglSep || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Nama Peserta</span>
                            <p className="font-medium text-foreground">{searchedSEP.peserta?.nama || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">No. Kartu</span>
                            <p className="font-mono font-medium text-foreground">{searchedSEP.peserta?.noKartu || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Poli</span>
                            <p className="font-medium text-foreground">{searchedSEP.poli || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Diagnosa</span>
                            <p className="font-medium text-foreground">{searchedSEP.diagnosa || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Jenis Pelayanan</span>
                            <p className="font-medium text-foreground">
                              {searchedSEP.jnsPelayanan === "1"
                                ? "Rawat Inap"
                                : searchedSEP.jnsPelayanan === "2"
                                  ? "Rawat Jalan"
                                  : searchedSEP.jnsPelayanan || "-"}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Kelas Rawat</span>
                            <p className="font-medium text-foreground">
                              {searchedSEP.peserta?.klsRawat?.klsRawatHak ? `Kelas ${searchedSEP.peserta.klsRawat.klsRawatHak}` : "-"}
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleAssignSEPFromSearch}
                          disabled={assigningSEP}
                        >
                          {assigningSEP ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Assign SEP ke Pendaftaran
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {entryMode === "form" && (
                <>
                  {/* === RUJUKAN === */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Jenis Pelayanan *</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.jenisPelayanan)}
                          value={jnsPelayanan}
                          onValueChange={setJnsPelayanan}
                          placeholder="Pilih"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Asal Rujukan</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.asalRujukan)}
                          value={asalRujukan}
                          onValueChange={setAsalRujukan}
                          placeholder="Pilih"
                          className="h-9"
                          disabled={isIGD}
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Kelas Rawat Hak *</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.kelasRawat)}
                          value={klsRawatHak}
                          onValueChange={setKlsRawatHak}
                          placeholder="Pilih"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Naik Kelas</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.kelasRawatNaik)}
                          value={klsRawatNaik}
                          onValueChange={(val) => {
                            setKlsRawatNaik(val);
                            if (!val) setPembiayaan("");
                          }}
                          placeholder="Tidak naik"
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">
                          {jnsPelayanan === "1" ? "No. Rujukan" : (noSuratKontrol ? "No. SEP Asal" : "No. Rujukan")}
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
                            className="h-9 w-9 px-0"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">{jnsPelayanan === "1" ? "Tanggal Rujukan" : (noSuratKontrol ? "Tanggal SEP Asal" : "Tanggal Rujukan")}</Label>
                        <Input
                          type="date"
                          value={tglRujukan}
                          onChange={(e) => setTglRujukan(e.target.value)}
                          className="h-9"
                          disabled={isIGD || jnsPelayanan === "1"}
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-sm font-medium">Dokter DPJP {jnsPelayanan === "2" ? "*" : ""}</Label>
                        <div className="flex gap-2">
                          <Input
                            value={namaDPJP ? `${kodeDPJP} - ${namaDPJP}` : ""}
                            placeholder={kodePoli ? "Pilih dokter" : "Pilih poli dulu"}
                            readOnly
                            className={cn("h-9", "bg-muted/20")}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDokterModalOpen(true)}
                            disabled={!kodePoli}
                            className="h-9 w-9 px-0"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-sm font-medium">PPK Perujuk</Label>
                        <Input
                          value={jnsPelayanan === "1" ? "(Diisi otomatis dari config)" : namaRujukan}
                          onChange={(e) => setNamaRujukan(e.target.value)}
                          placeholder="Nama faskes perujuk"
                          className="h-9"
                          disabled={isIGD || jnsPelayanan === "1"}
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-sm font-medium">Diagnosa Awal (ICD-10) *</Label>
                        <div className="flex gap-2">
                          <Input
                            value={namaDiagnosa ? `${diagAwal} - ${namaDiagnosa}` : ""}
                            placeholder="Pilih diagnosa"
                            readOnly
                            className={cn("h-9", "bg-muted/20")}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDiagnosaModalOpen(true)}
                            className="h-9 w-9 px-0"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      {/* Poli Tujuan - hanya untuk rawat jalan */}
                      {jnsPelayanan !== "1" && (
                        <>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label className="text-sm font-medium">Poli Tujuan *</Label>
                            <div className="flex gap-2">
                              <Input
                                value={namaPoli ? `${kodePoli} - ${namaPoli}` : ""}
                                placeholder="Pilih poli"
                                readOnly
                                className={cn("h-9", "bg-muted/20")}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPoliModalOpen(true)}
                                className="h-9 w-9 px-0"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5 lg:col-span-1">
                            <Label className="text-sm font-medium">Poli Eksekutif</Label>
                            <Combobox
                              options={toComboOptions(SEP_OPTIONS.yaTidak)}
                              value={poliEksekutif}
                              onValueChange={setPoliEksekutif}
                              placeholder="Pilih"
                              className="h-9"
                            />
                          </div>
                        </>
                      )}
                      <div className={cn("space-y-1.5", jnsPelayanan !== "1" ? "lg:col-span-1" : "lg:col-span-2")}>
                        <Label className="text-sm font-medium">Nomor Surat Kontrol / SPRI</Label>
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
                            className="h-9 w-9 px-0"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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

                  {/* === JAMINAN === */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Kecelakaan Lalu Lintas</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.lakaLantas)}
                          value={lakaLantas}
                          onValueChange={setLakaLantas}
                          placeholder="Pilih"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">Tujuan Kunjungan</Label>
                        <Combobox
                          options={toComboOptions(SEP_OPTIONS.tujuanKunjungan)}
                          value={tujuanKunj}
                          onValueChange={setTujuanKunj}
                          placeholder="Pilih"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5 lg:col-span-1">
                        <Label className="text-sm font-medium">No. Telepon</Label>
                        <Input
                          value={noTelp}
                          onChange={(e) => setNoTelp(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="h-9"
                        />
                      </div>
                    </div>

                    {tujuanKunj === "1" && (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                        <div className="space-y-1.5 lg:col-span-1">
                          <Label className="text-sm font-medium">Flag Procedure</Label>
                          <Combobox
                            options={toComboOptions(SEP_OPTIONS.flagProcedure)}
                            value={flagProcedure}
                            onValueChange={setFlagProcedure}
                            placeholder="Pilih"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-1">
                          <Label className="text-sm font-medium">Penunjang</Label>
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
                        <Label className="text-sm font-medium">Assessment Pelayanan</Label>
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
                      <Label className="text-sm font-medium">Catatan</Label>
                      <Textarea
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        placeholder="Catatan tambahan..."
                        rows={2}
                        className="resize-none bg-background shadow-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="p-4 border-t sm:justify-end gap-2">
            <Button variant="outline" className="" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitSEP}
              disabled={loadingSubmit || !peserta || !kodePoli || !diagAwal}
              className=""
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
