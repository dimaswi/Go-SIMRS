import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { printApi } from "@/lib/api/print";
import { vclaimApi } from "@/lib/api/vclaim";
import { useToast } from "@/hooks/use-toast";
import type { SEPLocal } from "@/lib/api/vclaim";
import {
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  Printer,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchModal } from "./search-modal";

interface SEPDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sep: SEPLocal | null;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function SEPDetailSheet({
  open,
  onOpenChange,
  sep,
  onUpdate,
  onDelete,
}: SEPDetailSheetProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Search modal states
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [dokterModalOpen, setDokterModalOpen] = useState(false);
  const [diagnosaModalOpen, setDiagnosaModalOpen] = useState(false);

  // Edit form state - sama seperti create SEP
  const [editForm, setEditForm] = useState({
    catatan: "",
    diag_awal: "",      // Kode ICD-10
    nama_diagnosa: "",  // Nama diagnosa
    kls_rawat_naik: "",
    pembiayaan: "",
    penanggung_jawab: "",
    no_telp: "",
    poli_tujuan: "",    // Kode poli BPJS
    nama_poli: "",      // Nama poli
    poli_eksekutif: "0",
    cob: "0",
    katarak: "0",
    laka_lantas: "0",
    dpjp_layan: "",     // Kode dokter DPJP
    nama_dpjp: "",      // Nama dokter
  });

  useEffect(() => {
    if (sep && open) {
      // Get phone number: prioritas no_telp dari SEP, fallback ke patient.no_telepon atau patient.no_hp
      const phoneNumber = sep.no_telp || sep.patient?.no_telepon || sep.patient?.no_hp || "";

      setEditForm({
        catatan: sep.catatan || "",
        diag_awal: sep.diag_awal || "",
        nama_diagnosa: sep.nama_diagnosa || "",
        kls_rawat_naik: sep.kls_rawat_naik || "",
        pembiayaan: sep.pembiayaan || "",
        penanggung_jawab: "",
        no_telp: phoneNumber,
        poli_tujuan: sep.kode_poli || "",
        nama_poli: sep.nama_poli || "",
        poli_eksekutif: sep.poli_eks || "0",
        cob: sep.cob || "0",
        katarak: sep.katarak || "0",
        laka_lantas: sep.laka_lantas || "0",
        dpjp_layan: sep.kode_dpjp || "",
        nama_dpjp: sep.nama_dpjp || "",
      });
      setIsEditing(false);
    }
  }, [sep, open]);

  // Search handlers - sama seperti create SEP
  const handleSearchPoli = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoli(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const handleSearchDokter = async (keyword: string) => {
    if (!keyword) {
      toast({ variant: "destructive", title: "Error", description: "Masukkan kode spesialis (contoh: INT, BED, ANA)" });
      return [];
    }
    try {
      const jnsPelayanan = sep?.jns_pelayanan || "2";
      const tglSEP = sep?.tgl_sep || new Date().toISOString().split('T')[0];
      const res = await vclaimApi.searchDokterDPJP(jnsPelayanan, tglSEP, keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const handleSearchDiagnosa = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchDiagnosa(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const handleUpdate = async () => {
    if (!sep?.no_sep) return;

    // Validasi field wajib
    if (!editForm.poli_tujuan) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli tujuan" });
      return;
    }
    if (!editForm.diag_awal) {
      toast({ variant: "destructive", title: "Error", description: "Pilih diagnosa awal" });
      return;
    }

    setUpdating(true);
    try {
      await api.put(`/bpjs/vclaim/sep/${sep.no_sep}`, {
        no_sep: sep.no_sep,
        kls_rawat_hak: sep.kls_rawat_hak,
        kls_rawat_naik: editForm.kls_rawat_naik === "none" ? "" : editForm.kls_rawat_naik,
        pembiayaan: editForm.pembiayaan === "none" ? "" : editForm.pembiayaan,
        penanggung_jawab: editForm.penanggung_jawab,
        no_mr: sep.no_mr,
        catatan: editForm.catatan,
        diag_awal: editForm.diag_awal,
        poli_tujuan: editForm.poli_tujuan,
        poli_eksekutif: editForm.poli_eksekutif,
        cob: editForm.cob,
        katarak: editForm.katarak,
        laka_lantas: editForm.laka_lantas,
        dpjp_layan: editForm.dpjp_layan,
        no_telp: editForm.no_telp,
      });
      toast({
        title: "Berhasil",
        description: "SEP berhasil diupdate",
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mengupdate SEP",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!sep?.no_sep) return;

    setDeleting(true);
    try {
      await api.delete(`/bpjs/vclaim/sep/${sep.no_sep}`);
      toast({
        title: "Berhasil",
        description: "SEP berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onDelete?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus SEP",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = async () => {
    if (!sep?.id) return;

    setPrinting(true);
    try {
      await printApi.sep(sep.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak SEP",
      });
    } finally {
      setPrinting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 border-green-300">Aktif</Badge>;
      case "deleted":
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJenisPelayanan = (jns: string) => jns === "1" ? "Rawat Inap" : "Rawat Jalan";

  const getKelasRawat = (kelas: string) => {
    switch (kelas) {
      case "1": return "Kelas 1";
      case "2": return "Kelas 2";
      case "3": return "Kelas 3";
      default: return kelas;
    }
  };

  if (!sep) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[80vw] max-w-[80vw] sm:w-[80vw] sm:max-w-[80vw]">
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Data SEP tidak tersedia</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex h-full w-[80vw] max-w-[80vw] flex-col gap-0 p-0 sm:w-[80vw] sm:max-w-[80vw]">
          <div className="flex flex-col border-b px-6 py-2.5">
            <SheetHeader className="flex flex-row items-center justify-between pr-8 space-y-0">
              <div className="space-y-0.5 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold leading-tight">Detail SEP</h4>
                  <Badge variant="outline" className="h-5 text-[10px]">SEP</Badge>
                  {getStatusBadge(sep.status)}
                </div>
                <p className="font-mono text-xs text-muted-foreground">{sep.no_sep}</p>
              </div>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Status Warning for Deleted SEP */}
            {sep.status === "deleted" && (
              <div className="mx-6 mt-3 flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">SEP ini telah dibatalkan</div>
                  <p>SEP tidak dapat digunakan lagi untuk proses klaim atau tindak lanjut layanan.</p>
                </div>
              </div>
            )}

            {!isEditing ? (
              /* Detail View */
              <div className="divide-y divide-border/70">
                <div className="px-6 py-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Informasi SEP
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">No. SEP</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">{sep.no_sep}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Tanggal SEP</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {sep.tgl_sep ? new Date(sep.tgl_sep).toLocaleDateString("id-ID") : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Jenis Pelayanan</span>
                      <p className="mt-0.5 font-medium text-foreground">{getJenisPelayanan(sep.jns_pelayanan)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Kelas Rawat</span>
                      <p className="mt-0.5 font-medium text-foreground">{getKelasRawat(sep.kls_rawat_hak)}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Data Peserta
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">No. Kartu BPJS</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">{sep.no_kartu}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Nama Peserta</span>
                      <p className="mt-0.5 font-medium text-foreground">{sep.nama_pasien}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">No. RM</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">{sep.no_mr}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">NIK</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">{sep.nik || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Rujukan &amp; Layanan
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">No. Rujukan</span>
                      <p className="mt-0.5 font-mono font-medium text-foreground">{sep.no_rujukan || "-"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Tanggal Rujukan</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {sep.tgl_rujukan ? new Date(sep.tgl_rujukan).toLocaleDateString("id-ID") : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Faskes Perujuk</span>
                      <p className="mt-0.5 font-medium text-foreground">{sep.nama_rujukan || sep.ppk_rujukan || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3 pt-1">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Poli Tujuan</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {sep.nama_poli || "-"} {sep.kode_poli ? `(${sep.kode_poli})` : ""}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Dokter DPJP</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {sep.nama_dpjp || "-"} {sep.kode_dpjp ? `(${sep.kode_dpjp})` : ""}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Diagnosa Awal</span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {sep.nama_diagnosa || sep.diag_awal || "-"}
                        {sep.diag_awal && sep.nama_diagnosa && sep.diag_awal !== sep.nama_diagnosa && ` (${sep.diag_awal})`}
                      </p>
                    </div>
                  </div>
                </div>

                {sep.catatan && (
                  <div className="px-6 py-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Catatan
                    </div>
                    <p className="text-xs leading-relaxed text-foreground">{sep.catatan}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Edit View */
              <div className="divide-y divide-border/70">
                <div className="px-6 py-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Naik Kelas &amp; Pembiayaan
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Naik Kelas</Label>
                      <Select
                        value={editForm.kls_rawat_naik || "none"}
                        onValueChange={(value) => setEditForm({ ...editForm, kls_rawat_naik: value, pembiayaan: value === "none" ? "" : editForm.pembiayaan })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Tidak Naik</SelectItem>
                          <SelectItem value="1" className="text-xs">VVIP</SelectItem>
                          <SelectItem value="2" className="text-xs">VIP</SelectItem>
                          <SelectItem value="3" className="text-xs">Kelas 1</SelectItem>
                          <SelectItem value="4" className="text-xs">Kelas 2</SelectItem>
                          <SelectItem value="5" className="text-xs">Kelas 3</SelectItem>
                          <SelectItem value="6" className="text-xs">ICCU</SelectItem>
                          <SelectItem value="7" className="text-xs">ICU</SelectItem>
                          <SelectItem value="8" className="text-xs">Diatas Kelas 1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Pembiayaan</Label>
                      <Select
                        value={editForm.pembiayaan || "none"}
                        onValueChange={(value) => setEditForm({ ...editForm, pembiayaan: value })}
                        disabled={!editForm.kls_rawat_naik || editForm.kls_rawat_naik === "none"}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">-</SelectItem>
                          <SelectItem value="1" className="text-xs">Pribadi</SelectItem>
                          <SelectItem value="2" className="text-xs">Pemberi Kerja</SelectItem>
                          <SelectItem value="3" className="text-xs">Asuransi Tambahan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Penanggung Jawab</Label>
                      <Input
                        value={editForm.penanggung_jawab}
                        onChange={(e) => setEditForm({ ...editForm, penanggung_jawab: e.target.value })}
                        placeholder="Nama penanggung jawab"
                        disabled={!editForm.kls_rawat_naik || editForm.kls_rawat_naik === "none"}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pelayanan &amp; Diagnosa
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Poli Tujuan *</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={editForm.nama_poli ? `${editForm.nama_poli} (${editForm.poli_tujuan})` : editForm.poli_tujuan}
                          readOnly
                          placeholder="Pilih poli tujuan"
                          className="h-8 text-xs flex-1"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 px-0 shrink-0" onClick={() => setPoliModalOpen(true)}>
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Dokter DPJP</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={editForm.nama_dpjp ? `${editForm.nama_dpjp} (${editForm.dpjp_layan})` : editForm.dpjp_layan}
                          readOnly
                          placeholder="Pilih dokter DPJP"
                          className="h-8 text-xs flex-1"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 px-0 shrink-0" onClick={() => setDokterModalOpen(true)}>
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Cari kode spesialis: INT, BED, ANA, dll</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Diagnosa Awal *</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={editForm.nama_diagnosa ? `${editForm.diag_awal} - ${editForm.nama_diagnosa}` : editForm.diag_awal}
                          readOnly
                          placeholder="Pilih diagnosa awal"
                          className="h-8 text-xs flex-1"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 px-0 shrink-0" onClick={() => setDiagnosaModalOpen(true)}>
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Informasi Tambahan
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Poli Eksekutif</Label>
                      <Select value={editForm.poli_eksekutif} onValueChange={(value) => setEditForm({ ...editForm, poli_eksekutif: value })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">Tidak</SelectItem>
                          <SelectItem value="1" className="text-xs">Ya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">COB</Label>
                      <Select value={editForm.cob} onValueChange={(value) => setEditForm({ ...editForm, cob: value })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">Tidak</SelectItem>
                          <SelectItem value="1" className="text-xs">Ya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Katarak</Label>
                      <Select value={editForm.katarak} onValueChange={(value) => setEditForm({ ...editForm, katarak: value })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">Tidak</SelectItem>
                          <SelectItem value="1" className="text-xs">Ya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Lakalantas</Label>
                      <Select value={editForm.laka_lantas} onValueChange={(value) => setEditForm({ ...editForm, laka_lantas: value })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">Bukan KLL</SelectItem>
                          <SelectItem value="1" className="text-xs">KLL &amp; Bukan KK</SelectItem>
                          <SelectItem value="2" className="text-xs">KLL &amp; KK</SelectItem>
                          <SelectItem value="3" className="text-xs">KK</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <Label className="text-xs font-medium">No. Telepon</Label>
                      <Input
                        value={editForm.no_telp}
                        onChange={(e) => setEditForm({ ...editForm, no_telp: e.target.value })}
                        placeholder="No. telepon pasien"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <Label className="text-xs font-medium">Catatan</Label>
                    <Textarea
                      value={editForm.catatan}
                      onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                      rows={2}
                      placeholder="Catatan tambahan"
                      className="min-h-[60px] text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="sticky bottom-0 z-20 border-t bg-background/95 px-6 py-3 backdrop-blur">
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handlePrint}
                disabled={printing || updating || deleting}
              >
                {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1.5 h-3.5 w-3.5" />}
                Cetak SEP
              </Button>

              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
                      Tutup
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setIsEditing(true)}
                      disabled={sep.status !== "active"}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit SEP
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={sep.status !== "active" || deleting}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Hapus SEP
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsEditing(false)} disabled={updating}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Batal
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={handleUpdate} disabled={updating}>
                      {updating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      Simpan
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Search Modal - Poli */}
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
          setEditForm({
            ...editForm,
            poli_tujuan: item.kode,
            nama_poli: item.nama,
          });
        }}
      />

      {/* Search Modal - Dokter DPJP */}
      <SearchModal
        open={dokterModalOpen}
        onOpenChange={setDokterModalOpen}
        title="Cari Dokter DPJP"
        placeholder="Ketik kode spesialis (INT, BED, ANA)..."
        columns={[
          { key: "kode", label: "Kode", width: "100px" },
          { key: "nama", label: "Nama Dokter" },
        ]}
        onSearch={handleSearchDokter}
        onSelect={(item) => {
          setEditForm({
            ...editForm,
            dpjp_layan: item.kode,
            nama_dpjp: item.nama,
          });
        }}
      />

      {/* Search Modal - Diagnosa */}
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
          setEditForm({
            ...editForm,
            diag_awal: item.kode,
            nama_diagnosa: item.nama,
          });
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEP</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus SEP <strong>{sep.no_sep}</strong>?
              <br /><br />
              Tindakan ini akan menghapus data SEP dari BPJS dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus SEP"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
