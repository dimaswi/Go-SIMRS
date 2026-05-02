import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Plus, Loader2, Trash2, X, ChevronRight, ChevronDown, Wind, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox } from "@/components/ui/combobox";
import { o2UsageApi, masterDataApi, type O2UsageRecord, type MasterData } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

interface O2UsageFormProps {
  visitId: number;
  readOnly?: boolean;
  isPatientDischarged?: boolean;
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

export function O2UsageForm({ visitId, readOnly = false, isPatientDischarged = false }: O2UsageFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<O2UsageRecord[]>([]);
  const [o2Types, setO2Types] = useState<O2TypeOption[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [stopRecordId, setStopRecordId] = useState(0);

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
  }, [visitId, toast]);

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

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Wind className="h-3.5 w-3.5" />Penggunaan Oksigen</span>
              <div className="flex items-center gap-2">
                {totalCharge > 0 && <span className="text-[10px] font-medium text-green-600 normal-case">Total: {formatCurrency(totalCharge)}</span>}
                {!isFormDisabled && (
                  <Button onClick={openAddModal} size="sm" className="h-6 px-2 py-0 text-[10px]">
                    <Plus className="h-3.5 w-3.5 mr-1" />Tambah O2
                  </Button>
                )}
              </div>
            </div>
          </div>

          {records.length > 0 ? (
            <div>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-1 pl-8">Status</div>
                <div className="col-span-2">Jenis O2</div>
                <div className="col-span-2">Waktu</div>
                <div className="col-span-2">Metode</div>
                <div className="col-span-1">Flow</div>
                <div className="col-span-1">Tarif/m</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-2 text-right">Aksi</div>
              </div>
              <div className="divide-y">
                {records.map((r) => {
                  const isActive = !r.stopped_at;
                  return (
                    <Collapsible key={r.id} className="group">
                      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-none shrink-0">
                            <ChevronRight className="h-4 w-4 group-data-[state=open]:hidden" />
                            <ChevronDown className="h-4 w-4 hidden group-data-[state=open]:block" />
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex-1 grid grid-cols-12 gap-2 items-center text-xs">
                          <div className="col-span-1">
                            {isActive ? <Badge variant="destructive" className="text-[9px] px-1.5 animate-pulse">AKTIF</Badge>
                              : <Badge variant="secondary" className="text-[9px] px-1.5">Selesai</Badge>}
                          </div>
                          <div className="col-span-2 font-medium truncate">{r.tank_type}</div>
                          <div className="col-span-2 truncate">
                            {format(new Date(r.started_at), "dd/MM HH:mm", { locale: localeId })}
                            {r.stopped_at && <> — {format(new Date(r.stopped_at), "dd/MM HH:mm")}</>}
                          </div>
                          <div className="col-span-2 text-muted-foreground truncate">{getDeliveryLabel(r.delivery_method)}</div>
                          <div className="col-span-1">{r.flow_rate} L/m</div>
                          <div className="col-span-1">{formatCurrency(r.flow_rate * r.base_price)}</div>
                          <div className="col-span-1">{r.total_charge > 0 ? <span className="text-green-600 font-medium">{formatCurrency(r.total_charge)}</span> : "—"}</div>
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            {isActive && !isFormDisabled && (
                              <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px] rounded-none" onClick={() => openStopModal(r)}>
                                <Square className="h-3 w-3 mr-1" />Stop
                              </Button>
                            )}
                            {!isFormDisabled && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-none" onClick={() => handleDelete(r.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="px-12 py-3 bg-muted/10 border-t border-border/50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-muted-foreground">Jenis:</span> <span className="font-medium">{r.tank_type}</span></div>
                            <div><span className="text-muted-foreground">Flow:</span> <span className="font-medium">{r.flow_rate} L/menit</span></div>
                            <div><span className="text-muted-foreground">Metode:</span> <span className="font-medium">{getDeliveryLabel(r.delivery_method)}</span></div>
                            <div><span className="text-muted-foreground">Harga/L:</span> <span className="font-medium">{r.base_price > 0 ? formatCurrency(r.base_price) : "-"}</span></div>
                            <div><span className="text-muted-foreground">Tarif/Menit:</span> <span className="font-medium text-orange-600">{formatCurrency(r.flow_rate * r.base_price)}</span></div>
                            {r.total_charge > 0 && <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold text-green-600">{formatCurrency(r.total_charge)}</span></div>}
                            {r.notes && <div className="col-span-full"><span className="text-muted-foreground">Catatan:</span> {r.notes}</div>}
                            {r.created_by && <div><span className="text-muted-foreground">Mulai Oleh:</span> {r.created_by.full_name}</div>}
                            {r.stopped_by && <div><span className="text-muted-foreground">Stop Oleh:</span> {r.stopped_by.full_name}</div>}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Wind className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-sm">Belum ada penggunaan oksigen</p>
              <p className="text-xs mt-1">Klik "Tambah O2" untuk memulai pencatatan.</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="!max-w-lg !rounded-none [&>button]:hidden">
          <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Wind className="h-4 w-4" />Tambah Penggunaan Oksigen
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)} className="h-6 w-6 rounded-none"><X className="h-4 w-4" /></Button>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Jenis Oksigen</Label>
              <Combobox options={o2TypeOptions} value={formO2TypeId} onValueChange={(v) => setFormO2TypeId(v || "")} placeholder="Pilih jenis oksigen" searchPlaceholder="Cari..." emptyText="Tidak ada jenis oksigen. Tambahkan di Master Data → o2_type" className="h-9" />
              {selectedO2Type && <p className="text-xs text-muted-foreground">Harga Dasar: <span className="font-semibold text-foreground">{formatCurrency(selectedO2Type.price)}</span> per Liter</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Flow Rate (L/menit)</Label>
                <Select value={formFlowRate} onValueChange={setFormFlowRate}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FLOW_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r} L/menit</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Metode Pemberian</Label>
                <Select value={formDeliveryMethod} onValueChange={setFormDeliveryMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DELIVERY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Waktu Mulai</Label>
              <Input type="datetime-local" value={formStartedAt} onChange={(e) => setFormStartedAt(e.target.value)} className="h-9 text-xs" />
            </div>
            {selectedO2Type && (
              <div className="rounded-md bg-muted/50 border p-3 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Tarif per menit:</span>
                <span className="font-semibold text-orange-600 text-sm">
                  {formatCurrency(selectedO2Type.price * parseFloat(formFlowRate || "0"))} / mnt
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Catatan tambahan" className="h-9 text-xs" />
            </div>
          </div>
          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" className="rounded-none text-xs h-9" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
            <Button className="rounded-none text-xs h-9" onClick={handleAdd} disabled={saving || !formO2TypeId}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wind className="mr-2 h-4 w-4" />}Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOP MODAL */}
      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="!max-w-md !rounded-none [&>button]:hidden">
          <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Square className="h-4 w-4" />Hentikan Oksigen
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsStopModalOpen(false)} className="h-6 w-6 rounded-none"><X className="h-4 w-4" /></Button>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Waktu Selesai</Label>
              <Input type="datetime-local" value={formStoppedAt} onChange={(e) => setFormStoppedAt(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" className="rounded-none text-xs h-9" onClick={() => setIsStopModalOpen(false)}>Batal</Button>
            <Button variant="destructive" className="rounded-none text-xs h-9" onClick={handleStop} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}Hentikan & Hitung
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
