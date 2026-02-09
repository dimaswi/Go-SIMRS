import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Save,
  FileText,
  FileCheck,
  Trash2,
  Check,
  Minus,
  ShieldCheck,
} from "lucide-react";
import { vclaimApi, type VClaimListRencanaKontrolItem, type VClaimPersetujuanSEPItem } from "@/lib/api/vclaim";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Form schema for Get SEP
const getSEPSchema = z.object({
  noSEP: z.string().min(1, "Nomor SEP wajib diisi"),
});

type GetSEPForm = z.infer<typeof getSEPSchema>;

// Helper: render a labeled value
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground leading-none mb-1">{label}</dt>
      <dd className={cn("text-sm truncate", mono && "font-mono")}>{value || "-"}</dd>
    </div>
  );
}

export default function BPJSToolsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("get-sep");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sepData, setSepData] = useState<any>(null);

  // Surat Kontrol state
  const [skNoKartu, setSkNoKartu] = useState("");
  const [skBulan, setSkBulan] = useState(() => String(new Date().getMonth() + 1));
  const [skTahun, setSkTahun] = useState(() => String(new Date().getFullYear()));
  const [skFilter, setSkFilter] = useState("2");
  const [skLoading, setSkLoading] = useState(false);
  const [skData, setSkData] = useState<VClaimListRencanaKontrolItem[]>([]);
  const [skSearched, setSkSearched] = useState(false);
  const [skDeleting, setSkDeleting] = useState<string | null>(null);
  const [skDeleteConfirm, setSkDeleteConfirm] = useState<VClaimListRencanaKontrolItem | null>(null);

  // Approval SEP state
  const [approvalBulan, setApprovalBulan] = useState(() => String(new Date().getMonth() + 1));
  const [approvalTahun, setApprovalTahun] = useState(() => String(new Date().getFullYear()));
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalData, setApprovalData] = useState<VClaimPersetujuanSEPItem[]>([]);
  const [approvalSearched, setApprovalSearched] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState<string | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<VClaimPersetujuanSEPItem | null>(null);
  const [approvalKeterangan, setApprovalKeterangan] = useState("");
  
  // Manual Approval SEP input state
  const [manualNoKartu, setManualNoKartu] = useState("");
  const [manualTglSep, setManualTglSep] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualJnsPelayanan, setManualJnsPelayanan] = useState("2"); // 1=RI, 2=RJ
  const [manualJnsPengajuan, setManualJnsPengajuan] = useState("1"); // 1=Backdate, 2=Finger Print
  const [manualKeterangan, setManualKeterangan] = useState("");
  const [manualApprovalSubmitting, setManualApprovalSubmitting] = useState(false);

  // Pengajuan SEP state
  const [pengajuanNoKartu, setPengajuanNoKartu] = useState("");
  const [pengajuanTglSep, setPengajuanTglSep] = useState(() => new Date().toISOString().slice(0, 10));
  const [pengajuanJnsPelayanan, setPengajuanJnsPelayanan] = useState("2"); // 1=RI, 2=RJ
  const [pengajuanJnsPengajuan, setPengajuanJnsPengajuan] = useState("1"); // 1=Backdate, 2=Finger Print
  const [pengajuanKeterangan, setPengajuanKeterangan] = useState("");
  const [pengajuanSubmitting, setPengajuanSubmitting] = useState(false);

  const form = useForm<GetSEPForm>({
    resolver: zodResolver(getSEPSchema),
    defaultValues: { noSEP: "" },
  });

  const handleGetSEP = async (data: GetSEPForm) => {
    setLoading(true);
    setSepData(null);
    try {
      const res = await vclaimApi.getSEP(data.noSEP);
      const sep = res.data.data as any;
      if (sep?.noSep) {
        setSepData(sep);
      } else {
        toast({ variant: "destructive", title: "Tidak ditemukan", description: "Data SEP tidak ditemukan" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil data SEP" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSuratKontrol = useCallback(async () => {
    if (!skNoKartu.trim()) {
      toast({ variant: "destructive", title: "No. Kartu wajib diisi" });
      return;
    }
    setSkLoading(true);
    setSkData([]);
    setSkSearched(true);
    try {
      const res = await vclaimApi.getListRencanaKontrol(skNoKartu.trim(), {
        bulan: skBulan.padStart(2, "0"),
        tahun: skTahun,
        filter: skFilter,
      });
      setSkData(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil data" });
    } finally {
      setSkLoading(false);
    }
  }, [skNoKartu, skBulan, skTahun, skFilter, toast]);

  const handleDeleteSuratKontrol = async (item: VClaimListRencanaKontrolItem) => {
    setSkDeleting(item.noSuratKontrol);
    try {
      await vclaimApi.deleteSuratKontrol(item.noSuratKontrol);
      toast({ title: "Berhasil dibatalkan", description: item.noSuratKontrol });
      setSkData(prev => prev.filter(sk => sk.noSuratKontrol !== item.noSuratKontrol));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal membatalkan" });
    } finally {
      setSkDeleting(null);
      setSkDeleteConfirm(null);
    }
  };

  // Approval SEP handlers
  const handleSearchApprovalSEP = async () => {
    setApprovalLoading(true);
    setApprovalData([]);
    setApprovalSearched(true);
    try {
      const res = await vclaimApi.getListPersetujuanSEP(
        approvalBulan.padStart(2, "0"),
        approvalTahun
      );
      setApprovalData(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil data persetujuan SEP" });
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleApprovalSEP = async (item: VClaimPersetujuanSEPItem, jnsPengajuan: string) => {
    if (!approvalKeterangan.trim()) {
      toast({ variant: "destructive", title: "Keterangan wajib diisi" });
      return;
    }
    setApprovalSubmitting(item.noKartu);
    try {
      await vclaimApi.approvalSEP({
        no_kartu: item.noKartu,
        tgl_sep: item.tglsep,
        jns_pelayanan: item.jnspelayanan === "RI" ? "1" : "2",
        jns_pengajuan: jnsPengajuan, // "1" = backdate, "2" = fingerprint
        keterangan: approvalKeterangan,
      });
      toast({ title: "Berhasil", description: "Pengajuan approval SEP berhasil dikirim" });
      setApprovalDialog(null);
      setApprovalKeterangan("");
      // Refresh list
      handleSearchApprovalSEP();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengajukan approval" });
    } finally {
      setApprovalSubmitting(null);
    }
  };

  // Manual Approval SEP handler
  const handleManualApprovalSEP = async () => {
    if (!manualNoKartu.trim()) {
      toast({ variant: "destructive", title: "No. Kartu wajib diisi" });
      return;
    }
    if (!manualKeterangan.trim()) {
      toast({ variant: "destructive", title: "Keterangan wajib diisi" });
      return;
    }
    setManualApprovalSubmitting(true);
    try {
      await vclaimApi.approvalSEP({
        no_kartu: manualNoKartu,
        tgl_sep: manualTglSep,
        jns_pelayanan: manualJnsPelayanan,
        jns_pengajuan: manualJnsPengajuan,
        keterangan: manualKeterangan,
      });
      toast({ title: "Berhasil", description: "Pengajuan approval SEP berhasil dikirim" });
      // Reset form
      setManualNoKartu("");
      setManualKeterangan("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengajukan approval" });
    } finally {
      setManualApprovalSubmitting(false);
    }
  };

  // Pengajuan SEP handler
  const handlePengajuanSEP = async () => {
    if (!pengajuanNoKartu.trim()) {
      toast({ variant: "destructive", title: "No. Kartu wajib diisi" });
      return;
    }
    if (!pengajuanKeterangan.trim()) {
      toast({ variant: "destructive", title: "Keterangan wajib diisi" });
      return;
    }
    setPengajuanSubmitting(true);
    try {
      await vclaimApi.pengajuanSEP({
        no_kartu: pengajuanNoKartu,
        tgl_sep: pengajuanTglSep,
        jns_pelayanan: pengajuanJnsPelayanan,
        jns_pengajuan: pengajuanJnsPengajuan,
        keterangan: pengajuanKeterangan,
      });
      toast({ title: "Berhasil", description: "Pengajuan SEP berhasil dikirim" });
      // Reset form
      setPengajuanNoKartu("");
      setPengajuanKeterangan("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengajukan SEP" });
    } finally {
      setPengajuanSubmitting(false);
    }
  };

  const handleSaveSEP = async () => {
    if (!sepData) return;
    setSaving(true);
    try {
      const sep = sepData as any;
      await api.post("/bpjs/vclaim/sep/import", {
        no_sep: sep.noSep || "",
        no_kartu: sep.peserta?.noKartu || "",
        nama_pasien: sep.peserta?.nama || "",
        nik: sep.peserta?.nik || "",
        tgl_lahir: sep.peserta?.tglLahir || "",
        jenis_kelamin: sep.peserta?.kelamin || "",
        tgl_sep: sep.tglSep || "",
        jns_pelayanan: sep.jnsPelayanan || "",
        kls_rawat_hak: sep.klsRawat?.klsRawatHak || sep.kelasRawat || "",
        no_mr: sep.peserta?.noMr || "",
        asal_rujukan: "",
        no_rujukan: sep.noRujukan || "",
        tgl_rujukan: "",
        ppk_rujukan: "",
        nama_rujukan: "",
        kode_poli: "",
        nama_poli: sep.poli || "",
        kode_dpjp: sep.dpjp?.kdDPJP || "",
        nama_dpjp: sep.dpjp?.nmDPJP || "",
        ppk_pelayanan: "",
        diag_awal: sep.diagnosa || "",
        nama_diagnosa: sep.diagnosa || "",
        catatan: sep.catatan || "",
        patient_id: 0,
      });
      toast({ title: "Tersimpan", description: `SEP ${sep.noSep} disimpan ke database` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-semibold">BPJS Tools</h1>
        <p className="text-sm text-muted-foreground">Utilitas bridging VClaim BPJS Kesehatan</p>
      </div>

      {/* Tabs */}
      <div className="rounded-lg border p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="inline" className="w-full">
          <TabsList>
            <TabsTrigger value="get-sep">
              <FileText className="mr-2 h-4 w-4" />
              Get SEP
            </TabsTrigger>
            <TabsTrigger value="surat-kontrol">
              <FileCheck className="mr-2 h-4 w-4" />
              Surat Kontrol
            </TabsTrigger>
            <TabsTrigger value="approval-sep">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approval SEP
            </TabsTrigger>
            <TabsTrigger value="pengajuan-sep">
              <FileText className="mr-2 h-4 w-4" />
              Pengajuan SEP
            </TabsTrigger>
          </TabsList>

          {/* ===== GET SEP ===== */}
          <TabsContent value="get-sep" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Cari SEP dari VClaim</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ambil data SEP dari VClaim dan simpan ke database lokal</p>
            </div>

            <form onSubmit={form.handleSubmit(handleGetSEP)} className="flex gap-2 items-start max-w-lg">
              <div className="flex-1">
                <Input
                  placeholder="Masukkan Nomor SEP..."
                  {...form.register("noSEP")}
                />
                {form.formState.errors.noSEP && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.noSEP.message}</p>
                )}
              </div>
              <Button type="submit" variant="outline" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Cari
              </Button>
            </form>

            {/* SEP Result */}
            {sepData && (
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-sm font-medium">Data SEP</span>
                      <span className="text-xs font-mono text-muted-foreground ml-2">{sepData.noSep}</span>
                    </div>
                  </div>
                  <Button onClick={handleSaveSEP} size="sm" variant="outline" disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Simpan ke Database
                  </Button>
                </div>

                {/* Body */}
                <div className="px-4 py-4 space-y-4">
                  {/* Peserta */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Peserta</p>
                    <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3">
                      <Field label="Nama" value={sepData.peserta?.nama} />
                      <Field label="No. Kartu" value={sepData.peserta?.noKartu} mono />
                      <Field label="No. MR" value={sepData.peserta?.noMr} mono />
                      <Field label="Tgl Lahir" value={sepData.peserta?.tglLahir} />
                      <Field label="Kelamin" value={sepData.peserta?.kelamin === "L" ? "Laki-laki" : sepData.peserta?.kelamin === "P" ? "Perempuan" : "-"} />
                      <Field label="Hak Kelas" value={sepData.peserta?.hakKelas || sepData.klsRawat?.klsRawatHak} />
                    </dl>
                  </div>

                  <Separator />

                  {/* SEP Detail */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detail SEP</p>
                    <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3">
                      <Field label="Tgl SEP" value={sepData.tglSep} />
                      <Field label="Jns Pelayanan" value={sepData.jnsPelayanan} />
                      <Field label="Kelas Rawat" value={sepData.kelasRawat} />
                      <Field label="Poli" value={sepData.poli} />
                      <Field label="Tujuan Kunjungan" value={sepData.tujuanKunj?.nama} />
                      <Field label="Kecelakaan" value={sepData.nmstatusKecelakaan} />
                    </dl>
                  </div>

                  <Separator />

                  {/* Diagnosa & DPJP */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnosa & DPJP</p>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                      <Field label="Diagnosa" value={sepData.diagnosa} />
                      <Field label="DPJP" value={sepData.dpjp?.nmDPJP ? `${sepData.dpjp.nmDPJP}${sepData.dpjp.kdDPJP ? ` (${sepData.dpjp.kdDPJP})` : ""}` : "-"} />
                      {sepData.catatan && <Field label="Catatan" value={sepData.catatan} />}
                    </dl>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== SURAT KONTROL ===== */}
          <TabsContent value="surat-kontrol" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Surat Kontrol</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Cari dan kelola surat kontrol peserta dari VClaim</p>
            </div>

            {/* Search */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground mb-1 block">No. Kartu BPJS</label>
                <Input
                  placeholder="Nomor kartu..."
                  value={skNoKartu}
                  onChange={(e) => setSkNoKartu(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSuratKontrol()}
                />
              </div>
              <div className="w-32">
                <label className="text-xs text-muted-foreground mb-1 block">Bulan</label>
                <Select value={skBulan} onValueChange={setSkBulan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((n, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Tahun</label>
                <Select value={skTahun} onValueChange={setSkTahun}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Filter</label>
                <div className="flex items-center border rounded-md h-9">
                  <button
                    type="button"
                    onClick={() => setSkFilter("1")}
                    className={cn(
                      "px-3 h-full text-sm rounded-l-md transition-colors",
                      skFilter === "1" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Terbit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkFilter("2")}
                    className={cn(
                      "px-3 h-full text-sm rounded-r-md transition-colors",
                      skFilter === "2" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Kontrol
                  </button>
                </div>
              </div>
              <Button onClick={handleSearchSuratKontrol} variant="outline" disabled={skLoading}>
                {skLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Cari
              </Button>
            </div>

            {/* Results */}
            {skSearched && (
              <>
                {skData.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                      <span className="text-sm font-medium">Hasil Pencarian</span>
                      <Badge variant="secondary" className="text-xs">{skData.length}</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left font-medium px-4 py-2">No. Surat Kontrol</th>
                            <th className="text-left font-medium px-4 py-2">Peserta</th>
                            <th className="text-left font-medium px-4 py-2">Tgl Kontrol</th>
                            <th className="text-left font-medium px-4 py-2">Terbit</th>
                            <th className="text-left font-medium px-4 py-2">Poli</th>
                            <th className="text-left font-medium px-4 py-2">Dokter</th>
                            <th className="text-center font-medium px-4 py-2">SEP</th>
                            <th className="text-right font-medium px-4 py-2 w-14"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {skData.map((item) => (
                            <tr key={item.noSuratKontrol} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs">{item.noSuratKontrol}</td>
                              <td className="px-4 py-2">{item.nama}</td>
                              <td className="px-4 py-2 tabular-nums">{item.tglRencanaKontrol}</td>
                              <td className="px-4 py-2 tabular-nums">{item.tglTerbitKontrol}</td>
                              <td className="px-4 py-2 truncate max-w-[160px]">{item.namaPoliTujuan}</td>
                              <td className="px-4 py-2 truncate max-w-[160px]">{item.namaDokter}</td>
                              <td className="px-4 py-2 text-center">
                                {item.terbitSEP === "Sudah" ? (
                                  <Check className="h-4 w-4 mx-auto text-emerald-600" />
                                ) : (
                                  <Minus className="h-4 w-4 mx-auto text-muted-foreground/40" />
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSkDeleteConfirm(item)}
                                  disabled={skDeleting === item.noSuratKontrol || item.terbitSEP === "Sudah"}
                                  className={cn(
                                    "inline-flex items-center justify-center h-7 w-7 rounded transition-colors",
                                    item.terbitSEP === "Sudah"
                                      ? "text-muted-foreground/30 cursor-not-allowed"
                                      : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  )}
                                >
                                  {skDeleting === item.noSuratKontrol ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : !skLoading ? (
                  <div className="text-center py-12">
                    <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Tidak ada surat kontrol ditemukan untuk <span className="font-mono">{skNoKartu}</span>
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>

          {/* ========== Approval SEP ========== */}
          <TabsContent value="approval-sep" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Approval SEP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ajukan approval SEP (backdate / fingerprint)</p>
            </div>

            {/* Manual Input Form */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="text-sm font-medium">Input Manual</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">No. Kartu BPJS</label>
                  <Input
                    placeholder="0001234567890"
                    value={manualNoKartu}
                    onChange={(e) => setManualNoKartu(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tgl SEP</label>
                  <Input
                    type="date"
                    value={manualTglSep}
                    onChange={(e) => setManualTglSep(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Jenis Pelayanan</label>
                  <Select value={manualJnsPelayanan} onValueChange={setManualJnsPelayanan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Rawat Jalan</SelectItem>
                      <SelectItem value="1">Rawat Inap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Jenis Pengajuan</label>
                  <Select value={manualJnsPengajuan} onValueChange={setManualJnsPengajuan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Backdate</SelectItem>
                      <SelectItem value="2">Finger Print</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Keterangan</label>
                  <Input
                    placeholder="Alasan pengajuan approval..."
                    value={manualKeterangan}
                    onChange={(e) => setManualKeterangan(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleManualApprovalSEP} disabled={manualApprovalSubmitting}>
                  {manualApprovalSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Ajukan Approval
                </Button>
              </div>
            </div>

            <Separator />

            {/* Search dari List */}
            <div>
              <div className="text-sm font-medium mb-2">Cari dari Daftar</div>
              <p className="text-xs text-muted-foreground mb-3">Cari SEP yang membutuhkan approval dari BPJS</p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="w-32">
                <label className="text-xs text-muted-foreground mb-1 block">Bulan</label>
                <Select value={approvalBulan} onValueChange={setApprovalBulan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((n, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Tahun</label>
                <Select value={approvalTahun} onValueChange={setApprovalTahun}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearchApprovalSEP} variant="outline" disabled={approvalLoading}>
                {approvalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Cari
              </Button>
            </div>

            {/* Results */}
            {approvalSearched && (
              <>
                {approvalData.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                      <span className="text-sm font-medium">SEP Butuh Approval</span>
                      <Badge variant="secondary" className="text-xs">{approvalData.length}</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left font-medium px-4 py-2">No. Kartu</th>
                            <th className="text-left font-medium px-4 py-2">Nama</th>
                            <th className="text-left font-medium px-4 py-2">Tgl SEP</th>
                            <th className="text-center font-medium px-4 py-2">Jns Pelayanan</th>
                            <th className="text-left font-medium px-4 py-2">Status</th>
                            <th className="text-right font-medium px-4 py-2">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvalData.map((item) => (
                            <tr key={`${item.noKartu}-${item.tglsep}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs">{item.noKartu}</td>
                              <td className="px-4 py-2">{item.nama}</td>
                              <td className="px-4 py-2 tabular-nums">{item.tglsep}</td>
                              <td className="px-4 py-2 text-center">
                                <Badge variant={item.jnspelayanan === "RI" ? "default" : "secondary"}>
                                  {item.jnspelayanan === "RI" ? "Rawat Inap" : "Rawat Jalan"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setApprovalDialog(item);
                                    setApprovalKeterangan("");
                                  }}
                                  disabled={approvalSubmitting === item.noKartu}
                                >
                                  {approvalSubmitting === item.noKartu ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                      Approval
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : !approvalLoading ? (
                  <div className="text-center py-12">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Tidak ada SEP yang butuh approval untuk periode ini
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>

          {/* ========== Pengajuan SEP ========== */}
          <TabsContent value="pengajuan-sep" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Pengajuan SEP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ajukan SEP baru (backdate / fingerprint) ke BPJS</p>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">No. Kartu BPJS</label>
                  <Input
                    placeholder="0001234567890"
                    value={pengajuanNoKartu}
                    onChange={(e) => setPengajuanNoKartu(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tgl SEP</label>
                  <Input
                    type="date"
                    value={pengajuanTglSep}
                    onChange={(e) => setPengajuanTglSep(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Jenis Pelayanan</label>
                  <Select value={pengajuanJnsPelayanan} onValueChange={setPengajuanJnsPelayanan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Rawat Jalan</SelectItem>
                      <SelectItem value="1">Rawat Inap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Jenis Pengajuan</label>
                  <Select value={pengajuanJnsPengajuan} onValueChange={setPengajuanJnsPengajuan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Backdate</SelectItem>
                      <SelectItem value="2">Finger Print</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Keterangan</label>
                  <Input
                    placeholder="Alasan pengajuan SEP..."
                    value={pengajuanKeterangan}
                    onChange={(e) => setPengajuanKeterangan(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handlePengajuanSEP} disabled={pengajuanSubmitting}>
                  {pengajuanSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Ajukan SEP
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!skDeleteConfirm} onOpenChange={(open) => !open && setSkDeleteConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Surat Kontrol?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs">
                <p>Surat kontrol ini akan dihapus dari BPJS.</p>
                {skDeleteConfirm && (
                  <dl className="border rounded-md px-3 py-2 space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. SK</dt>
                      <dd className="font-mono">{skDeleteConfirm.noSuratKontrol}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Peserta</dt>
                      <dd>{skDeleteConfirm.nama}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Poli</dt>
                      <dd>{skDeleteConfirm.namaPoliTujuan}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tgl Kontrol</dt>
                      <dd>{skDeleteConfirm.tglRencanaKontrol}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => skDeleteConfirm && handleDeleteSuratKontrol(skDeleteConfirm)}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approval SEP Dialog */}
      <AlertDialog open={!!approvalDialog} onOpenChange={(open) => !open && setApprovalDialog(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Pengajuan Approval SEP
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p>Ajukan approval untuk SEP yang memerlukan verifikasi.</p>
                {approvalDialog && (
                  <dl className="border rounded-md px-3 py-2 space-y-1 bg-muted/30">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. Kartu</dt>
                      <dd className="font-mono">{approvalDialog.noKartu}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nama</dt>
                      <dd>{approvalDialog.nama}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tgl SEP</dt>
                      <dd>{approvalDialog.tglsep}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="text-amber-600">{approvalDialog.status}</dd>
                    </div>
                  </dl>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="keterangan" className="text-xs">Keterangan <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="keterangan"
                    placeholder="Masukkan alasan/keterangan untuk approval..."
                    value={approvalKeterangan}
                    onChange={(e) => setApprovalKeterangan(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!approvalKeterangan.trim() || approvalSubmitting !== null}
              onClick={() => approvalDialog && handleApprovalSEP(approvalDialog, "2")}
            >
              {approvalSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Approval Fingerprint
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              disabled={!approvalKeterangan.trim() || approvalSubmitting !== null}
              onClick={() => approvalDialog && handleApprovalSEP(approvalDialog, "1")}
            >
              {approvalSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Approval Backdate
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
