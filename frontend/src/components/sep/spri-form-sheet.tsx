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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  FileCheck,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Calendar,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type VClaimSPRIResponse,
} from "@/lib/api/vclaim";
import { PoliDokterSelector } from "./poli-dokter-selector";

interface SPRIFormSheetProps {
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
  onSPRICreated?: (spriData: VClaimSPRIResponse) => void;
}

export function SPRIFormSheet({
  open,
  onOpenChange,
  activeSEP,
  patient,
  visitId,
  onSPRICreated,
}: SPRIFormSheetProps) {
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
    } catch (error: any) {
      setPeserta(null);
      setPesertaError(error.response?.data?.error || error.message || "Gagal mengambil data peserta");
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

  // Search Poli untuk SPRI (rawat inap)
  const handleSearchPoli = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoliSPRI(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  // Search Dokter untuk SPRI
  const handleSearchDokter = async (keyword: string) => {
    if (!kodePoli || !tglRencanaKontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli dan tanggal kontrol terlebih dahulu" });
      return [];
    }
    try {
      const res = await vclaimApi.searchDokterSPRI(kodePoli, tglRencanaKontrol);
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

  // Submit SPRI
  const handleSubmitSPRI = async () => {
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
      const res = await vclaimApi.createSPRI({
        no_kartu: activeSEP.no_kartu,
        kode_dokter: kodeDokter,
        nama_dokter: namaDokter,
        poli_kontrol: kodePoli,
        nama_poli: namaPoli,
        tgl_rencana_kontrol: tglRencanaKontrol,
        visit_id: visitId,
        registration_id: activeSEP.registration_id,
        sep_id: activeSEP.id,
      });

      const spriData = res.data.data;

      toast({
        title: "SPRI Berhasil Dibuat",
        description: `No. SPRI: ${spriData.noSPRI}`,
      });

      if (onSPRICreated) {
        onSPRICreated(spriData);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Membuat SPRI",
        description: error.response?.data?.error || error.message || "Terjadi kesalahan",
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    return format(new Date(), "yyyy-MM-dd");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[50%] sm:max-w-[50%] flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b bg-blue-50/50">
            <SheetTitle className="flex items-center gap-2 text-blue-800">
              <FileCheck className="h-5 w-5" />
              Buat SPRI (Surat Perintah Rawat Inap)
            </SheetTitle>
            <SheetDescription>
              SPRI untuk pasien <strong>{patient.nama_lengkap}</strong> (RM: {patient.no_rm})
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {/* === SEP AKTIF === */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Data SEP Aktif</h3>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-blue-600 font-medium">No. SEP</span>
                      <p className="font-bold text-blue-800">{activeSEP.no_sep}</p>
                    </div>
                    <div>
                      <span className="text-xs text-blue-600 font-medium">No. Kartu BPJS</span>
                      <p className="font-bold text-blue-800">{activeSEP.no_kartu}</p>
                    </div>
                    <div>
                      <span className="text-xs text-blue-600 font-medium">Tanggal SEP</span>
                      <p className="font-medium">{activeSEP.tgl_sep}</p>
                    </div>
                    <div>
                      <span className="text-xs text-blue-600 font-medium">Poli Asal</span>
                      <p className="font-medium">{activeSEP.nama_poli || activeSEP.kode_poli || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-blue-600 font-medium">Diagnosa Awal</span>
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

              {/* === FORM SPRI === */}
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
                  poliModalTitle="Cari Poli SPRI BPJS"
                  dokterModalTitle="Cari Dokter SPRI BPJS"
                  poliBPJSMinSearch={3}
                  dokterBPJSMinSearch={1}
                />
              </div>

              {/* === INFO RINGKASAN === */}
              {tglRencanaKontrol && kodePoli && kodeDokter && (
                <Alert className="bg-blue-50 border-blue-200">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700">Ringkasan SPRI</AlertTitle>
                  <AlertDescription className="text-blue-700 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Tanggal Kontrol: <strong>{tglRencanaKontrol}</strong></div>
                      <div>Poli: <strong>{namaPoli || kodePoli}</strong></div>
                      <div className="col-span-2">Dokter: <strong>{namaDokter || kodeDokter}</strong></div>
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
              onClick={handleSubmitSPRI}
              disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loadingSubmit ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Buat SPRI
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Search modals are now managed inside PoliDokterSelector */}
    </>
  );
}
