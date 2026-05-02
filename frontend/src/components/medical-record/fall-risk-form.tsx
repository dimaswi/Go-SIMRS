import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Activity, CheckSquare, Trash2, X, AlertTriangle, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { fallRiskApi, type FallRiskAssessment } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

interface FallRiskFormProps {
  visitId: number;
}

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

function FallRiskCollapsibleRow({ record, onDelete }: { record: FallRiskAssessment; onDelete: (id: number) => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const levelInfo = getMorseRiskLevel(record.total_score);

  let itemsRecord: Record<string, number> = {};
  try { itemsRecord = JSON.parse(record.items_json); } catch (e) { }
  let actionsArr: string[] = [];
  try { actionsArr = JSON.parse(record.risk_action); } catch (e) { }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-none shrink-0">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <div className="flex-1 grid grid-cols-12 gap-2 items-center text-sm">
          <div className="col-span-3 font-medium text-xs">
            {format(new Date(record.record_date), "dd/MM/yyyy HH:mm")}
          </div>
          <div className="col-span-2 text-xs truncate">
            {record.scale_type === "morse" ? "Morse (Dewasa)" : record.scale_type}
          </div>
          <div className="col-span-2 text-xs">
            Skor: <span className="font-semibold">{record.total_score}</span>
          </div>
          <div className="col-span-3">
            <Badge className={cn("text-[10px] uppercase font-semibold h-5 px-1.5 rounded-none border", levelInfo.bg, levelInfo.color, levelInfo.border)}>
              {record.risk_level}
            </Badge>
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-none"
              onClick={() => onDelete(record.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-12 py-3 bg-muted/10 border-t border-border/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Detail Parameter</h4>
              <div className="space-y-1.5">
                {morseScaleParameters.map(param => {
                  const score = itemsRecord[param.id];
                  if (score === undefined) return null;
                  const optionLabel = param.options.find(o => o.score === score)?.label || "-";
                  return (
                    <div key={param.id} className="flex justify-between items-start gap-4 text-xs border-b border-border/40 pb-1.5 last:border-0">
                      <span className="text-muted-foreground leading-tight flex-1">{param.label}</span>
                      <div className="text-right">
                        <div className="font-medium text-foreground">{optionLabel}</div>
                        {score > 0 && <div className="text-[10px] text-primary font-semibold mt-0.5">+{score} poin</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Tindakan Pencegahan</h4>
              {actionsArr.length > 0 ? (
                <ul className="space-y-1">
                  {actionsArr.map((act, i) => (
                    <li key={i} className="text-xs flex items-start gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground/90">{act}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">- Tidak ada tindakan tercatat -</p>
              )}

              {record.notes && (
                <div className="mt-4 p-2.5 bg-muted/30 rounded-none border border-border/50">
                  <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Catatan</h4>
                  <p className="text-xs text-foreground/90 whitespace-pre-line">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
            Dicatat oleh: {record.assessed_by?.nama_lengkap || "Sistem"}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FallRiskForm({ visitId }: FallRiskFormProps) {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<FallRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [recordDate, setRecordDate] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [scaleType, setScaleType] = useState("morse");
  const [items, setItems] = useState<Record<string, number>>({});
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const totalScore = Object.values(items).reduce((sum, score) => sum + score, 0);
  const riskInfo = getMorseRiskLevel(totalScore);

  const fetchAssessments = async () => {
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
  }, [visitId]);

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

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data pengkajian ini?")) return;
    try {
      await fallRiskApi.delete(visitId, id);
      toast({ title: "Sukses", description: "Data berhasil dihapus." });
      fetchAssessments();
    } catch (error) {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan saat menghapus data.", variant: "destructive" });
    }
  };

  if (loading && assessments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Memuat data risiko jatuh...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Pengkajian Risiko Jatuh</span>
              <Button onClick={handleOpenCreate} size="sm" className="h-6 px-2 py-0 text-[10px]">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah
              </Button>
            </div>
          </div>
          {assessments.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0">
                <div className="col-span-1"></div>
                <div className="col-span-3">Tanggal/Waktu</div>
                <div className="col-span-2">Skala</div>
                <div className="col-span-2">Total Skor</div>
                <div className="col-span-3">Level Risiko</div>
                <div className="col-span-1 text-right">Aksi</div>
              </div>
              <div className="divide-y">
                {assessments.map((record) => (
                  <FallRiskCollapsibleRow
                    key={record.id}
                    record={record}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-sm">Belum ada catatan risiko jatuh</p>
              <p className="text-xs mt-1">
                Klik tombol "Tambah" untuk membuat pengkajian baru.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100dvh] !max-h-[100dvh] !rounded-none !border-none !p-0 !m-0 !fixed !top-0 !left-0 !translate-x-0 !translate-y-0 bg-background overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Tambah Pengkajian Risiko Jatuh
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-6 w-6 rounded-none text-muted-foreground hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 sm:px-6">
            <form id="fall-risk-form" onSubmit={handleSubmit} className="flex flex-col gap-3 h-full max-w-full mx-auto w-full">
              <div className="flex items-center gap-4 bg-muted/10 border border-border/70 p-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold w-16">Waktu</Label>
                  <Input
                    type="datetime-local"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    required
                    className="rounded-none border-border/70 h-8 text-xs w-48"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold w-12">Skala</Label>
                  <Select value={scaleType} onValueChange={setScaleType}>
                    <SelectTrigger className="rounded-none border-border/70 h-8 text-xs w-48">
                      <SelectValue placeholder="Pilih Skala" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="morse" className="text-xs">Morse Fall Scale (Dewasa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-muted/30 border border-border/70 py-2 px-3 shrink-0">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Parameter Penilaian</span>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 border rounded-sm",
                  riskInfo.bg, riskInfo.border, riskInfo.color
                )}>
                  <Activity className="w-4 h-4" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Skor Total:</span>
                    <span className="text-base font-bold leading-none">{totalScore}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 overflow-y-auto min-h-0 pr-1">
                {morseScaleParameters.map((param) => (
                  <div key={param.id} className="border border-border/70 bg-background flex flex-col hover:border-border transition-colors">
                    <div className="bg-muted/10 border-b border-border/70 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate" title={param.label}>
                      {param.label}
                    </div>
                    <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-center">
                      {param.options.map((opt) => {
                        const isSelected = items[param.id] === opt.score;
                        return (
                          <label
                            key={`${param.id}-${opt.score}`}
                            onClick={() => {
                              setItems((prev) => {
                                const next = { ...prev, [param.id]: opt.score };
                                const newTotal = Object.values(next).reduce((sum, s) => sum + s, 0);
                                const newLevel = getMorseRiskLevel(newTotal).level as keyof typeof defaultInterventions;
                                setSelectedInterventions([...defaultInterventions[newLevel]]);
                                return next;
                              });
                            }}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-none border cursor-pointer transition-all",
                              isSelected
                                ? "bg-primary/5 border-primary/50 ring-1 ring-primary/20"
                                : "bg-background border-border/70 hover:border-border hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "flex items-center justify-center w-3 h-3 rounded-full border",
                                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                              )}>
                                {isSelected && <div className="w-1 h-1 rounded-full bg-primary-foreground" />}
                              </div>
                              <span className={cn("text-[11px]", isSelected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                {opt.label}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[11px] font-bold",
                              isSelected ? "text-primary" : "text-muted-foreground/50"
                            )}>
                              {opt.score}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <Card className="rounded-none shadow-none border-border/70 shrink-0">
                <CardHeader className="bg-muted/30 border-b border-border/70 py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Tindakan Pencegahan
                    </CardTitle>
                    <Badge className={cn("rounded-none border shadow-none", riskInfo.bg, riskInfo.color, riskInfo.border)}>
                      Risiko {riskInfo.level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(defaultInterventions[(riskInfo.level || "Rendah") as keyof typeof defaultInterventions]).map((intervention, idx) => {
                      const isChecked = selectedInterventions.includes(intervention);
                      return (
                        <label
                          key={idx}
                          onClick={() => {
                            setSelectedInterventions(prev =>
                              prev.includes(intervention)
                                ? prev.filter(i => i !== intervention)
                                : [...prev, intervention]
                            );
                          }}
                          className={cn(
                            "flex items-start gap-3 p-2.5 rounded-none border cursor-pointer transition-colors",
                            isChecked ? "bg-primary/5 border-primary/50" : "bg-background border-border/70 hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "mt-0 w-4 h-4 rounded-none flex items-center justify-center border",
                            isChecked ? "bg-primary border-primary text-primary-foreground" : "border-input"
                          )}>
                            {isChecked && <CheckSquare className="w-3 h-3" />}
                          </div>
                          <span className={cn("text-xs leading-tight mt-px", isChecked ? "text-foreground font-semibold" : "text-muted-foreground")}>
                            {intervention}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-1.5 shrink-0">
                <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Catatan Tambahan (Opsional)</Label>
                <Input
                  placeholder="Ketik catatan di sini..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-none border-border/70 h-9 text-xs"
                />
              </div>
            </form>
          </div>

          <div className="shrink-0 border-t bg-background p-4 flex items-center justify-end gap-2">
            <Button variant="outline" className="rounded-none w-28 text-xs h-9" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button form="fall-risk-form" type="submit" className="rounded-none w-28 text-xs h-9" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
