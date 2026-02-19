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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ListOrdered,
  X,
  Eye,
  ClipboardList,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { vclaimApi, type VClaimListRencanaKontrolItem, type VClaimPersetujuanSEPItem } from "@/lib/api/vclaim";
import { bpjsApi, type BPJSPendaftaranAntreanItem, type BPJSListTaskItem } from "@/lib/api/bpjs";
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

  // Antrian Online state
  const [antreanTanggal, setAntreanTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [antreanLoading, setAntreanLoading] = useState(false);
  const [antreanData, setAntreanData] = useState<BPJSPendaftaranAntreanItem[]>([]);
  const [antreanSearched, setAntreanSearched] = useState(false);
  const [antreanCancelling, setAntreanCancelling] = useState<string | null>(null);
  const [antreanCancelConfirm, setAntreanCancelConfirm] = useState<BPJSPendaftaranAntreanItem | null>(null);
  const [antreanCancelKeterangan, setAntreanCancelKeterangan] = useState("");
  const [antreanExpandedItem, setAntreanExpandedItem] = useState<string | null>(null);
  const [antreanDetailTab, setAntreanDetailTab] = useState<"tasks" | "detail">("tasks");
  const [antreanTasks, setAntreanTasks] = useState<Record<string, BPJSListTaskItem[]>>({});
  const [antreanTasksLoading, setAntreanTasksLoading] = useState<string | null>(null);
  const [antreanBookingDetail, setAntreanBookingDetail] = useState<Record<string, BPJSPendaftaranAntreanItem[]>>({});
  const [antreanDetailLoading, setAntreanDetailLoading] = useState<string | null>(null);

  // I-Care state
  const [icareNoKartu, setIcareNoKartu] = useState("");
  const [icareKodeDokter, setIcareKodeDokter] = useState("");
  const [icareLoading, setIcareLoading] = useState(false);
  const [icareUrl, setIcareUrl] = useState<string | null>(null);
  const [icareOpen, setIcareOpen] = useState(false);

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

  // Antrian Online handlers
  const handleSearchAntrean = async () => {
    if (!antreanTanggal) {
      toast({ variant: "destructive", title: "Tanggal wajib diisi" });
      return;
    }
    setAntreanLoading(true);
    setAntreanData([]);
    setAntreanSearched(true);
    try {
      const res = await bpjsApi.getPendaftaranAntrean(antreanTanggal);
      setAntreanData(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil data antrean" });
    } finally {
      setAntreanLoading(false);
    }
  };

  const handleBatalAntrean = async (item: BPJSPendaftaranAntreanItem) => {
    if (!antreanCancelKeterangan.trim()) {
      toast({ variant: "destructive", title: "Keterangan wajib diisi" });
      return;
    }
    setAntreanCancelling(item.kodebooking);
    try {
      await bpjsApi.batalAntrean(item.kodebooking, antreanCancelKeterangan);
      toast({ title: "Berhasil", description: `Antrean ${item.kodebooking} berhasil dibatalkan` });
      setAntreanData(prev => prev.filter(a => a.kodebooking !== item.kodebooking));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal membatalkan antrean" });
    } finally {
      setAntreanCancelling(null);
      setAntreanCancelConfirm(null);
      setAntreanCancelKeterangan("");
    }
  };

  const handleToggleAntreanDetail = async (kodebooking: string, tab: "tasks" | "detail") => {
    if (antreanExpandedItem === kodebooking && antreanDetailTab === tab) {
      setAntreanExpandedItem(null);
      return;
    }
    setAntreanExpandedItem(kodebooking);
    setAntreanDetailTab(tab);

    if (tab === "tasks" && !antreanTasks[kodebooking]) {
      setAntreanTasksLoading(kodebooking);
      try {
        const res = await bpjsApi.getListTask(kodebooking);
        setAntreanTasks(prev => ({ ...prev, [kodebooking]: res.data.data || [] }));
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil list task" });
      } finally {
        setAntreanTasksLoading(null);
      }
    }

    if (tab === "detail" && !antreanBookingDetail[kodebooking]) {
      setAntreanDetailLoading(kodebooking);
      try {
        const res = await bpjsApi.getPendaftaranByKodeBooking(kodebooking);
        setAntreanBookingDetail(prev => ({ ...prev, [kodebooking]: res.data.data || [] }));
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengambil detail pendaftaran" });
      } finally {
        setAntreanDetailLoading(null);
      }
    }
  };

  // I-Care handler
  const handleICareValidate = async () => {
    if (!icareNoKartu.trim()) {
      toast({ variant: "destructive", title: "Gagal", description: "No. Kartu BPJS wajib diisi" });
      return;
    }
    if (!icareKodeDokter.trim()) {
      toast({ variant: "destructive", title: "Gagal", description: "Kode Dokter wajib diisi" });
      return;
    }
    const kodeDokter = parseInt(icareKodeDokter, 10);
    if (isNaN(kodeDokter)) {
      toast({ variant: "destructive", title: "Gagal", description: "Kode Dokter harus berupa angka" });
      return;
    }
    setIcareLoading(true);
    try {
      const res = await bpjsApi.icareValidateManual(icareNoKartu.trim(), kodeDokter);
      const url = res.data.url;
      if (url) {
        setIcareUrl(url);
        setIcareOpen(true);
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "URL I-Care tidak ditemukan dalam response BPJS" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal memanggil I-Care" });
    } finally {
      setIcareLoading(false);
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
    <div className="flex flex-1 flex-col p-4">
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
            <TabsTrigger value="pengajuan-approval">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Pengajuan & Approval SEP
            </TabsTrigger>
            <TabsTrigger value="icare">
              <ExternalLink className="mr-2 h-4 w-4" />
              I-Care
            </TabsTrigger>
            <TabsTrigger value="antrian-online">
              <ListOrdered className="mr-2 h-4 w-4" />
              Antrian Online
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

          {/* ========== Pengajuan & Approval SEP (Combined) ========== */}
          <TabsContent value="pengajuan-approval" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Pengajuan & Approval SEP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ajukan SEP baru atau approval SEP (backdate / fingerprint) ke BPJS</p>
            </div>

            {/* === Pengajuan SEP Form === */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="text-sm font-medium">Pengajuan SEP</div>
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

            {/* === Approval SEP Form === */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="text-sm font-medium">Approval SEP (Input Manual)</div>
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

            {/* === List Approval dari BPJS === */}
            <div>
              <div className="text-sm font-medium mb-2">Daftar SEP Butuh Approval</div>
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

          {/* ========== I-CARE ========== */}
          <TabsContent value="icare" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">BPJS I-Care</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Akses BPJS I-Care dengan memasukkan nomor kartu BPJS dan kode dokter</p>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">No. Kartu BPJS</label>
                  <Input
                    placeholder="0001234567890"
                    value={icareNoKartu}
                    onChange={(e) => setIcareNoKartu(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleICareValidate()}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Kode Dokter BPJS</label>
                  <Input
                    placeholder="12345"
                    value={icareKodeDokter}
                    onChange={(e) => setIcareKodeDokter(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleICareValidate()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleICareValidate} disabled={icareLoading} className="w-full md:w-auto">
                    {icareLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                    Buka I-Care
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ===== ANTRIAN ONLINE ===== */}
          <TabsContent value="antrian-online" className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold">Pendaftaran Antrean Online</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Lihat daftar antrean yang terdaftar di BPJS Antrian Online per tanggal</p>
            </div>

            <div className="flex gap-2 items-end max-w-lg">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Tanggal</label>
                <Input
                  type="date"
                  value={antreanTanggal}
                  onChange={(e) => setAntreanTanggal(e.target.value)}
                />
              </div>
              <Button onClick={handleSearchAntrean} variant="outline" disabled={antreanLoading}>
                {antreanLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Cari
              </Button>
            </div>

            {/* Results */}
            {antreanSearched && !antreanLoading && antreanData.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Tidak ada data antrean untuk tanggal ini</p>
            )}

            {antreanData.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{antreanData.length} antrean ditemukan</p>
                <div className="border rounded-lg divide-y">
                  {antreanData.map((item) => (
                    <div key={item.kodebooking}>
                      <div className="px-4 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-medium">{item.kodebooking}</span>
                            <Badge variant="outline" className={cn("text-[10px]",
                              item.status === "Belum" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              item.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                              item.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {item.status}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.sumberdata}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Poli: <strong className="text-foreground">{item.kodepoli}</strong></span>
                            <span>Dokter: <strong className="text-foreground">{item.kodedokter}</strong></span>
                            <span>Jam: {item.jampraktek}</span>
                            <span>No. Antrean: <strong className="text-foreground">{item.noantrean}</strong></span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>NIK: {item.nik}</span>
                            <span>No. BPJS: {item.nokapst}</span>
                            <span>No. RM: {item.norekammedis}</span>
                            <span>No. HP: {item.nohp}</span>
                          </div>
                          {item.nomorreferensi && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Referensi: <span className="font-mono">{item.nomorreferensi}</span>
                              <span className="ml-2">
                                (Jenis: {item.jeniskunjungan === 1 ? "Rujukan FKTP" : item.jeniskunjungan === 2 ? "Rujukan Internal" : item.jeniskunjungan === 3 ? "Kontrol" : item.jeniskunjungan === 4 ? "Rujukan Antar RS" : item.jeniskunjungan})
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleAntreanDetail(item.kodebooking, "tasks")}
                            title="List Task"
                          >
                            {antreanTasksLoading === item.kodebooking ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ClipboardList className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleAntreanDetail(item.kodebooking, "detail")}
                            title="Detail Pendaftaran"
                          >
                            {antreanDetailLoading === item.kodebooking ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={antreanCancelling === item.kodebooking}
                            onClick={() => setAntreanCancelConfirm(item)}
                            title="Batalkan Antrean"
                          >
                            {antreanCancelling === item.kodebooking ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      {antreanExpandedItem === item.kodebooking && (
                        <div className="border-t bg-muted/20 px-4 py-3">
                          {/* Tab switcher */}
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => handleToggleAntreanDetail(item.kodebooking, "tasks")}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md transition-colors",
                                antreanDetailTab === "tasks" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                              )}
                            >
                              <ClipboardList className="h-3 w-3 inline mr-1" />
                              List Task
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAntreanDetail(item.kodebooking, "detail")}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md transition-colors",
                                antreanDetailTab === "detail" ? "bg-background border font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"
                              )}
                            >
                              <Eye className="h-3 w-3 inline mr-1" />
                              Detail Pendaftaran
                            </button>
                            <div className="flex-1" />
                            <button
                              type="button"
                              onClick={() => setAntreanExpandedItem(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Tasks view */}
                          {antreanDetailTab === "tasks" && (
                            <>
                              {antreanTasksLoading === item.kodebooking ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Memuat list task...</span>
                                </div>
                              ) : antreanTasks[item.kodebooking]?.length ? (
                                <div className="border rounded-md overflow-hidden bg-background">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b bg-muted/40 text-muted-foreground">
                                        <th className="text-left font-medium px-3 py-1.5 w-16">Task ID</th>
                                        <th className="text-left font-medium px-3 py-1.5">Task Name</th>
                                        <th className="text-left font-medium px-3 py-1.5">Waktu</th>
                                        <th className="text-left font-medium px-3 py-1.5">Waktu RS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {antreanTasks[item.kodebooking].map((task) => (
                                        <tr key={task.taskid} className="border-b last:border-0">
                                          <td className="px-3 py-1.5 font-mono font-medium">{task.taskid}</td>
                                          <td className="px-3 py-1.5">{task.taskname}</td>
                                          <td className="px-3 py-1.5 tabular-nums">
                                            {task.waktu || "-"}
                                          </td>
                                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{task.wakturs || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data task</p>
                              )}
                            </>
                          )}

                          {/* Detail view */}
                          {antreanDetailTab === "detail" && (
                            <>
                              {antreanDetailLoading === item.kodebooking ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Memuat detail pendaftaran...</span>
                                </div>
                              ) : antreanBookingDetail[item.kodebooking]?.length ? (
                                <div className="space-y-3">
                                  {antreanBookingDetail[item.kodebooking].map((d, idx) => (
                                    <div key={idx} className="border rounded-md bg-background px-4 py-3">
                                      <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                        <div>
                                          <dt className="text-muted-foreground">Kode Booking</dt>
                                          <dd className="font-mono font-medium">{d.kodebooking}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Tanggal</dt>
                                          <dd>{d.tanggal}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Kode Poli</dt>
                                          <dd className="font-medium">{d.kodepoli}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Kode Dokter</dt>
                                          <dd>{d.kodedokter}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Jam Praktek</dt>
                                          <dd>{d.jampraktek}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">NIK</dt>
                                          <dd className="font-mono">{d.nik}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Kartu BPJS</dt>
                                          <dd className="font-mono">{d.nokapst}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. HP</dt>
                                          <dd>{d.nohp}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Rekam Medis</dt>
                                          <dd className="font-mono">{d.norekammedis}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Antrean</dt>
                                          <dd className="font-medium">{d.noantrean}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Jenis Kunjungan</dt>
                                          <dd>{d.jeniskunjungan === 1 ? "Rujukan FKTP" : d.jeniskunjungan === 2 ? "Rujukan Internal" : d.jeniskunjungan === 3 ? "Kontrol" : d.jeniskunjungan === 4 ? "Rujukan Antar RS" : d.jeniskunjungan}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">No. Referensi</dt>
                                          <dd className="font-mono">{d.nomorreferensi || "-"}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Sumber Data</dt>
                                          <dd>{d.sumberdata}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Status</dt>
                                          <dd>
                                            <Badge variant="outline" className={cn("text-[10px]",
                                              d.status === "Belum" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                              d.status === "Hadir" ? "bg-green-50 text-green-700 border-green-200" :
                                              d.status === "Selesai dilayani" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                              "bg-muted text-muted-foreground"
                                            )}>
                                              {d.status}
                                            </Badge>
                                          </dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Estimasi Dilayani</dt>
                                          <dd>{d.estimasidilayani ? new Date(d.estimasidilayani).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"}</dd>
                                        </div>
                                        <div>
                                          <dt className="text-muted-foreground">Created</dt>
                                          <dd>{d.createdtime ? new Date(d.createdtime).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"}</dd>
                                        </div>
                                      </dl>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data detail pendaftaran</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Batal Antrean Confirmation */}
      <AlertDialog open={!!antreanCancelConfirm} onOpenChange={(open) => { if (!open) { setAntreanCancelConfirm(null); setAntreanCancelKeterangan(""); } }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Antrean?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p>Antrean ini akan dibatalkan di BPJS Antrian Online.</p>
                {antreanCancelConfirm && (
                  <dl className="border rounded-md px-3 py-2 space-y-1 bg-muted/30 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kode Booking</dt>
                      <dd>{antreanCancelConfirm.kodebooking}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Poli</dt>
                      <dd>{antreanCancelConfirm.kodepoli}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. Antrean</dt>
                      <dd>{antreanCancelConfirm.noantrean}</dd>
                    </div>
                  </dl>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="batal-keterangan" className="text-xs">Keterangan <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="batal-keterangan"
                    placeholder="Alasan pembatalan antrean..."
                    value={antreanCancelKeterangan}
                    onChange={(e) => setAntreanCancelKeterangan(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              disabled={!antreanCancelKeterangan.trim() || antreanCancelling !== null}
              onClick={() => antreanCancelConfirm && handleBatalAntrean(antreanCancelConfirm)}
            >
              {antreanCancelling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
              Batalkan Antrean
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

      {/* I-Care Iframe Dialog */}
      <Dialog open={icareOpen} onOpenChange={(open) => { setIcareOpen(open); if (!open) setIcareUrl(null); }}>
        <DialogContent className="max-w-[90vw] h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              BPJS I-Care
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4">
            {icareUrl && (
              <iframe
                src={icareUrl}
                className="w-full h-full rounded-lg border"
                title="BPJS I-Care"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
