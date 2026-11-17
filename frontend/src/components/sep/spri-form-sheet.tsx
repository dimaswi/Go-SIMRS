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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import {
  vclaimApi,
  type VClaimPeserta,
  type SEPLocal,
  type VClaimSPRIResponse,
  type VClaimSuratKontrolDetail,
} from "@/lib/api/vclaim";
import { PoliDokterSelector } from "./poli-dokter-selector";

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

  const noKartu = activeSEP?.no_kartu || patient.no_bpjs || "";

  const [loadingPeserta, setLoadingPeserta] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [peserta, setPeserta] = useState<VClaimPeserta | null>(null);
  const [pesertaError, setPesertaError] = useState<string | null>(null);

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

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (open) {
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

  useEffect(() => {
    if (open && noKartu && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchKepesertaan(noKartu, today);
    }
  }, [open, noKartu]);

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

  const handleSearchPoli = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoliSPRI(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const handleSearchDokter = async (keyword: string) => {
    if (!kodePoli || !tglRencanaKontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli dan tanggal perintah rawat inap terlebih dahulu" });
      return [];
    }
    try {
      const res = await vclaimApi.searchDokterSPRI(kodePoli, tglRencanaKontrol);
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

  const handleSubmitSPRI = async () => {
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

  const getMinDate = () => {
    return format(new Date(), "yyyy-MM-dd");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[80vw] max-w-[80vw] flex-col gap-0 p-0 sm:w-[80vw] sm:max-w-[80vw]">
        <div className="flex flex-col border-b px-6 py-2.5">
          <SheetHeader className="flex flex-row items-center justify-between pr-8 space-y-0">
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold leading-tight">Form SPRI Rawat Inap</h4>
                <Badge variant="outline" className="h-5 text-[10px]">SPRI</Badge>
                <Badge
                  variant={peserta ? "default" : pesertaError ? "destructive" : "secondary"}
                  className="h-5 text-[10px]"
                >
                  {loadingPeserta ? "Mengecek..." : peserta ? "Peserta Aktif" : pesertaError ? "Peserta Error" : "Belum Verifikasi"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{patient.nama_lengkap} • {patient.no_rm}</p>
            </div>

            {canAssignExisting && (
              <div className="inline-flex items-center rounded-md border border-border/60 bg-muted p-0.5">
                {(
                  [
                    { value: "form", label: "Form SPRI" },
                    { value: "search", label: "Cari Data" },
                  ] as const
                ).map((opt) => {
                  const active = entryMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEntryMode(opt.value)}
                      className={cn(
                        "h-7 rounded-sm px-2.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/70">
            {entryMode === "form" && activeSEP && (
              <div className="px-6 py-4 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Info SEP Aktif
                </div>
                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">No. SEP</div>
                    <div className="mt-0.5 font-mono font-medium text-foreground">{activeSEP.no_sep}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Poli Asal</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {activeSEP.nama_poli || activeSEP.kode_poli || "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {canAssignExisting && entryMode === "search" && (
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nomor SPRI</Label>
                  <div className="flex gap-2">
                    <Input
                      value={searchNoSPRI}
                      onChange={(e) => {
                        setSearchNoSPRI(e.target.value);
                        if (searchSPRIError) setSearchSPRIError("");
                      }}
                      placeholder="Masukkan nomor SPRI"
                      className="h-8 text-xs rounded-md"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchSPRI();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={handleSearchSPRI}
                      disabled={searchingSPRI || !searchNoSPRI.trim()}
                    >
                      {searchingSPRI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {searchSPRIError && (
                    <p className="text-xs text-destructive">{searchSPRIError}</p>
                  )}
                </div>

                {searchedSPRI && (
                  <div className="border-t border-border/60 pt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">No. SPRI</div>
                        <div className="mt-0.5 font-mono font-medium text-foreground">{searchedSPRI.noSuratKontrol}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tanggal Perintah</div>
                        <div className="mt-0.5 font-medium text-foreground">{searchedSPRI.tglRencanaKontrol}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Poli</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {searchedSPRI.poli?.nama || searchedSPRI.namaPoliTujuan || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dokter</div>
                        <div className="mt-0.5 font-medium text-foreground">{searchedSPRI.dokter?.nama || "-"}</div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleAssignSPRI}
                        disabled={assigningSPRI}
                      >
                        {assigningSPRI ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                        Assign SPRI
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {entryMode === "form" && (
              <div className="px-6 py-3 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Informasi SPRI
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Tgl Perintah Inap <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={tglRencanaKontrol}
                    onChange={(e) => {
                      setTglRencanaKontrol(e.target.value);
                      setKodeDokter("");
                      setNamaDokter("");
                    }}
                    min={getMinDate()}
                    className="h-8 w-full text-xs rounded-md"
                  />
                </div>

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
                  poliModalTitle="Cari Poli"
                  dokterModalTitle="Cari Dokter"
                  poliFieldLabel="Poli Rawat Inap"
                  dokterFieldLabel="Dokter Rawat Inap"
                  poliInputPlaceholder="Pilih poli rawat inap"
                  dokterInputPlaceholder="Pilih dokter rawat inap"
                  dokterInputPlaceholderDisabled="Pilih poli & tanggal perintah dulu"
                  dokterHint="Pilih poli dan tanggal perintah rawat inap terlebih dahulu untuk mencari dokter"
                  poliBPJSMinSearch={3}
                  dokterBPJSMinSearch={1}
                  compact={true}
                />

                {tglRencanaKontrol && kodePoli && kodeDokter && (
                  <div className="border-l-2 border-emerald-500 bg-emerald-50/40 px-3 py-2 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-foreground">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Ringkasan SPRI
                    </p>
                    <div className="grid grid-cols-1 gap-1 md:grid-cols-3 text-muted-foreground">
                      <span>Tanggal: <span className="text-foreground font-medium">{tglRencanaKontrol}</span></span>
                      <span>Poli: <span className="text-foreground font-medium">{namaPoli || kodePoli}</span></span>
                      <span>Dokter: <span className="text-foreground font-medium">{namaDokter || kodeDokter}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-3 border-t sm:justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSubmitSPRI}
            disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter || entryMode === "search"}
          >
            {loadingSubmit && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Buat SPRI
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
