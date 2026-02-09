import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  vclaimApi,
  type VClaimListRencanaKontrolItem,
  type VClaimSuratKontrolDetail,
} from "@/lib/api/vclaim";
import { registrationApi } from "@/lib/api/queue";
import { api } from "@/lib/api";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";

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

  // Loading state
  const [loading, setLoading] = useState(false);

  // Data states
  const [kontrolInfo, setKontrolInfo] = useState<KontrolInfoResponse | null>(null);
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
    if (!mergedSuratKontrol) return undefined;

    const listItem = suratKontrolList.find(
      (sk) => sk.noSuratKontrol === mergedSuratKontrol.noSuratKontrol
    );

    // Extract ICD code from diagnosis
    let diagAwal = mergedSuratKontrol.namaDiagnosa || "";
    if (diagAwal.includes(" - ")) {
      diagAwal = diagAwal.split(" - ")[0].trim();
    }
    if (!diagAwal) {
      diagAwal = "Z00.0";
    }

    // noRujukan = No SEP asal (bukan nomor surat kontrol)
    // noSuratKontrol = Nomor surat kontrol (SKDP)
    // ppkRujukan akan otomatis diisi dari config di backend
    const noSepAsal = mergedSuratKontrol.sep?.noSep || listItem?.noSepAsalKontrol || "";
    const tglSepAsal = mergedSuratKontrol.sep?.tglSep || listItem?.tglSEP || format(new Date(), "yyyy-MM-dd");
    
    // Determine jenis pelayanan from surat kontrol (1=Ranap, 2=Rajal)
    // VClaim returns "Rawat Inap" or "Rawat Jalan"
    const jenisPelayananFromList = listItem?.jnsPelayanan || "";
    const jnsPelayanan = jenisPelayananFromList === "Rawat Inap" ? "1" : "2";

    return {
      kodePoli: mergedSuratKontrol.poli?.kode || listItem?.poliTujuan || kontrolInfo?.destinationRoom?.kode_bpjs || "",
      namaPoli: mergedSuratKontrol.poli?.nama || listItem?.namaPoliTujuan || kontrolInfo?.destinationRoom?.name || "",
      kodeDokter: mergedSuratKontrol.dokter?.kode || listItem?.kodeDokter || kontrolInfo?.doctor?.kode_bpjs || "",
      namaDokter: mergedSuratKontrol.dokter?.nama || listItem?.namaDokter || kontrolInfo?.doctor?.nama || "",
      jenisPelayanan: jnsPelayanan, // Dari surat kontrol (1=Ranap, 2=Rajal)
      noSuratKontrol: mergedSuratKontrol.noSuratKontrol,
      noRujukan: noSepAsal, // No SEP asal, bukan nomor surat kontrol
      tglRujukan: tglSepAsal,
      diagAwal: diagAwal,
      namaDiagnosa: mergedSuratKontrol.namaDiagnosa || "",
      asalRujukan: "2", // Kontrol/internal (Faskes 2)
    };
  }, [mergedSuratKontrol, suratKontrolList, kontrolInfo]);

  // Load kontrol info when opened
  useEffect(() => {
    if (open && registrationId) {
      loadKontrolInfo();
    } else {
      setKontrolInfo(null);
      setSuratKontrolList([]);
      setSelectedSuratKontrol(null);
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

  // For non-BPJS, auto check-in when opened
  useEffect(() => {
    if (kontrolInfo && !kontrolInfo.isBPJS) {
      handleDirectCheckIn();
    }
  }, [kontrolInfo]);

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

  const handleSEPCreated = async (noSEP: string) => {
    toast({
      title: "SEP Berhasil Dibuat",
      description: `No SEP: ${noSEP}`,
    });

    // Check-in after SEP created
    await handleDirectCheckIn();
  };

  const handleDirectCheckIn = async () => {
    if (!registrationId) return;

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
    }
  };

  // Show loading while fetching data
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // For BPJS patients, show SEP form directly
  if (kontrolInfo?.isBPJS && kontrolInfo.patient) {
    return (
      <SEPFormSheet
        open={open}
        onOpenChange={onOpenChange}
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
        onSEPCreated={handleSEPCreated}
      />
    );
  }

  // For non-BPJS, nothing to render (auto check-in happens in useEffect)
  return null;
}
