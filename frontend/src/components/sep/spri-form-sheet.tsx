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
  ClipboardList,
  Calendar,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type VClaimSPRIResponse,
  type VClaimSuratKontrolDetail,
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
  const canAssignExisting = (registrationId || 0) > 0 || (visitId || 0) > 0;

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
  const [searchNoSPRI, setSearchNoSPRI] = useState("");
  const [searchingSPRI, setSearchingSPRI] = useState(false);
  const [assigningSPRI, setAssigningSPRI] = useState(false);
  const [searchSPRIError, setSearchSPRIError] = useState("");
  const [searchedSPRI, setSearchedSPRI] = useState<VClaimSuratKontrolDetail | null>(null);
  const [entryMode, setEntryMode] = useState<"form" | "search">("form");

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
      setSearchNoSPRI("");
      setSearchingSPRI(false);
      setAssigningSPRI(false);
      setSearchSPRIError("");
      setSearchedSPRI(null);
      setEntryMode("form");
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
      toast({ variant: "destructive", title: "Error", description: "Pilih poli dan tanggal perintah rawat inap terlebih dahulu" });
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
      toast({ variant: "destructive", title: "Error", description: "Pilih tanggal perintah rawat inap" });
      return;
    }
    if (!kodePoli) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli perintah rawat inap" });
      return;
    }
    if (!kodeDokter) {
      toast({ variant: "destructive", title: "Error", description: "Pilih dokter perintah rawat inap" });
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

  const handleSearchSPRI = async () => {
    const noSPRI = searchNoSPRI.trim();
    if (!noSPRI) {
      setSearchSPRIError("Nomor SPRI wajib diisi");
      setSearchedSPRI(null);
      return;
    }

    setSearchingSPRI(true);
    setSearchSPRIError("");
    setSearchedSPRI(null);
    try {
      const res = await vclaimApi.getSuratKontrolDetail(noSPRI);
      const detail = res.data?.data;
      if (!detail?.noSuratKontrol) {
        setSearchSPRIError("Detail SPRI tidak ditemukan");
        return;
      }

      const jnsKontrol = detail.jnsKontrol || "";
      const namaJnsKontrol = (detail.namaJnsKontrol || "").toLowerCase();
      if (jnsKontrol && jnsKontrol !== "1" && !namaJnsKontrol.includes("spri")) {
        setSearchSPRIError("Nomor yang dicari bukan jenis SPRI");
        return;
      }

      setSearchedSPRI(detail);
    } catch (error: any) {
      setSearchSPRIError(error.response?.data?.error || "Gagal mengambil detail SPRI");
    } finally {
      setSearchingSPRI(false);
    }
  };

  const handleAssignSPRI = async () => {
    if (!searchedSPRI?.noSuratKontrol) return;
    if (!registrationId && !visitId) {
      toast({
        variant: "destructive",
        title: "Gagal assign SPRI",
        description: "Registration/visit tidak tersedia untuk assignment SPRI.",
      });
      return;
    }

    setAssigningSPRI(true);
    try {
      await vclaimApi.importSPRI({
        no_spri: searchedSPRI.noSuratKontrol,
        no_kartu: searchedSPRI.noKartu || noKartu,
        nama: searchedSPRI.nama || patient.nama_lengkap,
        kelamin: searchedSPRI.kelamin || "",
        tgl_lahir: searchedSPRI.tglLahir || patient.tanggal_lahir || "",
        tgl_rencana_kontrol: searchedSPRI.tglRencanaKontrol || "",
        kode_poli: searchedSPRI.poli?.kode || "",
        nama_poli: searchedSPRI.poli?.nama || searchedSPRI.namaPoliTujuan || "",
        kode_dokter: searchedSPRI.dokter?.kode || "",
        nama_dokter: searchedSPRI.dokter?.nama || "",
        nama_diagnosa: searchedSPRI.namaDiagnosa || "",
        patient_id: patient.id,
        registration_id: registrationId || 0,
        visit_id: visitId || 0,
        sep_id: activeSEP?.id || 0,
      });

      toast({
        title: "SPRI berhasil di-assign",
        description: `Nomor SPRI ${searchedSPRI.noSuratKontrol} berhasil ditautkan ke pendaftaran.`,
      });

      onSPRICreated?.({
        noSPRI: searchedSPRI.noSuratKontrol,
        tglRencanaKontrol: searchedSPRI.tglRencanaKontrol || "",
        namaDokter: searchedSPRI.dokter?.nama || "",
        noKartu: searchedSPRI.noKartu || noKartu,
        nama: searchedSPRI.nama || patient.nama_lengkap,
        kelamin: searchedSPRI.kelamin || "",
        tglLahir: searchedSPRI.tglLahir || patient.tanggal_lahir || "",
        namaDiagnosa: searchedSPRI.namaDiagnosa || null,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal assign SPRI",
        description: error.response?.data?.error || "Terjadi kesalahan saat assign SPRI",
      });
    } finally {
      setAssigningSPRI(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    return format(new Date(), "yyyy-MM-dd");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-[80vw] max-w-[80vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
          <BPJSSheetHero
            eyebrow="Bridging BPJS"
            title="Form SPRI Rawat Inap"
            description={<><strong>{patient.nama_lengkap}</strong> • RM {patient.no_rm}</>}
            icon={FileCheck}
            meta={
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-none px-2 py-1 text-[10px] uppercase tracking-[0.24em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                  SPRI
                </Badge>
                <Badge
                  variant={peserta ? "default" : pesertaError ? "destructive" : "secondary"}
                  className="rounded-none px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
                  style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}
                >
                  {loadingPeserta ? "Mengecek" : peserta ? "Peserta Aktif" : pesertaError ? "Peserta Error" : "Belum Verifikasi"}
                </Badge>
              </div>
            }
          />

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-6">
              {canAssignExisting && (
                <div className={BPJS_SECTION_CLASS}>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={entryMode === "form" ? "default" : "outline"}
                      className="h-8 rounded-none border-border/70 px-3 text-xs"
                      onClick={() => setEntryMode("form")}
                    >
                      Form SPRI
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={entryMode === "search" ? "default" : "outline"}
                      className="h-8 rounded-none border-border/70 px-3 text-xs"
                      onClick={() => setEntryMode("search")}
                    >
                      Cari Berdasarkan SPRI
                    </Button>
                  </div>
                </div>
              )}

              {entryMode === "form" && (
                <>
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
                </>
              )}

              {canAssignExisting && entryMode === "search" && (
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Assign" title="Cari & Assign SPRI" />
                <div className={`${BPJS_PANEL_CLASS} space-y-3 p-4`}>
                  <div className="flex gap-2">
                    <Input
                      value={searchNoSPRI}
                      onChange={(e) => {
                        setSearchNoSPRI(e.target.value);
                        if (searchSPRIError) setSearchSPRIError("");
                      }}
                      placeholder="Masukkan nomor SPRI"
                      className={BPJS_FIELD_CLASS}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchSPRI();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-none border-border/70 px-3"
                      onClick={handleSearchSPRI}
                      disabled={searchingSPRI || !searchNoSPRI.trim()}
                    >
                      {searchingSPRI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {searchSPRIError && (
                    <BPJSStatePanel tone="danger" title="Pencarian SPRI gagal" description={searchSPRIError} />
                  )}

                  {searchedSPRI && (
                    <div className="space-y-3">
                      <BPJSInfoGrid
                        items={[
                          { label: "No. SPRI", value: searchedSPRI.noSuratKontrol || "-", mono: true },
                          { label: "No. Kartu", value: searchedSPRI.noKartu || "-", mono: true },
                          { label: "Nama Peserta", value: searchedSPRI.nama || "-" },
                          { label: "Tanggal Perintah", value: searchedSPRI.tglRencanaKontrol || "-" },
                          { label: "Poli", value: searchedSPRI.poli?.nama || searchedSPRI.namaPoliTujuan || "-", span: 2 },
                          { label: "Dokter", value: searchedSPRI.dokter?.nama || "-" },
                          { label: "Diagnosa", value: searchedSPRI.namaDiagnosa || "-", span: 2 },
                        ]}
                      />
                      <Button
                        type="button"
                        className="w-full rounded-none"
                        onClick={handleAssignSPRI}
                        disabled={assigningSPRI}
                      >
                        {assigningSPRI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Assign SPRI ke Pendaftaran
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              )}

              {entryMode === "form" && (
                <>
              {/* === FORM SPRI === */}
              <div className={BPJS_SECTION_CLASS}>
                <BPJSSectionHeader eyebrow="Planning" title="Surat Perintah Rawat Inap (SPRI)" />
                
                {/* Tanggal Perintah Rawat Inap */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2 uppercase tracking-[0.14em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Tanggal Perintah Rawat Inap<span className="text-destructive">*</span>
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
                    poliFieldLabel="Poli Rawat Inap"
                    dokterFieldLabel="Dokter Rawat Inap"
                    poliInputPlaceholder="Pilih poli rawat inap"
                    dokterInputPlaceholder="Pilih dokter rawat inap"
                    dokterInputPlaceholderDisabled="Pilih poli & tanggal perintah dulu"
                    dokterHint="Pilih poli dan tanggal perintah rawat inap terlebih dahulu untuk mencari dokter"
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
                      <span>Tanggal Perintah: <strong className="text-foreground">{tglRencanaKontrol}</strong></span>
                      <span>Poli: <strong className="text-foreground">{namaPoli || kodePoli}</strong></span>
                      <span className="sm:col-span-2">Dokter: <strong className="text-foreground">{namaDokter || kodeDokter}</strong></span>
                    </div>
                  }
                />
              )}
                </>
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
