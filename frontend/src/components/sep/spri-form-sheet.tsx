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
import {
  BPJS_FIELD_CLASS,
  BPJS_FOOTER_CLASS,
  BPJSInfoGrid,
  BPJS_PANEL_CLASS,
  BPJS_SECTION_CLASS,
  BPJSSectionHeader,
  BPJSSheetHero,
  BPJSStatePanel,
  BPJS_SHEET_MONO_FAMILY,
} from "./bpjs-sheet-chrome";

interface SPRIFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSEP?: SEPLocal | null;
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
  registrationId?: number;
  onSPRICreated?: (spriData: VClaimSPRIResponse) => void;
}

export function SPRIFormSheet({
  open,
  onOpenChange,
  activeSEP,
  patient,
  visitId,
  registrationId,
  onSPRICreated,
}: SPRIFormSheetProps) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  // Derive no_kartu from activeSEP or patient
  const noKartu = activeSEP?.no_kartu || patient.no_bpjs || "";

  // Loading states
  const [loadingPeserta, setLoadingPeserta] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Peserta state
  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);

  // Modal states (managed by PoliDokterSelector now)

  // Form fields
  const [tglRencanaKontrol, setTglRencanaKontrol] = useState(today);
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
      setTglRencanaKontrol(today);
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
    if (open && noKartu && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchKepesertaan(noKartu, today);
    }
  }, [open, noKartu]);

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
    if (!noKartu) {
      toast({ variant: "destructive", title: "Error", description: "Nomor kartu BPJS tidak tersedia" });
      return;
    }
    fetchKepesertaan(noKartu, today);
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
        no_kartu: noKartu,
        kode_dokter: kodeDokter,
        nama_dokter: namaDokter,
        poli_kontrol: kodePoli,
        nama_poli: namaPoli,
        tgl_rencana_kontrol: tglRencanaKontrol,
        visit_id: visitId,
        registration_id: registrationId || activeSEP?.registration_id || 0,
        sep_id: activeSEP?.id || 0,
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
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-[760px]">
          <BPJSSheetHero
            eyebrow="Bridging BPJS"
            title="Form SPRI Rawat Inap"
            description={<><strong>{patient.nama_lengkap}</strong> • RM {patient.no_rm}</>}
            icon={FileCheck}
            meta={
              <Badge variant="outline" className="rounded-none px-2 py-1 text-[10px] uppercase tracking-[0.24em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                SPRI
              </Badge>
            }
          />

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-6">
              {/* === SEP AKTIF (jika ada) === */}
              {activeSEP && (
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
              )}

              {/* Info Pasien (jika tidak ada SEP) */}
              {!activeSEP && (
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Context" title="Data Pasien" />
                <BPJSInfoGrid
                  items={[
                    { label: "Nama", value: patient.nama_lengkap },
                    { label: "No. Kartu BPJS", value: patient.no_bpjs || "-", mono: true },
                    { label: "No. RM", value: patient.no_rm, mono: true },
                    { label: "NIK", value: patient.nik || "-", mono: true },
                  ]}
                />
              </div>
              )}

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
                    description="Data peserta BPJS sedang diambil untuk memastikan hak kelas dan status aktif pasien."
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
                        <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.18em]">
                          {peserta.statusPeserta?.keterangan}
                        </Badge>
                      </div>
                    }
                    extra={
                      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>NIK: {peserta.nik}</span>
                        <span>Kelas Hak: {peserta.hakKelas?.keterangan}</span>
                        <span>Jenis Peserta: {peserta.jenisPeserta?.keterangan}</span>
                        <span>Faskes: {peserta.provUmum?.nmProvider || "-"}</span>
                      </div>
                    }
                  />
                )}
                {pesertaError && !loadingPeserta && (
                  <BPJSStatePanel tone="danger" icon={<XCircle className="h-4 w-4" />} title="Data peserta tidak dapat diverifikasi" description={pesertaError} />
                )}
              </div>

              {/* === FORM SPRI === */}
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
                    poliModalTitle="Cari Poli SPRI BPJS"
                    dokterModalTitle="Cari Dokter SPRI BPJS"
                    poliBPJSMinSearch={3}
                    dokterBPJSMinSearch={1}
                  />
                </div>
              </div>

              {/* === INFO RINGKASAN === */}
              {tglRencanaKontrol && kodePoli && kodeDokter && (
                <BPJSStatePanel
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Ringkasan SPRI"
                  extra={
                    <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Tanggal Kontrol: <strong className="text-foreground">{tglRencanaKontrol}</strong></span>
                      <span>Poli: <strong className="text-foreground">{namaPoli || kodePoli}</strong></span>
                      <span className="sm:col-span-2">Dokter: <strong className="text-foreground">{namaDokter || kodeDokter}</strong></span>
                    </div>
                  }
                />
              )}
            </div>
          </ScrollArea>

          <SheetFooter className={BPJS_FOOTER_CLASS}>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none border-border/70">
              Batal
            </Button>
            <Button
              onClick={handleSubmitSPRI}
              disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter}
              className="rounded-none"
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
