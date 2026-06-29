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
      <SheetContent className="flex w-[80vw] max-w-[80vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
        <div className="flex flex-col border-b px-4 py-2">
          <SheetHeader className="flex flex-row items-end justify-between pr-8 space-y-0">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-bold">Form SPRI Rawat Inap</h4>
                <Badge variant="outline">SPRI</Badge>
                <Badge variant={peserta ? "default" : pesertaError ? "destructive" : "secondary"}>
                  {loadingPeserta ? "Mengecek..." : peserta ? "Peserta Aktif" : pesertaError ? "Peserta Error" : "Belum Verifikasi"}
                </Badge>
              </div>
              <p className="text-muted-foreground">{patient.nama_lengkap} • {patient.no_rm}</p>
            </div>

            {canAssignExisting && (
              <Select value={entryMode} onValueChange={(val: any) => setEntryMode(val)}>
                <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/50 border-border/70">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="form" className="text-xs">Form SPRI</SelectItem>
                  <SelectItem value="search" className="text-xs">Cari Data</SelectItem>
                </SelectContent>
              </Select>
            )}
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 space-y-4">
            {entryMode === "form" && activeSEP && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Info SEP Aktif</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm bg-muted/50 p-4 rounded-md">
                  <div className="text-muted-foreground">No. SEP</div>
                  <div className="font-medium">{activeSEP.no_sep}</div>
                  <div className="text-muted-foreground">Poli Asal</div>
                  <div className="font-medium">{activeSEP.nama_poli || activeSEP.kode_poli || "-"}</div>
                </div>
              </div>
            )}

            {canAssignExisting && entryMode === "search" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nomor SPRI</Label>
                  <div className="flex gap-2">
                    <Input
                      value={searchNoSPRI}
                      onChange={(e) => {
                        setSearchNoSPRI(e.target.value);
                        if (searchSPRIError) setSearchSPRIError("");
                      }}
                      placeholder="Masukkan nomor SPRI"
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
                      onClick={handleSearchSPRI}
                      disabled={searchingSPRI || !searchNoSPRI.trim()}
                    >
                      {searchingSPRI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {searchSPRIError && (
                    <p className="text-sm text-destructive">{searchSPRIError}</p>
                  )}
                </div>

                {searchedSPRI && (
                  <div className="space-y-4 p-4 border rounded-md">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-muted-foreground">No. SPRI</div>
                      <div className="font-medium">{searchedSPRI.noSuratKontrol}</div>
                      <div className="text-muted-foreground">Tanggal Perintah</div>
                      <div className="font-medium">{searchedSPRI.tglRencanaKontrol}</div>
                      <div className="text-muted-foreground">Poli</div>
                      <div className="font-medium">{searchedSPRI.poli?.nama || searchedSPRI.namaPoliTujuan || "-"}</div>
                      <div className="text-muted-foreground">Dokter</div>
                      <div className="font-medium">{searchedSPRI.dokter?.nama || "-"}</div>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleAssignSPRI}
                      disabled={assigningSPRI}
                    >
                      {assigningSPRI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Assign SPRI
                    </Button>
                  </div>
                )}
              </div>
            )}

            {entryMode === "form" && (
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-end border-b pb-2 mb-4">
                  <h4 className="font-semibold text-lg">Informasi SPRI</h4>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label className="text-sm font-medium">Tgl Perintah Inap *</Label>
                    <Input
                      type="date"
                      value={tglRencanaKontrol}
                      onChange={(e) => {
                        setTglRencanaKontrol(e.target.value);
                        setKodeDokter("");
                        setNamaDokter("");
                      }}
                      min={getMinDate()}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="mt-6">
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
                </div>

                {tglRencanaKontrol && kodePoli && kodeDokter && (
                  <div className="bg-muted/50 p-4 rounded-md space-y-2 text-sm mt-4">
                    <p className="font-medium flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Ringkasan
                    </p>
                    <div className="grid grid-cols-1 gap-1 text-muted-foreground">
                      <span>Tanggal: <span className="text-foreground">{tglRencanaKontrol}</span></span>
                      <span>Poli: <span className="text-foreground">{namaPoli || kodePoli}</span></span>
                      <span>Dokter: <span className="text-foreground">{namaDokter || kodeDokter}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSubmitSPRI}
            disabled={loadingSubmit || !peserta || !tglRencanaKontrol || !kodePoli || !kodeDokter || entryMode === "search"}
          >
            {loadingSubmit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buat SPRI
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
