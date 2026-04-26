import { useToast } from "@/hooks/use-toast";
// import { useImmer } from "use-immer";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fluidBalanceApi, SHIFT_TYPES } from "@/lib/api";
import type { FluidBalance, CreateFluidBalanceInput } from "@/lib/api";
import { format } from "date-fns";
import { Loader2, Plus, Droplets } from "lucide-react";

interface FluidBalanceFormProps {
  visitId: number;
  readOnly?: boolean;
  externalData?: FluidBalance[];
  useExternalData?: boolean;
  staffOptions?: { id: number; name: string }[];
  onSetCreatedBy?: (id: number, name: string) => void;
  onSetApprovedBy?: (id: number, name: string) => void;
}
import { useState, useEffect, useCallback } from "react";
import { useImmer } from "use-immer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";








const defaultFormData: CreateFluidBalanceInput = {
  record_date: format(new Date(), "yyyy-MM-dd"),
  shift_type: "pagi",
  oral_drink: 0,
  oral_food: 0,
  oral_medicine: 0,
  iv_fluid: 0,
  iv_medicine: 0,
  blood_product: 0,
  enteral_feed: 0,
  other_intake: 0,
  other_intake_note: "",
  urine_amount: 0,
  urine_color: "",
  urine_catheter: false,
  feces_amount: 0,
  feces_freq: 0,
  feces_type: "",
  vomit_amount: 0,
  vomit_freq: 0,
  drain_amount: 0,
  drain_type: "",
  drain_color: "",
  blood_loss: 0,
  blood_loss_note: "",
  iwl: 0,
  other_output: 0,
  other_output_note: "",
  notes: "",
};

export function FluidBalanceForm({
  visitId,
  readOnly = false,
  externalData,
  useExternalData = false,
}: FluidBalanceFormProps) {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<FluidBalance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateFluidBalanceInput>(defaultFormData);
  // Intake/Output detail state for UI only (not persisted)
  // Use any[] for detail arrays to avoid TS union issues
  const [intakeDetails, updateIntakeDetails] = useImmer<any[]>([
    { type: "oral", label: "Oral", value: 0 },
    { type: "ngt", label: "NGT", value: 0 },
    { type: "makanan", jenis: "makanan", value: 0 },
    { type: "parenteral", inputJenis: "", inputJumlah: 0, items: [] },
    { type: "iv", inputJenis: "", inputJumlah: 0, items: [] },
    { type: "darah", inputJenis: "", inputJumlah: 0, items: [] },
  ]);
  const [outputDetails, updateOutputDetails] = useImmer<any[]>([
    { type: "muntah", label: "Oral (Muntah)", value: 0 },
    { type: "ngt", label: "NGT", value: 0 },
    { type: "drain", inputJenis: "", inputJumlah: 0, items: [] },
    { type: "urine", warna: "", value: 0, catheter: false },
    { type: "feses", tekstur: "", warna: "", value: 0 },
    { type: "perdarahan", value: 0 },
  ]);
  const [iwl, setIwl] = useState<{hitung: boolean, value: number}>({ hitung: false, value: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    if (useExternalData) {
      setBalances(externalData || []);
      setLoading(false);
      return;
    }
    try {
      const balanceRes = await fluidBalanceApi.getAll(visitId);
      setBalances(balanceRes.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat catatan balance cairan",
      });
    } finally {
      setLoading(false);
    }
  }, [externalData, useExternalData, visitId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);  // Open modal for create
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      record_date: format(new Date(), "yyyy-MM-dd"),
    });
    setIsModalOpen(true);
  };

  // handleOpenEdit removed (unused)

  // Handle form change
  const handleChange = (field: keyof CreateFluidBalanceInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate totals for preview
  const calcIntake = () => {
    return (formData.oral_drink || 0) + (formData.oral_food || 0) + (formData.oral_medicine || 0) +
           (formData.iv_fluid || 0) + (formData.iv_medicine || 0) + (formData.blood_product || 0) +
           (formData.enteral_feed || 0) + (formData.other_intake || 0);
  };

  const calcOutput = () => {
    return (formData.urine_amount || 0) + (formData.feces_amount || 0) + (formData.vomit_amount || 0) +
           (formData.drain_amount || 0) + (formData.blood_loss || 0) + (formData.iwl || 0) +
           (formData.other_output || 0);
  };




  // Save
  const handleSave = async () => {
    if (!formData.shift_type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Shift harus dipilih",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await fluidBalanceApi.update(visitId, editingId, formData);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil diperbarui",
        });
      } else {
        await fluidBalanceApi.create(visitId, formData);
        toast({
          title: "Berhasil",
          description: "Balance cairan berhasil ditambahkan",
        });
      }
      setIsModalOpen(false);
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan balance cairan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete logic removed



  if (loading) {
    return (
      <div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Daftar Balance Cairan</span>
                {!readOnly && (
                  <Button onClick={handleOpenCreate} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {balances.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b sticky top-0 rounded-t-lg">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Tanggal</div>
                  <div className="col-span-2">Shift</div>
                  <div className="col-span-2">Intake</div>
                  <div className="col-span-2">Output</div>
                  <div className="col-span-2">Balance</div>
                  <div className="col-span-1">Aksi</div>
                </div>
                {/* Table rows removed for undefined FluidBalanceCollapsibleRow */}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Belum ada catatan balance cairan</p>
                <p className="text-sm mt-1">
                  {readOnly
                    ? "Belum ada catatan balance cairan pada RM duplikat."
                    : 'Klik "Tambah Balance" untuk menambahkan catatan.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal - Fullscreen */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-full w-full h-screen max-h-screen flex flex-col p-0 gap-0 rounded-none">
          <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              {editingId ? "Edit Balance Cairan" : "Tambah Balance Cairan"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="grid gap-4 pb-4">
              {/* Date & Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={formData.record_date}
                    onChange={(e) => handleChange("record_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select
                    value={formData.shift_type}
                    onValueChange={(v) => handleChange("shift_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Intake Section - sesuai gambar */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="font-semibold flex items-center gap-2 mb-3">
                  INTAKE (Masukan)
                </Label>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <Label className="text-xs">Oral</Label>
                    <Input type="number" value={intakeDetails[0].value} onChange={e=>updateIntakeDetails((d:any[])=>{(d[0] as any).value=+e.target.value||0})} />
                  </div>
                  <div>
                    <Label className="text-xs">NGT</Label>
                    <Input type="number" value={intakeDetails[1].value} onChange={e=>updateIntakeDetails((d:any[])=>{(d[1] as any).value=+e.target.value||0})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <Label className="text-xs">Jenis Konsumsi</Label>
                    <Select value={(intakeDetails[2] as any).jenis||""} onValueChange={(v: string)=>updateIntakeDetails((d:any[])=>{(d[2] as any).jenis=v})}>
                      <SelectTrigger><SelectValue placeholder="Makanan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="makanan">Makanan</SelectItem>
                        <SelectItem value="suplemen">Suplemen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jumlah</Label>
                    <Input type="number" value={(intakeDetails[2] as any).value||0} onChange={e=>updateIntakeDetails((d:any[])=>{(d[2] as any).value=+e.target.value||0})} />
                  </div>
                </div>
                {/* Parenteral, IV, Darah: dynamic rows */}
                {["parenteral","iv","darah"].map((type,idx)=>(
                  <div key={type} className="grid grid-cols-2 gap-4 mb-2 items-end">
                    <div>
                      <Label className="text-xs">{type==="parenteral"?"Parenteral":type==="iv"?"Obat Intravena":"Transfusi Produk Darah"}</Label>
                      <Input placeholder={`Jenis ${type}`} value={(intakeDetails[3+idx] as any).inputJenis||""} onChange={e=>updateIntakeDetails((d:any[])=>{(d[3+idx] as any).inputJenis=e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Jumlah" value={(intakeDetails[3+idx] as any).inputJumlah||""} onChange={e=>updateIntakeDetails((d:any[])=>{(d[3+idx] as any).inputJumlah=+e.target.value||0})} />
                      <Button type="button" size="sm" onClick={()=>{
                        updateIntakeDetails((d:any[])=>{
                          const det = d[3+idx] as any;
                          if(!det.items) det.items=[];
                          if(det.inputJenis&&det.inputJumlah>0) det.items.push({jenis:det.inputJenis,jumlah:det.inputJumlah});
                          det.inputJenis="";det.inputJumlah=0;
                        });
                      }}>+
                      </Button>
                    </div>
                    <div className="col-span-2">
                      {((intakeDetails[3+idx] as any).items||[]).map((item: {jenis:string;jumlah:number},i:number)=>(
                        <div key={i} className="flex gap-2 text-xs items-center mb-1">
                          <span>{item.jenis}</span>
                          <span>{item.jumlah} ml</span>
                          <Button type="button" size="sm" variant="ghost" onClick={()=>updateIntakeDetails((d:any[])=>{((d[3+idx] as any).items as any[]).splice(i,1)})}>Hapus</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-2 text-right text-sm font-semibold text-green-700">
                  Total Intake: {/* TODO: sum all intakeDetails */}
                </div>
              </div>

              {/* Output Section - sesuai gambar */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="font-semibold flex items-center gap-2 mb-3">
                  OUTPUT (Keluaran)
                </Label>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <Label className="text-xs">Oral (Muntah)</Label>
                    <Input type="number" value={outputDetails[0].value} onChange={e=>updateOutputDetails((d:any[])=>{(d[0] as any).value=+e.target.value||0})} />
                  </div>
                  <div>
                    <Label className="text-xs">NGT</Label>
                    <Input type="number" value={outputDetails[1].value} onChange={e=>updateOutputDetails((d:any[])=>{(d[1] as any).value=+e.target.value||0})} />
                  </div>
                </div>
                {/* Drain dynamic */}
                <div className="grid grid-cols-2 gap-4 mb-2 items-end">
                  <div>
                    <Label className="text-xs">Input Jenis Drain</Label>
                    <Input value={(outputDetails[2] as any).inputJenis||""} onChange={e=>updateOutputDetails((d:any[])=>{(d[2] as any).inputJenis=e.target.value})} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Jumlah" value={(outputDetails[2] as any).inputJumlah||""} onChange={e=>updateOutputDetails((d:any[])=>{(d[2] as any).inputJumlah=+e.target.value||0})} />
                    <Button type="button" size="sm" onClick={()=>{
                      updateOutputDetails((d:any[])=>{
                        const det = d[2] as any;
                        if(!det.items) det.items=[];
                        if(det.inputJenis&&det.inputJumlah>0) det.items.push({jenis:det.inputJenis,jumlah:det.inputJumlah});
                        det.inputJenis="";det.inputJumlah=0;
                      });
                    }}>+
                    </Button>
                  </div>
                  <div className="col-span-2">
                    {((outputDetails[2] as any).items||[]).map((item: {jenis:string;jumlah:number},i:number)=>(
                      <div key={i} className="flex gap-2 text-xs items-center mb-1">
                        <span>{item.jenis}</span>
                        <span>{item.jumlah} ml</span>
                          <Button type="button" size="sm" variant="ghost" onClick={()=>updateOutputDetails((d:any[])=>{((d[2] as any).items as any[]).splice(i,1)})}>Hapus</Button>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Urine */}
                <div className="grid grid-cols-2 gap-4 mb-2 items-end">
                  <div>
                    <Label className="text-xs">Warna Urine</Label>
                    <Select value={(outputDetails[3] as any).warna||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[3] as any).warna=v})}>
                      <SelectTrigger><SelectValue placeholder="[ Warna ]" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jernih">Jernih</SelectItem>
                        <SelectItem value="kuning">Kuning</SelectItem>
                        <SelectItem value="keruh">Keruh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jumlah Urine</Label>
                    <Input type="number" value={(outputDetails[3] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[3] as any).value=+e.target.value||0})} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 mt-1">
                    <Checkbox checked={(outputDetails[3] as any).catheter} onCheckedChange={(v: boolean)=>updateOutputDetails((d:any[])=>{(d[3] as any).catheter=!!v})} />
                    <span className="text-xs">Spooling Catheter</span>
                  </div>
                </div>
                {/* Feses */}
                <div className="grid grid-cols-3 gap-4 mb-2 items-end">
                  <div>
                    <Label className="text-xs">Tekstur Feses</Label>
                    <Select value={(outputDetails[4] as any).tekstur||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[4] as any).tekstur=v})}>
                      <SelectTrigger><SelectValue placeholder="[ Tekstur ]" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padat">Padat</SelectItem>
                        <SelectItem value="lunak">Lunak</SelectItem>
                        <SelectItem value="cair">Cair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Warna Feses</Label>
                    <Select value={(outputDetails[4] as any).warna||""} onValueChange={(v: string)=>updateOutputDetails((d:any[])=>{(d[4] as any).warna=v})}>
                      <SelectTrigger><SelectValue placeholder="[ Warna ]" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kuning">Kuning</SelectItem>
                        <SelectItem value="coklat">Coklat</SelectItem>
                        <SelectItem value="hitam">Hitam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jumlah Feses</Label>
                    <Input type="number" value={(outputDetails[4] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[4] as any).value=+e.target.value||0})} />
                  </div>
                </div>
                {/* Perdarahan */}
                <div className="grid grid-cols-1 gap-4 mb-2">
                  <div>
                    <Label className="text-xs">Perdarahan</Label>
                    <Input type="number" value={(outputDetails[5] as any).value||0} onChange={e=>updateOutputDetails((d:any[])=>{(d[5] as any).value=+e.target.value||0})} />
                  </div>
                </div>
                {/* IWL */}
                <div className="flex items-center gap-6 border rounded-lg bg-gray-100 p-3 mt-2">
                  <div className="flex-1">
                    <div className="font-semibold text-center">Hitung IWL<br /><span className="text-xs">(Insensible Water Loss)</span></div>
                    <div className="flex gap-6 justify-center mt-2">
                      <label className="flex items-center gap-1"><input type="radio" checked={iwl.hitung} onChange={()=>setIwl({hitung:true,value:iwl.value})}/> YA</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={!iwl.hitung} onChange={()=>setIwl({hitung:false,value:0})}/> TIDAK</label>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="uppercase text-xs tracking-widest">VOLUME</div>
                    <div className="text-3xl font-bold">{iwl.value}</div>
                    <span className="text-xs">ml</span>
                  </div>
                </div>
                <div className="mt-2 text-right text-sm font-semibold text-red-700">
                  Total Output: {/* TODO: sum all outputDetails + iwl */}
                </div>
              </div>

              {/* Balance Preview */}
              <div className={`border rounded-lg p-4 text-center ${
                calcIntake() - calcOutput() > 0 ? "bg-green-100" : 
                calcIntake() - calcOutput() < 0 ? "bg-red-100" : "bg-gray-100"
              }`}>
                <p className="text-sm font-medium">BALANCE</p>
                <p className={`text-2xl font-bold ${
                  calcIntake() - calcOutput() > 0 ? "text-green-700" : 
                  calcIntake() - calcOutput() < 0 ? "text-red-700" : "text-gray-700"
                }`}>
                  {calcIntake() - calcOutput() > 0 ? "+" : ""}{calcIntake() - calcOutput()} ml
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-muted/50 shrink-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation removed */}
    </>
  );
}
