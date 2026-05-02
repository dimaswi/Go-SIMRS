import { useState, useCallback, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  PackageSearch,
  Building2,
  Stethoscope,
  Pill,
  Hospital,
  Activity,
  Syringe,
  Filter,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toHumanLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toHumanValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return String(value);
}

function extractPrimitiveEntries(obj: Record<string, unknown>) {
  return Object.entries(obj).filter(([, value]) => {
    const t = typeof value;
    return value == null || t === "string" || t === "number" || t === "boolean";
  });
}

function pickItemTitle(item: Record<string, unknown>, index: number): string {
  const preferredKeys = [
    "nama",
    "nmobat",
    "namaobat",
    "nmpoli",
    "nmppk",
    "namafaskes",
    "namaspesialis",
    "namaspesialistik",
    "kodeobat",
    "kdpoli",
    "kode",
    "noSep",
    "nosep",
    "nokunjungan",
  ];

  for (const key of preferredKeys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return `Data ${index + 1}`;
}

function EmptyResult({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/10 px-5 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function ResultCards({ entries }: { entries: Array<[string, unknown]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-2xl border bg-background px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {toHumanLabel(key)}
          </p>
          <p className="mt-2 break-words text-sm font-medium text-foreground">
            {toHumanValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ResultTable({ rows }: { rows: unknown[] }) {
  if (!rows.length) {
    return <EmptyResult title="Data kosong" message="Tidak ada baris yang dapat ditampilkan." />;
  }

  const normalizedRows = rows.map((row) => {
    if (isPlainObject(row)) {
      return row;
    }
    return { hasil: row };
  });

  const columns = Array.from(
    new Set(
      normalizedRows.flatMap((row) => extractPrimitiveEntries(row).map(([key]) => key)),
    ),
  );

  const visibleColumns = columns.length ? columns : ["hasil"];

  return (
    <div className="rounded-2xl border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
              {visibleColumns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 font-medium">
                  {toHumanLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row, index) => (
              <tr key={`${pickItemTitle(row, index)}-${index}`} className="border-t align-top">
                {visibleColumns.map((column) => (
                  <td key={column} className="px-4 py-3 text-sm text-foreground">
                    {toHumanValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FriendlyResult({ data }: { data: unknown }) {
  if (!data) {
    return <EmptyResult title="Belum ada hasil" message="Isi parameter lalu jalankan tool untuk melihat hasilnya." />;
  }

  if (Array.isArray(data)) {
    return <ResultTable rows={data} />;
  }

  if (!isPlainObject(data)) {
    return <ResultCards entries={[["hasil", data]]} />;
  }

  const summaryEntries = extractPrimitiveEntries(data);
  const directArrayEntries = Object.entries(data)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({
      key,
      label: toHumanLabel(key),
      rows: value as unknown[],
    }));
  const nestedArrayEntries = Object.entries(data)
    .filter(([, value]) => isPlainObject(value))
    .flatMap(([parentKey, value]) =>
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => Array.isArray(nestedValue))
        .map(([key, nestedValue]) => ({
          key: `${parentKey}.${key}`,
          label: `${toHumanLabel(parentKey)} - ${toHumanLabel(key)}`,
          rows: nestedValue as unknown[],
        })),
    );
  const arraySections = [...directArrayEntries, ...nestedArrayEntries];

  if (!summaryEntries.length && !arraySections.length) {
    return <EmptyResult title="Hasil tidak terbaca" message="Data diterima, tetapi tidak ada deskripsi atau daftar yang bisa ditampilkan." />;
  }

  return (
    <div className="space-y-4">
      {summaryEntries.length > 0 && <ResultCards entries={summaryEntries} />}
      {arraySections.map((section) => (
        <div key={section.key} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {section.label}
          </p>
          <ResultTable rows={section.rows} />
        </div>
      ))}
    </div>
  );
}

function ToolWorkspace({
  eyebrow,
  title,
  description,
  formTitle,
  formDescription,
  form,
  resultTitle,
  resultDescription,
  result,
  resultMeta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  formTitle: string;
  formDescription: string;
  form: ReactNode;
  resultTitle: string;
  resultDescription: string;
  result: ReactNode;
  resultMeta?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2 pb-4 border-b">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{formTitle}</h3>
            <p className="text-xs text-muted-foreground">{formDescription}</p>
          </div>
          <div className="space-y-4">{form}</div>
        </div>

        <div className="space-y-4 min-h-[420px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{resultTitle}</h3>
              <p className="text-xs text-muted-foreground">{resultDescription}</p>
            </div>
            {resultMeta}
          </div>
          <div>{result}</div>
        </div>
      </div>
    </section>
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

  // Apotek Online referensi state
  const [apotekLoading, setApotekLoading] = useState<string | null>(null);
  const [apotekKodeApotek, setApotekKodeApotek] = useState("");
  const [apotekJenisFaskes, setApotekJenisFaskes] = useState("2");
  const [apotekNamaFaskes, setApotekNamaFaskes] = useState("");
  const [apotekKodeJenisObat, setApotekKodeJenisObat] = useState("");
  const [apotekTglResep, setApotekTglResep] = useState(() => new Date().toISOString().slice(0, 10));
  const [apotekFilterObat, setApotekFilterObat] = useState("");
  const [apotekCariPoli, setApotekCariPoli] = useState("");
  const [apotekNoSEP, setApotekNoSEP] = useState("");

  const [apotekDPHOResult, setApotekDPHOResult] = useState<any>(null);
  const [apotekSettingResult, setApotekSettingResult] = useState<any>(null);
  const [apotekPPKResult, setApotekPPKResult] = useState<any>(null);
  const [apotekObatResult, setApotekObatResult] = useState<any>(null);
  const [apotekPoliResult, setApotekPoliResult] = useState<any>(null);
  const [apotekSEPResult, setApotekSEPResult] = useState<any>(null);
  const [apotekSpesialistikResult, setApotekSpesialistikResult] = useState<any>(null);

  const [apotekKlaimBulan, setApotekKlaimBulan] = useState(() => String(new Date().getMonth() + 1));
  const [apotekKlaimTahun, setApotekKlaimTahun] = useState(() => String(new Date().getFullYear()));
  const [apotekKlaimJenisObat, setApotekKlaimJenisObat] = useState("0");
  const [apotekKlaimStatus, setApotekKlaimStatus] = useState("1");
  const [apotekKlaimResult, setApotekKlaimResult] = useState<any>(null);

  const [apotekPrbTahun, setApotekPrbTahun] = useState(() => String(new Date().getFullYear()));
  const [apotekPrbBulan, setApotekPrbBulan] = useState(() => String(new Date().getMonth() + 1));
  const [apotekPrbResult, setApotekPrbResult] = useState<any>(null);

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

  const runApotekQuery = async (key: string, fn: () => Promise<any>) => {
    setApotekLoading(key);
    try {
      const res = await fn();
      return res.data?.data;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal memanggil referensi apotek",
      });
      return null;
    } finally {
      setApotekLoading(null);
    }
  };

  const handleApotekReferensiDPHO = async () => {
    const data = await runApotekQuery("apotek-dpho", () => bpjsApi.apotekGetReferensiDPHO());
    if (data !== null) setApotekDPHOResult(data);
  };

  const handleApotekReferensiSetting = async () => {
    if (!apotekKodeApotek.trim()) {
      toast({ variant: "destructive", title: "Kode apotek wajib diisi" });
      return;
    }
    const data = await runApotekQuery("apotek-setting", () => bpjsApi.apotekGetSettingApotek(apotekKodeApotek.trim()));
    if (data !== null) setApotekSettingResult(data);
  };

  const handleApotekReferensiPPK = async () => {
    if (!apotekNamaFaskes.trim()) {
      toast({ variant: "destructive", title: "Nama faskes wajib diisi" });
      return;
    }
    const data = await runApotekQuery("apotek-ppk", () => bpjsApi.apotekGetFasilitasKesehatan(apotekJenisFaskes, apotekNamaFaskes.trim()));
    if (data !== null) setApotekPPKResult(data);
  };

  const handleApotekReferensiObat = async () => {
    const data = await runApotekQuery("apotek-obat", () => bpjsApi.apotekGetReferensiObat(apotekKodeJenisObat, apotekTglResep, apotekFilterObat.trim()));
    if (data !== null) setApotekObatResult(data);
  };

  const handleApotekReferensiPoli = async () => {
    if (!apotekCariPoli.trim()) {
      toast({ variant: "destructive", title: "Pencarian poli wajib diisi" });
      return;
    }
    const data = await runApotekQuery("apotek-poli", () => bpjsApi.apotekGetReferensiPoli(apotekCariPoli.trim()));
    if (data !== null) setApotekPoliResult(data);
  };

  const handleApotekCariSEP = async () => {
    if (!apotekNoSEP.trim()) {
      toast({ variant: "destructive", title: "No kunjungan / SEP wajib diisi" });
      return;
    }
    const data = await runApotekQuery("apotek-sep", () => bpjsApi.apotekCariKunjunganBySEP(apotekNoSEP.trim()));
    if (data !== null) setApotekSEPResult(data);
  };

  const handleApotekSpesialistik = async () => {
    const data = await runApotekQuery("apotek-spesialistik", () => bpjsApi.apotekGetSpesialistik());
    if (data !== null) setApotekSpesialistikResult(data);
  };

  const handleApotekKlaim = async () => {
    const data = await runApotekQuery("apotek-klaim", () => bpjsApi.apotekGetDataKlaim(apotekKlaimBulan, apotekKlaimTahun, apotekKlaimJenisObat, apotekKlaimStatus));
    if (data !== null) setApotekKlaimResult(data);
  };

  const handleApotekRekapPrb = async () => {
    const data = await runApotekQuery("apotek-rekap-prb", () => bpjsApi.apotekGetRekapPesertaPRB(apotekPrbTahun, apotekPrbBulan));
    if (data !== null) setApotekPrbResult(data);
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

  const moduleMenus = [
    {
      key: "vclaim",
      label: "VClaim",
      icon: FileCheck,
      items: [
        { key: "get-sep", label: "Get SEP", icon: FileText },
        { key: "surat-kontrol", label: "Surat Kontrol", icon: ClipboardList },
        { key: "pengajuan-approval", label: "Pengajuan & Approval", icon: ShieldCheck },
      ],
    },
    {
      key: "antrol",
      label: "Antrol",
      icon: ListOrdered,
      items: [{ key: "antrian-online", label: "Antrian Online", icon: Activity }],
    },
    {
      key: "icare",
      label: "I-Care",
      icon: ExternalLink,
      items: [{ key: "icare", label: "Validasi I-Care", icon: Stethoscope }],
    },
    {
      key: "apotek-online",
      label: "Apotek Online",
      icon: PackageSearch,
      items: [
        { key: "apotek-dpho", label: "Referensi DPHO", icon: Pill },
        { key: "apotek-setting", label: "Referensi Apotek", icon: Building2 },
        { key: "apotek-ppk", label: "Referensi PPK", icon: Hospital },
        { key: "apotek-obat", label: "Referensi Obat", icon: Syringe },
        { key: "apotek-poli", label: "Referensi Poli", icon: Filter },
        { key: "apotek-sep", label: "No Kunjungan / SEP", icon: Search },
        { key: "apotek-spesialistik", label: "Referensi Spesialis", icon: Stethoscope },
        { key: "apotek-klaim", label: "Data Klaim", icon: FileText },
        { key: "apotek-rekap-prb", label: "Rekap Peserta PRB", icon: ClipboardList },
      ],
    },
  ] as const;

  const activeModule =
    moduleMenus.find((module) => module.items.some((item) => item.key === activeTab)) ?? moduleMenus[0];

  return (
    <div className="flex flex-1 flex-col px-4 pb-6">
      <div className="border-b">
        <div className="flex flex-wrap gap-6">
          {moduleMenus.map((module) => (
            <button
              key={module.key}
              type="button"
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm transition-colors",
                activeModule.key === module.key
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(module.items[0].key)}
            >
              <module.icon className="h-4 w-4" />
              {module.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:top-20 self-start">
          <div className="space-y-1">
            {activeModule.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors",
                  activeTab === item.key
                    ? "border-primary bg-muted/30 font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
        {activeTab === "get-sep" && (
          <ToolWorkspace
            eyebrow="VClaim"
            title="Get SEP"
            description="Ambil detail SEP dari BPJS lalu simpan ke database bila diperlukan."
            formTitle="Parameter pencarian"
            formDescription="Masukkan nomor SEP yang ingin dicek di layanan VClaim."
            form={
              <form onSubmit={form.handleSubmit(handleGetSEP)} className="space-y-3">
                <div>
                  <Label htmlFor="sep-search">Nomor SEP</Label>
                  <Input id="sep-search" placeholder="Masukkan nomor SEP" {...form.register("noSEP")} />
                  {form.formState.errors.noSEP && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.noSEP.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari SEP
                </Button>
              </form>
            }
            resultTitle="Hasil data SEP"
            resultDescription="Data peserta dan detail SEP akan tampil dalam bentuk kartu informasi."
            resultMeta={
              sepData ? (
                <Button onClick={handleSaveSEP} size="sm" variant="outline" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan ke Database
                </Button>
              ) : null
            }
            result={
              sepData ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Peserta</p>
                    <ResultCards
                      entries={[
                        ["Nama Peserta", sepData.peserta?.nama],
                        ["Nomor Kartu", sepData.peserta?.noKartu],
                        ["Nomor Rekam Medis", sepData.peserta?.noMr],
                        ["Tanggal Lahir", sepData.peserta?.tglLahir],
                        ["Jenis Kelamin", sepData.peserta?.kelamin === "L" ? "Laki-laki" : sepData.peserta?.kelamin === "P" ? "Perempuan" : "-"],
                        ["Hak Kelas", sepData.peserta?.hakKelas || sepData.klsRawat?.klsRawatHak],
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Detail SEP</p>
                    <ResultCards
                      entries={[
                        ["Nomor SEP", sepData.noSep],
                        ["Tanggal SEP", sepData.tglSep],
                        ["Jenis Pelayanan", sepData.jnsPelayanan],
                        ["Kelas Rawat", sepData.kelasRawat],
                        ["Poli", sepData.poli],
                        ["Tujuan Kunjungan", sepData.tujuanKunj?.nama],
                        ["Status Kecelakaan", sepData.nmstatusKecelakaan],
                        ["Nomor Rujukan", sepData.noRujukan],
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Diagnosa dan DPJP</p>
                    <ResultCards
                      entries={[
                        ["Diagnosa", sepData.diagnosa],
                        ["DPJP", sepData.dpjp?.nmDPJP ? `${sepData.dpjp.nmDPJP}${sepData.dpjp.kdDPJP ? ` (${sepData.dpjp.kdDPJP})` : ""}` : "-"],
                        ["Catatan", sepData.catatan],
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <EmptyResult title="Belum ada data SEP" message="Masukkan nomor SEP lalu jalankan pencarian." />
              )
            }
          />
        )}

        {activeTab === "surat-kontrol" && (
          <ToolWorkspace
            eyebrow="VClaim"
            title="Surat Kontrol"
            description="Cari surat kontrol peserta dan lakukan pembatalan bila diperlukan."
            formTitle="Filter pencarian"
            formDescription="Isi nomor kartu dan periode pencarian surat kontrol."
            form={
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sk-no-kartu">No. Kartu BPJS</Label>
                  <Input
                    id="sk-no-kartu"
                    placeholder="Nomor kartu BPJS"
                    value={skNoKartu}
                    onChange={(e) => setSkNoKartu(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchSuratKontrol()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bulan</Label>
                    <Select value={skBulan} onValueChange={setSkBulan}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((n, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tahun</Label>
                    <Select value={skTahun} onValueChange={setSkTahun}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Jenis Filter</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Button type="button" variant={skFilter === "1" ? "default" : "outline"} onClick={() => setSkFilter("1")}>Terbit</Button>
                    <Button type="button" variant={skFilter === "2" ? "default" : "outline"} onClick={() => setSkFilter("2")}>Kontrol</Button>
                  </div>
                </div>
                <Button onClick={handleSearchSuratKontrol} className="w-full" disabled={skLoading}>
                  {skLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Surat Kontrol
                </Button>
              </div>
            }
            resultTitle="Daftar surat kontrol"
            resultDescription="Semua data surat kontrol ditampilkan dalam bentuk tabel agar mudah dibaca dan ditindaklanjuti."
            resultMeta={skData.length > 0 ? <Badge variant="secondary">{skData.length} data</Badge> : null}
            result={
              skSearched ? (
                skData.length > 0 ? (
                  <div className="rounded-2xl border overflow-hidden bg-background">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="px-4 py-3 font-medium">No. Surat Kontrol</th>
                            <th className="px-4 py-3 font-medium">Peserta</th>
                            <th className="px-4 py-3 font-medium">Tgl Kontrol</th>
                            <th className="px-4 py-3 font-medium">Terbit</th>
                            <th className="px-4 py-3 font-medium">Poli</th>
                            <th className="px-4 py-3 font-medium">Dokter</th>
                            <th className="px-4 py-3 text-center font-medium">SEP</th>
                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skData.map((item) => (
                            <tr key={item.noSuratKontrol} className="border-t align-top">
                              <td className="px-4 py-3 font-mono text-xs">{item.noSuratKontrol}</td>
                              <td className="px-4 py-3">{item.nama}</td>
                              <td className="px-4 py-3">{item.tglRencanaKontrol}</td>
                              <td className="px-4 py-3">{item.tglTerbitKontrol}</td>
                              <td className="px-4 py-3">{item.namaPoliTujuan}</td>
                              <td className="px-4 py-3">{item.namaDokter}</td>
                              <td className="px-4 py-3 text-center">
                                {item.terbitSEP === "Sudah" ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground" />}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSkDeleteConfirm(item)}
                                  disabled={skDeleting === item.noSuratKontrol || item.terbitSEP === "Sudah"}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  {skDeleting === item.noSuratKontrol ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <EmptyResult title="Tidak ada surat kontrol" message="Data surat kontrol tidak ditemukan untuk parameter yang dipilih." />
                )
              ) : (
                <EmptyResult title="Belum ada pencarian" message="Isi filter lalu tekan tombol cari untuk melihat daftar surat kontrol." />
              )
            }
          />
        )}

        {activeTab === "pengajuan-approval" && (
          <ToolWorkspace
            eyebrow="VClaim"
            title="Pengajuan dan Approval SEP"
            description="Gunakan area kiri untuk mengajukan SEP atau approval manual, lalu cek daftar approval di area hasil."
            formTitle="Form pengajuan"
            formDescription="Semua input pengajuan dan approval manual dikelompokkan dalam satu panel kerja."
            form={
              <div className="space-y-4">
                <div className="space-y-3 border-b pb-5">
                  <div>
                    <p className="text-sm font-semibold">Pengajuan SEP</p>
                    <p className="text-xs text-muted-foreground">Ajukan kebutuhan SEP baru ke BPJS.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>No. Kartu BPJS</Label>
                      <Input value={pengajuanNoKartu} onChange={(e) => setPengajuanNoKartu(e.target.value)} placeholder="0001234567890" />
                    </div>
                    <div>
                      <Label>Tgl SEP</Label>
                      <Input type="date" value={pengajuanTglSep} onChange={(e) => setPengajuanTglSep(e.target.value)} />
                    </div>
                    <div>
                      <Label>Jenis Pelayanan</Label>
                      <Select value={pengajuanJnsPelayanan} onValueChange={setPengajuanJnsPelayanan}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Rawat Jalan</SelectItem>
                          <SelectItem value="1">Rawat Inap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Jenis Pengajuan</Label>
                      <Select value={pengajuanJnsPengajuan} onValueChange={setPengajuanJnsPengajuan}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Backdate</SelectItem>
                          <SelectItem value="2">Finger Print</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Keterangan</Label>
                    <Input value={pengajuanKeterangan} onChange={(e) => setPengajuanKeterangan(e.target.value)} placeholder="Tuliskan alasan pengajuan" />
                  </div>
                  <Button onClick={handlePengajuanSEP} className="w-full" disabled={pengajuanSubmitting}>
                    {pengajuanSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Ajukan SEP
                  </Button>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-sm font-semibold">Approval Manual</p>
                    <p className="text-xs text-muted-foreground">Gunakan bila approval perlu diajukan tanpa memilih dari daftar.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>No. Kartu BPJS</Label>
                      <Input value={manualNoKartu} onChange={(e) => setManualNoKartu(e.target.value)} placeholder="0001234567890" />
                    </div>
                    <div>
                      <Label>Tgl SEP</Label>
                      <Input type="date" value={manualTglSep} onChange={(e) => setManualTglSep(e.target.value)} />
                    </div>
                    <div>
                      <Label>Jenis Pelayanan</Label>
                      <Select value={manualJnsPelayanan} onValueChange={setManualJnsPelayanan}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Rawat Jalan</SelectItem>
                          <SelectItem value="1">Rawat Inap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Jenis Pengajuan</Label>
                      <Select value={manualJnsPengajuan} onValueChange={setManualJnsPengajuan}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Backdate</SelectItem>
                          <SelectItem value="2">Finger Print</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Keterangan</Label>
                    <Input value={manualKeterangan} onChange={(e) => setManualKeterangan(e.target.value)} placeholder="Tuliskan alasan approval manual" />
                  </div>
                  <Button onClick={handleManualApprovalSEP} className="w-full" disabled={manualApprovalSubmitting}>
                    {manualApprovalSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Ajukan Approval Manual
                  </Button>
                </div>
              </div>
            }
            resultTitle="Daftar SEP yang menunggu approval"
            resultDescription="Gunakan filter periode untuk melihat daftar approval yang perlu ditindaklanjuti."
            resultMeta={approvalData.length > 0 ? <Badge variant="secondary">{approvalData.length} data</Badge> : null}
            result={
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3 border-b pb-4">
                  <div className="w-40">
                    <Label>Bulan</Label>
                    <Select value={approvalBulan} onValueChange={setApprovalBulan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((n, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label>Tahun</Label>
                    <Select value={approvalTahun} onValueChange={setApprovalTahun}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSearchApprovalSEP} disabled={approvalLoading}>
                    {approvalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Cari Daftar Approval
                  </Button>
                </div>

                {approvalSearched ? (
                  approvalData.length > 0 ? (
                    <div className="rounded-2xl border overflow-hidden bg-background">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                              <th className="px-4 py-3 font-medium">No. Kartu</th>
                              <th className="px-4 py-3 font-medium">Nama</th>
                              <th className="px-4 py-3 font-medium">Tgl SEP</th>
                              <th className="px-4 py-3 font-medium">Pelayanan</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 text-right font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvalData.map((item) => (
                              <tr key={`${item.noKartu}-${item.tglsep}`} className="border-t align-top">
                                <td className="px-4 py-3 font-mono text-xs">{item.noKartu}</td>
                                <td className="px-4 py-3">{item.nama}</td>
                                <td className="px-4 py-3">{item.tglsep}</td>
                                <td className="px-4 py-3">{item.jnspelayanan === "RI" ? "Rawat Inap" : "Rawat Jalan"}</td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                    {item.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setApprovalDialog(item);
                                      setApprovalKeterangan("");
                                    }}
                                    disabled={approvalSubmitting === item.noKartu}
                                  >
                                    {approvalSubmitting === item.noKartu ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Approval
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyResult title="Tidak ada SEP menunggu approval" message="Tidak ditemukan data approval untuk periode yang dipilih." />
                  )
                ) : (
                  <EmptyResult title="Belum ada pencarian" message="Pilih bulan dan tahun lalu tekan tombol cari untuk menampilkan daftar approval." />
                )}
              </div>
            }
          />
        )}

        {activeTab === "icare" && (
          <ToolWorkspace
            eyebrow="I-Care"
            title="Validasi I-Care"
            description="Validasi nomor kartu dan kode dokter untuk membuka sesi BPJS I-Care."
            formTitle="Parameter validasi"
            formDescription="Isi nomor kartu dan kode dokter BPJS untuk membuka I-Care."
            form={
              <div className="space-y-3">
                <div>
                  <Label>No. Kartu BPJS</Label>
                  <Input value={icareNoKartu} onChange={(e) => setIcareNoKartu(e.target.value)} placeholder="0001234567890" onKeyDown={(e) => e.key === "Enter" && handleICareValidate()} />
                </div>
                <div>
                  <Label>Kode Dokter BPJS</Label>
                  <Input value={icareKodeDokter} onChange={(e) => setIcareKodeDokter(e.target.value)} placeholder="12345" onKeyDown={(e) => e.key === "Enter" && handleICareValidate()} />
                </div>
                <Button onClick={handleICareValidate} className="w-full" disabled={icareLoading}>
                  {icareLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  Buka I-Care
                </Button>
              </div>
            }
            resultTitle="Status validasi"
            resultDescription="Status sesi I-Care aktif akan tampil di area ini."
            resultMeta={
              icareUrl ? (
                <Button size="sm" variant="outline" onClick={() => setIcareOpen(true)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Buka Lagi
                </Button>
              ) : null
            }
            result={
              icareUrl ? (
                <ResultCards
                  entries={[
                    ["Status", "Sesi I-Care siap digunakan"],
                    ["Nomor Kartu", icareNoKartu],
                    ["Kode Dokter", icareKodeDokter],
                  ]}
                />
              ) : (
                <EmptyResult title="Belum ada sesi I-Care" message="Setelah validasi berhasil, status sesi akan ditampilkan di sini." />
              )
            }
          />
        )}

        {activeTab === "antrian-online" && (
          <ToolWorkspace
            eyebrow="Antrol"
            title="Pendaftaran Antrean Online"
            description="Pantau daftar antrean BPJS per tanggal, lalu buka task atau detail pendaftaran dari hasil tabel."
            formTitle="Filter tanggal"
            formDescription="Pilih tanggal layanan untuk melihat antrean yang sudah terdaftar di BPJS."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={antreanTanggal} onChange={(e) => setAntreanTanggal(e.target.value)} />
                </div>
                <Button onClick={handleSearchAntrean} className="w-full" disabled={antreanLoading}>
                  {antreanLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Antrean
                </Button>
              </div>
            }
            resultTitle="Daftar antrean"
            resultDescription="Seluruh hasil antrean ditampilkan dalam tabel. Detail dan task dibuka dari baris yang dipilih."
            resultMeta={antreanData.length > 0 ? <Badge variant="secondary">{antreanData.length} antrean</Badge> : null}
            result={
              antreanSearched ? (
                <div className="space-y-4">
                  {antreanData.length > 0 ? (
                    <div className="rounded-2xl border overflow-hidden bg-background">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                              <th className="px-4 py-3 font-medium">Kode Booking</th>
                              <th className="px-4 py-3 font-medium">Peserta</th>
                              <th className="px-4 py-3 font-medium">Poli dan Dokter</th>
                              <th className="px-4 py-3 font-medium">Jadwal</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 text-right font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {antreanData.map((item) => (
                              <tr key={item.kodebooking} className="border-t align-top">
                                <td className="px-4 py-3">
                                  <div className="font-mono text-xs font-medium">{item.kodebooking}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">No. Antrean: {item.noantrean}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm">BPJS: {item.nokapst}</div>
                                  <div className="text-xs text-muted-foreground">NIK: {item.nik}</div>
                                  <div className="text-xs text-muted-foreground">RM: {item.norekammedis}</div>
                                  <div className="text-xs text-muted-foreground">HP: {item.nohp}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div>{item.kodepoli}</div>
                                  <div className="text-xs text-muted-foreground">Dokter: {item.kodedokter}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div>{item.jampraktek}</div>
                                  <div className="text-xs text-muted-foreground">Referensi: {item.nomorreferensi || "-"}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className={cn(
                                    item.status === "Belum" && "bg-amber-50 text-amber-700 border-amber-200",
                                    item.status === "Hadir" && "bg-green-50 text-green-700 border-green-200",
                                    item.status === "Selesai dilayani" && "bg-blue-50 text-blue-700 border-blue-200",
                                  )}>
                                    {item.status}
                                  </Badge>
                                  <div className="mt-2 text-xs text-muted-foreground">{item.sumberdata}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleToggleAntreanDetail(item.kodebooking, "tasks")}>
                                      {antreanTasksLoading === item.kodebooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                                      Task
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleToggleAntreanDetail(item.kodebooking, "detail")}>
                                      {antreanDetailLoading === item.kodebooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                      Detail
                                    </Button>
                                    <Button variant="destructive" size="sm" disabled={antreanCancelling === item.kodebooking} onClick={() => setAntreanCancelConfirm(item)}>
                                      {antreanCancelling === item.kodebooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                      Batal
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyResult title="Tidak ada antrean" message="Tidak ditemukan antrean BPJS pada tanggal yang dipilih." />
                  )}

                  {antreanExpandedItem && (
                    <div className="border-t pt-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Button type="button" variant={antreanDetailTab === "tasks" ? "default" : "outline"} size="sm" onClick={() => handleToggleAntreanDetail(antreanExpandedItem, "tasks")}>List Task</Button>
                        <Button type="button" variant={antreanDetailTab === "detail" ? "default" : "outline"} size="sm" onClick={() => handleToggleAntreanDetail(antreanExpandedItem, "detail")}>Detail Pendaftaran</Button>
                        <div className="flex-1" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setAntreanExpandedItem(null)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>

                      {antreanDetailTab === "tasks" && (
                        antreanTasksLoading === antreanExpandedItem ? (
                          <EmptyResult title="Memuat task" message="Daftar task sedang diambil dari BPJS." />
                        ) : antreanTasks[antreanExpandedItem]?.length ? (
                          <div className="rounded-2xl border overflow-hidden bg-background">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                                    <th className="px-4 py-3 font-medium">Task ID</th>
                                    <th className="px-4 py-3 font-medium">Nama Task</th>
                                    <th className="px-4 py-3 font-medium">Waktu</th>
                                    <th className="px-4 py-3 font-medium">Waktu RS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {antreanTasks[antreanExpandedItem].map((task) => (
                                    <tr key={task.taskid} className="border-t">
                                      <td className="px-4 py-3">{task.taskid}</td>
                                      <td className="px-4 py-3">{task.taskname}</td>
                                      <td className="px-4 py-3">{task.waktu || "-"}</td>
                                      <td className="px-4 py-3">{task.wakturs || "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <EmptyResult title="Tidak ada task" message="BPJS tidak mengirimkan daftar task untuk booking ini." />
                        )
                      )}

                      {antreanDetailTab === "detail" && (
                        antreanDetailLoading === antreanExpandedItem ? (
                          <EmptyResult title="Memuat detail" message="Detail pendaftaran sedang diambil dari BPJS." />
                        ) : antreanBookingDetail[antreanExpandedItem]?.length ? (
                          <div className="space-y-4">
                            {antreanBookingDetail[antreanExpandedItem].map((detail, index) => (
                              <div key={`${detail.kodebooking}-${index}`} className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Detail pendaftaran {index + 1}</p>
                                <ResultCards
                                  entries={[
                                    ["Kode Booking", detail.kodebooking],
                                    ["Tanggal", detail.tanggal],
                                    ["Kode Poli", detail.kodepoli],
                                    ["Kode Dokter", detail.kodedokter],
                                    ["Jam Praktek", detail.jampraktek],
                                    ["NIK", detail.nik],
                                    ["No. Kartu BPJS", detail.nokapst],
                                    ["No. HP", detail.nohp],
                                    ["No. Rekam Medis", detail.norekammedis],
                                    ["No. Antrean", detail.noantrean],
                                    ["Jenis Kunjungan", detail.jeniskunjungan === 1 ? "Rujukan FKTP" : detail.jeniskunjungan === 2 ? "Rujukan Internal" : detail.jeniskunjungan === 3 ? "Kontrol" : detail.jeniskunjungan === 4 ? "Rujukan Antar RS" : detail.jeniskunjungan],
                                    ["No. Referensi", detail.nomorreferensi],
                                    ["Sumber Data", detail.sumberdata],
                                    ["Status", detail.status],
                                    ["Estimasi Dilayani", detail.estimasidilayani ? new Date(detail.estimasidilayani).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"],
                                    ["Created", detail.createdtime ? new Date(detail.createdtime).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "-"],
                                  ]}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyResult title="Tidak ada detail" message="BPJS tidak mengirimkan detail pendaftaran untuk booking ini." />
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <EmptyResult title="Belum ada pencarian" message="Pilih tanggal layanan lalu jalankan pencarian antrean." />
              )
            }
          />
        )}

        {activeTab === "apotek-dpho" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi DPHO"
            description="Ambil daftar referensi DPHO dari BPJS Apotek Online."
            formTitle="Aksi"
            formDescription="Gunakan tombol di bawah ini untuk memuat seluruh referensi DPHO."
            form={
              <Button onClick={handleApotekReferensiDPHO} className="w-full" disabled={apotekLoading === "apotek-dpho"}>
                {apotekLoading === "apotek-dpho" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Ambil Referensi DPHO
              </Button>
            }
            resultTitle="Hasil referensi DPHO"
            resultDescription="Jika hasil berupa daftar, sistem akan menampilkannya sebagai tabel."
            result={<FriendlyResult data={apotekDPHOResult} />}
          />
        )}

        {activeTab === "apotek-setting" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi Apotek"
            description="Cari referensi apotek berdasarkan kode apotek BPJS."
            formTitle="Parameter pencarian"
            formDescription="Masukkan kode apotek yang ingin dicek."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Kode Apotek</Label>
                  <Input value={apotekKodeApotek} onChange={(e) => setApotekKodeApotek(e.target.value)} placeholder="Contoh: 0112A017" />
                </div>
                <Button onClick={handleApotekReferensiSetting} className="w-full" disabled={apotekLoading === "apotek-setting"}>
                  {apotekLoading === "apotek-setting" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Referensi Apotek
                </Button>
              </div>
            }
            resultTitle="Hasil referensi apotek"
            resultDescription="Deskripsi apotek akan muncul sebagai kartu informasi atau tabel bila berupa daftar."
            result={<FriendlyResult data={apotekSettingResult} />}
          />
        )}

        {activeTab === "apotek-ppk" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi PPK"
            description="Cari fasilitas kesehatan berdasarkan jenis faskes dan nama faskes."
            formTitle="Parameter pencarian"
            formDescription="Tentukan jenis faskes dan masukkan nama faskes yang ingin dicari."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Jenis Faskes</Label>
                  <Select value={apotekJenisFaskes} onValueChange={setApotekJenisFaskes}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Faskes 1</SelectItem>
                      <SelectItem value="2">Faskes 2 / RS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nama Faskes</Label>
                  <Input value={apotekNamaFaskes} onChange={(e) => setApotekNamaFaskes(e.target.value)} placeholder="Nama faskes" />
                </div>
                <Button onClick={handleApotekReferensiPPK} className="w-full" disabled={apotekLoading === "apotek-ppk"}>
                  {apotekLoading === "apotek-ppk" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Referensi PPK
                </Button>
              </div>
            }
            resultTitle="Hasil referensi PPK"
            resultDescription="Daftar fasilitas kesehatan akan ditampilkan dalam tabel."
            result={<FriendlyResult data={apotekPPKResult} />}
          />
        )}

        {activeTab === "apotek-obat" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi Obat"
            description="Cari referensi obat berdasarkan jenis obat, tanggal resep, dan kata kunci pencarian."
            formTitle="Parameter pencarian"
            formDescription="Lengkapi semua parameter sebelum menjalankan pencarian referensi obat."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Kode Jenis Obat</Label>
                  <Input value={apotekKodeJenisObat} onChange={(e) => setApotekKodeJenisObat(e.target.value)} placeholder="Kosongkan jika tidak ingin difilter" />
                </div>
                <div>
                  <Label>Tanggal Resep</Label>
                  <Input type="date" value={apotekTglResep} onChange={(e) => setApotekTglResep(e.target.value)} />
                </div>
                <div>
                  <Label>Filter Obat</Label>
                  <Input value={apotekFilterObat} onChange={(e) => setApotekFilterObat(e.target.value)} placeholder="Boleh dikosongkan" />
                </div>
                <Button onClick={handleApotekReferensiObat} className="w-full" disabled={apotekLoading === "apotek-obat"}>
                  {apotekLoading === "apotek-obat" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Referensi Obat
                </Button>
              </div>
            }
            resultTitle="Hasil referensi obat"
            resultDescription="Hasil pencarian obat akan ditampilkan dalam format tabel atau kartu deskripsi."
            result={<FriendlyResult data={apotekObatResult} />}
          />
        )}

        {activeTab === "apotek-poli" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi Poli"
            description="Cari referensi poli berdasarkan kode atau nama poli."
            formTitle="Parameter pencarian"
            formDescription="Masukkan kode poli atau nama poli yang ingin dicari."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Kode atau Nama Poli</Label>
                  <Input value={apotekCariPoli} onChange={(e) => setApotekCariPoli(e.target.value)} placeholder="Contoh: INT" />
                </div>
                <Button onClick={handleApotekReferensiPoli} className="w-full" disabled={apotekLoading === "apotek-poli"}>
                  {apotekLoading === "apotek-poli" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari Referensi Poli
                </Button>
              </div>
            }
            resultTitle="Hasil referensi poli"
            resultDescription="Hasil ditampilkan dalam bentuk tabel untuk memudahkan pembacaan daftar poli."
            result={<FriendlyResult data={apotekPoliResult} />}
          />
        )}

        {activeTab === "apotek-sep" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="No Kunjungan / SEP"
            description="Cari data kunjungan berdasarkan nomor SEP atau nomor kunjungan yang dimiliki pasien."
            formTitle="Parameter pencarian"
            formDescription="Masukkan nomor SEP atau nomor kunjungan BPJS."
            form={
              <div className="space-y-3">
                <div>
                  <Label>Nomor Kunjungan / SEP</Label>
                  <Input value={apotekNoSEP} onChange={(e) => setApotekNoSEP(e.target.value)} placeholder="Contoh: 1202R0010318V000092" />
                </div>
                <Button onClick={handleApotekCariSEP} className="w-full" disabled={apotekLoading === "apotek-sep"}>
                  {apotekLoading === "apotek-sep" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Cari No Kunjungan / SEP
                </Button>
              </div>
            }
            resultTitle="Hasil pencarian kunjungan"
            resultDescription="Detail kunjungan akan disajikan sebagai kartu, dan daftar akan ditampilkan dalam tabel."
            result={<FriendlyResult data={apotekSEPResult} />}
          />
        )}

        {activeTab === "apotek-spesialistik" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Referensi Spesialis"
            description="Ambil daftar referensi spesialis atau spesialistik yang tersedia di BPJS Apotek Online."
            formTitle="Aksi"
            formDescription="Klik tombol di bawah untuk memuat daftar spesialis."
            form={
              <Button onClick={handleApotekSpesialistik} className="w-full" disabled={apotekLoading === "apotek-spesialistik"}>
                {apotekLoading === "apotek-spesialistik" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Ambil Referensi Spesialis
              </Button>
            }
            resultTitle="Hasil referensi spesialis"
            resultDescription="Daftar spesialis akan ditampilkan dalam tabel yang seragam dengan modul lain."
            result={<FriendlyResult data={apotekSpesialistikResult} />}
          />
        )}

        {activeTab === "apotek-klaim" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Data Klaim"
            description="Laporan rekap data klaim apotek online BPJS."
            formTitle="Parameter Laporan"
            formDescription="Pilih bulan, tahun, jenis obat, dan status verifikasi."
            form={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Bulan</Label>
                    <Select value={apotekKlaimBulan} onValueChange={setApotekKlaimBulan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>Bulan {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tahun</Label>
                    <Select value={apotekKlaimTahun} onValueChange={setApotekKlaimTahun}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }).map((_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={String(year)}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Jenis Obat</Label>
                  <Select value={apotekKlaimJenisObat} onValueChange={setApotekKlaimJenisObat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Semua</SelectItem>
                      <SelectItem value="1">Obat PRB</SelectItem>
                      <SelectItem value="2">Obat Kronis Blm Stabil</SelectItem>
                      <SelectItem value="3">Obat Kemoterapi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={apotekKlaimStatus} onValueChange={setApotekKlaimStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Belum diverifikasi</SelectItem>
                      <SelectItem value="2">Sudah Verifikasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleApotekKlaim} className="w-full" disabled={apotekLoading === "apotek-klaim"}>
                  {apotekLoading === "apotek-klaim" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Tampilkan Data Klaim
                </Button>
              </div>
            }
            resultTitle="Hasil Laporan Klaim"
            resultDescription="Menampilkan rekap jumlah data klaim dan daftar SEP beserta biayanya."
            result={<FriendlyResult data={apotekKlaimResult} />}
          />
        )}

        {activeTab === "apotek-rekap-prb" && (
          <ToolWorkspace
            eyebrow="Apotek Online"
            title="Rekap Peserta PRB"
            description="Daftar peserta PRB yang telah dilayani oleh Apotek pada bulan dan tahun tertentu."
            formTitle="Parameter Laporan"
            formDescription="Pilih tahun dan bulan laporan."
            form={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Bulan</Label>
                    <Select value={apotekPrbBulan} onValueChange={setApotekPrbBulan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>Bulan {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tahun</Label>
                    <Select value={apotekPrbTahun} onValueChange={setApotekPrbTahun}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }).map((_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <SelectItem key={year} value={String(year)}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleApotekRekapPrb} className="w-full" disabled={apotekLoading === "apotek-rekap-prb"}>
                  {apotekLoading === "apotek-rekap-prb" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Tampilkan Rekap PRB
                </Button>
              </div>
            }
            resultTitle="Hasil Rekap Peserta PRB"
            resultDescription="Daftar peserta PRB beserta informasi obat dan diagnosa."
            result={<FriendlyResult data={apotekPrbResult} />}
          />
        )}
        </div>
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
