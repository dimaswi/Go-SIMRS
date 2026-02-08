import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Save,
  FileText,
  FileCheck,
  ClipboardList,
  UserSearch,
  History,
  Settings2,
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

// Sidebar menu items
const menuItems = [
  {
    id: "get-sep",
    label: "Get SEP",
    icon: FileText,
  },
  {
    id: "surat-kontrol",
    label: "Surat Kontrol",
    icon: FileCheck,
  },
  {
    id: "approval-sep",
    label: "Approval SEP",
    icon: ShieldCheck,
  },
  {
    id: "get-peserta",
    label: "Cek Peserta",
    icon: UserSearch,
    disabled: true,
  },
  {
    id: "get-rujukan",
    label: "Cek Rujukan",
    icon: ClipboardList,
    disabled: true,
  },
  {
    id: "history-sep",
    label: "History SEP",
    icon: History,
    disabled: true,
  },
  {
    id: "settings",
    label: "Pengaturan",
    icon: Settings2,
    disabled: true,
  },
];

// Form schema for Get SEP
const getSEPSchema = z.object({
  noSEP: z.string().min(1, "Nomor SEP wajib diisi"),
});

type GetSEPForm = z.infer<typeof getSEPSchema>;

// Helper: render a labeled value
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</dt>
      <dd className={cn("text-xs truncate", mono && "font-mono")}>{value || "-"}</dd>
    </div>
  );
}

export default function BPJSToolsPage() {
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState("get-sep");
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - narrow, compact */}
      <div className="w-48 border-r flex flex-col bg-background">
        <div className="px-3 py-3 border-b">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">BPJS Tools</span>
        </div>
        <nav className="flex-1 py-1 overflow-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => !item.disabled && setActiveMenu(item.id)}
              disabled={item.disabled}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                activeMenu === item.id
                  ? "bg-muted font-medium text-foreground"
                  : item.disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">

          {/* ===== GET SEP ===== */}
          {activeMenu === "get-sep" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Get SEP</h2>
                <p className="text-xs text-muted-foreground">Ambil data SEP dari VClaim dan simpan ke database lokal</p>
              </div>

              <form onSubmit={form.handleSubmit(handleGetSEP)} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    placeholder="Nomor SEP..."
                    className="h-8 text-xs"
                    {...form.register("noSEP")}
                  />
                  {form.formState.errors.noSEP && (
                    <p className="text-[11px] text-destructive mt-0.5">{form.formState.errors.noSEP.message}</p>
                  )}
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={loading} className="h-8 text-xs">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Search className="h-3 w-3 mr-1.5" />}
                  Cari
                </Button>
              </form>

              {/* SEP Result */}
              {sepData && (
                <div className="border rounded-md">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium truncate">SEP</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{sepData.noSep}</span>
                    </div>
                    <Button onClick={handleSaveSEP} size="sm" variant="outline" disabled={saving} className="h-7 text-[11px] shrink-0">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Simpan
                    </Button>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-2.5 space-y-3">
                    {/* Peserta */}
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Peserta</p>
                      <dl className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2">
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
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Detail SEP</p>
                      <dl className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2">
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
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Diagnosa & DPJP</p>
                      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                        <Field label="Diagnosa" value={sepData.diagnosa} />
                        <Field label="DPJP" value={sepData.dpjp?.nmDPJP ? `${sepData.dpjp.nmDPJP}${sepData.dpjp.kdDPJP ? ` (${sepData.dpjp.kdDPJP})` : ""}` : "-"} />
                        {sepData.catatan && <Field label="Catatan" value={sepData.catatan} />}
                      </dl>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== SURAT KONTROL ===== */}
          {activeMenu === "surat-kontrol" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Surat Kontrol</h2>
                <p className="text-xs text-muted-foreground">Cari dan kelola surat kontrol peserta dari VClaim</p>
              </div>

              {/* Search */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] text-muted-foreground">No. Kartu BPJS</label>
                  <Input
                    placeholder="Nomor kartu..."
                    className="h-8 text-xs"
                    value={skNoKartu}
                    onChange={(e) => setSkNoKartu(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchSuratKontrol()}
                  />
                </div>
                <div className="w-28">
                  <label className="text-[11px] text-muted-foreground">Bulan</label>
                  <Select value={skBulan} onValueChange={setSkBulan}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"].map((n, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-muted-foreground">Tahun</label>
                  <Select value={skTahun} onValueChange={setSkTahun}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1 border rounded-md h-8">
                  <button
                    type="button"
                    onClick={() => setSkFilter("1")}
                    className={cn(
                      "px-2 h-full text-[11px] rounded-l-md transition-colors",
                      skFilter === "1" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Terbit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkFilter("2")}
                    className={cn(
                      "px-2 h-full text-[11px] rounded-r-md transition-colors",
                      skFilter === "2" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Kontrol
                  </button>
                </div>
                <Button onClick={handleSearchSuratKontrol} size="sm" variant="outline" disabled={skLoading} className="h-8 text-xs">
                  {skLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Search className="h-3 w-3 mr-1.5" />}
                  Cari
                </Button>
              </div>

              {/* Results */}
              {skSearched && (
                <>
                  {skData.length > 0 ? (
                    <div className="border rounded-md">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
                        <span className="text-xs font-medium">Hasil</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{skData.length}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-[11px] text-muted-foreground">
                              <th className="text-left font-medium px-3 py-1.5">No. Surat Kontrol</th>
                              <th className="text-left font-medium px-3 py-1.5">Peserta</th>
                              <th className="text-left font-medium px-3 py-1.5">Tgl Kontrol</th>
                              <th className="text-left font-medium px-3 py-1.5">Terbit</th>
                              <th className="text-left font-medium px-3 py-1.5">Poli</th>
                              <th className="text-left font-medium px-3 py-1.5">Dokter</th>
                              <th className="text-center font-medium px-3 py-1.5">SEP</th>
                              <th className="text-right font-medium px-3 py-1.5 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {skData.map((item) => (
                              <tr key={item.noSuratKontrol} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-1.5 font-mono text-[11px]">{item.noSuratKontrol}</td>
                                <td className="px-3 py-1.5">{item.nama}</td>
                                <td className="px-3 py-1.5 tabular-nums">{item.tglRencanaKontrol}</td>
                                <td className="px-3 py-1.5 tabular-nums">{item.tglTerbitKontrol}</td>
                                <td className="px-3 py-1.5 truncate max-w-[140px]">{item.namaPoliTujuan}</td>
                                <td className="px-3 py-1.5 truncate max-w-[140px]">{item.namaDokter}</td>
                                <td className="px-3 py-1.5 text-center">
                                  {item.terbitSEP === "Sudah" ? (
                                    <Check className="h-3 w-3 mx-auto text-foreground" />
                                  ) : (
                                    <Minus className="h-3 w-3 mx-auto text-muted-foreground/50" />
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSkDeleteConfirm(item)}
                                    disabled={skDeleting === item.noSuratKontrol || item.terbitSEP === "Sudah"}
                                    className={cn(
                                      "inline-flex items-center justify-center h-6 w-6 rounded transition-colors",
                                      item.terbitSEP === "Sudah"
                                        ? "text-muted-foreground/30 cursor-not-allowed"
                                        : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    )}
                                  >
                                    {skDeleting === item.noSuratKontrol ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
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
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      Tidak ada surat kontrol ditemukan untuk <span className="font-mono">{skNoKartu}</span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* ========== Approval SEP ========== */}
          {activeMenu === "approval-sep" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-24">
                  <label className="text-[11px] text-muted-foreground">Bulan</label>
                  <Select value={approvalBulan} onValueChange={setApprovalBulan}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"].map((n, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-muted-foreground">Tahun</label>
                  <Select value={approvalTahun} onValueChange={setApprovalTahun}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSearchApprovalSEP} size="sm" variant="outline" disabled={approvalLoading} className="h-8 text-xs mt-4">
                  {approvalLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Search className="h-3 w-3 mr-1.5" />}
                  Cari
                </Button>
              </div>

              {/* Results */}
              {approvalSearched && (
                <>
                  {approvalData.length > 0 ? (
                    <div className="border rounded-md">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
                        <span className="text-xs font-medium">SEP Butuh Approval</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{approvalData.length}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-[11px] text-muted-foreground">
                              <th className="text-left font-medium px-3 py-1.5">No. Kartu</th>
                              <th className="text-left font-medium px-3 py-1.5">Nama</th>
                              <th className="text-left font-medium px-3 py-1.5">Tgl SEP</th>
                              <th className="text-center font-medium px-3 py-1.5">Jns Pelayanan</th>
                              <th className="text-left font-medium px-3 py-1.5">Status</th>
                              <th className="text-right font-medium px-3 py-1.5">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvalData.map((item) => (
                              <tr key={`${item.noKartu}-${item.tglsep}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-1.5 font-mono text-[11px]">{item.noKartu}</td>
                                <td className="px-3 py-1.5">{item.nama}</td>
                                <td className="px-3 py-1.5 tabular-nums">{item.tglsep}</td>
                                <td className="px-3 py-1.5 text-center">
                                  <Badge variant={item.jnspelayanan === "RI" ? "default" : "secondary"} className="text-[10px]">
                                    {item.jnspelayanan === "RI" ? "Rawat Inap" : "Rawat Jalan"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className="text-amber-600">{item.status}</span>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[11px] px-2"
                                    onClick={() => {
                                      setApprovalDialog(item);
                                      setApprovalKeterangan("");
                                    }}
                                    disabled={approvalSubmitting === item.noKartu}
                                  >
                                    {approvalSubmitting === item.noKartu ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-3 w-3 mr-1" />
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
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      Tidak ada SEP yang butuh approval untuk periode {approvalBulan}/{approvalTahun}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
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
