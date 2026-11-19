import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus, Loader2, Trash2, ChevronRight, ChevronDown, Wind, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { o2UsageApi, masterDataApi, type O2UsageRecord, type MasterData } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

interface O2UsageFormProps {
  visitId: number;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
  externalData?: O2UsageRecord[];
  useExternalData?: boolean;
}

const DELIVERY_METHODS = [
  { value: "nasal_kanul", label: "Nasal Kanul" },
  { value: "simple_mask", label: "Simple Mask" },
  { value: "nrm", label: "Non-Rebreathing Mask" },
  { value: "venturi_mask", label: "Venturi Mask" },
];
const FLOW_RATES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
const getDeliveryLabel = (v: string) => DELIVERY_METHODS.find((m) => m.value === v)?.label || v;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const toLocalInput = (d?: string | Date) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

interface O2TypeOption {
  masterId: number;
  code: string;
  name: string;
  price: number;
  tankType: string;
}

const parseO2Metadata = (metadata?: string): { price: number; tank_type: string } => {
  if (!metadata) return { price: 0, tank_type: "" };
  try {
    const p = JSON.parse(metadata);
    return { price: Number(p.price || p.harga || 0), tank_type: String(p.tank_type || p.tipe || "") };
  } catch {
    return { price: 0, tank_type: "" };
  }
};

export function O2UsageForm({ visitId, readOnly = false, isPatientDischarged = false, externalData, useExternalData = false }: O2UsageFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<O2UsageRecord[]>([]);
  const [o2Types, setO2Types] = useState<O2TypeOption[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [stopRecordId, setStopRecordId] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  // Add form
  const [formO2TypeId, setFormO2TypeId] = useState("");
  const [formFlowRate, setFormFlowRate] = useState("3");
  const [formDeliveryMethod, setFormDeliveryMethod] = useState("nasal_kanul");
  const [formStartedAt, setFormStartedAt] = useState("");
  const [formNotes, setFormNotes] = useState("");
  // Stop form
  const [formStoppedAt, setFormStoppedAt] = useState("");

  const isFormDisabled = readOnly || isPatientDischarged;
  const totalCharge = useMemo(() => records.reduce((s, r) => s + (r.total_charge || 0), 0), [records]);

  const selectedO2Type = useMemo(() => o2Types.find((t) => String(t.masterId) === formO2TypeId), [o2Types, formO2TypeId]);
  const o2TypeOptions = useMemo(() => o2Types.map((t) => ({ value: String(t.masterId), label: `${t.name} — ${formatCurrency(t.price)}` })), [o2Types]);

  useEffect(() => {
    emitMedicalRecordTabIndicator("o2-usage", records.length > 0 ? String(records.length) : "");
  }, [records]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      if (useExternalData) {
        setRecords(externalData || []);
        setLoading(false);
        return;
      }
      try {
        const [recRes, mdRes] = await Promise.all([
          o2UsageApi.getAll(visitId),
          masterDataApi.getByCategory("o2_type"),
        ]);
        if (!active) return;
        setRecords(recRes.data?.data || []);
        setO2Types(
          (mdRes.data?.data || []).map((md: MasterData) => {
            const meta = parseO2Metadata(md.metadata);
            return { masterId: md.id, code: md.code, name: md.name, price: meta.price, tankType: meta.tank_type };
          }),
        );
      } catch {
        if (active) toast({ title: "Gagal", description: "Data oksigen tidak dapat dimuat.", variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [externalData, useExternalData, visitId, toast]);

  const openAddModal = () => {
    setFormO2TypeId("");
    setFormFlowRate("3");
    setFormDeliveryMethod("nasal_kanul");
    setFormStartedAt(toLocalInput(new Date()));
    setFormNotes("");
    setIsAddModalOpen(true);
  };

  const handleAdd = async () => {
    if (!selectedO2Type) return;
    setSaving(true);
    try {
      const res = await o2UsageApi.start(visitId, {
        tank_type: selectedO2Type.name,
        flow_rate: parseFloat(formFlowRate) || 3,
        delivery_method: formDeliveryMethod,
        started_at: formStartedAt ? new Date(formStartedAt).toISOString() : undefined,
        base_price: selectedO2Type.price,
        notes: formNotes,
      });
      setRecords((prev) => [res.data.data, ...prev]);
      setIsAddModalOpen(false);
      toast({ title: "Berhasil", description: "Penggunaan oksigen dicatat." });
    } catch {
      toast({ title: "Gagal", description: "Gagal menyimpan data oksigen.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openStopModal = (r: O2UsageRecord) => {
    setStopRecordId(r.id);
    setFormStoppedAt(toLocalInput(new Date()));
    setIsStopModalOpen(true);
  };

  const handleStop = async () => {
    setSaving(true);
    try {
      const res = await o2UsageApi.stop(visitId, stopRecordId, {
        stopped_at: formStoppedAt ? new Date(formStoppedAt).toISOString() : undefined,
      });
      setRecords((prev) => prev.map((r) => (r.id === stopRecordId ? res.data.data : r)));
      setIsStopModalOpen(false);
      toast({ title: "Berhasil", description: "Oksigen dihentikan & billing tercatat." });
    } catch {
      toast({ title: "Gagal", description: "Gagal menghentikan oksigen.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await o2UsageApi.delete(visitId, id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Berhasil", description: "Data dihapus." });
    } catch {
      toast({ title: "Gagal", description: "Gagal menghapus.", variant: "destructive" });
    }
  };

  if (loading) {
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
            Penggunaan Oksigen
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Catat pemakaian oksigen, flow rate, metode pemberian, durasi, dan estimasi tarif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {records.length} entri{totalCharge > 0 ? ` • ${formatCurrency(totalCharge)}` : ""}
          </span>
          {!isFormDisabled && !useExternalData && (
            <Button
              type="button"
              onClick={openAddModal}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah O2
            </Button>
          )}
        </div>
      </div>

      {/* Table / Empty State */}
      <div className="p-4 sm:p-5">
        {records.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Jenis O2</th>
                  <th className="px-3 py-2 text-left">Waktu</th>
                  <th className="px-3 py-2 text-left">Metode</th>
                  <th className="px-3 py-2 text-right">Flow</th>
                  <th className="px-3 py-2 text-right">Tarif/m</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="w-28 px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              {records.map((r) => {
                const isActive = !r.stopped_at;
                const isOpen = !!expandedIds[r.id];
                return (
                  <tbody key={r.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
                    <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors align-middle">
                      <td className="px-3 py-2.5 w-10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none"
                          onClick={() => setExpandedIds((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isActive ? (
                          <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5 animate-pulse">
                            AKTIF
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5">
                            Selesai
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{r.tank_type}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.started_at), "dd/MM HH:mm", { locale: localeId })}
                        {r.stopped_at && <> — {format(new Date(r.stopped_at), "dd/MM HH:mm")}</>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {getDeliveryLabel(r.delivery_method)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        {r.flow_rate} L/m
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        {formatCurrency(r.flow_rate * r.base_price)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap">
                        {r.total_charge > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(r.total_charge)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isActive && !isFormDisabled && !useExternalData && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 text-[10px] rounded-none gap-1"
                              onClick={() => openStopModal(r)}
                            >
                              <Square className="h-3 w-3" />
                              Stop
                            </Button>
                          )}
                          {!isFormDisabled && !useExternalData && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-none"
                              title="Hapus"
                              onClick={() => handleDelete(r.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-neutral-50/30 dark:bg-neutral-900/20">
                        <td colSpan={9} className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800/80">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Jenis:</span>{" "}
                              <span className="font-medium text-foreground">{r.tank_type}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Flow:</span>{" "}
                              <span className="font-mono font-medium text-foreground">{r.flow_rate} L/menit</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Metode:</span>{" "}
                              <span className="font-medium text-foreground">{getDeliveryLabel(r.delivery_method)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Harga/L:</span>{" "}
                              <span className="font-mono font-medium text-foreground">{r.base_price > 0 ? formatCurrency(r.base_price) : "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tarif/Menit:</span>{" "}
                              <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{formatCurrency(r.flow_rate * r.base_price)}</span>
                            </div>
                            {r.total_charge > 0 && (
                              <div>
                                <span className="text-muted-foreground">Total:</span>{" "}
                                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(r.total_charge)}</span>
                              </div>
                            )}
                            {r.created_by && (
                              <div>
                                <span className="text-muted-foreground">Mulai Oleh:</span>{" "}
                                <span className="font-medium text-foreground">{r.created_by.full_name}</span>
                              </div>
                            )}
                            {r.stopped_by && (
                              <div>
                                <span className="text-muted-foreground">Stop Oleh:</span>{" "}
                                <span className="font-medium text-foreground">{r.stopped_by.full_name}</span>
                              </div>
                            )}
                            {r.notes && (
                              <div className="col-span-full pt-2 border-t border-neutral-200/70 dark:border-neutral-800/70">
                                <span className="text-muted-foreground">Catatan:</span>{" "}
                                <span className="text-foreground">{r.notes}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Wind className="h-4 w-4 opacity-60 shrink-0" />
            <span>Belum ada penggunaan oksigen — klik Tambah O2 untuk memulai pencatatan.</span>
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Wind className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  Tambah Penggunaan Oksigen
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pilih jenis oksigen, flow rate, metode pemberian, dan waktu mulai pemakaian.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jenis Oksigen *</Label>
              <Combobox
                options={o2TypeOptions}
                value={formO2TypeId}
                onValueChange={(v) => setFormO2TypeId(v || "")}
                placeholder="Pilih jenis oksigen"
                searchPlaceholder="Cari..."
                emptyText="Tidak ada jenis oksigen. Tambahkan di Master Data → o2_type"
                className="w-full"
              />
              {selectedO2Type && (
                <p className="text-[11px] text-muted-foreground">
                  Harga Dasar:{" "}
                  <span className="font-mono font-semibold text-foreground">{formatCurrency(selectedO2Type.price)}</span> per Liter
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Flow Rate (L/menit)</Label>
                <Select value={formFlowRate} onValueChange={setFormFlowRate}>
                  <SelectTrigger className="h-9 text-xs rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {FLOW_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)} className="text-xs">
                        {r} L/menit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Metode Pemberian</Label>
                <Select value={formDeliveryMethod} onValueChange={setFormDeliveryMethod}>
                  <SelectTrigger className="h-9 text-xs rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {DELIVERY_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Waktu Mulai</Label>
              <Input
                type="datetime-local"
                value={formStartedAt}
                onChange={(e) => setFormStartedAt(e.target.value)}
              />
            </div>

            {selectedO2Type && (
              <div className="border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/60 dark:bg-neutral-900/40 px-3.5 py-2.5 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Estimasi tarif per menit:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(selectedO2Type.price * parseFloat(formFlowRate || "0"))} / mnt
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Catatan tambahan"
              />
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={() => setIsAddModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-none px-4 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={handleAdd}
              disabled={saving || !formO2TypeId}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wind className="mr-1.5 h-3.5 w-3.5" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STOP MODAL */}
      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="sm:max-w-md rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Square className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  Hentikan Oksigen
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Tentukan waktu selesai pemakaian oksigen untuk menghitung billing otomatis.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-2">
            <Label className="text-xs font-medium">Waktu Selesai</Label>
            <Input
              type="datetime-local"
              value={formStoppedAt}
              onChange={(e) => setFormStoppedAt(e.target.value)}
              className="h-9 text-xs rounded-none"
            />
          </div>

          <DialogFooter className="px-4 sm:px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={() => setIsStopModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={handleStop}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1.5 h-3.5 w-3.5" />}
              Hentikan & Hitung
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
