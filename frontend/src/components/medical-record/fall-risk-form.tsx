import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Activity, CheckSquare, Trash2, X, AlertTriangle, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { fallRiskApi, type FallRiskAssessment } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

interface FallRiskFormProps {
  visitId: number;
  externalData?: FallRiskAssessment[];
  useExternalData?: boolean;
}

const humptyDumptyParameters = [
  {
    id: "hd_umur",
    label: "1. Umur",
    options: [
      { value: "4", label: "< 3 tahun", score: 4 },
      { value: "3", label: "3 - < 7 tahun", score: 3 },
      { value: "2", label: "7 - < 13 tahun", score: 2 },
      { value: "1", label: "≥ 13 tahun", score: 1 },
    ],
  },
  {
    id: "hd_jenis_kelamin",
    label: "2. Jenis Kelamin",
    options: [
      { value: "2", label: "Laki-laki", score: 2 },
      { value: "1", label: "Perempuan", score: 1 },
    ],
  },
  {
    id: "hd_diagnosis",
    label: "3. Diagnosis",
    options: [
      { value: "4", label: "Diagnosis Neurologis", score: 4 },
      { value: "3", label: "Perubahan Oksigenasi (Diagnosis Respiratorik, Dehidrasi, dll)", score: 3 },
      { value: "2", label: "Gangguan Psikiatrik / Perilaku", score: 2 },
      { value: "1", label: "Diagnosis Lainnya", score: 1 },
    ],
  },
  {
    id: "hd_gangguan_kognitif",
    label: "4. Gangguan Kognitif",
    options: [
      { value: "3", label: "Tidak menyadari keterbatasan dirinya", score: 3 },
      { value: "2", label: "Lupa akan keterbatasan dirinya", score: 2 },
      { value: "1", label: "Sadar akan kemampuan dirinya", score: 1 },
    ],
  },
  {
    id: "hd_faktor_lingkungan",
    label: "5. Faktor Lingkungan",
    options: [
      { value: "4", label: "Riwayat jatuh / bayi-balita di tempat tidur dewasa", score: 4 },
      { value: "3", label: "Pasien menggunakan alat bantu / bayi-balita dalam boks bayi", score: 3 },
      { value: "2", label: "Pasien ditempatkan di tempat tidur", score: 2 },
      { value: "1", label: "Area di luar rumah sakit / Rawat Jalan", score: 1 },
    ],
  },
  {
    id: "hd_respon_operasi",
    label: "6. Respon Pembedahan / Sedasi / Anestesi",
    options: [
      { value: "3", label: "Dalam 24 jam", score: 3 },
      { value: "2", label: "Dalam 48 jam", score: 2 },
      { value: "1", label: "> 48 jam / Tidak ada", score: 1 },
    ],
  },
  {
    id: "hd_penggunaan_obat",
    label: "7. Penggunaan Obat",
    options: [
      { value: "3", label: "Penggunaan obat sedatif/hipnotik/antidepresan/dll", score: 3 },
      { value: "2", label: "Salah satu dari obat di atas", score: 2 },
      { value: "1", label: "Obat lainnya / Tidak ada obat", score: 1 },
    ],
  },
];

const morseScaleParameters = [
  {
    id: "riwayat_jatuh",
    label: "1. Riwayat jatuh (dalam 3 bulan terakhir)",
    options: [
      { value: "0", label: "Tidak", score: 0 },
      { value: "25", label: "Ya", score: 25 },
    ],
  },
  {
    id: "diagnosis_sekunder",
    label: "2. Diagnosis sekunder (lebih dari 1 diagnosis medis)",
    options: [
      { value: "0", label: "Tidak", score: 0 },
      { value: "15", label: "Ya", score: 15 },
    ],
  },
  {
    id: "alat_bantu",
    label: "3. Alat bantu berjalan",
    options: [
      { value: "0", label: "Tirah baring/Kursi roda/Dibantu perawat", score: 0 },
      { value: "15", label: "Kruk/Tongkat/Walker", score: 15 },
      { value: "30", label: "Berpegangan pada perabot/dinding", score: 30 },
    ],
  },
  {
    id: "terapi_iv",
    label: "4. Terapi Intravena (Terpasang Infus)",
    options: [
      { value: "0", label: "Tidak", score: 0 },
      { value: "20", label: "Ya", score: 20 },
    ],
  },
  {
    id: "gaya_berjalan",
    label: "5. Gaya Berjalan",
    options: [
      { value: "0", label: "Normal/Tirah baring/Imobilisasi", score: 0 },
      { value: "10", label: "Lemah", score: 10 },
      { value: "20", label: "Terganggu/Pincang/Diseret", score: 20 },
    ],
  },
  {
    id: "status_mental",
    label: "6. Status Mental",
    options: [
      { value: "0", label: "Sadar akan kemampuan diri", score: 0 },
      { value: "15", label: "Lupa keterbatasan diri/Penurunan kesadaran", score: 15 },
    ],
  },
];

const getMorseRiskLevel = (score: number) => {
  if (score >= 45) return { level: "Tinggi", color: "text-red-600", bg: "bg-red-100", border: "border-red-200" };
  if (score >= 25) return { level: "Sedang", color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-200" };
  return { level: "Rendah", color: "text-green-600", bg: "bg-green-100", border: "border-green-200" };
};

const getHumptyRiskLevel = (score: number) => {
  if (score >= 12) return { level: "Tinggi", color: "text-red-600", bg: "bg-red-100", border: "border-red-200" };
  return { level: "Rendah", color: "text-green-600", bg: "bg-green-100", border: "border-green-200" };
};

const defaultInterventions = {
  Rendah: [
    "Edukasi pasien dan keluarga",
    "Pastikan tempat tidur pada posisi rendah",
    "Roda tempat tidur terkunci",
    "Bel panggilan dalam jangkauan",
    "Pencahayaan adekuat"
  ],
  Sedang: [
    "Lakukan intervensi risiko rendah",
    "Pasang pita/stiker kuning pada gelang identitas",
    "Temani pasien saat mobilisasi/ke kamar mandi",
    "Dekatkan barang-barang pribadi pasien"
  ],
  Tinggi: [
    "Lakukan intervensi risiko sedang",
    "Pasang tanda risiko jatuh kuning di tempat tidur/pintu",
    "Awasi pasien dengan ketat",
    "Evaluasi efek obat-obatan",
    "Tawarkan bantuan ke kamar mandi secara berkala"
  ]
};

const defaultInterventionsHumpty = {
  Rendah: [
    "Edukasi orang tua / keluarga pencegahan jatuh",
    "Pastikan tempat tidur pada posisi paling rendah",
    "Pagar tempat tidur selalu terpasang",
    "Roda tempat tidur / boks bayi terkunci",
    "Bel panggilan dalam jangkauan"
  ],
  Tinggi: [
    "Lakukan intervensi risiko rendah",
    "Pasang pita/stiker kuning risiko jatuh (anak)",
    "Pasang tanda peringatan risiko jatuh di tempat tidur",
    "Observasi / patroli oleh perawat lebih sering",
    "Edukasi intensif orang tua agar anak selalu didampingi"
  ]
};

function FallRiskCollapsibleRow({
  record,
  onDelete,
  readOnly = false,
}: {
  record: FallRiskAssessment;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isHumpty = record.scale_type === "humpty_dumpty";
  const levelInfo = isHumpty ? getHumptyRiskLevel(record.total_score) : getMorseRiskLevel(record.total_score);
  const activeParams = isHumpty ? humptyDumptyParameters : morseScaleParameters;

  let itemsRecord: Record<string, number> = {};
  try { itemsRecord = JSON.parse(record.items_json); } catch (e) { }
  let actionsArr: string[] = [];
  try { actionsArr = JSON.parse(record.risk_action); } catch (e) { }

  return (
    <tbody className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors align-middle">
        <td className="px-3 py-2.5 w-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </td>
        <td className="px-3 py-2.5 font-mono font-medium text-foreground whitespace-nowrap">
          {format(new Date(record.record_date), "dd/MM/yyyy HH:mm")}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {record.scale_type === "morse"
            ? "Morse (Dewasa)"
            : record.scale_type === "humpty_dumpty"
            ? "Humpty Dumpty (Anak)"
            : record.scale_type}
        </td>
        <td className="px-3 py-2.5 font-mono whitespace-nowrap">
          Skor: <span className="font-bold text-foreground">{record.total_score}</span>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <Badge className={cn("text-[10px] uppercase font-semibold h-5 px-1.5 rounded-none border", levelInfo.bg, levelInfo.color, levelInfo.border)}>
            {record.risk_level}
          </Badge>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-none"
              title="Hapus"
              onClick={() => onDelete(record.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </td>
      </tr>

      {isOpen && (
        <tr className="bg-neutral-50/30 dark:bg-neutral-900/20">
          <td colSpan={6} className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-3 space-y-2">
                <h4 className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Detail Parameter
                </h4>
                <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800/70">
                  {activeParams.map((param) => {
                    const score = itemsRecord[param.id];
                    if (score === undefined) return null;
                    const optionLabel = param.options.find((o) => o.score === score)?.label || "-";
                    return (
                      <div key={param.id} className="flex justify-between items-start gap-4 text-xs py-1.5 first:pt-0 last:pb-0">
                        <span className="text-muted-foreground leading-tight flex-1">{param.label}</span>
                        <div className="text-right">
                          <div className="font-medium text-foreground">{optionLabel}</div>
                          {score > 0 && (
                            <div className="text-[10px] font-mono text-foreground font-semibold mt-0.5">
                              +{score} poin
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 bg-background p-3 space-y-2.5">
                <h4 className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Tindakan Pencegahan
                </h4>
                {actionsArr.length > 0 ? (
                  <ul className="space-y-1.5">
                    {actionsArr.map((act, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100 mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/90">{act}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">- Tidak ada tindakan tercatat -</p>
                )}

                {record.notes && (
                  <div className="p-2.5 bg-neutral-50/40 dark:bg-neutral-900/20 border border-neutral-200 dark:border-neutral-800">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Catatan
                    </h4>
                    <p className="text-xs text-foreground/90 whitespace-pre-line">{record.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Dicatat oleh: <span className="font-medium text-foreground">{record.assessed_by?.nama_lengkap || "Sistem"}</span>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

export function FallRiskForm({ visitId, externalData, useExternalData = false }: FallRiskFormProps) {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<FallRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Form State
  const [recordDate, setRecordDate] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [scaleType, setScaleType] = useState("morse");
  const [items, setItems] = useState<Record<string, number>>({});
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const totalScore = Object.values(items).reduce((sum, score) => sum + score, 0);
  const isHumpty = scaleType === "humpty_dumpty";
  const riskInfo = isHumpty ? getHumptyRiskLevel(totalScore) : getMorseRiskLevel(totalScore);
  const activeParams = isHumpty ? humptyDumptyParameters : morseScaleParameters;
  const activeInterventions = isHumpty ? defaultInterventionsHumpty : defaultInterventions;

  const fetchAssessments = async () => {
    if (useExternalData) {
      setAssessments(externalData || []);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fallRiskApi.getAll(visitId);
      if (res.data?.data) {
        setAssessments(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch fall risk assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [visitId, useExternalData, externalData]);

  useEffect(() => {
    if (!loading) {
      emitMedicalRecordTabIndicator("fall-risk", `${assessments.length}`);
    }
  }, [loading, assessments.length]);

  const handleOpenCreate = () => {
    setRecordDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setItems({});
    setSelectedInterventions([]);
    setNotes("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.keys(items).length < morseScaleParameters.length) {
      toast({
        title: "Peringatan",
        description: "Harap isi semua parameter pengkajian.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      await fallRiskApi.create(visitId, {
        record_date: recordDate,
        scale_type: scaleType,
        items_json: JSON.stringify(items),
        total_score: totalScore,
        risk_level: riskInfo.level,
        risk_action: JSON.stringify(selectedInterventions),
        notes,
      });

      toast({
        title: "Sukses",
        description: "Data pengkajian risiko jatuh berhasil disimpan.",
      });

      setIsModalOpen(false);
      fetchAssessments();
    } catch (error: any) {
      toast({
        title: "Gagal menyimpan",
        description: error.response?.data?.error || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await fallRiskApi.delete(visitId, deleteTargetId);
      toast({ title: "Sukses", description: "Data berhasil dihapus." });
      setDeleteTargetId(null);
      fetchAssessments();
    } catch (error) {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan saat menghapus data.", variant: "destructive" });
    }
  };

  if (loading && assessments.length === 0) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      {/* Header Section */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Pengkajian Risiko Jatuh
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Penilaian risiko jatuh skala Morse (Dewasa) dan Humpty Dumpty (Anak) beserta tindakan pencegahan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {assessments.length} pengkajian
          </span>
          {!useExternalData && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Pengkajian
            </Button>
          )}
        </div>
      </div>

      {/* Table / Empty Section */}
      <div className="p-4 sm:p-5">
        {assessments.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Tanggal/Waktu</th>
                  <th className="px-3 py-2 text-left">Skala</th>
                  <th className="px-3 py-2 text-left">Total Skor</th>
                  <th className="px-3 py-2 text-left">Level Risiko</th>
                  <th className="w-16 px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              {assessments.map((record) => (
                <FallRiskCollapsibleRow
                  key={record.id}
                  record={record}
                  readOnly={useExternalData}
                  onDelete={(id) => setDeleteTargetId(id)}
                />
              ))}
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 opacity-60 shrink-0" />
            <span>
              {useExternalData
                ? "Tidak ada data risiko jatuh pada RM asli."
                : "Belum ada catatan risiko jatuh — klik Tambah Pengkajian untuk membuat penilaian baru."}
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !gap-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 sm:px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5 text-left">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  Tambah Pengkajian Risiko Jatuh
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pilih skala penilaian dan parameter risiko untuk menentukan tingkat risiko serta tindakan pencegahan.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(false)}
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-y-auto">
            <form id="fall-risk-form" onSubmit={handleSubmit} className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800 w-full">
              {/* Metadata + Live Score */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-neutral-50/40 dark:bg-neutral-900/20 px-4 py-3 shrink-0">
                <div className="space-y-1 md:col-span-4">
                  <Label className="text-xs font-medium">Waktu Pengkajian</Label>
                  <Input
                    type="datetime-local"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    required
                    className="rounded-none h-9 text-xs"
                  />
                </div>
                <div className="space-y-1 md:col-span-5">
                  <Label className="text-xs font-medium">Skala Pengkajian</Label>
                  <Select
                    value={scaleType}
                    onValueChange={(value) => {
                      setScaleType(value);
                      setItems({});
                      setSelectedInterventions([]);
                    }}
                  >
                    <SelectTrigger className="rounded-none h-9 text-xs">
                      <SelectValue placeholder="Pilih Skala" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="morse" className="text-xs">Morse Fall Scale (Dewasa)</SelectItem>
                      <SelectItem value="humpty_dumpty" className="text-xs">Humpty Dumpty Scale (Anak)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 flex items-center md:justify-end">
                  <div
                    className={cn(
                      "w-full md:w-auto flex items-center justify-between md:justify-start gap-2.5 px-3.5 h-9 border rounded-none",
                      riskInfo.bg,
                      riskInfo.border,
                      riskInfo.color
                    )}
                  >
                    <Activity className="w-4 h-4 shrink-0" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Skor:</span>
                      <span className="text-sm font-mono font-bold leading-none">{totalScore}</span>
                      <span className="text-[11px] font-semibold">({riskInfo.level})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="p-4 space-y-3">
                <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Parameter Penilaian
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeParams.map((param) => (
                    <div key={param.id} className="border border-neutral-200 dark:border-neutral-800 bg-background flex flex-col">
                      <div className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-3 h-9 flex items-center text-[11px] font-bold uppercase tracking-wider text-foreground truncate" title={param.label}>
                        {param.label}
                      </div>
                      <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-center">
                        {param.options.map((opt) => {
                          const isSelected = items[param.id] === opt.score;
                          return (
                            <label
                              key={`${param.id}-${opt.score}`}
                              onClick={() => {
                                setItems((prev) => {
                                  const next = { ...prev, [param.id]: opt.score };
                                  const newTotal = Object.values(next).reduce((sum, s) => sum + s, 0);
                                  if (isHumpty) {
                                    const newLevel = getHumptyRiskLevel(newTotal).level as keyof typeof defaultInterventionsHumpty;
                                    setSelectedInterventions([...defaultInterventionsHumpty[newLevel]]);
                                  } else {
                                    const newLevel = getMorseRiskLevel(newTotal).level as keyof typeof defaultInterventions;
                                    setSelectedInterventions([...defaultInterventions[newLevel]]);
                                  }
                                  return next;
                                });
                              }}
                              className={cn(
                                "flex items-center justify-between px-2.5 py-2 rounded-none border cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-neutral-900/[0.04] dark:bg-white/[0.06] border-neutral-900 dark:border-neutral-100 ring-1 ring-neutral-900 dark:ring-neutral-100"
                                  : "bg-background border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0",
                                    isSelected
                                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                                      : "border-muted-foreground/40"
                                  )}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                </div>
                                <span className={cn("text-xs", isSelected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                  {opt.label}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-mono font-bold ml-2 shrink-0",
                                  isSelected ? "text-foreground" : "text-muted-foreground/60"
                                )}
                              >
                                {opt.score}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention Interventions */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Tindakan Pencegahan
                  </div>
                  <Badge className={cn("rounded-none border shadow-none text-[10px] h-5 px-1.5", riskInfo.bg, riskInfo.color, riskInfo.border)}>
                    Risiko {riskInfo.level}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {((activeInterventions as any)[riskInfo.level || "Rendah"]).map((intervention: string, idx: number) => {
                    const isChecked = selectedInterventions.includes(intervention);
                    return (
                      <label
                        key={idx}
                        onClick={() => {
                          setSelectedInterventions((prev) =>
                            prev.includes(intervention)
                              ? prev.filter((i) => i !== intervention)
                              : [...prev, intervention]
                          );
                        }}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-none border cursor-pointer transition-colors",
                          isChecked
                            ? "bg-neutral-900/[0.04] dark:bg-white/[0.06] border-neutral-900 dark:border-neutral-100"
                            : "bg-background border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 w-4 h-4 rounded-none flex items-center justify-center border shrink-0",
                            isChecked
                              ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900"
                              : "border-neutral-300 dark:border-neutral-700"
                          )}
                        >
                          {isChecked && <CheckSquare className="w-3 h-3" />}
                        </div>
                        <span className={cn("text-xs leading-tight", isChecked ? "text-foreground font-semibold" : "text-muted-foreground")}>
                          {intervention}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="px-4 py-3 space-y-1.5">
                <Label className="text-xs font-medium">Catatan Tambahan (Opsional)</Label>
                <Input
                  placeholder="Ketik catatan tambahan di sini..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-none h-9 text-xs"
                />
              </div>
            </form>
          </div>

          <DialogFooter className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 px-4 py-2.5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              form="fall-risk-form"
              type="submit"
              size="sm"
              className="h-8 rounded-none px-4 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="rounded-none border-neutral-200 dark:border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold uppercase tracking-tight">
              Hapus Pengkajian Risiko Jatuh?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Data pengkajian ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 rounded-none text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-none text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
